import { withTenant } from "@biztrackbd/db";
import { assertCan, type StaffActor } from "../permissions";
import { NotFoundError, ValidationError } from "../errors";

/**
 * Code-128 Symbol Patterns (Subset B for standard ASCII alphanumeric).
 * Each pattern defines 6 alternating bar/space widths totaling 11 units.
 * Stop symbol has 7 elements (13 units).
 */
const CODE128_PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (106 is STOP)
];

const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Calculates modulo 103 checksum for Code 128 (Subset B)
 */
function getCode128CheckValue(codes: number[]): number {
  let sum = START_CODE_B;
  for (let i = 0; i < codes.length; i++) {
    sum += codes[i]! * (i + 1);
  }
  return sum % 103;
}

/**
 * Encodes ASCII text into Code-128 B symbol indices
 */
function textToCode128B(text: string): number[] {
  const codes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    if (code >= 0 && code <= 95) {
      codes.push(code);
    } else {
      codes.push(0); // Space fallback
    }
  }
  return codes;
}

export interface BarcodeRenderOptions {
  height?: number;
  barWidth?: number;
  showText?: boolean;
  fontSize?: number;
  color?: string;
  background?: string;
}

/**
 * Pure TypeScript Code-128 SVG Barcode Generator.
 * Creates an exact, crisp SVG barcode ready for web display, thermal label printers, and PDFs.
 */
export function renderCode128Svg(
  value: string,
  options: BarcodeRenderOptions = {}
): string {
  const cleanVal = (value || "").trim().toUpperCase() || "000000";
  const height = options.height ?? 50;
  const barWidth = options.barWidth ?? 2;
  const showText = options.showText ?? true;
  const fontSize = options.fontSize ?? 12;
  const color = options.color ?? "#000000";
  const bg = options.background ?? "transparent";

  const symbolCodes = textToCode128B(cleanVal);
  const checkValue = getCode128CheckValue(symbolCodes);

  // Full symbol sequence: Start B + Symbols + Checksum + Stop
  const allSymbols = [START_CODE_B, ...symbolCodes, checkValue, STOP_CODE];

  // Convert to alternating bar and space segments
  const rects: Array<{ x: number; w: number }> = [];
  let currentX = 10; // Left quiet zone

  for (const sym of allSymbols) {
    const pattern = CODE128_PATTERNS[sym] || "111111";
    let isBar = true;
    for (let i = 0; i < pattern.length; i++) {
      const widthUnits = parseInt(pattern[i]!, 10) * barWidth;
      if (isBar) {
        rects.push({ x: currentX, w: widthUnits });
      }
      currentX += widthUnits;
      isBar = !isBar;
    }
  }

  const totalWidth = currentX + 10; // Right quiet zone
  const totalHeight = showText ? height + fontSize + 6 : height;

  const rectsSvg = rects
    .map((r) => `<rect x="${r.x}" y="0" width="${r.w}" height="${height}" fill="${color}" />`)
    .join("");

  const textSvg = showText
    ? `<text x="${totalWidth / 2}" y="${height + fontSize + 2}" font-family="monospace, monospace" font-size="${fontSize}" font-weight="600" fill="${color}" text-anchor="middle" letter-spacing="2">${cleanVal}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}" style="background:${bg};max-width:100%;height:auto;">
    ${rectsSvg}
    ${textSvg}
  </svg>`;
}

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
export function generateBarcodeValue(tenantId: string): string {
  // Hash tenantId into a stable 4-digit number
  let hash = 0;
  for (let i = 0; i < tenantId.length; i++) {
    hash = (hash * 31 + tenantId.charCodeAt(i)) % 9000;
  }
  const storeSeed = String(1000 + Math.abs(hash)).slice(0, 4);

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
