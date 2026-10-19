import crypto from "crypto";
import type { ApiKeyEnvironment } from "./types";

export interface GeneratedKeyPayload {
  token: string; // Full plaintext secret, e.g. bzk_live_9f8a...
  keyPrefix: string; // Masked prefix for storage and UI, e.g. bzk_live_9f8a...ef12
  hashedToken: string; // Irreversible SHA-256 hash for DB unique lookup
  environment: ApiKeyEnvironment;
}

/**
 * Generates a cryptographically secure, high-entropy API key.
 * Formats:
 * - Live: bzk_live_<64-character hex>
 * - Test: bzk_test_<64-character hex>
 */
export function generateApiKey(environment: ApiKeyEnvironment = "LIVE"): GeneratedKeyPayload {
  const prefix = environment === "TEST" ? "bzk_test_" : "bzk_live_";
  const randomBytes = crypto.randomBytes(32).toString("hex"); // 64 chars hex
  const token = `${prefix}${randomBytes}`;

  // Key prefix visible to users in tables (e.g., "bzk_live_9f8a...ef12")
  const keyPrefix = `${prefix}${randomBytes.slice(0, 4)}...${randomBytes.slice(-4)}`;

  // Irreversible SHA-256 hash stored in PostgreSQL
  const hashedToken = hashApiKey(token);

  return {
    token,
    keyPrefix,
    hashedToken,
    environment,
  };
}

/**
 * Computes the SHA-256 digest of a plaintext API key.
 */
export function hashApiKey(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Validates the basic structural format of a BizTrack API key.
 */
export function isValidTokenFormat(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  return /^bzk_(live|test)_[a-f0-9]{64}$/i.test(token.trim());
}

/**
 * Returns a masked version of an authorization header or token for secure logging.
 */
export function maskToken(token: string): string {
  if (!token) return "[REDACTED]";
  const trimmed = token.trim();
  if (trimmed.startsWith("bzk_live_")) {
    return `bzk_live_${trimmed.slice(9, 13)}...${trimmed.slice(-4)}`;
  }
  if (trimmed.startsWith("bzk_test_")) {
    return `bzk_test_${trimmed.slice(9, 13)}...${trimmed.slice(-4)}`;
  }
  return "[REDACTED_BEARER]";
}
