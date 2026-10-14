import type { Metadata } from "next";
import Link from "next/link";
import { getProductReport, resolveReportRange } from "@biztrackbd/core";
import { taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { DateRangeFilter } from "../components/date-range-filter";
import { ReportTabs } from "../components/report-tabs";

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
      <div className="page-head">
        <div>
          <h1 style={{ margin: 0 }}>Products & Stock Velocity</h1>
          <p className="page-sub" style={{ margin: "4px 0 0" }}>
            Identify top revenue drivers, stockout risks, profit margins, and dead stock.
          </p>
        </div>
        <div className="actions">
          <a
            className="btn btn-secondary"
            href={`/reports/products/export?from=${r.range.from}&to=${r.range.to}`}
            download
          >
            Export Products CSV
          </a>
        </div>
      </div>

      <ReportTabs currentTab="products" queryString={queryString} />

      <DateRangeFilter
        basePath="/reports/products"
        currentPreset={resolved.presetKey}
        currentFrom={resolved.from}
        currentTo={resolved.to}
      />

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
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
              <span className="pill green" style={{ fontSize: 11 }}>
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
          <div className="v num" style={{ color: r.lowStockCount > 0 ? "#dc2626" : "inherit" }}>
            {r.lowStockCount} Low / {r.deadStockCount} Dead
          </div>
          <div className="d">
            {r.lowStockCount} items &le; 5 units &bull; {r.deadStockCount} dead in 60d
          </div>
        </div>
      </div>

      {/* Category Breakdown & Stockout Alert Side-by-Side */}
      <div className="grid grid-2" style={{ gap: 16, marginBottom: 24 }}>
        <section className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 16, margin: "0 0 14px" }}>Sales by Product Category</h2>
          {r.categories.length === 0 ? (
            <p className="muted">No category sales recorded.</p>
          ) : (
            r.categories.map((c) => (
              <div key={c.categoryName} style={{ marginBottom: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>
                    {c.categoryName}{" "}
                    <span className="muted" style={{ fontSize: 12 }}>
                      ({c.units} units)
                    </span>
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>
                    {taka(c.sales)}{" "}
                    <span className="muted" style={{ fontSize: 12 }}>
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

        <section className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Stock Runway & Velocity</h2>
            <Link href="/inventory" className="link" style={{ fontSize: 13 }}>
              Manage Stock &rarr;
            </Link>
          </div>
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {r.stockRunway.length === 0 ? (
              <p className="muted">No products cataloged.</p>
            ) : (
              <table className="table" style={{ fontSize: 13 }}>
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
                      <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Product Performance & Margins</h2>
        {r.topProducts.length === 0 ? (
          <div className="card empty">No product sales in this period.</div>
        ) : (
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
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
                      <Link href={`/products/${p.productId}`} className="link" style={{ fontWeight: 600 }}>
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
