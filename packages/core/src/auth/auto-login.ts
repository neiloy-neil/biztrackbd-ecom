import { createHmac, timingSafeEqual } from "node:crypto";

export interface AutoLoginPayload {
  tenantId: string;
  userId: string;
  email: string;
  exp: number; // Expiration timestamp (ms)
}

const AUTO_LOGIN_TTL_MS = 15 * 60_000; // 15 minutes
const DEV_SECRET = "biztrackbd-auto-login-dev-secret-key-32chars";

function secret(): string {
  const s = process.env.CUSTOMER_AUTH_SECRET || process.env.SIGNUP_SECRET || process.env.INTEGRATION_VAULT_SECRET;
  if (s && s.length >= 32) return s;
  return DEV_SECRET;
}

/**
 * Creates a cryptographically signed single-use token to allow newly signed-up
 * store owners to seamlessly auto-login into the admin dashboard on their first visit.
 */
export function createAutoLoginToken(data: { tenantId: string; userId: string; email: string }): string {
  const payload: AutoLoginPayload = {
    tenantId: data.tenantId,
    userId: data.userId,
    email: data.email.trim().toLowerCase(),
    exp: Date.now() + AUTO_LOGIN_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/**
 * Verifies the auto-login token signature and checks that it has not expired.
 * Returns the payload if valid, or null if tampered or expired.
 */
export function verifyAutoLoginToken(token: string): AutoLoginPayload | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const want = Buffer.from(createHmac("sha256", secret()).update(body).digest("base64url"));
    const got = Buffer.from(sig);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AutoLoginPayload;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

const SESSION_COOKIE_TTL_MS = 14 * 24 * 60 * 60_000; // 14 days (matching trial length)

export const AUTO_LOGIN_COOKIE = "store_owner_session";

/**
 * Creates a signed session cookie value for the newly created store owner,
 * valid for 14 days so they stay logged in without needing to enter credentials again.
 */
export function createAutoLoginSessionCookie(data: { tenantId: string; userId: string; email: string }): string {
  const payload: AutoLoginPayload = {
    tenantId: data.tenantId,
    userId: data.userId,
    email: data.email.trim().toLowerCase(),
    exp: Date.now() + SESSION_COOKIE_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/**
 * Verifies the auto-login session cookie.
 */
export function verifyAutoLoginSessionCookie(cookieValue: string): AutoLoginPayload | null {
  try {
    const [body, sig] = cookieValue.split(".");
    if (!body || !sig) return null;
    const want = Buffer.from(createHmac("sha256", secret()).update(body).digest("base64url"));
    const got = Buffer.from(sig);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AutoLoginPayload;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

