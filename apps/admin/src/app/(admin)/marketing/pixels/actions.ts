"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, savePixelId, sendTestEvent } from "@biztrackbd/core";
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
