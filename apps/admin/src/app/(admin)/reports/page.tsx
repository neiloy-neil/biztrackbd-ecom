import type { Metadata } from "next";
import { changePercent, getSalesReport, resolveReportRange } from "@biztrackbd/core";
import { taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { methodName } from "@/lib/status";
import { DateRangeFilter } from "./components/date-range-filter";
import { ReportTabs } from "./components/report-tabs";
import { PageHeader } from "@biztrackbd/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Overview & Sales | Reports" };

function Change({ now, before, invert }: { now: number; before: number; invert?: boolean }) {
  const c = changePercent(now, before);
  if (c == null) return <div className="d">No earlier period to compare</div>;
  const good = invert ? c <= 0 : c >= 0;
  return (
    <div className={`d ${good ? "up" : "down"}`}>
      {c >= 0 ? "+" : ""}
      {c}% vs previous period
    </div>
  );
}

export default async function ReportsPage({
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
  const r = await getSalesReport(s.tenantId, s.actor, resolved);

  const max = Math.max(1, ...r.series.flatMap((d) => [d.sales, d.previousSales]));
  const label = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));

  const maxDistrict = Math.max(1, ...r.byDistrict.map((d) => d.sales));
  const totalPay = Math.max(1, r.byPayment.reduce((n, p) => n + p.sales, 0));

  const queryString = `from=${resolved.from}&to=${resolved.to}`;

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        crumbs={[{ label: "Home", href: "/" }, { label: "Reports" }]}
        sub="Real-time business performance, fulfillment analytics, and cohort retention."
        actions={
          <a
            className="btn btn-secondary"
            href={`/reports/export?from=${r.from}&to=${r.to}`}
            download
          >
            Export Sales CSV
          </a>
        }
      />

      <ReportTabs currentTab="sales" queryString={queryString} />

      <DateRangeFilter
        basePath="/reports"
        currentPreset={resolved.presetKey}
        currentFrom={resolved.from}
        currentTo={resolved.to}
      />

      <div className="mb-md">
        <p className="muted text-sm m-0">
          Showing <b>{label(r.from)}</b> to <b>{label(r.to)}</b> ({r.days} days) &bull;{" "}
          compared with the previous {r.days} days ({label(resolved.prevFrom)} to {label(resolved.prevTo)})
        </p>
      </div>

      <div className="grid grid-4" data-testid="report-stats">
        <div className="stat">
          <div className="k">Total Sales</div>
          <div className="v num">{taka(r.current.sales)}</div>
          <Change now={r.current.sales} before={r.previous.sales} />
        </div>
        <div className="stat">
          <div className="k">Total Orders</div>
          <div className="v num">{r.current.orders}</div>
          <Change now={r.current.orders} before={r.previous.orders} />
        </div>
        <div className="stat">
          <div className="k">Average Order (AOV)</div>
          <div className="v num">{taka(r.current.averageOrder)}</div>
          <Change now={r.current.averageOrder} before={r.previous.averageOrder} />
        </div>
        <div className="stat">
          <div className="k">Return Rate</div>
          <div className="v num">{r.current.returnRate}%</div>
          <div className="d">{r.previous.returnRate}% in previous period</div>
        </div>
      </div>

      <section className="card mt-md">
        <div className="card-head mb-sm">
          <h2 className="m-0 text-base">Sales Over Time</h2>
          <span className="muted text-xs">
            Solid bars: current period &bull; Lighter bars: previous period
          </span>
        </div>
        <div
          className="bars chart-bars-160"
          role="img"
          aria-label={`Daily sales from ${label(r.from)} to ${label(r.to)}. Total ${taka(r.current.sales)}.`}
        >
          {r.series.map((d, i) => (
            <div
              className="bar pos-relative"
              key={d.date}
              title={`${label(d.date)}: ${taka(d.sales)} (Prev: ${taka(d.previousSales)})`}
            >
              <i style={{ height: `${Math.max(2, Math.round((d.sales / max) * 100))}%` }} />
              <i
                style={{ height: `${Math.max(0, Math.round((d.previousSales / max) * 100))}%` }}
                className="bar-prev"
                aria-hidden="true"
              />
              {r.days <= 14 || i % Math.ceil(r.days / 7) === 0 ? (
                <span>{label(d.date)}</span>
              ) : (
                <span aria-hidden="true">&nbsp;</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-2 gap-lg mt-md">
        <section className="card">
          <h2 className="text-base mb-md m-0">Sales by Delivery District</h2>
          {r.byDistrict.length === 0 ? (
            <p className="muted">No sales in this period.</p>
          ) : (
            r.byDistrict.map((d) => (
              <div key={d.district} className="mb-sm">
                <div className="row flex-between mb-xs">
                  <span className="text-sm">{d.district}</span>
                  <b className="num">{taka(d.sales)}</b>
                </div>
                <div className="meter">
                  <i style={{ width: `${(d.sales / maxDistrict) * 100}%` }} />
                </div>
              </div>
            ))
          )}
        </section>

        <section className="card">
          <h2 className="text-base mb-md m-0">Payment Methods Used</h2>
          {r.byPayment.length === 0 ? (
            <p className="muted">No sales in this period.</p>
          ) : (
            r.byPayment.map((p) => (
              <div key={p.method} className="mb-sm">
                <div className="row flex-between mb-xs">
                  <span className="text-sm">
                    {methodName(p.method)}{" "}
                    <span className="muted text-xs">
                      ({p.orders} {p.orders === 1 ? "order" : "orders"})
                    </span>
                  </span>
                  <b className="num">{taka(p.sales)}</b>
                </div>
                <div className="meter">
                  <i style={{ width: `${(p.sales / totalPay) * 100}%` }} />
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      <section className="mt-lg">
        <div className="flex-between mb-sm">
          <h2 className="text-base m-0">Top Performing Products</h2>
          <a href={`/reports/products?from=${r.from}&to=${r.to}`} className="link text-sm">
            Full Products & Stock Report &rarr;
          </a>
        </div>
        {r.topProducts.length === 0 ? (
          <div className="card empty">No sales in this period.</div>
        ) : (
          <div className="card p-0">
            <table className="table" data-testid="top-products">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="r">Units Sold</th>
                  <th className="r">Revenue</th>
                  <th className="r">Gross Margin</th>
                </tr>
              </thead>
              <tbody>
                {r.topProducts.map((p) => (
                  <tr key={p.productId}>
                    <td>
                      <b>{p.title}</b>
                    </td>
                    <td className="r num">{p.units}</td>
                    <td className="r num">{taka(p.sales)}</td>
                    <td className="r num">
                      {p.marginPercent == null ? (
                        <span className="muted" title="Set cost price on product to view margin">
                          —
                        </span>
                      ) : (
                        <span className={p.marginPercent >= 30 ? "pill green" : "pill"}>
                          {p.marginPercent}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="muted text-xs mt-md">
        Sales calculate all completed and dispatched orders in Bangladesh Time. Cancelled orders are excluded.
      </p>
    </>
  );
}
