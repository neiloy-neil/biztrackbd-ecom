import type { Metadata } from "next";
import { getKaporSettings, getPreview, getStoreInfo, getTenantModeAndVertical, listCategories, listProducts, loadPageData, verifyPreviewToken } from "@biztrackbd/core";
import { PreviewBridge } from "@/components/preview-bridge";
import { getLang, pickStrings } from "@/lib/i18n";
import { loadCollectionCtx, loadProductCtx } from "@/lib/page-layout";
import { CART_STRINGS } from "@/lib/strings";
import type { PageCtx } from "@/lib/page-ctx";
import { getStore } from "@/lib/tenant";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
// The draft is private to the people editing it: never indexed, never cached, never leaked through a referrer.
export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false }, referrer: "no-referrer" };

const adminOrigin = () => {
  try {
    return process.env.NEXT_PUBLIC_ADMIN_URL ? new URL(process.env.NEXT_PUBLIC_ADMIN_URL).origin : undefined;
  } catch {
    return undefined;
  }
};

const KINDS = ["home", "product", "collection", "cart"] as const;
type Kind = (typeof KINDS)[number];

/**
 * A page as it is being edited: the saved draft first, then redrawn live from the editor's messages. Product, collection and cart pages
 * show a real product, a real collection or a sample cart, because their layouts need something to draw (docs/39).
 */
export default async function Preview({ searchParams }: { searchParams: Promise<{ token?: string; page?: string; slug?: string }> }) {
  const { token, page: wanted, slug } = await searchParams;
  const store = await getStore();
  // The link carries a short-lived signed token for exactly this store. Anything else is a plain 404.
  if (verifyPreviewToken(token) !== store.id) notFound();
  const kind: Kind = (KINDS as readonly string[]).includes(wanted ?? "") ? (wanted as Kind) : "home";
  const [lang, storeInfo, modeMeta] = await Promise.all([
    getLang(store.locale),
    getStoreInfo(store.id),
    getTenantModeAndVertical(store.id),
  ]);
  const site = {
    phone: storeInfo.contactPhone,
    whatsapp: storeInfo.whatsappNumber,
    address: storeInfo.addressLine,
    logoUrl: storeInfo.logoUrl,
    storeName: storeInfo.storeName,
    siteMode: modeMeta.siteMode,
    businessVertical: modeMeta.vertical ?? undefined,
  };
  const { page, theme } = await getPreview(store.id, kind);
  const data = await loadPageData(store.id, page, { everything: true });

  const ctx: PageCtx = { preview: true };
  if (kind === "product") {
    const first = slug ?? (await listProducts(store.id, { sort: "newest", page: 1 })).items[0]?.slug;
    const product = first ? await loadProductCtx(store.id, first) : null;
    if (product) ctx.product = product;
  } else if (kind === "collection") {
    const first = slug ?? (await listCategories(store.id))[0]?.slug;
    const collection = first ? await loadCollectionCtx(store.id, first, "newest", 1) : null;
    if (collection) ctx.collection = collection;
  } else if (kind === "cart") {
    const settings = await getKaporSettings(store.id);
    ctx.cart = { freeOver: settings.freeDeliveryOver, s: pickStrings(lang, CART_STRINGS) };
  }
  return <PreviewBridge kind={kind} initialPage={page} initialTheme={theme} data={data} lang={lang} adminOrigin={adminOrigin()} ctx={ctx} site={site} />;
}
