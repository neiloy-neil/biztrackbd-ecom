import type { MetadataRoute } from "next";
import sitemapDates from "@/lib/sitemap-dates.json";
import { getBlogPosts } from "@/lib/blog";

const origin = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";
const dates = sitemapDates as Record<string, string>;
const FALLBACK_DATE = new Date("2026-10-17T00:00:00.000Z");

function getModifiedDate(path: string): Date {
  const iso = dates[path];
  return iso ? new Date(iso) : FALLBACK_DATE;
}

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const blogPosts = await getBlogPosts();
  return [
    {
      url: `${origin}/`,
      lastModified: getModifiedDate("/"),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${origin}/business`,
      lastModified: getModifiedDate("/business"),
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${origin}/demo`,
      lastModified: getModifiedDate("/demo"),
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${origin}/features/cod-fraud-protection`,
      lastModified: getModifiedDate("/features/cod-fraud-protection"),
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${origin}/features/courier-automation`,
      lastModified: getModifiedDate("/features/courier-automation"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/features/bkash-nagad-cod`,
      lastModified: getModifiedDate("/features/bkash-nagad-cod"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/features/profit-cod-reconciliation`,
      lastModified: getModifiedDate("/features/profit-cod-reconciliation"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/features/meta-pixel-capi`,
      lastModified: getModifiedDate("/features/meta-pixel-capi"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/company-website`,
      lastModified: getModifiedDate("/business/company-website"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/service-websites`,
      lastModified: getModifiedDate("/business/service-websites"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/doctor-websites`,
      lastModified: getModifiedDate("/business/doctor-websites"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/restaurant-websites`,
      lastModified: getModifiedDate("/business/restaurant-websites"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/portfolio-websites`,
      lastModified: getModifiedDate("/business/portfolio-websites"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/public-profile-websites`,
      lastModified: getModifiedDate("/business/public-profile-websites"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/templates`,
      lastModified: getModifiedDate("/business/templates"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/pricing`,
      lastModified: getModifiedDate("/business/pricing"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/product`,
      lastModified: getModifiedDate("/product"),
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${origin}/tools/courier-fraud-checker`,
      lastModified: getModifiedDate("/tools/courier-fraud-checker"),
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${origin}/features`,
      lastModified: getModifiedDate("/features"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/compare`,
      lastModified: getModifiedDate("/compare"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/compare/shopify`,
      lastModified: getModifiedDate("/compare/shopify"),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/compare/woocommerce`,
      lastModified: getModifiedDate("/compare/woocommerce"),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/compare/pathao-commerce`,
      lastModified: getModifiedDate("/compare/pathao-commerce"),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/compare/wix`,
      lastModified: getModifiedDate("/compare/wix"),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/compare/wordpress`,
      lastModified: getModifiedDate("/compare/wordpress"),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/security`,
      lastModified: getModifiedDate("/security"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${origin}/data-ownership`,
      lastModified: getModifiedDate("/data-ownership"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${origin}/migrate`,
      lastModified: getModifiedDate("/migrate"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/migrate/shopify`,
      lastModified: getModifiedDate("/migrate/shopify"),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/migrate/woocommerce`,
      lastModified: getModifiedDate("/migrate/woocommerce"),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/templates`,
      lastModified: getModifiedDate("/templates"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${origin}/pricing`,
      lastModified: getModifiedDate("/pricing"),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/couriers`,
      lastModified: getModifiedDate("/couriers"),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/about`,
      lastModified: getModifiedDate("/about"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${origin}/blog`,
      lastModified: blogPosts[0]?.updatedAt ?? FALLBACK_DATE,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...blogPosts.map((post) => ({
      url: `${origin}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    {
      url: `${origin}/contact`,
      lastModified: getModifiedDate("/contact"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${origin}/privacy`,
      lastModified: getModifiedDate("/privacy"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${origin}/terms`,
      lastModified: getModifiedDate("/terms"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
