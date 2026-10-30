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
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="k">Repeat Buyer Revenue Share</div>
          <div className="v num" style={{ color: r.repeatRevenueShare >= 40 ? "#16a34a" : "inherit" }}>
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
      <div className="grid grid-2" style={{ gap: 16, marginBottom: 24 }}>
        <div
          className="card"
          style={{
            padding: 20,
            borderLeft: "4px solid #3b82f6",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>{r.segments.firstTime.label}</h3>
            <span className="pill blue" style={{ fontSize: 12 }}>
              {r.segments.firstTime.percentOfTotalRevenue}% of revenue
            </span>
          </div>
          <div className="grid grid-3" style={{ gap: 10 }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Shoppers</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{r.segments.firstTime.customersCount}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Orders</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{r.segments.firstTime.ordersCount}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Avg Order (AOV)</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{taka(r.segments.firstTime.averageOrderValue)}</div>
            </div>
          </div>
          <div style={{ marginTop: 14, fontSize: 13, color: "var(--muted)" }}>
            Total Revenue: <b>{taka(r.segments.firstTime.revenue)}</b>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: 20,
            borderLeft: "4px solid #10b981",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>{r.segments.returning.label}</h3>
            <span className="pill green" style={{ fontSize: 12 }}>
              {r.segments.returning.percentOfTotalRevenue}% of revenue
            </span>
          </div>
          <div className="grid grid-3" style={{ gap: 10 }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Shoppers</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{r.segments.returning.customersCount}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Orders</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{r.segments.returning.ordersCount}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Avg Order (AOV)</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{taka(r.segments.returning.averageOrderValue)}</div>
            </div>
          </div>
          <div style={{ marginTop: 14, fontSize: 13, color: "var(--muted)" }}>
            Total Revenue: <b>{taka(r.segments.returning.revenue)}</b>
          </div>
        </div>
      </div>

      {/* RFM Cohort Segmentation Grid */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Customer Lifecycle & RFM Cohorts</h2>
        <div className="grid grid-4" style={{ gap: 14 }}>
          {r.rfmCohorts.map((cohort) => (
            <div key={cohort.segment} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{cohort.label}</h4>
                <span className="pill" style={{ fontSize: 11 }}>{cohort.percentOfBase}%</span>
              </div>
              <p className="muted" style={{ fontSize: 12, margin: "0 0 12px", minHeight: 32 }}>
                {cohort.description}
              </p>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{cohort.count.toLocaleString()} customers</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  Lifetime: {taka(cohort.totalRevenue)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Top 20 VIP Spenders Leaderboard */}
      <section style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Top VIP Spenders Leaderboard</h2>
          <Link href="/customers" className="link" style={{ fontSize: 13 }}>
            Full Customer CRM &rarr;
          </Link>
        </div>

        {r.topVipCustomers.length === 0 ? (
          <div className="card empty">No customers in database.</div>
        ) : (
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
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
                      <span className="muted" style={{ marginRight: 8, fontWeight: 700 }}>
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
                      <b style={{ color: "#16a34a" }}>{taka(vip.totalSpend)}</b>
                    </td>
                    <td>
                      <span className="muted" style={{ fontSize: 12.5 }}>
                        {vip.lastOrderDate}
                      </span>
                    </td>
                    <td>
                      <Link href={`/customers/${vip.customerId}`} className="link" style={{ fontSize: 12.5 }}>
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
