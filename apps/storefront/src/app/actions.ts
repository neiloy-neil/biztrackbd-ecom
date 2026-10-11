"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DomainError, quoteOrder, type Quote } from "@biztrackbd/core";
import { LANG_COOKIE } from "@/lib/i18n";
import { SESSION_COOKIE, getCustomerSession } from "@/lib/session";
import { getStore } from "@/lib/tenant";

const YEAR = 365 * 24 * 3600;

export async function setLanguage(lang: string): Promise<void> {
  if (lang !== "en" && lang !== "bn") return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  revalidatePath("/", "layout");
}

export interface QuoteRequest {
  items: { variantId: string; quantity: number }[];
  district?: string;
  couponCode?: string;
  phone?: string;
  redeemPoints?: number;
  referralCode?: string;
}

/** Live prices for the cart and checkout. Display only: the order is priced again on the server when it is placed. */
export async function quoteCartAction(req: QuoteRequest): Promise<{ ok: true; quote: Quote } | { ok: false; error: string }> {
  const store = await getStore();
  try {
    // Who is signed in comes from the signed cookie, never from the request: the VIP discount and spending points depend on it.
    const session = await getCustomerSession(store.id);
    return { ok: true, quote: await quoteOrder(store.id, { ...req, verifiedCustomerId: session?.customerId }) };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("quoteCartAction failed", e instanceof Error ? e.name : "unknown");
    return { ok: false, error: "Could not update prices." };
  }
}
