"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, bookCourier, shipManually } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

const next = (id: string | null) => (id ? `?o=${encodeURIComponent(id)}` : "");

function done(nextId: string | null, msg: string): never {
  revalidatePath("/orders");
  revalidatePath("/orders/ship");
  revalidatePath("/");
  redirect(`/orders/ship${next(nextId)}${nextId ? "&" : "?"}msg=${encodeURIComponent(msg)}`);
}

function fail(id: string, message: string): never {
  redirect(`/orders/ship?o=${encodeURIComponent(id)}&err=${encodeURIComponent(message)}`);
}

/** Books the parcel with the chosen courier and opens the next order. */
export async function bookDeskAction(id: string, nextId: string | null, orderNumber: string, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  const kg = Number(String(form.get("weight") ?? "0.5").replace(",", "."));
  let booked;
  try {
    booked = await bookCourier(s.tenantId, s.actor, id, { provider: String(form.get("provider") ?? ""), weightGrams: Number.isFinite(kg) && kg > 0 ? Math.round(kg * 1000) : undefined });
  } catch (e) {
    if (e instanceof DomainError) fail(id, e.message);
    throw e;
  }
  done(nextId, `booked:${orderNumber}:${booked.trackingCode}`);
}

/** For a parcel sent by a courier the store has no keys for: write the tracking code by hand. */
export async function shipByHandAction(id: string, nextId: string | null, orderNumber: string, form: FormData): Promise<void> {
  const s = await requireAction("orders", "edit");
  try {
    await shipManually(s.tenantId, s.actor, id, { trackingCode: String(form.get("tracking") ?? "") });
  } catch (e) {
    if (e instanceof DomainError) fail(id, e.message);
    throw e;
  }
  done(nextId, `shipped:${orderNumber}`);
}
