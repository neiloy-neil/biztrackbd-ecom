import { createHmac, randomBytes } from "node:crypto";
import { withTenant, getBasePrisma } from "@biztrackbd/db";
import { ForbiddenError, ValidationError } from "../errors";
import { assertCan, can, type StaffActor } from "../permissions";
import { enqueueNotificationJob } from "./queue";
import {
  detectWebhookAdapter,
  adaptWebhookPayload,
  getSampleEventData,
  type WebhookAdapterType,
} from "./chat-adapters";

export interface WebhookDispatchInput {
  url: string;
  payload: string | Record<string, unknown>;
  secret?: string;
  timeoutMs?: number;
}

export interface WebhookDispatchResult {
  ok: boolean;
  httpStatus: number | null;
  error?: string;
}

/**
 * Generates an HMAC-SHA256 signature for outbound webhooks:
 * Signature = hmac_sha256(`${timestamp}.${payloadString}`, secret)
 */
export function generateWebhookSignature(
  payloadString: string,
  secret: string,
  timestamp: number = Date.now()
): { signature: string; timestamp: number } {
  const hmac = createHmac("sha256", secret);
  hmac.update(`${timestamp}.${payloadString}`);
  const signature = `t=${timestamp},v1=${hmac.digest("hex")}`;
  return { signature, timestamp };
}

/**
 * Generates a standard high-entropy webhook signing secret prefixed with `whsec_`.
 */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

/**
 * Supported webhook event types in BizTrack Commerce & Business.
 */
export const WEBHOOK_EVENTS = [
  {
    key: "order.created",
    label: "Order Created",
    description: "Triggered whenever a customer completes checkout or a quick order is placed.",
  },
  {
    key: "order.delivered",
    label: "Order Delivered",
    description: "Triggered when a parcel is confirmed delivered by courier sync or merchant action.",
  },
  {
    key: "lead.created",
    label: "Lead Captured",
    description: "Triggered when a prospective client submits an inquiry, contact, or quotation form.",
  },
  {
    key: "booking.created",
    label: "Booking Scheduled",
    description: "Triggered when an appointment, reservation, or consultation is booked.",
  },
  {
    key: "customer.registered",
    label: "Customer Registered",
    description: "Triggered when a new customer registers or completes their first purchase.",
  },
] as const;

export type WebhookEventKey = (typeof WEBHOOK_EVENTS)[number]["key"];

export interface WebhookSubscriptionView {
  id: string;
  tenantId: string;
  targetUrl: string;
  events: string[];
  secretToken: string;
  isActive: boolean;
  createdAt: Date;
  adapter?: WebhookAdapterType;
  name?: string;
}

export interface WebhookLogView {
  id: string;
  tenantId: string;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  targetUrl: string;
  payload: Record<string, unknown>;
  responseStatus: number | null;
  responseBody: string | null;
  attempt: number;
  isSuccess: boolean;
  createdAt: Date;
}

export interface WebhookOverview {
  subscription: WebhookSubscriptionView | null;
  subscriptions: WebhookSubscriptionView[];
  recentLogs: WebhookLogView[];
  stats: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
  };
  availableEvents: typeof WEBHOOK_EVENTS;
}

export interface SaveWebhookInput {
  id?: string;
  name?: string;
  adapter?: WebhookAdapterType;
  targetUrl: string;
  events: string[];
  isActive: boolean;
  secretToken?: string;
}

/**
 * Parses subscription metadata stored in the URL fragment hash (e.g. #adapter=discord&name=Sales).
 */
