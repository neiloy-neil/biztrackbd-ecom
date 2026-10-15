"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  DomainError,
  quoteOrder,
  getCheckoutOrderBumps,
  getActiveBundlesForProduct,
  listWholesalePrices,
  getWholesaleCustomerProfile,
  type Quote,
  type StorefrontOrderBump,
  type StorefrontBundle,
} from "@biztrackbd/core";
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
  items: { variantId: string; quantity: number; bundleId?: string; isBump?: boolean }[];
  bundleId?: string;
  bumpIds?: string[];
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

/** Fetch active checkout order bumps matching cart items */
export async function fetchCheckoutBumpsAction(cartProductIds: string[]): Promise<{ ok: boolean; bumps: StorefrontOrderBump[] }> {
  const store = await getStore();
  try {
    const bumps = await getCheckoutOrderBumps(store.id, cartProductIds);
    return { ok: true, bumps };
  } catch (e) {
    console.error("fetchCheckoutBumpsAction failed", e);
    return { ok: false, bumps: [] };
  }
}

/** Fetch active bundles for a product page */
export async function fetchProductBundlesAction(productId: string): Promise<{ ok: boolean; bundles: StorefrontBundle[] }> {
  const store = await getStore();
  try {
    const bundles = await getActiveBundlesForProduct(store.id, productId);
    return { ok: true, bundles };
  } catch (e) {
    console.error("fetchProductBundlesAction failed", e);
    return { ok: false, bundles: [] };
  }
}

/** Fetch volume breaks and wholesale pricing for a variant */
export async function fetchVariantWholesaleAction(variantId: string): Promise<{
  ok: boolean;
  breaks: Array<{ minQuantity: number; price: number; savingsPercent: number }>;
  tierName?: string;
  moq?: number;
}> {
  const store = await getStore();
  try {
    const session = await getCustomerSession(store.id);
    const prices = await listWholesalePrices(store.id, variantId);
    const profile = session?.customerId
      ? await getWholesaleCustomerProfile(store.id, session.customerId)
      : null;

    const eligiblePrices = prices.filter(
      (p) => p.tierId === null || (profile?.tierId && p.tierId === profile.tierId)
    );

    const breaks = eligiblePrices.map((p) => {
      const reg = Number(p.variant.price);
      const pr = Number(p.price);
      return {
        minQuantity: p.minQuantity,
        price: pr,
        savingsPercent: reg > pr ? Math.round(((reg - pr) / reg) * 100) : 0,
      };
    });

    return {
      ok: true,
      breaks,
      tierName: profile?.tier?.name,
      moq: 1,
    };
  } catch (e) {
    console.error("fetchVariantWholesaleAction failed", e);
    return { ok: false, breaks: [] };
  }
}


