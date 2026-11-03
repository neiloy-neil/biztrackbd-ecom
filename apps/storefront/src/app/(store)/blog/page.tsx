import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedPosts } from "@biztrackbd/core";
import { getLang, makeT } from "@/lib/i18n";
import { getStore } from "@/lib/tenant";
import { SmartImage } from "@/components/smart-image";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blog", alternates: { canonical: "/blog" } };

export default async function Blog() {
  const store = await getStore();
  const t = makeT(await getLang(store.locale));
  const { items } = await listPublishedPosts(store.id);
  return (
    <div className="wrap" style={{ padding: "28px var(--gutter) 56px" }}>
      <h1 className="page-title" style={{ paddingTop: 0 }}>{t("blog")}</h1>
      {items.length === 0 ? <div className="empty" data-testid="no-posts">{t("noPosts")}</div> : (
        <div className="post-grid" data-testid="post-list">
          {items.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="post-card" data-testid="post-card">
              {p.coverImage && <SmartImage src={p.coverImage} alt="" sizes="(max-width: 640px) 90vw, 380px" style={{ height: "auto" }} />}
              <h2>{p.title}</h2>
              {p.summary && <p>{p.summary}</p>}
              <span className="post-meta">{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" }).format(p.createdAt)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
