import type { Metadata } from "next";
import Link from "next/link";
import { can, getContent, listContent, type ContentDetail } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateOnly } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { deleteContentAction, saveContentAction } from "./actions";
import { CoverField } from "./cover-field";

/** A moment as the value of a date box, in Bangladesh time (UTC+6). */
const toDhaka = (d?: Date | null) => (d ? new Date(d.getTime() + 6 * 3600_000).toISOString().slice(0, 16) : "");

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pages and blog" };

const DONE: Record<string, string> = { saved: "Saved.", deleted: "Deleted." };

/** Back to plain text for the editor: the stored paragraphs, without tags, so it reads the way it was written. */
const toText = (html: string) => (/<(?!\/?(p|br)\b)[a-z]/i.test(html) ? html : html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*<p>/gi, "\n\n").replace(/<\/?p>/gi, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));

export default async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("design");
  const canEdit = can(s.user.role, "design", "edit");
  const kind = one(sp.tab) === "posts" ? "post" : "page";
  const tab = kind === "page" ? "pages" : "posts";
  const edit = one(sp.edit);
  const rows = await listContent(s.tenantId, s.actor, kind);
  const current: ContentDetail | null = edit && edit !== "new" ? await getContent(s.tenantId, s.actor, kind, edit).catch(() => null) : null;
  const origin = storefrontOrigin(s.tenantSubdomain);
  const err = one(sp.err);
  const done = one(sp.done);
  const path = (slug: string) => (kind === "page" ? `${origin}/p/${slug}` : `${origin}/blog/${slug}`);

  return (
    <>
      <div className="page-head"><h1>Pages and blog</h1></div>
      <p className="page-sub">Pages are for things like your delivery policy and size guide. Blog posts are for news and tips. Write plain text: a blank line starts a new paragraph.</p>
      <nav className="tabs" aria-label="Type">
        <Link href="/content?tab=pages" aria-current={tab === "pages" ? "page" : undefined} prefetch={false}>Pages</Link>
        <Link href="/content?tab=posts" aria-current={tab === "posts" ? "page" : undefined} prefetch={false}>Blog posts</Link>
      </nav>
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }} data-testid="content-error">{err}</div>}
      {done && DONE[done] && <div className="notice good" role="status" style={{ marginBottom: 12 }}>{DONE[done]}</div>}

      <div className="split" style={{ alignItems: "start" }}>
        <section className="card" data-testid="content-list">
          <div className="card-head"><h2>{kind === "page" ? "Your pages" : "Your posts"}</h2>{canEdit && <Link className="btn btn-secondary btn-sm" href={`/content?tab=${tab}&edit=new`} prefetch={false}>New {kind === "page" ? "page" : "post"}</Link>}</div>
          {rows.length === 0 ? <p className="muted" data-testid="content-empty">Nothing here yet.</p> : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {rows.map((r) => (
                <li key={r.id} style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--line)", flexWrap: "wrap" }} data-testid="content-row">
                  <span style={{ minWidth: 0 }}>
                    <Link className="link" href={`/content?tab=${tab}&edit=${r.id}`} prefetch={false}><b>{r.title}</b></Link>
                    <span className="muted" style={{ display: "block", fontSize: 13 }}>/{kind === "page" ? "p" : "blog"}/{r.slug} · {dateOnly(r.updatedAt)}</span>
                  </span>
                  <span className={`pill ${r.isPublished ? (r.publishAt && r.publishAt > new Date() ? "info" : "ok") : "grey"}`} data-testid="content-status">{r.isPublished ? (r.publishAt && r.publishAt > new Date() ? "Scheduled" : "Published") : "Draft"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {edit && (
          <form action={saveContentAction.bind(null, kind, current?.id ?? null)} className="card stack" data-testid="content-form">
            <h2>{current ? `Edit: ${current.title}` : `New ${kind === "page" ? "page" : "post"}`}</h2>
            <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="c-title">Title</label><input id="c-title" className="input" name="title" defaultValue={current?.title ?? ""} required minLength={2} maxLength={140} disabled={!canEdit} /></div>
            <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="c-slug">Web address (optional)</label><input id="c-slug" className="input" name="slug" defaultValue={current?.slug ?? ""} maxLength={80} placeholder={kind === "page" ? "delivery-policy" : "eid-styling-guide"} disabled={!canEdit} /><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Small letters, numbers and dashes. Made from the title if you leave it empty.</div></div>
            {kind === "post" && (
              <>
                <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="c-summary">Short summary</label><input id="c-summary" className="input" name="summary" defaultValue={current?.summary ?? ""} maxLength={300} disabled={!canEdit} /></div>
                <CoverField initial={current?.coverImage ?? ""} disabled={!canEdit} />
                <div className="row-2">
                  <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="c-author">Written by</label><input id="c-author" className="input" name="authorName" defaultValue={current?.authorName ?? ""} maxLength={80} disabled={!canEdit} /></div>
                  <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="c-tags">Tags (separated by commas)</label><input id="c-tags" className="input" name="tags" defaultValue={current?.tags.join(", ") ?? ""} disabled={!canEdit} /></div>
                </div>
              </>
            )}
            <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="c-body">Text</label><textarea id="c-body" className="textarea" name="body" rows={14} defaultValue={current ? toText(current.contentHtml) : ""} required style={{ padding: 12 }} disabled={!canEdit} /></div>
            <label className="row" style={{ flexWrap: "nowrap", gap: 8 }}><input type="checkbox" name="isPublished" defaultChecked={current?.isPublished ?? false} disabled={!canEdit} style={{ width: 20, height: 20 }} /> Visible to customers</label>
            <div className="field" style={{ margin: 0 }}>
              <label className="label" htmlFor="c-publish-at">Show it from (optional)</label>
              <input id="c-publish-at" className="input" name="publishAt" type="datetime-local" defaultValue={toDhaka(current?.publishAt)} disabled={!canEdit} />
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Bangladesh time. Leave empty to show it as soon as it is visible to customers.</div>
            </div>
            {canEdit && (
              <div className="row">
                <SubmitButton pending="Saving…">Save</SubmitButton>
                {current && current.isPublished && <a className="btn btn-secondary" href={path(current.slug)} target="_blank" rel="noopener noreferrer">View on the store</a>}
              </div>
            )}
          </form>
        )}
      </div>
      {edit && current && canEdit && (
        <form action={deleteContentAction.bind(null, kind, current.id)} style={{ marginTop: 12 }}><SubmitButton className="btn btn-secondary" pending="Deleting…">Delete this {kind === "page" ? "page" : "post"}</SubmitButton></form>
      )}
    </>
  );
}
