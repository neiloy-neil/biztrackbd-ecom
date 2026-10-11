"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, updatePlan, type PlanPatch } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/,/g, ""));
/** Blank means unlimited. */
const limit = (v: FormDataEntryValue | null): number | null => (String(v ?? "").trim() === "" ? null : num(v));

export async function savePlanAction(tier: string, form: FormData): Promise<void> {
  const s = await requireAction("plans", "edit");
  const patch: PlanPatch = {
    priceMonthlyBdt: num(form.get("priceMonthly")), priceYearlyBdt: num(form.get("priceYearly")), trialDays: num(form.get("trialDays")), isPublic: form.get("isPublic") === "on",
    limits: { products: limit(form.get("products")), ordersPerMonth: limit(form.get("ordersPerMonth")), staff: limit(form.get("staff")), storageGb: limit(form.get("storageGb")), smsCredits: limit(form.get("smsCredits")), landingPages: limit(form.get("landingPages")) },
  };
  try {
    await updatePlan(s.actor, tier, patch);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/plans?err=${encodeURIComponent(`${tier}: ${e.message}`)}`);
    throw e;
  }
  revalidatePath("/plans");
  redirect(`/plans?saved=${tier}`);
}
