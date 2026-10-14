"use server";

import { revalidatePath } from "next/cache";
import { DomainError, saveBannerSettings } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface BannerFormState {
  ok?: boolean;
  error?: string;
}

export async function saveBannerAction(
  _prev: BannerFormState,
  formData: FormData
): Promise<BannerFormState> {
  const s = await requireAction("marketing", "edit");

  const announcement = String(formData.get("announcement") ?? "").trim() || null;
  const announcementBn =
    String(formData.get("announcementBn") ?? "").trim() || null;
  const flashSaleActive = formData.get("flashSaleActive") === "on";
  const flashSaleEndsAtRaw = String(formData.get("flashSaleEndsAt") ?? "").trim();
  const flashSaleEndsAt = flashSaleEndsAtRaw
    ? new Date(flashSaleEndsAtRaw)
    : null;
  const flashSaleCoupon =
    String(formData.get("flashSaleCoupon") ?? "").trim().toUpperCase() || null;

  try {
    await saveBannerSettings(s.tenantId, s.actor, {
      announcement,
      announcementBn,
      flashSaleActive,
      flashSaleEndsAt,
      flashSaleCoupon,
    });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }

  revalidatePath("/marketing/banner");
  revalidatePath("/marketing");
  revalidatePath("/settings/store");
  return { ok: true };
}
