"use server";

import { revalidatePath } from "next/cache";
import {
  assignSiteLead,
  addSiteLeadActivityNote,
  listSiteLeadActivities,
  updateBookingRequestStatus,
  updateSiteLeadStatus,
} from "@biztrackbd/core";
import { getSession } from "@/lib/session";
import type { BookingRequestStatus, LeadActivityType, SiteLeadStatus } from "@biztrackbd/db";

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

export async function assignLeadAction(
  leadId: string,
  assignedToUserId: string | null,
  assignedToUserName?: string | null
) {
  const session = await getSession();
  const updated = await assignSiteLead(
    session.tenantId,
    session.actor,
    leadId,
    assignedToUserId,
    assignedToUserName
  );
  revalidatePath("/leads");
  return { ok: true, data: updated };
}

export async function addLeadActivityNoteAction(
  leadId: string,
  noteText: string,
  activityType: LeadActivityType = "NOTE_ADDED"
) {
  const session = await getSession();
  const activity = await addSiteLeadActivityNote(
    session.tenantId,
    session.actor,
    leadId,
    noteText,
    activityType
  );
  revalidatePath("/leads");
  return { ok: true, data: activity };
}

export async function getLeadActivitiesAction(leadId: string) {
  const session = await getSession();
  const activities = await listSiteLeadActivities(
    session.tenantId,
    session.actor,
    leadId
  );
  return { ok: true, data: activities };
}
