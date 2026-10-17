import crypto from "node:crypto";
import { getBasePrisma, Prisma } from "@biztrackbd/db";

export interface QuotaCheckResult {
  allowed: boolean;
  rateLimited: boolean;
  remainingChecks: number;
  deviceCount: number;
  ipCount: number;
  reason?: "DEVICE_QUOTA_EXHAUSTED" | "IP_CEILING_EXCEEDED" | "BURST_EXCEEDED";
}

export interface QuotaIncrementResult {
  success: boolean;
  remainingChecks: number;
  deviceCount: number;
  ipCount: number;
}

export const MAX_DEVICE_DAILY_CHECKS = 5;
export const MAX_IP_DAILY_CHECKS = 25;
export const BURST_WINDOW_MS = 60_000; // 1 minute
export const MAX_BURST_CHECKS_PER_MIN = 10;
export const PUBLIC_TOOL_COURIER_FRAUD = "COURIER_FRAUD_CHECKER";

// In-memory fallback and burst storage
const inMemoryQuotaMap = new Map<string, number>();
const burstHistoryMap = new Map<string, number[]>();
let dbTableAvailable: boolean | null = null;
let lastDbCheckTime = 0;
const DB_RETRY_INTERVAL_MS = 60_000;

function isDbCheckAllowed(): boolean {
  if (dbTableAvailable === null) return true;
  if (dbTableAvailable === true) return true;
  // If previously unavailable, retry only after 60s
  return Date.now() - lastDbCheckTime > DB_RETRY_INTERVAL_MS;
}

function markDbUnavailable(): void {
  dbTableAvailable = false;
  lastDbCheckTime = Date.now();
}

function markDbAvailable(): void {
  dbTableAvailable = true;
}

function getSecret(explicitSecret?: string): string {
  return (
    explicitSecret ||
    process.env.CUSTOMER_AUTH_SECRET ||
    process.env.INTEGRATION_VAULT_SECRET ||
    "biztrack-fraud-device-secret-fallback-key-32-chars-min"
  );
}

/**
 * Creates an HMAC-SHA256 signature for a device ID to prevent client-side cookie forgery.
 */
export function signDeviceToken(deviceId: string, secret?: string): string {
  const hmac = crypto.createHmac("sha256", getSecret(secret));
  hmac.update(deviceId);
  const sig = hmac.digest("hex").slice(0, 32);
  return `${deviceId}.${sig}`;
}

/**
 * Verifies that a device token has not been tampered with.
 * If valid, returns the verified device ID.
 * If missing, invalid, or forged, generates and returns a fresh signed device token.
 */
export function verifyDeviceToken(
  tokenString?: string | null,
  secret?: string
): { valid: boolean; deviceId: string; signedToken: string } {
  if (tokenString && typeof tokenString === "string") {
    const parts = tokenString.split(".");
    if (parts.length === 2 && parts[0] && parts[1]) {
      const [deviceId, sig] = parts;
      const expectedSig = crypto
        .createHmac("sha256", getSecret(secret))
        .update(deviceId)
        .digest("hex")
        .slice(0, 32);

      const bufA = Buffer.from(sig);
      const bufB = Buffer.from(expectedSig);
      if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
        return { valid: true, deviceId, signedToken: tokenString };
      }
    }
  }

  // Token missing or invalid/tampered: generate fresh device identity
  const newDeviceId = crypto.randomUUID();
  const signedToken = signDeviceToken(newDeviceId, secret);
  return { valid: false, deviceId: newDeviceId, signedToken };
}

/**
 * Extracts client IP from HTTP headers with reverse-proxy precedence.
 */
