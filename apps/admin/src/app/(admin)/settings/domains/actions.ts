"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, addDomain, recheckDomain, removeDomain, setPrimaryDomain, checkSubdomainAvailabilityForTenant, changeTenantSubdomain, type SubdomainAvailabilityResult } from "@biztrackbd/core";
import { DEV_TENANT_COOKIE, requireAction } from "@/lib/session";

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


/** Live check for subdomain availability while typing in the subdomain editor. */
export async function checkSubdomainAction(candidate: string): Promise<SubdomainAvailabilityResult> {
  const s = await requireAction("billing", "view");
  return checkSubdomainAvailabilityForTenant(s.tenantId, candidate);
}

/** Update the store's default *.biztrack.bd subdomain. */
export async function changeSubdomainAction(f: FormData): Promise<void> {
  const s = await requireAction("billing", "edit");
  const newSubdomain = String(f.get("subdomain") ?? "").trim();
  try {
    const res = await changeTenantSubdomain(s.tenantId, s.actor, newSubdomain);
    if (process.env.DEV_AUTH === "1" && process.env.NODE_ENV !== "production") {
      const jar = await cookies();
      jar.set(DEV_TENANT_COOKIE, res.newSubdomain, { httpOnly: true, sameSite: "lax", path: "/" });
    }
  } catch (e) {
    if (e instanceof DomainError) back({ err: e.message });
    throw e;
  }
  revalidatePath("/settings/domains");
  revalidatePath("/settings/store");
  revalidatePath("/");
  back({ done: "subdomain_changed" });
}
