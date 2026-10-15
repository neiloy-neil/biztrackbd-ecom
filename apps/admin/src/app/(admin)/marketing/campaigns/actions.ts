"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DomainError,
  sendBroadcastCampaign,
  cancelCampaign,
  estimateAudience,
  type CampaignChannel,
  type CampaignSegment,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export async function sendCampaignAction(form: FormData): Promise<void> {
  const s = await requireAction("marketing", "edit");
  const name = String(form.get("name") ?? "").trim();
  const channel = (form.get("channel") ?? "SMS") as CampaignChannel;
  const targetSegment = (form.get("targetSegment") ?? "ALL") as CampaignSegment;
  const subject = String(form.get("subject") ?? "").trim() || undefined;
  const body = String(form.get("body") ?? "").trim();
  const mediaUrl = String(form.get("mediaUrl") ?? "").trim() || undefined;
  const couponCode = String(form.get("couponCode") ?? "").trim() || undefined;
  const scheduledForRaw = String(form.get("scheduledFor") ?? "").trim();
  const scheduledFor = scheduledForRaw ? new Date(scheduledForRaw) : undefined;

  try {
    const res = await sendBroadcastCampaign(s.tenantId, s.actor, {
      name,
      channel,
      targetSegment,
      subject,
      body,
      mediaUrl,
      couponCode,
      scheduledFor,
    });

    revalidatePath("/marketing/campaigns");
    revalidatePath("/marketing/whatsapp");
    revalidatePath("/marketing");

    const statusParam = res.status === "SCHEDULED" ? "scheduled" : "sent";
    redirect(`/marketing/campaigns?ok=${statusParam}`);
  } catch (err: unknown) {
    if ((err as any)?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    const msg = err instanceof DomainError ? err.message : (err as Error)?.message || "Failed to send campaign";
    redirect(`/marketing/campaigns?err=${encodeURIComponent(msg)}`);
  }
}

export async function cancelCampaignAction(campaignId: string): Promise<{ success: boolean; error?: string }> {
  const s = await requireAction("marketing", "edit");
  try {
    const res = await cancelCampaign(s.tenantId, s.actor, campaignId);
    revalidatePath("/marketing/campaigns");
    revalidatePath("/marketing/whatsapp");
    return res;
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to cancel campaign",
    };
  }
}

export async function estimateAudienceAction(
  channel: CampaignChannel,
  segment: CampaignSegment,
  messageText = ""
): Promise<{ count: number; credits: number; isUnicode: boolean; parts: number; estimatedSeconds: number }> {
  const s = await requireAction("marketing", "view");
  return estimateAudience(s.tenantId, s.actor, channel, segment, messageText);
}
