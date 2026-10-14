import type { Metadata } from "next";
import {
  can,
  listBundles,
  listOrderBumps,
  getBundleAnalytics,
} from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { requireAccess } from "@/lib/session";
import { BundlesManagerClient } from "./bundles-manager-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Product Bundles & Order Bumps" };

export default async function BundlesPage() {
  const s = await requireAccess("marketing");
  const canEdit = can(s.user.role, "marketing", "edit");

  const [bundles, orderBumps, analytics, products, categories, tenantInfo] = await Promise.all([
    listBundles(s.tenantId),
    listOrderBumps(s.tenantId),
    getBundleAnalytics(s.tenantId),
    withTenant(s.tenantId, (tx) =>
      tx.product.findMany({
        where: { deletedAt: null, status: "ACTIVE" },
        orderBy: { title: "asc" },
        select: {
          id: true,
          title: true,
          titleBn: true,
          basePrice: true,
          categoryId: true,
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
          variants: {
            where: { isActive: true },
            select: { id: true, title: true, price: true, stockQuantity: true },
            orderBy: { createdAt: "asc" },
          },
        },
        take: 500,
      })
    ),
    withTenant(s.tenantId, (tx) =>
      tx.category.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
        take: 100,
      })
    ),
    withTenant(s.tenantId, (tx) =>
      tx.tenant.findFirst({
        select: { planTier: true, status: true, trialEndsAt: true },
      })
    ),
  ]);

  const formattedProducts = products.map((p) => ({
    id: p.id,
    title: p.title,
    titleBn: p.titleBn,
    basePrice: Number(p.basePrice),
    categoryId: p.categoryId,
    imageUrl: p.images[0]?.url || null,
    variants: p.variants.map((v) => ({
      id: v.id,
      title: v.title,
      price: Number(v.price),
      stockQuantity: v.stockQuantity,
    })),
  }));

  const isTrial = Boolean(
    tenantInfo?.trialEndsAt && new Date(tenantInfo.trialEndsAt) > new Date()
  );

  return (
    <BundlesManagerClient
      initialBundles={bundles as any}
      initialOrderBumps={orderBumps as any}
      analytics={analytics}
      products={formattedProducts}
      categories={categories}
      planTier={tenantInfo?.planTier || "STARTER"}
      isTrial={isTrial}
      canEdit={canEdit}
    />
  );
}
