import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPixelId, getPreview, getPublicLanding, verifyPreviewToken } from "@biztrackbd/core";
import { LandingOrderForm } from "@/components/landing-order-form";
import { PreviewBridge } from "@/components/preview-bridge";
import { Sections } from "@/components/sections";
import { ThemeStyle } from "@/components/theme-style";
import { Pixel } from "@/components/tracker";
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
export default async function LandingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string; utm_source?: string; utm_campaign?: string }> }) {
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

  const pixelId = landing.pixelId ?? (await getPixelId(store.id));
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
      utm={{ source: sp.utm_source, campaign: sp.utm_campaign }}
    />
  );
  const data = { products: {}, categories: [] };

  return (
    <>
      <ThemeStyle tenantId={store.id} />
      {!preview && pixelId && <Pixel pixelId={pixelId} />}
      <main id="main">
        {preview ? (
          <PreviewBridge kind="landing" initialPage={landing.page} initialTheme={preview.theme} data={data} lang={lang} orderForm={form} adminOrigin={adminOrigin()} />
        ) : (
          <Sections page={landing.page} data={data} lang={lang} t={t} orderForm={form} />
        )}
      </main>
      <footer className="lp-footer">{landing.product.title}</footer>
    </>
  );
}
