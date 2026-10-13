import { createHmac, timingSafeEqual } from "node:crypto";
import { AuthFailure, checkPassword, decodeClaims, setOwnPassword, verifyEmailCode } from "../auth/supabase";
import { staffEmailKnown } from "../auth/membership";
import { sendSignInCode } from "../mail/send";

/**
 * Opening a store starts with proving the email is yours (docs/45): a one-time code is sent to the address, the person types it and chooses
 * a password, and only then is a store created under that owner. The proof is a short-lived signed note that the signup then checks, so
 * nobody can open a store in someone else's name, and nothing is created for an address that was never confirmed.
 */

const TTL_MS = 60 * 60_000;
const DEV_SECRET = "dev-only-signup-verification-secret";

/** Off only outside production (the automated browser tests cannot read a mailbox). Production always verifies. */
export const verificationRequired = (env: NodeJS.ProcessEnv = process.env): boolean => env.NODE_ENV === "production" || env.SIGNUP_VERIFY !== "off";

function secret(): string {
  const s = process.env.SIGNUP_SECRET || process.env.CUSTOMER_AUTH_SECRET || process.env.IMPERSONATION_SECRET || process.env.COOKIE_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV !== "production") return DEV_SECRET;
  throw new Error("SIGNUP_SECRET (or CUSTOMER_AUTH_SECRET) must be set to at least 32 characters in production.");
}
const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

/** A note that this email was confirmed a moment ago. */
export function createEmailProof(email: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ e: email.trim().toLowerCase(), t: now })).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** True only for a genuine, unexpired proof made for exactly this email. */
export function emailProofValid(proof: string, email: string, now = Date.now()): boolean {
  if (!verificationRequired()) return true;
  try {
    const [body, sig] = proof.split(".");
    if (!body || !sig) return false;
    const want = Buffer.from(sign(body));
    const got = Buffer.from(sig);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return false;
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as { e: string; t: number };
    return p.e === email.trim().toLowerCase() && now - p.t >= 0 && now - p.t <= TTL_MS;
  } catch {
    return false;
  }
}

/** Sends the confirmation code in BizTrackBD's own email (Supabase's sender is the fallback). Says nothing about the address. */
export async function sendSignupCode(email: string, lang: "en" | "bn" | "both" = "both"): Promise<void> {
  await sendSignInCode(email, lang);
}

export interface ConfirmedEmail {
  proof: string;
  /** The address already has a BizTrackBD login, so its password is left alone and the new store joins it. */
  existing: boolean;
}

/**
 * Checks the code. A new owner also chooses their password here (the code is what proves they may); an owner who already has a login keeps
 * theirs, and the new store simply joins that account.
 */
export async function confirmSignupEmail(email: string, code: string, password: string): Promise<ConfirmedEmail> {
  const clean = email.trim().toLowerCase();
  const existing = await staffEmailKnown(clean);
  if (!existing) {
    const weak = checkPassword(password);
    if (weak) throw new AuthFailure("WEAK_PASSWORD", weak);
  }
  const tokens = await verifyEmailCode(clean, code);
  // A code proves the address; make sure the token really is for it.
  const claimed = decodeClaims(tokens.accessToken).email;
  if (claimed && claimed.toLowerCase() !== clean) throw new AuthFailure("INVALID_CODE", "That code is not right, or it has expired. Ask for a new one.");
  if (!existing) await setOwnPassword(tokens.accessToken, password);
  return { proof: createEmailProof(clean), existing };
}
