"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAnnouncement, type AnnouncementAudience } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";

export async function createAnnouncementAction(formData: FormData) {
  const s = await requireAccess("announcements", "edit");

  const title = String(formData.get("title") || "").trim();
  const titleBn = String(formData.get("titleBn") || "").trim() || null;
  const body = String(formData.get("body") || "").trim();
  const audienceType = String(formData.get("audienceType") || "ALL");
  const audienceValue = String(formData.get("audienceValue") || "").trim();
  const endsAtStr = String(formData.get("endsAt") || "").trim();

  const audience: AnnouncementAudience = {
    type: (["ALL", "PLAN", "INTEGRATION", "TENANT"].includes(audienceType) ? audienceType : "ALL") as AnnouncementAudience["type"],
    value: audienceValue || undefined,
  };

  const endsAt = endsAtStr ? new Date(endsAtStr) : null;

  try {
    await createAnnouncement(s.actor, {
      title,
      titleBn,
      body,
      audience,
      channels: ["BANNER"],
      endsAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create announcement";
    redirect(`/announcements?err=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/announcements");
  redirect("/announcements?saved=1");
}
