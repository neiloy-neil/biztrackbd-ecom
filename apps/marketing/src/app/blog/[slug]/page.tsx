import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { coverUrlFor, getBlogPost, getRelatedPosts, parseBlogBody, plainText, readingMinutes, wordCount } from "@/lib/blog";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

type Params = { slug: string };

export const revalidate = 300;

// Nothing is built ahead of time, but returning a list lets each guide be cached after its first visit and refreshed every 5 minutes.
export function generateStaticParams(): Params[] {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return {};
  const url = `${siteUrl}/blog/${post.slug}`;
  const title = post.seoTitle ?? post.title;
  const description = post.seoDescription ?? post.description;
  // A cover staff uploaded is named here. Without one, Next adds the drawn cover from opengraph-image.tsx next to this page.
  const uploaded = post.coverImage ? [{ url: coverUrlFor(post, siteUrl), width: 1200, height: 630, alt: post.coverAlt ?? post.title }] : undefined;
  return {
    title,
    description,
    robots: post.noindex ? { index: false, follow: true } : undefined,
    alternates: { canonical: url },
    authors: [{ name: "BizTrackBD" }],
    openGraph: {
      type: "article",
      url,
      siteName: "BizTrackBD",
      locale: "en_BD",
      title,
      description,
      ...(uploaded ? { images: uploaded } : {}),
      publishedTime: post.publishedAt.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: ["BizTrackBD"],
    },
    twitter: { card: "summary_large_image", title, description, ...(uploaded ? { images: [uploaded[0]!.url] } : {}) },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const url = `${siteUrl}/blog/${post.slug}`;
  const coverUrl = coverUrlFor(post, siteUrl);
  const related = await getRelatedPosts(post.slug);
  const minutes = readingMinutes(post.body);
  const blocks = parseBlogBody(post.body);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      headline: post.title,
      description: post.seoDescription ?? post.description,
      url,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      image: [coverUrl],
      datePublished: post.publishedAt.toISOString(),
      dateModified: post.updatedAt.toISOString(),
      inLanguage: "en",
      isAccessibleForFree: true,
      wordCount: wordCount(post.body),
      articleBody: plainText(post.body),
      author: { "@type": "Organization", name: "BizTrackBD", url: siteUrl },
      publisher: { "@type": "Organization", name: "BizTrackBD", url: siteUrl, logo: { "@type": "ImageObject", url: `${siteUrl}/icon.svg` } },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Guides", item: `${siteUrl}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];

  return (
    <section className="block">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="wrap prose">
        <nav aria-label="Breadcrumb" className="fine">
          <Link href="/" prefetch={false}>Home</Link> / <Link href="/blog" prefetch={false}>Guides</Link>
        </nav>
        <h1>{post.title}</h1>
        <p className="fine">
          By BizTrackBD · <time dateTime={post.publishedAt.toISOString()}>{post.publishedAt.toISOString().slice(0, 10)}</time> · {minutes} min read
        </p>
        <p className="lead">{post.description}</p>
        {/* Cover drawn from the post's title in the brand style (opengraph-image.tsx next to this page). */}
        <img src={coverUrl} alt={post.coverAlt ?? post.title} width={1200} height={630} fetchPriority="high" style={{ width: "100%", height: "auto", borderRadius: 16 }} />
        {blocks.map((b, i) =>
          b.kind === "h2" ? (
            <h2 key={i}>{b.text}</h2>
          ) : b.kind === "h3" ? (
            <h3 key={i}>{b.text}</h3>
          ) : b.kind === "img" ? (
            <figure key={i} style={{ margin: "24px 0" }}>
              <img
                src={b.src}
                alt={b.alt}
                loading="lazy"
                {...(b.src.startsWith("/blog/") ? { width: 1200, height: 540 } : {})}
                style={{ width: "100%", height: "auto", borderRadius: 14 }}
              />
              {b.alt && <figcaption className="fine" style={{ marginTop: 6 }}>{b.alt}</figcaption>}
            </figure>
          ) : (
            <p key={i}>
              {b.nodes.map((n, j) =>
                n.kind === "text" ? (
                  n.text
                ) : n.href.startsWith("/") ? (
                  <Link key={j} href={n.href} prefetch={false}>{n.text}</Link>
                ) : (
                  <a key={j} href={n.href} rel="noopener noreferrer">{n.text}</a>
                ),
              )}
            </p>
          ),
        )}
        {post.ctaLabel && post.ctaHref && (
          <p style={{ marginTop: 28 }}>
            {post.ctaHref.startsWith("/") ? (
              <Link href={post.ctaHref} className="btn btn-primary" prefetch={false}>{post.ctaLabel}</Link>
            ) : (
              <a href={post.ctaHref} className="btn btn-primary" rel="noopener noreferrer">{post.ctaLabel}</a>
            )}
          </p>
        )}
        {related.length > 0 && (
          <aside aria-label="More guides" style={{ marginTop: 40 }}>
            <h2>More guides</h2>
            <ul>
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/blog/${r.slug}`} prefetch={false}>{r.title}</Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </article>
    </section>
  );
}
