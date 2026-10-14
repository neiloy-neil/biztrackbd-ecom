import { withTenant, type Prisma } from "@biztrackbd/db";
import { z } from "zod";
import { NotFoundError, ValidationError } from "../errors";

export const BundleDiscountTypeSchema = z.enum(["FIXED_PRICE", "PERCENTAGE", "FIXED_DISCOUNT"]);
export type BundleDiscountType = z.infer<typeof BundleDiscountTypeSchema>;

export const BundleStatusSchema = z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]);
export type BundleStatus = z.infer<typeof BundleStatusSchema>;

export const BumpTriggerTypeSchema = z.enum(["GLOBAL", "PRODUCT", "CATEGORY"]);
export type BumpTriggerType = z.infer<typeof BumpTriggerTypeSchema>;

export const BumpStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export type BumpStatus = z.infer<typeof BumpStatusSchema>;

export const BundleItemInput = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullable().optional(),
  quantity: z.number().int().min(1).default(1),
  sortOrder: z.number().int().default(0),
});

export const CreateBundleInput = z.object({
  title: z.string().trim().min(2).max(120),
  titleBn: z.string().trim().max(120).nullable().optional(),
  slug: z.string().trim().min(2).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  descriptionBn: z.string().max(1000).nullable().optional(),
  bannerImage: z.string().nullable().optional(),
  discountType: BundleDiscountTypeSchema.default("FIXED_PRICE"),
  discountValue: z.number().positive(),
  allowCoupon: z.boolean().default(false),
  status: BundleStatusSchema.default("ACTIVE"),
  sortOrder: z.number().int().default(0),
  items: z.array(BundleItemInput).min(2, "A bundle must contain at least 2 items").max(20),
});
export type CreateBundleInput = z.infer<typeof CreateBundleInput>;

export const UpdateBundleInput = CreateBundleInput.partial();
export type UpdateBundleInput = z.infer<typeof UpdateBundleInput>;

export const CreateOrderBumpInput = z.object({
  title: z.string().trim().min(2).max(120),
  titleBn: z.string().trim().max(120).nullable().optional(),
  highlightText: z.string().trim().max(60).nullable().optional(),
  highlightTextBn: z.string().trim().max(60).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  descriptionBn: z.string().max(500).nullable().optional(),
  productId: z.string().min(1),
  variantId: z.string().min(1),
  bumpPrice: z.number().positive(),
  allowCoupon: z.boolean().default(false),
  triggerType: BumpTriggerTypeSchema.default("GLOBAL"),
  triggerIds: z.array(z.string()).default([]),
  status: BumpStatusSchema.default("ACTIVE"),
  displayOrder: z.number().int().default(0),
});
export type CreateOrderBumpInput = z.infer<typeof CreateOrderBumpInput>;

export const UpdateOrderBumpInput = CreateOrderBumpInput.partial();
export type UpdateOrderBumpInput = z.infer<typeof UpdateOrderBumpInput>;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `bundle-${Date.now().toString(36)}`;
}

// ---- Bundle Admin Queries & Mutations ----

export async function listBundles(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    return tx.productBundle.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            product: {
              select: {
                id: true,
                title: true,
                titleBn: true,
                slug: true,
                basePrice: true,
                images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
              },
            },
            variant: {
              select: {
                id: true,
                title: true,
                price: true,
                stockQuantity: true,
              },
            },
          },
        },
        _count: { select: { orderItems: true } },
      },
    });
  });
}

export async function getBundle(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const bundle = await tx.productBundle.findFirst({
      where: { id },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            product: {
              select: {
                id: true,
                title: true,
                titleBn: true,
                slug: true,
                basePrice: true,
                variants: { select: { id: true, title: true, price: true, stockQuantity: true } },
                images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
              },
            },
            variant: true,
          },
        },
      },
    });
    if (!bundle) throw new NotFoundError("Bundle");
    return bundle;
  });
}

