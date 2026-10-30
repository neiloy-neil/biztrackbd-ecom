"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, checkPlatformDomain, confirmDomainVerified } from "@biztrackbd/core";
import { getPlatformPrisma, withTenant } from "@biztrackbd/db";
import { requireAction } from "@/lib/session";

export async function checkDomainAction(id: string): Promise<void> {
  const s = await requireAction("tenants", "view");
  try {
    await checkPlatformDomain(s.actor, id);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/domains?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/domains");
  redirect("/domains?done=checked");
}

export async function forceConnectDomainAction(id: string): Promise<void> {
  await requireAction("tenants", "edit");
  const db = getPlatformPrisma();
  const d = await db.domain.findUnique({ where: { id } });
  if (!d) return;
  await confirmDomainVerified(d.tenantId, d.domain);
  await withTenant(d.tenantId, async (tx) => {
    await tx.domain.update({
      where: { id: d.id },
      data: { verified: true, dnsStatus: "verified", sslStatus: "issued", dnsNote: null, lastCheckedAt: new Date() },
    });
  });
  revalidatePath("/domains");
  redirect("/domains?done=verified");
}
