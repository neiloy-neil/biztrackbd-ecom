"use server";

import { revalidatePath } from "next/cache";
import {
  recordTenantCrmActivity,
  updateTenantLeadStage,
  scheduleTenantFollowUp,
  type RecordCrmActivityInput,
} from "@biztrackbd/core";
import type { TenantLeadStage } from "@biztrackbd/db";
import { requireAction } from "@/lib/session";

export async function recordCrmActivityAction(
  tenantId: string,
  input: RecordCrmActivityInput
) {
  const session = await requireAction("tenants", "view");
  const activity = await recordTenantCrmActivity(session.actor, tenantId, input);
  revalidatePath("/tenants");
  revalidatePath(`/tenants/${tenantId}`);
  return { success: true, activity };
}

export async function updateLeadStageAction(
  tenantId: string,
  stage: TenantLeadStage,
  notes?: string
) {
  const session = await requireAction("tenants", "view");
  await updateTenantLeadStage(session.actor, tenantId, stage, notes);
  revalidatePath("/tenants");
  revalidatePath(`/tenants/${tenantId}`);
  return { success: true };
}

export async function scheduleFollowUpAction(
  tenantId: string,
  followUpDateString: string | null,
  notes?: string
) {
  const session = await requireAction("tenants", "view");
  const date = followUpDateString ? new Date(followUpDateString) : null;
  await scheduleTenantFollowUp(session.actor, tenantId, date, notes);
  revalidatePath("/tenants");
  revalidatePath(`/tenants/${tenantId}`);
  return { success: true };
}
