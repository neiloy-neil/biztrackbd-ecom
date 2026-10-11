"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DomainError,
  addTenantNote,
  changePlan,
  createImpersonationTicket,
  extendTrial,
  reactivateTenant,
  reviewQuarantine,
  suspendTenant,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

async function run(
  id: string,
  area: "suspend" | "adjust" | "tenants",
  fn: (actor: Awaited<ReturnType<typeof requireAction>>["actor"]) => Promise<unknown>,
  done: string,
): Promise<never> {
  const s = await requireAction(area, area === "tenants" ? "view" : "edit");
  try {
    await fn(s.actor);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/tenants/${id}?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath(`/tenants/${id}`);
  redirect(`/tenants/${id}?done=${done}`);
}

export async function suspendAction(id: string, form: FormData): Promise<void> {
  await run(id, "suspend", (a) => suspendTenant(a, id, String(form.get("reason") ?? "")), "suspended");
}

export async function reactivateAction(id: string): Promise<void> {
  await run(id, "suspend", (a) => reactivateTenant(a, id), "reactivated");
}

export async function extendAction(id: string, form: FormData): Promise<void> {
  await run(id, "adjust", (a) => extendTrial(a, id, Number(form.get("days"))), "extended");
}

export async function planAction(id: string, form: FormData): Promise<void> {
  await run(id, "adjust", (a) => changePlan(a, id, String(form.get("tier")) as "STARTER" | "PRO" | "BUSINESS"), "plan");
}

export async function quarantineAction(id: string, decision: "APPROVE" | "SUSPEND", form: FormData): Promise<void> {
  await run(id, "suspend", (a) => reviewQuarantine(a, id, decision, String(form.get("note") ?? "")), decision === "APPROVE" ? "approved" : "suspended");
}

export async function addNoteAction(id: string, form: FormData): Promise<void> {
  await run(id, "tenants", (a) => addTenantNote(a, id, String(form.get("body") ?? "")), "noted");
}

export async function impersonateAction(id: string): Promise<never> {
  const s = await requireAction("tenants", "edit");
  const ticket = await createImpersonationTicket(s.actor, id);
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3000";
  redirect(`${adminUrl}/api/auth/impersonate?ticket=${encodeURIComponent(ticket)}`);
}
