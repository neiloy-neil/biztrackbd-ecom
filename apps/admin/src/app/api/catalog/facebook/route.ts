import { NextResponse } from "next/server";
import { getStoreInfo, listProducts } from "@biztrackbd/core";
import { resolveTenantByHost, withTenant } from "@biztrackbd/db";
import { getSessionOrNull } from "@/lib/session";

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
 * Resolves tenant via logged-in merchant admin session OR via ?store=<subdomain>
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? (process.env.NODE_ENV === "production" ? "biztrack.bd" : "localhost:3000");
  const proto = rootDomain.startsWith("localhost") ? "http" : "https";

  let tenantId: string | null = null;
  let tenantSubdomain: string | null = null;

  // 1. Check if user is logged into admin
  const session = await getSessionOrNull();
  if (session) {
    tenantId = session.tenantId;
    tenantSubdomain = session.tenantSubdomain;
  }

  // 2. Allow ?store=<subdomain> query parameter
  const storeParam = url.searchParams.get("store") || url.searchParams.get("subdomain");
  if (storeParam) {
    const clean = storeParam.trim().toLowerCase();
    const resolved = await resolveTenantByHost(`${clean}.${rootDomain}`, rootDomain).catch(() => null);
    if (resolved) {
      tenantId = resolved.id;
      tenantSubdomain = resolved.subdomain;
    }
  }

  // 3. Fallback: if accessed directly without session or param (e.g. Meta crawler or direct link), use first active store
  if (!tenantId || !tenantSubdomain) {
    const { getBasePrisma } = await import("@biztrackbd/db");
    const base = getBasePrisma();
    const fallbackTenant = await base.tenant
      .findFirst({
        where: { status: "ACTIVE" },
        select: { id: true, subdomain: true },
        orderBy: { createdAt: "asc" },
      })
      .catch(() => null);

    if (fallbackTenant) {
      tenantId = fallbackTenant.id;
      tenantSubdomain = fallbackTenant.subdomain;
    }
  }

  if (!tenantId || !tenantSubdomain) {
    return new NextResponse(
      "Store not found. Please log in to admin, pass ?store=<subdomain>, or create an active store.",
      { status: 404 }
    );
  }

  // Lookup customDomain if any
  const t = await withTenant(tenantId, (tx) =>
    tx.tenant.findUnique({ where: { id: tenantId! }, select: { customDomain: true } })
  ).catch(() => null);
  const customDomain = t?.customDomain ?? null;

  const baseUrl = customDomain ? `https://${customDomain}` : `${proto}://${tenantSubdomain}.${rootDomain}`;

  const [info, productResult] = await Promise.all([
    getStoreInfo(tenantId),
    listProducts(tenantId, { limit: 500 }),
  ]);

  const itemsXml = productResult.items
    .map((p) => {
      const link = `${baseUrl}/products/${p.slug}`;
      const img = p.imageUrl ? (p.imageUrl.startsWith("http") ? p.imageUrl : baseUrl + p.imageUrl) : "";
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
