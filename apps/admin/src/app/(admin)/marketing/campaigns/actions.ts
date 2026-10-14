"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, sendBroadcastCampaign, type CampaignSegment } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export async function sendCampaignAction(form: FormData): Promise<void> {
  const s = await requireAction("marketing", "edit");
  const name = String(form.get("name") ?? "").trim();
  const channel = (form.get("channel") ?? "SMS") as "SMS" | "EMAIL";
  const targetSegment = (form.get("targetSegment") ?? "ALL") as CampaignSegment;
  const subject = String(form.get("subject") ?? "").trim() || undefined;
  const body = String(form.get("body") ?? "").trim();

  try {
    await sendBroadcastCampaign(s.tenantId, s.actor, {
      name,
      channel,
      targetSegment,
      subject,
      body,
    });
  } catch (err: unknown) {
    const msg = err instanceof DomainError ? err.message : (err as Error)?.message || "Failed to send campaign";
    redirect(`/marketing/campaigns?err=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/marketing/campaigns");
  revalidatePath("/marketing");
  redirect("/marketing/campaigns?ok=sent");
}
