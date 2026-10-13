"use server";

import { DomainError, hashClient, submitContactMessage } from "@biztrackbd/core";
import { clientIp } from "@/lib/ip";
import { getStore } from "@/lib/tenant";

export type ContactResult = { ok: true } | { ok: false; error: string; field?: string };

/** A shopper writes to the store. Limited by phone number and by connection (the core does the counting). */
export async function sendContactAction(p: { name: string; phone: string; email?: string; message: string }): Promise<ContactResult> {
  const store = await getStore();
  try {
    await submitContactMessage(store.id, {
      name: String(p.name).slice(0, 100), phone: String(p.phone).slice(0, 20), email: p.email ? String(p.email).slice(0, 120) : undefined, message: String(p.message).slice(0, 1200),
      clientHash: hashClient(await clientIp()),
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message, field: typeof e.details?.field === "string" ? e.details.field : undefined };
    console.error("sendContactAction failed", e instanceof Error ? e.name : "unknown");
    return { ok: false, error: "Something went wrong. Your message was not sent. Please try again." };
  }
}
