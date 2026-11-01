import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_SECRET = (): string => {
  const s = process.env.CUSTOMER_AUTH_SECRET || process.env.SIGNUP_SECRET || process.env.COOKIE_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV !== "production") return "dev-digital-download-secret-key-32chars";
  throw new Error("CUSTOMER_AUTH_SECRET or SIGNUP_SECRET must be set to at least 32 characters in production.");
};

const sign = (data: string) => createHmac("sha256", TOKEN_SECRET()).update(data).digest("base64url");

export interface DownloadTokenPayload {
  orderId: string;
  itemId: string;
  tenantId: string;
  exp: number; // epoch ms
}

/**
 * Creates a signed, tamper-proof download token valid for 30 days.
 */
export function createOrderDownloadToken(tenantId: string, orderId: string, itemId: string, expiresInDays = 30): string {
  const exp = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
  const payload: DownloadTokenPayload = { tenantId, orderId, itemId, exp };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(body);
  return `${body}.${sig}`;
}

/**
 * Verifies the download token and returns the parsed payload if valid.
 */
export function verifyOrderDownloadToken(token: string): DownloadTokenPayload | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;

    const wantSig = sign(body);
    const wantBuf = Buffer.from(wantSig);
    const gotBuf = Buffer.from(sig);
    if (wantBuf.length !== gotBuf.length || !timingSafeEqual(wantBuf, gotBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as DownloadTokenPayload;
    if (Date.now() > payload.exp) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}
