import Link from "next/link";
import {
  getStorefrontSettings,
  getLive,
  listCategories,
  listProducts,
  loadPageData,
  getStoreInfo,
  getTenantModeAndVertical,
  getBusinessTemplateByVertical,
} from "@biztrackbd/core";
import { Sections } from "@/components/sections";
import { ProductCard } from "@/components/product-card";
import { ProductImage, tintFor } from "@/components/product-image";
import { getLang, makeT } from "@/lib/i18n";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function Home() {
  const store = await getStore();
  const [lang, storeInfo, { siteMode, vertical }] = await Promise.all([
    getLang(store.locale),
    getStoreInfo(store.id),
    getTenantModeAndVertical(store.id),
  ]);
  const t = makeT(lang);
  const site = {
    phone: storeInfo.contactPhone,
    whatsapp: storeInfo.whatsappNumber,
    address: storeInfo.addressLine,
    logoUrl: storeInfo.logoUrl,
    storeName: storeInfo.storeName,
    siteMode,
    businessVertical: vertical ?? undefined,
  };

  // A store that has published a layout in the editor shows it.
  const live = await getLive(store.id, "home");
  if (live) return <Sections page={live.page} data={await loadPageData(store.id, live.page)} lang={lang} t={t} site={site} />;

  // Portfolio or Hybrid tenants with vertical without custom published layout render their curated vertical template manifest
  if (siteMode === "PORTFOLIO" || (siteMode === "HYBRID" && vertical)) {
    const template = getBusinessTemplateByVertical(vertical);
    const fallbackHome = template?.pages.home;
    if (fallbackHome) {
      const data = await loadPageData(store.id, fallbackHome);
      return <Sections page={fallbackHome} data={data} lang={lang} t={t} site={site} />;
    }
  }

  const [theme, categories, { items }] = await Promise.all([getStorefrontSettings(store.id), listCategories(store.id), listProducts(store.id, { limit: 8, sort: "newest" })]);
  const bn = lang === "bn";
  const heroImages = items.filter((p) => p.imageUrl).slice(0, 2);

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div>
            <div className="eyebrow">{bn ? theme.heroEyebrowBn : theme.heroEyebrow}</div>
            <h1>{bn ? theme.heroTitleBn : theme.heroTitle}</h1>
            <p>{bn ? theme.heroTextBn : theme.heroText}</p>
            <div className="ctas">
              <Link href="/search?sort=newest" className="btn btn-primary">{bn ? theme.heroCtaBn : theme.heroCta}</Link>
              <Link href="/search" className="btn btn-ghost">{t("all")}</Link>
            </div>
          </div>
          <div className="art" aria-hidden="true">
            {heroImages.map((p, i) => <ProductImage key={p.id} src={p.imageUrl} alt="" seed={p.id} sizes="230px" priority={i === 0} />)}
          </div>
        </div>
      </section>

      <div className="wrap">
        <section className="section" aria-labelledby="new">
          <div className="section-head">
            <h2 id="new">{bn ? theme.newArrivalsTitleBn : theme.newArrivalsTitle}</h2>
            <Link href="/search?sort=newest" className="link-accent">{t("viewAll")}</Link>
          </div>
          <div className="grid grid-4">
            {items.slice(0, 8).map((p, i) => <ProductCard key={p.id} p={p} lang={lang} t={t} priority={i < 2} />)}
          </div>
        </section>

        {categories.length > 0 && (
          <section className="section" aria-labelledby="cats">
            <div className="section-head"><h2 id="cats">{t("shopByCategory")}</h2></div>
            <div className="cats">
              {categories.slice(0, 3).map((c) => (
                <Link key={c.id} href={`/c/${c.slug}`} className="cat" style={{ background: tintFor(c.id) }}>{c.name}</Link>
              ))}
            </div>
          </section>
        )}

        <section className="section">
          <div className="trust">
            <div><b>{t("trustCodT")}</b><span>{t("trustCodS")}</span></div>
            <div><b>{t("trustMfsT")}</b><span>{t("trustMfsS")}</span></div>
            <div><b>{t("trustDeliveryT")}</b><span>{t("trustDeliveryS")}</span></div>
            <div><b>{t("trustExchangeT")}</b><span>{t("trustExchangeS")}</span></div>
          </div>
        </section>
      </div>
    </>
  );
}
