"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, savePixelId, saveTrackingConfig, sendTestEvent } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export async function savePixelAction(form: FormData): Promise<void> {
  const s = await requireAction("marketing", "edit");
  try {
    await savePixelId(s.tenantId, s.actor, String(form.get("pixelId") ?? ""));
  } catch (e) {
    if (e instanceof DomainError) redirect(`/marketing/pixels?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/marketing/pixels");
  redirect("/marketing/pixels?done=saved");
}

export async function saveAllTrackingAction(form: FormData): Promise<void> {
  const s = await requireAction("marketing", "edit");
  try {
    await saveTrackingConfig(s.tenantId, s.actor, {
      pixelId: String(form.get("pixelId") ?? ""),
      googleAnalyticsId: String(form.get("googleAnalyticsId") ?? ""),
      googleTagManagerId: String(form.get("googleTagManagerId") ?? ""),
      tiktokPixelId: String(form.get("tiktokPixelId") ?? ""),
      ga4ApiSecret: String(form.get("ga4ApiSecret") ?? ""),
      metaDomainVerification: String(form.get("metaDomainVerification") ?? ""),
      googleSiteVerification: String(form.get("googleSiteVerification") ?? ""),
      googleOAuthClientId: String(form.get("googleOAuthClientId") ?? ""),
      googleOAuthClientSecret: String(form.get("googleOAuthClientSecret") ?? ""),
      googleMerchantCenterId: String(form.get("googleMerchantCenterId") ?? ""),
    });
  } catch (e) {
    if (e instanceof DomainError) redirect(`/marketing/pixels?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/marketing/pixels");
  redirect("/marketing/pixels?done=saved");
}

export async function testEventAction(form: FormData): Promise<void> {
  const s = await requireAction("marketing", "edit");
  try {
    const r = await sendTestEvent(s.tenantId, s.actor, String(form.get("code") ?? ""));
    if (!r.ok) redirect(`/marketing/pixels?err=${encodeURIComponent(`Meta said: ${r.detail}`)}`);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/marketing/pixels?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  redirect("/marketing/pixels?done=tested");
}

export async function sweepOutboxAction(): Promise<void> {
  await requireAction("marketing", "edit");
  try {
    const { processPendingNotificationJobs } = await import("@biztrackbd/core");
    const result = await processPendingNotificationJobs({ limit: 50 });
    revalidatePath("/marketing/pixels/health");
    redirect(
      `/marketing/pixels/health?done=swept&processed=${result.processed}&succeeded=${result.succeeded}&failed=${result.failed}`
    );
  } catch (e) {
    if (e instanceof DomainError) {
      redirect(`/marketing/pixels/health?err=${encodeURIComponent(e.message)}`);
    }
    throw e;
  }
}

