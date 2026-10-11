"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, deleteZone, saveCourierRates, saveZone } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface ZoneState { error?: string }

export async function saveZoneAction(zoneId: string | null, _prev: ZoneState, f: FormData): Promise<ZoneState> {
  const s = await requireAction("orders", "edit");
  const free = String(f.get("freeOverAmount") ?? "").replace(/,/g, "").trim();
  const allOther = f.get("allOther") === "on";
  try {
    await saveZone(s.tenantId, s.actor, {
      name: String(f.get("name") ?? ""), districts: allOther ? ["*"] : f.getAll("districts").map(String), rate: Number(String(f.get("rate") ?? "").replace(/,/g, "")),
      freeOverAmount: free === "" ? null : Number(free), etaMinDays: Number(f.get("etaMinDays")), etaMaxDays: Number(f.get("etaMaxDays")),
    }, zoneId ?? undefined);
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
  revalidatePath("/settings/shipping");
  redirect("/settings/shipping?saved=1");
}

export async function deleteZoneAction(id: string): Promise<void> {
  const s = await requireAction("orders", "edit");
  await deleteZone(s.tenantId, s.actor, id);
  revalidatePath("/settings/shipping");
  redirect("/settings/shipping?deleted=1");
}

/** What the courier charges you, used to check payout statements and to estimate profit. Not what customers pay. */
export async function saveRatesAction(f: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  const n = (k: string) => Number(String(f.get(k) ?? "").replace(/,/g, ""));
  try {
    await saveCourierRates(s.tenantId, s.actor, { inside: n("inside"), outside: n("outside"), codPercent: n("codPercent"), defaultCourier: String(f.get("defaultCourier") ?? "") || null });
  } catch (e) {
    if (e instanceof DomainError) redirect(`/settings/shipping?err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/settings/shipping");
  redirect("/settings/shipping?rates=1");
}
