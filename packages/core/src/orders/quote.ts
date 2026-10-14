import { withTenant } from "@biztrackbd/db";
import { z } from "zod";
import { CouponError, ValidationError } from "../errors";
import { normalizeBdPhone } from "../phone";
import { priceLoyalty, type LoyaltyPricing } from "../loyalty/engine";
import { assertCouponUsable, deliveryFor, discountFor, money, pickZone } from "./pricing";

export const QuoteInput = z.object({
  items: z.array(z.object({
    variantId: z.string().min(8),
    quantity: z.number().int().min(1).max(50),
    bundleId: z.string().optional(),
    isBump: z.boolean().optional(),
  })).max(50),
  /** Needed to price delivery. Without it delivery is unknown (null) and the customer is told it is added at checkout. */
  district: z.string().trim().max(80).optional(),
  couponCode: z.string().trim().max(40).optional(),
  /** Only used to check "one per customer" coupon limits. */
  phone: z.string().max(20).optional(),
  /** Cash on delivery can carry a fee, so the total depends on it. */
  paymentMethod: z.enum(["COD", "MANUAL_BKASH", "MANUAL_NAGAD", "MANUAL_ROCKET", "GATEWAY_UDDOKTAPAY"]).optional(),
  /** Loyalty points the signed-in customer wants to spend. */
  redeemPoints: z.number().int().min(0).max(1_000_000).optional(),
  referralCode: z.string().trim().max(40).optional(),
  /** Set ONLY by a server that verified the sign-in; the storefront overwrites whatever the browser sent. */
  verifiedCustomerId: z.string().max(64).optional(),
  bundleId: z.string().optional(),
  bumpIds: z.array(z.string()).optional(),
});
export type QuoteInput = z.input<typeof QuoteInput>;

export interface QuoteLine {
  variantId: string;
  productId: string;
  slug: string;
  productTitle: string;
  productTitleBn: string | null;
  variantTitle: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  /** Stock right now. The cart shows "only 3 left" and blocks quantities above it. */
  available: number;
  bundleId?: string | null;
  bundleTitle?: string | null;
  isBump?: boolean;
}

export interface QuoteProblem {
  variantId: string;
  kind: "unavailable" | "insufficient_stock";
  available: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  bundleSavings?: number;
  bumpSavings?: number;
  zone: { name: string; rate: number; freeOverAmount: number | null; etaMinDays: number; etaMaxDays: number } | null;
  /** null until a district is known */
  deliveryCharge: number | null;
  /** How much more to spend for free delivery, or null when not applicable. */
  freeDeliveryRemaining: number | null;
  discount: number;
  /** Extra charge for cash on delivery, only when COD is the chosen method. */
  codFee: number;
  couponCode: string | null;
  /** Why the coupon was refused, in plain words. The quote is still returned without it. */
  couponError: string | null;
  /** The VIP discount, a friend's offer and points, priced by the same rules as the order. */
  loyalty: LoyaltyPricing;
  total: number | null;
  problems: QuoteProblem[];
  /** Which ways to pay the store offers for this order, from its payment settings. */
  paymentOptions: { cod: { available: boolean; fee: number; reason: string | null }; bkash: { available: boolean }; nagad: { available: boolean }; ordersPaused: boolean };
}

/**
 * Read-only price preview for the cart and checkout. Uses the same rules as createOrder (orders/pricing.ts) but reserves
 * nothing and counts nothing. The server still recomputes everything when the order is placed; this is for display.
 */
