"use server";

import { revalidatePath } from "next/cache";
import { DomainError, saveInvoiceSettings } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface InvoiceState { ok?: boolean; error?: string }

export async function saveInvoiceAction(_prev: InvoiceState, f: FormData): Promise<InvoiceState> {
  const s = await requireAction("design", "edit");
  try {
    await saveInvoiceSettings(s.tenantId, s.actor, {
      footer: String(f.get("footer") ?? ""), paper: String(f.get("paper") ?? "a4"),
      showLogo: f.get("showLogo") === "on", showSku: f.get("showSku") === "on", showPricesOnSlip: f.get("showPricesOnSlip") === "on",
    });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
  revalidatePath("/settings/invoices");
  return { ok: true };
}
