"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bookCouriers, markPacked } from "@biztrackbd/core";
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
