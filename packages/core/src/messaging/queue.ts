import { withTenant, getBasePrisma, getPlatformPrisma } from "@biztrackbd/db";
import { CourierError } from "../errors";
import { currentSmsSender } from "../customers/auth";
import { dispatchOutboundWebhook } from "./webhook";
import {
  trackServerLead,
  trackServerBooking,
  type SendResult,
  type UserContext,
} from "../growth/tracking";
import {
  trackPlatformInquiryCapi,
  trackPlatformRegistrationCapi,
  type PlatformInquiryEventInput,
  type PlatformRegistrationEventInput,
} from "../platform/tracking";

export type NotificationStatus = "PENDING" | "SENT" | "FAILED" | "EXHAUSTED";
export type NotificationChannel = "SMS" | "WHATSAPP" | "EMAIL" | "META_CAPI" | "WEBHOOK";

export interface EnqueueNotificationInput {
  tenantId: string;
  recipient: string;
  body: string;
  channel?: NotificationChannel;
  event: string;
  metadata?: Record<string, unknown>;
  maxAttempts?: number;
  immediateDispatch?: boolean;
}

export interface NotificationJobRecord {
  id: string;
  tenantId: string;
  channel: string;
  event: string;
  recipient: string;
  body: string;
  status: NotificationStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: Date | null;
  lastError: string | null;
  sentAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnqueueResult {
  ok: boolean;
  jobId: string;
  status: NotificationStatus;
  error?: string;
}

export interface SweepResult {
  processed: number;
  succeeded: number;
  failed: number;
  exhausted: number;
}

export interface OutboxStats {
  pending: number;
  sent: number;
  failed: number;
  exhausted: number;
  total: number;
}

/**
 * In-memory fallback queue for offline environments and automated test isolation.
 */
interface InMemoryJob extends NotificationJobRecord {}
const memoryQueue = new Map<string, InMemoryJob>();
let dbTableAvailable: boolean | null = null;
let memoryOnlyMode = false;

export function __resetMemoryNotificationQueue(): void {
  memoryQueue.clear();
  dbTableAvailable = null;
  memoryOnlyMode = true;
}

export function __getMemoryNotificationJobs(): InMemoryJob[] {
  return Array.from(memoryQueue.values());
}

/**
 * Checks whether an error from the provider is transient (retryable)
 * or permanent (fail fast without useless retries).
 */
export function isTransientError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  if (error instanceof CourierError && error.ambiguous) return true;

  const lower = msg.toLowerCase();

  // Explicit classification prefixes
  if (lower.includes("[permanent]")) return false;
  if (lower.includes("[transient]")) return true;

  // Permanent failure indicators: invalid destination, account exhaustion, or HTTP client errors (4xx)
  const permanentKeywords = [
    "not enough balance",
    "invalid phone",
    "no valid phone",
    "blocked content",
    "invalid sender id",
    "message that is too long",
    "no permission for this account",
    "account has expired",
    "consent not given",
    "no meta pixel",
    "no server-side token",
    "endpoint returned http 400",
    "endpoint returned http 401",
    "endpoint returned http 403",
    "endpoint returned http 404",
    "endpoint returned http 405",
    "endpoint returned http 410",
    "endpoint returned http 422",
    "refused the message: 400",
    "refused the message: 403",
    "refused the message: 405",
    "refused the message: 410",
    "refused the message: 411",
    "refused the message: 413",
    "refused the message: 414",
    "refused the message: 415",
    "refused the message: 416",
    "refused the message: 417",
    "refused the message: 420",
    "refused the message: 421",
  ];

  for (const kw of permanentKeywords) {
    if (lower.includes(kw)) return false;
  }

  // Known transient indicators: network drops, timeouts, 5xx, or provider internal 409 / 429
  const transientKeywords = [
    "timeout",
    "could not be reached",
    "could not reach meta",
    "econnrefused",
    "econnreset",
    "etimedout",
    "enotfound",
    "unknown error",
    "refused the message: 409",
    "status 500",
    "status 502",
    "status 503",
    "status 504",
    "rate limit",
    "429",
  ];

  for (const kw of transientKeywords) {
    if (lower.includes(kw)) return true;
  }

  // Default to transient for unexpected network/IO exceptions
  return true;
}

/**
 * Calculates exponential backoff retry timestamp:
 * Attempt 1: +1 minute (+60s)
 * Attempt 2: +5 minutes (+300s)
 * Attempt 3: +15 minutes (+900s)
 */
