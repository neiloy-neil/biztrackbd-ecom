"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, rejectPayment, verifyPayment } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

const REASONS = ["Not in my bKash history", "Not in my Nagad history", "The amount is less than the order total", "The TrxID is wrong"];
const next = (id: string | null) => (id ? `?o=${encodeURIComponent(id)}` : "");

function done(nextId: string | null, msg: string): never {
  revalidatePath("/orders");
  revalidatePath("/orders/check");
  revalidatePath("/");
  redirect(`/orders/check${next(nextId)}${nextId ? "&" : "?"}msg=${encodeURIComponent(msg)}`);
}

/** "It is in my bKash": the payment is confirmed and the next one opens. */
export async function confirmPaymentAction(id: string, nextId: string | null, orderNumber: string): Promise<void> {
  const s = await requireAction("orders", "edit");
  try {
    await verifyPayment(s.tenantId, s.actor, id);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/orders/check?o=${encodeURIComponent(id)}&err=${encodeURIComponent(e.message)}`);
    throw e;
  }
  done(nextId, `confirmed:${orderNumber}`);
}

/** "Not found": the customer is told the payment did not arrive (the reason is kept on the order) and the next one opens. */
export async function rejectPaymentAction(id: string, nextId: string | null, orderNumber: string, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  const picked = String(form.get("reason") ?? "");
  const typed = String(form.get("other") ?? "").trim();
  const reason = typed || (REASONS.includes(picked) ? picked : "");
  try {
    await rejectPayment(s.tenantId, s.actor, id, reason);
  } catch (e) {
    if (e instanceof DomainError) redirect(`/orders/check?o=${encodeURIComponent(id)}&err=${encodeURIComponent(e.message)}&reject=1`);
    throw e;
  }
  done(nextId, `rejected:${orderNumber}`);
}
