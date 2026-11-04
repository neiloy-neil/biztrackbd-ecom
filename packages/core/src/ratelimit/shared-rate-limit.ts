import { createHmac } from "node:crypto";
import { getBasePrisma } from "@biztrackbd/db";

/** The slice of a Prisma client the limiter needs. Tests pass their own. */
export interface RateLimitDb {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}

export interface RateLimitOptions {
  /** Names the limit, e.g. "contact" or "track". Different scopes never share a counter. */
  scope: string;
  /** Who is being limited: an IP address or a user id. Hashed with a salt before it touches the database. */
  subject: string;
  limit: number;
  windowMs: number;
  now?: number;
  db?: RateLimitDb;
}

export interface RateLimitDecision {
  allowed: boolean;
  count: number;
  /** True when the database could not be reached and the decision came from this instance's own memory. */
  degraded: boolean;
}

function salt(): string {
  return process.env.RATE_LIMIT_SALT || process.env.PHONE_TRUST_SALT || process.env.CUSTOMER_AUTH_SECRET || "biztrack-rate-limit-salt-2026";
}

/** Salted one-way key. The raw subject (an IP address) is never stored or logged. */
export function rateLimitKey(scope: string, subject: string): string {
  return createHmac("sha256", salt()).update(`${scope}\n${subject}`).digest("hex");
}

// Used only while the database is unreachable, so the limit still holds loosely per instance.
const fallback = new Map<string, { windowStart: number; count: number }>();
function fallbackConsume(key: string, windowStart: number): number {
  const cur = fallback.get(key);
  if (!cur || cur.windowStart !== windowStart) {
    if (fallback.size > 5000) fallback.clear();
    fallback.set(key, { windowStart, count: 1 });
    return 1;
  }
  cur.count += 1;
  return cur.count;
}

const CLEANUP_ODDS = 0.01;
const KEEP_EXPIRED_MS = 60 * 60 * 1000;

/**
 * Counts one hit against a fixed window shared by every serverless instance (an atomic upsert-increment in Postgres) and says
 * whether it is still within the limit. A fixed window can let through up to twice the limit across a window boundary; that is
 * acceptable for abuse limits. If the database cannot be reached it fails OPEN (the request is allowed) and logs, falling back
 * to a per-instance count so a stuck database does not turn the endpoint into an open tap.
 */
export async function consumeRateLimit(opts: RateLimitOptions): Promise<RateLimitDecision> {
  const now = opts.now ?? Date.now();
  const windowStart = Math.floor(now / opts.windowMs) * opts.windowMs;
  const key = rateLimitKey(opts.scope, opts.subject);
  try {
    const db = opts.db ?? (getBasePrisma() as unknown as RateLimitDb);
    const start = new Date(windowStart);
    const expires = new Date(windowStart + opts.windowMs);
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimitBucket" ("key", "windowStart", "count", "expiresAt")
      VALUES (${key}, ${start}, 1, ${expires})
      ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
      RETURNING "count"`;
    const count = Number(rows[0]?.count ?? 1);
    if (Math.random() < CLEANUP_ODDS) void purgeExpiredRateLimits({ db, now }).catch(() => undefined);
    return { allowed: count <= opts.limit, count, degraded: false };
  } catch (e) {
    console.error(`[rate-limit] database unavailable for scope "${opts.scope}", failing open:`, e instanceof Error ? e.message : e);
    const count = fallbackConsume(key, windowStart);
    // Fail open: only the per-instance count can refuse, and only at four times the limit so a flaky database never blocks real visitors.
    return { allowed: count <= opts.limit * 4, count, degraded: true };
  }
}

/** Deletes counters whose window ended more than an hour ago. Safe to run at any time. Returns the number of rows removed. */
export async function purgeExpiredRateLimits(opts: { db?: RateLimitDb; now?: number } = {}): Promise<number> {
  const db = opts.db ?? (getBasePrisma() as unknown as RateLimitDb);
  const cutoff = new Date((opts.now ?? Date.now()) - KEEP_EXPIRED_MS);
  return db.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "expiresAt" < ${cutoff}`;
}

/** Best-effort client address from proxy headers; "unknown" when there is none. */
export function clientIpFromHeaders(h: { get(name: string): string | null }): string {
  return h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
