import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  customKey,
  customPageIdBySlug,
  getPreview,
  getPublicCustomPage,
  getPublishedPage,
  getStoreInfo,
  getTenantModeAndVertical,
  loadPageData,
  verifyPreviewToken,
  getBusinessTemplateByVertical,
} from "@biztrackbd/core";
import { PreviewBridge } from "@/components/preview-bridge";
import { Sections } from "@/components/sections";
import { getLang, makeT } from "@/lib/i18n";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const RESERVED_SLUGS = new Set([
  "api", "admin", "cart", "checkout", "products", "c", "p", "blog", "l",
  "order", "account", "login", "search", "draft", "wholesale", "media",
  "go", "ref", "partner", "icon.svg", "robots.txt", "sitemap.xml", "manifest.json"
]);

const adminOrigin = () => {
  try {
    return process.env.NEXT_PUBLIC_ADMIN_URL ? new URL(process.env.NEXT_PUBLIC_ADMIN_URL).origin : undefined;
  } catch {
    return undefined;
  }
};

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> }): Promise<Metadata> {
  const [{ slug }, { preview }] = await Promise.all([params, searchParams]);
  if (RESERVED_SLUGS.has(slug.toLowerCase())) return { title: "Not found", robots: { index: false } };
  const store = await getStore();
  if (preview) return { title: "Preview", robots: { index: false, follow: false }, referrer: "no-referrer" };
  const custom = await getPublicCustomPage(store.id, slug);
  if (custom) return { title: custom.seoTitle || custom.title, description: custom.seoDescription ?? undefined, alternates: { canonical: `/${slug}` } };
  const page = await getPublishedPage(store.id, slug);
  if (page) return { title: page.title, alternates: { canonical: `/${slug}` } };

  // Fallback to vertical template manifest custom page if in PORTFOLIO or HYBRID mode
  const { siteMode, vertical } = await getTenantModeAndVertical(store.id);
  if (siteMode === "PORTFOLIO" || (siteMode === "HYBRID" && vertical)) {
    const template = getBusinessTemplateByVertical(vertical);
    const manifestPage = template?.customPages.find((p) => p.slug === slug);
    if (manifestPage) {
      return {
        title: manifestPage.title,
        description: manifestPage.description,
        alternates: { canonical: `/${slug}` },
      };
    }
  }

  return { title: "Not found", robots: { index: false } };
}

/**
 * A store page rendered directly at the root URL (/[slug]).
 * A page built from sections (About us, Contact, Menu, Services...) is drawn from its layout;
 * an ordinary page such as policy or terms is rendered from its sanitized HTML.
 */
export default async function CleanRootStorePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  if (RESERVED_SLUGS.has(slug.toLowerCase())) notFound();
  const store = await getStore();

  // The editor's preview: a draft is private to the people editing it, and only for this store.
  let preview: Awaited<ReturnType<typeof getPreview>> | undefined;
  if (sp.preview) {
    if (verifyPreviewToken(sp.preview) !== store.id) notFound();
    const id = await customPageIdBySlug(store.id, slug);
    if (!id) notFound();
    preview = await getPreview(store.id, customKey(id));
  }

  const custom = await getPublicCustomPage(store.id, slug, preview ? { page: preview.page } : undefined);
  if (custom) {
    const [info, lang, modeMeta] = await Promise.all([
      getStoreInfo(store.id),
      getLang(store.locale),
      getTenantModeAndVertical(store.id),
    ]);
    const t = makeT(lang);
    const data = await loadPageData(store.id, custom.page, { everything: Boolean(preview) });
    const site = {
      phone: info.contactPhone,
      whatsapp: info.whatsappNumber,
      address: info.addressLine,
      logoUrl: info.logoUrl,
      storeName: info.storeName,
      siteMode: modeMeta.siteMode,
      businessVertical: modeMeta.vertical ?? undefined,
    };
    return (
      <article data-testid="store-page-sections" style={{ paddingBottom: 40 }}>
        {preview
          ? <PreviewBridge kind="custom" initialPage={custom.page} initialTheme={preview.theme} data={data} lang={lang} adminOrigin={adminOrigin()} site={site} />
          : <Sections page={custom.page} data={data} lang={lang} t={t} site={site} />}
      </article>
    );
  }

  const page = await getPublishedPage(store.id, slug);
  if (page) {
    return (
      <article className="wrap" style={{ padding: "28px var(--gutter) 56px" }} data-testid="store-page">
        <h1 className="page-title" style={{ paddingTop: 0 }}>{page.title}</h1>
        <div className="prose" dangerouslySetInnerHTML={{ __html: page.contentHtml }} />
      </article>
    );
  }

  // Fallback to business template custom page (e.g. services, appointment, reservations)
  const modeMeta = await getTenantModeAndVertical(store.id);
  if (modeMeta.siteMode === "PORTFOLIO" || (modeMeta.siteMode === "HYBRID" && modeMeta.vertical)) {
    const template = getBusinessTemplateByVertical(modeMeta.vertical);
    const manifestPage = template?.customPages.find((p) => p.slug === slug);
    if (manifestPage) {
      const [info, lang] = await Promise.all([
        getStoreInfo(store.id),
        getLang(store.locale),
      ]);
      const t = makeT(lang);
      const data = await loadPageData(store.id, manifestPage.layout);
      const site = {
        phone: info.contactPhone,
        whatsapp: info.whatsappNumber,
        address: info.addressLine,
        logoUrl: info.logoUrl,
        storeName: info.storeName,
        siteMode: modeMeta.siteMode,
        businessVertical: modeMeta.vertical ?? undefined,
      };
      return (
        <article data-testid="store-page-sections" style={{ paddingBottom: 40 }}>
          <Sections page={manifestPage.layout} data={data} lang={lang} t={t} site={site} />
        </article>
      );
    }
  }

  notFound();
}
