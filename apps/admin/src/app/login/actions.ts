"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  AuthFailure, enrollTotp, getUserFromToken, recordStaffLogin, removeFactor, sendSignInCode, setOwnPassword, signInWithPassword, signOutToken, staffEmailKnown, staffMemberships, verifyEmailCode, verifyTotp,
  type TokenSet,
} from "@biztrackbd/core";
import { AT, TENANT, clearSessionCookies, cookieOptions, safeNext, setSessionCookies } from "@/lib/auth";

export interface LoginState {
  error?: string;
  step?: "email" | "code";
  email?: string;
}

// Per process, per address and per email: a second brake behind Supabase's own limits, so one person cannot hammer one account.
const attempts = new Map<string, number[]>();
function tooMany(key: string, max = 8, windowMs = 10 * 60_000): boolean {
  const now = Date.now();
  const hits = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  attempts.set(key, hits);
  if (attempts.size > 5000) attempts.clear();
  return hits.length > max;
}
/** Only FAILED attempts count against a person: signing in correctly many times is not an attack. */
function blocked(key: string, max: number, windowMs = 10 * 60_000): boolean {
  return (attempts.get(key) ?? []).filter((t) => Date.now() - t < windowMs).length >= max;
}
function failed(...keys: string[]): void {
  const now = Date.now();
  for (const key of keys) attempts.set(key, [...(attempts.get(key) ?? []).filter((t) => now - t < 10 * 60_000), now]);
}

const clientIp = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
const fail = (e: unknown): string => {
  if (e instanceof AuthFailure) return e.message;
  console.error("sign-in failed", e instanceof Error ? e.name : "unknown");
  return e instanceof Error && /^(PrismaClient|P\d{4})/.test(e.name + (e as { code?: string }).code) ? BUSY : "Something went wrong. Please try again.";
};

const BUSY = "We are busy right now. Please wait a minute and try again.";
/** The team check needs the database, which can be briefly full: try once more, and say so plainly rather than failing the page. */
async function knownEmail(email: string): Promise<boolean> {
  try {
    return await staffEmailKnown(email);
  } catch {
    await new Promise((r) => setTimeout(r, 800));
    return await staffEmailKnown(email);
  }
}

/** After any successful step: has this person got a store, and still to do two-factor? Sets the cookies and moves on. */
async function finish(t: TokenSet, next: string): Promise<never> {
  await setSessionCookies(t);
  const user = await getUserFromToken(t.accessToken);
  if (!user) redirect("/login?err=session");
  if (user.factors.some((f) => f.status === "verified") && t.aal !== "aal2") redirect(`/login/mfa?next=${encodeURIComponent(next)}`);
  const stores = (await staffMemberships(user)).filter((m) => m.isActive);
  if (stores.length === 0) {
    await clearSessionCookies();
    redirect("/login?err=no-store");
  }
  if (stores.length === 1) {
    (await cookies()).set(TENANT, stores[0]!.tenantId, cookieOptions(30 * 86400));
    await recordStaffLogin(stores[0]!.tenantId, stores[0]!.userId);
    redirect(next);
  }
  redirect(`/choose-store?next=${encodeURIComponent(next)}`);
}

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? ""));
  if (!email || !password) return { error: "Enter your email and password.", email };
  const ip = await clientIp();
  if (blocked(`ip:${ip}`, 20) || blocked(`em:${email}`, 8)) return { error: "Too many tries. Please wait a few minutes and try again.", email };
  let t: TokenSet;
  try {
    t = await signInWithPassword(email, password);
  } catch (e) {
    failed(`ip:${ip}`, `em:${email}`);
    return { error: fail(e), email };
  }
  return finish(t, next);
}

export async function mfaAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const next = safeNext(String(form.get("next") ?? ""));
  const token = (await cookies()).get(AT)?.value;
  if (!token) redirect("/login");
  if (blocked(`mfa:${token.slice(-20)}`, 10)) return { error: "Too many tries. Please wait a few minutes and try again." };
  const user = await getUserFromToken(token);
  const factor = user?.factors.find((f) => f.status === "verified");
  if (!user || !factor) redirect("/login");
  let t: TokenSet;
  try {
    t = await verifyTotp(token, factor.id, String(form.get("code") ?? ""));
  } catch (e) {
    failed(`mfa:${token.slice(-20)}`);
    return { error: fail(e) };
  }
  return finish(t, next);
}

/** Step one of first-time setup and of a forgotten password. The answer is the same whether or not the address is known. */
export async function requestCodeAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter your email address.", step: "email" };
  if (tooMany(`code:${await clientIp()}`, 10, 3_600_000) || tooMany(`codeem:${email}`, 4, 3_600_000)) return { error: "Too many codes asked for. Please wait a while and try again.", step: "email", email };
  // A code is only sent to an address that is on a team; anyone else gets the same screen and no email.
  let known: boolean;
  try {
    known = await knownEmail(email);
  } catch (e) {
    console.error("sign-in code: team check failed", e instanceof Error ? e.name : "unknown");
    return { error: BUSY, step: "email", email };
  }
  if (known) {
    const l = (await cookies()).get("bt_lang")?.value;
    await sendSignInCode(email, l === "bn" ? "bn" : l === "en" ? "en" : "both");
  }
  return { step: "code", email };
}

