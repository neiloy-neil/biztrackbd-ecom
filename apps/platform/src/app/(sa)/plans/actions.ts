"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DomainError,
  updatePlan,
  createSubscriptionPromo,
  toggleSubscriptionPromo,
  deleteSubscriptionPromo,
  type PlanPatch,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/,/g, ""));
/** Blank means unlimited. */
const limit = (v: FormDataEntryValue | null): number | null => (String(v ?? "").trim() === "" ? null : num(v));

const back = (params: Record<string, string>): never => redirect(`/plans?${new URLSearchParams(params)}`);

export async function savePlanAction(tier: string, form: FormData): Promise<void> {
  const s = await requireAction("plans", "edit");
  const patch: PlanPatch = {
    priceMonthlyBdt: num(form.get("priceMonthly")),
    priceYearlyBdt: num(form.get("priceYearly")),
    trialDays: num(form.get("trialDays")),
    isPublic: form.get("isPublic") === "on",
    limits: {
      products: limit(form.get("products")),
      ordersPerMonth: limit(form.get("ordersPerMonth")),
      staff: limit(form.get("staff")),
      storageGb: limit(form.get("storageGb")),
      smsCredits: limit(form.get("smsCredits")),
      landingPages: limit(form.get("landingPages")),
    },
  };
  try {
    await updatePlan(s.actor, tier, patch);
  } catch (e) {
    if (e instanceof DomainError) back({ tab: "plans", err: `${tier}: ${e.message}` });
    throw e;
  }
  revalidatePath("/plans");
  back({ tab: "plans", saved: tier });
}

export async function createPromoAction(form: FormData): Promise<void> {
  const s = await requireAction("plans", "edit");
  const code = String(form.get("code") ?? "").trim();
  const discountType = String(form.get("discountType") ?? "PERCENTAGE") as "PERCENTAGE" | "FIXED_BDT";
  const discountValue = Number(form.get("discountValue") ?? 0);
  const applicableTier = String(form.get("applicableTier") ?? "ALL");
  const billingInterval = String(form.get("billingInterval") ?? "ANY") as "ANY" | "MONTHLY" | "YEARLY";
  const maxUsesStr = String(form.get("maxUses") ?? "").trim();
  const maxUses = maxUsesStr ? parseInt(maxUsesStr, 10) : null;
  const expiryStr = String(form.get("validUntil") ?? "").trim();
  const validUntil = expiryStr ? new Date(expiryStr) : null;

  try {
    await createSubscriptionPromo(s.actor, {
      code,
      discountType,
      discountValue,
      applicableTiers: applicableTier === "ALL" ? ["ALL"] : [applicableTier],
      billingInterval,
      maxUses,
      validUntil,
    });
  } catch (e) {
    if (e instanceof DomainError) back({ tab: "promos", err: e.message });
    throw e;
  }
  revalidatePath("/plans");
  back({ tab: "promos", done: `Promo code ${code.toUpperCase()} created successfully.` });
}

export async function togglePromoAction(promoId: string, isActive: boolean): Promise<void> {
  const s = await requireAction("plans", "edit");
  try {
    await toggleSubscriptionPromo(s.actor, promoId, isActive);
  } catch (e) {
    if (e instanceof DomainError) back({ tab: "promos", err: e.message });
    throw e;
  }
  revalidatePath("/plans");
  back({ tab: "promos", done: isActive ? "Promo code activated." : "Promo code deactivated." });
}

export async function deletePromoAction(promoId: string): Promise<void> {
  const s = await requireAction("plans", "edit");
  try {
    await deleteSubscriptionPromo(s.actor, promoId);
  } catch (e) {
    if (e instanceof DomainError) back({ tab: "promos", err: e.message });
    throw e;
  }
  revalidatePath("/plans");
  back({ tab: "promos", done: "Promo code deleted." });
}
