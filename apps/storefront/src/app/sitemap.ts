import type { MetadataRoute } from "next";
import { listCategorySlugs, listContentSlugs, listProductSlugs, listPublishedLandingSlugs } from "@biztrackbd/core";
import { getOrigin } from "@/lib/origin";
import { findStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Cache dynamic sitemap at the edge for 1 hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const store = await findStore();
  if (!store) return [];
  const [origin, products, categories, content, landings] = await Promise.all([
    getOrigin(),
    listProductSlugs(store.id),
    listCategorySlugs(store.id),
    listContentSlugs(store.id),
    listPublishedLandingSlugs(store.id).catch(() => []),
  ]);
  return [
    { url: `${origin}/`, changeFrequency: "daily", priority: 1.0 },
    ...categories.map((c) => ({ url: `${origin}/c/${c.slug}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...content.pages.map((p) => ({ url: `${origin}/p/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.4 })),
    ...content.posts.map((p) => ({ url: `${origin}/blog/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...landings.map((l) => ({ url: `${origin}/l/${l.slug}`, lastModified: l.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...products.map((p) => ({
      url: `${origin}/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.9,
      images: p.imageUrl ? [p.imageUrl.startsWith("http") ? p.imageUrl : `${origin}${p.imageUrl}`] : undefined,
    })),
  ];
}
