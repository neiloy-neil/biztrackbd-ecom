"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, addDomain, recheckDomain, removeDomain, setPrimaryDomain } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

const back = (params: Record<string, string>): never => redirect(`/settings/domains?${new URLSearchParams(params)}`);

export async function addDomainAction(f: FormData): Promise<void> {
  const s = await requireAction("billing", "edit");
  try {
    const row = await addDomain(s.tenantId, s.actor, String(f.get("domain") ?? ""));
    // The first look happens at once, so the owner sees the record to create and whether it is already in place.
    await recheckDomain(s.tenantId, s.actor, row.id).catch(() => null);
  } catch (e) {
    if (e instanceof DomainError) back({ err: e.message });
    throw e;
  }
  revalidatePath("/settings/domains");
  back({ done: "added" });
}

/** Called by the page itself while a domain is still connecting, and by the "Check now" button. Limited to once every 15 seconds per domain. */
export async function recheckDomainAction(domainId: string): Promise<{ ok: boolean }> {
  const s = await requireAction("billing", "edit");
  try {
    await recheckDomain(s.tenantId, s.actor, domainId);
    return { ok: true };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false };
    throw e;
  }
}

export async function makePrimaryAction(domainId: string): Promise<void> {
  const s = await requireAction("billing", "edit");
  try {
    await setPrimaryDomain(s.tenantId, s.actor, domainId);
  } catch (e) {
    if (e instanceof DomainError) back({ err: e.message });
    throw e;
  }
  revalidatePath("/settings/domains");
  back({ done: "primary" });
}

export async function removeDomainAction(domainId: string): Promise<void> {
  const s = await requireAction("billing", "edit");
  if (s.actor.isImpersonator) {
    back({ err: "Removing custom domains is prohibited during super admin impersonation." });
  }
  try {
    await removeDomain(s.tenantId, s.actor, domainId);
  } catch (e) {
    if (e instanceof DomainError) back({ err: e.message });
    throw e;
  }
  revalidatePath("/settings/domains");
  back({ done: "removed" });
}

/** The "Check now" button: looks again, then shows the page with the newest answer. */
export async function checkNowAction(domainId: string): Promise<void> {
  await requireAction("billing", "edit");
  await recheckDomainAction(domainId);
  revalidatePath("/settings/domains");
  back({ done: "checked" });
}
