"use server";

import { revalidatePath } from "next/cache";
import { saveCampaignAdSpend } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";

export async function updateCampaignSpendAction(
  campaignKey: string,
  spendBdt: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    const s = await requireAccess("marketing");
    await saveCampaignAdSpend(s.tenantId, s.actor, campaignKey, spendBdt);
    revalidatePath("/reports/acquisition");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update ad spend",
    };
  }
}
