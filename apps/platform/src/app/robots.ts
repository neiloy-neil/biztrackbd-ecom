import type { MetadataRoute } from "next";

/** The signed-in apps are never for search engines. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