export function parseSubscriptionMeta(targetUrl: string): {
  cleanUrl: string;
  adapter: WebhookAdapterType;
  name?: string;
} {
  if (!targetUrl) return { cleanUrl: "", adapter: "generic" };
  const hashIdx = targetUrl.indexOf("#");
  if (hashIdx === -1) {
    return {
      cleanUrl: targetUrl,
      adapter: detectWebhookAdapter(targetUrl),
    };
  }

  const cleanUrl = targetUrl.slice(0, hashIdx);
  const hashPart = targetUrl.slice(hashIdx + 1);
  const params = new URLSearchParams(hashPart);
  const adapterParam = params.get("adapter") as WebhookAdapterType | null;
  const nameParam = params.get("name");

  const adapter =
    adapterParam && ["generic", "discord", "slack", "telegram"].includes(adapterParam)
      ? adapterParam
      : detectWebhookAdapter(cleanUrl);
  const name = nameParam ? decodeURIComponent(nameParam) : undefined;

  return { cleanUrl, adapter, name };
}

/**
 * Builds a composite URL preserving the clean base URL along with adapter and name metadata in the URL hash.
 */
export function buildSubscriptionUrl(
  cleanUrl: string,
  adapter?: WebhookAdapterType,
  name?: string
): string {
  const base = cleanUrl.split("#")[0]!.trim();
  const detected = detectWebhookAdapter(base);
  const params = new URLSearchParams();
  if (adapter && adapter !== detected) {
    params.set("adapter", adapter);
  }
  if (name && name.trim()) {
    params.set("name", encodeURIComponent(name.trim()));
  }
  const qs = params.toString();
  return qs ? `${base}#${qs}` : base;
}

/**
 * Enriches a raw database/memory subscription with parsed metadata.
 */
export function enrichSubscriptionView(sub: WebhookSubscriptionView): WebhookSubscriptionView {
  const meta = parseSubscriptionMeta(sub.targetUrl);
  return {
    ...sub,
    adapter: sub.adapter || meta.adapter,
    name: sub.name || meta.name,
  };
}

// In-memory fallback state for isolated unit tests and offline environments
const memorySubscriptions = new Map<string, WebhookSubscriptionView[]>();
const memoryLogs = new Map<string, WebhookLogView[]>();
let dbCheckAllowedCache: boolean | null = null;

export function __resetMemoryWebhooks(): void {
  memorySubscriptions.clear();
  memoryLogs.clear();
  dbCheckAllowedCache = null;
}

async function isWebhookDbAllowed(): Promise<boolean> {
  if (process.env.NODE_ENV === "test") return false;
  if (dbCheckAllowedCache !== null) return dbCheckAllowedCache;
  try {
    const client = getBasePrisma();
    const raw = client as unknown as {
      webhookSubscription?: { findFirst: (args?: unknown) => Promise<unknown> };
    };
    if (!raw.webhookSubscription) {
      dbCheckAllowedCache = false;
      return false;
    }
    await raw.webhookSubscription.findFirst({ select: { id: true } });
    dbCheckAllowedCache = true;
    return true;
  } catch {
    dbCheckAllowedCache = false;
    return false;
  }
}

/**
 * Validates target URL structure and protocol.
 */
export function validateWebhookUrl(urlStr: string): string {
  const trimmed = urlStr.trim();
  if (!trimmed) {
    throw new ValidationError("Target URL is required", { field: "targetUrl" });
  }
  const cleanPart = trimmed.split("#")[0]!.trim();
  let parsed: URL;
  try {
    parsed = new URL(cleanPart);
  } catch {
    throw new ValidationError("Please enter a valid URL (e.g. https://example.com/api/webhooks)", {
      field: "targetUrl",
    });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ValidationError("Webhook URL must use HTTP or HTTPS protocol", { field: "targetUrl" });
  }
  return trimmed;
}

/**
 * Retrieves the merchant's configured webhook subscriptions, recent delivery history, and delivery stats.
 */
