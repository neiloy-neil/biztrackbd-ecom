import { NextResponse, type NextRequest } from "next/server";
import { storeOriginFor } from "@biztrackbd/core";
import { resolveTenantByHost } from "@biztrackbd/db";
import { getSessionOrNull } from "@/lib/session";

export const dynamic = "force-dynamic";

const FEEDS = ["facebook.xml", "google.xml", "catalog.xml"];

/**
 * Friendly product-feed addresses on the admin host (/api/feed/facebook.xml, google.xml, catalog.xml).
 *
 * The feed itself is served by the store, on the store's own address, so that is where these send the crawler: a permanent redirect to
 * https://<store>/api/catalog/facebook. The store is named by ?store=<subdomain>, or is the signed-in merchant's own store.
 * There is deliberately no fallback to "some store": a missing or wrong name is a plain 404, never another store's catalogue.
 * Public on purpose (Meta and Google fetch it without signing in): it only redirects, and the store shows the same published products to anyone.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ format: string }> }) {
  const { format } = await params;
  if (!FEEDS.includes(format)) return new NextResponse(`Supported feeds: ${FEEDS.join(", ")}`, { status: 404 });

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const named = (req.nextUrl.searchParams.get("store") ?? req.nextUrl.searchParams.get("subdomain"))?.trim().toLowerCase();
  let tenantId: string | null = null;
  if (named) {
    if (!/^[a-z0-9-]{1,63}$/.test(named)) return new NextResponse("Store not found", { status: 404 });
    tenantId = (await resolveTenantByHost(`${named}.${rootDomain}`, rootDomain).catch(() => null))?.id ?? null;
  } else {
    tenantId = (await getSessionOrNull())?.tenantId ?? null;
  }
  if (!tenantId) return new NextResponse("Store not found. Add ?store=<your store name> to this address, or use https://<your store address>/api/catalog/facebook.", { status: 404 });

  const target = `${await storeOriginFor(tenantId)}/api/catalog/facebook`;
  return NextResponse.redirect(target, 308);
}
