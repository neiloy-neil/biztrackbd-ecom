import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotFoundError, can, createPreviewToken, customKey, listCustomPages, listVersions, loadForEdit } from "@biztrackbd/core";
import type { SiteMode, BusinessVertical } from "@biztrackbd/core/builder-client";
import { withTenant } from "@biztrackbd/db";
import { ConfirmDelete } from "@/components/confirm-delete";
import { SubmitButton } from "@/components/ui";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { Builder } from "../../design/builder";
import { deletePageAction, savePageMetaAction, setPageLiveAction } from "@/app/(admin)/pages/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Page" };

export default async function PageEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requireAccess("design");
  const canEdit = can(s.user.role, "design", "edit");
  const [allPages, tenantData] = await Promise.all([
    listCustomPages(s.tenantId, s.actor),
    withTenant(s.tenantId, (tx) =>
      tx.tenant.findFirstOrThrow({
        select: { siteMode: true, businessVertical: true },
      })
    ).catch(() => ({ siteMode: "ECOMMERCE", businessVertical: null })),
  ]);
  const row = allPages.find((p) => p.id === id);
  if (!row) notFound();
  const pageKey = customKey(id);
  const [state, versions] = await Promise.all([
    loadForEdit(s.tenantId, s.actor, pageKey).catch((e) => {
      if (e instanceof NotFoundError) notFound();
      throw e;
    }),
    listVersions(s.tenantId, s.actor, pageKey),
  ]);
  const origin = storefrontOrigin(s.tenantSubdomain);
  const err = one(sp.err);
  const done = one(sp.done);
  const DONE: Record<string, string> = { saved: "Saved.", live: "The page is live.", offline: "The page is no longer live." };

  const siteMode = (tenantData.siteMode ?? "ECOMMERCE") as SiteMode;
  const businessVertical = (tenantData.businessVertical ?? undefined) as BusinessVertical | undefined;

  const pageChoices: { key: string; label: string }[] = siteMode === "PORTFOLIO"
    ? [
        { key: "home", label: "Home page" },
        { key: "chrome", label: "Header and footer" },
        ...allPages.map((cp) => ({ key: `custom:${cp.id}`, label: cp.title })),
      ]
    : [
        { key: "home", label: "Home page" },
        { key: "product", label: "Product page" },
        { key: "collection", label: "Collection page" },
        { key: "cart", label: "Cart page" },
        { key: "chrome", label: "Header and footer" },
        ...allPages.map((cp) => ({ key: `custom:${cp.id}`, label: `Page: ${cp.title}` })),
      ];

  const header = (
    <>
      {err && <div className="notice bad" role="alert">{err}</div>}
      {done && DONE[done] && <div className="notice good" role="status">{DONE[done]}</div>}
      <section className="card stack" data-testid="page-meta">
        <div className="card-head"><h2>Page details</h2><span className={`pill ${row.isPublished ? "ok" : "grey"}`}>{row.isPublished ? "Live" : "Not live"}</span></div>
        <form action={savePageMetaAction.bind(null, id)} className="stack">
          <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="m-title">Name</label><input id="m-title" className="input" name="title" defaultValue={row.title} required minLength={2} maxLength={80} disabled={!canEdit} /></div>
          <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="m-seo">Title in search results (optional)</label><input id="m-seo" className="input" name="seoTitle" defaultValue={row.seoTitle ?? ""} maxLength={70} disabled={!canEdit} /></div>
          <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="m-desc">Description in search results (optional)</label><textarea id="m-desc" className="textarea" name="seoDescription" rows={2} defaultValue={row.seoDescription ?? ""} maxLength={160} disabled={!canEdit} style={{ padding: 10 }} /></div>
          {canEdit && <div><SubmitButton className="btn btn-secondary" pending="Saving…">Save details</SubmitButton></div>}
        </form>
        {canEdit && (
          <div className="row">
            <form action={setPageLiveAction.bind(null, id, !row.isPublished)}><SubmitButton className={row.isPublished ? "btn btn-secondary" : "btn btn-success"} pending="…" data-testid="toggle-live">{row.isPublished ? "Take offline" : "Put live"}</SubmitButton></form>
            <ConfirmDelete action={deletePageAction.bind(null, id)} label="Delete page" message={`Delete "${row.title}"? ${row.isPublished ? "It is live: its address will stop working. " : ""}This cannot be undone.`} />
          </div>
        )}
        {row.isPublished && <p style={{ fontSize: 13, overflowWrap: "anywhere" }}>Address: <a className="link" href={`${origin}/p/${row.slug}`} target="_blank" rel="noopener noreferrer">{origin}/p/{row.slug}</a></p>}
      </section>
    </>
  );

  return (
    <Builder
      key={`${id}-${state.publishedVersion}-${state.isDraft}-${versions.length}-${state.stamp}`}
      pageKey={pageKey}
      kind="custom"
      title={row.title}
      pages={pageChoices}
      initialPage={state.page}
      initialTheme={state.theme}
      hasDraft={state.isDraft}
      stamp={state.stamp}
      unpublished={state.unpublished}
      publishedVersion={state.publishedVersion}
      versions={versions.map((v) => ({ version: v.version, label: v.label, createdAt: v.createdAt.toISOString(), isLive: v.isLive }))}
      previewUrl={`${origin}/p/${row.slug}?preview=${createPreviewToken(s.tenantId)}`}
      previewOrigin={origin}
      liveUrl={`${origin}/p/${row.slug}`}
      canEdit={canEdit}
      exitHref="/pages"
      initialTab={err || (done && DONE[done]) ? "theme" : undefined}
      header={header}
      siteMode={siteMode}
      businessVertical={businessVertical}
    />
  );
}
