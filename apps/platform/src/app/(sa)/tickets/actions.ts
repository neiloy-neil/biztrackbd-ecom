"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { replyPlatformTicket, updateTicketStatus, type TicketStatusType } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";

export async function replyTicketAction(formData: FormData) {
  const s = await requireAccess("tickets", "edit");

  const ticketId = String(formData.get("ticketId") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const isInternal = formData.get("isInternal") === "true";
  const newStatus = (formData.get("newStatus") as TicketStatusType | null) ?? (isInternal ? undefined : "WAITING_ON_TENANT");

  if (!ticketId || !body) {
    redirect(`/tickets?id=${ticketId}&err=Message+cannot+be+empty`);
  }

  try {
    await replyPlatformTicket(s.actor, {
      ticketId,
      body,
      isInternal,
      newStatus,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reply to ticket";
    redirect(`/tickets?id=${ticketId}&err=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/tickets");
  redirect(`/tickets?id=${ticketId}`);
}

export async function updateTicketStatusAction(formData: FormData) {
  const s = await requireAccess("tickets", "edit");
  const ticketId = String(formData.get("ticketId") || "").trim();
  const status = formData.get("status") as TicketStatusType;

  if (!ticketId || !status) return;

  await updateTicketStatus(s.actor, ticketId, status);
  revalidatePath("/tickets");
  redirect(`/tickets?id=${ticketId}`);
}
