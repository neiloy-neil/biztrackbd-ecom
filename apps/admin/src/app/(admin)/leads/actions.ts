"use server";

import { revalidatePath } from "next/cache";
import { updateBookingRequestStatus, updateSiteLeadStatus } from "@biztrackbd/core";
import { getSession } from "@/lib/session";
import type { BookingRequestStatus, SiteLeadStatus } from "@biztrackbd/db";

export async function updateLeadStatusAction(
  leadId: string,
  status: SiteLeadStatus,
  notes?: string
) {
  const session = await getSession();
  await updateSiteLeadStatus(
    session.tenantId,
    { userId: session.userId, role: session.role as any, email: session.email, name: session.name },
    leadId,
    status,
    notes
  );
  revalidatePath("/leads");
  return { ok: true };
}

export async function updateBookingStatusAction(
  bookingId: string,
  status: BookingRequestStatus,
  notes?: string
) {
  const session = await getSession();
  await updateBookingRequestStatus(
    session.tenantId,
    { userId: session.userId, role: session.role as any, email: session.email, name: session.name },
    bookingId,
    status,
    notes
  );
  revalidatePath("/leads");
  return { ok: true };
}
