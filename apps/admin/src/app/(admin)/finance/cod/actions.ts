"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DomainError,
  acceptShortPayment,
  batchAcceptDiscrepancies,
  importStatement,
  raiseDispute,
  saveCourierRates,
  saveToleranceSettings,
  syncCourierStatuses,
  verifySettlementDeposit,
} from "@biztrackbd/core";
import { getSession, requireAction } from "@/lib/session";

const MAX_FILE = 1_500_000;

function go(params: Record<string, string | number>): never {
  redirect(`/finance/cod?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}`);
}

/** The statement arrives as a file picked in the browser; its text goes straight to the importer and is not kept. */
export async function importAction(form: FormData): Promise<void> {
  if ((await getSession()).demo) go({ err: "Importing a statement is not available in the demo." });
  const s = await requireAction("reports", "edit");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) go({ err: "Choose the statement file from your courier first." });
  if (file.size > MAX_FILE) go({ err: "That file is too large. Split it into two files." });
  let result;
  try {
    result = await importStatement(s.tenantId, s.actor, {
      courier: String(form.get("courier") ?? ""),
      invoiceNumber: String(form.get("invoiceNumber") ?? ""),
      disbursedAt: String(form.get("disbursedAt") ?? ""),
      paymentMethod: String(form.get("paymentMethod") ?? ""),
      bankAccountLast4: String(form.get("last4") ?? "").trim() || undefined,
      csv: await file.text(),
      source: "CSV_IMPORT",
    });
  } catch (e) {
    if (e instanceof DomainError) go({ err: e.message });
    console.error("statement import failed", e instanceof Error ? e.name : "unknown");
    go({ err: "Could not read that file. Nothing was changed." });
  }
  revalidatePath("/finance/cod");
  go({
    imported: result.invoiceNumber,
    parcels: result.parcels,
    matched: result.matched,
    short: result.shortPaid,
    returned: result.returned,
    unmatched: result.unmatched.length,
    dup: result.duplicates.length,
    shortfall: result.shortfall,
  });
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

/** 1-click batch accept short payment variances (e.g. within tolerance). */
export async function batchAcceptAction(form: FormData): Promise<void> {
  const s = await requireAction("reports", "edit");
  const maxShortfallRaw = form.get("maxShortfall");
  const maxShortfall = maxShortfallRaw ? Number(maxShortfallRaw) : undefined;
  try {
    const res = await batchAcceptDiscrepancies(s.tenantId, s.actor, { maxShortfall });
    revalidatePath("/finance/cod");
    go({ done: "batch_accepted", count: res.acceptedCount, amount: res.totalShortfall });
  } catch (e) {
    if (e instanceof DomainError) go({ err: e.message });
    throw e;
  }
}

/** Verifies that a courier payout hit the merchant's bank/bKash account with UTR/TrxID. */
export async function verifyDepositAction(form: FormData): Promise<void> {
  const s = await requireAction("reports", "edit");
  const settlementId = String(form.get("settlementId") ?? "");
  const bankTxnRef = String(form.get("bankTxnRef") ?? "");
  try {
    await verifySettlementDeposit(s.tenantId, s.actor, { settlementId, bankTxnRef });
    revalidatePath("/finance/cod");
    go({ done: "deposit_verified" });
  } catch (e) {
    if (e instanceof DomainError) go({ err: e.message });
    throw e;
  }
}

/** Saves shipping fee rates, COD commission %, tolerance threshold, and return restock guard. */
export async function saveSettingsAction(form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  const inside = Number(form.get("inside") ?? 70);
  const outside = Number(form.get("outside") ?? 130);
  const codPercent = Number(form.get("codPercent") ?? 1);
  const toleranceAmount = Number(form.get("toleranceAmount") ?? 10);
  const autoRestockOnReturn = form.get("autoRestockOnReturn") === "true";
  const defaultCourier = String(form.get("defaultCourier") ?? "").trim() || null;

  try {
    await saveCourierRates(s.tenantId, s.actor, { inside, outside, codPercent, defaultCourier });
    await saveToleranceSettings(s.tenantId, s.actor, { toleranceAmount, autoRestockOnReturn });
    revalidatePath("/finance/cod");
    go({ done: "settings_saved", view: "settings" });
  } catch (e) {
    if (e instanceof DomainError) go({ err: e.message, view: "settings" });
    throw e;
  }
}

/** "Sync couriers now": asks every courier about every parcel that is still out. */
export async function syncNowAction(): Promise<void> {
  const s = await requireAction("orders", "edit");
  const r = await syncCourierStatuses(s.tenantId, { olderThanMinutes: 0, limit: 100 });
  revalidatePath("/finance/cod");
  revalidatePath("/orders");
  go({ done: "synced", checked: r.checked, changed: r.changed, failed: r.failed });
}
