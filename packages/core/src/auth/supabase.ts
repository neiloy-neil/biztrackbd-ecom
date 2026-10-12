import { createHash } from "node:crypto";

/**
 * Sign-in through Supabase Auth (GoTrue), over its HTTP API. Nothing here stores a password: the browser sends the password
 * to our server action once, we exchange it for tokens, and from then on only the tokens exist (in httpOnly cookies).
 *
 * Why every request asks Supabase "is this token still good?" (cached for 30 seconds) instead of checking the signature itself:
 * the project's JWT secret is not ours to hold, and asking means a revoked session or a deleted user stops working within
 * half a minute, which a signature check alone cannot do.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceKey: string | null;
}

export function supabaseConfig(env: NodeJS.ProcessEnv = process.env): SupabaseConfig | null {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/+$/, ""), anonKey, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY ?? null };
}

export type AuthFailureCode = "INVALID_CREDENTIALS" | "EMAIL_NOT_CONFIRMED" | "RATE_LIMITED" | "INVALID_CODE" | "EXPIRED" | "EXISTS" | "WEAK_PASSWORD" | "UNAVAILABLE" | "NOT_CONFIGURED";

export class AuthFailure extends Error {
  constructor(readonly code: AuthFailureCode, message: string) {
    super(message);
    this.name = "AuthFailure";
  }
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
  userId: string;
  email: string;
  aal: "aal1" | "aal2";
}

export interface AuthUser {
  id: string;
  email: string;
  emailConfirmed: boolean;
  factors: { id: string; type: string; status: string }[];
}

type Fetch = typeof fetch;
let fetchImpl: Fetch | null = null;
/** Tests swap the network for a fake. */
export function setAuthFetch(f: Fetch | null): void {
  fetchImpl = f;
  userCache.clear();
}
const doFetch: Fetch = (input, init) => (fetchImpl ?? fetch)(input, init);

function cfg(): SupabaseConfig {
  const c = supabaseConfig();
  if (!c) throw new AuthFailure("NOT_CONFIGURED", "Sign-in is not set up on this server");
  return c;
}

