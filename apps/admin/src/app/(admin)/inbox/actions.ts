"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, closeContact, replyToContact } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

/** Answers by SMS. A refusal goes back to the inbox with the reason on top. */
export async function replyAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("customers", "edit");
  try {
    await replyToContact(s.tenantId, s.actor, id, String(form.get("text") ?? ""));
  } catch (e) {
    if (e instanceof DomainError) redirect(`/inbox?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/inbox");
  redirect("/inbox?replied=1");
}

export async function closeAction(id: string): Promise<void> {
  const s = await requireAction("customers", "edit");
  try {
    await closeContact(s.tenantId, s.actor, id);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/inbox?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/inbox");
  redirect("/inbox?closed=1");
}
