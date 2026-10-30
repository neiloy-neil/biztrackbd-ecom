import type { Metadata } from "next";
import Link from "next/link";
import { getBlogPosts, readingMinutes } from "@/lib/blog";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: "Guides for Bangladesh Online Sellers",
  description:
    "Practical guides on COD fraud, bKash and Nagad payments, couriers and running an online store in Bangladesh.",
  alternates: { canonical: `${siteUrl}/blog`, types: { "application/rss+xml": `${siteUrl}/blog/feed.xml` } },
  openGraph: {
    type: "website",
    url: `${siteUrl}/blog`,
    siteName: "BizTrackBD",
    title: "Guides for Bangladesh Online Sellers",
    description: "Practical guides on COD fraud, bKash and Nagad payments and couriers.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "BizTrackBD guides" }],
  },
};

export const revalidate = 300;

export default async function BlogIndex() {
  const posts = await getBlogPosts();

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Guides for Bangladesh online sellers",
      url: `${siteUrl}/blog`,
      isPartOf: { "@type": "WebSite", name: "BizTrackBD", url: siteUrl },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: posts.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${siteUrl}/blog/${p.slug}`, name: p.title })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Guides", item: `${siteUrl}/blog` },
      ],
    },
  ];

  return (
    <section className="block">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="wrap prose">
        <nav aria-label="Breadcrumb" className="fine">
          <Link href="/" prefetch={false}>Home</Link> / Guides
        </nav>
        <span className="eyebrow">Guides</span>
        <h1>Guides for Bangladesh online sellers</h1>
        <p>Short, practical reads on COD returns, bKash and Nagad payments and running your store.</p>
        <ul style={{ listStyle: "none", padding: 0, marginTop: 24, display: "grid", gap: 20 }}>
          {posts.map((p) => (
            <li key={p.slug}>
              <h2 style={{ margin: 0, fontSize: 22 }}>
                <Link href={`/blog/${p.slug}`} prefetch={false}>{p.title}</Link>
              </h2>
              <p style={{ margin: "6px 0 0" }}>{p.description}</p>
              <p className="fine" style={{ margin: "4px 0 0" }}>
                {p.publishedAt.toISOString().slice(0, 10)} · {readingMinutes(p.body)} min read
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