async function call(path: string, o: { method?: string; body?: unknown; bearer?: string; key?: "anon" | "service" } = {}): Promise<{ status: number; json: Record<string, unknown> }> {
  const c = cfg();
  const key = o.key === "service" ? c.serviceKey : c.anonKey;
  if (!key) throw new AuthFailure("NOT_CONFIGURED", "Sign-in is not set up on this server");
  try {
    const res = await doFetch(`${c.url}${path}`, {
      method: o.method ?? (o.body ? "POST" : "GET"),
      headers: { apikey: key, authorization: `Bearer ${o.bearer ?? key}`, "content-type": "application/json" },
      body: o.body ? JSON.stringify(o.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, json };
  } catch (e) {
    if (e instanceof AuthFailure) throw e;
    throw new AuthFailure("UNAVAILABLE", "Sign-in is not available right now. Please try again in a minute.");
  }
}

const codeOf = (j: Record<string, unknown>) => String(j.error_code ?? j.code ?? j.error ?? "");
const msgOf = (j: Record<string, unknown>) => String(j.msg ?? j.message ?? j.error_description ?? "");

export function decodeClaims(token: string): { exp: number; aal: "aal1" | "aal2"; sub: string; email?: string } {
  try {
    const p = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
    return { exp: Number(p.exp ?? 0), aal: p.aal === "aal2" ? "aal2" : "aal1", sub: String(p.sub ?? ""), email: typeof p.email === "string" ? p.email : undefined };
  } catch {
    return { exp: 0, aal: "aal1", sub: "" };
  }
}

function tokensFrom(j: Record<string, unknown>): TokenSet {
  const access = String(j.access_token ?? "");
  const user = (j.user ?? {}) as Record<string, unknown>;
  const claims = decodeClaims(access);
  return {
    accessToken: access, refreshToken: String(j.refresh_token ?? ""), expiresAt: Number(j.expires_at ?? claims.exp), userId: String(user.id ?? claims.sub),
    email: String(user.email ?? claims.email ?? "").toLowerCase(), aal: claims.aal,
  };
}

// ---- Sign in ---------------------------------------------------------------------------------------------------------

/** Wrong password and unknown email give the same answer, so the form cannot be used to find out who has an account. */
export async function signInWithPassword(email: string, password: string): Promise<TokenSet> {
  const r = await call("/auth/v1/token?grant_type=password", { body: { email: email.trim().toLowerCase(), password } });
  if (r.status === 200 && r.json.access_token) return tokensFrom(r.json);
  const code = codeOf(r.json);
  if (code === "email_not_confirmed") throw new AuthFailure("EMAIL_NOT_CONFIRMED", "Please confirm your email first. We sent you a link when you signed up.");
  if (r.status === 429 || code === "over_request_rate_limit") throw new AuthFailure("RATE_LIMITED", "Too many tries. Please wait a few minutes and try again.");
  if (r.status >= 500) throw new AuthFailure("UNAVAILABLE", "Sign-in is not available right now. Please try again in a minute.");
  throw new AuthFailure("INVALID_CREDENTIALS", "That email or password is not right.");
}

export async function refreshSession(refreshToken: string): Promise<TokenSet> {
  const r = await call("/auth/v1/token?grant_type=refresh_token", { body: { refresh_token: refreshToken } });
  if (r.status === 200 && r.json.access_token) return tokensFrom(r.json);
  if (r.status >= 500) throw new AuthFailure("UNAVAILABLE", "Sign-in is not available right now.");
  throw new AuthFailure("EXPIRED", "Your session ended. Please sign in again.");
}

const userCache = new Map<string, { at: number; user: AuthUser | null }>();
const CACHE_MS = 30_000;
const keyOf = (token: string) => createHash("sha256").update(token).digest("hex").slice(0, 32);

/** The user a token belongs to, or null when the token is expired, revoked or forged. */
export async function getUserFromToken(accessToken: string): Promise<AuthUser | null> {
  if (!accessToken || accessToken.length > 4000) return null;
  const k = keyOf(accessToken);
  const hit = userCache.get(k);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.user;
  const claims = decodeClaims(accessToken);
  if (claims.exp && claims.exp * 1000 < Date.now()) return null;
  const r = await call("/auth/v1/user", { bearer: accessToken });
  if (r.status >= 500) throw new AuthFailure("UNAVAILABLE", "Sign-in is not available right now.");
  if (r.status !== 200 || !r.json.id) {
    userCache.set(k, { at: Date.now(), user: null });
    return null;
  }
  const user: AuthUser = {
    id: String(r.json.id), email: String(r.json.email ?? "").toLowerCase(), emailConfirmed: Boolean(r.json.email_confirmed_at || r.json.confirmed_at),
    factors: Array.isArray(r.json.factors) ? (r.json.factors as Record<string, unknown>[]).map((f) => ({ id: String(f.id), type: String(f.factor_type ?? f.type), status: String(f.status) })) : [],
  };
  if (userCache.size > 2000) userCache.clear();
  userCache.set(k, { at: Date.now(), user });
  return user;
}

export function forgetToken(accessToken: string): void {
  userCache.delete(keyOf(accessToken));
}

export async function signOutToken(accessToken: string): Promise<void> {
  forgetToken(accessToken);
  await call("/auth/v1/logout", { method: "POST", bearer: accessToken, body: {} }).catch(() => undefined);
}

// ---- Two-factor (TOTP) -----------------------------------------------------------------------------------------------

export interface TotpEnrollment {
  factorId: string;
  /** The secret to type into an authenticator app if the picture cannot be scanned. */
  secret: string;
  /** otpauth:// address behind the QR picture. */
  uri: string;
  /** The QR picture as an SVG data address, ready for an <img>. */
  qr: string;
}

/** Supabase returns the SVG unencoded after "data:image/svg+xml;utf-8,": a "#" or quote inside breaks the picture, so encode it ourselves. */
function qrAddress(raw: string): string {
  const m = raw.match(/^data:image\/svg\+xml;(?:charset=)?utf-8,([\s\S]*)$/i);
  return m ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(decodeURIComponentSafe(m[1]!))}` : raw;
}
function decodeURIComponentSafe(v: string): string {
  try { return decodeURIComponent(v); } catch { return v; }
}

export async function enrollTotp(accessToken: string, name: string): Promise<TotpEnrollment> {
  const r = await call("/auth/v1/factors", { bearer: accessToken, body: { factor_type: "totp", friendly_name: name.slice(0, 40), issuer: "BizTrackBD" } });
  if (r.status >= 300) throw new AuthFailure(r.status === 429 ? "RATE_LIMITED" : "UNAVAILABLE", msgOf(r.json) || "Could not start two-factor setup");
  const t = (r.json.totp ?? {}) as Record<string, unknown>;
  forgetToken(accessToken);
  return { factorId: String(r.json.id), secret: String(t.secret ?? ""), uri: String(t.uri ?? ""), qr: qrAddress(String(t.qr_code ?? "")) };
}

/** Proves possession of the authenticator. On success the new tokens are at assurance level 2. */
export async function verifyTotp(accessToken: string, factorId: string, code: string): Promise<TokenSet> {
  const clean = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) throw new AuthFailure("INVALID_CODE", "Enter the 6 digits from your authenticator app.");
  const ch = await call(`/auth/v1/factors/${encodeURIComponent(factorId)}/challenge`, { bearer: accessToken, body: {} });
  if (ch.status >= 300 || !ch.json.id) throw new AuthFailure(ch.status === 429 ? "RATE_LIMITED" : "UNAVAILABLE", "Could not check the code. Please try again.");
  const v = await call(`/auth/v1/factors/${encodeURIComponent(factorId)}/verify`, { bearer: accessToken, body: { challenge_id: ch.json.id, code: clean } });
  if (v.status === 200 && v.json.access_token) {
    forgetToken(accessToken);
    return tokensFrom(v.json);
  }
  if (v.status === 429) throw new AuthFailure("RATE_LIMITED", "Too many tries. Please wait a few minutes and try again.");
  throw new AuthFailure("INVALID_CODE", "That code is not right, or it has expired. Try the newest code.");
}

export async function removeFactor(accessToken: string, factorId: string): Promise<void> {
  const r = await call(`/auth/v1/factors/${encodeURIComponent(factorId)}`, { method: "DELETE", bearer: accessToken });
  forgetToken(accessToken);
  if (r.status >= 300) throw new AuthFailure("UNAVAILABLE", "Could not remove it. Please try again.");
}

// ---- Accounts (service role: our server only, never the browser) ----------------------------------------------------------

export const PASSWORD_MIN = 10;
export function checkPassword(p: string): string | null {
  if (p.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (p.length > 72) return "Use at most 72 characters.";
  if (/^(.)\1+$/.test(p) || /^(0123456789|password|qwertyuiop)/i.test(p)) return "That password is too easy to guess.";
  return null;
}

/** Creates the sign-in account. `confirmed: true` only when the caller has already proved the person controls the email (an invite link). */
export async function adminCreateUser(email: string, password: string, opts: { confirmed: boolean }): Promise<{ id: string }> {
  const weak = checkPassword(password);
  if (weak) throw new AuthFailure("WEAK_PASSWORD", weak);
  const r = await call("/auth/v1/admin/users", { key: "service", body: { email: email.trim().toLowerCase(), password, email_confirm: opts.confirmed } });
  if (r.status === 200 || r.status === 201) return { id: String(r.json.id) };
  const code = codeOf(r.json);
  if (code === "email_exists" || code === "user_already_exists" || r.status === 422) throw new AuthFailure("EXISTS", "There is already an account with this email.");
  if (code === "weak_password") throw new AuthFailure("WEAK_PASSWORD", "That password is too easy to guess. Try a longer one.");
  throw new AuthFailure("UNAVAILABLE", "We could not create the account. Please try again.");
}

export async function adminDeleteUser(id: string): Promise<void> {
  const r = await call(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: "DELETE", key: "service" });
  if (r.status >= 300 && r.status !== 404) throw new AuthFailure("UNAVAILABLE", "Could not delete the account");
}

export async function adminSetPassword(id: string, password: string): Promise<void> {
  const weak = checkPassword(password);
  if (weak) throw new AuthFailure("WEAK_PASSWORD", weak);
  const r = await call(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: "PUT", key: "service", body: { password } });
  if (r.status >= 300) throw new AuthFailure("UNAVAILABLE", "Could not change the password");
}

/** Sends the email-confirmation link again (needs the project's email sending set up in Supabase). */
export async function resendConfirmation(email: string): Promise<void> {
  await call("/auth/v1/resend", { body: { type: "signup", email: email.trim().toLowerCase() } }).catch(() => undefined);
}

// ---- First sign-in and forgotten passwords: prove the email first, then choose a password ---------------------------------
//
// Making an account with a password for an address nobody has proved they own would let someone sign up as a store owner's
// email and set their own password before the owner ever arrives. So an account is only ever given a password by someone who
// has just received (and typed) a one-time code sent to that address. The same steps recover a forgotten password.

/** Asks Supabase to email a one-time code. Never says whether it worked: the caller answers the same either way. */
export async function sendEmailCode(email: string): Promise<void> {
  await call("/auth/v1/otp", { body: { email: email.trim().toLowerCase(), create_user: true } }).catch(() => undefined);
}

export async function verifyEmailCode(email: string, code: string): Promise<TokenSet> {
  const clean = code.replace(/\s+/g, "");
  if (!/^\d{6,8}$/.test(clean)) throw new AuthFailure("INVALID_CODE", "Enter the code from your email.");
  const r = await call("/auth/v1/verify", { body: { type: "email", email: email.trim().toLowerCase(), token: clean } });
  if (r.status === 200 && r.json.access_token) return tokensFrom(r.json);
  if (r.status === 429) throw new AuthFailure("RATE_LIMITED", "Too many tries. Please wait a few minutes and try again.");
  throw new AuthFailure("INVALID_CODE", "That code is not right, or it has expired. Ask for a new one.");
}

/** The signed-in person chooses (or changes) their own password. */
export async function setOwnPassword(accessToken: string, password: string): Promise<void> {
  const weak = checkPassword(password);
  if (weak) throw new AuthFailure("WEAK_PASSWORD", weak);
  const r = await call("/auth/v1/user", { method: "PUT", bearer: accessToken, body: { password } });
  forgetToken(accessToken);
  if (r.status === 200) return;
  if (codeOf(r.json) === "same_password") throw new AuthFailure("WEAK_PASSWORD", "Choose a password you have not used here before.");
  if (codeOf(r.json) === "weak_password") throw new AuthFailure("WEAK_PASSWORD", "That password is too easy to guess. Try a longer one.");
  throw new AuthFailure("UNAVAILABLE", "We could not save the password. Please try again.");
}

/**
 * A one-time sign-in code for this address, WITHOUT Supabase emailing it: the caller sends it in BizTrackBD's own email. Supabase makes the
 * account if it does not exist yet (as `sendEmailCode` does) and checks the code when it is typed back in. Null if Supabase could not make one.
 */
export async function issueEmailCode(email: string): Promise<string | null> {
  try {
    const r = await call("/auth/v1/admin/generate_link", { key: "service", body: { type: "magiclink", email: email.trim().toLowerCase() } });
    const otp = String(r.json.email_otp ?? (r.json.properties as Record<string, unknown> | undefined)?.email_otp ?? "");
    return /^\d{6,8}$/.test(otp) ? otp : null;
  } catch {
    return null;
  }
}

/** For tests and support tooling only: the one-time code Supabase would have emailed, without sending anything. */
export async function adminGenerateEmailCode(email: string): Promise<string> {
  const r = await call("/auth/v1/admin/generate_link", { key: "service", body: { type: "magiclink", email: email.trim().toLowerCase() } });
  const otp = String(r.json.email_otp ?? (r.json.properties as Record<string, unknown> | undefined)?.email_otp ?? "");
  if (!otp) throw new AuthFailure("UNAVAILABLE", "Could not make a code");
  return otp;
}
