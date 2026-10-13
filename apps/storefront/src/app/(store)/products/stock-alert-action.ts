"use server";

import { DomainError, requestStockAlert } from "@biztrackbd/core";
import { getStore } from "@/lib/tenant";

export type StockAlertResult = { ok: true; alreadyWaiting: boolean } | { ok: false; error: string };

/** A shopper leaves a mobile number on a sold-out item. Public, so it asks for nothing else and says nothing about who else is waiting. */
export async function requestStockAlertAction(variantId: string, phone: string): Promise<StockAlertResult> {
  const store = await getStore();
  try {
    const r = await requestStockAlert(store.id, { variantId: String(variantId).slice(0, 64), phone: String(phone).slice(0, 20) });
    return { ok: true, alreadyWaiting: r.alreadyWaiting };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("requestStockAlertAction failed", e instanceof Error ? e.name : "unknown");
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
