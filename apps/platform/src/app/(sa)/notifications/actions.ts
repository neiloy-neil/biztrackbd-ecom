"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DomainError, NOTIFY_KINDS, removeNotifyRecipient, saveNotifyRecipient, sendNotifyTest } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

const back = (kind: "ok" | "err", message: string): never => redirect(`/notifications?${kind}=${encodeURIComponent(message)}`);

/** Adds a recipient (no id) or updates one. Each row of the list posts here. */
export async function saveRecipientAction(formData: FormData) {
  const s = await requireAction("settings", "edit");
  const id = String(formData.get("id") ?? "") || null;
  const events = NOTIFY_KINDS.filter((k) => formData.get(`event_${k}`) === "on");
  try {
    await saveNotifyRecipient(s.actor, {
      id,
      email: String(formData.get("email") ?? ""),
      label: String(formData.get("label") ?? ""),
      events,
      active: formData.get("active") === "on",
    });
  } catch (e) {
    if (e instanceof DomainError) back("err", e.message);
    throw e;
  }
  revalidatePath("/notifications");
  back("ok", id ? "Saved." : "Added. They will get emails for the events you ticked.");
}

export async function removeRecipientAction(formData: FormData) {
  const s = await requireAction("settings", "edit");
  try {
    await removeNotifyRecipient(s.actor, String(formData.get("id") ?? ""));
  } catch (e) {
    if (e instanceof DomainError) back("err", e.message);
    throw e;
  }
  revalidatePath("/notifications");
  back("ok", "Removed.");
}

export async function testRecipientAction(formData: FormData) {
  const s = await requireAction("settings", "edit");
  const email = String(formData.get("email") ?? "");
  let result: "sent" | "no_provider";
  try {
    result = await sendNotifyTest(s.actor, email);
  } catch (e) {
    if (e instanceof DomainError) back("err", e.message);
    back("err", "The test email could not be sent. Check the email provider settings of this app.");
    return;
  }
  if (result === "no_provider") back("err", "Email is not set up for this app (BREVO_API_KEY and EMAIL_FROM are missing), so nothing was sent.");
  back("ok", `Test email sent to ${email}. Check the inbox and spam folder.`);
}
