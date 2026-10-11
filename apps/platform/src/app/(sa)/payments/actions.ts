"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, approveSubscriptionPayment, rejectSubscriptionPayment } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export async function approveAction(id: string): Promise<void> {
  const s = await requireAction("payments", "edit");
  try {
    await approveSubscriptionPayment(s.actor, id);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/payments?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/payments");
  redirect("/payments?done=approved");
}

export async function rejectAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("payments", "edit");
  try {
    await rejectSubscriptionPayment(s.actor, id, String(form.get("reason") ?? ""));
  } catch (e) {
    if (e instanceof DomainError) redirect(`/payments?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/payments");
  redirect("/payments?done=rejected");
}