/** Step two: the code from the email proves the address; then the person chooses a password. */
export async function completeSetupAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(String(form.get("next") ?? ""));
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("again") ?? "")) return { error: "The two passwords are not the same.", step: "code", email };
  if (blocked(`setup:${email}`, 8)) return { error: "Too many tries. Please wait a few minutes and try again.", step: "code", email };
  let t: TokenSet;
  try {
    if (!(await knownEmail(email))) throw new AuthFailure("INVALID_CODE", "That code is not right, or it has expired. Ask for a new one.");
    t = await verifyEmailCode(email, String(form.get("code") ?? ""));
    await setOwnPassword(t.accessToken, password);
  } catch (e) {
    failed(`setup:${email}`);
    return { error: fail(e), step: "code", email };
  }
  return finish(t, next);
}

export async function logoutAction(): Promise<void> {
  const token = (await cookies()).get(AT)?.value;
  if (token) await signOutToken(token);
  await clearSessionCookies();
  redirect("/login");
}

export async function chooseStoreAction(form: FormData): Promise<void> {
  const token = (await cookies()).get(AT)?.value;
  const user = token ? await getUserFromToken(token) : null;
  if (!user) redirect("/login");
  const wanted = String(form.get("tenantId") ?? "");
  const m = (await staffMemberships(user)).find((x) => x.tenantId === wanted && x.isActive);
  if (!m) redirect("/choose-store");
  (await cookies()).set(TENANT, m.tenantId, cookieOptions(30 * 86400));
  await recordStaffLogin(m.tenantId, m.userId);
  redirect(safeNext(String(form.get("next") ?? "")));
}

// ---- Two-factor setup, for people who are signed in -------------------------------------------------------------------

export interface TotpState {
  error?: string;
  enrolled?: { factorId: string; secret: string; qr: string };
  done?: string;
}

export async function startTotpAction(): Promise<TotpState> {
  const token = (await cookies()).get(AT)?.value;
  if (!token || !(await getUserFromToken(token))) redirect("/login");
  try {
    const e = await enrollTotp(token, `Phone ${new Date().toISOString().slice(0, 10)}`);
    return { enrolled: { factorId: e.factorId, secret: e.secret, qr: e.qr } };
  } catch (e) {
    return { error: fail(e) };
  }
}

export async function confirmTotpAction(_p: TotpState, form: FormData): Promise<TotpState> {
  const token = (await cookies()).get(AT)?.value;
  if (!token || !(await getUserFromToken(token))) redirect("/login");
  try {
    const t = await verifyTotp(token, String(form.get("factorId") ?? ""), String(form.get("code") ?? ""));
    await setSessionCookies(t);
    return { done: "Two-factor sign-in is on. You will be asked for a code each time you sign in." };
  } catch (e) {
    return { error: fail(e) };
  }
}

export async function removeTotpAction(_p: TotpState, form: FormData): Promise<TotpState> {
  const token = (await cookies()).get(AT)?.value;
  const user = token ? await getUserFromToken(token) : null;
  if (!token || !user) redirect("/login");
  // Turning it off needs a code from this very session, so a borrowed signed-in screen cannot switch it off.
  const factor = user.factors.find((f) => f.id === String(form.get("factorId") ?? "") && f.status === "verified");
  if (!factor) return { error: "That is not turned on." };
  try {
    const t = await verifyTotp(token, factor.id, String(form.get("code") ?? ""));
    await removeFactor(t.accessToken, factor.id);
    await clearSessionCookies();
  } catch (e) {
    return { error: fail(e) };
  }
  redirect("/login?err=relogin");
}

export async function changePasswordAction(_p: TotpState, form: FormData): Promise<TotpState> {
  const token = (await cookies()).get(AT)?.value;
  const user = token ? await getUserFromToken(token) : null;
  if (!token || !user) redirect("/login");
  const now = String(form.get("current") ?? "");
  const next = String(form.get("password") ?? "");
  if (next !== String(form.get("again") ?? "")) return { error: "The two passwords are not the same." };
  if (blocked(`pw:${user.id}`, 6)) return { error: "Too many tries. Please wait a few minutes and try again." };
  try {
    // The current password is asked for again, so a borrowed signed-in screen cannot lock the owner out.
    await signInWithPassword(user.email, now);
    await setOwnPassword(token, next);
  } catch (e) {
    failed(`pw:${user.id}`);
    return { error: e instanceof AuthFailure && e.code === "INVALID_CREDENTIALS" ? "Your current password is not right." : fail(e) };
  }
  return { done: "Your password was changed." };
}
