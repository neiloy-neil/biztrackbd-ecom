import type { Metadata } from "next";
import Link from "next/link";
import { changePercent, getSalesReport, lastDays } from "@biztrackbd/core";
import { taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { methodName } from "@/lib/status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reports" };

const RANGES: [string, string, number][] = [["7", "Last 7 days", 7], ["30", "Last 30 days", 30], ["90", "Last 90 days", 90]];

function Change({ now, before, invert }: { now: number; before: number; invert?: boolean }) {
  const c = changePercent(now, before);
  if (c == null) return <div className="d">No earlier period to compare</div>;
  const good = invert ? c <= 0 : c >= 0;
  return <div className={`d ${good ? "up" : "down"}`}>{c >= 0 ? "+" : ""}{c}% vs previous period</div>;
}

export default async function Reports({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("reports");
  const key = RANGES.find((r) => r[0] === one(sp.range))?.[0] ?? "30";
  const days = RANGES.find((r) => r[0] === key)![2];
  const range = lastDays(days);
  const r = await getSalesReport(s.tenantId, s.actor, range);
  const max = Math.max(1, ...r.series.flatMap((d) => [d.sales, d.previousSales]));
  const label = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const maxDistrict = Math.max(1, ...r.byDistrict.map((d) => d.sales));
  const totalPay = Math.max(1, r.byPayment.reduce((n, p) => n + p.sales, 0));

  return (
    <>
      <div className="page-head">
        <h1>Reports</h1>
        <div className="actions"><a className="btn btn-secondary" href={`/reports/export?from=${range.from}&to=${range.to}`} download>Export CSV</a></div>
      </div>
      <p className="page-sub">{label(r.from)} to {label(r.to)} · compared with the {r.days} days before</p>
      <nav className="tabs" aria-label="Period">
        {RANGES.map(([k, l]) => <Link key={k} href={`/reports?range=${k}`} aria-current={k === key ? "page" : undefined} prefetch={false}>{l}</Link>)}
      </nav>

      <div className="grid grid-4" data-testid="report-stats">
        <div className="stat"><div className="k">Total sales</div><div className="v num">{taka(r.current.sales)}</div><Change now={r.current.sales} before={r.previous.sales} /></div>
        <div className="stat"><div className="k">Orders</div><div className="v num">{r.current.orders}</div><Change now={r.current.orders} before={r.previous.orders} /></div>
        <div className="stat"><div className="k">Average order</div><div className="v num">{taka(r.current.averageOrder)}</div><Change now={r.current.averageOrder} before={r.previous.averageOrder} /></div>
        <div className="stat"><div className="k">Return rate</div><div className="v num">{r.current.returnRate}%</div><div className="d">{r.previous.returnRate}% before</div></div>
      </div>

      <section className="card" style={{ marginTop: 14 }}>
        <div className="card-head"><h2>Sales over time</h2><span className="muted" style={{ fontSize: 12.5 }}>Lighter bars: previous period</span></div>
        <div className="bars" style={{ height: 160, gap: r.days > 40 ? 1 : 4 }} role="img" aria-label={`Daily sales from ${label(r.from)} to ${label(r.to)}. Total ${taka(r.current.sales)}.`}>
          {r.series.map((d, i) => (
            <div className="bar" key={d.date} title={`${label(d.date)}: ${taka(d.sales)}`} style={{ position: "relative" }}>
              <i style={{ height: `${Math.max(2, Math.round((d.sales / max) * 100))}%` }} />
              <i style={{ height: `${Math.max(0, Math.round((d.previousSales / max) * 100))}%`, opacity: 0.25, position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 0, background: "var(--brand)" }} aria-hidden="true" />
              {r.days <= 14 || i % Math.ceil(r.days / 7) === 0 ? <span>{label(d.date)}</span> : <span aria-hidden="true">&nbsp;</span>}
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-2" style={{ marginTop: 14 }}>
        <section className="card">
          <h2>Sales by district</h2>
          {r.byDistrict.length === 0 ? <p className="muted">No sales in this period.</p> : r.byDistrict.map((d) => (
            <div key={d.district} style={{ marginBottom: 10 }}>
              <div className="row" style={{ justifyContent: "space-between" }}><span>{d.district}</span><b className="num">{taka(d.sales)}</b></div>
              <div className="meter"><i style={{ width: `${(d.sales / maxDistrict) * 100}%` }} /></div>
            </div>
          ))}
        </section>
        <section className="card">
          <h2>How customers paid</h2>
          {r.byPayment.length === 0 ? <p className="muted">No sales in this period.</p> : r.byPayment.map((p) => (
            <div key={p.method} style={{ marginBottom: 10 }}>
              <div className="row" style={{ justifyContent: "space-between" }}><span>{methodName(p.method)} <span className="muted">({p.orders} {p.orders === 1 ? "order" : "orders"})</span></span><b className="num">{taka(p.sales)}</b></div>
              <div className="meter"><i style={{ width: `${(p.sales / totalPay) * 100}%` }} /></div>
            </div>
          ))}
        </section>
      </div>

      <section style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Top products</h2>
        {r.topProducts.length === 0 ? <div className="card empty">No sales in this period.</div> : (
          <table className="table" data-testid="top-products">
            <thead><tr><th>Product</th><th className="r">Units</th><th className="r">Sales</th><th className="r">Margin</th></tr></thead>
            <tbody>{r.topProducts.map((p) => <tr key={p.productId}><td>{p.title}</td><td className="r num">{p.units}</td><td className="r num">{taka(p.sales)}</td><td className="r num">{p.marginPercent == null ? <span className="muted" title="Add a cost price to the product to see margin">—</span> : `${p.marginPercent}%`}</td></tr>)}</tbody>
          </table>
        )}
      </section>
      <p className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>Sales count orders that were not cancelled or returned, by the day they were placed in Bangladesh time. Margin needs a cost price on the product.</p>
    </>
  );
}
