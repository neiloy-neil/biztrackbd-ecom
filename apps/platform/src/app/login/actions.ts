"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  AuthFailure, enrollTotp, getUserFromToken, platformEmailKnown, platformMemberFor, recordPlatformLogin, sendSignInCode, setOwnPassword, signInWithPassword, signOutToken, verifyEmailCode, verifyTotp,
  type TokenSet,
} from "@biztrackbd/core";
import { AT, clearSessionCookies, safeNext, setSessionCookies } from "@/lib/auth";

export interface LoginState {
  error?: string;
  step?: "email" | "code";
  email?: string;
}

// A second brake behind Supabase's own limits. Stricter than the store admin's: this team can reach every store.
const attempts = new Map<string, number[]>();
function tooMany(key: string, max = 6, windowMs = 10 * 60_000): boolean {
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
  console.error("platform sign-in failed", e instanceof Error ? e.name : "unknown");
  return "Something went wrong. Please try again.";
};

/** After any successful step: on the team? two-factor set up? completed for this session? Then in. */
async function finish(t: TokenSet, next: string): Promise<never> {
  await setSessionCookies(t);
  const user = await getUserFromToken(t.accessToken);
  if (!user) redirect("/login?err=session");
  const member = await platformMemberFor(user);
  if (!member || !member.isActive) {
    await clearSessionCookies();
    redirect("/login?err=no-access");
  }
  if (!user.factors.some((f) => f.status === "verified")) redirect("/enroll");
  if (t.aal !== "aal2") redirect(`/login/mfa?next=${encodeURIComponent(next)}`);
  await recordPlatformLogin(member.id);
  redirect(next);
}

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? ""));
  if (!email || !password) return { error: "Enter your email and password.", email };
  const ip = await clientIp();
  if (blocked(`ip:${ip}`, 15) || blocked(`em:${email}`, 6)) return { error: "Too many tries. Please wait a few minutes and try again.", email };
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
  if (blocked(`mfa:${token.slice(-20)}`, 8)) return { error: "Too many tries. Please wait a few minutes and try again." };
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

export async function requestCodeAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter your email address.", step: "email" };
  if (tooMany(`code:${await clientIp()}`, 8, 3_600_000) || tooMany(`codeem:${email}`, 3, 3_600_000)) return { error: "Too many codes asked for. Please wait a while and try again.", step: "email", email };
  if (await platformEmailKnown(email)) await sendSignInCode(email, "en");
  return { step: "code", email };
}

export async function completeSetupAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(String(form.get("next") ?? ""));
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("again") ?? "")) return { error: "The two passwords are not the same.", step: "code", email };
  if (blocked(`setup:${email}`, 6)) return { error: "Too many tries. Please wait a few minutes and try again.", step: "code", email };
  let t: TokenSet;
  try {
    if (!(await platformEmailKnown(email))) throw new AuthFailure("INVALID_CODE", "That code is not right, or it has expired. Ask for a new one.");
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

// ---- Two-factor set-up, required before the first use ------------------------------------------------------------------

export interface EnrollState {
  error?: string;
  enrolled?: { factorId: string; secret: string; qr: string };
}

export async function startEnrollAction(): Promise<EnrollState> {
  const token = (await cookies()).get(AT)?.value;
  if (!token || !(await getUserFromToken(token))) redirect("/login");
  try {
    const e = await enrollTotp(token, `Platform ${new Date().toISOString().slice(0, 10)}`);
    return { enrolled: { factorId: e.factorId, secret: e.secret, qr: e.qr } };
  } catch (e) {
    return { error: fail(e) };
  }
}

export async function confirmEnrollAction(_p: EnrollState, form: FormData): Promise<EnrollState> {
  const token = (await cookies()).get(AT)?.value;
  if (!token || !(await getUserFromToken(token))) redirect("/login");
  let t: TokenSet;
  try {
    t = await verifyTotp(token, String(form.get("factorId") ?? ""), String(form.get("code") ?? ""));
  } catch (e) {
    return { error: fail(e) };
  }
  return finish(t, "/");
}
