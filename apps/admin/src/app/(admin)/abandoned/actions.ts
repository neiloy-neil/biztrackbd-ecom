"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, logCallOutcome, type CallOutcome } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export async function outcomeAction(id: string, tab: string, form: FormData): Promise<void> {
  const s = await requireAction("customers", "edit");
  try {
    await logCallOutcome(s.tenantId, s.actor, id, String(form.get("outcome") ?? "") as Exclude<CallOutcome, "ORDER_CREATED">, String(form.get("note") ?? ""));
  } catch (e) {
    if (e instanceof DomainError) redirect(`/abandoned?tab=${tab}&err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/abandoned");
  redirect(`/abandoned?tab=${tab}&done=logged`);
}
