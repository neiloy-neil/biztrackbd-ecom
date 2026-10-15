import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPreview, getPublicLanding, getStoreInfo, getStorefrontTracking, verifyPreviewToken } from "@biztrackbd/core";
import { setLanguage } from "@/app/actions";
import { LandingOrderForm } from "@/components/landing-order-form";
import { LandingDrawer } from "@/components/landing-drawer";
import { SocialProofTicker } from "@/components/social-proof-ticker";
import { PreviewBridge } from "@/components/preview-bridge";
import { Sections, type LandingInfo } from "@/components/sections";
import { ThemeStyle } from "@/components/theme-style";
import { LandingEvents } from "@/components/landing-events";
import { PlatformCredit } from "@/components/platform-credit";
import { StorefrontTracker } from "@/components/tracker";
import { getLang, makeT, pickStrings } from "@/lib/i18n";
import { LP_FORM_KEYS } from "@/lib/strings";
import { getStore } from "@/lib/tenant";
import { withTenant } from "@biztrackbd/db";

export const dynamic = "force-dynamic";

const adminOrigin = () => {
  try {
    return process.env.NEXT_PUBLIC_ADMIN_URL ? new URL(process.env.NEXT_PUBLIC_ADMIN_URL).origin : undefined;
  } catch {
    return undefined;
  }
};

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> }): Promise<Metadata> {
  const [{ slug }, { preview }] = await Promise.all([params, searchParams]);
  const store = await getStore();
  if (preview) return { title: "Preview", robots: { index: false, follow: false }, referrer: "no-referrer" };
  const landing = await getPublicLanding(store.id, slug);
  if (!landing) return { title: "Not found", robots: { index: false } };
  return { title: landing.title, description: landing.product.shortExcerpt ?? undefined, alternates: { canonical: `/l/${slug}` } };
}

/** A one-product page with a cash on delivery order form. Live pages are public; a draft is shown only with a preview token. */
export default async function LandingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string; utm_source?: string; utm_campaign?: string; utm_medium?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const store = await getStore();
  const lang = await getLang(store.locale);
  const t = makeT(lang);

  let preview: { page: Awaited<ReturnType<typeof getPreview>>["page"]; theme: Awaited<ReturnType<typeof getPreview>>["theme"] } | undefined;
  if (sp.preview) {
    // A draft is private to the people editing it, and only for this store.
    if (verifyPreviewToken(sp.preview) !== store.id) notFound();
    const row = await withTenant(store.id, (tx) => tx.landingPage.findFirst({ where: { slug }, select: { id: true } }));
    if (!row) notFound();
    preview = await getPreview(store.id, `landing:${row.id}`);
  }

  const landing = await getPublicLanding(store.id, slug, preview ? { page: preview.page } : undefined);
  if (!landing) notFound();

  // The store's tags (Meta, TikTok, Google) as on every page, with this page's own Meta Pixel when it has one.
  const tracking = await getStorefrontTracking(store.id);
  if (landing.pixelId) tracking.pixelId = landing.pixelId;
  const orderSection = landing.page.sections.find((s) => s.type === "lp-order-form");
  const buttonText = orderSection ? (lang === "bn" && orderSection.settings.buttonTextBn ? String(orderSection.settings.buttonTextBn) : String(orderSection.settings.buttonText ?? "")) : t("lpOrderSubmit");
  const form = (
    <LandingOrderForm
      slug={slug}
      lang={lang}
      s={pickStrings(lang, LP_FORM_KEYS)}
      buttonText={buttonText || t("lpOrderSubmit")}
      options={landing.options}
      bump={landing.bump}
      utm={{ source: sp.utm_source, campaign: sp.utm_campaign, medium: sp.utm_medium }}
      track={!preview}
    />
  );
  const data = { products: {}, categories: [] };
  // What the stock line and the price bar show: the first offer, from the database (never typed into the page).
  const first = landing.options[0];
  const firstVariants = first?.variants ?? [];
  const finalPrice = (price: number) => {
    if (!first) return price;
    const line = price * (first.quantity ?? 1);
    const off = first.deal.kind === "percent" ? Math.round(line * first.deal.value) / 100 : first.deal.kind === "amount" ? first.deal.value : 0;
    return Math.max(0, line - Math.min(line, off));
  };
  const sellable = firstVariants.filter((v) => v.stock > 0);
  const cheapest = sellable.length ? sellable.reduce((a, b) => (finalPrice(b.price) < finalPrice(a.price) ? b : a)) : null;
  const info: LandingInfo = {
    stock: firstVariants.length ? firstVariants.reduce((n, v) => n + Math.max(0, v.stock), 0) : null,
    alwaysShowStock: Boolean(preview),
    price: cheapest ? finalPrice(cheapest.price) : null,
    was: cheapest?.compareAt != null && cheapest.compareAt > cheapest.price ? cheapest.compareAt * (first?.quantity ?? 1) : null,
  };

  // The header of the page shows the merchant's own logo (or the store's name) and the ways to reach them, from the store settings.
  const storeInfo = await getStoreInfo(store.id);
  const site = { phone: storeInfo.contactPhone, whatsapp: storeInfo.whatsappNumber, address: storeInfo.addressLine, logoUrl: storeInfo.logoUrl, storeName: storeInfo.storeName };
  const other = lang === "bn" ? "en" : "bn";
  const extras = { langSwitch: <form action={setLanguage.bind(null, other)}><button className="lp-chip" type="submit" lang={other}>{t("switchLang")}</button></form> };

  return (
    <>
      <ThemeStyle tenantId={store.id} />
      {!preview && <StorefrontTracker tracking={tracking} />}
      <LandingEvents slug={slug} contentIds={landing.options.map((o) => o.productId)} value={info.price ?? undefined} preview={Boolean(preview)} />
      <main id="main">
        {preview ? (
          <PreviewBridge kind="landing" initialPage={landing.page} initialTheme={preview.theme} data={data} lang={lang} orderForm={form} adminOrigin={adminOrigin()} landing={info} site={site} extras={extras} />
        ) : (
          <Sections page={landing.page} data={data} lang={lang} t={t} orderForm={form} landing={info} site={site} extras={extras} />
        )}
      </main>
      <LandingDrawer
        slug={slug}
        lang={lang}
        s={pickStrings(lang, LP_FORM_KEYS)}
        buttonText={buttonText || t("lpOrderSubmit")}
        options={landing.options}
        bump={landing.bump}
        utm={{ source: sp.utm_source, campaign: sp.utm_campaign, medium: sp.utm_medium }}
        track={!preview}
      />
      {!preview && !landing.page.sections.some((s) => s.type === "lp-social-proof") && (
        <SocialProofTicker lang={lang} />
      )}
      <footer className="lp-footer">{landing.product.title}<PlatformCredit t={t} /></footer>
    </>
  );
}
