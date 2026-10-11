import type { Metadata } from "next";
import Link from "next/link";
import { STOCK_REASONS, can, listInventory, type InventoryRow, type StockFilter } from "@biztrackbd/core";
import { Pager, SubmitButton, Tabs } from "@/components/ui";
import { taka } from "@/lib/format";
import { one, pageOf, qs } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { adjustAction, stockSettingsAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inventory" };

const REASON_LABEL: Record<string, string> = { RECOUNT: "Stock count", RECEIVED: "New stock received", DAMAGED: "Damaged or lost", RETURNED: "Customer return", CORRECTION: "Correction", OTHER: "Other" };

function StatePill({ r }: { r: InventoryRow }) {
  return <span className={`pill ${r.state === "out" ? "bad" : r.state === "low" ? "warn" : "grey"}`}>{r.state === "out" ? "Out" : r.state === "low" ? "Low" : "OK"}</span>;
}

function AdjustForm({ r, back }: { r: InventoryRow; back: string }) {
  return (
    <details>
      <summary className="link" style={{ cursor: "pointer" }} data-testid={`adjust-${r.sku ?? r.variantId}`}>Adjust</summary>
      <div className="card" style={{ marginTop: 8, minWidth: 260 }}>
        <form action={adjustAction.bind(null, r.variantId)} className="stack">
          <input type="hidden" name="back" value={back} />
          <div className="row-2">
            <label className="field" style={{ marginBottom: 0 }}><span className="label">Change</span>
              <select className="select" name="mode" defaultValue="add"><option value="add">Add</option><option value="remove">Remove</option><option value="set">Set count to</option></select></label>
            <label className="field" style={{ marginBottom: 0 }}><span className="label">Units</span><input className="input" name="amount" inputMode="numeric" required data-testid="adjust-amount" /></label>
          </div>
          <label className="field" style={{ marginBottom: 0 }}><span className="label">Reason</span>
            <select className="select" name="reason" defaultValue="RECEIVED">{STOCK_REASONS.map((x) => <option key={x} value={x}>{REASON_LABEL[x]}</option>)}</select></label>
          <label className="field" style={{ marginBottom: 0 }}><span className="label">Note <span className="opt">(optional)</span></span><input className="input" name="note" maxLength={200} /></label>
          <SubmitButton className="btn btn-primary btn-block" pending="Saving…">Save change</SubmitButton>
        </form>
        <form action={stockSettingsAction.bind(null, r.variantId)} className="row" style={{ marginTop: 12, alignItems: "flex-end" }}>
          <input type="hidden" name="back" value={back} />
          <label className="field" style={{ marginBottom: 0, flex: 1 }}><span className="label">Reorder at</span><input className="input input-sm" name="reorder" inputMode="numeric" defaultValue={r.reorderLevel} /></label>
          <label className="field" style={{ marginBottom: 0, flex: 1 }}><span className="label">Shelf</span><input className="input input-sm" name="shelf" defaultValue={r.shelf ?? ""} maxLength={20} /></label>
          <SubmitButton className="btn btn-secondary btn-sm" pending="…">Save</SubmitButton>
        </form>
      </div>
    </details>
  );
}

export default async function Inventory({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("products");
  const filter = (["low", "out"] as const).find((f) => f === one(sp.filter)) ?? "all";
  const q = one(sp.q)?.trim() ?? "";
  const shelf = one(sp.shelf) || undefined;
  const page = pageOf(one(sp.page));
  const list = await listInventory(s.tenantId, s.actor, { filter: filter as StockFilter, q: q || undefined, shelf, page, pageSize: 30 });
  const canEdit = can(s.user.role, "products", "edit");
  const showValue = can(s.user.role, "reports");
  const base = { filter: filter === "all" ? undefined : filter, q, shelf };
  const here = `/inventory${qs({ ...base, page })}`;
  const err = one(sp.err);

  return (
    <>
      <div className="page-head"><h1>Inventory</h1><div className="actions"><Link href="/products" className="btn btn-secondary" prefetch={false}>Products</Link></div></div>
      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <div className="stat"><div className="k">Units in stock</div><div className="v num">{list.summary.unitsInStock.toLocaleString("en-IN")}</div></div>
        {showValue ? <div className="stat"><div className="k">Stock value (at cost)</div><div className="v num">{taka(list.summary.stockValueAtCost)}</div></div> : <div className="stat"><div className="k">Variants</div><div className="v num">{list.total}</div></div>}
        <div className="stat"><div className="k">Low stock</div><div className="v num" style={{ color: list.summary.low ? "var(--warning)" : undefined }}>{list.summary.low}</div></div>
        <div className="stat"><div className="k">Out of stock</div><div className="v num" style={{ color: list.summary.out ? "var(--danger)" : undefined }}>{list.summary.out}</div></div>
      </div>

      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }} data-testid="inventory-error">{err}</div>}
      {one(sp.ok) && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Saved.</div>}

      <Tabs tabs={[
        { href: `/inventory${qs({ ...base, filter: undefined })}`, label: "All", current: filter === "all" },
        { href: `/inventory${qs({ ...base, filter: "low" })}`, label: "Low stock", count: list.summary.low, current: filter === "low" },
        { href: `/inventory${qs({ ...base, filter: "out" })}`, label: "Out of stock", count: list.summary.out, alert: true, current: filter === "out" },
      ]} />
      <form className="toolbar" method="get" role="search">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <label className="grow"><span className="sr-only">Search</span><input className="input" type="search" name="q" defaultValue={q} placeholder="Search by product or SKU" /></label>
        {list.shelves.length > 0 && <label><span className="sr-only">Shelf</span><select className="select" name="shelf" defaultValue={shelf ?? ""}><option value="">Shelf: all</option>{list.shelves.map((x) => <option key={x}>{x}</option>)}</select></label>}
        <button className="btn btn-secondary" type="submit">Search</button>
      </form>

      {list.rows.length === 0 ? <div className="card empty">Nothing here.</div> : (
        <>
          <div className="only-mobile">
            {list.rows.map((r) => (
              <div key={r.variantId} className="list-card" data-testid="inv-row">
                <div className="top"><b>{r.productTitle}{r.variantTitle.toLowerCase() !== "default" ? ` · ${r.variantTitle}` : ""}</b><StatePill r={r} /></div>
                <div className="muted" style={{ fontSize: 13 }}>{r.sku ?? "No SKU"}{r.shelf ? ` · Shelf ${r.shelf}` : ""}</div>
                <div className="row" style={{ marginTop: 8, justifyContent: "space-between" }}>
                  <span><b className="num" data-testid="available">{r.available}</b> available · {r.committed} committed · reorder at {r.reorderLevel}</span>
                </div>
                {canEdit && <div style={{ marginTop: 8 }}><AdjustForm r={r} back={here} /></div>}
              </div>
            ))}
          </div>
          <table className="table only-desktop" data-testid="inventory-table">
            <thead><tr><th>Product</th><th>SKU</th><th>Shelf</th><th className="r">Committed</th><th className="r">Reorder at</th><th className="r">Available</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
            <tbody>
              {list.rows.map((r) => (
                <tr key={r.variantId} data-testid="inv-row">
                  <td><b>{r.productTitle}</b>{r.variantTitle.toLowerCase() !== "default" && <div className="muted" style={{ fontSize: 12.5 }}>{r.variantTitle}</div>}</td>
                  <td className="muted">{r.sku ?? "—"}</td><td className="muted">{r.shelf ?? "—"}</td>
                  <td className="r num">{r.committed}</td><td className="r num">{r.reorderLevel}</td><td className="r num"><b data-testid="available">{r.available}</b></td>
                  <td><StatePill r={r} /></td>
                  {canEdit && <td style={{ minWidth: 90 }}><AdjustForm r={r} back={here} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={list.page} pageSize={list.pageSize} total={list.total} path="/inventory" params={base} />
        </>
      )}
      <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>Units reserved by orders that have not shipped are already taken off Available. Cancelling an order puts them back.</p>
    </>
  );
}
