import type { Metadata } from "next";
import Link from "next/link";
import { can, listCustomers, type CustomerSegment } from "@biztrackbd/core";
import { CustomerQuickButton, CustomerQuickHost } from "@/components/customer-quick-view";
import { LiveSearch } from "@/components/live-filters";
import { Pager, Tabs } from "@/components/ui";
import { PageHeader } from "@biztrackbd/ui";
import { friendlyDate, prettyPhone, taka } from "@/lib/format";
import { one, pageOf, qs } from "@/lib/query";
import { requireAccess } from "@/lib/session";

import { AddCustomerModal } from "./add-customer-modal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customers" };

const SEGMENTS: { key: CustomerSegment; label: string }[] = [
  { key: "all", label: "All" }, { key: "repeat", label: "Repeat buyers" }, { key: "vip", label: "VIP" }, { key: "dormant", label: "No order in 60 days" }, { key: "failed", label: "Failed delivery" },
];

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

export default async function Customers({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("customers");
  const segment = (SEGMENTS.find((x) => x.key === one(sp.segment))?.key ?? "all") as CustomerSegment;
  const q = one(sp.q)?.trim() ?? "";
  const page = pageOf(one(sp.page));
  const err = one(sp.err);
  const ok = one(sp.ok);
  const list = await listCustomers(s.tenantId, s.actor, { segment, q: q || undefined, page });
  const base = { segment: segment === "all" ? undefined : segment, q };

  return (
    <>
      <PageHeader
        title="Customers"
        crumbs={[{ label: "Home", href: "/" }, { label: "Customers" }]}
        actions={
          <>
            {can(s.user.role, "customers", "edit") && <AddCustomerModal />}
            {can(s.user.role, "customers", "edit") && <Link href="/customers/import" className="btn btn-secondary" prefetch={false} data-testid="import-customers">Import</Link>}
            <a className="btn btn-secondary" href="/customers/export" download>Export CSV</a>
          </>
        }
      />
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {ok && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Saved.</div>}

      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <div className="stat"><div className="k">All customers</div><div className="v num">{list.summary.all}</div></div>
        <div className="stat"><div className="k">New this month</div><div className="v num">{list.summary.newThisMonth}</div></div>
        <div className="stat"><div className="k">Repeat customers</div><div className="v num">{list.summary.repeatPercent}%</div></div>
        <div className="stat"><div className="k">Average order</div><div className="v num">{can(s.user.role, "reports") ? taka(list.summary.averageOrderValue) : "—"}</div></div>
      </div>

      <Tabs tabs={SEGMENTS.map((x) => ({ href: `/customers${qs({ ...base, segment: x.key === "all" ? undefined : x.key })}`, label: x.label, current: x.key === segment }))} />
      <form className="toolbar" method="get" role="search">
        {segment !== "all" && <input type="hidden" name="segment" value={segment} />}
        <LiveSearch name="q" label="Search customers" placeholder="Name, phone or email" defaultValue={q} />
        <button className="sr-only" type="submit">Search</button>
      </form>

      {list.rows.length === 0 ? <div className="card empty">{q || segment !== "all" ? "No customers match." : "Customers appear here after their first order."}</div> : (
        <CustomerQuickHost>
          <div className="only-mobile">
            {list.rows.map((c) => (
              <div key={c.id} className="list-card" data-testid="customer-row">
                <Link href={`/customers/${c.id}`} prefetch={false} style={{ display: "block" }}>
                <div className="top"><b>{c.name}</b>{c.isVip && <span className="pill info">VIP</span>}{c.isBlocked && <span className="pill bad">Blocked</span>}</div>
                <div className="muted num" style={{ fontSize: 13 }}>{prettyPhone(c.phone)}{c.area ? ` · ${c.area}` : ""}</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{c.orders} {c.orders === 1 ? "order" : "orders"} · {taka(c.spent)}{c.lastOrderAt ? ` · ${friendlyDate(c.lastOrderAt)}` : ""}</div>
                </Link>
                <div style={{ marginTop: 8 }}><CustomerQuickButton id={c.id} label={c.name} /></div>
              </div>
            ))}
          </div>
          <table className="table only-desktop">
            <thead><tr><th>Customer</th><th>Phone</th><th>Location</th><th className="r">Orders</th><th className="r">Delivered spend</th><th>Last order</th><th><span className="sr-only">Quick view</span></th></tr></thead>
            <tbody>
              {list.rows.map((c) => (
                <tr key={c.id} data-testid="customer-row">
                  <td><Link href={`/customers/${c.id}`} className="row" style={{ flexWrap: "nowrap" }} prefetch={false}>
                    <span className="thumb" style={{ borderRadius: "50%", width: 36, height: 36, fontWeight: 700 }}>{initials(c.name)}</span>
                    <span><b>{c.name}</b>{c.isVip && <> <span className="pill info">VIP</span></>}{c.isBlocked && <> <span className="pill bad">Blocked</span></>}<br /><span className="muted" style={{ fontSize: 12.5 }}>{c.email ?? ""}</span></span></Link></td>
                  <td className="num">{prettyPhone(c.phone)}</td><td className="muted">{c.area ?? "—"}</td>
                  <td className="r num">{c.orders}</td><td className="r num">{taka(c.spent)}</td><td className="muted">{c.lastOrderAt ? friendlyDate(c.lastOrderAt) : "—"}</td>
                  <td><CustomerQuickButton id={c.id} label={c.name} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={list.page} pageSize={list.pageSize} total={list.total} path="/customers" params={base} />
        </CustomerQuickHost>
      )}
    </>
  );
}
