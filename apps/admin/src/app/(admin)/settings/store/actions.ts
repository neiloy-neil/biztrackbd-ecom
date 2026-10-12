"use server";

import { revalidatePath } from "next/cache";
import { DomainError, saveStoreDetails, setOrdersPaused } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface FormState { error?: string; field?: string; ok?: boolean }

const text = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function saveStoreAction(_prev: FormState, f: FormData): Promise<FormState> {
  const s = await requireAction("design", "edit");
  try {
    await saveStoreDetails(s.tenantId, s.actor, {
      storeName: text(f, "storeName"), storeNameBn: text(f, "storeNameBn"), tagline: text(f, "tagline"), description: text(f, "description"),
      contactPhone: text(f, "contactPhone"), whatsappNumber: text(f, "whatsappNumber"), email: text(f, "email"), facebookUrl: text(f, "facebookUrl"), instagramUrl: text(f, "instagramUrl"),
      addressLine: text(f, "addressLine"), pickupAddress: text(f, "pickupAddress"), logoUrl: text(f, "logoUrl"), announcement: text(f, "announcement"), announcementBn: text(f, "announcementBn"),
      orderPrefix: text(f, "orderPrefix"),
    });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message, field: typeof e.details?.field === "string" ? e.details.field : undefined };
    throw e;
  }
  revalidatePath("/settings/store");
  revalidatePath("/");
  return { ok: true };
}

export async function pauseAction(paused: boolean): Promise<void> {
  const s = await requireAction("design", "edit");
  await setOrdersPaused(s.tenantId, s.actor, paused);
  revalidatePath("/settings/store");
  revalidatePath("/");
}