export async function createBundle(tenantId: string, rawInput: unknown) {
  const input = CreateBundleInput.parse(rawInput);
  const slug = input.slug ? slugify(input.slug) : slugify(input.title);

  return withTenant(tenantId, async (tx) => {
    const existing = await tx.productBundle.findFirst({ where: { slug } });
    const finalSlug = existing ? `${slug}-${Date.now().toString(36).slice(-4)}` : slug;

    return tx.productBundle.create({
      data: {
        tenantId,
        title: input.title,
        titleBn: input.titleBn,
        slug: finalSlug,
        description: input.description,
        descriptionBn: input.descriptionBn,
        bannerImage: input.bannerImage,
        discountType: input.discountType,
        discountValue: input.discountValue,
        allowCoupon: input.allowCoupon,
        status: input.status,
        sortOrder: input.sortOrder,
        items: {
          create: input.items.map((it, idx) => ({
            tenantId,
            productId: it.productId,
            variantId: it.variantId ?? null,
            quantity: it.quantity,
            sortOrder: it.sortOrder ?? idx,
          })),
        },
      },
      include: { items: true },
    });
  });
}

export async function updateBundle(tenantId: string, id: string, rawInput: unknown) {
  const input = UpdateBundleInput.parse(rawInput);

  return withTenant(tenantId, async (tx) => {
    const existing = await tx.productBundle.findFirst({ where: { id } });
    if (!existing) throw new NotFoundError("Bundle");

    // If items are provided, replace them
    if (input.items) {
      await tx.productBundleItem.deleteMany({ where: { bundleId: id } });
    }

    return tx.productBundle.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.titleBn !== undefined ? { titleBn: input.titleBn } : {}),
        ...(input.slug !== undefined ? { slug: slugify(input.slug) } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.descriptionBn !== undefined ? { descriptionBn: input.descriptionBn } : {}),
        ...(input.bannerImage !== undefined ? { bannerImage: input.bannerImage } : {}),
        ...(input.discountType !== undefined ? { discountType: input.discountType } : {}),
        ...(input.discountValue !== undefined ? { discountValue: input.discountValue } : {}),
        ...(input.allowCoupon !== undefined ? { allowCoupon: input.allowCoupon } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.items
          ? {
              items: {
                create: input.items.map((it, idx) => ({
                  tenantId,
                  productId: it.productId,
                  variantId: it.variantId ?? null,
                  quantity: it.quantity,
                  sortOrder: it.sortOrder ?? idx,
                })),
              },
            }
          : {}),
      },
      include: { items: true },
    });
  });
}

export async function deleteBundle(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const existing = await tx.productBundle.findFirst({ where: { id } });
    if (!existing) throw new NotFoundError("Bundle");
    await tx.productBundle.delete({ where: { id } });
    return { ok: true };
  });
}

// ---- Order Bump Admin Queries & Mutations ----

export async function listOrderBumps(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    return tx.orderBump.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      include: {
        product: {
          select: {
            id: true,
            title: true,
            titleBn: true,
            images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
          },
        },
        variant: {
          select: {
            id: true,
            title: true,
            price: true,
            stockQuantity: true,
          },
        },
      },
    });
  });
}

export async function getOrderBump(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const bump = await tx.orderBump.findFirst({
      where: { id },
      include: {
        product: { select: { id: true, title: true, titleBn: true, basePrice: true } },
        variant: { select: { id: true, title: true, price: true, stockQuantity: true } },
      },
    });
    if (!bump) throw new NotFoundError("Order bump");
    return bump;
  });
}

export async function createOrderBump(tenantId: string, rawInput: unknown) {
  const input = CreateOrderBumpInput.parse(rawInput);

  return withTenant(tenantId, async (tx) => {
    // Verify product and variant belong to tenant and exist
    const variant = await tx.productVariant.findFirst({
      where: { id: input.variantId, productId: input.productId },
      include: { product: true },
    });
    if (!variant) throw new ValidationError("Product variant not found");

    return tx.orderBump.create({
      data: {
        tenantId,
        title: input.title,
        titleBn: input.titleBn,
        highlightText: input.highlightText,
        highlightTextBn: input.highlightTextBn,
        description: input.description,
        descriptionBn: input.descriptionBn,
        productId: input.productId,
        variantId: input.variantId,
        bumpPrice: input.bumpPrice,
        allowCoupon: input.allowCoupon,
        triggerType: input.triggerType,
        triggerIds: input.triggerIds,
        status: input.status,
        displayOrder: input.displayOrder,
      },
      include: {
        product: { select: { id: true, title: true } },
        variant: { select: { id: true, title: true, price: true } },
      },
    });
  });
}

