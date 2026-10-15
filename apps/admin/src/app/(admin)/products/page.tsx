import type { Metadata } from "next";
import Link from "next/link";
import { can, getUsage, listAdminProducts, type AdminProductRow, type ProductTab } from "@biztrackbd/core";
import { BulkBar } from "@/components/bulk";
import { LiveSearch, SelectFilter } from "@/components/live-filters";
import { PlusIcon } from "@/components/icons";
import { Pager, SubmitButton, Tabs } from "@/components/ui";
import { taka } from "@/lib/format";
import { one, pageOf, qs } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { Meter, limitNote } from "@/lib/usage";
import { bulkProductsAction } from "./bulk-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Products" };

const TABS: { key: ProductTab; label: string }[] = [{ key: "all", label: "All" }, { key: "active", label: "Active" }, { key: "draft", label: "Draft" }, { key: "out", label: "Out of stock" }];
const VERBS: Record<string, string> = { publish: "published", unpublish: "moved to draft", archive: "archived" };

function Thumb({ url, title, size = 44 }: { url: string | null; title: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="thumb" style={size === 44 ? undefined : { width: size, height: size }}>{url ? <img src={url} alt="" width={size} height={size} style={{ objectFit: "cover", width: "100%", height: "100%" }} /> : title.slice(0, 1).toUpperCase()}</span>;
}

function StockPill({ p }: { p: AdminProductRow }) {
  return <span className={`pill ${p.stock === 0 ? "bad" : p.stock <= 5 ? "warn" : "grey"}`}>{p.stock} in stock</span>;
}

export default async function Products({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("products");
  const tab = (TABS.find((t) => t.key === one(sp.tab))?.key ?? "all") as ProductTab;
  const q = one(sp.q)?.trim() ?? "";
  const categoryId = one(sp.category) || undefined;
  const collectionId = one(sp.collection) || undefined;
  const view = one(sp.view) === "grid" ? "grid" : "list";
  const page = pageOf(one(sp.page));
  const msg = one(sp.msg);
  const [list, usage] = await Promise.all([listAdminProducts(s.tenantId, s.actor, { tab, q: q || undefined, categoryId, collectionId, page }), getUsage(s.tenantId)]);
  const canEdit = can(s.user.role, "products", "edit");
  const base = { tab: tab === "all" ? undefined : tab, q, category: categoryId, collection: collectionId, view: view === "grid" ? "grid" : undefined };
  const here = `/products${qs(base)}`;
  const filtered = Boolean(q || categoryId || collectionId || tab !== "all");
  const note = limitNote("products", usage.products);
  const done = msg?.match(/^(publish|unpublish|archive)-(\d+)-(\d+)$/);

  return (
    <>
      <div className="page-head">
        <h1>Products</h1>
        <div className="actions">
          <Link href="/products/barcodes" className="btn btn-secondary" prefetch={false}>Barcode Labels</Link>
          <Link href="/inventory" className="btn btn-secondary" prefetch={false}>Inventory</Link>
          {canEdit && <Link href="/products/import" className="btn btn-secondary" prefetch={false} data-testid="import-csv">Import CSV</Link>}
          {canEdit && <Link href="/products/new" className="btn btn-primary" prefetch={false} data-testid="add-product"><PlusIcon width={18} height={18} /> Add product</Link>}
        </div>
      </div>

      {done && <div className="notice good" role="status" style={{ marginBottom: 12 }} data-testid="bulk-msg">{done[2]} {Number(done[2]) === 1 ? "product" : "products"} {VERBS[done[1]!]}.{Number(done[3]) ? ` ${done[3]} skipped (already ${done[1] === "publish" ? "active" : "that way"}).` : ""}</div>}
      {msg === "none" && <div className="notice" role="status" style={{ marginBottom: 12 }}>Select at least one product first.</div>}

      <Tabs tabs={TABS.map((t) => ({ href: `/products${qs({ ...base, tab: t.key === "all" ? undefined : t.key })}`, label: t.label, count: list.counts[t.key], current: t.key === tab }))} />

      {/* Filters apply as you type or choose. The form and its Search button are what a browser without scripts uses. */}
      <form className="toolbar" method="get" role="search">
        {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
        {view === "grid" && <input type="hidden" name="view" value="grid" />}
        <LiveSearch name="q" label="Search products" placeholder="Search by name or SKU" defaultValue={q} />
        <SelectFilter name="category" label="Category" value={categoryId ?? ""} options={[{ value: "", label: "Category: all" }, ...list.categories.map((c) => ({ value: c.id, label: c.name }))]} />
        {list.collections.length > 0 && <SelectFilter name="collection" label="Collection" value={collectionId ?? ""} options={[{ value: "", label: "Collection: all" }, ...list.collections.map((c) => ({ value: c.id, label: c.title }))]} />}
        <div className="view-toggle" role="group" aria-label="Layout">
          <Link href={`/products${qs({ ...base, view: undefined })}`} className="chip" aria-current={view === "list" ? "true" : undefined} prefetch={false}>List</Link>
          <Link href={`/products${qs({ ...base, view: "grid" })}`} className="chip" aria-current={view === "grid" ? "true" : undefined} prefetch={false} data-testid="view-grid">Grid</Link>
        </div>
        <button className="sr-only" type="submit">Search</button>
      </form>

      {list.rows.length === 0 ? (
        <div className="card empty" data-testid="products-empty">
          {filtered ? "No products match. Try clearing the filters." : "You have no products yet."}
          {canEdit && !filtered && <p style={{ marginTop: 12 }}><Link href="/products/new" className="btn btn-primary" prefetch={false}>Add your first product</Link> <Link href="/products/import" className="btn btn-secondary" prefetch={false}>or import a CSV</Link></p>}
        </div>
      ) : (
        <form>
          <input type="hidden" name="back" value={here} />
          {canEdit && (
            <BulkBar noun="product">
              <SubmitButton formAction={bulkProductsAction.bind(null, "publish")} className="btn btn-secondary btn-sm" pending="Publishing…" data-testid="bulk-publish">Publish</SubmitButton>
              <SubmitButton formAction={bulkProductsAction.bind(null, "unpublish")} className="btn btn-secondary btn-sm" pending="Saving…">Move to draft</SubmitButton>
              <SubmitButton formAction={bulkProductsAction.bind(null, "archive")} className="btn btn-secondary btn-sm" pending="Archiving…" data-testid="bulk-archive">Archive</SubmitButton>
            </BulkBar>
          )}

          {view === "grid" ? (
            <div className="pgrid" data-testid="products-grid">
              {list.rows.map((p) => (
                <div key={p.id} className="pcard" data-testid="product-row">
                  {canEdit && <input type="checkbox" name="ids" value={p.id} aria-label={`Select ${p.title}`} className="pick" />}
                  <Link href={`/products/${p.id}`} prefetch={false} className="pcard-link">
                    <span className="pcard-img">{p.imageUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.imageUrl} alt="" /> : <span className="ph">{p.title.slice(0, 1).toUpperCase()}</span>}</span>
                    <b className="pcard-title">{p.title}</b>
                    <span className="num">{taka(p.price)}</span>
                  </Link>
                  <div className="row" style={{ gap: 6 }}><span className={`pill ${p.status === "ACTIVE" ? "ok" : "grey"}`}>{p.status === "ACTIVE" ? "Active" : "Draft"}</span><StockPill p={p} /></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="only-mobile">
                {list.rows.map((p) => (
                  <div key={p.id} className="list-card" data-testid="product-row">
                    <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                      {canEdit && <input type="checkbox" name="ids" value={p.id} aria-label={`Select ${p.title}`} style={{ width: 20, height: 20, marginTop: 12 }} />}
                      <Link href={`/products/${p.id}`} className="row" style={{ flex: 1, minWidth: 0, flexWrap: "nowrap", alignItems: "flex-start" }} prefetch={false}>
                        <Thumb url={p.imageUrl} title={p.title} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <b>{p.title}</b>
                          <span className="muted" style={{ fontSize: 13, display: "block" }}>{p.optionSummary}</span>
                          <span className="row" style={{ marginTop: 6 }}><span className={`pill ${p.status === "ACTIVE" ? "ok" : "grey"}`}>{p.status === "ACTIVE" ? "Active" : "Draft"}</span><StockPill p={p} /></span>
                        </span>
                        <b className="num">{taka(p.price)}</b>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              <div className="table-scroll only-desktop">
                <table className="table" data-testid="products-table">
                  <thead><tr>{canEdit && <th style={{ width: 36 }}><span className="sr-only">Select</span></th>}<th>Product</th><th>Status</th><th>Stock</th><th>Category</th><th className="r">Price</th><th className="r">Sold (30d)</th></tr></thead>
                  <tbody>
                    {list.rows.map((p) => (
                      <tr key={p.id} data-testid="product-row">
                        {canEdit && <td><input type="checkbox" name="ids" value={p.id} aria-label={`Select ${p.title}`} style={{ width: 18, height: 18 }} /></td>}
                        <td><Link href={`/products/${p.id}`} className="row" style={{ flexWrap: "nowrap" }} prefetch={false}><Thumb url={p.imageUrl} title={p.title} /><span><b>{p.title}</b><br /><span className="muted" style={{ fontSize: 12.5 }}>{p.optionSummary}</span></span></Link></td>
                        <td><span className={`pill ${p.status === "ACTIVE" ? "ok" : "grey"}`}>{p.status === "ACTIVE" ? "Active" : "Draft"}</span></td>
                        <td><StockPill p={p} /></td>
                        <td className="muted">{p.categoryName ?? "—"}</td>
                        <td className="r num">{taka(p.price)}</td>
                        <td className="r num">{p.sold30d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <Pager page={list.page} pageSize={list.pageSize} total={list.total} path="/products" params={base} />
        </form>
      )}

      {(note || usage.products.limit != null) && (
        <div className="plan-foot" data-testid="plan-foot">
          <Meter label="Products on your plan" usage={usage.products} />
          {note && <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>{note}</p>}
        </div>
      )}
    </>
  );
}
