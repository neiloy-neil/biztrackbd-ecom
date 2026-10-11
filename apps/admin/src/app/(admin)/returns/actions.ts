"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DomainError, approveReturn, createReturn, declineReturn, markPickupBooked, receiveReturn, refundReturn, type ReturnTab, type ReturnType,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

/** Runs a change and returns to the same tab, with the reason shown if it was refused. */
async function run(tab: string, fn: () => Promise<unknown>, done: string): Promise<never> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof DomainError) redirect(`/returns?tab=${tab}&err=${encodeURIComponent(e.message)}`);
    console.error("return action failed", e instanceof Error ? e.name : "unknown");
    redirect(`/returns?tab=${tab}&err=${encodeURIComponent("Something went wrong. Nothing was changed.")}`);
  }
  revalidatePath("/returns");
  revalidatePath("/orders");
  redirect(`/returns?tab=${tab}&done=${done}`);
}

const money = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : undefined;
};

export interface NewReturnState { error?: string }

export async function createReturnAction(orderId: string, _prev: NewReturnState, form: FormData): Promise<NewReturnState> {
  const s = await requireAction("orders", "edit");
  const items = [...form.keys()]
    .filter((k) => k.startsWith("qty_"))
    .map((k) => ({ orderItemId: k.slice(4), qty: Number(form.get(k)) }))
    .filter((i) => Number.isInteger(i.qty) && i.qty > 0);
  const reason = String(form.get("reason") ?? "") === "Other" ? String(form.get("other_reason") ?? "") : String(form.get("reason") ?? "");
  try {
    await createReturn(s.tenantId, s.actor, {
      orderId, reason, note: String(form.get("note") ?? "") || undefined, type: String(form.get("type") ?? "REFUND") as ReturnType, items,
      exchangeVariantId: String(form.get("exchangeVariantId") ?? "") || undefined,
    });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
  revalidatePath("/returns");
  redirect("/returns?tab=requested&done=opened");
}

export async function approveAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  const type = String(form.get("type") ?? "") as ReturnType;
  await run("requested", () => approveReturn(s.tenantId, s.actor, id, {
    type: type || undefined, refundAmount: money(form.get("amount")), exchangeVariantId: String(form.get("exchangeVariantId") ?? "") || undefined, note: String(form.get("note") ?? ""),
  }), "approved");
}

export async function declineAction(id: string, tab: ReturnTab, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  await run(tab, () => declineReturn(s.tenantId, s.actor, id, String(form.get("reason") ?? "")), "declined");
}

export async function pickupAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  await run("approved", () => markPickupBooked(s.tenantId, s.actor, id, String(form.get("tracking") ?? "")), "pickup");
}

export async function receiveAction(id: string, tab: ReturnTab, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  await run(tab, () => receiveReturn(s.tenantId, s.actor, id, { restock: form.get("damaged") !== "on" }), "received");
}

export async function refundAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  const method = String(form.get("method")) === "STORE_CREDIT" ? "STORE_CREDIT" : "BKASH_SEND_MONEY";
  await run("coming_back", () => refundReturn(s.tenantId, s.actor, id, { method, amount: money(form.get("amount")), trxId: String(form.get("trxId") ?? "") || undefined }), "refunded");
}
