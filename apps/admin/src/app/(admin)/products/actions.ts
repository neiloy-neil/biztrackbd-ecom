"use server";

import { revalidatePath } from "next/cache";
import { DomainError, archiveProduct, releaseStorage, saveCategory, saveProduct } from "@biztrackbd/core";
import { removeImage } from "@biztrackbd/media";
import { requireAction } from "@/lib/session";

export type SaveResult = { ok: true; id: string; slug: string } | { ok: false; error: string; field?: string; limit?: boolean };

export type QuickCategoryResult = { ok: true; category: { id: string; name: string; parentId: string | null } } | { ok: false; error: string };

/** Creates a category inline from the product editor and returns its data. */
export async function createQuickCategoryAction(name: string, parentId?: string | null): Promise<QuickCategoryResult> {
  const s = await requireAction("products", "edit");
  try {
    const trimmed = name.trim();
    if (trimmed.length < 2) return { ok: false, error: "Category name must be at least 2 characters." };
    const r = await saveCategory(s.tenantId, s.actor, { name: trimmed, parentId: parentId || null });
    revalidatePath("/products/categories");
    revalidatePath("/products");
    return { ok: true, category: { id: r.id, name: trimmed, parentId: parentId || null } };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("createQuickCategoryAction failed", e instanceof Error ? e.name : "unknown");
    return { ok: false, error: "Failed to create category." };
  }
}

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
  revalidatePath("/inventory");
  revalidatePath("/");
}

export async function restoreProductAction(productId: string): Promise<void> {
  const s = await requireAction("products", "edit");
  const { restoreProduct } = await import("@biztrackbd/core");
  await restoreProduct(s.tenantId, productId, s.actor);
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/");
}

export async function deleteProductAction(productId: string): Promise<void> {
  const s = await requireAction("products", "edit");
  const { deleteProduct } = await import("@biztrackbd/core");
  await deleteProduct(s.tenantId, productId, s.actor);
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/");
}

export async function generateProductDescriptionAction(options: {
  titleHint?: string;
  keywords?: string[];
  price?: number;
  categoryHint?: string;
  tone?: any;
  customBrandVoice?: string;
  imageBase64?: { mimeType: string; data: string };
  imagesBase64?: Array<{ mimeType: string; data: string }>;
  imageUrls?: string[];
  imageCount?: number;
}) {
  const s = await requireAction("products", "edit");
  try {
    const { generateProductListing } = await import("@biztrackbd/core");
    const listing = await generateProductListing(s.tenantId, s.actor, options);
    return { ok: true as const, data: listing };
  } catch (e) {
    const { DomainError } = await import("@biztrackbd/core");
    if (e instanceof DomainError) return { ok: false as const, error: e.message };
    console.error("generateProductDescriptionAction failed", e);
    return { ok: false as const, error: "Failed to generate AI product listing." };
  }
}

export async function generateImageAltTagsAction(options: {
  productTitle?: string;
  categoryHint?: string;
  imageCount?: number;
  imageUrls?: string[];
  imagesBase64?: Array<{ mimeType: string; data: string }>;
  tone?: any;
}) {
  const s = await requireAction("products", "edit");
  try {
    const { generateImageAltTags } = await import("@biztrackbd/core");
    const res = await generateImageAltTags(s.tenantId, s.actor, options);
    return { ok: true as const, data: res.altTexts };
  } catch (e) {
    const { DomainError } = await import("@biztrackbd/core");
    if (e instanceof DomainError) return { ok: false as const, error: e.message };
    console.error("generateImageAltTagsAction failed", e);
    return { ok: false as const, error: "Failed to generate image alt tags." };
  }
}

export async function generateBarcodeAction(): Promise<{ ok: true; barcode: string } | { ok: false; error: string }> {
  const s = await requireAction("products", "edit");
  try {
    const { generateBarcodeValue } = await import("@biztrackbd/core");
    return { ok: true, barcode: generateBarcodeValue(s.tenantId) };
  } catch (e) {
    console.error("generateBarcodeAction failed", e);
    return { ok: false, error: "Failed to generate barcode." };
  }
}
