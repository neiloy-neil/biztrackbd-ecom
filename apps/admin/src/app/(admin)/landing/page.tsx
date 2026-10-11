import type { Metadata } from "next";
import Link from "next/link";
import { can, listLandingPages } from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { SubmitButton } from "@/components/ui";
import { dateOnly } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { storefrontOrigin } from "@/lib/store-url";
import { createLandingAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Landing pages" };

export default async function Landing({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("design");
  const canEdit = can(s.user.role, "design", "edit");
  const [pages, products] = await Promise.all([
    listLandingPages(s.tenantId, s.actor),
    withTenant(s.tenantId, (tx) => tx.product.findMany({ where: { deletedAt: null, status: "ACTIVE" }, orderBy: { title: "asc" }, select: { id: true, title: true }, take: 500 })),
  ]);
  const origin = storefrontOrigin(s.tenantSubdomain);
  const err = one(sp.err);
  const done = one(sp.done);
  return (
    <>
      <div className="page-head"><h1>Landing pages</h1></div>
      <p className="page-sub">One product, one page, one order form. Send ad traffic here: customers order with cash on delivery without making an account.</p>
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {done === "deleted" && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Page deleted.</div>}

      {pages.length === 0 ? <div className="card empty" data-testid="landing-empty">You have no landing pages yet.</div> : (
        <div className="stack" data-testid="landing-list">
          {pages.map((p) => (
            <section key={p.id} className="card" data-testid="landing-row">
              <div className="card-head">
                <h2><Link href={`/landing/${p.id}`} className="link" prefetch={false}>{p.title}</Link></h2>
                <span className={`pill ${p.isPublished ? "ok" : "grey"}`}>{p.isPublished ? "Live" : "Not live"}</span>
              </div>
              <p className="muted" style={{ fontSize: 14 }}>Sells {p.productTitle ?? "a product that is no longer available"} · changed {dateOnly(p.updatedAt)}</p>
              {p.isPublished && <p style={{ fontSize: 14, marginTop: 4, overflowWrap: "anywhere" }}><a className="link" href={`${origin}/l/${p.slug}`} target="_blank" rel="noopener noreferrer">{origin}/l/{p.slug}</a></p>}
            </section>
          ))}
        </div>
      )}

      {canEdit && (
        <form action={createLandingAction} className="card stack" style={{ marginTop: 14 }} data-testid="landing-new">
          <h2>New landing page</h2>
          <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="lp-title">Name</label><input id="lp-title" className="input" name="title" required minLength={2} maxLength={120} placeholder="Eid panjabi" /></div>
          <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="lp-product">Product it sells</label>
            <select id="lp-product" className="select" name="productId" required defaultValue="">
              <option value="" disabled>Choose a product</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}><label className="label" htmlFor="lp-slug">Web address (optional)</label><input id="lp-slug" className="input" name="slug" maxLength={60} placeholder="eid-panjabi" pattern="[a-z0-9]+(-[a-z0-9]+)*" /><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Small letters, numbers and dashes. We make one from the name if you leave it empty.</div></div>
          <div><SubmitButton pending="Creating…">Create and edit</SubmitButton></div>
        </form>
      )}
    </>
  );
}
