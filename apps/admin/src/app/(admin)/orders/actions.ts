"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, bookCouriers, bulkChangeStatus, markPacked } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

/** Bulk "Mark as packed" from the orders list. Returns to the list with a short result in the address. */
export async function bulkPackAction(form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  const ids = form.getAll("ids").map(String).filter(Boolean);
  const back = String(form.get("back") ?? "/orders");
  const safeBack = back.startsWith("/orders") ? back : "/orders";
  if (ids.length === 0) redirect(`${safeBack}${safeBack.includes("?") ? "&" : "?"}msg=none`);
  const r = await markPacked(s.tenantId, s.actor, ids);
  revalidatePath("/orders");
  revalidatePath("/");
  redirect(`${safeBack}${safeBack.includes("?") ? "&" : "?"}msg=packed-${r.done.length}-${r.skipped.length}`);
}

/** Books every selected order with one courier. Orders that cannot be booked (not confirmed, held, unpaid) are skipped and counted. */
export async function bulkBookAction(form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  const ids = form.getAll("ids").map(String).filter(Boolean);
  const back = String(form.get("back") ?? "/orders");
  const safeBack = back.startsWith("/orders") ? back : "/orders";
  const sep = safeBack.includes("?") ? "&" : "?";
  if (ids.length === 0) redirect(`${safeBack}${sep}msg=none`);
  const r = await bookCouriers(s.tenantId, s.actor, ids, { provider: String(form.get("provider") ?? "") });
  revalidatePath("/orders");
  revalidatePath("/");
  const why = r.skipped[0]?.reason ? `&why=${encodeURIComponent(r.skipped[0].reason.slice(0, 120))}` : "";
  redirect(`${safeBack}${sep}msg=booked-${r.done.length}-${r.skipped.length}${why}`);
}

async function bulkStatus(form: FormData, to: "CONFIRMED" | "CANCELLED"): Promise<void> {
  const s = await requireAction("orders", "edit");
  const ids = form.getAll("ids").map(String).filter(Boolean);
  const back = String(form.get("back") ?? "/orders");
  const safeBack = back.startsWith("/orders") ? back : "/orders";
  const sep = safeBack.includes("?") ? "&" : "?";
  if (ids.length === 0) redirect(`${safeBack}${sep}msg=none`);
  let r;
  try {
    r = await bulkChangeStatus(s.tenantId, s.actor, ids, to, String(form.get("reason") ?? ""));
  } catch (e) {
    if (e instanceof DomainError) redirect(`${safeBack}${sep}msg=failed&why=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/orders");
  revalidatePath("/");
  redirect(`${safeBack}${sep}msg=${to === "CANCELLED" ? "cancelled" : "confirmed"}-${r.done.length}-${r.skipped.length}`);
}

/** Confirm every selected order. */
export async function bulkConfirmAction(form: FormData): Promise<void> {
  await bulkStatus(form, "CONFIRMED");
}

/** Cancel every selected order. Needs a reason, typed once for all of them. */
export async function bulkCancelAction(form: FormData): Promise<void> {
  await bulkStatus(form, "CANCELLED");
}
