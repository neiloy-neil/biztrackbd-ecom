"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DomainError, addOrderNote, messageCustomer, setCallNote, setOrderTags, blockPhone, bookCourier, holdOrder, isValidAddress, markPacked, markParcelReturned, refreshCourierStatus, refreshOrderFraudReport, rejectPayment, releaseHold, shipManually,
  transitionOrder, updateShippingAddress, verifyPayment,
} from "@biztrackbd/core";
import type { OrderStatus } from "@biztrackbd/db";
import { requireAction } from "@/lib/session";

const STATUS_TARGETS: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED", "REFUNDED"];

function refresh(id: string) {
  revalidatePath(`/orders/${id}`);
  revalidatePath("/orders");
  revalidatePath("/");
}

/** Runs a change, and on a refused change goes back to the order with the reason shown at the top. */
async function run(id: string, fn: () => Promise<unknown>): Promise<never> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof DomainError) redirect(`/orders/${id}?err=${encodeURIComponent(e.message)}`);
    console.error("order action failed", e instanceof Error ? e.name : "unknown");
    redirect(`/orders/${id}?err=${encodeURIComponent("Something went wrong. Nothing was changed.")}`);
  }
  refresh(id);
  redirect(`/orders/${id}`);
}

export async function verifyAction(id: string): Promise<void> {
  const s = await requireAction("orders", "edit");
  await run(id, () => verifyPayment(s.tenantId, s.actor, id));
}

export async function statusAction(id: string, to: string, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  if (!STATUS_TARGETS.includes(to as OrderStatus)) redirect(`/orders/${id}?err=${encodeURIComponent("Unknown status")}`);
  const key = String(form.get("reasonKey") ?? "").trim();
  const note = String(form.get("reasonNote") ?? "").trim();
  const raw = String(form.get("reason") ?? "").trim();
  const reason = (key && note ? `${key}: ${note}` : key || note || raw).slice(0, 150) || undefined;
  await run(id, () =>
    to === "PROCESSING"
      ? markPacked(s.tenantId, s.actor, [id]).then((r) => { if (r.skipped.length) throw new DomainError("CANNOT_PACK", "This order cannot be packed yet. Confirm it first.", 409); })
      : transitionOrder(s.tenantId, id, to as OrderStatus, { type: "MERCHANT", id: s.user.id, name: s.user.name }, reason),
  );
}

export async function recordAdvancePaymentAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  const amount = Number(form.get("amount") ?? 0);
  const method = String(form.get("method") ?? "MANUAL_BKASH") as "MANUAL_BKASH" | "MANUAL_NAGAD" | "MANUAL_ROCKET" | "BANK_TRANSFER";
  const trxId = String(form.get("trxId") ?? "").trim().slice(0, 60) || undefined;
  const { recordAdvancePayment } = await import("@biztrackbd/core");
  await run(id, () => recordAdvancePayment(s.tenantId, s.actor, id, { amount, method, trxId }));
}

export async function shipAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  await run(id, () => shipManually(s.tenantId, s.actor, id, { trackingCode: String(form.get("tracking") ?? "") }));
}

export async function noteAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  await run(id, () => addOrderNote(s.tenantId, s.actor, id, String(form.get("note") ?? "")));
}

export interface RejectState { error?: string }

export async function rejectAction(id: string, _prev: RejectState, form: FormData): Promise<RejectState> {
  const s = await requireAction("orders", "edit");
  try {
    await rejectPayment(s.tenantId, s.actor, id, String(form.get("reason") ?? ""));
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
  refresh(id);
  redirect(`/orders/${id}`);
}

export interface AddressState { error?: string; ok?: boolean }

export async function addressAction(id: string, _prev: AddressState, form: FormData): Promise<AddressState> {
  const s = await requireAction("orders", "edit");
  const division = String(form.get("division") ?? "");
  const district = String(form.get("district") ?? "");
  const area = String(form.get("area") ?? "");
  if (!isValidAddress(division, district, area)) return { error: "Choose the division, district and upazila from the lists." };
  try {
    await updateShippingAddress(s.tenantId, s.actor, id, { name: String(form.get("name") ?? ""), line: String(form.get("line") ?? ""), area, district, division });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
  refresh(id);
  return { ok: true };
}

/** Book the parcel with the chosen courier. The order moves to Shipped when the courier accepts it. */
export async function bookAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  const kg = Number(String(form.get("weight") ?? "0.5").replace(",", "."));
  await run(id, () =>
    bookCourier(s.tenantId, s.actor, id, {
      provider: String(form.get("provider") ?? ""),
      weightGrams: Number.isFinite(kg) && kg > 0 ? Math.round(kg * 1000) : undefined,
      note: String(form.get("note") ?? "").slice(0, 200),
    }),
  );
}

export async function refreshCourierAction(id: string): Promise<void> {
  const s = await requireAction("orders", "view");
  await run(id, () => refreshCourierStatus(s.tenantId, s.actor, id));
}

export async function refreshFraudAction(id: string): Promise<void> {
  const s = await requireAction("orders", "edit");
  await run(id, () => refreshOrderFraudReport(s.tenantId, s.actor, id));
}

export async function releaseHoldAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  await run(id, () => releaseHold(s.tenantId, s.actor, id, String(form.get("note") ?? "")));
}

export async function holdAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  await run(id, () => holdOrder(s.tenantId, s.actor, id, String(form.get("note") ?? "")));
}

/** "Mark returned" with the one fact the buyer's record needs: did they refuse it at the door? */
export async function returnedAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  await run(id, () => markParcelReturned(s.tenantId, s.actor, id, { refused: form.get("refused") === "on", note: String(form.get("reason") ?? "") }));
}

export async function blockAction(id: string, phone: string, form: FormData): Promise<void> {
  const s = await requireAction("customers", "edit");
  await run(id, () => blockPhone(s.tenantId, s.actor, phone, String(form.get("reason") ?? ""), "FRAUD_REVIEW"));
}

/** Labels come in as one comma-separated line, for example: gift, call first. */
export async function tagsAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  await run(id, () => setOrderTags(s.tenantId, s.actor, id, String(form.get("tags") ?? "").split(",")));
}

export async function callNoteAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  await run(id, () => setCallNote(s.tenantId, s.actor, id, String(form.get("callNote") ?? "")));
}

/** An SMS to the customer about this order, in the owner's own words. */
export async function messageAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  await run(id, () => messageCustomer(s.tenantId, s.actor, id, String(form.get("text") ?? "")));
}
