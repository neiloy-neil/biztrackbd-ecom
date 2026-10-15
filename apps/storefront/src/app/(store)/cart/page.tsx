import type { Metadata } from "next";
import { getKaporSettings, loadPageData } from "@biztrackbd/core";
import { Sections } from "@/components/sections";
import { getLang, makeT, pickStrings } from "@/lib/i18n";
import { getPageLayout } from "@/lib/page-layout";
import { CART_STRINGS } from "@/lib/strings";
import { getStore, requireCommerce } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cart", robots: { index: false, follow: false } };

export default async function CartPage() {
  const store = await getStore();
  await requireCommerce(store.id);
  const [lang, theme, layout] = await Promise.all([getLang(store.locale), getKaporSettings(store.id), getPageLayout(store.id, "cart")]);
  const data = await loadPageData(store.id, layout);
  return <Sections page={layout} data={data} lang={lang} t={makeT(lang)} ctx={{ cart: { freeOver: theme.freeDeliveryOver, s: pickStrings(lang, CART_STRINGS) } }} />;
}
