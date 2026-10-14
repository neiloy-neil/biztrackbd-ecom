"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DomainError,
  closeContact,
  replyToContact,
  sendStaffWhatsAppReply,
  setWhatsAppConversationStatus,
  getWhatsAppConversation,
  type WhatsAppConversationStatus,
} from "@biztrackbd/core";
import { requireAction, requireAccess } from "@/lib/session";

/** Answers by SMS. A refusal goes back to the inbox with the reason on top. */
export async function replyAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("customers", "edit");
  try {
    await replyToContact(s.tenantId, s.actor, id, String(form.get("text") ?? ""));
  } catch (e) {
    if (e instanceof DomainError) redirect(`/inbox?channel=web&err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/inbox");
  redirect("/inbox?channel=web&replied=1");
}

export async function closeAction(id: string): Promise<void> {
  const s = await requireAction("customers", "edit");
  try {
    await closeContact(s.tenantId, s.actor, id);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/inbox?channel=web&err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/inbox");
  redirect("/inbox?channel=web&closed=1");
}

/** Sends a manual staff reply in the WhatsApp Live Desk */
export async function sendStaffWhatsAppReplyAction(conversationId: string, text: string) {
  const s = await requireAction("customers", "edit");
  const msg = await sendStaffWhatsAppReply(s.tenantId, conversationId, s.user.id, text);
  revalidatePath("/inbox");
  return { success: true, message: msg };
}

/** Updates conversation state (OPEN, BOT_HANDLED, RESOLVED) */
export async function setWhatsAppConversationStatusAction(
  conversationId: string,
  status: WhatsAppConversationStatus
) {
  const s = await requireAction("customers", "edit");
  await setWhatsAppConversationStatus(s.tenantId, conversationId, status);
  revalidatePath("/inbox");
  return { success: true };
}

/** Fetches full chat history and customer context for selected conversation */
export async function getWhatsAppConversationDetailAction(conversationId: string) {
  const s = await requireAccess("customers");
  const conv = await getWhatsAppConversation(s.tenantId, conversationId);
  return conv;
}
