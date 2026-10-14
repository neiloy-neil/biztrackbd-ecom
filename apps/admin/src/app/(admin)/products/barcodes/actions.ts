"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@biztrackbd/db";
import { DomainError, assignMissingBarcodes, renderCode128Svg } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface BarcodePrintItem {
  variantId: string;
  productId: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  stockQuantity: number;
}

export async function fetchProductsForBarcodesAction(): Promise<BarcodePrintItem[]> {
  const s = await requireAction("products", "view");

  return withTenant(s.tenantId, async (tx) => {
    const variants = await tx.productVariant.findMany({
      where: {
        isActive: true,
        product: { status: "ACTIVE" },
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: [
        { product: { title: "asc" } },
        { title: "asc" },
      ],
    });

    return variants.map((v) => ({
      variantId: v.id,
      productId: v.productId,
      productTitle: v.product.title,
      variantTitle: v.title.toLowerCase() === "default" ? "" : v.title,
      sku: v.sku,
      barcode: v.barcode,
      price: Number(v.price),
      stockQuantity: v.stockQuantity,
    }));
  });
}

export async function assignMissingBarcodesAction(): Promise<{ ok: true; updatedCount: number } | { ok: false; error: string }> {
  const s = await requireAction("products", "edit");
  try {
    const r = await assignMissingBarcodes(s.tenantId, s.actor);
    revalidatePath("/products/barcodes");
    revalidatePath("/products");
    return { ok: true, updatedCount: r.updatedCount };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    console.error("assignMissingBarcodesAction failed", e instanceof Error ? e.name : "unknown");
    return { ok: false, error: "Could not create the barcodes. Nothing was changed. Please try again." };
  }
}

export async function renderBarcodeSvgAction(barcode: string): Promise<string> {
  await requireAction("products", "view");
  return renderCode128Svg(barcode, {
    height: 38,
    barWidth: 1.8,
    showText: true,
    fontSize: 10,
  });
}