export async function quoteOrder(tenantId: string, rawInput: unknown): Promise<Quote> {
  const parsed = QuoteInput.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError("Invalid cart");
  const input = parsed.data;

  const wanted = new Map<string, number>();
  for (const l of input.items) wanted.set(l.variantId, (wanted.get(l.variantId) ?? 0) + l.quantity);

  return withTenant(tenantId, async (tx) => {
    const variants = wanted.size
      ? await tx.productVariant.findMany({
          relationLoadStrategy: "join",
          where: { id: { in: [...wanted.keys()] } },
          include: { product: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } } },
        })
      : [];

    // Check for active order bumps among wanted variants
    const activeBumps = wanted.size
      ? await tx.orderBump.findMany({
          where: {
            variantId: { in: [...wanted.keys()] },
            status: "ACTIVE",
          },
        })
      : [];

    // Check for bundle if supplied
    const activeBundleId = input.bundleId || input.items.find((it) => it.bundleId)?.bundleId;
    const activeBundle = activeBundleId
      ? await tx.productBundle.findFirst({
          where: { id: activeBundleId, status: "ACTIVE" },
          include: { items: true },
        })
      : null;

    let bumpSavings = 0;
    let bundleSavings = 0;

    const lines: QuoteLine[] = [];
    const problems: QuoteProblem[] = [];
    for (const [id, quantity] of wanted) {
      const v = variants.find((x) => x.id === id);
      if (!v || v.product.status !== "ACTIVE" || v.product.deletedAt) {
        problems.push({ variantId: id, kind: "unavailable", available: 0 });
        continue;
      }

      // Check if this line is marked as an order bump
      const isBump = input.items.some((it) => it.variantId === id && it.isBump) ||
        (input.bumpIds?.some((bId) => activeBumps.some((ab) => ab.id === bId && ab.variantId === id)) ?? false);
      const matchedBump = isBump ? activeBumps.find((ab) => ab.variantId === id) : null;

      let unitPrice = Number(v.price);
      if (matchedBump) {
        const bp = Number(matchedBump.bumpPrice);
        bumpSavings += Math.max(0, (unitPrice - bp) * quantity);
        unitPrice = bp;
      }

      const itemBundleId = input.items.find((it) => it.variantId === id)?.bundleId || (activeBundle ? activeBundle.id : null);
      const isBundleLine = Boolean(activeBundle && (itemBundleId === activeBundle.id || activeBundle.items.some((bi) => bi.productId === v.productId)));

      lines.push({
        variantId: id,
        productId: v.productId,
        slug: v.product.slug,
        productTitle: v.product.title,
        productTitleBn: v.product.titleBn,
        variantTitle: v.title,
        imageUrl: v.imageUrl ?? v.product.images[0]?.url ?? null,
        unitPrice,
        quantity,
        lineTotal: money(unitPrice * quantity),
        available: Math.max(v.stockQuantity, 0),
        bundleId: isBundleLine ? activeBundle?.id : null,
        bundleTitle: isBundleLine ? activeBundle?.title : null,
        isBump: Boolean(matchedBump),
      });

      if (v.stockQuantity < quantity) problems.push({ variantId: id, kind: "insufficient_stock", available: Math.max(v.stockQuantity, 0) });
    }

    // Apply bundle discount if all required bundle products are present
    if (activeBundle) {
      const bundleLines = lines.filter((l) => l.bundleId === activeBundle.id);
      if (bundleLines.length >= 2) {
        const regularBundleTotal = bundleLines.reduce((s, l) => s + l.lineTotal, 0);
        let promotionalBundleTotal = regularBundleTotal;
        const val = Number(activeBundle.discountValue);

        if (activeBundle.discountType === "FIXED_PRICE") {
          promotionalBundleTotal = Math.min(val, regularBundleTotal);
        } else if (activeBundle.discountType === "PERCENTAGE") {
          promotionalBundleTotal = Math.max(0, regularBundleTotal * (1 - val / 100));
        } else if (activeBundle.discountType === "FIXED_DISCOUNT") {
          promotionalBundleTotal = Math.max(0, regularBundleTotal - val);
        }

        bundleSavings = Math.max(0, regularBundleTotal - promotionalBundleTotal);

        // Distribute discount proportionately across bundle lines
        if (bundleSavings > 0 && regularBundleTotal > 0) {
          const ratio = promotionalBundleTotal / regularBundleTotal;
          for (const bl of bundleLines) {
            bl.unitPrice = money(bl.unitPrice * ratio);
            bl.lineTotal = money(bl.unitPrice * bl.quantity);
          }
        }
      }
    }

    const subtotal = money(lines.reduce((s, l) => s + l.lineTotal, 0));

    // Calculate coupon-eligible subtotal: skip items from bundles or bumps that have allowCoupon: false
    let couponEligibleSubtotal = subtotal;
    if (activeBundle && !activeBundle.allowCoupon) {
      const bundleLinesSum = lines.filter((l) => l.bundleId === activeBundle.id).reduce((s, l) => s + l.lineTotal, 0);
      couponEligibleSubtotal = Math.max(0, couponEligibleSubtotal - bundleLinesSum);
    }
    const noCouponBumpsSum = lines.filter((l) => {
      if (!l.isBump) return false;
      const b = activeBumps.find((ab) => ab.variantId === l.variantId);
      return b && !b.allowCoupon;
    }).reduce((s, l) => s + l.lineTotal, 0);
    couponEligibleSubtotal = Math.max(0, couponEligibleSubtotal - noCouponBumpsSum);

    const zones = input.district ? await tx.shippingZone.findMany() : [];
    const zone = input.district ? pickZone(zones, input.district) : undefined;
    let deliveryCharge = zone ? deliveryFor(zone, subtotal) : null;

    let discount = 0;
    let couponCode: string | null = null;
    let couponError: string | null = null;
    if (input.couponCode) {
      try {
        const c = await tx.coupon.findFirst({ where: { code: input.couponCode.toUpperCase() } });
        assertCouponUsable(c, couponEligibleSubtotal > 0 ? couponEligibleSubtotal : subtotal);
        if (c.usageLimit != null && c.usageCount >= c.usageLimit) throw new CouponError("This coupon has been fully claimed");
        if (input.phone) {
          let phone: string | null = null;
          try { phone = normalizeBdPhone(input.phone); } catch { /* an unfinished number just skips the per-customer check */ }
          if (phone) {
            const used = await tx.order.count({ where: { customerPhone: phone, couponId: c.id, status: { not: "CANCELLED" } } });
            if (used >= c.perCustomerLimit) throw new CouponError("You have already used this coupon");
          }
        }
        const applied = discountFor(c, couponEligibleSubtotal);
        discount = applied.discount;
        if (applied.freeShipping && deliveryCharge != null) deliveryCharge = 0;
        couponCode = c.code;
      } catch (e) {
        if (!(e instanceof CouponError)) throw e;
        couponError = e.message;
      }
    }

    let phoneForLoyalty: string | null = null;
    if (input.phone) {
      try { phoneForLoyalty = normalizeBdPhone(input.phone); } catch { /* an unfinished number gets no member pricing yet */ }
    }
    const loyalty = await priceLoyalty(tx, { phone: phoneForLoyalty, verifiedCustomerId: input.verifiedCustomerId, subtotal, couponDiscount: discount, redeemPoints: input.redeemPoints, referralCode: input.referralCode });
    if (loyalty.freeDelivery && deliveryCharge != null) deliveryCharge = 0;
    const memberDiscount = money(loyalty.tierDiscount + loyalty.referralDiscount + loyalty.pointsDiscount);

    const settings = await tx.storeSettings.findFirst();
    const codFeeRule = settings ? Number(settings.codFee) : 0;
    const codFee = input.paymentMethod === "COD" ? codFeeRule : 0;
    const beforeCod = deliveryCharge != null ? money(subtotal - discount - memberDiscount + deliveryCharge) : null;
    const codMax = settings?.codMaxAmount != null ? Number(settings.codMaxAmount) : null;
    const codTooBig = codMax != null && beforeCod != null && money(beforeCod + codFeeRule) > codMax;
    const paymentOptions = {
      cod: {
        available: (settings?.codEnabled ?? true) && !codTooBig, fee: codFeeRule,
        reason: settings && !settings.codEnabled ? "off" : codTooBig ? `Cash on delivery is available up to ৳${codMax}` : null,
      },
      bkash: { available: (settings?.bkashEnabled ?? true) && Boolean(settings?.bkashNumber) },
      nagad: { available: (settings?.nagadEnabled ?? true) && Boolean(settings?.nagadNumber) },
      ordersPaused: settings?.ordersPaused ?? false,
    };

    const freeOver = zone?.freeOverAmount != null ? Number(zone.freeOverAmount) : null;
    return {
      codFee, paymentOptions,
      lines, subtotal, problems, discount, couponCode, couponError, loyalty, deliveryCharge,
      zone: zone ? { name: zone.name, rate: Number(zone.rate), freeOverAmount: freeOver, etaMinDays: zone.etaMinDays, etaMaxDays: zone.etaMaxDays } : null,
      freeDeliveryRemaining: freeOver != null && subtotal < freeOver && deliveryCharge !== 0 ? money(freeOver - subtotal) : null,
      total: deliveryCharge != null ? money(subtotal - discount - memberDiscount + deliveryCharge + codFee) : null,
    };
  });
}
