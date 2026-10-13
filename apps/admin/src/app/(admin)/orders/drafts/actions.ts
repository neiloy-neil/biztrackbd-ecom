"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, cancelDraftOrder } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export async function cancelDraftAction(id: string): Promise<void> {
  const s = await requireAction("orders", "edit");
  try {
    await cancelDraftOrder(s.tenantId, s.actor, id);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/orders/drafts?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/orders/drafts");
  redirect("/orders/drafts");
}
