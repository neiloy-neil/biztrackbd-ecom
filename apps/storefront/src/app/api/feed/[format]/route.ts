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
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
          category: { select: { name: true } },
          variants: { select: { stockQuantity: true } },
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
      const priceBdt = `${Number(p.basePrice).toFixed(2)} BDT`;
      const cleanDesc = p.descriptionHtml ? stripHtml(p.descriptionHtml).slice(0, 4500) : p.title;

      return `    <item>
      <g:id>prod_${escapeXml(p.id)}</g:id>
      <g:title><![CDATA[${p.title}]]></g:title>
      <g:description><![CDATA[${cleanDesc}]]></g:description>
      <g:link>${escapeXml(productUrl)}</g:link>
      <g:image_link>${escapeXml(imageUrl)}</g:image_link>
      <g:brand><![CDATA[${info.storeName}]]></g:brand>
      <g:condition>new</g:condition>
      <g:availability>${inStock ? "in stock" : "out of stock"}</g:availability>
      <g:price>${priceBdt}</g:price>
      ${
        p.compareAtPrice && Number(p.compareAtPrice) > Number(p.basePrice)
          ? `<g:sale_price>${priceBdt}</g:sale_price>`
          : ""
      }
      ${p.category?.name ? `<g:product_type><![CDATA[${p.category.name}]]></g:product_type>` : ""}
      <g:identifier_exists>false</g:identifier_exists>
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
