import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getReviewSummary, getStoreInfo, listPublicReviews, sanitizeProductHtml } from "@biztrackbd/core";
import { ProductCard } from "@/components/product-card";
import { tintFor } from "@/components/product-image";
import { PurchasePanel } from "@/components/purchase-panel";
import { ViewContent } from "@/components/tracker";
import { SwapIcon, TruckIcon, WalletIcon } from "@/components/icons";
import { getLang, makeT, money, num, productTitle } from "@/lib/i18n";
import { absolute, getOrigin } from "@/lib/origin";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStore();
  const [p, info, origin] = await Promise.all([getProductBySlug(store.id, slug), getStoreInfo(store.id), getOrigin()]);
  if (!p) return { title: "Not found" };
  const lang = await getLang(store.locale);
  const title = p.seoTitle ?? productTitle(lang, p.title, p.titleBn);
  const plain = (p.seoDescription ?? p.shortExcerpt ?? p.descriptionHtml.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 160);
  const description = `${money(p.price, "en")}. ${plain || `Buy ${p.title} online from ${info.storeName}.`}`;
  const image = absolute(origin, p.images[0]?.url);
  return {
    title,
    description,
    alternates: { canonical: `/products/${slug}` },
    openGraph: { type: "website", title, description, url: `/products/${slug}`, siteName: info.storeName, images: image ? [{ url: image, width: 900, height: 1200, alt: p.images[0]?.alt ?? p.title }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const store = await getStore();
  const [p, info, origin, lang] = await Promise.all([getProductBySlug(store.id, slug), getStoreInfo(store.id), getOrigin(), getLang(store.locale)]);
  if (!p) notFound();
  const t = makeT(lang);
  const title = productTitle(lang, p.title, p.titleBn);
  const onSale = p.compareAtPrice != null && p.compareAtPrice > p.price;
  const hasChoices = p.variants.length > 1 || (p.variants[0] !== undefined && p.variants[0].title.toLowerCase() !== "default");
  const prices = Object.fromEntries(p.variants.map((v) => [v.id, money(v.price, lang)]));
  const inStock = p.variants.some((v) => v.stock > 0);
  const [summary, reviews] = await Promise.all([getReviewSummary(store.id, p.id), listPublicReviews(store.id, p.id, 10)]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    image: p.images.map((i) => absolute(origin, i.url)),
    description: p.shortExcerpt ?? p.descriptionHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300),
    sku: p.variants[0]?.id,
    brand: { "@type": "Brand", name: info.storeName },
    ...(p.rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating.average, reviewCount: p.rating.count } } : {}),
    offers: {
      "@type": "Offer", url: `${origin}/products/${slug}`, priceCurrency: "BDT", price: p.price,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <div className="wrap has-sticky">
      {/* JSON.stringify output cannot contain a closing script tag once < is escaped. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {p.variants[0] && <ViewContent id={p.variants[0].id} />}
      <div className="pdp">
        <div className="gallery">
          <div className="track" tabIndex={0} role="region" aria-label={title}>
            {(p.images.length ? p.images : [{ url: "", alt: null }]).map((img, i) => (
              <div key={img.url || i} className="slide" style={{ background: tintFor(p.id) }}>
                {img.url ? (
                  <Image src={img.url} alt={img.alt ?? title} fill sizes="(max-width: 900px) 100vw, 50vw" priority={i === 0} quality={75} />
                ) : (
                  <div className="ph" aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><i style={{ width: "30%", aspectRatio: "9/11", background: "rgba(43,33,24,.14)", borderRadius: 14 }} /></div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="pdp-info">
          {p.categoryName && <div className="crumb">{p.categoryName}</div>}
          <h1>{title}</h1>
          <div className="stars">
            {p.rating ? (<><span className="s" aria-hidden="true">{"★".repeat(Math.round(p.rating.average))}</span><span>{num(p.rating.average, lang)} · {t("reviews", { n: num(p.rating.count, lang) })}</span></>) : <span>{t("noReviews")}</span>}
          </div>
          <div className="pdp-price">
            <span className="price" data-testid="pdp-price">{money(p.price, lang)}</span>
            {onSale && <><span className="was">{money(p.compareAtPrice!, lang)}</span><span className="save">{t("save", { amount: money(p.compareAtPrice! - p.price, lang) })}</span></>}
          </div>

          <PurchasePanel
            variants={p.variants.map((v) => ({ id: v.id, title: v.title, price: v.price, compareAtPrice: v.compareAtPrice, stock: v.stock }))}
            hasChoices={hasChoices}
            text={{ size: t("size"), chooseSize: t("chooseSize"), quantity: t("quantity"), addToCart: t("addToCart"), buyNow: t("buyNow"), added: t("added"), viewCart: t("viewCart"), soldOut: t("soldOut"), onlyLeft: t("onlyLeft", { n: "{n}", size: "{size}" }), priceLabel: prices }}
          />

          <div className="assure">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}><TruckIcon /><div><b>{t("assureDeliveryT")}</b> <span>{t("assureDeliveryS")}</span></div></div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}><WalletIcon /><div><b>{t("assurePayT")}</b><br /><span>{t("assurePayS")}</span></div></div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}><SwapIcon /><div><b>{t("assureExchangeT")}</b><br /><span>{t("assureExchangeS")}</span></div></div>
          </div>

          <div className="acc">
            <details open>
              <summary>{t("description")}</summary>
              <div className="body" dangerouslySetInnerHTML={{ __html: sanitizeProductHtml(p.descriptionHtml) }} />
            </details>
          </div>
        </div>
      </div>

      <section className="section" aria-labelledby="revs" data-testid="reviews">
        <div className="section-head"><h2 id="revs">{t("reviewsTitle")}</h2>{summary.average !== null && <span className="muted" data-testid="reviews-average">{"★".repeat(Math.round(summary.average))} {t("reviewsAverage", { avg: num(summary.average, lang) })} · {t("reviews", { n: num(summary.count, lang) })}</span>}</div>
        {reviews.length === 0 ? <p className="muted">{t("noReviews")}</p> : (
          <div className="stack">
            {reviews.map((r) => (
              <article key={r.id} className="card" data-testid="review">
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><span aria-label={t("starsN", { n: num(r.rating, lang) })} style={{ color: "var(--accent)" }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>{r.title && <b>{r.title}</b>}</div>
                <p style={{ marginTop: 6, overflowWrap: "anywhere" }}>{r.body}</p>
                <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{r.author} · {t("verifiedBuyer")}</p>
                {r.reply && <p style={{ marginTop: 8, paddingLeft: 12, borderLeft: "3px solid var(--line)", fontSize: 14 }}><b>{t("storeReply")}:</b> {r.reply}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      {p.related.length > 0 && (
        <section className="section" aria-labelledby="rel">
          <div className="section-head"><h2 id="rel">{t("goesWith")}</h2><Link href="/search" className="link-accent">{t("viewAll")}</Link></div>
          <div className="grid grid-4">{p.related.map((r) => <ProductCard key={r.id} p={r} lang={lang} t={t} />)}</div>
        </section>
      )}
    </div>
  );
}
