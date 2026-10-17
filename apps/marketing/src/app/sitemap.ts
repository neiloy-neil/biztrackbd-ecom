import type { MetadataRoute } from "next";

const origin = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

// Milestone-based release timestamps for authentic search engine indexing
const RELEASE_OCT_17 = new Date("2026-10-17T00:00:00.000Z"); // Newly revised comparison suite, TCO calculator, Business verticals, demo chooser
const RELEASE_OCT_10 = new Date("2026-10-10T00:00:00.000Z"); // Feature deep dives, migration guides, fraud checker tool
const RELEASE_OCT_01 = new Date("2026-10-01T00:00:00.000Z"); // Core templates, security, privacy, terms

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${origin}/`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${origin}/business`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${origin}/demo`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${origin}/features/cod-fraud-protection`,
      lastModified: RELEASE_OCT_10,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${origin}/features/courier-automation`,
      lastModified: RELEASE_OCT_10,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/features/bkash-nagad-cod`,
      lastModified: RELEASE_OCT_10,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/features/profit-cod-reconciliation`,
      lastModified: RELEASE_OCT_10,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/features/meta-pixel-capi`,
      lastModified: RELEASE_OCT_10,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/company-website`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/service-websites`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/doctor-websites`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/restaurant-websites`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/portfolio-websites`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/public-profile-websites`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/templates`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/business/pricing`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/product`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${origin}/tools/courier-fraud-checker`,
      lastModified: RELEASE_OCT_10,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${origin}/features`,
      lastModified: RELEASE_OCT_10,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/compare`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/compare/shopify`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/compare/woocommerce`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/compare/pathao-commerce`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/compare/wix`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/compare/wordpress`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/security`,
      lastModified: RELEASE_OCT_01,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${origin}/data-ownership`,
      lastModified: RELEASE_OCT_01,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${origin}/migrate`,
      lastModified: RELEASE_OCT_10,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${origin}/migrate/shopify`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/migrate/woocommerce`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/templates`,
      lastModified: RELEASE_OCT_01,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${origin}/pricing`,
      lastModified: RELEASE_OCT_17,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/couriers`,
      lastModified: RELEASE_OCT_01,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${origin}/contact`,
      lastModified: RELEASE_OCT_01,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${origin}/privacy`,
      lastModified: RELEASE_OCT_01,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${origin}/terms`,
      lastModified: RELEASE_OCT_01,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
