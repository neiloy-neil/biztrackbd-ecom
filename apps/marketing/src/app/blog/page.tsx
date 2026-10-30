import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_POSTS } from "@/lib/blog";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: "Guides for Bangladesh Online Sellers",
  description:
    "Practical guides on COD fraud, bKash and Nagad payments, couriers and running an online store in Bangladesh.",
  alternates: { canonical: `${siteUrl}/blog` },
  openGraph: {
    type: "website",
    url: `${siteUrl}/blog`,
    siteName: "BizTrackBD",
    title: "Guides for Bangladesh Online Sellers",
    description: "Practical guides on COD fraud, bKash and Nagad payments and couriers.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "BizTrackBD guides" }],
  },
};

export default function BlogIndex() {
  return (
    <section className="block">
      <div className="wrap prose">
        <span className="eyebrow">Guides</span>
        <h1>Guides for Bangladesh online sellers</h1>
        <p>Short, practical reads on COD returns, bKash and Nagad payments and running your store.</p>
        <ul style={{ listStyle: "none", padding: 0, marginTop: 24, display: "grid", gap: 20 }}>
          {BLOG_POSTS.map((p) => (
            <li key={p.slug}>
              <h2 style={{ margin: 0, fontSize: 22 }}>
                <Link href={`/blog/${p.slug}`} prefetch={false}>
                  {p.title}
                </Link>
              </h2>
              <p style={{ margin: "6px 0 0" }}>{p.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
