"use server";

import { cookies, headers } from "next/headers";
import { DomainError, districtsOf, divisionNames, hashClient, normalizeBdPhone, placeLandingOrder, recordLandingView, saveLandingLead, sendServerPurchase, signOrderAccess } from "@biztrackbd/core";
import { clientIp } from "@/lib/ip";
import { getStore } from "@/lib/tenant";

export interface LandingOrderState {
  error?: string;
  field?: string;
  /** Set when the order was placed: where the form sends the customer (their order page). */
  redirectTo?: string;
}

/**
 * Takes the order a landing page collects. Prices, stock and the product come from the database through the page's own
 * record; the browser sends only which option, how many, and the customer's details.
 */
export async function placeLandingOrderAction(slug: string, _prev: LandingOrderState, form: FormData): Promise<LandingOrderState> {
  const store = await getStore();
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const division = get("division");
  const district = get("district");
  if (!divisionNames().includes(division) || !districtsOf(division).some((d) => d.name === district)) return { error: "Choose your division and district from the lists.", field: "district" };
  let phone: string;
  try {
    phone = normalizeBdPhone(get("phone"));
  } catch {
    return { error: "Enter a valid mobile number, like 01712345678.", field: "phone" };
  }
  const quantity = Number(get("quantity")) || 1;
  const bump = get("bump") === "on";
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return { error: "Choose a quantity from 1 to 10.", field: "quantity" };

  const cookieStore = await cookies();
  const affiliateRef = get("affiliateRef") || cookieStore.get("bt_aff_ref")?.value?.trim() || undefined;

  let placed: Awaited<ReturnType<typeof placeLandingOrder>>;
  try {
    placed = await placeLandingOrder(store.id, slug, {
      idempotencyKey: get("key"), optionId: get("optionId") || undefined, bump, variantId: get("variantId"), quantity, name: get("name"), phone, address: get("address"), district, division,
      clientHash: hashClient(await clientIp()), utmSource: get("utm_source") || undefined, utmCampaign: get("utm_campaign") || undefined, utmMedium: get("utm_medium") || undefined,
      affiliateRef,
    });
    if (!placed.replayed) {
      const ua = (await headers()).get("user-agent");
      await Promise.race([sendServerPurchase(store.id, placed.orderId, { ip: await clientIp(), userAgent: ua }), new Promise((r) => setTimeout(r, 2500))]);
    }
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message, field: typeof e.details?.field === "string" ? e.details.field : undefined };
    console.error("placeLandingOrderAction failed", e instanceof Error ? e.name : "unknown");
    return { error: "Something went wrong. Your order was not placed. Please try again." };
  }
  // Returned, not redirected: the form moves the customer on from the browser, so the store host is kept (as checkout does).
  return { redirectTo: `/order/${placed.orderId}?k=${signOrderAccess(store.id, placed.orderId)}` };
}

// Per process, per connection: a brake against a script filling the lead list or inflating the view count. Real limits belong at the edge.
const hits = new Map<string, number[]>();
function tooMany(key: string, max: number, windowMs = 3_600_000): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

/** Counts a view of a live page. Never throws: a counting problem must not touch the page. */
export async function trackLandingViewAction(slug: string): Promise<void> {
  try {
    if (!/^[a-z0-9-]{1,60}$/.test(slug) || tooMany(`v:${await clientIp()}`, 120)) return;
    await recordLandingView((await getStore()).id, slug);
  } catch {
    /* counting is best effort */
  }
}

/** Keeps the name and number a visitor typed, so the seller can call if the order was not finished. The page tells the visitor this. */
export async function saveLandingLeadAction(slug: string, lead: { name: string; phone: string; offerLabel?: string; utmSource?: string; utmCampaign?: string }): Promise<void> {
  try {
    if (!/^[a-z0-9-]{1,60}$/.test(slug) || tooMany(`l:${await clientIp()}`, 20)) return;
    await saveLandingLead((await getStore()).id, slug, lead);
  } catch {
    /* a lead is a convenience */
  }
}
