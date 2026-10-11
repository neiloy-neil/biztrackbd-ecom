"use server";

import { headers } from "next/headers";
import { DomainError, districtsOf, divisionNames, hashClient, normalizeBdPhone, placeLandingOrder, sendServerPurchase, signOrderAccess } from "@biztrackbd/core";
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
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return { error: "Choose a quantity from 1 to 10.", field: "quantity" };

  let placed: Awaited<ReturnType<typeof placeLandingOrder>>;
  try {
    placed = await placeLandingOrder(store.id, slug, {
      idempotencyKey: get("key"), variantId: get("variantId"), quantity, name: get("name"), phone, address: get("address"), district, division,
      clientHash: hashClient(await clientIp()), utmSource: get("utm_source") || undefined, utmCampaign: get("utm_campaign") || undefined,
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
