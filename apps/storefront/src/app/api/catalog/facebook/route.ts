import { NextResponse } from "next/server";
import { getStoreInfo, listProducts } from "@biztrackbd/core";
import { findStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

/**
 * Facebook Catalog Product Feed (RSS 2.0 / Google Merchant spec)
 * Used by Meta Commerce Manager for Dynamic Product Ads (DPA) and Instagram Shop tags.
 * URL: https://store.biztrackbd.com/api/catalog/facebook
 */
export async function GET(req: Request) {
  const store = await findStore();
  if (!store) {
    return new NextResponse("Store not found", { status: 404 });
  }

  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const [info, productResult] = await Promise.all([
    getStoreInfo(store.id),
    listProducts(store.id, { limit: 500 }),
  ]);

  const itemsXml = productResult.items
    .map((p) => {
      const link = `${baseUrl}/products/${p.slug}`;
      const img = p.imageUrl ? `${p.imageUrl.startsWith("http") ? p.imageUrl : baseUrl + p.imageUrl}` : "";
      const priceStr = `${p.price.toFixed(2)} BDT`;
      const availability = p.inStock ? "in stock" : "out of stock";
      const brand = info.storeName || "BizTrackBD Store";

      return `    <item>
      <g:id>${escapeXml(p.id)}</g:id>
      <g:title>${escapeXml(p.title)}</g:title>
      <g:description>${escapeXml(p.titleBn || p.title)}</g:description>
      <g:link>${escapeXml(link)}</g:link>
      <g:image_link>${escapeXml(img)}</g:image_link>
      <g:brand>${escapeXml(brand)}</g:brand>
      <g:condition>new</g:condition>
      <g:availability>${availability}</g:availability>
      <g:price>${priceStr}</g:price>
      ${p.compareAtPrice && p.compareAtPrice > p.price ? `<g:sale_price>${p.price.toFixed(2)} BDT</g:sale_price>` : ""}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>${escapeXml(info.storeName)} Product Catalog</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Product feed for Meta Dynamic Product Ads</description>
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
