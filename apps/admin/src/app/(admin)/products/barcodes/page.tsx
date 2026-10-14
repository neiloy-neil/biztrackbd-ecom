import { requireAccess } from "@/lib/session";
import { getStoreInfo, getModuleStatus } from "@biztrackbd/core";
import { AppDisabledNotice } from "@/components/app-disabled-notice";
import { fetchProductsForBarcodesAction } from "./actions";
import { BarcodeLabelStudioClient } from "./label-studio-client";

export const metadata = {
  title: "Barcode Label Studio | Products",
};

export default async function BarcodeStudioPage() {
  const s = await requireAccess("products", "view");
  const mod = await getModuleStatus(s.tenantId, "pos_barcode");

  if (!mod.active) {
    return (
      <AppDisabledNotice
        appName="Barcode Label Studio"
        appKey="pos_barcode"
        planTier={mod.planTier}
        minPlan="PRO"
        description="Design and print thermal roll labels (50x30mm, 38x25mm) and A4 sticker sheets with automatic Code-128 barcodes."
      />
    );
  }

  const [items, info] = await Promise.all([
    fetchProductsForBarcodesAction(),
    getStoreInfo(s.tenantId),
  ]);

  return (
    <BarcodeLabelStudioClient
      initialItems={items}
      storeName={info.storeName || "Our Store"}
    />
  );
}
