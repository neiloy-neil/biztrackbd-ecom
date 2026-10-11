"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, cancelPendingProof, submitPaymentProof } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface ProofState { error?: string }

/** Paying is the way out of read-only, so these two actions are allowed even when everything else is switched off. */
export async function submitProofAction(_prev: ProofState, form: FormData): Promise<ProofState> {
  const s = await requireAction("billing", "edit", { allowReadOnly: true });
  try {
    await submitPaymentProof(s.tenantId, s.actor, {
      plan: String(form.get("plan") ?? ""), interval: String(form.get("interval") ?? ""), provider: String(form.get("provider") ?? ""),
      senderNumber: String(form.get("senderNumber") ?? ""), trxId: String(form.get("trxId") ?? ""), note: String(form.get("note") ?? "") || undefined,
    });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
  revalidatePath("/billing");
  redirect("/billing?sent=1");
}

export async function cancelProofAction(id: string): Promise<void> {
  const s = await requireAction("billing", "edit", { allowReadOnly: true });
  try {
    await cancelPendingProof(s.tenantId, s.actor, id);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/billing?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/billing");
  redirect("/billing?cancelled=1");
}