export async function getMerchantWebhookOverview(
  tenantId: string,
  actor: StaffActor
): Promise<WebhookOverview> {
  assertCan(actor, "design", "view");

  let subs: WebhookSubscriptionView[] = [];
  let logs: WebhookLogView[] = [];

  const useDb = await isWebhookDbAllowed();
  if (useDb) {
    try {
      const foundSubs = await withTenant(tenantId, async (tx) => {
        const raw = tx as unknown as {
          webhookSubscription: {
            findMany: (args: unknown) => Promise<WebhookSubscriptionView[]>;
          };
        };
        return await raw.webhookSubscription.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
        });
      });

      if (foundSubs && Array.isArray(foundSubs) && foundSubs.length > 0) {
        subs = foundSubs.map(enrichSubscriptionView);
      } else {
        subs = (memorySubscriptions.get(tenantId) ?? []).map(enrichSubscriptionView);
      }

      const foundLogs = await withTenant(tenantId, async (tx) => {
        const raw = tx as unknown as {
          webhookDeliveryLog: {
            findMany: (args: unknown) => Promise<WebhookLogView[]>;
          };
        };
        return await raw.webhookDeliveryLog.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 50,
        });
      });

      if (foundLogs && Array.isArray(foundLogs) && foundLogs.length > 0) {
        logs = foundLogs;
      } else {
        logs = memoryLogs.get(tenantId) ?? [];
      }
    } catch {
      subs = (memorySubscriptions.get(tenantId) ?? []).map(enrichSubscriptionView);
      logs = memoryLogs.get(tenantId) ?? [];
    }
  } else {
    subs = (memorySubscriptions.get(tenantId) ?? []).map(enrichSubscriptionView);
    logs = memoryLogs.get(tenantId) ?? [];
  }

  const totalDeliveries = logs.length;
  const successfulDeliveries = logs.filter((l) => l.isSuccess).length;
  const failedDeliveries = totalDeliveries - successfulDeliveries;
  const primarySub = subs.find((s) => s.isActive) ?? subs[0] ?? null;

  return {
    subscription: primarySub,
    subscriptions: subs,
    recentLogs: logs,
    stats: {
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
    },
    availableEvents: WEBHOOK_EVENTS,
  };
}

/**
 * Saves or updates a merchant's webhook configuration (supports multi-endpoint management).
 */
