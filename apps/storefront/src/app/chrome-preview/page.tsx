import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPreviewChrome, getStoreInfo, listCategories, listFooterPages, listPublishedPosts, verifyPreviewToken } from "@biztrackbd/core";
import { CartProvider } from "@/components/cart-provider";
import { Footer } from "@/components/footer";
import { Announcement, Header } from "@/components/header";
import { RefreshOnMessage } from "@/components/refresh-on-message";
import { ThemeStyle } from "@/components/theme-style";
import { getLang, makeT } from "@/lib/i18n";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";
// A draft is private to the people editing it: never indexed, never cached, never leaked through a referrer.
export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false }, referrer: "no-referrer" };

const adminOrigin = () => {
  try {
    return process.env.NEXT_PUBLIC_ADMIN_URL ? new URL(process.env.NEXT_PUBLIC_ADMIN_URL).origin : undefined;
  } catch {
    return undefined;
  }
};

/** The store's header and footer as they are being edited (the saved draft), around a short stand-in page. */
export default async function ChromePreview({ searchParams }: { searchParams: Promise<{ token?: string; lang?: string }> }) {
  const { token, lang: wanted } = await searchParams;
  const store = await getStore();
  if (verifyPreviewToken(token) !== store.id) notFound();
  const lang = wanted === "bn" ? "bn" : wanted === "en" ? "en" : await getLang(store.locale);
  const t = makeT(lang);
  const [chrome, info, categories, footerPages, blog] = await Promise.all([getPreviewChrome(store.id), getStoreInfo(store.id), listCategories(store.id), listFooterPages(store.id), listPublishedPosts(store.id, { pageSize: 1 })]);
  return (
    <CartProvider>
      <ThemeStyle tenantId={store.id} />
      <RefreshOnMessage adminOrigin={adminOrigin()} />
      <Announcement info={info} lang={lang} chrome={chrome} />
      <Header info={info} categories={categories} lang={lang} t={t} chrome={chrome} />
      <main id="main" className="wrap" style={{ minHeight: 280, paddingTop: 48 }}>
        <h1 className="page-title">{lang === "bn" ? "আপনার পেজ এখানে থাকবে" : "Your page goes here"}</h1>
        <p className="muted">{lang === "bn" ? "এটি শুধু হেডার ও ফুটারের প্রিভিউ।" : "This is only a preview of your header and footer."}</p>
      </main>
      <Footer info={info} categories={categories} lang={lang} t={t} pages={footerPages} hasBlog={blog.total > 0} chrome={chrome} />
    </CartProvider>
  );
}
