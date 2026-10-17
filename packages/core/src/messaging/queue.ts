import { withTenant, getBasePrisma, getPlatformPrisma } from "@biztrackbd/db";
import { CourierError } from "../errors";
import { currentSmsSender } from "../customers/auth";

export type NotificationStatus = "PENDING" | "SENT" | "FAILED" | "EXHAUSTED";
export type NotificationChannel = "SMS" | "WHATSAPP" | "EMAIL";

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

/**
 * In-memory fallback queue for offline environments and automated test isolation.
 */
interface InMemoryJob extends NotificationJobRecord {}
const memoryQueue = new Map<string, InMemoryJob>();
let dbTableAvailable: boolean | null = null;

export function __resetMemoryNotificationQueue(): void {
  memoryQueue.clear();
  dbTableAvailable = null;
}

export function __getMemoryNotificationJobs(): InMemoryJob[] {
  return Array.from(memoryQueue.values());
}

/**
 * Checks whether an error from the SMS provider is transient (retryable)
 * or permanent (fail fast without useless retries).
 */
export function isTransientError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  if (error instanceof CourierError && error.ambiguous) return true;

  const lower = msg.toLowerCase();

  // Permanent failure indicators: invalid destination or account exhaustion
  const permanentKeywords = [
    "not enough balance",
    "invalid phone",
    "no valid phone",
    "blocked content",
    "invalid sender id",
    "message that is too long",
    "no permission for this account",
    "account has expired",
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

  // Known transient indicators: network drops, timeouts, 5xx, or provider internal 409
  const transientKeywords = [
    "timeout",
    "could not be reached",
    "econnrefused",
    "econnreset",
    "etimedout",
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

  if (useDb) {
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
  return await dispatchSingleJob(jobId, input.tenantId, input.recipient, input.body, 1, maxAttempts);
}

/**
 * Dispatches a single job, updating status according to outcome and error classification.
 */
async function dispatchSingleJob(
  jobId: string,
  tenantId: string,
  recipient: string,
  body: string,
  attemptNumber: number,
  maxAttempts: number
): Promise<EnqueueResult> {
  const sender = currentSmsSender();
  const now = new Date();

  try {
    await sender.send(tenantId, recipient, body);

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
  if (useDb) {
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
 * and processes them concurrently.
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
        job.recipient,
        job.body,
        job.attempts + 1,
        job.maxAttempts
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
        job.recipient,
        job.body,
        job.attempts + 1,
        job.maxAttempts
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
