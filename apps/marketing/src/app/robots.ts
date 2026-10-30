import type { MetadataRoute } from "next";

const origin =
  process.env.NEXT_PUBLIC_MARKETING_URL ??
  (process.env.NODE_ENV === "production" ? "https://biztrack.bd" : "http://localhost:3002");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/start/done", "/api/*"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
