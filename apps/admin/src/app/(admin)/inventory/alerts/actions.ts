"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, removeStockAlerts } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export async function clearAlertsAction(variantId: string): Promise<void> {
  const s = await requireAction("products", "edit");
  try {
    await removeStockAlerts(s.tenantId, s.actor, variantId);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/inventory/alerts?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/inventory/alerts");
  redirect("/inventory/alerts?cleared=1");
}
