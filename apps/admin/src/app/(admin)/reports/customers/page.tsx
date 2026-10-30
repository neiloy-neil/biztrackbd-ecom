import type { Metadata } from "next";
import Link from "next/link";
import { getCustomerReport, resolveReportRange } from "@biztrackbd/core";
import { taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { DateRangeFilter } from "../components/date-range-filter";
import { ReportTabs } from "../components/report-tabs";
import { PageHeader } from "@biztrackbd/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customers & Cohorts | Reports" };

export default async function CustomerReportsPage({
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
  const r = await getCustomerReport(s.tenantId, s.actor, resolved);

  const queryString = `from=${resolved.from}&to=${resolved.to}`;

  return (
    <>
      <PageHeader
        title="Customer & Cohort Analytics"
        crumbs={[{ label: "Reports", href: "/reports" }, { label: "Customers" }]}
        sub="Measure first-time vs repeat buyer dynamics, customer lifetime value (LTV), and VIP retention cohorts."
        actions={
          <a
            className="btn btn-secondary"
            href={`/reports/customers/export?from=${r.range.from}&to=${r.range.to}`}
            download
          >
            Export Customers CSV
          </a>
        }
      />

      <ReportTabs currentTab="customers" queryString={queryString} />

      <DateRangeFilter
        basePath="/reports/customers"
        currentPreset={resolved.presetKey}
        currentFrom={resolved.from}
        currentTo={resolved.to}
      />

      {/* 4 KPI Cards */}
      <div className="grid grid-4 mb-lg">
        <div className="stat">
          <div className="k">Repeat Buyer Revenue Share</div>
          <div className={`v num ${r.repeatRevenueShare >= 40 ? "stat-success" : ""}`}>
            {r.repeatRevenueShare}%
          </div>
          <div className="d">Of period gross sales</div>
        </div>

        <div className="stat">
          <div className="k">Customer Lifetime Value (LTV)</div>
          <div className="v num">{taka(r.averageLtv)}</div>
          <div className="d">Average revenue per customer</div>
        </div>

        <div className="stat">
          <div className="k">Repeat Purchase Rate</div>
          <div className="v num">{r.repeatPurchaseRate}%</div>
          <div className="d">Shoppers with 2+ orders</div>
        </div>

        <div className="stat">
          <div className="k">Avg Orders per Customer</div>
          <div className="v num">{r.averageOrdersPerCustomer}</div>
          <div className="d">Across {r.totalCustomers.toLocaleString()} customers</div>
        </div>
      </div>

      {/* First-Time vs Returning Shopper Comparison */}
      <div className="grid grid-2 gap-lg mb-lg">
        <div className="card card-panel-info">
          <div className="flex-between mb-sm">
            <h3 className="m-0 text-base text-bold">{r.segments.firstTime.label}</h3>
            <span className="pill info text-xs">
              {r.segments.firstTime.percentOfTotalRevenue}% of revenue
            </span>
          </div>
          <div className="grid grid-3 gap-sm">
            <div>
              <div className="muted text-xs">Shoppers</div>
              <div className="text-base text-bold">{r.segments.firstTime.customersCount}</div>
            </div>
            <div>
              <div className="muted text-xs">Orders</div>
              <div className="text-base text-bold">{r.segments.firstTime.ordersCount}</div>
            </div>
            <div>
              <div className="muted text-xs">Avg Order (AOV)</div>
              <div className="text-base text-bold">{taka(r.segments.firstTime.averageOrderValue)}</div>
            </div>
          </div>
          <div className="mt-md text-sm text-muted">
            Total Revenue: <b>{taka(r.segments.firstTime.revenue)}</b>
          </div>
        </div>

        <div className="card card-panel-muted">
          <div className="flex-between mb-sm">
            <h3 className="m-0 text-base text-bold">{r.segments.returning.label}</h3>
            <span className="pill good text-xs">
              {r.segments.returning.percentOfTotalRevenue}% of revenue
            </span>
          </div>
          <div className="grid grid-3 gap-sm">
            <div>
              <div className="muted text-xs">Shoppers</div>
              <div className="text-base text-bold">{r.segments.returning.customersCount}</div>
            </div>
            <div>
              <div className="muted text-xs">Orders</div>
              <div className="text-base text-bold">{r.segments.returning.ordersCount}</div>
            </div>
            <div>
              <div className="muted text-xs">Avg Order (AOV)</div>
              <div className="text-base text-bold">{taka(r.segments.returning.averageOrderValue)}</div>
            </div>
          </div>
          <div className="mt-md text-sm text-muted">
            Total Revenue: <b>{taka(r.segments.returning.revenue)}</b>
          </div>
        </div>
      </div>

      {/* RFM Cohort Segmentation Grid */}
      <section className="stack gap-sm mb-xl">
        <h2 className="text-base text-bold m-0 mb-sm">Customer Lifecycle & RFM Cohorts</h2>
        <div className="grid grid-4 gap-md">
          {r.rfmCohorts.map((cohort) => (
            <div key={cohort.segment} className="card">
              <div className="flex-between mb-xs">
                <h4 className="m-0 text-sm text-bold">{cohort.label}</h4>
                <span className="pill text-xs">{cohort.percentOfBase}%</span>
              </div>
              <p className="muted text-xs mb-sm min-h-32">
                {cohort.description}
              </p>
              <div className="border-top pt-xs">
                <div className="text-base text-bold">{cohort.count.toLocaleString()} customers</div>
                <div className="muted text-xs mt-xs">
                  Lifetime: {taka(cohort.totalRevenue)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Top 20 VIP Spenders Leaderboard */}
      <section className="stack gap-sm mb-xl">
        <div className="flex-between mb-sm">
          <h2 className="text-base text-bold m-0">Top VIP Spenders Leaderboard</h2>
          <Link href="/customers" className="link text-sm">
            Full Customer CRM &rarr;
          </Link>
        </div>

        {r.topVipCustomers.length === 0 ? (
          <div className="card empty">No customers in database.</div>
        ) : (
          <div className="card p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Rank & Customer</th>
                  <th>Phone Number</th>
                  <th>District</th>
                  <th className="r">Orders Placed</th>
                  <th className="r">Lifetime Spend (BDT)</th>
                  <th>Last Order</th>
                  <th>Profile</th>
                </tr>
              </thead>
              <tbody>
                {r.topVipCustomers.map((vip, i) => (
                  <tr key={vip.customerId}>
                    <td>
                      <span className="muted text-bold mr-xs">
                        #{i + 1}
                      </span>
                      <b>{vip.name}</b>
                    </td>
                    <td>{vip.phone}</td>
                    <td>{vip.district}</td>
                    <td className="r num">
                      <b>{vip.ordersCount}</b>
                    </td>
                    <td className="r num">
                      <b className="stat-success">{taka(vip.totalSpend)}</b>
                    </td>
                    <td>
                      <span className="muted text-xs">
                        {vip.lastOrderDate}
                      </span>
                    </td>
                    <td>
                      <Link href={`/customers/${vip.customerId}`} className="link text-xs">
                        View CRM &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
