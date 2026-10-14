import type { Metadata } from "next";
import { getLiveChrome, getStorefrontTracking, getPointsSummary, listCategories, getStoreInfo, listFooterPages, listPublishedPosts, isModuleActive } from "@biztrackbd/core";
import { CartProvider } from "@/components/cart-provider";
import { Footer } from "@/components/footer";
import { Announcement, Header } from "@/components/header";
import { ThemeStyle } from "@/components/theme-style";
import { ReferralBanner } from "@/components/referral-banner";
import { DemoRibbon } from "@/components/demo-ribbon";
import { PausedBanner } from "@/components/paused-notice";
import { StorefrontTracker } from "@/components/tracker";
import { WhatsAppFloatingButton } from "@/components/whatsapp-floating-button";
import { AiChatWidget } from "@/components/ai-chat-widget";
import { getLang, makeT } from "@/lib/i18n";
import { getOrigin } from "@/lib/origin";
import { getCustomerSession } from "@/lib/session";
import { findStore } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const store = await findStore();
  if (!store) return { title: "Store not found" };
  const [info, origin, tracking] = await Promise.all([getStoreInfo(store.id), getOrigin(), getStorefrontTracking(store.id)]);
  return {
    metadataBase: new URL(origin),
    title: { default: info.tagline ? `${info.storeName} | ${info.tagline}` : info.storeName, template: `%s | ${info.storeName}` },
    description: info.tagline ?? `Shop online at ${info.storeName}. Cash on delivery, bKash and Nagad across Bangladesh.`,
    openGraph: { siteName: info.storeName, type: "website", locale: store.locale.replace("-", "_") },
    other: tracking.metaDomainVerification
      ? { "facebook-domain-verification": tracking.metaDomainVerification }
      : undefined,
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
  // The header and footer the merchant built and published (docs/47 part C). None: today's header and footer.
  const chrome = await getLiveChrome(store.id).catch(() => null);
  const [info, categories, tracking, points, isAiActive] = await Promise.all([
    getStoreInfo(store.id),
    listCategories(store.id),
    getStorefrontTracking(store.id),
    session ? getPointsSummary(store.id, session.customerId) : Promise.resolve(null),
    isModuleActive(store.id, "ai_suite").catch(() => false),
  ]);
  return (
    <CartProvider>
      <ThemeStyle tenantId={store.id} />
      {store.isDemo && <DemoRibbon themeId={store.themeId} lang={lang} />}
      <StorefrontTracker tracking={tracking} />
      {info.ordersPaused && <PausedBanner t={t} />}
      <Announcement info={info} lang={lang} chrome={chrome} />
      <ReferralBanner tenantId={store.id} lang={lang} t={t} />
      <Header info={info} categories={categories} lang={lang} t={t} points={points} chrome={chrome} />
      <main id="main">{children}</main>
      <Footer info={info} categories={categories} lang={lang} t={t} pages={footerPages} hasBlog={blog.total > 0} chrome={chrome} />
      <WhatsAppFloatingButton whatsappNumber={info.whatsappNumber} />
      {isAiActive && (
        <AiChatWidget
          enabled={info.aiChatbotEnabled}
          botName={info.aiChatbotName}
          welcomeMessage={info.aiChatbotWelcome}
          escalatePhone={info.aiChatbotEscalatePhone || info.whatsappNumber}
          storeName={info.storeName}
        />
      )}
    </CartProvider>
  );
}
