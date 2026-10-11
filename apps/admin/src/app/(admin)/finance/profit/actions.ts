"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, addExpense, deleteExpense } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

function back(range: string, extra: Record<string, string> = {}): never {
  redirect(`/finance/profit?${new URLSearchParams({ range, ...extra }).toString()}`);
}

export async function addExpenseAction(range: string, form: FormData): Promise<void> {
  const s = await requireAction("reports", "edit");
  const amount = Number(String(form.get("amount") ?? "").replace(/,/g, ""));
  try {
    await addExpense(s.tenantId, s.actor, { category: String(form.get("category") ?? ""), amount, incurredOn: String(form.get("incurredOn") ?? ""), note: String(form.get("note") ?? "") || undefined });
  } catch (e) {
    if (e instanceof DomainError) back(range, { err: e.message });
    throw e;
  }
  revalidatePath("/finance/profit");
  back(range, { done: "added" });
}

export async function deleteExpenseAction(range: string, id: string): Promise<void> {
  const s = await requireAction("reports", "edit");
  try {
    await deleteExpense(s.tenantId, s.actor, id);
  } catch (e) {
    if (e instanceof DomainError) back(range, { err: e.message });
    throw e;
  }
  revalidatePath("/finance/profit");
  back(range, { done: "deleted" });
}
