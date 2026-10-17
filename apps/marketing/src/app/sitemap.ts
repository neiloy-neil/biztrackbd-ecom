import type { MetadataRoute } from "next";

const origin = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: `${origin}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${origin}/business`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${origin}/demo`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${origin}/features/cod-fraud-protection`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${origin}/features/courier-automation`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/features/bkash-nagad-cod`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/features/profit-cod-reconciliation`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/features/meta-pixel-capi`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/company-website`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/service-websites`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/doctor-websites`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/restaurant-websites`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/portfolio-websites`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/public-profile-websites`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/templates`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/pricing`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/product`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${origin}/tools/courier-fraud-checker`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${origin}/features`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/compare`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/compare/shopify`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/compare/woocommerce`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/compare/pathao-commerce`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/compare/wix`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/compare/wordpress`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/security`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${origin}/data-ownership`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${origin}/migrate`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/migrate/shopify`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/migrate/woocommerce`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/templates`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${origin}/pricing`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${origin}/couriers`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${origin}/privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${origin}/terms`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
