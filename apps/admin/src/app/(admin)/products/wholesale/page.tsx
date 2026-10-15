import type { Metadata } from "next";
import { getModuleStatus } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { AppDisabledNotice } from "@/components/app-disabled-notice";
import { getWholesaleManagerDataAction } from "./actions";
import { WholesaleManagerClient } from "./wholesale-manager-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Wholesale & B2B Pricing Hub",
};

export default async function WholesalePage() {
  const s = await requireAccess("products");
  const mod = await getModuleStatus(s.tenantId, "wholesale_b2b");

  if (!mod.active) {
    return (
      <AppDisabledNotice
        appName="Wholesale & B2B Pricing Suite"
        appKey="wholesale_b2b"
        planTier={mod.planTier}
        minPlan="BUSINESS"
        description="Tiered quantity wholesale breaks, pre-approved reseller accounts, MOQs, bank transfer checkout, and B2B Tax Invoices & Delivery Challans."
      />
    );
  }

  const data = await getWholesaleManagerDataAction();

  return <WholesaleManagerClient initialData={data} />;
}
