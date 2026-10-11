"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, acceptShortPayment, importStatement, raiseDispute, syncCourierStatuses } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

const MAX_FILE = 1_500_000;

function go(params: Record<string, string | number>): never {
  redirect(`/finance/cod?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}`);
}

/** The statement arrives as a file picked in the browser; its text goes straight to the importer and is not kept. */
export async function importAction(form: FormData): Promise<void> {
  const s = await requireAction("reports", "edit");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) go({ err: "Choose the statement file from your courier first." });
  if (file.size > MAX_FILE) go({ err: "That file is too large. Split it into two files." });
  let result;
  try {
    result = await importStatement(s.tenantId, s.actor, {
      courier: String(form.get("courier") ?? ""), invoiceNumber: String(form.get("invoiceNumber") ?? ""), disbursedAt: String(form.get("disbursedAt") ?? ""),
      paymentMethod: String(form.get("paymentMethod") ?? ""), bankAccountLast4: String(form.get("last4") ?? "").trim() || undefined, csv: await file.text(),
    });
  } catch (e) {
    if (e instanceof DomainError) go({ err: e.message });
    console.error("statement import failed", e instanceof Error ? e.name : "unknown");
    go({ err: "Could not read that file. Nothing was changed." });
  }
  revalidatePath("/finance/cod");
  go({ imported: result.invoiceNumber, parcels: result.parcels, matched: result.matched, short: result.shortPaid, returned: result.returned, unmatched: result.unmatched.length, dup: result.duplicates.length, shortfall: result.shortfall });
}

export async function acceptAction(lineId: string): Promise<void> {
  const s = await requireAction("reports", "edit");
  try {
    await acceptShortPayment(s.tenantId, s.actor, lineId);
  } catch (e) {
    if (e instanceof DomainError) go({ err: e.message });
    throw e;
  }
  revalidatePath("/finance/cod");
  go({ done: "accepted" });
}

export async function disputeAction(lineId: string, form: FormData): Promise<void> {
  const s = await requireAction("reports", "edit");
  try {
    await raiseDispute(s.tenantId, s.actor, lineId, String(form.get("note") ?? ""));
  } catch (e) {
    if (e instanceof DomainError) go({ err: e.message });
    throw e;
  }
  revalidatePath("/finance/cod");
  go({ done: "disputed" });
}

/** "Sync couriers now": asks every courier about every parcel that is still out. */
export async function syncNowAction(): Promise<void> {
  const s = await requireAction("orders", "edit");
  const r = await syncCourierStatuses(s.tenantId, { olderThanMinutes: 0, limit: 100 });
  revalidatePath("/finance/cod");
  revalidatePath("/orders");
  go({ done: "synced", checked: r.checked, changed: r.changed, failed: r.failed });
}
