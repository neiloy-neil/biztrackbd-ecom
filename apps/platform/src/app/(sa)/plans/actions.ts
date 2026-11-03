"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DomainError,
  updatePlan,
  createSubscriptionPromo,
  toggleSubscriptionPromo,
  deleteSubscriptionPromo,
  PLAN_FEATURE_FIELDS,
  PLAN_LIMIT_FIELDS,
  type PlanFamily,
  type PlanPatch,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/,/g, ""));
/** Blank means unlimited. */
const limit = (v: FormDataEntryValue | null): number | null => (String(v ?? "").trim() === "" ? null : num(v));

const back = (params: Record<string, string>): never => redirect(`/plans?${new URLSearchParams(params)}`);

export async function savePlanAction(family: PlanFamily, tier: string, form: FormData): Promise<void> {
  const s = await requireAction("plans", "edit");
  const tab = family === "SITE" ? "site" : "plans";
  const limits: Record<string, number | null> = {};
  for (const f of PLAN_LIMIT_FIELDS[family]) limits[f.key] = limit(form.get(`l_${f.key}`));
  const features: Record<string, unknown> = {};
  for (const f of PLAN_FEATURE_FIELDS[family]) {
    const raw = form.get(`f_${f.key}`);
    if (f.kind === "bool") features[f.key] = raw === "on";
    else if (f.kind === "choice") features[f.key] = String(raw ?? "");
    else features[f.key] = String(raw ?? "").trim().toLowerCase() === "all" ? "all" : num(raw);
  }
  const patch: PlanPatch = {
    name: String(form.get("name") ?? ""),
    priceMonthlyBdt: num(form.get("priceMonthly")),
    priceYearlyBdt: num(form.get("priceYearly")),
    trialDays: num(form.get("trialDays")),
    isPublic: form.get("isPublic") === "on",
    limits,
    features,
  };
  try {
    await updatePlan(s.actor, tier, patch, family);
  } catch (e) {
    if (e instanceof DomainError) back({ tab, err: `${tier}: ${e.message}` });
    throw e;
  }
  revalidatePath("/plans");
  back({ tab, saved: tier });
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
