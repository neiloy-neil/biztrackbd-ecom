import type { Metadata } from "next";
import Link from "next/link";
import { CUSTOM_PAGE_TEMPLATES, can, listCustomPages } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { PageHeader } from "@biztrackbd/ui";
import { dateOnly } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { ConfirmDelete } from "@/components/confirm-delete";
import { createPageAction, deletePageAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pages built from sections" };

export default async function Pages({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("design");
  const canEdit = can(s.user.role, "design", "edit");
  const pages = await listCustomPages(s.tenantId, s.actor);
  const origin = storefrontOrigin(s.tenantSubdomain);
  const err = one(sp.err);
  const done = one(sp.done);
  return (
    <>
      <PageHeader
        title="Pages Built from Sections"
        crumbs={[{ label: "Home", href: "/" }, { label: "Pages" }]}
        sub={<>About us, contact, size guide, delivery and returns: build a page from text, pictures, questions and contact details, and edit it right on the page. For a plain page of text, use <Link className="link" href="/content">Pages and blog</Link>.</>}
      />
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {done === "deleted" && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Page deleted.</div>}

      {pages.length === 0 ? <div className="card empty" data-testid="pages-empty">You have no pages built from sections yet.</div> : (
        <div className="stack" data-testid="pages-list">
          {pages.map((p) => (
            <section key={p.id} className="card" data-testid="pages-row">
              <div className="card-head">
                <h2><Link href={`/pages/${p.id}`} className="link" prefetch={false}>{p.title}</Link></h2>
                <span className={`pill ${p.isPublished ? "ok" : "grey"}`}>{p.isPublished ? "Live" : "Not live"}</span>
              </div>
              {canEdit && (
                <div className="row" style={{ marginTop: 8 }}>
                  <Link href={`/pages/${p.id}`} className="btn btn-secondary btn-sm" prefetch={false}>Edit</Link>
                  <ConfirmDelete action={deletePageAction.bind(null, p.id)} testId="page-delete" message={`Delete "${p.title}"? ${p.isPublished ? "It is live: its address will stop working. " : ""}This cannot be undone.`} />
                </div>
              )}
              <p className="muted" style={{ fontSize: 14 }}>Changed {dateOnly(p.updatedAt)}</p>
              {p.isPublished && <p style={{ fontSize: 14, marginTop: 4, overflowWrap: "anywhere" }}><a className="link" href={`${origin}/p/${p.slug}`} target="_blank" rel="noopener noreferrer">{origin}/p/{p.slug}</a></p>}
            </section>
          ))}
        </div>
      )}

      {canEdit && (
        <form action={createPageAction} className="card stack" style={{ marginTop: 14 }} data-testid="pages-new">
          <h2>New page</h2>
          <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="pg-template">Start from</label>
            <select id="pg-template" className="select" name="templateId" defaultValue="about" data-testid="pg-template">
              {CUSTOM_PAGE_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.blurb}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="pg-title">Name</label><input id="pg-title" className="input" name="title" required minLength={2} maxLength={80} placeholder="About us" /></div>
          <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="pg-slug">Web address (optional)</label><input id="pg-slug" className="input" name="slug" maxLength={60} placeholder="about-us" pattern="[a-z0-9]+(-[a-z0-9]+)*" /><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Small letters, numbers and dashes. We make one from the name if you leave it empty.</div></div>
          <div><SubmitButton pending="Creating…">Create and edit</SubmitButton></div>
        </form>
      )}
    </>
  );
}
