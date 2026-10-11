import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getStoreInfo, loadPageData } from "@biztrackbd/core";
import { Sections } from "@/components/sections";
import { getLang, makeT, money, productTitle } from "@/lib/i18n";
import { absolute, getOrigin } from "@/lib/origin";
import { getPageLayout, loadProductCtx } from "@/lib/page-layout";
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
  const [product, info, origin, lang, layout] = await Promise.all([loadProductCtx(store.id, slug), getStoreInfo(store.id), getOrigin(), getLang(store.locale), getPageLayout(store.id, "product")]);
  if (!product) notFound();
  const { p } = product;
  const t = makeT(lang);
  const inStock = p.variants.some((v) => v.stock > 0);
  const data = await loadPageData(store.id, layout);

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
    <>
      {/* JSON.stringify output cannot contain a closing script tag once < is escaped. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Sections page={layout} data={data} lang={lang} t={t} ctx={{ product }} />
    </>
  );
}
