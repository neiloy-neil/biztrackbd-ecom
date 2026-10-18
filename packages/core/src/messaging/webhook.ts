import { createHmac, randomBytes } from "node:crypto";
import { withTenant, getBasePrisma } from "@biztrackbd/db";
import { ForbiddenError, ValidationError } from "../errors";
import { assertCan, can, type StaffActor } from "../permissions";
import { enqueueNotificationJob } from "./queue";

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
  recentLogs: WebhookLogView[];
  stats: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
  };
  availableEvents: typeof WEBHOOK_EVENTS;
}

export interface SaveWebhookInput {
  targetUrl: string;
  events: string[];
  isActive: boolean;
  secretToken?: string;
}

// In-memory fallback state for isolated unit tests and offline environments
const memorySubscriptions = new Map<string, WebhookSubscriptionView>();
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
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ValidationError("Please enter a valid URL (e.g. https://example.com/api/webhooks)", {
      field: "targetUrl",
    });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ValidationError("Webhook URL must use HTTP or HTTPS protocol", { field: "targetUrl" });
  }
  return parsed.toString();
}

/**
 * Retrieves the merchant's configured webhook subscription, recent delivery history, and delivery stats.
 */
export async function getMerchantWebhookOverview(
  tenantId: string,
  actor: StaffActor
): Promise<WebhookOverview> {
  assertCan(actor, "design", "view");

  let sub: WebhookSubscriptionView | null = null;
  let logs: WebhookLogView[] = [];

  const useDb = await isWebhookDbAllowed();
  if (useDb) {
    try {
      const foundSub = await withTenant(tenantId, async (tx) => {
        const raw = tx as unknown as {
          webhookSubscription: {
            findFirst: (args: unknown) => Promise<WebhookSubscriptionView | null>;
          };
        };
        return await raw.webhookSubscription.findFirst({
          where: { tenantId },
        });
      });

      if (foundSub) {
        sub = foundSub;
      } else {
        sub = memorySubscriptions.get(tenantId) ?? null;
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
          take: 20,
        });
      });

      if (foundLogs && Array.isArray(foundLogs) && foundLogs.length > 0) {
        logs = foundLogs;
      } else {
        logs = memoryLogs.get(tenantId) ?? [];
      }
    } catch {
      sub = memorySubscriptions.get(tenantId) ?? null;
      logs = memoryLogs.get(tenantId) ?? [];
    }
  } else {
    sub = memorySubscriptions.get(tenantId) ?? null;
    logs = memoryLogs.get(tenantId) ?? [];
  }

  const totalDeliveries = logs.length;
  const successfulDeliveries = logs.filter((l) => l.isSuccess).length;
  const failedDeliveries = totalDeliveries - successfulDeliveries;

  return {
    subscription: sub,
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
 * Saves or updates the merchant's webhook configuration.
 */
export async function saveMerchantWebhookSubscription(
  tenantId: string,
  actor: StaffActor,
  input: SaveWebhookInput
): Promise<WebhookSubscriptionView> {
  assertCan(actor, "design", "edit");

  const validatedUrl = validateWebhookUrl(input.targetUrl);

  const validEventKeys = new Set(WEBHOOK_EVENTS.map((e) => e.key));
  const filteredEvents = (input.events || []).filter((e) => validEventKeys.has(e as WebhookEventKey));

  if (filteredEvents.length === 0) {
    throw new ValidationError("Please select at least one event subscription", { field: "events" });
  }

  let secret = input.secretToken?.trim();
  if (!secret) {
    const existing = memorySubscriptions.get(tenantId);
    secret = existing?.secretToken || generateWebhookSecret();
  }

  const now = new Date();
  let savedSub: WebhookSubscriptionView;

  const useDb = await isWebhookDbAllowed();
  if (useDb) {
    try {
      savedSub = await withTenant(tenantId, async (tx) => {
        const raw = tx as unknown as {
          webhookSubscription: {
            findFirst: (args: unknown) => Promise<WebhookSubscriptionView | null>;
            update: (args: unknown) => Promise<WebhookSubscriptionView>;
            create: (args: unknown) => Promise<WebhookSubscriptionView>;
          };
        };
        const existing = await raw.webhookSubscription.findFirst({
          where: { tenantId },
        });

        if (existing) {
          return await raw.webhookSubscription.update({
            where: { id: existing.id },
            data: {
              targetUrl: validatedUrl,
              events: filteredEvents,
              secretToken: secret,
              isActive: input.isActive,
            },
          });
        }

        return await raw.webhookSubscription.create({
          data: {
            tenantId,
            targetUrl: validatedUrl,
            events: filteredEvents,
            secretToken: secret,
            isActive: input.isActive,
            createdAt: now,
          },
        });
      });
      // Synchronize in-memory cache as well
      memorySubscriptions.set(tenantId, savedSub);
    } catch {
      const existingId = memorySubscriptions.get(tenantId)?.id || `wh_${Date.now()}`;
      savedSub = {
        id: existingId,
        tenantId,
        targetUrl: validatedUrl,
        events: filteredEvents,
        secretToken: secret,
        isActive: input.isActive,
        createdAt: memorySubscriptions.get(tenantId)?.createdAt || now,
      };
      memorySubscriptions.set(tenantId, savedSub);
    }
  } else {
    const existingId = memorySubscriptions.get(tenantId)?.id || `wh_${Date.now()}`;
    savedSub = {
      id: existingId,
      tenantId,
      targetUrl: validatedUrl,
      events: filteredEvents,
      secretToken: secret,
      isActive: input.isActive,
      createdAt: memorySubscriptions.get(tenantId)?.createdAt || now,
    };
    memorySubscriptions.set(tenantId, savedSub);
  }

  return savedSub;
}

/**
 * Rotates the HMAC-SHA256 signing secret for the merchant's webhook subscription.
 */
export async function rotateMerchantWebhookSecret(
  tenantId: string,
  actor: StaffActor
): Promise<{ secretToken: string }> {
  assertCan(actor, "design", "edit");

  const newSecret = generateWebhookSecret();
  const sub = await getMerchantWebhookOverview(tenantId, actor);
  if (!sub.subscription) {
    throw new ValidationError("No webhook configuration found to rotate secret for");
  }

  const updated: SaveWebhookInput = {
    targetUrl: sub.subscription.targetUrl,
    events: sub.subscription.events,
    isActive: sub.subscription.isActive,
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
 */
export async function sendTestWebhookPing(
  tenantId: string,
  actor: StaffActor
): Promise<{ ok: boolean; httpStatus: number | null; error?: string }> {
  assertCan(actor, "design", "edit");

  const overview = await getMerchantWebhookOverview(tenantId, actor);
  if (!overview.subscription) {
    throw new ValidationError("Please configure and save a webhook target URL before sending a test ping.");
  }

  const pingId = `ping_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const testPayload = {
    event: "ping",
    id: pingId,
    timestamp: Date.now(),
    tenantId,
    test: true,
    message: "BizTrack Webhooks: Connectivity & Signature Verification Ping",
  };

  const res = await dispatchOutboundWebhook({
    url: overview.subscription.targetUrl,
    payload: testPayload,
    secret: overview.subscription.secretToken,
    timeoutMs: 6000,
  });

  await recordWebhookDeliveryLog(tenantId, {
    subscriptionId: overview.subscription.id,
    eventId: pingId,
    eventType: "ping",
    targetUrl: overview.subscription.targetUrl,
    payload: testPayload,
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
 * Emits an event to the merchant's webhook endpoint if an active subscription exists for that event.
 * Uses the durable transactional notification queue with automatic retries and HMAC signing.
 */
export async function emitMerchantWebhookEvent(
  tenantId: string,
  event: WebhookEventKey,
  payload: Record<string, unknown>
): Promise<void> {
  let sub: WebhookSubscriptionView | null = null;
  const useDb = await isWebhookDbAllowed();

  if (useDb) {
    try {
      sub = await withTenant(tenantId, async (tx) => {
        const raw = tx as unknown as {
          webhookSubscription: {
            findFirst: (args: unknown) => Promise<WebhookSubscriptionView | null>;
          };
        };
        return await raw.webhookSubscription.findFirst({
          where: { tenantId, isActive: true },
        });
      });
      if (!sub) {
        sub = memorySubscriptions.get(tenantId) ?? null;
      }
    } catch {
      sub = memorySubscriptions.get(tenantId) ?? null;
    }
  } else {
    sub = memorySubscriptions.get(tenantId) ?? null;
  }

  if (!sub || !sub.isActive || !sub.events.includes(event)) {
    return;
  }

  const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const envelope = {
    event,
    id: eventId,
    timestamp: Date.now(),
    tenantId,
    data: payload,
  };

  await enqueueNotificationJob({
    tenantId,
    recipient: sub.targetUrl,
    body: JSON.stringify(envelope),
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

/**
 * Dispatches an HTTP POST request to a third-party webhook URL with timeout resilience and signature headers.
 */
export async function dispatchOutboundWebhook(
  input: WebhookDispatchInput
): Promise<WebhookDispatchResult> {
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
    const response = await fetch(input.url, {
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
  actor: StaffActor
): Promise<{ retriedCount: number }> {
  assertCan(actor, "design", "edit");
  const overview = await getMerchantWebhookOverview(tenantId, actor);
  if (!overview.subscription || !overview.subscription.isActive) {
    throw new ValidationError("Cannot retry deliveries on an inactive webhook subscription");
  }

  const failedLogs = overview.recentLogs.filter((l) => !l.isSuccess).slice(0, 10);
  let retriedCount = 0;
  for (const log of failedLogs) {
    await enqueueNotificationJob({
      tenantId,
      recipient: overview.subscription.targetUrl,
      body: JSON.stringify(log.payload),
      channel: "WEBHOOK",
      event: log.eventType,
      metadata: {
        secret: overview.subscription.secretToken,
        subscriptionId: overview.subscription.id,
        isRetry: true,
      },
      immediateDispatch: true,
    });
    retriedCount++;
  }

  return { retriedCount };
}

