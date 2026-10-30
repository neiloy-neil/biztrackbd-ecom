"use server";

import { cookies, headers } from "next/headers";
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

  const ownerName = String(form.get("ownerName") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const phone = String(form.get("phone") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const storeName = String(form.get("storeName") ?? "").trim();
  const category = (String(form.get("category") ?? "GENERAL").toUpperCase()) as "FASHION" | "BEAUTY" | "ELECTRONICS" | "GROCERY" | "GENERAL";
  const tagline = String(form.get("tagline") ?? "").trim();
  const subdomain = String(form.get("subdomain") ?? "").trim().toLowerCase();
  const siteMode = (String(form.get("siteMode") ?? "ECOMMERCE").toUpperCase()) as "ECOMMERCE" | "PORTFOLIO" | "HYBRID";
  const rawVertical = form.get("businessVertical");
  const businessVertical = rawVertical && String(rawVertical).trim() ? String(rawVertical).toUpperCase() as any : undefined;
  const plan = (String(form.get("plan") ?? "PRO").toUpperCase()) as "STARTER" | "PRO" | "BUSINESS";
  const theme = String(form.get("theme") ?? "kapor");
  const demoData = form.get("demoData") !== "off";

  if (!ownerName || ownerName.length < 2) return { error: "Enter your full name", field: "ownerName" };
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email address", field: "email" };
  if (!phone || phone.length < 10) return { error: "Enter a valid mobile number (e.g. 01712345678)", field: "phone" };
  if (password && password.length < 8) return { error: "Password must be at least 8 characters", field: "password" };
  if (!storeName || storeName.length < 2) return { error: "Enter your store name", field: "storeName" };
  if (!subdomain || subdomain.length < 3) return { error: "Choose a valid web address", field: "subdomain" };

  // Tracking and Attribution parameters
  const cookieStore = await cookies();
  const sessionId = String(form.get("sessionId") ?? "").trim() || cookieStore.get("bt_native_session_v1")?.value || undefined;
  const eventId = String(form.get("eventId") ?? "").trim() || undefined;
  const fbp = String(form.get("fbp") ?? "").trim() || cookieStore.get("_fbp")?.value || undefined;
  const fbc = String(form.get("fbc") ?? "").trim() || cookieStore.get("_fbc")?.value || undefined;
  const utmSource = String(form.get("utmSource") ?? "").trim() || undefined;
  const utmMedium = String(form.get("utmMedium") ?? "").trim() || undefined;
  const utmCampaign = String(form.get("utmCampaign") ?? "").trim() || undefined;
  const referrer = String(form.get("referrer") ?? "").trim() || undefined;
  const userAgent = (await headers()).get("user-agent") ?? undefined;

  // A demo the visitor chose to keep: its secret code arrives as a hidden field. The core checks it; a wrong or used code just means sample products.
  const keepCode = String(form.get("from") ?? "").slice(0, 120);
  const copier = keepPictureCopier();
  let signed;
  try {
    signed = await signupStore({
      ownerName,
      email,
      phone,
      password: password || undefined,
      storeName,
      category: category || "GENERAL",
      tagline: tagline || undefined,
      subdomain,
      plan: plan || "PRO",
      theme,
      demoData,
      siteMode,
      businessVertical,
      sessionId,
      eventId,
      ip,
      userAgent,
      fbp,
      fbc,
      utmSource,
      utmMedium,
      utmCampaign,
      referrer,
      consentGiven: true,
    }, { pictures: samplePictures() ?? undefined, ...(keepCode && copier ? { keep: { code: keepCode, copyImage: copier } } : {}) });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message, field: typeof e.details?.field === "string" ? e.details.field : undefined };
    console.error("signup failed", e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("subdomain") || msg.toLowerCase().includes("taken")) {
      return { error: "This store address is already taken. Please choose another.", field: "subdomain" };
    }
    if (msg.toLowerCase().includes("too many stores")) {
      return { error: "This email already has the maximum allowed stores. Please sign in to your existing store.", field: "email" };
    }
    if (msg.toLowerCase().includes("connect") || msg.toLowerCase().includes("econnrefused")) {
      return { error: "Unable to connect to the store database. Please try again shortly." };
    }
    return { error: `Could not create store: ${msg.slice(0, 120)}. Please check your details and try again.` };
  }

  const q = new URLSearchParams({
    store: signed.subdomain,
    name: signed.storeName,
    email: signed.ownerEmail,
    ends: signed.trialEndsAt.toISOString(),
    plan: signed.plan,
    ...(eventId ? { ev: eventId } : {}),
    ...(signed.autoLoginToken ? { token: signed.autoLoginToken } : {}),
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
