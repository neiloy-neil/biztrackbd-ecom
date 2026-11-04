import type { Metadata } from "next";
import Link from "next/link";
import { REVENUE_RANGES, getCatalogueRevenue, isRevenueRange, type RevenueLine, type RevenueRange } from "@biztrackbd/core";
import { dateTime, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Theme and module revenue" };

const RANGE_LABEL: Record<RevenueRange, string> = { "30d": "Last 30 days", "90d": "Last 90 days", "12m": "Last 12 months", all: "All time" };

const monthLabel = (m: string) => new Date(`${m}-15T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });

function Table({ title, rows, empty, testId }: { title: string; rows: RevenueLine[]; empty: string; testId: string }) {
  return (
    <section className="card" style={{ padding: 0, overflow: "hidden" }} data-testid={testId} aria-label={title}>
      <h2 style={{ margin: 0, padding: "16px 20px", fontSize: 16, borderBottom: "1px solid var(--line)" }}>{title}</h2>
      {rows.length === 0 ? (
        <p className="muted" style={{ padding: 20, margin: 0 }}>{empty}</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480, fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--bg)", color: "var(--ink-3)", fontSize: 12, textAlign: "left" }}>
                <th scope="col" style={{ padding: "10px 20px" }}>Name</th>
                <th scope="col" style={{ padding: "10px 8px", textAlign: "right" }}>Sales</th>
                <th scope="col" style={{ padding: "10px 8px", textAlign: "right" }}>Stores</th>
                <th scope="col" style={{ padding: "10px 8px", textAlign: "right" }}>Earned</th>
                <th scope="col" style={{ padding: "10px 20px", textAlign: "right" }}>Last sale</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <th scope="row" style={{ padding: "10px 20px", textAlign: "left", fontWeight: 600 }}>{r.name}</th>
                  <td style={{ padding: "10px 8px", textAlign: "right" }}>{r.orders}</td>
                  <td style={{ padding: "10px 8px", textAlign: "right" }}>{r.stores}</td>
                  <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700 }}>{taka(r.revenue)}</td>
                  <td style={{ padding: "10px 20px", textAlign: "right" }} className="muted">{dateTime(r.lastSaleAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function RevenuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const s = await requireAccess("payments");
  const sp = await searchParams;
  const asked = one(sp.range);
  const range: RevenueRange = isRevenueRange(asked) ? asked : "30d";
  const r = await getCatalogueRevenue(s.actor, range);
  const top = Math.max(1, ...r.byMonth.map((m) => m.total));

  return (
    <div className="stack">
      <div className="page-head"><h1>Theme and module revenue</h1></div>
      <p className="page-sub">What stores paid for themes and add-on modules, counted when you approved the payment. Plan subscriptions are on the Payments page.</p>

      <nav aria-label="Period" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {REVENUE_RANGES.map((x) => (
          <Link key={x} href={`/revenue?range=${x}`} prefetch={false} aria-current={x === range ? "page" : undefined} className={x === range ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"} style={{ minHeight: 44 }}>{RANGE_LABEL[x]}</Link>
        ))}
      </nav>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }} data-testid="revenue-kpis">
        <div className="card" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 13 }}>Total earned</div><div style={{ fontSize: 26, fontWeight: 800 }} data-testid="revenue-total">{taka(r.totals.total)}</div><div className="muted" style={{ fontSize: 12 }}>{r.totals.orders} sales</div></div>
        <div className="card" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 13 }}>From themes</div><div style={{ fontSize: 22, fontWeight: 700 }}>{taka(r.totals.themes)}</div></div>
        <div className="card" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 13 }}>From modules</div><div style={{ fontSize: 22, fontWeight: 700 }}>{taka(r.totals.modules)}</div></div>
        <div className="card" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 13 }}>Waiting for approval</div><div style={{ fontSize: 22, fontWeight: 700 }}>{taka(r.pending.amount)}</div><div className="muted" style={{ fontSize: 12 }}>{r.pending.count} payments, <Link href="/payments" className="link" prefetch={false}>review</Link></div></div>
        <div className="card" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 13 }}>Paid up monthly right now</div><div style={{ fontSize: 22, fontWeight: 700 }}>{r.active.monthlyThemes + r.active.monthlyModules}</div><div className="muted" style={{ fontSize: 12 }}>{r.active.monthlyThemes} themes, {r.active.monthlyModules} modules</div></div>
      </div>

      <section className="card" style={{ padding: 20 }} aria-labelledby="months-h" data-testid="revenue-months">
        <h2 id="months-h" style={{ margin: "0 0 14px", fontSize: 16 }}>Last 12 months</h2>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 150 }} role="img" aria-label={`Monthly earnings, highest ${taka(top)}`}>
          {r.byMonth.map((m) => (
            <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 4, minWidth: 0 }} title={`${monthLabel(m.month)}: ${taka(m.total)} (themes ${taka(m.themes)}, modules ${taka(m.modules)})`}>
              <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 120 }}>
                <div style={{ height: `${(m.modules / top) * 100}%`, background: "var(--gold-dark, #946300)", borderRadius: "3px 3px 0 0" }} />
                <div style={{ height: `${(m.themes / top) * 100}%`, background: "var(--brand)", borderRadius: m.modules ? 0 : "3px 3px 0 0" }} />
              </div>
              <span style={{ fontSize: 12 }} className="muted">{monthLabel(m.month).split(" ")[0]}</span>
            </div>
          ))}
        </div>
        <p className="muted" style={{ margin: "10px 0 0", fontSize: 12 }}><span aria-hidden="true" style={{ display: "inline-block", width: 10, height: 10, background: "var(--brand)", marginRight: 6 }} />Themes <span aria-hidden="true" style={{ display: "inline-block", width: 10, height: 10, background: "var(--gold-dark, #946300)", margin: "0 6px 0 14px" }} />Modules</p>
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>Show the numbers</summary>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead><tr style={{ textAlign: "left", color: "var(--ink-3)" }}><th scope="col">Month</th><th scope="col" style={{ textAlign: "right" }}>Themes</th><th scope="col" style={{ textAlign: "right" }}>Modules</th><th scope="col" style={{ textAlign: "right" }}>Total</th></tr></thead>
            <tbody>{r.byMonth.map((m) => <tr key={m.month}><th scope="row" style={{ textAlign: "left", fontWeight: 500 }}>{monthLabel(m.month)}</th><td style={{ textAlign: "right" }}>{taka(m.themes)}</td><td style={{ textAlign: "right" }}>{taka(m.modules)}</td><td style={{ textAlign: "right", fontWeight: 700 }}>{taka(m.total)}</td></tr>)}</tbody>
          </table>
        </details>
      </section>

      <Table title="By theme" rows={r.byTheme} empty="No theme has been bought in this period." testId="revenue-themes" />
      <Table title="By module" rows={r.byModule} empty="No module has been bought in this period." testId="revenue-modules" />

      <section className="card" style={{ padding: 0, overflow: "hidden" }} aria-labelledby="recent-h" data-testid="revenue-recent">
        <h2 id="recent-h" style={{ margin: 0, padding: "16px 20px", fontSize: 16, borderBottom: "1px solid var(--line)" }}>Latest sales</h2>
        {r.recent.length === 0 ? (
          <p className="muted" style={{ padding: 20, margin: 0 }}>No sales in this period yet.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {r.recent.map((x, i) => (
              <li key={`${x.kind}-${x.id}-${i}`} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline", padding: "10px 20px", borderTop: i ? "1px solid var(--line)" : 0 }}>
                <span className="pill" style={{ fontSize: 12 }}>{x.kind === "THEME" ? "Theme" : "Module"}</span>
                <b style={{ flex: "1 1 200px" }}>{x.name}</b>
                <span className="muted" style={{ fontSize: 13 }}>{x.storeName}</span>
                <span style={{ fontWeight: 700 }}>{taka(x.amount)}</span>
                <span className="muted" style={{ fontSize: 12 }}>{dateTime(x.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
