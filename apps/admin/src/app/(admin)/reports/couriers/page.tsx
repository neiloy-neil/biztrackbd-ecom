import type { Metadata } from "next";
import Link from "next/link";
import { getCourierReport, resolveReportRange } from "@biztrackbd/core";
import { taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { DateRangeFilter } from "../components/date-range-filter";
import { ReportTabs } from "../components/report-tabs";
import { PageHeader } from "@biztrackbd/ui";

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
      <PageHeader
        title="Courier & Delivery Performance"
        crumbs={[{ label: "Reports", href: "/reports" }, { label: "Couriers" }]}
        sub="Benchmark courier delivery success rates, return-to-origin (RTO) losses, and district turnaround times."
        actions={
          <a
            className="btn btn-secondary"
            href={`/reports/couriers/export?from=${r.range.from}&to=${r.range.to}`}
            download
          >
            Export Couriers CSV
          </a>
        }
      />

      <ReportTabs currentTab="couriers" queryString={queryString} />

      <DateRangeFilter
        basePath="/reports/couriers"
        currentPreset={resolved.presetKey}
        currentFrom={resolved.from}
        currentTo={resolved.to}
      />

      {/* 4 KPI Cards */}
      <div className="grid grid-4 mb-lg">
        <div className="stat">
          <div className="k">Delivery Success Rate</div>
          <div className={`v num ${r.deliverySuccessRate >= 85 ? "stat-success" : "stat-warn"}`}>
            {r.deliverySuccessRate}%
          </div>
          <div className="d">Of {r.totalDispatched} dispatched parcels</div>
        </div>

        <div className="stat">
          <div className="k">Return to Origin (RTO)</div>
          <div className={`v num ${r.returnRate > 15 ? "stat-danger" : ""}`}>
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
            <Link href="/finance/cod" className="link text-xs">
              Check COD Payouts &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Courier Comparison Matrix */}
      <section className="stack gap-sm mb-lg">
        <div className="flex-between mb-sm">
          <h2 className="text-base text-bold m-0">Courier Comparison Matrix</h2>
          <Link href="/settings/shipping" className="link text-sm">
            Courier API Settings &rarr;
          </Link>
        </div>

        {r.couriers.length === 0 ? (
          <div className="card empty">No parcels dispatched in this period.</div>
        ) : (
          <div className="card p-0">
            <table className="table">
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
      <div className="grid grid-2 gap-lg mb-xl">
        {/* District Fulfillment Performance */}
        <section className="card">
          <h2 className="text-base text-bold mb-md m-0">District Fulfillment Performance</h2>
          <div className="table-scroll-320">
            {r.districts.length === 0 ? (
              <p className="muted">No district delivery data.</p>
            ) : (
              <table className="table">
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
        <section className="card">
          <h2 className="text-base text-bold mb-md m-0">Reported Return & Refusal Reasons</h2>
          {r.returnReasons.length === 0 ? (
            <p className="muted">No specific return reasons recorded for this period.</p>
          ) : (
            <div>
              {r.returnReasons.map((res) => (
                <div key={res.reason} className="mb-sm">
                  <div className="row flex-between mb-xs">
                    <span className="text-sm">{res.reason}</span>
                    <b className="num">
                      {res.count} ({res.percent}%)
                    </b>
                  </div>
                  <div className="meter">
                    <i
                      style={{ width: `${res.percent}%` }}
                      className={res.percent > 40 ? "text-danger" : ""}
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
