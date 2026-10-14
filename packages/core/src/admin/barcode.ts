import { Prisma, withTenant } from "@biztrackbd/db";
import { assertCan, type StaffActor } from "../permissions";
import { NotFoundError, ValidationError } from "../errors";

export { renderCode128Svg, type BarcodeRenderOptions } from "./barcode-render";

/**
 * Calculates standard Luhn / Mod 10 check digit for a numeric sequence
 */
export function calculateCheckDigit(numStr: string): number {
  let sum = 0;
  for (let i = 0; i < numStr.length; i++) {
    const n = parseInt(numStr[numStr.length - 1 - i]!, 10);
    sum += i % 2 === 0 ? n * 3 : n;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Auto-generates a unique standard 12-digit barcode for a store product variant.
 * Format: 880 (BD Prefix) + 4-digit store hash + 4-digit random sequence + 1 check digit.
 */
function storeSeedOf(tenantId: string): string {
  // Hash tenantId into a stable 4-digit number
  let hash = 0;
  for (let i = 0; i < tenantId.length; i++) {
    hash = (hash * 31 + tenantId.charCodeAt(i)) % 9000;
  }
  return String(1000 + Math.abs(hash)).slice(0, 4);
}

export function generateBarcodeValue(tenantId: string): string {
  const storeSeed = storeSeedOf(tenantId);

  // Generate random 4-digit sequence
  const randomSeq = String(Math.floor(1000 + Math.random() * 9000));

  const base11 = `880${storeSeed}${randomSeq}`;
  const checkDigit = calculateCheckDigit(base11);
  return `${base11}${checkDigit}`;
}

/**
 * Assigns or updates a barcode for a product variant.
 */
export async function assignVariantBarcode(
  tenantId: string,
  actor: StaffActor,
  variantId: string,
  customBarcode?: string
): Promise<{ variantId: string; barcode: string }> {
  assertCan(actor, "products", "edit");

  return withTenant(tenantId, async (tx) => {
    let finalBarcode = (customBarcode || "").trim().toUpperCase();

    if (!finalBarcode) {
      // Auto-generate unique barcode
      let attempts = 0;
      while (attempts < 5) {
        const candidate = generateBarcodeValue(tenantId);
        const existing = await tx.productVariant.findFirst({
          where: { barcode: candidate },
          select: { id: true },
        });
        if (!existing) {
          finalBarcode = candidate;
          break;
        }
        attempts++;
      }
      if (!finalBarcode) {
        finalBarcode = `880${Date.now().toString().slice(-9)}`;
      }
    } else {
      // Check collision with another variant in same store
      const collision = await tx.productVariant.findFirst({
        where: {
          barcode: finalBarcode,
          id: { not: variantId },
        },
        select: { id: true, title: true, product: { select: { title: true } } },
      });
      if (collision) {
        throw new ValidationError(
          `Barcode ${finalBarcode} is already in use by ${collision.product.title} (${collision.title})`
        );
      }
    }

    const updated = await tx.productVariant.update({
      where: { id: variantId },
      data: { barcode: finalBarcode },
      select: { id: true, barcode: true },
    });

    return { variantId: updated.id, barcode: updated.barcode! };
  });
}

/**
 * Fast variant lookup by scanned barcode or SKU.
 */
export async function findVariantByBarcode(
  tenantId: string,
  code: string
) {
  const query = code.trim().toUpperCase();
  if (!query) return null;

  return withTenant(tenantId, async (tx) => {
    const variant = await tx.productVariant.findFirst({
      where: {
        OR: [
          { barcode: query },
          { sku: query },
        ],
        isActive: true,
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            titleBn: true,
            slug: true,
            status: true,
            images: { take: 1, select: { url: true } },
          },
        },
      },
    });

    if (!variant || variant.product.status !== "ACTIVE") {
      return null;
    }

    return {
      variantId: variant.id,
      productId: variant.productId,
      productTitle: variant.product.title,
      productTitleBn: variant.product.titleBn,
      variantTitle: variant.title,
      sku: variant.sku,
      barcode: variant.barcode,
      price: Number(variant.price),
      compareAtPrice: variant.compareAtPrice ? Number(variant.compareAtPrice) : null,
      stockQuantity: variant.stockQuantity,
      imageUrl: variant.imageUrl || variant.product.images[0]?.url || null,
    };
  });
}

/**
 * Gives every variant that has no barcode one, in a single transaction. Numbers are handed out in order from the store's own range
 * (880 + store seed + 4-digit sequence + check digit), skipping any already in use, so two variants can never get the same one and a
 * store with hundreds of variants finishes in a moment. (The old way opened one transaction per variant, which timed out on a real catalogue.)
 */
export async function assignMissingBarcodes(tenantId: string, actor: StaffActor): Promise<{ updatedCount: number }> {
  assertCan(actor, "products", "edit");
  const prefix = `880${storeSeedOf(tenantId)}`;
  return withTenant(tenantId, async (tx) => {
    const missing = await tx.productVariant.findMany({ where: { barcode: null }, select: { id: true }, orderBy: { createdAt: "asc" } });
    if (missing.length === 0) return { updatedCount: 0 };
    const used = new Set((await tx.productVariant.findMany({ where: { barcode: { not: null } }, select: { barcode: true } })).map((v) => v.barcode!));
    let seq = 1000;
    const assigned: { id: string; barcode: string }[] = [];
    for (const v of missing) {
      let candidate = "";
      while (seq <= 9999) {
        const base = `${prefix}${seq++}`;
        const c = `${base}${calculateCheckDigit(base)}`;
        if (!used.has(c)) { candidate = c; break; }
      }
      if (!candidate) throw new ValidationError("This store has too many items for automatic barcodes. Assign the rest by hand.");
      used.add(candidate);
      assigned.push({ id: v.id, barcode: candidate });
    }
    for (let i = 0; i < assigned.length; i += 300) {
      const chunk = assigned.slice(i, i + 300);
      await tx.$executeRaw`
        UPDATE "ProductVariant" AS v SET "barcode" = d.b, "updatedAt" = now()
        FROM (VALUES ${Prisma.join(chunk.map((a) => Prisma.sql`(${a.id}, ${a.barcode})`))}) AS d(id, b)
        WHERE v."id" = d.id AND v."barcode" IS NULL`;
    }
    return { updatedCount: assigned.length };
  });
}
