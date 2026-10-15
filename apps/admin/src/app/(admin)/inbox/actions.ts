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
  assignWhatsAppConversation,
  setWhatsAppBotPause,
  listTenantStaffUsers,
  listSupportQuickReplies,
  createSupportQuickReply,
  updateSupportQuickReply,
  deleteSupportQuickReply,
  resetSupportQuickRepliesToDefault,
  quickConfirmOrderFromDesk,
  sendOrderTrackingFromDesk,
  sendOrderPaymentDetailsFromDesk,
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

/** Assigns or reassigns conversation to a staff member (or unassigns with null) */
export async function assignWhatsAppConversationAction(
  conversationId: string,
  staffUserId: string | null
) {
  const s = await requireAction("customers", "edit");
  const updated = await assignWhatsAppConversation(s.tenantId, conversationId, staffUserId);
  revalidatePath("/inbox");
  return { success: true, conversation: updated };
}

/** Manually toggles bot pause state on an individual conversation */
export async function toggleWhatsAppBotPauseAction(conversationId: string, isPaused: boolean) {
  const s = await requireAction("customers", "edit");
  await setWhatsAppBotPause(s.tenantId, conversationId, isPaused);
  revalidatePath("/inbox");
  return { success: true };
}

/** Fetches list of active staff users */
export async function listStaffUsersAction() {
  const s = await requireAccess("customers");
  return listTenantStaffUsers(s.tenantId);
}

/** Lists canned quick replies */
export async function listSupportQuickRepliesAction() {
  const s = await requireAccess("customers");
  return listSupportQuickReplies(s.tenantId);
}

/** Creates or updates a canned quick reply */
export async function saveSupportQuickReplyAction(
  id: string | null,
  input: {
    shortcut: string;
    title: string;
    body: string;
    category?: string;
    sortOrder?: number;
  }
) {
  const s = await requireAction("customers", "edit");
  if (id) {
    const updated = await updateSupportQuickReply(s.tenantId, id, input);
    return { success: true, item: updated };
  } else {
    const created = await createSupportQuickReply(s.tenantId, input);
    return { success: true, item: created };
  }
}

/** Deletes a canned quick reply */
export async function deleteSupportQuickReplyAction(id: string) {
  const s = await requireAction("customers", "edit");
  await deleteSupportQuickReply(s.tenantId, id);
  return { success: true };
}

/** Resets quick replies back to Bangladeshi defaults */
export async function resetSupportQuickRepliesAction() {
  const s = await requireAction("customers", "edit");
  const list = await resetSupportQuickRepliesToDefault(s.tenantId);
  return { success: true, list };
}

/** 1-Click order confirmation from Support Desk */
export async function quickConfirmOrderAction(conversationId: string, orderId: string) {
  const s = await requireAction("customers", "edit");
  const msg = await quickConfirmOrderFromDesk(s.tenantId, conversationId, orderId, s.user.id);
  revalidatePath("/inbox");
  return { success: true, message: msg };
}

/** 1-Click tracking dispatch from Support Desk */
export async function sendOrderTrackingAction(conversationId: string, orderId: string) {
  const s = await requireAction("customers", "edit");
  const msg = await sendOrderTrackingFromDesk(s.tenantId, conversationId, orderId, s.user.id);
  revalidatePath("/inbox");
  return { success: true, message: msg };
}

/** 1-Click payment details dispatch from Support Desk */
export async function sendOrderPaymentDetailsAction(conversationId: string, orderId: string) {
  const s = await requireAction("customers", "edit");
  const msg = await sendOrderPaymentDetailsFromDesk(s.tenantId, conversationId, orderId, s.user.id);
  revalidatePath("/inbox");
  return { success: true, message: msg };
}
