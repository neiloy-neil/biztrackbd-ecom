"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DomainError,
  setCustomerBlocked,
  updateCustomer,
  adjustCustomerStoreCredit,
  adjustPoints,
  sendCustomerDirectSms,
  saveCustomerAddress,
  deleteCustomerAddress,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

function fail(id: string, e: unknown): never {
  if (e instanceof DomainError) redirect(`/customers/${id}?err=${encodeURIComponent(e.message)}`);
  throw e;
}

export async function saveCustomerAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("customers", "edit");
  try {
    const rawMonth = form.get("birthMonth");
    const rawDay = form.get("birthDay");
    const birthMonth = rawMonth && String(rawMonth).trim() ? Number(rawMonth) : null;
    const birthDay = rawDay && String(rawDay).trim() ? Number(rawDay) : null;

    await updateCustomer(s.tenantId, s.actor, id, {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? "").trim() || null,
      tags: String(form.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      notes: String(form.get("notes") ?? "") || null,
      smsConsent: form.get("smsConsent") === "on",
      emailConsent: form.get("emailConsent") === "on",
      birthMonth,
      birthDay,
    });
  } catch (e) {
    fail(id, e);
  }
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}?ok=1`);
}

export async function blockAction(id: string, blocked: boolean, form: FormData): Promise<void> {
  const s = await requireAction("customers", "edit");
  try {
    await setCustomerBlocked(s.tenantId, s.actor, id, blocked, String(form.get("reason") ?? ""));
  } catch (e) {
    fail(id, e);
  }
  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  redirect(`/customers/${id}?ok=1`);
}

export async function adjustCreditAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("customers", "edit");
  try {
    const amount = Number(form.get("amount") ?? 0);
    const direction = String(form.get("direction") ?? "add");
    const signedAmount = direction === "deduct" ? -Math.abs(amount) : Math.abs(amount);
    const reason = String(form.get("reason") ?? "");
    await adjustCustomerStoreCredit(s.tenantId, s.actor, id, signedAmount, reason);
  } catch (e) {
    fail(id, e);
  }
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}?ok=credit_adjusted`);
}

export async function adjustPointsAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("customers", "edit");
  try {
    const points = Number(form.get("points") ?? 0);
    const direction = String(form.get("direction") ?? "add");
    const signedPoints = direction === "deduct" ? -Math.abs(points) : Math.abs(points);
    const reason = String(form.get("reason") ?? "");
    await adjustPoints(s.tenantId, s.actor, id, signedPoints, reason);
  } catch (e) {
    fail(id, e);
  }
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}?ok=points_adjusted`);
}

export async function sendCustomerSmsAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("customers", "edit");
  try {
    const message = String(form.get("message") ?? "");
    await sendCustomerDirectSms(s.tenantId, s.actor, id, message);
  } catch (e) {
    fail(id, e);
  }
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}?ok=sms_sent`);
}

export async function saveAddressAction(id: string, form: FormData): Promise<void> {
  const s = await requireAction("customers", "edit");
  try {
    const addressId = String(form.get("addressId") ?? "").trim() || undefined;
    const label = String(form.get("label") ?? "Home").trim();
    const address = String(form.get("address") ?? "").trim();
    const district = String(form.get("district") ?? "").trim();
    const division = String(form.get("division") ?? "").trim();
    const upazila = String(form.get("upazila") ?? "").trim() || null;
    const isDefault = form.get("isDefault") === "on";

    await saveCustomerAddress(s.tenantId, s.actor, id, {
      id: addressId,
      label,
      address,
      district,
      division,
      upazila,
      isDefault,
    });
  } catch (e) {
    fail(id, e);
  }
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}?ok=address_saved`);
}

export async function deleteAddressAction(id: string, addressId: string): Promise<void> {
  const s = await requireAction("customers", "edit");
  try {
    await deleteCustomerAddress(s.tenantId, s.actor, id, addressId);
  } catch (e) {
    fail(id, e);
  }
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}?ok=address_deleted`);
}
