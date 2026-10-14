import { requireAccess } from "@/lib/session";
import { getModuleStatus } from "@biztrackbd/core";
import { AppDisabledNotice } from "@/components/app-disabled-notice";
import { getPosInitialDataAction } from "./actions";
import { PosTerminalClient } from "./pos-terminal-client";

export const metadata = {
  title: "POS Terminal | Cash Counter",
  description: "High-speed retail point of sale terminal with instant barcode scanning, cash shift drawer reconciliation, and dual thermal receipts.",
};

export default async function PosPage() {
  const s = await requireAccess("orders", "view");
  const mod = await getModuleStatus(s.tenantId, "pos_barcode");

  if (!mod.active) {
    return (
      <AppDisabledNotice
        appName="POS Terminal & Barcode Studio"
        appKey="pos_barcode"
        planTier={mod.planTier}
        minPlan="PRO"
        description="Transform any laptop, PC, or tablet into a high-speed retail checkout counter with barcode wedge scanner support and thermal printing."
      />
    );
  }

  const initialData = await getPosInitialDataAction();

  return <PosTerminalClient initialData={initialData} />;
}
