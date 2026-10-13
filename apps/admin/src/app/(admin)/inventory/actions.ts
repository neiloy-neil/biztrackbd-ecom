"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, adjustStock, updateStockSettings, listStockHistory } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface StockHistoryItem {
  id: string;
  delta: number;
  quantityAfter: number;
  reason: string;
  note: string | null;
  actorName: string;
  createdAt: string;
}

export async function getStockHistoryAction(variantId: string): Promise<StockHistoryItem[]> {
  const s = await requireAction("products", "view");
  const list = await listStockHistory(s.tenantId, s.actor, variantId, 20);
  return list.map((item) => ({
    id: item.id,
    delta: item.delta,
    quantityAfter: item.quantityAfter,
    reason: item.reason,
    note: item.note,
    actorName: item.actorName,
    createdAt: item.createdAt.toISOString(),
  }));
}

function back(form: FormData, extra: string): never {
  const to = String(form.get("back") ?? "/inventory");
  const safe = to.startsWith("/inventory") ? to : "/inventory";
  redirect(`${safe}${safe.includes("?") ? "&" : "?"}${extra}`);
}

/** One form per row: "add", "remove" or "set the count to", with a reason. */
export async function adjustAction(variantId: string, form: FormData): Promise<void> {
  const s = await requireAction("products", "edit");
  const mode = String(form.get("mode") ?? "add");
  const n = Number(String(form.get("amount") ?? "").trim());
  const reason = String(form.get("reason") ?? "RECOUNT");
  const note = String(form.get("note") ?? "");
  try {
    if (!Number.isFinite(n)) throw new DomainError("VALIDATION_ERROR", "Enter a number", 400);
    const input = mode === "set" ? { setTo: n, reason, note } : mode === "remove" ? { delta: -n, reason, note } : { delta: n, reason, note };
    await adjustStock(s.tenantId, s.actor, variantId, input);
  } catch (e) {
    if (e instanceof DomainError) back(form, `err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/");
  back(form, "ok=1");
}

export async function stockSettingsAction(variantId: string, form: FormData): Promise<void> {
  const s = await requireAction("products", "edit");
  try {
    await updateStockSettings(s.tenantId, s.actor, variantId, { reorderLevel: Number(form.get("reorder")), shelfCode: String(form.get("shelf") ?? "") || null });
  } catch (e) {
    if (e instanceof DomainError) back(form, `err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/inventory");
  back(form, "ok=1");
}
