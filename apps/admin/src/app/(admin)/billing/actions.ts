"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, cancelPendingProof, createUddoktaPayCharge, getBillingOverview, submitPaymentProof } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface ProofState { error?: string }

export async function initiateOnlineBillingAction(plan: string, interval: "MONTHLY" | "YEARLY"): Promise<{ paymentUrl?: string; error?: string }> {
  const s = await requireAction("billing", "edit", { allowReadOnly: true });
  try {
    const b = await getBillingOverview(s.tenantId, s.actor);
    const chosen = b.plans.find((p) => p.tier === plan);
    if (!chosen) return { error: "Invalid plan selected" };

    const amount = interval === "YEARLY" ? chosen.priceYearly : chosen.priceMonthly;
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const origin = `${proto}://${host}`;

    const charge = await createUddoktaPayCharge({
      fullName: s.actor.name || "Merchant",
      email: s.actor.email || "billing@biztrackbd.com",
      amount,
      metadata: {
        tenantId: s.tenantId,
        plan,
        interval,
        type: "subscription",
      },
      redirectUrl: `${origin}/api/billing/uddoktapay/callback`,
      cancelUrl: `${origin}/billing?cancelled=1`,
      returnType: "GET",
    });

    return { paymentUrl: charge.paymentUrl };
  } catch (e) {
    console.error("initiateOnlineBillingAction error", e);
    return { error: e instanceof Error ? e.message : "Failed to initiate online payment" };
  }
}

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
