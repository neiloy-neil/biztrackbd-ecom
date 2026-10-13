"use server";

import { DomainError, hashClient, normalizeBdPhone, placeDraftOrder, signOrderAccess } from "@biztrackbd/core";
import { clientIp } from "@/lib/ip";
import { getStore } from "@/lib/tenant";

export type DraftPlaceResult = { ok: true; orderId: string; token: string } | { ok: false; error: string; field?: string };

/** The customer confirms the draft the store sent them. Prices, stock and the rest are worked out again by the order code. */
export async function placeDraftAction(code: string, p: { paymentMethod: "COD" | "MANUAL_BKASH" | "MANUAL_NAGAD"; mfs?: { senderNumber: string; trxId: string } }): Promise<DraftPlaceResult> {
  const store = await getStore();
  try {
    if (p.mfs) normalizeBdPhone(p.mfs.senderNumber);
    const placed = await placeDraftOrder(store.id, code, { paymentMethod: p.paymentMethod, mfs: p.mfs, clientHash: hashClient(await clientIp()) });
    return { ok: true, orderId: placed.orderId, token: signOrderAccess(store.id, placed.orderId) };
  } catch (e) {
    if (e instanceof DomainError) {
      return { ok: false, error: e.message, field: typeof e.details?.field === "string" ? e.details.field : undefined };
    }
    console.error("placeDraftAction failed", e instanceof Error ? e.name : "unknown");
    return { ok: false, error: "Something went wrong. Your order was not placed. Please try again." };
  }
}
