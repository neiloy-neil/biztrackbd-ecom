"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthFailure, DomainError, SUBDOMAIN_MESSAGES, checkSubdomain, confirmSignupEmail, emailProofValid, sendSignupCode, signupStore } from "@biztrackbd/core";
import { keepPictureCopier, samplePictures } from "@/lib/pictures";

export interface SignupState {
  error?: string;
  /** The form field the message belongs to, so the wizard can go back to the right step. */
  field?: string;
}

// Per process. Stops one address from creating stores in a loop; real rate limiting belongs at the edge.
const recent = new Map<string, number[]>();
const PER_HOUR = 6;

function tooMany(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > PER_HOUR;
}

export async function signupAction(_prev: SignupState, form: FormData): Promise<SignupState> {
  // A field real people never see. Anything that fills it is a script; it gets the same answer a real failure would.
  if (String(form.get("website") ?? "") !== "") return { error: "Something went wrong. Please try again." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (tooMany(ip)) return { error: "Too many stores started from this connection. Please try again in an hour." };

  // The email must have been confirmed with a code first (see sendCodeAction and confirmEmailAction).
  if (!emailProofValid(String(form.get("proof") ?? ""), String(form.get("email") ?? ""))) {
    return { error: "Please confirm your email address first.", field: "email" };
  }

  // A demo the visitor chose to keep: its secret code arrives as a hidden field. The core checks it; a wrong or used code just means sample products.
  const keepCode = String(form.get("from") ?? "").slice(0, 120);
  const copier = keepPictureCopier();
  let signed;
  try {
    signed = await signupStore({
      ownerName: String(form.get("ownerName") ?? ""), email: String(form.get("email") ?? ""), phone: String(form.get("phone") ?? ""),
      storeName: String(form.get("storeName") ?? ""), tagline: String(form.get("tagline") ?? "") || undefined, subdomain: String(form.get("subdomain") ?? ""),
      plan: String(form.get("plan") ?? "PRO"), theme: String(form.get("theme") ?? "kapor"), demoData: form.get("demoData") === "on",
    }, { pictures: samplePictures() ?? undefined, ...(keepCode && copier ? { keep: { code: keepCode, copyImage: copier } } : {}) });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message, field: typeof e.details?.field === "string" ? e.details.field : undefined };
    // The full error goes to the server log only; visitors never see database or internal messages.
    console.error("signup failed", e instanceof Error ? `${e.name}: ${e.message}` : "unknown");
    return { error: "We could not create your store. Nothing was charged. Please try again." };
  }

  const q = new URLSearchParams({
    store: signed.subdomain,
    name: signed.storeName,
    ends: signed.trialEndsAt.toISOString(),
    plan: signed.plan,
    ...(signed.quarantined ? { review: "1" } : {}),
    ...(signed.kept ? { kept: String(signed.kept) } : {}),
  });
  redirect(`/start/done?${q.toString()}`);
}

/** The live "is this address free?" check while typing. Says only yes or why not. */
export async function checkAddressAction(label: string): Promise<{ ok: boolean; message: string }> {
  const r = await checkSubdomain(label);
  return r.ok ? { ok: true, message: "Available" } : { ok: false, message: SUBDOMAIN_MESSAGES[r.reason] ?? "Not available" };
}

export interface CodeState {
  ok?: boolean;
  proof?: string;
  existing?: boolean;
  error?: string;
}

/** Step "Confirm your email": sends the code. Always answers the same, so it cannot be used to find out who has a store. */
export async function sendCodeAction(email: string, lang: "en" | "bn" | "both" = "both"): Promise<{ ok: boolean; error?: string }> {
  const clean = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(clean) || clean.length > 120) return { ok: false, error: "Enter a valid email address" };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (tooManyCodes(`ip:${ip}`, 10) || tooManyCodes(`em:${clean}`, 4)) return { ok: false, error: "Too many codes asked for. Please wait a while and try again." };
  await sendSignupCode(clean, lang);
  return { ok: true };
}

/** Checks the typed code (and, for a new owner, sets the password). Returns the proof the signup needs. */
export async function confirmEmailAction(email: string, code: string, password: string): Promise<CodeState> {
  const clean = email.trim().toLowerCase();
  if (tooManyCodes(`try:${clean}`, 8)) return { error: "Too many tries. Please wait a few minutes and try again." };
  try {
    const r = await confirmSignupEmail(clean, code, password);
    return { ok: true, proof: r.proof, existing: r.existing };
  } catch (e) {
    if (e instanceof AuthFailure) return { error: e.message };
    console.error("confirm email failed", e instanceof Error ? e.name : "unknown");
    return { error: "We could not check the code. Please try again in a minute." };
  }
}

const codeHits = new Map<string, number[]>();
function tooManyCodes(key: string, max: number): boolean {
  const now = Date.now();
  const hits = (codeHits.get(key) ?? []).filter((t) => now - t < 3_600_000);
  hits.push(now);
  codeHits.set(key, hits);
  if (codeHits.size > 5000) codeHits.clear();
  return hits.length > max;
}
