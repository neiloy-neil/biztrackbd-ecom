import type { Metadata } from "next";
import {
  getLiveChrome,
  getStorefrontTracking,
  getPointsSummary,
  listCategories,
  getStoreInfo,
  listFooterPages,
  listPublishedPosts,
  isModuleActive,
  getTenantModeAndVertical,
  getRecentSalesFeed,
} from "@biztrackbd/core";
import { CartProvider } from "@/components/cart-provider";
import { Footer } from "@/components/footer";
import { Announcement, Header } from "@/components/header";
import { ThemeStyle } from "@/components/theme-style";
import { ReferralBanner } from "@/components/referral-banner";
import { DemoRibbon } from "@/components/demo-ribbon";
import { PausedBanner } from "@/components/paused-notice";
import { StorefrontTracker } from "@/components/tracker";
import { WhatsAppFloatingButton } from "@/components/whatsapp-floating-button";
import { MobileStickyActionBar } from "@/components/mobile-sticky-action-bar";
import { AiChatWidget } from "@/components/ai-chat-widget";
import { SocialProofToasts } from "@/components/social-proof-toasts";
import { getLang, makeT } from "@/lib/i18n";
import { getOrigin } from "@/lib/origin";
import { findStore, getStoreCapabilities } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const store = await findStore();
  if (!store) return { title: "Store not found" };
  const [info, origin, tracking] = await Promise.all([
    getStoreInfo(store.id),
    getOrigin(),
    getStorefrontTracking(store.id),
  ]);
    const tokens = new Set<string>();
    if (tracking.googleSiteVerification) {
      tokens.add(tracking.googleSiteVerification);
      const withoutExt = tracking.googleSiteVerification.replace(/\.html$/i, "");
      tokens.add(withoutExt);
      if (withoutExt.toLowerCase().startsWith("google")) {
        tokens.add(withoutExt.slice(6));
      }
    }
    const googleTokens = Array.from(tokens).filter(Boolean);

    const siteTitle = tracking.seoTitle?.trim() || (info.tagline ? `${info.storeName} | ${info.tagline}` : info.storeName);
    const siteDesc = tracking.seoDescription?.trim() || info.tagline || `Shop online at ${info.storeName}. Cash on delivery, bKash and Nagad across Bangladesh.`;
    const keywordsList = tracking.seoKeywords ? tracking.seoKeywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined;
    const shareImage = tracking.socialShareImageUrl || info.logoUrl || undefined;

    return {
      metadataBase: new URL(origin),
      title: { default: siteTitle, template: `%s | ${info.storeName}` },
      description: siteDesc,
      keywords: keywordsList,
      openGraph: {
        siteName: info.storeName,
        type: "website",
        locale: store.locale.replace("-", "_"),
        title: siteTitle,
        description: siteDesc,
        images: shareImage ? [{ url: shareImage }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: siteTitle,
        description: siteDesc,
        images: shareImage ? [shareImage] : undefined,
      },
      verification: {
        google: googleTokens.length > 0 ? (googleTokens.length === 1 ? googleTokens[0] : googleTokens) : undefined,
        other: tracking.metaDomainVerification
          ? { "facebook-domain-verification": tracking.metaDomainVerification }
          : undefined,
      },
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
  const [capabilities, lang] = await Promise.all([
    getStoreCapabilities(store.id),
    getLang(store.locale),
  ]);
  const t = makeT(lang);
  const [footerPages, blog, recentSales] = await Promise.all([
    listFooterPages(store.id),
    listPublishedPosts(store.id, { pageSize: 1 }),
    capabilities.commerce ? getRecentSalesFeed(store.id).catch(() => []) : Promise.resolve([]),
  ]);
  // The header and footer the merchant built and published (docs/47 part C). None: today's header and footer.
  const chrome = await getLiveChrome(store.id).catch(() => null);
  const [info, categories, tracking, points, isAiActive, { siteMode, vertical }, origin] = await Promise.all([
    getStoreInfo(store.id),
    capabilities.commerce ? listCategories(store.id) : Promise.resolve([]),
    getStorefrontTracking(store.id),
    capabilities.commerce ? getPointsSummary(store.id, store.id).catch(() => null) : Promise.resolve(null),
    isModuleActive(store.id, "ai_suite").catch(() => false),
    getTenantModeAndVertical(store.id),
    getOrigin(),
  ]);

  const schemaJson: Record<string, any> = {
    "@context": "https://schema.org",
    "@type":
      siteMode === "ECOMMERCE"
        ? "OnlineStore"
        : vertical === "RESTAURANT"
        ? "Restaurant"
        : vertical === "DOCTOR_CLINIC"
        ? "Physician"
        : vertical === "PUBLIC_FIGURE" || vertical === "PERSONAL_PORTFOLIO"
        ? "Person"
        : vertical === "SERVICE_PROVIDER"
        ? "ProfessionalService"
        : "LocalBusiness",
    name: info.storeName,
    url: origin,
    description: info.tagline || `${info.storeName} official website`,
    ...(info.logoUrl ? { image: info.logoUrl } : {}),
    ...(info.contactPhone || info.whatsappNumber ? { telephone: info.contactPhone || info.whatsappNumber } : {}),
    ...(vertical === "RESTAURANT" ? { hasMenu: `${origin}/menu`, servesCuisine: "Bangladeshi, Halal" } : {}),
    ...(info.addressLine
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: info.addressLine,
            addressCountry: "BD",
          },
        }
      : {}),
  };

  return (
    <CartProvider>
      <ThemeStyle tenantId={store.id} />
      {store.isDemo && (
        <DemoRibbon
          themeId={store.themeId}
          lang={lang}
          siteMode={siteMode}
          vertical={vertical}
        />
      )}
      <StorefrontTracker tracking={tracking} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaJson) }}
      />
      {info.ordersPaused && <PausedBanner t={t} />}
      <Announcement info={info} lang={lang} chrome={chrome} />
      <ReferralBanner tenantId={store.id} lang={lang} t={t} />
      <Header info={info} categories={categories} lang={lang} t={t} points={points} chrome={chrome} commerce={capabilities.commerce} />
      <main id="main">{children}</main>
      <Footer info={info} categories={categories} lang={lang} t={t} pages={footerPages} hasBlog={blog.total > 0} chrome={chrome} commerce={capabilities.commerce} />
      <WhatsAppFloatingButton whatsappNumber={info.whatsappNumber} />
      <MobileStickyActionBar phone={info.contactPhone} whatsapp={info.whatsappNumber} lang={lang} />
      {(isAiActive || info.aiChatbotEnabled) && (
        <AiChatWidget
          enabled={info.aiChatbotEnabled}
          botName={info.aiChatbotName}
          welcomeMessage={info.aiChatbotWelcome}
          escalatePhone={info.aiChatbotEscalatePhone || info.whatsappNumber}
          storeName={info.storeName}
        />
      )}
      <SocialProofToasts feed={recentSales} lang={lang} />
    </CartProvider>
  );
}
