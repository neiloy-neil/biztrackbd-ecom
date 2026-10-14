"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError, createCustomer } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export async function createCustomerAction(form: FormData): Promise<void> {
  const s = await requireAction("customers", "edit");
  const name = String(form.get("name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim() || undefined;
  const notes = String(form.get("notes") ?? "").trim() || undefined;
  const rawTags = String(form.get("tags") ?? "").trim();
  const tags = rawTags ? rawTags.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
  const smsConsent = form.get("smsConsent") === "on";
  const emailConsent = form.get("emailConsent") === "on";

  const address = String(form.get("address") ?? "").trim();
  const district = String(form.get("district") ?? "").trim();
  const division = String(form.get("division") ?? "").trim();
  const upazila = String(form.get("upazila") ?? "").trim() || undefined;
  const label = String(form.get("addressLabel") ?? "Home").trim();

  let customerId: string;
  try {
    const res = await createCustomer(s.tenantId, s.actor, {
      name,
      phone,
      email,
      notes,
      tags,
      smsConsent,
      emailConsent,
      address: address && district && division ? {
        label,
        address,
        district,
        division,
        upazila,
      } : undefined,
    });
    customerId = res.id;
  } catch (err: unknown) {
    const msg = err instanceof DomainError ? err.message : (err as Error)?.message || "Failed to create customer";
    redirect(`/customers?err=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/customers");
  redirect(`/customers/${customerId}?ok=created`);
}
