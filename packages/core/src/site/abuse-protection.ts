import { z } from "zod";
import { PublicSubmissionRateLimitError } from "../errors";
import { normalizeBdPhone } from "../phone";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour sliding window
export const MAX_SUBMISSIONS_PER_IP_PER_HOUR = 5;
export const MAX_SUBMISSIONS_PER_PHONE_PER_HOUR = 3;
export const IDEMPOTENCY_TTL_MS = 60 * 1000; // 60 seconds

// In-memory sliding window trackers: key -> array of submission timestamps
const ipSubmissionTimestamps = new Map<string, number[]>();
const phoneSubmissionTimestamps = new Map<string, number[]>();

// Idempotency cache: `${tenantId}:${idempotencyKey}` -> { result: any, expiresAt: number }
const idempotencyCache = new Map<string, { result: any; expiresAt: number }>();

/** Strict metadata allow-list to prevent payload pollution and arbitrary JSON injection */
export const LeadMetadataAllowListSchema = z
  .object({
    serviceId: z.string().max(80).optional(),
    serviceTitle: z.string().max(120).optional(),
    providerName: z.string().max(100).optional(),
    preferredTime: z.string().max(60).optional(),
    companySize: z.string().max(40).optional(),
    budgetRangeBdt: z.string().max(40).optional(),
    dietaryRequirements: z.string().max(120).optional(),
    partySize: z.number().int().min(1).max(100).optional(),
    requestedDate: z.string().max(60).optional(),
    requestedTime: z.string().max(60).optional(),
    notes: z.string().max(500).optional(),
    consentTextVersion: z.string().max(40).optional(),
  })
  .strict();

export type ValidatedLeadMetadata = z.infer<typeof LeadMetadataAllowListSchema>;

/**
 * Validates untrusted metadata payload against the strict allow-list schema.
 * Returns only allowed fields or null if empty/invalid.
 */
export function validateLeadMetadata(metadata: unknown): ValidatedLeadMetadata | null {
  if (!metadata || typeof metadata !== "object") return null;
  const result = LeadMetadataAllowListSchema.safeParse(metadata);
  if (!result.success) {
    // If strict parsing fails because of extraneous fields, sanitize and keep only valid keys
    const raw = metadata as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    const allowedKeys = [
      "serviceId",
      "serviceTitle",
      "providerName",
      "preferredTime",
      "companySize",
      "budgetRangeBdt",
      "dietaryRequirements",
      "partySize",
      "requestedDate",
      "requestedTime",
      "notes",
      "consentTextVersion",
    ];
    for (const key of allowedKeys) {
      if (raw[key] !== undefined) {
        sanitized[key] = raw[key];
      }
    }
    const cleanResult = LeadMetadataAllowListSchema.safeParse(sanitized);
    return cleanResult.success ? cleanResult.data : null;
  }
  return result.data;
}

/**
 * Evaluates sliding window rate limits for public visitor submissions.
 * Enforces:
 * - Max 5 submissions per hour per IP
 * - Max 3 submissions per hour per normalized phone number
 */
export function checkPublicSubmissionRateLimit(params: {
  tenantId: string;
  ip?: string | null;
  phone?: string | null;
  now?: number;
}): void {
  const now = params.now ?? Date.now();
  const windowStart = now - WINDOW_MS;

  // 1. Check IP rate limit
  if (params.ip) {
    const cleanIp = params.ip.trim();
    if (cleanIp && cleanIp !== "127.0.0.1") {
      const key = `${params.tenantId}:ip:${cleanIp}`;
      const timestamps = (ipSubmissionTimestamps.get(key) || []).filter((t) => t > windowStart);

      if (timestamps.length >= MAX_SUBMISSIONS_PER_IP_PER_HOUR) {
        const oldest = timestamps[0] ?? windowStart;
        const retryAfter = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
        throw new PublicSubmissionRateLimitError(
          retryAfter,
          "Too many inquiries from your internet connection. Please wait before submitting again."
        );
      }
    }
  }

  // 2. Check Phone rate limit
  if (params.phone) {
    let normalizedPhone: string | null = null;
    try {
      normalizedPhone = normalizeBdPhone(params.phone);
    } catch {
      // If phone normalization fails, standard validator will handle it
    }

    if (normalizedPhone) {
      const key = `${params.tenantId}:ph:${normalizedPhone}`;
      const timestamps = (phoneSubmissionTimestamps.get(key) || []).filter((t) => t > windowStart);

      if (timestamps.length >= MAX_SUBMISSIONS_PER_PHONE_PER_HOUR) {
        const oldest = timestamps[0] ?? windowStart;
        const retryAfter = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
        throw new PublicSubmissionRateLimitError(
          retryAfter,
          "Too many inquiries from this mobile number today. Please call or contact via WhatsApp."
        );
      }
    }
  }
}

/**
 * Records a successful submission to advance the rate limit window.
 */
export function recordPublicSubmission(params: {
  tenantId: string;
  ip?: string | null;
  phone?: string | null;
  now?: number;
}): void {
  const now = params.now ?? Date.now();
  const windowStart = now - WINDOW_MS;

  if (params.ip) {
    const cleanIp = params.ip.trim();
    if (cleanIp && cleanIp !== "127.0.0.1") {
      const key = `${params.tenantId}:ip:${cleanIp}`;
      const timestamps = (ipSubmissionTimestamps.get(key) || []).filter((t) => t > windowStart);
      timestamps.push(now);
      ipSubmissionTimestamps.set(key, timestamps);
    }
  }

  if (params.phone) {
    let normalizedPhone: string | null = null;
    try {
      normalizedPhone = normalizeBdPhone(params.phone);
    } catch {
      // ignored
    }
    if (normalizedPhone) {
      const key = `${params.tenantId}:ph:${normalizedPhone}`;
      const timestamps = (phoneSubmissionTimestamps.get(key) || []).filter((t) => t > windowStart);
      timestamps.push(now);
      phoneSubmissionTimestamps.set(key, timestamps);
    }
  }
}

/**
 * Retrieves cached result for an Idempotency-Key if within the 60s TTL.
 */
export function getCachedIdempotentResult<T>(
  tenantId: string,
  idempotencyKey?: string | null
): T | null {
  if (!idempotencyKey || typeof idempotencyKey !== "string") return null;
  const key = `${tenantId}:${idempotencyKey.trim()}`;
  const cached = idempotencyCache.get(key);
  if (!cached) return null;

  if (Date.now() > cached.expiresAt) {
    idempotencyCache.delete(key);
    return null;
  }
  return cached.result as T;
}

/**
 * Sets cached result for an Idempotency-Key with 60s TTL.
 */
export function setCachedIdempotentResult<T>(
  tenantId: string,
  idempotencyKey: string | null | undefined,
  result: T
): void {
  if (!idempotencyKey || typeof idempotencyKey !== "string") return;
  const key = `${tenantId}:${idempotencyKey.trim()}`;
  idempotencyCache.set(key, {
    result,
    expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
  });

  // Cleanup expired items if cache grows large
  if (idempotencyCache.size > 2000) {
    const now = Date.now();
    for (const [k, v] of idempotencyCache.entries()) {
      if (now > v.expiresAt) idempotencyCache.delete(k);
    }
  }
}

/**
 * Resets state for unit testing.
 */
export function _clearAbuseProtectionState(): void {
  ipSubmissionTimestamps.clear();
  phoneSubmissionTimestamps.clear();
  idempotencyCache.clear();
}
