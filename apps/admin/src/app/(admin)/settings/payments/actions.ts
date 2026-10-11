"use server";

import { revalidatePath } from "next/cache";
import { DomainError, savePaymentSettings } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface PayState { error?: string; field?: string; ok?: boolean }

const text = (f: FormData, k: string) => String(f.get(k) ?? "");
const kind = (v: string) => (v === "AGENT" || v === "MERCHANT" ? v : "PERSONAL");

/** Owner only. These are the numbers customers send money to, so the change is audited with the numbers. */
export async function savePaymentsAction(_prev: PayState, f: FormData): Promise<PayState> {
  const s = await requireAction("billing", "edit");
  const max = text(f, "codMaxAmount").replace(/,/g, "").trim();
  try {
    await savePaymentSettings(s.tenantId, s.actor, {
      codEnabled: f.get("codEnabled") === "on", codFee: Number(text(f, "codFee").replace(/,/g, "") || 0), codMaxAmount: max === "" ? null : Number(max),
      bkashEnabled: f.get("bkashEnabled") === "on", bkashNumber: text(f, "bkashNumber"), bkashKind: kind(text(f, "bkashKind")), bkashInstruction: text(f, "bkashInstruction"),
      nagadEnabled: f.get("nagadEnabled") === "on", nagadNumber: text(f, "nagadNumber"), nagadKind: kind(text(f, "nagadKind")), nagadInstruction: text(f, "nagadInstruction"),
      paymentNote: text(f, "paymentNote"),
    });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message, field: typeof e.details?.field === "string" ? e.details.field : undefined };
    throw e;
  }
  revalidatePath("/settings/payments");
  return { ok: true };
}
