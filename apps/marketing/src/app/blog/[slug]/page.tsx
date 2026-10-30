import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_POSTS, getPost } from "@/lib/blog";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const url = `${siteUrl}/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: "BizTrackBD",
      title: post.title,
      description: post.description,
      publishedTime: post.published,
      images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: post.title }],
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.published,
    dateModified: post.published,
    mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
    author: { "@type": "Organization", name: "BizTrackBD" },
    publisher: { "@type": "Organization", name: "BizTrackBD", url: siteUrl },
  };

  return (
    <section className="block">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="wrap prose">
        <p className="fine">
          <Link href="/blog" prefetch={false}>
            Guides
          </Link>
        </p>
        <h1>{post.title}</h1>
        <p className="fine">Published {post.published}</p>
        <p>{post.intro}</p>
        {post.sections.map((s) => (
          <div key={s.heading}>
            <h2>{s.heading}</h2>
            {s.body.map((para) => (
              <p key={para}>{para}</p>
            ))}
          </div>
        ))}
        <p style={{ marginTop: 28 }}>
          <Link href={post.cta.href} className="btn btn-primary" prefetch={false}>
            {post.cta.label}
          </Link>
        </p>
      </article>
    </section>
  );
}
