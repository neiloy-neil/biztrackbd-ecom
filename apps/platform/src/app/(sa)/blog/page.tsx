import type { Metadata } from "next";
import Link from "next/link";
import { canPlatform, listBlogPosts } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blog" };

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function BlogAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const s = await requireAccess("blog");
  const sp = await searchParams;
  const posts = await listBlogPosts(s.actor);
  const canEdit = canPlatform(s.user.role, "blog", "edit");
  const now = new Date();

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ flex: 1 }}>Blog</h1>
        {canEdit && (
          <Link href="/blog/new" className="btn btn-primary" prefetch={false}>
            New post
          </Link>
        )}
      </div>

      {sp.deleted === "1" && (
        <div role="status" style={{ padding: "12px 16px", borderRadius: 8, background: "var(--success-bg)", color: "var(--success)", fontWeight: 600 }}>
          Post deleted.
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {posts.length === 0 ? (
          <div style={{ padding: 36, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>
            No posts yet. The two starter guides on the site show until you publish your first one.
          </div>
        ) : (
          posts.map((p) => {
            const scheduled = p.status === "PUBLISHED" && p.publishedAt && p.publishedAt > now;
            const live = p.status === "PUBLISHED" && !scheduled;
            return (
              <Link key={p.id} href={`/blog/${p.id}`} prefetch={false} style={{ display: "block", padding: "14px 22px", borderBottom: "1px solid var(--line)", color: "inherit" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <b style={{ flex: 1, fontSize: 14 }}>{p.title}</b>
                  <span
                    style={{
                      padding: "2px 9px", borderRadius: 10, fontSize: 11.5, fontWeight: 600,
                      background: live ? "var(--success-bg)" : "var(--bg)", color: live ? "var(--success)" : "var(--ink-3)",
                    }}
                  >
                    {live ? "Live" : scheduled ? "Scheduled" : "Draft"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>
                  /blog/{p.slug} · {p.publishedAt ? `${scheduled ? "goes live" : "published"} ${fmt(p.publishedAt)}` : `edited ${fmt(p.updatedAt)}`}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
