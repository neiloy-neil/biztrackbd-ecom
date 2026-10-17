import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { can, validateModeTransitionDryRun, type SiteMode, type BusinessVertical } from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { requireAccess } from "@/lib/session";
import { ModeTransitionClient } from "./mode-transition-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Operating Mode & Capabilities" };

interface PageProps {
  searchParams: Promise<{ done?: string }>;
}

export default async function OperatingModePage({ searchParams }: PageProps) {
  const s = await requireAccess("design");
  const params = await searchParams;

  const tenant = await withTenant(s.tenantId, async (tx) => {
    return tx.tenant.findUnique({
      where: { id: s.tenantId },
      select: {
        id: true,
        name: true,
        subdomain: true,
        siteMode: true,
        businessVertical: true,
        planTier: true,
      },
    });
  });

  if (!tenant) notFound();

  const [products, orders, leads, contentItems] = await withTenant(s.tenantId, async (tx) => {
    return Promise.all([
      tx.product.count({ where: { tenantId: s.tenantId } }),
      tx.order.count({ where: { tenantId: s.tenantId } }),
      tx.siteLead.count({ where: { tenantId: s.tenantId } }),
      tx.siteContentItem.count({ where: { tenantId: s.tenantId } }),
    ]);
  });

  const defaultTarget: SiteMode =
    tenant.siteMode === "PORTFOLIO"
      ? "HYBRID"
      : tenant.siteMode === "HYBRID"
      ? "PORTFOLIO"
      : "HYBRID";

  const initialDryRun = await validateModeTransitionDryRun(
    s.tenantId,
    defaultTarget,
    (tenant.businessVertical as BusinessVertical) || "DOCTOR_CLINIC"
  ).catch(() => null);

  const canEdit =
    can(s.user.role, "design", "edit") &&
    (s.user.role === "STORE_OWNER" || s.user.role === "STORE_MANAGER");

  return (
    <>
      <div className="page-head">
        <h1>Operating Mode &amp; Architecture</h1>
      </div>
      <p className="page-sub">
        Configure whether your storefront operates as a service portfolio, clinic chamber, or dual-engine hybrid retail store.
      </p>

      <ModeTransitionClient
        tenant={{
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          siteMode: tenant.siteMode,
          businessVertical: tenant.businessVertical,
          planTier: tenant.planTier,
        }}
        initialDryRun={initialDryRun}
        counts={{
          products,
          orders,
          leads,
          contentItems,
        }}
        canEdit={canEdit}
        doneMessage={params.done}
      />
    </>
  );
}
