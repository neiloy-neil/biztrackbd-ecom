"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DomainError, SUBDOMAIN_MESSAGES, checkSubdomain, signupStore } from "@biztrackbd/core";

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

  let signed;
  try {
    signed = await signupStore({
      ownerName: String(form.get("ownerName") ?? ""), email: String(form.get("email") ?? ""), phone: String(form.get("phone") ?? ""),
      storeName: String(form.get("storeName") ?? ""), tagline: String(form.get("tagline") ?? "") || undefined, subdomain: String(form.get("subdomain") ?? ""),
      plan: String(form.get("plan") ?? "PRO"), theme: String(form.get("theme") ?? "kapor"), demoData: form.get("demoData") === "on",
    });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message, field: typeof e.details?.field === "string" ? e.details.field : undefined };
    console.error("signup failed", e instanceof Error ? e.name : "unknown");
    return { error: "We could not create your store. Nothing was charged. Please try again." };
  }
  const q = new URLSearchParams({ store: signed.subdomain, name: signed.storeName, ends: signed.trialEndsAt.toISOString(), plan: signed.plan, ...(signed.quarantined ? { review: "1" } : {}) });
  redirect(`/start/done?${q.toString()}`);
}

/** The live "is this address free?" check while typing. Says only yes or why not. */
export async function checkAddressAction(label: string): Promise<{ ok: boolean; message: string }> {
  const r = await checkSubdomain(label);
  return r.ok ? { ok: true, message: "Available" } : { ok: false, message: SUBDOMAIN_MESSAGES[r.reason] ?? "Not available" };
}