export async function saveMerchantWebhookSubscription(
  tenantId: string,
  actor: StaffActor,
  input: SaveWebhookInput
): Promise<WebhookSubscriptionView> {
  assertCan(actor, "design", "edit");

  const meta = parseSubscriptionMeta(input.targetUrl);
  const targetAdapter = input.adapter || meta.adapter;
  const targetName = input.name || meta.name;

  validateWebhookUrl(meta.cleanUrl);
  const finalTargetUrl = buildSubscriptionUrl(meta.cleanUrl, targetAdapter, targetName);

  const validEventKeys = new Set(WEBHOOK_EVENTS.map((e) => e.key));
  const filteredEvents = (input.events || []).filter((e) => validEventKeys.has(e as WebhookEventKey));

  if (filteredEvents.length === 0) {
    throw new ValidationError("Please select at least one event subscription", { field: "events" });
  }

  const existingList = memorySubscriptions.get(tenantId) ?? [];
  const now = new Date();
  let savedSub: WebhookSubscriptionView;

  const useDb = await isWebhookDbAllowed();
  if (useDb) {
    try {
      savedSub = await withTenant(tenantId, async (tx) => {
        const raw = tx as unknown as {
          webhookSubscription: {
            findFirst: (args: unknown) => Promise<WebhookSubscriptionView | null>;
            findMany: (args: unknown) => Promise<WebhookSubscriptionView[]>;
            update: (args: unknown) => Promise<WebhookSubscriptionView>;
            create: (args: unknown) => Promise<WebhookSubscriptionView>;
          };
        };

        let existing: WebhookSubscriptionView | null = null;
        if (input.id) {
          existing = await raw.webhookSubscription.findFirst({
            where: { id: input.id, tenantId },
          });
        } else {
          const allTenantSubs = await raw.webhookSubscription.findMany({ where: { tenantId } });
          existing =
            allTenantSubs.find((s) => parseSubscriptionMeta(s.targetUrl).cleanUrl === meta.cleanUrl) ??
            null;
        }

        const secret = input.secretToken?.trim() || existing?.secretToken || generateWebhookSecret();

        if (existing) {
          return await raw.webhookSubscription.update({
            where: { id: existing.id },
            data: {
              targetUrl: finalTargetUrl,
              events: filteredEvents,
              secretToken: secret,
              isActive: input.isActive,
            },
          });
        }

        return await raw.webhookSubscription.create({
          data: {
            ...(input.id ? { id: input.id } : {}),
            tenantId,
            targetUrl: finalTargetUrl,
            events: filteredEvents,
            secretToken: secret,
            isActive: input.isActive,
            createdAt: now,
          },
        });
      });

      // Synchronize in-memory cache as well
      const currentList = memorySubscriptions.get(tenantId) ?? [];
      const idx = currentList.findIndex((s) => s.id === savedSub.id);
      if (idx !== -1) {
        currentList[idx] = savedSub;
      } else {
        currentList.push(savedSub);
      }
      memorySubscriptions.set(tenantId, currentList);
    } catch {
      let existingItem: WebhookSubscriptionView | null = null;
      if (input.id) {
        existingItem = existingList.find((s) => s.id === input.id) ?? null;
      } else {
        existingItem =
          existingList.find((s) => parseSubscriptionMeta(s.targetUrl).cleanUrl === meta.cleanUrl) ??
          null;
      }

      const targetId =
        existingItem?.id || input.id || `wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const secret = input.secretToken?.trim() || existingItem?.secretToken || generateWebhookSecret();

      savedSub = {
        id: targetId,
        tenantId,
        targetUrl: finalTargetUrl,
        events: filteredEvents,
        secretToken: secret,
        isActive: input.isActive,
        createdAt: existingItem?.createdAt || now,
      };

      const idx = existingList.findIndex((s) => s.id === targetId);
      if (idx !== -1) {
        existingList[idx] = savedSub;
      } else {
        existingList.push(savedSub);
      }
      memorySubscriptions.set(tenantId, existingList);
    }
  } else {
    let existingItem: WebhookSubscriptionView | null = null;
    if (input.id) {
      existingItem = existingList.find((s) => s.id === input.id) ?? null;
    } else {
      existingItem =
        existingList.find((s) => parseSubscriptionMeta(s.targetUrl).cleanUrl === meta.cleanUrl) ??
        null;
    }

    const targetId =
      existingItem?.id || input.id || `wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const secret = input.secretToken?.trim() || existingItem?.secretToken || generateWebhookSecret();

    savedSub = {
      id: targetId,
      tenantId,
      targetUrl: finalTargetUrl,
      events: filteredEvents,
      secretToken: secret,
      isActive: input.isActive,
      createdAt: existingItem?.createdAt || now,
    };

    const idx = existingList.findIndex((s) => s.id === targetId);
    if (idx !== -1) {
      existingList[idx] = savedSub;
    } else {
      existingList.push(savedSub);
    }
    memorySubscriptions.set(tenantId, existingList);
  }

  return enrichSubscriptionView(savedSub);
}

/**
 * Deletes a configured webhook subscription by ID.
 */
export async function deleteMerchantWebhookSubscription(
  tenantId: string,
  actor: StaffActor,
  subscriptionId: string
): Promise<{ deleted: boolean }> {
  assertCan(actor, "design", "edit");

  const useDb = await isWebhookDbAllowed();
  if (useDb) {
    try {
      await withTenant(tenantId, async (tx) => {
        const raw = tx as unknown as {
          webhookSubscription: {
            deleteMany: (args: unknown) => Promise<{ count: number }>;
          };
        };
        await raw.webhookSubscription.deleteMany({
          where: { id: subscriptionId, tenantId },
        });
      });
    } catch {
      // Memory fallback
    }
  }

  const list = memorySubscriptions.get(tenantId) || [];
  const filtered = list.filter((s) => s.id !== subscriptionId);
  memorySubscriptions.set(tenantId, filtered);

  return { deleted: true };
}

/**
 * Toggles an endpoint's active/paused state quickly without modifying other settings.
 */
export async function toggleMerchantWebhookSubscription(
  tenantId: string,
  actor: StaffActor,
  subscriptionId: string,
  isActive: boolean
): Promise<WebhookSubscriptionView> {
  assertCan(actor, "design", "edit");

  let updatedSub: WebhookSubscriptionView | null = null;
  const useDb = await isWebhookDbAllowed();

  if (useDb) {
    try {
      updatedSub = await withTenant(tenantId, async (tx) => {
        const raw = tx as unknown as {
          webhookSubscription: {
            update: (args: unknown) => Promise<WebhookSubscriptionView>;
          };
        };
        return await raw.webhookSubscription.update({
          where: { id: subscriptionId },
          data: { isActive },
        });
      });
    } catch {
      // Memory fallback
    }
  }

  const list = memorySubscriptions.get(tenantId) || [];
  const idx = list.findIndex((s) => s.id === subscriptionId);
  if (idx !== -1) {
    list[idx] = { ...list[idx]!, isActive };
    if (!updatedSub) updatedSub = list[idx]!;
    memorySubscriptions.set(tenantId, list);
  }

  if (!updatedSub) {
    throw new ValidationError("Webhook subscription not found to toggle");
  }

  return enrichSubscriptionView(updatedSub);
}

/**
 * Rotates the HMAC-SHA256 signing secret for a webhook subscription.
 */
export async function rotateMerchantWebhookSecret(
  tenantId: string,
  actor: StaffActor,
  subscriptionId?: string
): Promise<{ secretToken: string }> {
  assertCan(actor, "design", "edit");

  const newSecret = generateWebhookSecret();
  const overview = await getMerchantWebhookOverview(tenantId, actor);
  let targetSub: WebhookSubscriptionView | null = null;
  if (subscriptionId) {
    targetSub = overview.subscriptions.find((s) => s.id === subscriptionId) ?? null;
  }
  if (!targetSub) {
    targetSub = overview.subscription;
  }

  if (!targetSub) {
    throw new ValidationError("No webhook configuration found to rotate secret for");
  }

  const updated: SaveWebhookInput = {
    id: targetSub.id,
    name: targetSub.name,
    adapter: targetSub.adapter,
    targetUrl: targetSub.targetUrl,
    events: targetSub.events,
    isActive: targetSub.isActive,
    secretToken: newSecret,
  };

  await saveMerchantWebhookSubscription(tenantId, actor, updated);
  return { secretToken: newSecret };
}

/**
 * Records an outbound webhook delivery outcome into the delivery history.
 */
export async function recordWebhookDeliveryLog(
  tenantId: string,
  log: {
    subscriptionId?: string;
    eventId?: string;
    eventType: string;
    targetUrl: string;
    payload: Record<string, unknown>;
    responseStatus: number | null;
    responseBody: string | null;
    isSuccess: boolean;
  }
): Promise<WebhookLogView> {
  const now = new Date();
  const logId = `whlog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const entry: WebhookLogView = {
    id: logId,
    tenantId,
    subscriptionId: log.subscriptionId || "sub_default",
    eventId: log.eventId || `evt_${Date.now()}`,
    eventType: log.eventType,
    targetUrl: log.targetUrl,
    payload: log.payload,
    responseStatus: log.responseStatus,
    responseBody: log.responseBody?.slice(0, 500) || null,
    attempt: 1,
    isSuccess: log.isSuccess,
    createdAt: now,
  };

  const useDb = await isWebhookDbAllowed();
  if (useDb && log.subscriptionId) {
    try {
      await withTenant(tenantId, async (tx) => {
        const raw = tx as unknown as {
          webhookSubscription: {
            findUnique: (args: unknown) => Promise<unknown>;
          };
          webhookDeliveryLog: {
            create: (args: unknown) => Promise<unknown>;
          };
        };
        const subExists = await raw.webhookSubscription.findUnique({
          where: { id: log.subscriptionId },
        });
        if (subExists) {
          await raw.webhookDeliveryLog.create({
            data: {
              id: entry.id,
              tenantId,
              subscriptionId: log.subscriptionId,
              eventId: entry.eventId,
              eventType: entry.eventType,
              payload: entry.payload,
              responseStatus: entry.responseStatus,
              responseBody: entry.responseBody,
              attempt: entry.attempt,
              isSuccess: entry.isSuccess,
              createdAt: now,
            },
          });
        }
      });
    } catch {
      // Memory fallback
    }
  }

  const list = memoryLogs.get(tenantId) || [];
  list.unshift(entry);
  if (list.length > 50) list.pop();
  memoryLogs.set(tenantId, list);

  return entry;
}

/**
 * Dispatches a live test webhook ping to the merchant's configured endpoint.
 * Supports selecting a specific subscription, target business event, and admin origin for deep links.
 */
export async function sendTestWebhookPing(
  tenantId: string,
  actor: StaffActor,
  options?: {
    subscriptionId?: string;
    event?: WebhookEventKey | "ping";
    adminOrigin?: string;
  }
): Promise<{ ok: boolean; httpStatus: number | null; error?: string }> {
  assertCan(actor, "design", "edit");

  const overview = await getMerchantWebhookOverview(tenantId, actor);
  let targetSub: WebhookSubscriptionView | null = null;
  if (options?.subscriptionId) {
    targetSub = overview.subscriptions.find((s) => s.id === options.subscriptionId) ?? null;
  }
  if (!targetSub) {
    targetSub = overview.subscription;
  }

  if (!targetSub) {
    throw new ValidationError("Please configure and save a webhook target URL before sending a test ping.");
  }

  const eventType = options?.event || "ping";
  const pingId = `ping_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const sampleData = getSampleEventData(eventType);

  let rawPayload: Record<string, unknown>;
  if (eventType === "ping") {
    rawPayload = {
      event: "ping",
      id: pingId,
      timestamp: Date.now(),
      tenantId,
      test: true,
      message: "BizTrack Webhooks: Connectivity & Signature Verification Ping",
      ...sampleData,
    };
  } else {
    rawPayload = {
      event: eventType,
      id: pingId,
      timestamp: Date.now(),
      tenantId,
      test: true,
      data: sampleData,
    };
  }

  const adminOrigin = options?.adminOrigin || "http://localhost:3001";
  const adapted = adaptWebhookPayload(
    targetSub.targetUrl,
    eventType,
    rawPayload,
    adminOrigin,
    targetSub.adapter
  );

  const res = await dispatchOutboundWebhook({
    url: adapted.url,
    payload: adapted.body,
    secret: targetSub.secretToken,
    timeoutMs: 6000,
  });

  await recordWebhookDeliveryLog(tenantId, {
    subscriptionId: targetSub.id,
    eventId: pingId,
    eventType,
    targetUrl: targetSub.targetUrl,
    payload: typeof adapted.body === "object" ? (adapted.body as Record<string, unknown>) : rawPayload,
    responseStatus: res.httpStatus,
    responseBody: res.error || (res.ok ? "HTTP 200 OK" : "Failed"),
    isSuccess: res.ok,
  });

  return {
    ok: res.ok,
    httpStatus: res.httpStatus,
    error: res.error,
  };
}

/**
 * Emits an event to all matching merchant webhook endpoints.
 * Adapts payloads for native chat platform formats (Discord, Slack, Telegram, Generic).
 */
export async function emitMerchantWebhookEvent(
  tenantId: string,
  event: WebhookEventKey,
  payload: Record<string, unknown>,
  adminOrigin: string = "http://localhost:3001"
): Promise<void> {
  let subs: WebhookSubscriptionView[] = [];
  const useDb = await isWebhookDbAllowed();

  if (useDb) {
    try {
      const found = await withTenant(tenantId, async (tx) => {
        const raw = tx as unknown as {
          webhookSubscription: {
            findMany: (args: unknown) => Promise<WebhookSubscriptionView[]>;
          };
        };
        return await raw.webhookSubscription.findMany({
          where: { tenantId, isActive: true },
        });
      });
      if (found && Array.isArray(found) && found.length > 0) {
        subs = found;
      } else {
        subs = (memorySubscriptions.get(tenantId) ?? []).filter((s) => s.isActive);
      }
    } catch {
      subs = (memorySubscriptions.get(tenantId) ?? []).filter((s) => s.isActive);
    }
  } else {
    subs = (memorySubscriptions.get(tenantId) ?? []).filter((s) => s.isActive);
  }

  const matchingSubs = subs.filter((s) => s.isActive && s.events.includes(event));
  if (matchingSubs.length === 0) {
    return;
  }

  for (const rawSub of matchingSubs) {
    const sub = enrichSubscriptionView(rawSub);
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const envelope = {
      event,
      id: eventId,
      timestamp: Date.now(),
      tenantId,
      data: payload,
    };

    const adapted = adaptWebhookPayload(sub.targetUrl, event, envelope, adminOrigin, sub.adapter);

    await enqueueNotificationJob({
      tenantId,
      recipient: adapted.url,
      body: typeof adapted.body === "string" ? adapted.body : JSON.stringify(adapted.body),
      channel: "WEBHOOK",
      event,
      metadata: {
        secret: sub.secretToken,
        subscriptionId: sub.id,
        eventId,
      },
      immediateDispatch: true,
    });
  }
}

/**
 * Dispatches an HTTP POST request to a third-party webhook URL with timeout resilience, signature headers,
 * and automatic stripping of metadata URL hash tags.
 */
export async function dispatchOutboundWebhook(
  input: WebhookDispatchInput
): Promise<WebhookDispatchResult> {
  const cleanUrl = input.url.split("#")[0]!.trim();
  const payloadString =
    typeof input.payload === "string" ? input.payload : JSON.stringify(input.payload);
  const timeoutMs = input.timeoutMs ?? 8000;
  const timestamp = Date.now();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "BizTrackBD-Webhook-Worker/1.0",
    "X-BizTrack-Timestamp": String(timestamp),
  };

  if (input.secret) {
    const { signature } = generateWebhookSignature(payloadString, input.secret, timestamp);
    headers["X-BizTrack-Signature"] = signature;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(cleanUrl, {
      method: "POST",
      headers,
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      return { ok: true, httpStatus: response.status };
    }

    const bodyText = await response.text().catch(() => "");
    const errorMsg = `Endpoint returned HTTP ${response.status}: ${bodyText.slice(0, 200)}`;
    return { ok: false, httpStatus: response.status, error: errorMsg };
  } catch (err) {
    clearTimeout(timeout);
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, httpStatus: null, error: errorMsg };
  }
}

