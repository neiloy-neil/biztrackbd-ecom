import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NotFoundError, getBlogPostForEdit } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { deleteBlogPostAction } from "../actions";
import { DeleteButton, PostForm } from "../post-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit blog post" };

/** datetime-local wants a wall-clock time with no zone; show Dhaka time (UTC+6), matching how the action reads it back. */
const localInput = (d: Date | null) => {
  if (!d) return "";
  return new Date(d.getTime() + 6 * 3600_000).toISOString().slice(0, 16);
};

export default async function EditBlogPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await requireAccess("blog", "edit");
  const { id } = await params;
  const sp = await searchParams;

  let post;
  try {
    post = await getBlogPostForEdit(s.actor, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const live = post.status === "PUBLISHED" && !!post.publishedAt && post.publishedAt <= new Date();
  const site = process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://biztrack.bd";

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head">
        <p style={{ margin: 0, fontSize: 13 }}>
          <Link href="/blog" prefetch={false}>Blog</Link>
        </p>
        <h1>{post.title}</h1>
        {live && (
          <p style={{ margin: "4px 0 0", fontSize: 13 }}>
            <a href={`${site}/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">View on the site ↗</a>
          </p>
        )}
      </div>

      {(sp.saved === "published" || sp.saved === "draft") && (
        <div role="status" style={{ padding: "12px 16px", borderRadius: 8, background: "var(--success-bg)", color: "var(--success)", fontWeight: 600 }}>
          {sp.saved === "published" ? "Saved and published. The site updates within a few minutes." : "Saved as a draft. It is not on the site."}
        </div>
      )}

      <PostForm
        id={post.id}
        live={post.status === "PUBLISHED"}
        initial={{
          slug: post.slug, title: post.title, description: post.description, body: post.body,
          ctaLabel: post.ctaLabel ?? "", ctaHref: post.ctaHref ?? "", publishedAt: localInput(post.publishedAt),
          seoTitle: post.seoTitle ?? "", seoDescription: post.seoDescription ?? "", coverImage: post.coverImage ?? "", coverAlt: post.coverAlt ?? "", noindex: post.noindex,
        }}
      />

      <form action={deleteBlogPostAction.bind(null, post.id)}>
        <DeleteButton />
      </form>
    </div>
  );
}
