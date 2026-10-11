import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedPost } from "@biztrackbd/core";
import { getLang, makeT } from "@/lib/i18n";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStore();
  const post = await getPublishedPost(store.id, slug);
  if (!post) return { title: "Not found", robots: { index: false } };
  return { title: post.title, description: post.summary ?? undefined, alternates: { canonical: `/blog/${slug}` }, openGraph: { type: "article", title: post.title, description: post.summary ?? undefined, images: post.coverImage ? [post.coverImage] : undefined } };
}

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStore();
  const t = makeT(await getLang(store.locale));
  const post = await getPublishedPost(store.id, slug);
  if (!post) notFound();
  return (
    <article className="wrap" style={{ padding: "28px var(--gutter) 56px" }} data-testid="blog-post">
      <p><Link href="/blog" className="link-btn">← {t("backToBlog")}</Link></p>
      <h1 className="page-title" style={{ paddingTop: 8 }}>{post.title}</h1>
      <p className="post-meta" style={{ marginBottom: 16 }}>{[post.authorName ? t("writtenBy", { name: post.authorName }) : null, new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }).format(post.createdAt)].filter(Boolean).join(" · ")}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {post.coverImage && <img src={post.coverImage} alt="" style={{ width: "100%", maxWidth: 720, borderRadius: "var(--radius)", display: "block", marginBottom: 20 }} />}
      <div className="prose" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
    </article>
  );
}