export function resolveClientIp(
  headersLike?: { get?: (name: string) => string | null } | Record<string, string | string[] | undefined> | null
): string {
  if (!headersLike) return "127.0.0.1";

  const getHeader = (name: string): string | null => {
    if ("get" in headersLike && typeof headersLike.get === "function") {
      return headersLike.get(name);
    }
    const val = (headersLike as Record<string, string | string[] | undefined>)[name.toLowerCase()];
    if (Array.isArray(val)) return val[0] || null;
    return typeof val === "string" ? val : null;
  };

  const cfIp = getHeader("cf-connecting-ip");
  if (cfIp?.trim()) return cfIp.trim();

  const realIp = getHeader("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  const forwardedFor = getHeader("x-forwarded-for");
  if (forwardedFor?.trim()) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  return "127.0.0.1";
}

/**
 * Anonymizes client IP with a cryptographic salt (preserves user privacy, compliant with PRIV-001).
 */
export function hashClientIp(ip: string, salt?: string): string {
  const effectiveSalt = salt || process.env.PHONE_TRUST_SALT || "biztrack_ip_salt_default_2026";
  return crypto
    .createHash("sha256")
    .update(`${ip}:${effectiveSalt}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Returns current date bucket formatted as YYYY-MM-DD in Asia/Dhaka (+06:00).
 * Free checks reset automatically at Bangladesh midnight.
 */
export function getDhakaDayBucket(dateInput?: Date | number): string {
  const d =
    typeof dateInput === "number"
      ? new Date(dateInput)
      : dateInput instanceof Date
      ? dateInput
      : new Date();
  const dhakaTime = new Date(d.getTime() + 6 * 3600_000);
  return dhakaTime.toISOString().slice(0, 10);
}

/**
 * Clears in-memory test states. Used by test suites.
 */
export function clearPublicQuotaMemoryCache(): void {
  inMemoryQuotaMap.clear();
  burstHistoryMap.clear();
}

/**
 * Checks if the caller has remaining quota for the specified tool.
 */
export async function checkPublicToolQuota(options: {
  deviceId: string;
  ipHash: string;
  tool?: string;
  dayBucket?: string;
  now?: number;
}): Promise<QuotaCheckResult> {
  const tool = options.tool || PUBLIC_TOOL_COURIER_FRAUD;
  const day = options.dayBucket || getDhakaDayBucket(options.now);
  const now = options.now || Date.now();

  // 1. Burst rate check per IP hash
  const ipBurstKey = `${tool}:burst:${options.ipHash}`;
  const recentCalls = (burstHistoryMap.get(ipBurstKey) || []).filter(
    (ts) => now - ts < BURST_WINDOW_MS
  );
  if (recentCalls.length >= MAX_BURST_CHECKS_PER_MIN) {
    return {
      allowed: false,
      rateLimited: true,
      remainingChecks: 0,
      deviceCount: MAX_DEVICE_DAILY_CHECKS,
      ipCount: MAX_IP_DAILY_CHECKS,
      reason: "BURST_EXCEEDED",
    };
  }

  const deviceBucket = `device:${options.deviceId}:${day}`;
  const ipBucket = `ip:${options.ipHash}:${day}`;

  let deviceCount = 0;
  let ipCount = 0;

  // 2. Fetch counts from database if available
  if (isDbCheckAllowed()) {
    try {
      const prisma = getBasePrisma();
      if (prisma && prisma.publicToolUsage) {
        const rows = await prisma.publicToolUsage.findMany({
          where: {
            tool,
            bucket: { in: [deviceBucket, ipBucket] },
          },
        });
        markDbAvailable();
        for (const row of rows) {
          if (row.bucket === deviceBucket) deviceCount = row.count;
          if (row.bucket === ipBucket) ipCount = row.count;
        }
      }
    } catch {
      markDbUnavailable();
      deviceCount = inMemoryQuotaMap.get(`${tool}:${deviceBucket}`) || 0;
      ipCount = inMemoryQuotaMap.get(`${tool}:${ipBucket}`) || 0;
    }
  } else {
    deviceCount = inMemoryQuotaMap.get(`${tool}:${deviceBucket}`) || 0;
    ipCount = inMemoryQuotaMap.get(`${tool}:${ipBucket}`) || 0;
  }

  // Cross-reference with in-memory store in case local process has a higher recent count
  const memDev = inMemoryQuotaMap.get(`${tool}:${deviceBucket}`) || 0;
  const memIp = inMemoryQuotaMap.get(`${tool}:${ipBucket}`) || 0;
  if (memDev > deviceCount) deviceCount = memDev;
  if (memIp > ipCount) ipCount = memIp;

  if (deviceCount >= MAX_DEVICE_DAILY_CHECKS) {
    return {
      allowed: false,
      rateLimited: true,
      remainingChecks: 0,
      deviceCount,
      ipCount,
      reason: "DEVICE_QUOTA_EXHAUSTED",
    };
  }

  if (ipCount >= MAX_IP_DAILY_CHECKS) {
    return {
      allowed: false,
      rateLimited: true,
      remainingChecks: 0,
      deviceCount,
      ipCount,
      reason: "IP_CEILING_EXCEEDED",
    };
  }

  const remainingChecks = Math.max(0, MAX_DEVICE_DAILY_CHECKS - deviceCount);

  return {
    allowed: true,
    rateLimited: false,
    remainingChecks,
    deviceCount,
    ipCount,
  };
}

/**
 * Atomically increments both device and IP quota buckets upon a successful tool execution.
 * Only called when external/upstream service responds successfully (conforming to RISK-001).
 */
export async function incrementPublicToolQuota(options: {
  deviceId: string;
  ipHash: string;
  tool?: string;
  dayBucket?: string;
  now?: number;
}): Promise<QuotaIncrementResult> {
  const tool = options.tool || PUBLIC_TOOL_COURIER_FRAUD;
  const day = options.dayBucket || getDhakaDayBucket(options.now);
  const now = options.now || Date.now();

  const deviceBucket = `device:${options.deviceId}:${day}`;
  const ipBucket = `ip:${options.ipHash}:${day}`;

  // Record burst timestamp
  const ipBurstKey = `${tool}:burst:${options.ipHash}`;
  const recentCalls = (burstHistoryMap.get(ipBurstKey) || []).filter(
    (ts) => now - ts < BURST_WINDOW_MS
  );
  recentCalls.push(now);
  burstHistoryMap.set(ipBurstKey, recentCalls);

  // Update in-memory values first for low-latency thread safety
  const newDevCount = (inMemoryQuotaMap.get(`${tool}:${deviceBucket}`) || 0) + 1;
  const newIpCount = (inMemoryQuotaMap.get(`${tool}:${ipBucket}`) || 0) + 1;
  inMemoryQuotaMap.set(`${tool}:${deviceBucket}`, newDevCount);
  inMemoryQuotaMap.set(`${tool}:${ipBucket}`, newIpCount);

  // Atomically upsert in PostgreSQL if available
  if (isDbCheckAllowed()) {
    try {
      const prisma = getBasePrisma();
      if (prisma && prisma.publicToolUsage) {
        await Promise.all([
          prisma.publicToolUsage.upsert({
            where: { tool_bucket: { tool, bucket: deviceBucket } },
            create: { tool, bucket: deviceBucket, count: 1 },
            update: { count: { increment: 1 }, lastUsedAt: new Date() },
          }),
          prisma.publicToolUsage.upsert({
            where: { tool_bucket: { tool, bucket: ipBucket } },
            create: { tool, bucket: ipBucket, count: 1 },
            update: { count: { increment: 1 }, lastUsedAt: new Date() },
          }),
        ]);
        markDbAvailable();
      }
    } catch {
      markDbUnavailable();
    }
  }

  const remainingChecks = Math.max(0, MAX_DEVICE_DAILY_CHECKS - newDevCount);

  return {
    success: true,
    remainingChecks,
    deviceCount: newDevCount,
    ipCount: newIpCount,
  };
}
