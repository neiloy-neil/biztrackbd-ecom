import type { RateLimitResult } from "./types";

interface WindowRecord {
  count: number;
  windowStart: number;
}

const DEFAULT_LIMIT = 120; // 120 requests per minute
const WINDOW_MS = 60 * 1000; // 1 minute in milliseconds

// In-memory sliding window store keyed by tenantId or apiKeyId
const windows = new Map<string, WindowRecord>();

/**
 * Evaluates rate limiting for an incoming API request using an in-memory sliding window counter.
 * Standard limit is 120 requests per minute per tenant.
 */
export function checkRateLimit(
  key: string,
  limit: number = DEFAULT_LIMIT,
  windowMs: number = WINDOW_MS
): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    // New window
    windows.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      reset: Math.ceil((now + windowMs) / 1000),
    };
  }

  // Inside existing window
  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  const reset = Math.ceil((existing.windowStart + windowMs) / 1000);

  if (existing.count > limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      reset,
    };
  }

  return {
    allowed: true,
    limit,
    remaining,
    reset,
  };
}

/**
 * Returns standard rate limiting HTTP headers.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
  };
}

/**
 * Resets the in-memory rate limiter cache (useful for test isolation).
 */
export function resetRateLimiter(): void {
  windows.clear();
}
