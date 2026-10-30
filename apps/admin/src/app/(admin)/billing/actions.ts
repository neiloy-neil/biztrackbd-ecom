"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, cancelPendingProof, createUddoktaPayCharge, getBillingOverview, submitPaymentProof, getPlatformUddoktaPayCredentials, uddoktaPayPlanUrls, platformOriginFor } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";
import { resolveAdminOrigin } from "@/lib/origin";

export interface ProofState { error?: string }

export async function initiateOnlineBillingAction(plan: string, interval: "MONTHLY" | "YEARLY"): Promise<{ paymentUrl?: string; error?: string }> {
  const s = await requireAction("billing", "edit", { allowReadOnly: true });
  try {
    const b = await getBillingOverview(s.tenantId, s.actor);
    const chosen = b.plans.find((p) => p.tier === plan);
    if (!chosen) return { error: "Invalid plan selected" };

    const amount = interval === "YEARLY" ? chosen.priceYearly : chosen.priceMonthly;
    const origin = resolveAdminOrigin(await headers(), 3001);

    const urls = uddoktaPayPlanUrls(origin, platformOriginFor(process.env.NEXT_PUBLIC_ROOT_DOMAIN));
    const h = await headers();
    const jar = await cookies();
    const platform = await getPlatformUddoktaPayCredentials();
    if (!platform) return { error: "Online payment is not available right now. Please pay by bKash or Nagad and submit your TrxID." };

    const charge = await createUddoktaPayCharge({
      apiKey: platform.apiKey,
      baseUrl: platform.baseUrl,
      fullName: s.actor.name || "Merchant",
      email: s.actor.email || "billing@biztrack.bd",
      amount,
      metadata: {
        tenantId: s.tenantId,
        plan,
        interval,
        type: "subscription",
        // The webhook that activates the plan has no browser, so the Pixel details travel with the charge for the Purchase event.
        ...(jar.get("_fbp")?.value ? { fbp: jar.get("_fbp")!.value.slice(0, 100) } : {}),
        ...(jar.get("_fbc")?.value ? { fbc: jar.get("_fbc")!.value.slice(0, 500) } : {}),
        ...(h.get("x-forwarded-for") ? { ip: h.get("x-forwarded-for")!.split(",")[0]!.trim().slice(0, 64) } : {}),
        ...(h.get("user-agent") ? { ua: h.get("user-agent")!.slice(0, 300) } : {}),
      },
      redirectUrl: urls.returnUrl,
      webhookUrl: urls.webhook,
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
