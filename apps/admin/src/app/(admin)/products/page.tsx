import type { Metadata } from "next";
import Link from "next/link";
import { can, getUsage, listAdminProducts, type ProductTab } from "@biztrackbd/core";
import { PlusIcon } from "@/components/icons";
import { Pager, Tabs } from "@/components/ui";
import { taka } from "@/lib/format";
import { one, pageOf, qs } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { Meter, limitNote } from "@/lib/usage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Products" };

const TABS: { key: ProductTab; label: string }[] = [{ key: "all", label: "All" }, { key: "active", label: "Active" }, { key: "draft", label: "Draft" }, { key: "out", label: "Out of stock" }];

function Thumb({ url, title }: { url: string | null; title: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="thumb">{url ? <img src={url} alt="" width={44} height={44} style={{ objectFit: "cover", width: "100%", height: "100%" }} /> : title.slice(0, 1).toUpperCase()}</span>;
}

export default async function Products({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("products");
  const tab = (TABS.find((t) => t.key === one(sp.tab))?.key ?? "all") as ProductTab;
  const q = one(sp.q)?.trim() ?? "";
  const categoryId = one(sp.category) || undefined;
  const page = pageOf(one(sp.page));
  const [list, usage] = await Promise.all([listAdminProducts(s.tenantId, s.actor, { tab, q: q || undefined, categoryId, page }), getUsage(s.tenantId)]);
  const canEdit = can(s.user.role, "products", "edit");
  const base = { tab: tab === "all" ? undefined : tab, q, category: categoryId };
  const note = limitNote("products", usage.products);

  return (
    <>
      <div className="page-head">
        <h1>Products</h1>
        <div className="actions">
          <Link href="/inventory" className="btn btn-secondary" prefetch={false}>Inventory</Link>
          {canEdit && <Link href="/products/new" className="btn btn-primary" prefetch={false} data-testid="add-product"><PlusIcon width={18} height={18} /> Add product</Link>}
        </div>
      </div>

      {(note || usage.products.limit != null) && (
        <div className="card" style={{ marginBottom: 14 }}>
          <Meter label="Products on your plan" usage={usage.products} />
          {note && <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>{note}</p>}
        </div>
      )}

      <Tabs tabs={TABS.map((t) => ({ href: `/products${qs({ ...base, tab: t.key === "all" ? undefined : t.key })}`, label: t.label, count: list.counts[t.key], current: t.key === tab }))} />

      <form className="toolbar" method="get" role="search">
        {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
        <label className="grow"><span className="sr-only">Search products</span><input className="input" type="search" name="q" defaultValue={q} placeholder="Search by name or SKU" /></label>
        <label><span className="sr-only">Category</span>
          <select className="select" name="category" defaultValue={categoryId ?? ""}><option value="">Category: all</option>{list.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <button className="btn btn-secondary" type="submit">Search</button>
      </form>

      {list.rows.length === 0 ? (
        <div className="card empty" data-testid="products-empty">
          {q || categoryId || tab !== "all" ? "No products match." : "You have no products yet."}
          {canEdit && !q && tab === "all" && <p style={{ marginTop: 12 }}><Link href="/products/new" className="btn btn-primary" prefetch={false}>Add your first product</Link></p>}
        </div>
      ) : (
        <>
          <div className="only-mobile">
            {list.rows.map((p) => (
              <Link key={p.id} href={`/products/${p.id}`} className="list-card" prefetch={false} data-testid="product-row">
                <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                  <Thumb url={p.imageUrl} title={p.title} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{p.title}</b>
                    <div className="muted" style={{ fontSize: 13 }}>{p.optionSummary}</div>
                    <div className="row" style={{ marginTop: 6 }}>
                      <span className={`pill ${p.status === "ACTIVE" ? "ok" : "grey"}`}>{p.status === "ACTIVE" ? "Active" : "Draft"}</span>
                      <span className={`pill ${p.stock === 0 ? "bad" : p.stock <= 5 ? "warn" : "grey"}`}>{p.stock} in stock</span>
                    </div>
                  </div>
                  <b className="num">{taka(p.price)}</b>
                </div>
              </Link>
            ))}
          </div>
          <table className="table only-desktop" data-testid="products-table">
            <thead><tr><th>Product</th><th>Status</th><th>Stock</th><th>Category</th><th className="r">Price</th><th className="r">Sold (30d)</th></tr></thead>
            <tbody>
              {list.rows.map((p) => (
                <tr key={p.id} data-testid="product-row">
                  <td><Link href={`/products/${p.id}`} className="row" style={{ flexWrap: "nowrap" }} prefetch={false}><Thumb url={p.imageUrl} title={p.title} /><span><b>{p.title}</b><br /><span className="muted" style={{ fontSize: 12.5 }}>{p.optionSummary}</span></span></Link></td>
                  <td><span className={`pill ${p.status === "ACTIVE" ? "ok" : "grey"}`}>{p.status === "ACTIVE" ? "Active" : "Draft"}</span></td>
                  <td><span className={`pill ${p.stock === 0 ? "bad" : p.stock <= 5 ? "warn" : "grey"}`}>{p.stock} in stock</span></td>
                  <td className="muted">{p.categoryName ?? "—"}</td>
                  <td className="r num">{taka(p.price)}</td>
                  <td className="r num">{p.sold30d}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={list.page} pageSize={list.pageSize} total={list.total} path="/products" params={base} />
        </>
      )}
    </>
  );
}
