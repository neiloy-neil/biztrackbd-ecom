"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@biztrackbd/db";
import { assignVariantBarcode, renderCode128Svg } from "@biztrackbd/core";
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

export async function assignMissingBarcodesAction(): Promise<{ updatedCount: number }> {
  const s = await requireAction("products", "edit");

  return withTenant(s.tenantId, async (tx) => {
    const missing = await tx.productVariant.findMany({
      where: {
        barcode: null,
      },
      select: { id: true },
    });

    let count = 0;
    for (const v of missing) {
      await assignVariantBarcode(s.tenantId, s.actor, v.id);
      count++;
    }

    revalidatePath("/products/barcodes");
    revalidatePath("/products");
    return { updatedCount: count };
  });
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
