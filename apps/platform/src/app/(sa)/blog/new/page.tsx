import type { Metadata } from "next";
import Link from "next/link";
import { requireAccess } from "@/lib/session";
import { PostForm } from "../post-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New blog post" };

export default async function NewBlogPostPage() {
  await requireAccess("blog", "edit");
  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head">
        <p style={{ margin: 0, fontSize: 13 }}>
          <Link href="/blog" prefetch={false}>Blog</Link>
        </p>
        <h1>New post</h1>
      </div>
      <PostForm id={null} live={false} initial={{ slug: "", title: "", description: "", body: "", ctaLabel: "", ctaHref: "", publishedAt: "", seoTitle: "", seoDescription: "", coverImage: "", coverAlt: "", noindex: false }} />
    </div>
  );
}
