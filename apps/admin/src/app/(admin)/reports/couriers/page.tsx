import type { Metadata } from "next";
import Link from "next/link";
import { getCourierReport, resolveReportRange } from "@biztrackbd/core";
import { taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { DateRangeFilter } from "../components/date-range-filter";
import { ReportTabs } from "../components/report-tabs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Couriers & Delivery | Reports" };

export default async function CourierReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const s = await requireAccess("reports");

  const rangeParam = one(sp.range);
  const fromParam = one(sp.from);
  const toParam = one(sp.to);

  const resolved = resolveReportRange({ range: rangeParam, from: fromParam, to: toParam });
  const r = await getCourierReport(s.tenantId, s.actor, resolved);

  const queryString = `from=${resolved.from}&to=${resolved.to}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 style={{ margin: 0 }}>Courier & Delivery Performance</h1>
          <p className="page-sub" style={{ margin: "4px 0 0" }}>
            Benchmark courier delivery success rates, return-to-origin (RTO) losses, and district turnaround times.
          </p>
        </div>
        <div className="actions">
          <a
            className="btn btn-secondary"
            href={`/reports/couriers/export?from=${r.range.from}&to=${r.range.to}`}
            download
          >
            Export Couriers CSV
          </a>
        </div>
      </div>

      <ReportTabs currentTab="couriers" queryString={queryString} />

      <DateRangeFilter
        basePath="/reports/couriers"
        currentPreset={resolved.presetKey}
        currentFrom={resolved.from}
        currentTo={resolved.to}
      />

      {/* 4 KPI Cards */}
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="k">Delivery Success Rate</div>
          <div
            className="v num"
            style={{ color: r.deliverySuccessRate >= 85 ? "#16a34a" : "#f59e0b" }}
          >
            {r.deliverySuccessRate}%
          </div>
          <div className="d">Of {r.totalDispatched} dispatched parcels</div>
        </div>

        <div className="stat">
          <div className="k">Return to Origin (RTO)</div>
          <div
            className="v num"
            style={{ color: r.returnRate > 15 ? "#dc2626" : "inherit" }}
          >
            {r.returnRate}%
          </div>
          <div className="d">Undelivered & returned parcels</div>
        </div>

        <div className="stat">
          <div className="k">Avg Delivery Lead Time</div>
          <div className="v num">
            {r.averageLeadDays != null ? `${r.averageLeadDays} days` : "—"}
          </div>
          <div className="d">From dispatch to customer door</div>
        </div>

        <div className="stat">
          <div className="k">COD Cash Collected</div>
          <div className="v num">{taka(r.totalCodCollected)}</div>
          <div className="d">
            <Link href="/finance/cod" className="link" style={{ fontSize: 12 }}>
              Check COD Payouts &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Courier Comparison Matrix */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Courier Comparison Matrix</h2>
          <Link href="/settings/shipping" className="link" style={{ fontSize: 13 }}>
            Courier API Settings &rarr;
          </Link>
        </div>

        {r.couriers.length === 0 ? (
          <div className="card empty">No parcels dispatched in this period.</div>
        ) : (
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Courier Provider</th>
                  <th className="r">Parcels</th>
                  <th className="r">Delivered</th>
                  <th className="r">Delivery Rate</th>
                  <th className="r">Returned</th>
                  <th className="r">RTO Rate</th>
                  <th className="r">In Transit</th>
                  <th className="r">Avg Days</th>
                  <th className="r">COD Collected</th>
                </tr>
              </thead>
              <tbody>
                {r.couriers.map((c) => (
                  <tr key={c.courier}>
                    <td>
                      <b>{c.courier}</b>
                    </td>
                    <td className="r num">{c.total}</td>
                    <td className="r num">{c.delivered}</td>
                    <td className="r num">
                      <span className={c.deliveredPercent >= 85 ? "pill green" : "pill"}>
                        {c.deliveredPercent}%
                      </span>
                    </td>
                    <td className="r num">{c.returned}</td>
                    <td className="r num">
                      <span className={c.returnPercent > 15 ? "pill bad" : "pill grey"}>
                        {c.returnPercent}%
                      </span>
                    </td>
                    <td className="r num">{c.inTransit}</td>
                    <td className="r num">{c.averageDays != null ? `${c.averageDays}d` : "—"}</td>
                    <td className="r num">{taka(c.codCollected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* District Fulfillment Performance & Return Reasons */}
      <div className="grid grid-2" style={{ gap: 16, marginBottom: 28 }}>
        {/* District Fulfillment Performance */}
        <section className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 16, margin: "0 0 14px" }}>District Fulfillment Performance</h2>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {r.districts.length === 0 ? (
              <p className="muted">No district delivery data.</p>
            ) : (
              <table className="table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>District</th>
                    <th className="r">Orders</th>
                    <th className="r">Delivery %</th>
                    <th className="r">Return %</th>
                  </tr>
                </thead>
                <tbody>
                  {r.districts.map((d) => (
                    <tr key={d.district}>
                      <td>
                        <b>{d.district}</b>
                      </td>
                      <td className="r num">{d.total}</td>
                      <td className="r num">
                        <span className={d.deliveredPercent >= 85 ? "pill green" : "pill"}>
                          {d.deliveredPercent}%
                        </span>
                      </td>
                      <td className="r num">
                        <span className={d.returnPercent > 15 ? "pill bad" : "pill grey"}>
                          {d.returnPercent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Return Reasons Breakdown */}
        <section className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 16, margin: "0 0 14px" }}>Reported Return & Refusal Reasons</h2>
          {r.returnReasons.length === 0 ? (
            <p className="muted">No specific return reasons recorded for this period.</p>
          ) : (
            <div>
              {r.returnReasons.map((res) => (
                <div key={res.reason} style={{ marginBottom: 12 }}>
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13.5 }}>{res.reason}</span>
                    <b className="num">
                      {res.count} ({res.percent}%)
                    </b>
                  </div>
                  <div className="meter">
                    <i
                      style={{
                        width: `${res.percent}%`,
                        background: res.percent > 40 ? "#dc2626" : "var(--brand)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
