import type { MetadataRoute } from "next";

const origin = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/templates", "/pricing"].map((path) => ({ url: `${origin}${path}`, changeFrequency: "weekly", priority: path === "/" ? 1 : 0.7 }));
}
