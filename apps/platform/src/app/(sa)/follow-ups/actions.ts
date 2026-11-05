"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, cancelFollowUp, completeFollowUp } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

/** Only a path inside this screen is allowed as the place to return to. */
const back = (form: FormData) => {
  const to = String(form.get("back") ?? "");
  return to.startsWith("/follow-ups") ? to : "/follow-ups";
};

export async function completeFromQueueAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("tenants", "view");
  const to = back(form);
  try {
    await completeFollowUp(s.actor, id, String(form.get("outcome") ?? ""));
  } catch (e) {
    if (e instanceof DomainError) redirect(`${to}${to.includes("?") ? "&" : "?"}err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/follow-ups");
  redirect(to);
}

export async function removeFromQueueAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("tenants", "view");
  const to = back(form);
  await cancelFollowUp(s.actor, id);
  revalidatePath("/follow-ups");
  redirect(to);
}