/**
 * Retries up to 10 recent failed webhook delivery attempts.
 */
export async function retryFailedWebhookDeliveries(
  tenantId: string,
  actor: StaffActor,
  subscriptionId?: string
): Promise<{ retriedCount: number }> {
  assertCan(actor, "design", "edit");
  const overview = await getMerchantWebhookOverview(tenantId, actor);
  const targetSub = subscriptionId
    ? overview.subscriptions.find((s) => s.id === subscriptionId)
    : overview.subscription;

  if (!targetSub || !targetSub.isActive) {
    throw new ValidationError("Cannot retry deliveries on an inactive webhook subscription");
  }

  const failedLogs = overview.recentLogs
    .filter((l) => !l.isSuccess && (!subscriptionId || l.subscriptionId === subscriptionId))
    .slice(0, 10);

  let retriedCount = 0;
  for (const log of failedLogs) {
    const cleanUrl = targetSub.targetUrl.split("#")[0]!;
    await enqueueNotificationJob({
      tenantId,
      recipient: cleanUrl,
      body: JSON.stringify(log.payload),
      channel: "WEBHOOK",
      event: log.eventType,
      metadata: {
        secret: targetSub.secretToken,
        subscriptionId: targetSub.id,
        isRetry: true,
      },
      immediateDispatch: true,
    });
    retriedCount++;
  }

  return { retriedCount };
}
