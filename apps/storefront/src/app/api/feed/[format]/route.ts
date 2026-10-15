import { NextResponse, type NextRequest } from "next/server";
import { getStoreInfo } from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { getOrigin } from "@/lib/origin";
import { findStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>?/gm, "").trim();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ format: string }> },
) {
  const { format } = await params;
  if (!["facebook.xml", "google.xml", "catalog.xml"].includes(format)) {
    return new NextResponse("Supported feeds: facebook.xml, google.xml", { status: 404 });
  }

  const store = await findStore();
  if (!store) {
    return new NextResponse("Store not found", { status: 404 });
  }

  const [info, origin, products] = await Promise.all([
    getStoreInfo(store.id),
    getOrigin(),
    withTenant(store.id, (tx) =>
      tx.product.findMany({
        where: { status: "ACTIVE", deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1000,
        include: {
          images: { orderBy: { sortOrder: "asc" }, take: 10 },
          category: { select: { name: true } },
          variants: { select: { stockQuantity: true, sku: true, barcode: true }, take: 50 },
        },
      }),
    ),
  ]);

  const itemsXml = products
    .map((p) => {
      const inStock = p.variants.some((v) => v.stockQuantity > 0);
      const productUrl = `${origin}/products/${encodeURIComponent(p.slug)}`;
      const rawImage = p.images[0]?.url;
      const imageUrl = rawImage
        ? rawImage.startsWith("http")
          ? rawImage
          : `${origin}${rawImage}`
        : `${origin}/placeholder-product.png`;

      const base = Number(p.basePrice);
      const compare = p.compareAtPrice ? Number(p.compareAtPrice) : 0;
      const isOnSale = compare > base;
      const regularPriceBdt = `${(isOnSale ? compare : base).toFixed(2)} BDT`;
      const salePriceBdt = `${base.toFixed(2)} BDT`;

      const cleanDesc = p.descriptionHtml ? stripHtml(p.descriptionHtml).slice(0, 4500) : p.title;

      const additionalImages = p.images
        .slice(1)
        .map((img) => {
          const u = img.url.startsWith("http") ? img.url : `${origin}${img.url}`;
          return `      <g:additional_image_link>${escapeXml(u)}</g:additional_image_link>`;
        })
        .join("\n");

      const gtin = p.variants.find((v) => v.barcode?.trim())?.barcode?.trim();
      const mpn = p.variants.find((v) => v.sku?.trim())?.sku?.trim();
      const identifierTags = gtin
        ? `      <g:gtin>${escapeXml(gtin)}</g:gtin>`
        : mpn
        ? `      <g:mpn>${escapeXml(mpn)}</g:mpn>`
        : `      <g:identifier_exists>no</g:identifier_exists>`;

      return `    <item>
      <g:id>prod_${escapeXml(p.id)}</g:id>
      <g:title><![CDATA[${p.title}]]></g:title>
      <g:description><![CDATA[${cleanDesc}]]></g:description>
      <g:link>${escapeXml(productUrl)}</g:link>
      <g:image_link>${escapeXml(imageUrl)}</g:image_link>
${additionalImages ? `${additionalImages}\n` : ""}      <g:brand><![CDATA[${info.storeName}]]></g:brand>
      <g:condition>new</g:condition>
      <g:availability>${inStock ? "in stock" : "out of stock"}</g:availability>
      <g:price>${regularPriceBdt}</g:price>
      ${isOnSale ? `<g:sale_price>${salePriceBdt}</g:sale_price>` : ""}
      ${p.category?.name ? `<g:product_type><![CDATA[${p.category.name}]]></g:product_type>` : ""}
${identifierTags}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title><![CDATA[${info.storeName} - Product Catalog]]></title>
    <link>${escapeXml(origin)}</link>
    <description><![CDATA[${info.tagline || `Products from ${info.storeName}`}]]></description>
${itemsXml}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
