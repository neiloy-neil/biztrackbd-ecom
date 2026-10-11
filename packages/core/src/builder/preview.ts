import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The editor shows the storefront in an iframe. The storefront is a different origin, so it cannot see the admin's login;
 * it trusts a short-lived signed token instead. The token says "this store's draft of this page may be shown until <time>".
 * It only unlocks a read-only preview of unpublished design, never orders, customers or anything else.
 */

const TTL_MS = 2 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.PREVIEW_SECRET ?? process.env.CRON_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("PREVIEW_SECRET is not set");
  return "dev-preview-secret";
}

const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export function createPreviewToken(tenantId: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ t: tenantId, e: now + TTL_MS })).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Returns the store id the token was issued for, or null when it is forged, malformed or expired. */
export function verifyPreviewToken(token: string | undefined | null, now = Date.now()): string | null {
  if (!token || token.length > 400) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as { t?: unknown; e?: unknown };
    if (typeof p.t !== "string" || typeof p.e !== "number" || p.e < now) return null;
    return p.t;
  } catch {
    return null;
  }
}
