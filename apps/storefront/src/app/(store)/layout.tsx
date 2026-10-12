import type { Metadata } from "next";
import { getPixelId, getPointsSummary, listCategories, getStoreInfo, listFooterPages, listPublishedPosts } from "@biztrackbd/core";
import { CartProvider } from "@/components/cart-provider";
import { Footer } from "@/components/footer";
import { Announcement, Header } from "@/components/header";
import { ThemeStyle } from "@/components/theme-style";
import { ReferralBanner } from "@/components/referral-banner";
import { DemoRibbon } from "@/components/demo-ribbon";
import { Pixel } from "@/components/tracker";
import { getLang, makeT } from "@/lib/i18n";
import { getOrigin } from "@/lib/origin";
import { getCustomerSession } from "@/lib/session";
import { findStore } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const store = await findStore();
  if (!store) return { title: "Store not found" };
  const [info, origin] = await Promise.all([getStoreInfo(store.id), getOrigin()]);
  return {
    metadataBase: new URL(origin),
    title: { default: info.tagline ? `${info.storeName} | ${info.tagline}` : info.storeName, template: `%s | ${info.storeName}` },
    description: info.tagline ?? `Shop online at ${info.storeName}. Cash on delivery, bKash and Nagad across Bangladesh.`,
    openGraph: { siteName: info.storeName, type: "website", locale: store.locale.replace("-", "_") },
  };
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const store = await findStore();
  if (!store) {
    return (
      <main className="wrap" style={{ padding: "64px 0" }}>
        <h1>Store not found</h1>
        <p className="muted">This address is not connected to a store.</p>
      </main>
    );
  }
  const lang = await getLang(store.locale);
  const t = makeT(lang);
  const session = await getCustomerSession(store.id);
  const [footerPages, blog] = await Promise.all([listFooterPages(store.id), listPublishedPosts(store.id, { pageSize: 1 })]);
  const [info, categories, pixelId, points] = await Promise.all([getStoreInfo(store.id), listCategories(store.id), getPixelId(store.id), session ? getPointsSummary(store.id, session.customerId) : Promise.resolve(null)]);
  return (
    <CartProvider>
      <ThemeStyle tenantId={store.id} />
      {store.isDemo && <DemoRibbon themeId={store.themeId} lang={lang} />}
      {pixelId && <Pixel pixelId={pixelId} />}
      <Announcement info={info} lang={lang} />
      <ReferralBanner tenantId={store.id} lang={lang} t={t} />
      <Header info={info} categories={categories} lang={lang} t={t} points={points} />
      <main id="main">{children}</main>
      <Footer info={info} categories={categories} lang={lang} t={t} pages={footerPages} hasBlog={blog.total > 0} />
    </CartProvider>
  );
}
