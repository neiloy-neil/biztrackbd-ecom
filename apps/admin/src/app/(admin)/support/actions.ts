"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createTenantTicket, replyTenantTicket, type TicketPriority } from "@biztrackbd/core";
import { getSession } from "@/lib/session";

export async function createTicketAction(formData: FormData) {
  const s = await getSession();
  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const priority = (formData.get("priority") || "NORMAL") as TicketPriority;

  if (!subject || !message) {
    redirect("/support?err=Subject+and+message+are+required");
  }

  let ticketId: string;
  try {
    const res = await createTenantTicket(s.tenantId, s.actor, {
      subject,
      message,
      priority,
    });
    ticketId = res.id;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to open ticket";
    redirect(`/support?err=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/support");
  redirect(`/support/${ticketId}?created=1`);
}

export async function replyTicketAction(formData: FormData) {
  const s = await getSession();
  const ticketId = String(formData.get("ticketId") || "").trim();
  const message = String(formData.get("message") || "").trim();

  if (!ticketId || !message) {
    redirect(`/support/${ticketId}?err=Message+cannot+be+empty`);
  }

  try {
    await replyTenantTicket(s.tenantId, s.actor, {
      ticketId,
      message,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send reply";
    redirect(`/support/${ticketId}?err=${encodeURIComponent(msg)}`);
  }

  revalidatePath(`/support/${ticketId}`);
  redirect(`/support/${ticketId}`);
}
