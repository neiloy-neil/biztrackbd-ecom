"use server";

import { revalidatePath } from "next/cache";
import {
  createAffiliatePartner,
  updateAffiliatePartner,
  processAffiliatePayout,
  DomainError,
  type CreateAffiliateInput,
  type UpdateAffiliateInput,
} from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";

export interface AffiliateActionState {
  ok: boolean;
  message?: string;
  error?: string;
}

export async function createAffiliatePartnerAction(
  _prev: AffiliateActionState,
  formData: FormData
): Promise<AffiliateActionState> {
  const s = await requireAccess("marketing");
  try {
    const name = (formData.get("name") as string)?.trim();
    const phone = (formData.get("phone") as string)?.trim();
    const email = (formData.get("email") as string)?.trim() || undefined;
    const code = (formData.get("code") as string)?.trim();
    const couponCode = (formData.get("couponCode") as string)?.trim() || undefined;
    const commissionType = formData.get("commissionType") as "PERCENTAGE" | "FLAT";
    const commissionValue = parseFloat(formData.get("commissionValue") as string);
    const payoutMethod = formData.get("payoutMethod") as "BKASH" | "NAGAD" | "ROCKET" | "BANK";
    const payoutAccount = (formData.get("payoutAccount") as string)?.trim() || undefined;
    const notes = (formData.get("notes") as string)?.trim() || undefined;

    if (!name || !phone || !code) {
      return { ok: false, error: "Name, mobile number, and referral code are required." };
    }

    const input: CreateAffiliateInput = {
      name,
      phone,
      email,
      code,
      couponCode,
      commissionType: commissionType || "PERCENTAGE",
      commissionValue: isNaN(commissionValue) ? (commissionType === "FLAT" ? 100 : 10) : commissionValue,
      payoutMethod: payoutMethod || "BKASH",
      payoutAccount,
      notes,
    };

    await createAffiliatePartner(s.tenantId, input);
    revalidatePath("/marketing/affiliates");
    return { ok: true, message: `Affiliate partner "${name}" created successfully.` };
  } catch (err: unknown) {
    if (err instanceof DomainError) return { ok: false, error: err.message };
    const msg = err instanceof Error ? err.message : "Failed to create affiliate partner.";
    return { ok: false, error: msg };
  }
}

export async function updateAffiliatePartnerAction(
  id: string,
  _prev: AffiliateActionState,
  formData: FormData
): Promise<AffiliateActionState> {
  const s = await requireAccess("marketing");
  try {
    const name = (formData.get("name") as string)?.trim();
    const phone = (formData.get("phone") as string)?.trim();
    const email = (formData.get("email") as string)?.trim() || undefined;
    const couponCode = (formData.get("couponCode") as string)?.trim() || undefined;
    const commissionType = formData.get("commissionType") as "PERCENTAGE" | "FLAT";
    const commissionValue = parseFloat(formData.get("commissionValue") as string);
    const status = formData.get("status") as "ACTIVE" | "PAUSED" | "ARCHIVED";
    const payoutMethod = formData.get("payoutMethod") as "BKASH" | "NAGAD" | "ROCKET" | "BANK";
    const payoutAccount = (formData.get("payoutAccount") as string)?.trim() || undefined;
    const notes = (formData.get("notes") as string)?.trim() || undefined;

    const input: UpdateAffiliateInput = {
      name: name || undefined,
      phone: phone || undefined,
      email,
      couponCode,
      commissionType,
      commissionValue: isNaN(commissionValue) ? undefined : commissionValue,
      status,
      payoutMethod,
      payoutAccount,
      notes,
    };

    await updateAffiliatePartner(s.tenantId, id, input);
    revalidatePath("/marketing/affiliates");
    return { ok: true, message: "Affiliate partner updated successfully." };
  } catch (err: unknown) {
    if (err instanceof DomainError) return { ok: false, error: err.message };
    const msg = err instanceof Error ? err.message : "Failed to update affiliate partner.";
    return { ok: false, error: msg };
  }
}

export async function processAffiliatePayoutAction(
  payoutId: string,
  status: "PAID" | "REJECTED",
  trxId?: string,
  notes?: string
): Promise<AffiliateActionState> {
  const s = await requireAccess("marketing");
  try {
    if (status === "PAID" && !trxId?.trim()) {
      return { ok: false, error: "Please provide a valid MFS Transaction ID (TrxID) or Bank Reference." };
    }

    await processAffiliatePayout(s.tenantId, payoutId, {
      status,
      trxId: trxId?.trim(),
      notes: notes?.trim(),
    });

    revalidatePath("/marketing/affiliates");
    return {
      ok: true,
      message: status === "PAID" ? "Payout marked as PAID successfully." : "Payout rejected and balance refunded.",
    };
  } catch (err: unknown) {
    if (err instanceof DomainError) return { ok: false, error: err.message };
    const msg = err instanceof Error ? err.message : "Failed to process payout.";
    return { ok: false, error: msg };
  }
}
