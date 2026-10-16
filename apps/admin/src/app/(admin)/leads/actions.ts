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
    session.actor,
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
    session.actor,
    bookingId,
    status,
    notes
  );
  revalidatePath("/leads");
  return { ok: true };
}