export function calculateNextRetry(attempts: number, baseDate: Date = new Date()): Date {
  const delaysMinutes = [1, 5, 15];
  const delayMin = delaysMinutes[Math.min(attempts - 1, delaysMinutes.length - 1)] ?? 15;
  return new Date(baseDate.getTime() + delayMin * 60 * 1000);
}

async function isDbCheckAllowed(): Promise<boolean> {
  if (memoryOnlyMode || process.env.NODE_ENV === "test") {
    return false;
  }
  if (dbTableAvailable !== null) return dbTableAvailable;
  try {
    const client = getBasePrisma();
    const raw = client as unknown as { notificationJob?: { findFirst: (args?: unknown) => Promise<unknown> } };
    if (!raw.notificationJob) {
      dbTableAvailable = false;
      return false;
    }
    await raw.notificationJob.findFirst({ select: { id: true } });
    dbTableAvailable = true;
    return true;
  } catch {
    dbTableAvailable = false;
    return false;
  }
}

/**
 * Enqueues a notification into the durable outbox and optionally performs immediate dispatch.
 */
export async function enqueueNotificationJob(input: EnqueueNotificationInput): Promise<EnqueueResult> {
  const channel = input.channel ?? "SMS";
  const maxAttempts = input.maxAttempts ?? 3;
  const immediate = input.immediateDispatch ?? true;
  const metadata = input.metadata ?? {};
  const now = new Date();
  const initialNextRetry = immediate ? null : now;

  let jobId: string;
  const useDb = await isDbCheckAllowed();

  if (useDb && input.tenantId !== "platform") {
    try {
      const created = await withTenant(input.tenantId, async (tx) => {
        const raw = tx as unknown as {
          notificationJob: {
            create: (args: unknown) => Promise<{ id: string }>;
          };
        };
        return await raw.notificationJob.create({
          data: {
            tenantId: input.tenantId,
            channel,
            event: input.event,
            recipient: input.recipient,
            body: input.body,
            status: "PENDING",
            attempts: 0,
            maxAttempts,
            nextRetryAt: initialNextRetry,
            metadata,
          },
        });
      });
      jobId = created.id;
    } catch {
      // Fallback to in-memory if DB write fails
      jobId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      memoryQueue.set(jobId, {
        id: jobId,
        tenantId: input.tenantId,
        channel,
        event: input.event,
        recipient: input.recipient,
        body: input.body,
        status: "PENDING",
        attempts: 0,
        maxAttempts,
        nextRetryAt: initialNextRetry,
        lastError: null,
        sentAt: null,
        metadata,
        createdAt: now,
        updatedAt: now,
      });
    }
  } else {
    jobId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    memoryQueue.set(jobId, {
      id: jobId,
      tenantId: input.tenantId,
      channel,
      event: input.event,
      recipient: input.recipient,
      body: input.body,
      status: "PENDING",
      attempts: 0,
      maxAttempts,
      nextRetryAt: initialNextRetry,
      lastError: null,
      sentAt: null,
      metadata,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (!immediate) {
    return { ok: true, jobId, status: "PENDING" };
  }

  // Fast-path immediate dispatch
  return await dispatchSingleJob(
    jobId,
    input.tenantId,
    channel,
    input.event,
    input.recipient,
    input.body,
    1,
    maxAttempts,
    metadata
  );
}

/**
 * Dispatches a single job, routing to the appropriate provider (SMS, WhatsApp, Meta CAPI, Webhook)
 * and updating status according to outcome and error classification.
 */
async function dispatchSingleJob(
  jobId: string,
  tenantId: string,
  channel: string,
  event: string,
  recipient: string,
  body: string,
  attemptNumber: number,
  maxAttempts: number,
  metadata: Record<string, unknown> = {}
): Promise<EnqueueResult> {
  const now = new Date();

  try {
    if (channel === "META_CAPI") {
      await dispatchCapiJob(tenantId, event, recipient, body, metadata);
    } else if (channel === "WEBHOOK") {
      await dispatchWebhookJob(recipient, body, metadata);
    } else {
      // Default to SMS / WhatsApp via SMS sender
      const sender = currentSmsSender();
      await sender.send(tenantId, recipient, body);
    }

    // Update job to SENT
    await updateJobState(jobId, tenantId, {
      status: "SENT",
      attempts: attemptNumber,
      sentAt: now,
      nextRetryAt: null,
      lastError: null,
    });

    return { ok: true, jobId, status: "SENT" };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const transient = isTransientError(err);

    if (transient && attemptNumber < maxAttempts) {
      const nextRetryAt = calculateNextRetry(attemptNumber, now);
      await updateJobState(jobId, tenantId, {
        status: "PENDING",
        attempts: attemptNumber,
        nextRetryAt,
        lastError: errorMsg,
      });
      return { ok: false, jobId, status: "PENDING", error: errorMsg };
    }

    const finalStatus: NotificationStatus = transient ? "EXHAUSTED" : "FAILED";
    await updateJobState(jobId, tenantId, {
      status: finalStatus,
      attempts: attemptNumber,
      nextRetryAt: null,
      lastError: errorMsg,
    });

    return { ok: false, jobId, status: finalStatus, error: errorMsg };
  }
}

/**
 * Internal dispatcher for Meta Conversions API (CAPI) events.
 */
async function dispatchCapiJob(
  tenantId: string,
  event: string,
  _recipient: string,
  body: string,
  metadata: Record<string, unknown>
): Promise<void> {
  let parsedPayload: Record<string, unknown> = {};
  try {
    parsedPayload = JSON.parse(body);
  } catch {
    parsedPayload = { rawBody: body };
  }

  let res: SendResult;

  if (tenantId === "platform") {
    if (event === "Lead") {
      res = await trackPlatformInquiryCapi(parsedPayload as unknown as PlatformInquiryEventInput);
    } else if (event === "CompleteRegistration") {
      res = await trackPlatformRegistrationCapi(
        parsedPayload as unknown as PlatformRegistrationEventInput
      );
    } else {
      res = { ok: false, httpStatus: 400, detail: `Unsupported platform CAPI event: ${event}` };
    }
  } else {
    // Storefront merchant event
    if (event === "Lead") {
      const leadData = (parsedPayload.lead as { id: string }) || { id: String(metadata.leadId || "unknown") };
      const userContext = (parsedPayload.user as UserContext) || {};
      const options = (parsedPayload.options as { testCode?: string; consentGiven?: boolean }) || {};
      res = await trackServerLead(tenantId, leadData, userContext, options);
    } else if (event === "Schedule") {
      const bookingData = (parsedPayload.booking as { id: string; name: string; phone: string }) || {
        id: String(metadata.bookingId || "unknown"),
        name: String(parsedPayload.name || "Guest"),
        phone: String(parsedPayload.phone || ""),
      };
      const userContext = (parsedPayload.user as UserContext) || {};
      const options = (parsedPayload.options as { testCode?: string; consentGiven?: boolean }) || {};
      res = await trackServerBooking(tenantId, bookingData, userContext, options);
    } else {
      res = { ok: false, httpStatus: 400, detail: `Unsupported merchant CAPI event: ${event}` };
    }
  }

  if (res.ok) {
    return;
  }

  // Error evaluation
  const isTrans =
    res.httpStatus === 429 ||
    (res.httpStatus !== null && res.httpStatus >= 500) ||
    res.httpStatus === 408 ||
    res.detail.toLowerCase().includes("could not reach meta") ||
    res.detail.toLowerCase().includes("timeout");

  if (isTrans) {
    throw new Error(`[TRANSIENT] ${res.detail}`);
  } else {
    throw new Error(`[PERMANENT] ${res.detail}`);
  }
}

/**
 * Internal dispatcher for outbound third-party webhooks.
 */
async function dispatchWebhookJob(
  url: string,
  body: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const secret = (metadata.secret as string) || undefined;
  const res = await dispatchOutboundWebhook({
    url,
    payload: body,
    secret,
    timeoutMs: 8000,
  });

  if (res.ok) {
    return;
  }

  const isTrans =
    res.httpStatus === 429 ||
    (res.httpStatus !== null && res.httpStatus >= 500) ||
    res.httpStatus === null ||
    (res.error && res.error.toLowerCase().includes("timeout"));

  if (isTrans) {
    throw new Error(`[TRANSIENT] ${res.error || "Webhook request timed out or returned 5xx"}`);
  } else {
    throw new Error(`[PERMANENT] ${res.error || `Webhook rejected with HTTP ${res.httpStatus}`}`);
  }
}

async function updateJobState(
  jobId: string,
  tenantId: string,
  patch: {
    status: NotificationStatus;
    attempts: number;
    sentAt?: Date | null;
    nextRetryAt?: Date | null;
    lastError?: string | null;
  }
): Promise<void> {
  const mem = memoryQueue.get(jobId);
  if (mem) {
    mem.status = patch.status;
    mem.attempts = patch.attempts;
    mem.sentAt = patch.sentAt ?? mem.sentAt;
    mem.nextRetryAt = patch.nextRetryAt !== undefined ? patch.nextRetryAt : mem.nextRetryAt;
    mem.lastError = patch.lastError !== undefined ? patch.lastError : mem.lastError;
    mem.updatedAt = new Date();
    return;
  }

  const useDb = await isDbCheckAllowed();
  if (useDb && tenantId !== "platform") {
    try {
      await withTenant(tenantId, async (tx) => {
        const raw = tx as unknown as {
          notificationJob: {
            update: (args: unknown) => Promise<unknown>;
          };
        };
        await raw.notificationJob.update({
          where: { id: jobId },
          data: {
            status: patch.status,
            attempts: patch.attempts,
            sentAt: patch.sentAt,
            nextRetryAt: patch.nextRetryAt,
            lastError: patch.lastError,
          },
        });
      });
    } catch (e) {
      console.error("[queue] failed to update job state in DB", e);
    }
  }
}

/**
 * Worker sweep: fetches pending jobs that are due for retry (nextRetryAt <= now())
 * and processes them.
 */
export async function processPendingNotificationJobs(options: {
  limit?: number;
  now?: Date;
} = {}): Promise<SweepResult> {
  const limit = options.limit ?? 25;
  const now = options.now ?? new Date();

  const result: SweepResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    exhausted: 0,
  };

  const useDb = await isDbCheckAllowed();

  if (!useDb || memoryQueue.size > 0) {
    // Process in-memory queue
    const dueJobs = Array.from(memoryQueue.values())
      .filter((j) => j.status === "PENDING" && j.nextRetryAt && j.nextRetryAt <= now)
      .slice(0, limit);

    for (const job of dueJobs) {
      result.processed++;
      const res = await dispatchSingleJob(
        job.id,
        job.tenantId,
        job.channel,
        job.event,
        job.recipient,
        job.body,
        job.attempts + 1,
        job.maxAttempts,
        job.metadata
      );

      if (res.status === "SENT") result.succeeded++;
      else if (res.status === "FAILED") result.failed++;
      else if (res.status === "EXHAUSTED") result.exhausted++;
    }

    if (!useDb) return result;
  }

  // Database sweep
  try {
    const platformClient = getPlatformPrisma();
    const rawPrisma = platformClient as unknown as {
      notificationJob: {
        findMany: (args: unknown) => Promise<NotificationJobRecord[]>;
      };
    };

    const dueDbJobs = await rawPrisma.notificationJob.findMany({
      where: {
        status: "PENDING",
        nextRetryAt: { lte: now },
      },
      take: limit,
      orderBy: { nextRetryAt: "asc" },
    });

    for (const job of dueDbJobs) {
      result.processed++;
      const res = await dispatchSingleJob(
        job.id,
        job.tenantId,
        job.channel,
        job.event,
        job.recipient,
        job.body,
        job.attempts + 1,
        job.maxAttempts,
        job.metadata
      );

      if (res.status === "SENT") result.succeeded++;
      else if (res.status === "FAILED") result.failed++;
      else if (res.status === "EXHAUSTED") result.exhausted++;
    }
  } catch (e) {
    console.error("[queue] DB sweep failed", e);
  }

  return result;
}

/**
 * Returns delivery metrics for the outbox queue.
 */
export async function getOutboxStats(tenantId?: string): Promise<OutboxStats> {
  const stats: OutboxStats = {
    pending: 0,
    sent: 0,
    failed: 0,
    exhausted: 0,
    total: 0,
  };

  const useDb = await isDbCheckAllowed();

  if (!useDb || memoryQueue.size > 0) {
    const jobs = Array.from(memoryQueue.values()).filter(
      (j) => !tenantId || j.tenantId === tenantId
    );
    for (const j of jobs) {
      stats.total++;
      if (j.status === "PENDING") stats.pending++;
      else if (j.status === "SENT") stats.sent++;
      else if (j.status === "FAILED") stats.failed++;
      else if (j.status === "EXHAUSTED") stats.exhausted++;
    }
    if (!useDb) return stats;
  }

  try {
    const platformClient = getPlatformPrisma();
    const rawPrisma = platformClient as unknown as {
      notificationJob: {
        groupBy: (args: unknown) => Promise<{ status: string; _count: { id: number } }[]>;
      };
    };

    const counts = await rawPrisma.notificationJob.groupBy({
      by: ["status"],
      where: tenantId ? { tenantId } : undefined,
      _count: { id: true },
    });

    for (const row of counts) {
      const count = row._count.id;
      stats.total += count;
      if (row.status === "PENDING") stats.pending += count;
      else if (row.status === "SENT") stats.sent += count;
      else if (row.status === "FAILED") stats.failed += count;
      else if (row.status === "EXHAUSTED") stats.exhausted += count;
    }
  } catch {
    // If DB query fails, in-memory stats already populated
  }

  return stats;
}