export async function updateOrderBump(tenantId: string, id: string, rawInput: unknown) {
  const input = UpdateOrderBumpInput.parse(rawInput);

  return withTenant(tenantId, async (tx) => {
    const existing = await tx.orderBump.findFirst({ where: { id } });
    if (!existing) throw new NotFoundError("Order bump");

    return tx.orderBump.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.titleBn !== undefined ? { titleBn: input.titleBn } : {}),
        ...(input.highlightText !== undefined ? { highlightText: input.highlightText } : {}),
        ...(input.highlightTextBn !== undefined ? { highlightTextBn: input.highlightTextBn } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.descriptionBn !== undefined ? { descriptionBn: input.descriptionBn } : {}),
        ...(input.productId !== undefined ? { productId: input.productId } : {}),
        ...(input.variantId !== undefined ? { variantId: input.variantId } : {}),
        ...(input.bumpPrice !== undefined ? { bumpPrice: input.bumpPrice } : {}),
        ...(input.allowCoupon !== undefined ? { allowCoupon: input.allowCoupon } : {}),
        ...(input.triggerType !== undefined ? { triggerType: input.triggerType } : {}),
        ...(input.triggerIds !== undefined ? { triggerIds: input.triggerIds } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      },
    });
  });
}

export async function deleteOrderBump(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const existing = await tx.orderBump.findFirst({ where: { id } });
    if (!existing) throw new NotFoundError("Order bump");
    await tx.orderBump.delete({ where: { id } });
    return { ok: true };
  });
}

// ---- Live Analytics ----

export async function getBundleAnalytics(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const bumps = await tx.orderBump.findMany({
      select: {
        acceptedCount: true,
        revenueGenerated: true,
      },
    });

    const totalBumpsAccepted = bumps.reduce((sum, b) => sum + b.acceptedCount, 0);
    const totalBumpRevenue = bumps.reduce((sum, b) => sum + Number(b.revenueGenerated), 0);

    const bundleItemsAgg = await tx.orderItem.aggregate({
      where: { bundleId: { not: null } },
      _sum: { totalPrice: true },
      _count: { _all: true },
    });

    const totalBundleRevenue = Number(bundleItemsAgg._sum.totalPrice ?? 0);
    const totalBundleItemsSold = bundleItemsAgg._count._all;

    const totalOrders = await tx.order.count({ where: { status: { not: "CANCELLED" } } });
    const ordersWithBump = await tx.orderItem.groupBy({
      by: ["orderId"],
      where: { isBump: true },
    });

    const bumpAcceptanceRate = totalOrders > 0
      ? Math.round((ordersWithBump.length / totalOrders) * 1000) / 10
      : 0;

    return {
      totalBumpRevenue,
      totalBumpsAccepted,
      totalBundleRevenue,
      totalBundleItemsSold,
      totalOrders,
      ordersWithBumpCount: ordersWithBump.length,
      bumpAcceptanceRate,
    };
  });
}

// ---- Storefront Helpers ----

export interface StorefrontBundle {
  id: string;
  title: string;
  titleBn: string | null;
  slug: string;
  description: string | null;
  descriptionBn: string | null;
  discountType: BundleDiscountType;
  discountValue: number;
  allowCoupon: boolean;
  regularTotal: number;
  bundlePrice: number;
  savings: number;
  savingsPercent: number;
  items: Array<{
    productId: string;
    productTitle: string;
    productTitleBn: string | null;
    productSlug: string;
    imageUrl: string | null;
    quantity: number;
    defaultVariantId: string;
    variants: Array<{
      id: string;
      title: string;
      price: number;
      stockQuantity: number;
    }>;
  }>;
}

