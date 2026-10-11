import type { MetadataRoute } from "next";
import { getOrigin } from "@/lib/origin";
import { findStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const store = await findStore();
  // Hosts that are not a store (unknown, offline) must not be indexed at all.
  if (!store) return { rules: { userAgent: "*", disallow: "/" } };
  const origin = await getOrigin();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/cart", "/checkout", "/account", "/order/", "/search", "/api/"] },
    sitemap: `${origin}/sitemap.xml`,
  };
}
