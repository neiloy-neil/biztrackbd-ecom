"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, setCustomerBlocked, updateCustomer } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

function fail(id: string, e: unknown): never {
  if (e instanceof DomainError) redirect(`/customers/${id}?err=${encodeURIComponent(e.message)}`);
  throw e;
}

export async function saveCustomerAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("customers", "edit");
  try {
    await updateCustomer(s.tenantId, s.actor, id, {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? "").trim() || null,
      tags: String(form.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      notes: String(form.get("notes") ?? "") || null,
    });
  } catch (e) {
    fail(id, e);
  }
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}?ok=1`);
}

export async function blockAction(id: string, blocked: boolean, form: FormData): Promise<void> {
  const s = await requireAction("customers", "edit");
  try {
    await setCustomerBlocked(s.tenantId, s.actor, id, blocked, String(form.get("reason") ?? ""));
  } catch (e) {
    fail(id, e);
  }
  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  redirect(`/customers/${id}?ok=1`);
}
