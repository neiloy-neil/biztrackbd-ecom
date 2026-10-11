import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotFoundError, can, createPreviewToken, landingKey, listLandingPages, listVersions, loadForEdit } from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { SubmitButton } from "@/components/ui";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { Builder } from "../../design/builder";
import { deleteLandingAction, saveLandingMetaAction, setLandingLiveAction } from "@/app/(admin)/landing/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Landing page" };

export default async function LandingEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requireAccess("design");
  const canEdit = can(s.user.role, "design", "edit");
  const row = (await listLandingPages(s.tenantId, s.actor)).find((p) => p.id === id);
  if (!row) notFound();
  const pageKey = landingKey(id);
  const [state, versions, products] = await Promise.all([
    loadForEdit(s.tenantId, s.actor, pageKey).catch((e) => {
      if (e instanceof NotFoundError) notFound();
      throw e;
    }),
    listVersions(s.tenantId, s.actor, pageKey),
    withTenant(s.tenantId, (tx) => tx.product.findMany({ where: { deletedAt: null, status: "ACTIVE" }, orderBy: { title: "asc" }, select: { id: true, title: true }, take: 500 })),
  ]);
  const origin = storefrontOrigin(s.tenantSubdomain);
  const err = one(sp.err);
  const done = one(sp.done);
  const DONE: Record<string, string> = { saved: "Saved.", live: "The page is live.", offline: "The page is no longer live." };

  const header = (
    <>
      {err && <div className="notice bad" role="alert">{err}</div>}
      {done && DONE[done] && <div className="notice good" role="status">{DONE[done]}</div>}
      <section className="card stack" data-testid="landing-meta">
        <div className="card-head"><h2>Page details</h2><span className={`pill ${row.isPublished ? "ok" : "grey"}`}>{row.isPublished ? "Live" : "Not live"}</span></div>
        <form action={saveLandingMetaAction.bind(null, id)} className="stack">
          <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="m-title">Name</label><input id="m-title" className="input" name="title" defaultValue={row.title} required minLength={2} maxLength={120} disabled={!canEdit} /></div>
          <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="m-product">Product it sells</label>
            <select id="m-product" className="select" name="productId" defaultValue={row.productId} disabled={!canEdit}>{products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
          </div>
          <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="m-pixel">Meta Pixel ID for this page (optional)</label><input id="m-pixel" className="input" name="pixelId" defaultValue={row.pixelId ?? ""} inputMode="numeric" disabled={!canEdit} /><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Leave empty to use the store Pixel.</div></div>
          {canEdit && <div><SubmitButton className="btn btn-secondary" pending="Saving…">Save details</SubmitButton></div>}
        </form>
        {canEdit && (
          <div className="row">
            <form action={setLandingLiveAction.bind(null, id, !row.isPublished)}><SubmitButton className={row.isPublished ? "btn btn-secondary" : "btn btn-success"} pending="…" data-testid="toggle-live">{row.isPublished ? "Take offline" : "Put live"}</SubmitButton></form>
            <form action={deleteLandingAction.bind(null, id)}><SubmitButton className="btn btn-secondary" pending="Deleting…">Delete page</SubmitButton></form>
          </div>
        )}
        {row.isPublished && <p style={{ fontSize: 13, overflowWrap: "anywhere" }}>Address: <a className="link" href={`${origin}/l/${row.slug}`} target="_blank" rel="noopener noreferrer">{origin}/l/{row.slug}</a></p>}
      </section>
    </>
  );

  return (
    <Builder
      key={`${id}-${state.publishedVersion}-${state.isDraft}-${versions.length}-${state.stamp}`}
      pageKey={pageKey}
      kind="landing"
      title={row.title}
      initialPage={state.page}
      initialTheme={state.theme}
      hasDraft={state.isDraft}
      stamp={state.stamp}
      unpublished={state.unpublished}
      publishedVersion={state.publishedVersion}
      versions={versions.map((v) => ({ version: v.version, label: v.label, createdAt: v.createdAt.toISOString(), isLive: v.isLive }))}
      previewUrl={`${origin}/l/${row.slug}?preview=${createPreviewToken(s.tenantId)}`}
      previewOrigin={origin}
      liveUrl={`${origin}/l/${row.slug}`}
      canEdit={canEdit}
      exitHref="/landing"
      initialTab={err || (done && DONE[done]) ? "theme" : undefined}
      header={header}
    />
  );
}
