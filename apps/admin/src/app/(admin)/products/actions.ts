"use server";

import { revalidatePath } from "next/cache";
import { DomainError, archiveProduct, releaseStorage, saveProduct } from "@biztrackbd/core";
import { removeImage } from "@biztrackbd/media";
import { requireAction } from "@/lib/session";

export type SaveResult = { ok: true; id: string; slug: string } | { ok: false; error: string; field?: string; limit?: boolean };

/** Saves from the product editor. The page sends everything it shows; the server validates it all again. */
export async function saveProductAction(payload: unknown, productId?: string): Promise<SaveResult> {
  const s = await requireAction("products", "edit");
  try {
    const r = await saveProduct(s.tenantId, s.actor, payload, productId);
    // Photos taken off the product that no other product uses are deleted, and the store gets the space back. A problem here
    // never undoes the save: a photo left behind only wastes space.
    for (const url of r.removedImages) {
      try {
        const freed = await removeImage(s.tenantId, url);
        if (freed) await releaseStorage(s.tenantId, freed);
      } catch (e) {
        console.error("removing a photo failed", e instanceof Error ? e.name : "unknown");
      }
    }
    revalidatePath("/products");
    revalidatePath("/inventory");
    revalidatePath("/");
    return { ok: true, id: r.id, slug: r.slug };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message, field: typeof e.details?.field === "string" ? e.details.field : undefined, limit: e.code === "PLAN_LIMIT" };
    console.error("saveProductAction failed", e instanceof Error ? e.name : "unknown");
    return { ok: false, error: "Something went wrong. Nothing was saved." };
  }
}

export async function archiveProductAction(productId: string): Promise<void> {
  const s = await requireAction("products", "edit");
  await archiveProduct(s.tenantId, productId, s.actor);
  revalidatePath("/products");
  revalidatePath("/");
}
