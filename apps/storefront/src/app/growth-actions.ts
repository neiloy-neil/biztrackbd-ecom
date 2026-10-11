"use server";

import { DomainError, captureCheckout, recordBrowserPurchase, submitReview, verifyOrderAccess } from "@biztrackbd/core";
import { clientIp } from "@/lib/ip";
import { getCustomerSession } from "@/lib/session";
import { getStore } from "@/lib/tenant";

// Per process, per visitor address. These endpoints are public and write to the database, so each gets a modest ceiling;
// real rate limiting belongs at the edge.
const hits = new Map<string, number[]>();
function over(bucket: string, ip: string | undefined, max: number): boolean {
  const key = `${bucket}:${ip ?? "?"}`;
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}

/** The thank-you page. The order's own total is reported, and only to someone holding the order's signed link. */
export async function purchaseAction(orderId: string, token: string | undefined): Promise<{ eventId: string; value: number; contentIds: string[]; numItems: number } | null> {
  const store = await getStore();
  const session = await getCustomerSession(store.id);
  if (!verifyOrderAccess(store.id, orderId, token) && !session) return null;
  return recordBrowserPurchase(store.id, orderId).catch(() => null);
}

export interface CapturePayload {
  phone: string;
  name?: string;
  district?: string;
  items: { variantId: string; quantity: number }[];
}

/** The customer typed a valid number at checkout: keep the cart for the store's call list. Never answers with anything about the store. */
export async function captureAction(p: CapturePayload): Promise<void> {
  const ip = await clientIp();
  if (over("capture", ip, 20)) return;
  const store = await getStore();
  await captureCheckout(store.id, p).catch((e) => console.error("captureAction failed", e instanceof Error ? e.name : "unknown"));
}

export type ReviewResult = { ok: true; published: boolean } | { ok: false; error: string };

export async function submitReviewAction(productId: string, rating: number, title: string, body: string): Promise<ReviewResult> {
  const ip = await clientIp();
  if (over("review", ip, 10)) return { ok: false, error: "Too many tries. Please wait a few minutes." };
  const store = await getStore();
  const session = await getCustomerSession(store.id);
  if (!session) return { ok: false, error: "Please sign in first." };
  try {
    const r = await submitReview(store.id, session.customerId, { productId, rating, title: title || undefined, body });
    return { ok: true, published: r.published };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("submitReviewAction failed", e instanceof Error ? e.name : "unknown");
    return { ok: false, error: "We could not save your review." };
  }
}
