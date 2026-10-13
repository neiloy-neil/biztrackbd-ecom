"use server";

import { revalidatePath } from "next/cache";
import { DomainError, editOrderItems, type WantedLine } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface ItemsState { error?: string; ok?: boolean; total?: number; changed?: boolean }

/** Saves the new list of items for an open order. A refusal comes back as words for the owner, and nothing is changed. */
export async function saveItemsAction(orderId: string, lines: WantedLine[]): Promise<ItemsState> {
  const s = await requireAction("orders", "edit");
  try {
    const r = await editOrderItems(s.tenantId, s.actor, orderId, lines.map((l) => ({ itemId: l.itemId || undefined, variantId: String(l.variantId), quantity: Number(l.quantity) })));
    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/orders");
    revalidatePath("/inventory");
    return { ok: true, total: r.total, changed: r.changed };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    console.error("edit items failed", e instanceof Error ? e.name : "unknown");
    return { error: "Something went wrong. Nothing was changed." };
  }
}
