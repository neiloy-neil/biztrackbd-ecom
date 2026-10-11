"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, deleteCoupon, saveCoupon, setCouponActive } from "@biztrackbd/core";
import { isoDay } from "@/lib/format";
import { requireAction } from "@/lib/session";

export interface CouponState { error?: string; field?: string }

const num = (v: FormDataEntryValue | null): number | null => {
  const t = String(v ?? "").trim().replace(/,/g, "");
  return t === "" ? null : Number(t);
};
/** A date picked in the form means that day in Bangladesh. Empty means no date. */
const day = (v: FormDataEntryValue | null, end: boolean): Date | null => {
  const t = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T${end ? "23:59:59" : "00:00:00"}+06:00`) : null;
};

export async function saveCouponAction(couponId: string | null, _prev: CouponState, form: FormData): Promise<CouponState> {
  const s = await requireAction("marketing", "edit");
  try {
    await saveCoupon(s.tenantId, s.actor, {
      code: String(form.get("code") ?? ""), type: String(form.get("type") ?? "PERCENTAGE"), value: num(form.get("value")) ?? 0,
      minOrderValue: num(form.get("minOrderValue")), usageLimit: num(form.get("usageLimit")), perCustomerLimit: num(form.get("perCustomerLimit")) ?? 1,
      startsAt: day(form.get("startsAt"), false) ?? undefined, expiresAt: day(form.get("expiresAt"), true), isActive: true,
    }, couponId ?? undefined);
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message, field: typeof e.details?.field === "string" ? e.details.field : undefined };
    throw e;
  }
  revalidatePath("/marketing/coupons");
  redirect("/marketing/coupons?saved=1");
}

export async function toggleCouponAction(id: string, active: boolean): Promise<void> {
  const s = await requireAction("marketing", "edit");
  await setCouponActive(s.tenantId, s.actor, id, active);
  revalidatePath("/marketing/coupons");
}

export async function deleteCouponAction(id: string): Promise<void> {
  const s = await requireAction("marketing", "edit");
  const r = await deleteCoupon(s.tenantId, s.actor, id);
  revalidatePath("/marketing/coupons");
  redirect(`/marketing/coupons?${r === "deleted" ? "deleted=1" : "disabled=1"}`);
}

export { isoDay };
