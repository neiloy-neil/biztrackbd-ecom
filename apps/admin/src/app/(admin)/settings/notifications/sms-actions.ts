"use server";

import { revalidatePath } from "next/cache";
import { DomainError, submitSmsPurchase } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface BuySmsState { error?: string; sent?: boolean }

/** The owner says they have sent the money for a pack of SMS. The platform checks the TrxID and then adds the SMS. The price is worked out on the server. */
export async function buySmsAction(_prev: BuySmsState, form: FormData): Promise<BuySmsState> {
  const s = await requireAction("billing", "edit", { allowReadOnly: true });
  try {
    await submitSmsPurchase(s.tenantId, s.actor, {
      quantity: String(form.get("quantity") ?? ""), provider: String(form.get("provider") ?? ""),
      senderNumber: String(form.get("senderNumber") ?? ""), trxId: String(form.get("trxId") ?? ""),
    });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
  revalidatePath("/settings/notifications");
  revalidatePath("/marketing/notifications");
  return { sent: true };
}