export async function getActiveBundlesForProduct(tenantId: string, productId: string): Promise<StorefrontBundle[]> {
  return withTenant(tenantId, async (tx) => {
    const bundleRows = await tx.productBundle.findMany({
      where: {
        status: "ACTIVE",
        items: { some: { productId } },
      },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            product: {
              select: {
                id: true,
                title: true,
                titleBn: true,
                slug: true,
                status: true,
                deletedAt: true,
                images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
                variants: {
                  where: { isActive: true },
                  select: { id: true, title: true, price: true, stockQuantity: true },
                },
              },
            },
          },
        },
      },
    });

    const results: StorefrontBundle[] = [];

    for (const b of bundleRows) {
      // Must have at least 2 items and all active products
      if (b.items.length < 2) continue;
      if (b.items.some((it) => it.product.status !== "ACTIVE" || it.product.deletedAt || it.product.variants.length === 0)) {
        continue;
      }

      let regularTotal = 0;
      const formattedItems = b.items.map((it) => {
        const defaultVar = it.variantId
          ? it.product.variants.find((v) => v.id === it.variantId) ?? it.product.variants[0]!
          : it.product.variants[0]!;
        const price = Number(defaultVar.price);
        regularTotal += price * it.quantity;

        return {
          productId: it.product.id,
          productTitle: it.product.title,
          productTitleBn: it.product.titleBn,
          productSlug: it.product.slug,
          imageUrl: it.product.images[0]?.url ?? null,
          quantity: it.quantity,
          defaultVariantId: defaultVar.id,
          variants: it.product.variants.map((v) => ({
            id: v.id,
            title: v.title,
            price: Number(v.price),
            stockQuantity: v.stockQuantity,
          })),
        };
      });

      let bundlePrice = regularTotal;
      const val = Number(b.discountValue);
      if (b.discountType === "FIXED_PRICE") {
        bundlePrice = Math.min(val, regularTotal);
      } else if (b.discountType === "PERCENTAGE") {
        bundlePrice = Math.max(0, regularTotal * (1 - val / 100));
      } else if (b.discountType === "FIXED_DISCOUNT") {
        bundlePrice = Math.max(0, regularTotal - val);
      }
      bundlePrice = Math.round(bundlePrice);
      const savings = Math.max(0, regularTotal - bundlePrice);
      const savingsPercent = regularTotal > 0 ? Math.round((savings / regularTotal) * 100) : 0;

      results.push({
        id: b.id,
        title: b.title,
        titleBn: b.titleBn,
        slug: b.slug,
        description: b.description,
        descriptionBn: b.descriptionBn,
        discountType: b.discountType,
        discountValue: val,
        allowCoupon: b.allowCoupon,
        regularTotal,
        bundlePrice,
        savings,
        savingsPercent,
        items: formattedItems,
      });
    }

    return results;
  });
}

export interface StorefrontOrderBump {
  id: string;
  title: string;
  titleBn: string | null;
  highlightText: string | null;
  highlightTextBn: string | null;
  description: string | null;
  descriptionBn: string | null;
  productId: string;
  variantId: string;
  variantTitle: string;
  regularPrice: number;
  bumpPrice: number;
  savings: number;
  imageUrl: string | null;
  allowCoupon: boolean;
}

export async function getCheckoutOrderBumps(
  tenantId: string,
  cartProductIds: string[],
  cartCategoryIds: string[] = []
): Promise<StorefrontOrderBump[]> {
  return withTenant(tenantId, async (tx) => {
    const activeBumps = await tx.orderBump.findMany({
      where: {
        status: "ACTIVE",
        variant: { stockQuantity: { gt: 0 } },
        product: { status: "ACTIVE", deletedAt: null },
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            categoryId: true,
            images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
          },
        },
        variant: {
          select: {
            id: true,
            title: true,
            price: true,
            stockQuantity: true,
          },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    });

    const matches: StorefrontOrderBump[] = [];

    for (const b of activeBumps) {
      // Don't offer an order bump for a product already in the cart
      if (cartProductIds.includes(b.productId)) continue;

      let isMatch = false;
      if (b.triggerType === "GLOBAL") {
        isMatch = true;
      } else if (b.triggerType === "PRODUCT") {
        isMatch = b.triggerIds.some((id) => cartProductIds.includes(id));
      } else if (b.triggerType === "CATEGORY") {
        isMatch = b.triggerIds.some((id) => cartCategoryIds.includes(id));
      }

      if (isMatch) {
        const regularPrice = Number(b.variant.price);
        const bumpPrice = Number(b.bumpPrice);
        matches.push({
          id: b.id,
          title: b.title,
          titleBn: b.titleBn,
          highlightText: b.highlightText,
          highlightTextBn: b.highlightTextBn,
          description: b.description,
          descriptionBn: b.descriptionBn,
          productId: b.productId,
          variantId: b.variantId,
          variantTitle: b.variant.title,
          regularPrice,
          bumpPrice,
          savings: Math.max(0, regularPrice - bumpPrice),
          imageUrl: b.product.images[0]?.url ?? null,
          allowCoupon: b.allowCoupon,
        });
      }

      // Cap at 2 bumps in checkout
      if (matches.length >= 2) break;
    }

    return matches;
  });
}
