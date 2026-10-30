import type { Metadata } from "next";
import Link from "next/link";
import { getProductReport, resolveReportRange } from "@biztrackbd/core";
import { taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { DateRangeFilter } from "../components/date-range-filter";
import { ReportTabs } from "../components/report-tabs";
import { PageHeader } from "@biztrackbd/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Products & Stock Velocity | Reports" };

export default async function ProductReportsPage({
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
  const r = await getProductReport(s.tenantId, s.actor, resolved);

  const queryString = `from=${resolved.from}&to=${resolved.to}`;
  const maxCategorySales = Math.max(1, ...r.categories.map((c) => c.sales));

  return (
    <>
      <PageHeader
        title="Products & Stock Velocity"
        crumbs={[{ label: "Reports", href: "/reports" }, { label: "Products" }]}
        sub="Identify top revenue drivers, stockout risks, profit margins, and dead stock."
        actions={
          <a
            className="btn btn-secondary"
            href={`/reports/products/export?from=${r.range.from}&to=${r.range.to}`}
            download
          >
            Export Products CSV
          </a>
        }
      />

      <ReportTabs currentTab="products" queryString={queryString} />

      <DateRangeFilter
        basePath="/reports/products"
        currentPreset={resolved.presetKey}
        currentFrom={resolved.from}
        currentTo={resolved.to}
      />

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-4 mb-lg">
        <div className="stat">
          <div className="k">Total Units Sold</div>
          <div className="v num">{r.totalUnitsSold.toLocaleString()}</div>
          <div className="d">Across non-cancelled orders</div>
        </div>

        <div className="stat">
          <div className="k">Product Revenue</div>
          <div className="v num">{taka(r.totalSales)}</div>
          <div className="d">
            {r.averageMarginPercent != null ? (
              <span className="pill green text-xs">
                {r.averageMarginPercent}% avg margin
              </span>
            ) : (
              "Set cost price to view margin"
            )}
          </div>
        </div>

        <div className="stat">
          <div className="k">Current Inventory Valuation</div>
          <div className="v num">{taka(r.inventoryValuation)}</div>
          <div className="d">Based on unit cost / price</div>
        </div>

        <div className="stat">
          <div className="k">Stock Health Risks</div>
          <div className={`v num ${r.lowStockCount > 0 ? "stat-danger" : ""}`}>
            {r.lowStockCount} Low / {r.deadStockCount} Dead
          </div>
          <div className="d">
            {r.lowStockCount} items &le; 5 units &bull; {r.deadStockCount} dead in 60d
          </div>
        </div>
      </div>

      {/* Category Breakdown & Stockout Alert Side-by-Side */}
      <div className="grid grid-2 gap-lg mb-lg">
        <section className="card">
          <h2 className="text-base text-bold mb-md m-0">Sales by Product Category</h2>
          {r.categories.length === 0 ? (
            <p className="muted">No category sales recorded.</p>
          ) : (
            r.categories.map((c) => (
              <div key={c.categoryName} className="mb-sm">
                <div className="row flex-between mb-xs">
                  <span className="text-sm text-medium">
                    {c.categoryName}{" "}
                    <span className="muted text-xs">
                      ({c.units} units)
                    </span>
                  </span>
                  <span className="text-sm text-bold">
                    {taka(c.sales)}{" "}
                    <span className="muted text-xs">
                      ({c.percentOfTotal}%)
                    </span>
                  </span>
                </div>
                <div className="meter">
                  <i style={{ width: `${(c.sales / maxCategorySales) * 100}%` }} />
                </div>
              </div>
            ))
          )}
        </section>

        <section className="card">
          <div className="flex-between mb-md">
            <h2 className="text-base text-bold m-0">Stock Runway & Velocity</h2>
            <Link href="/inventory" className="link text-sm">
              Manage Stock &rarr;
            </Link>
          </div>
          <div className="table-scroll-280">
            {r.stockRunway.length === 0 ? (
              <p className="muted">No products cataloged.</p>
            ) : (
              <table className="table text-sm">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="r">In Stock</th>
                    <th className="r">Runway</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {r.stockRunway.slice(0, 15).map((s) => (
                    <tr key={s.productId}>
                      <td className="text-ellipsis max-w-160">
                        <b>{s.title}</b>
                      </td>
                      <td className="r num">{s.currentStock}</td>
                      <td className="r num">
                        {s.daysRemaining !== null ? `${s.daysRemaining}d` : "—"}
                      </td>
                      <td>
                        {s.status === "OUT_OF_STOCK" && <span className="pill bad">Out of stock</span>}
                        {s.status === "LOW_STOCK" && <span className="pill warn">Low stock</span>}
                        {s.status === "DEAD_STOCK" && <span className="pill grey">Dead stock</span>}
                        {s.status === "HEALTHY" && <span className="pill green">Healthy</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* Comprehensive Top Sellers Table */}
      <section className="stack gap-sm mb-xl">
        <h2 className="text-base text-bold mb-sm m-0">Product Performance & Margins</h2>
        {r.topProducts.length === 0 ? (
          <div className="card empty">No product sales in this period.</div>
        ) : (
          <div className="card p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Product Title</th>
                  <th>Category</th>
                  <th className="r">Units Sold</th>
                  <th className="r">Current Stock</th>
                  <th className="r">Revenue (BDT)</th>
                  <th className="r">Margin %</th>
                  <th className="r">Return Rate %</th>
                </tr>
              </thead>
              <tbody>
                {r.topProducts.map((p) => (
                  <tr key={p.productId}>
                    <td>
                      <Link href={`/products/${p.productId}`} className="link text-medium">
                        {p.title}
                      </Link>
                    </td>
                    <td>
                      <span className="muted">{p.categoryName}</span>
                    </td>
                    <td className="r num">
                      <b>{p.units}</b>
                    </td>
                    <td className="r num">
                      <span className={p.currentStock <= 5 ? "pill warn" : ""}>
                        {p.currentStock}
                      </span>
                    </td>
                    <td className="r num">{taka(p.sales)}</td>
                    <td className="r num">
                      {p.marginPercent !== null ? (
                        <span className={p.marginPercent >= 30 ? "pill green" : "pill"}>
                          {p.marginPercent}%
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="r num">
                      {p.returnRatePercent > 0 ? (
                        <span className={p.returnRatePercent > 15 ? "pill bad" : "pill"}>
                          {p.returnRatePercent}%
                        </span>
                      ) : (
                        <span className="muted">0%</span>
                      )}
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
