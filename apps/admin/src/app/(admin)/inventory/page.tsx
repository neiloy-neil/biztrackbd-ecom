import type { Metadata } from "next";
import Link from "next/link";
import { can, listInventory, type InventoryRow, type StockFilter } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { LiveSearch, SelectFilter } from "@/components/live-filters";
import { Pager, SubmitButton, Tabs } from "@/components/ui";
import { taka } from "@/lib/format";
import { one, pageOf, qs } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { InventoryMobileCard, InventoryTableRow } from "./inline-stepper";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inventory" };

function StatePill({ r }: { r: InventoryRow }) {
  return <span className={`pill ${r.state === "out" ? "bad" : r.state === "low" ? "warn" : "grey"}`}>{r.state === "out" ? "Out" : r.state === "low" ? "Low" : "OK"}</span>;
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
      <PageHeader
        title="Inventory"
        crumbs={[{ label: "Home", href: "/" }, { label: "Inventory" }]}
        actions={
          <>
            <Link href="/inventory/alerts" className="btn btn-secondary" prefetch={false} data-testid="open-alerts">Back in stock requests</Link>
            <Link href="/products" className="btn btn-secondary" prefetch={false}>Products</Link>
          </>
        }
      />
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
        <LiveSearch name="q" label="Search" placeholder="Search by product or SKU" defaultValue={q} />
        {list.shelves.length > 0 && <SelectFilter name="shelf" label="Shelf" value={shelf ?? ""} options={[{ value: "", label: "Shelf: all" }, ...list.shelves.map((x) => ({ value: x, label: x }))]} />}
        <button className="sr-only" type="submit">Search</button>
      </form>

      {list.rows.length === 0 ? <div className="card empty">Nothing here.</div> : (
        <>
          <div className="only-mobile">
            {list.rows.map((r) => (
              <InventoryMobileCard
                key={r.variantId}
                r={r}
                canEdit={canEdit}
                back={here}
              />
            ))}
          </div>
          <table className="table only-desktop" data-testid="inventory-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Shelf</th>
                <th className="r">Committed</th>
                <th className="r">Reorder at</th>
                <th className="r" style={{ minWidth: 140 }}>Available</th>
                <th>Status</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {list.rows.map((r) => (
                <InventoryTableRow
                  key={r.variantId}
                  r={r}
                  canEdit={canEdit}
                  back={here}
                />
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
