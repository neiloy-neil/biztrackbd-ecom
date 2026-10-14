import type { Metadata } from "next";
import Link from "next/link";
import { can, getBannerSettings, getModuleStatus } from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { requireAccess } from "@/lib/session";
import { AppDisabledNotice } from "@/components/app-disabled-notice";
import { BannerForm } from "./banner-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Promotional Banner & Flash Sale | Marketing",
};

export default async function MarketingBannerPage() {
  const s = await requireAccess("marketing");
  const mod = await getModuleStatus(s.tenantId, "marketing_campaigns");

  if (!mod.active) {
    return (
      <AppDisabledNotice
        appName="Storefront Banner & Flash Sale"
        appKey="marketing_campaigns"
        planTier={mod.planTier}
        minPlan="PRO"
        description="Display high-urgency announcement banners with countdown timers on your storefront."
      />
    );
  }

  const bannerSettings = await getBannerSettings(s.tenantId, s.actor);
  const canEdit = can(s.user.role, "marketing", "edit");

  const storeName = await withTenant(s.tenantId, async (tx) => {
    const settings = await tx.storeSettings.findFirst({ select: { storeName: true } });
    const tenant = await tx.tenant.findFirst({ select: { name: true } });
    return settings?.storeName ?? tenant?.name ?? "Your Store";
  });

  return (
    <>
      <div
        className="page-head"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Link
              href="/marketing"
              className="muted"
              style={{ textDecoration: "none", fontSize: 13 }}
            >
              Marketing
            </Link>
            <span className="muted">/</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Banner & Flash Sale</span>
          </div>
          <h1 style={{ margin: 0 }}>Promotional Banner & Flash Sale</h1>
          <p className="page-sub" style={{ margin: "4px 0 0" }}>
            Control top-of-store announcements, high-urgency countdown timers, and 1-click coupon codes.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/marketing/coupons" className="btn btn-secondary">
            Discount Coupons &rarr;
          </Link>
        </div>
      </div>

      <BannerForm
        initialSettings={bannerSettings}
        canEdit={canEdit}
        storeName={storeName}
      />
    </>
  );
}
