"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, adjustPoints, normalizeBdPhone, saveLoyaltySettings } from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { requireAction } from "@/lib/session";

const back = (params: Record<string, string>): never => redirect(`/marketing/loyalty?${new URLSearchParams(params)}`);

export async function saveLoyaltySettingsAction(f: FormData): Promise<void> {
  const s = await requireAction("marketing", "edit");
  try {
    await saveLoyaltySettings(s.tenantId, s.actor, Object.fromEntries(f.entries()));
  } catch (e) {
    if (e instanceof DomainError) back({ err: e.message });
    throw e;
  }
  revalidatePath("/marketing/loyalty");
  back({ done: "saved" });
}

export async function adjustPointsAction(f: FormData): Promise<void> {
  const s = await requireAction("marketing", "edit");
  try {
    let phone: string;
    try {
      phone = normalizeBdPhone(String(f.get("phone") ?? ""));
    } catch {
      return back({ err: "Enter the customer's mobile number, like 01712345678." });
    }
    const customer = await withTenant(s.tenantId, (tx) => tx.customer.findFirst({ where: { phone }, select: { id: true } }));
    if (!customer) return back({ err: "No customer with that number." });
    await adjustPoints(s.tenantId, s.actor, customer.id, Number(String(f.get("points") ?? "").replace(/,/g, "")), String(f.get("reason") ?? ""));
  } catch (e) {
    if (e instanceof DomainError) back({ err: e.message });
    throw e;
  }
  revalidatePath("/marketing/loyalty");
  back({ done: "adjusted" });
}
