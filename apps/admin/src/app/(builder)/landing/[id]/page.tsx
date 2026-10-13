import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotFoundError, can, createPreviewToken, landingKey, landingStats, listLandingLeads, listLandingPages, listVersions, loadForEdit } from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { ConfirmDelete } from "@/components/confirm-delete";
import { SubmitButton } from "@/components/ui";
import { one } from "@/lib/query";
import { dateOnly } from "@/lib/format";
import { requireAccess } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { Builder } from "../../design/builder";
import { deleteLandingAction, deleteLandingLeadAction, saveLandingMetaAction, saveLandingOffersAction, setLandingLiveAction } from "@/app/(admin)/landing/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Landing page" };

export default async function LandingEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requireAccess("design");
  const canEdit = can(s.user.role, "design", "edit");
  const row = (await listLandingPages(s.tenantId, s.actor)).find((p) => p.id === id);
  if (!row) notFound();
  const pageKey = landingKey(id);
  const [stats, leads] = await Promise.all([landingStats(s.tenantId, s.actor, id), listLandingLeads(s.tenantId, s.actor, id)]);
  const [state, versions, products] = await Promise.all([
    loadForEdit(s.tenantId, s.actor, pageKey).catch((e) => {
      if (e instanceof NotFoundError) notFound();
      throw e;
    }),
    listVersions(s.tenantId, s.actor, pageKey),
    withTenant(s.tenantId, (tx) => tx.product.findMany({ where: { deletedAt: null, status: "ACTIVE" }, orderBy: { title: "asc" }, select: { id: true, title: true, variants: { select: { id: true, title: true }, orderBy: { createdAt: "asc" }, take: 20 } }, take: 500 })),
  ]);
  const origin = storefrontOrigin(s.tenantSubdomain);
  const err = one(sp.err);
  const done = one(sp.done);
  const DONE: Record<string, string> = { saved: "Saved.", live: "The page is live.", offline: "The page is no longer live.", lead: "Removed." };

  const header = (
    <>
      {err && <div className="notice bad" role="alert">{err}</div>}
      {done && DONE[done] && <div className="notice good" role="status">{DONE[done]}</div>}
      <section className="card stack" data-testid="landing-stats">
        <div className="card-head"><h2>Last {stats.days} days</h2></div>
        <div className="row" style={{ gap: 24, flexWrap: "wrap" }}>
          <div><div className="muted" style={{ fontSize: 13 }}>Views</div><b style={{ fontSize: 22 }} data-testid="stat-views">{stats.views}</b></div>
          <div><div className="muted" style={{ fontSize: 13 }}>Orders</div><b style={{ fontSize: 22 }} data-testid="stat-orders">{stats.orders}</b></div>
          <div><div className="muted" style={{ fontSize: 13 }}>Orders per 100 views</div><b style={{ fontSize: 22 }}>{stats.conversion ?? "–"}</b></div>
        </div>
        {stats.sources.length > 0 && (
          <div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Where the orders came from</div>
            <ul style={{ margin: 0, paddingLeft: 18 }} data-testid="stat-sources">{stats.sources.map((x, i) => <li key={i}>{x.source}{x.campaign ? ` / ${x.campaign}` : ""}: {x.orders}</li>)}</ul>
          </div>
        )}
      </section>
      <section className="card stack" data-testid="landing-leads">
        <div className="card-head"><h2>People who did not finish ({stats.leads})</h2></div>
        <p className="muted" style={{ fontSize: 13 }}>A name and number typed on the page. The page tells the visitor it is kept for 30 days. Call them: a short call often turns into an order.</p>
        {leads.length === 0 ? <p className="muted">No one yet.</p> : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {leads.map((l) => (
              <li key={l.id} className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }} data-testid="lead-row">
                <b>{l.name}</b>
                <a className="link" href={`tel:${l.phone}`}>{l.phone}</a>
                <a className="link" href={`https://wa.me/88${l.phone}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                <span className="muted" style={{ fontSize: 13 }}>{l.offerLabel ? `${l.offerLabel} · ` : ""}{l.source} · {dateOnly(l.createdAt)}</span>
                <span className={`pill ${l.status === "ORDERED" ? "ok" : "grey"}`}>{l.status === "ORDERED" ? "Ordered" : "Not ordered"}</span>
                {canEdit && <form action={deleteLandingLeadAction.bind(null, id, l.id)}><SubmitButton className="btn btn-secondary" pending="…">Remove</SubmitButton></form>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card stack" data-testid="landing-meta">
        <div className="card-head"><h2>Page details</h2><span className={`pill ${row.isPublished ? "ok" : "grey"}`}>{row.isPublished ? "Live" : "Not live"}</span></div>
        <form action={saveLandingMetaAction.bind(null, id)} className="stack">
          <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="m-title">Name</label><input id="m-title" className="input" name="title" defaultValue={row.title} required minLength={2} maxLength={120} disabled={!canEdit} /></div>
          <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="m-pixel">Meta Pixel ID for this page (optional)</label><input id="m-pixel" className="input" name="pixelId" defaultValue={row.pixelId ?? ""} inputMode="numeric" disabled={!canEdit} /><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Leave empty to use the store Pixel.</div></div>
          {canEdit && <div><SubmitButton className="btn btn-secondary" pending="Saving…">Save details</SubmitButton></div>}
        </form>
        <form action={saveLandingOffersAction.bind(null, id)} className="stack" data-testid="landing-offers">
          <h3>What this page sells</h3>
          <p className="muted" style={{ fontSize: 13 }}>One offer sells that product. Add more to let customers choose between products, or to offer pieces at a better price (for example 1 piece, then 2 pieces with 200 off). Prices always come from your products.</p>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const o = row.offers.options[i];
            return (
              <fieldset key={i} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
                <legend style={{ fontSize: 13 }}>Offer {i + 1}{i === 0 ? " (required)" : ""}</legend>
                <select className="select" name={`o${i}-product`} defaultValue={o?.productId ?? ""} disabled={!canEdit} aria-label={`Offer ${i + 1} product`} data-testid={`offer-product-${i}`}>
                  <option value="">{i === 0 ? "Choose a product" : "(not used)"}</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <input className="input" name={`o${i}-label`} defaultValue={o?.label ?? ""} placeholder="Name shown, for example 2 pieces" maxLength={80} disabled={!canEdit} aria-label={`Offer ${i + 1} name`} />
                  <input className="input" name={`o${i}-labelBn`} defaultValue={o?.labelBn ?? ""} placeholder="বাংলা নাম (optional)" maxLength={80} disabled={!canEdit} aria-label={`Offer ${i + 1} name in Bangla`} />
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <input className="input" name={`o${i}-qty`} type="number" min={1} max={20} defaultValue={o?.quantity ?? ""} placeholder="Pieces (empty = customer chooses)" disabled={!canEdit} aria-label={`Offer ${i + 1} pieces`} style={{ maxWidth: 220 }} />
                  <select className="select" name={`o${i}-deal`} defaultValue={o?.deal.kind ?? "none"} disabled={!canEdit} aria-label={`Offer ${i + 1} deal`} style={{ maxWidth: 170 }}>
                    <option value="none">No deal</option><option value="percent">Percent off</option><option value="amount">Taka off</option>
                  </select>
                  <input className="input" name={`o${i}-value`} type="number" min={0} step="1" defaultValue={o && o.deal.kind !== "none" ? o.deal.value : ""} placeholder="Amount" disabled={!canEdit} aria-label={`Offer ${i + 1} deal amount`} style={{ maxWidth: 120 }} />
                </div>
              </fieldset>
            );
          })}
          <fieldset style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
            <legend style={{ fontSize: 13 }}>Extra item above the button (optional)</legend>
            <select className="select" name="bump-variant" defaultValue={row.offers.bump ? `${row.offers.bump.productId}:${row.offers.bump.variantId}` : ""} disabled={!canEdit} aria-label="Extra item" data-testid="bump-variant">
              <option value="">(none)</option>
              {products.flatMap((p) => p.variants.map((v) => <option key={v.id} value={`${p.id}:${v.id}`}>{p.title}{p.variants.length > 1 ? ` · ${v.title}` : ""}</option>))}
            </select>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <input className="input" name="bump-label" defaultValue={row.offers.bump?.label ?? ""} placeholder="Line shown, for example Add a gift box" maxLength={80} disabled={!canEdit} aria-label="Extra item text" />
              <input className="input" name="bump-labelBn" defaultValue={row.offers.bump?.labelBn ?? ""} placeholder="বাংলা (optional)" maxLength={80} disabled={!canEdit} aria-label="Extra item text in Bangla" />
              <input className="input" name="bump-off" type="number" min={0} max={90} defaultValue={row.offers.bump?.percentOff ?? ""} placeholder="% off" disabled={!canEdit} aria-label="Extra item percent off" style={{ maxWidth: 100 }} />
            </div>
          </fieldset>
          {canEdit && <div><SubmitButton className="btn btn-secondary" pending="Saving…" data-testid="save-offers">Save offers</SubmitButton></div>}
        </form>
        {canEdit && (
          <div className="row">
            <form action={setLandingLiveAction.bind(null, id, !row.isPublished)}><SubmitButton className={row.isPublished ? "btn btn-secondary" : "btn btn-success"} pending="…" data-testid="toggle-live">{row.isPublished ? "Take offline" : "Put live"}</SubmitButton></form>
            <ConfirmDelete action={deleteLandingAction.bind(null, id)} label="Delete page" message={`Delete "${row.title}"? ${row.isPublished ? "It is live: its address will stop working. " : ""}This cannot be undone.`} />
          </div>
        )}
        {row.isPublished && <p style={{ fontSize: 13, overflowWrap: "anywhere" }}>Address: <a className="link" href={`${origin}/l/${row.slug}`} target="_blank" rel="noopener noreferrer">{origin}/l/{row.slug}</a></p>}
        {row.isPublished && row.shortCode && <p style={{ fontSize: 13, overflowWrap: "anywhere" }} data-testid="landing-short">Short address for ads: <a className="link" href={`${origin}/go/${row.shortCode}`} target="_blank" rel="noopener noreferrer">{origin}/go/{row.shortCode}</a></p>}
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
