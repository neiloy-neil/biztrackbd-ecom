import type { Metadata } from "next";
import { getPublicMenu, getStoreInfo, getTenantModeAndVertical } from "@biztrackbd/core";
import { getLang } from "@/lib/i18n";
import { getStore } from "@/lib/tenant";
import { MenuDiningClient } from "./menu-dining-client";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStore();
  const info = await getStoreInfo(store.id);
  const title = `${info.storeName} — Digital Menu & Dining`;
  return {
    title,
    description: info.tagline || `Browse our digital food & beverage menu and order directly from your table or for takeaway.`,
  };
}

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const [{ table }, store] = await Promise.all([searchParams, getStore()]);
  const [lang, storeInfo, modeMeta, categories] = await Promise.all([
    getLang(store.locale),
    getStoreInfo(store.id),
    getTenantModeAndVertical(store.id),
    getPublicMenu(store.id),
  ]);

  return (
    <MenuDiningClient
      categories={categories}
      table={table?.trim() || null}
      // Only the public fields the menu draws: the full settings record holds API secrets and must never reach the browser.
      storeInfo={{
        storeName: storeInfo.storeName,
        logoUrl: storeInfo.logoUrl,
        addressLine: storeInfo.addressLine,
        whatsappNumber: storeInfo.whatsappNumber,
        contactPhone: storeInfo.contactPhone,
      }}
      siteMode={modeMeta.siteMode}
      lang={lang}
    />
  );
}
