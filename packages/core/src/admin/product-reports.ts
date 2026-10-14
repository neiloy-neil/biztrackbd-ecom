import { withTenant } from "@biztrackbd/db";
import { assertCan, type StaffActor } from "../permissions";
import { addDays, dhakaDate } from "./dashboard";
import { createCsvDocument, resolveReportRange, type ResolvedReportRange } from "./reports-shared";

export interface ProductPerformanceItem {
  productId: string;
  title: string;
  categoryName: string;
  units: number;
  sales: number;
  cost: number | null;
  marginPercent: number | null;
  currentStock: number;
  returnUnits: number;
  returnRatePercent: number;
}

export interface CategorySalesSummary {
  categoryName: string;
  units: number;
  sales: number;
  percentOfTotal: number;
}

export interface StockRunwayItem {
  productId: string;
  title: string;
  currentStock: number;
  dailyVelocity: number;
  daysRemaining: number | null; // null if velocity is 0
  status: "OUT_OF_STOCK" | "LOW_STOCK" | "HEALTHY" | "DEAD_STOCK";
}

export interface ProductReport {
  range: ResolvedReportRange;
  totalUnitsSold: number;
  totalSales: number;
  totalCost: number | null;
  grossProfit: number | null;
  averageMarginPercent: number | null;
  inventoryValuation: number;
  lowStockCount: number;
  deadStockCount: number;
  topProducts: ProductPerformanceItem[];
  categories: CategorySalesSummary[];
  stockRunway: StockRunwayItem[];
}

export async function getProductReport(
  tenantId: string,
  actor: StaffActor,
  rangeInput: { range?: string | null; from?: string | null; to?: string | null }
): Promise<ProductReport> {
  assertCan(actor, "reports", "view");
  const range = resolveReportRange(rangeInput);

  return withTenant(tenantId, async (tx) => {
    // 1. Query order items sold in period
    const rows = await tx.$queryRaw<
      {
        id: string;
        title: string;
        categoryName: string | null;
        units: number;
        sales: number;
        costPrice: number | null;
        returnUnits: number;
      }[]
    >`
      SELECT 
        oi."productId" AS id,
        MAX(oi."productTitle") AS title,
        MAX(c.name) AS "categoryName",
        SUM(oi.quantity)::int AS units,
        SUM(oi."totalPrice")::float8 AS sales,
        MAX(p."costPrice")::float8 AS "costPrice",
        SUM(CASE WHEN o.status IN ('RETURNED', 'REFUNDED') THEN oi.quantity ELSE 0 END)::int AS "returnUnits"
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      LEFT JOIN "Product" p ON p.id = oi."productId"
      LEFT JOIN "Category" c ON c.id = p."categoryId"
      WHERE o."deletedAt" IS NULL 
        AND o.status NOT IN ('CANCELLED')
        AND ((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date BETWEEN ${range.from}::date AND ${range.to}::date
      GROUP BY oi."productId"
      ORDER BY sales DESC
    `;

    // 2. Query all products currently in store for valuation & stock runway
    const allProducts = await tx.product.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        title: true,
        basePrice: true,
        costPrice: true,
        status: true,
        variants: {
          select: {
            stockQuantity: true,
          },
        },
      },
    });

    // 3. Query 30-day velocity for runway calculation
    const thirtyDaysAgo = addDays(dhakaDate(new Date()), -30);
    const velocityRows = await tx.$queryRaw<{ productId: string; units30d: number }[]>`
      SELECT oi."productId", SUM(oi.quantity)::int AS "units30d"
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."deletedAt" IS NULL
        AND o.status NOT IN ('CANCELLED', 'RETURNED', 'REFUNDED')
        AND ((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date >= ${thirtyDaysAgo}::date
      GROUP BY oi."productId"
    `;
    const velocityMap = new Map(velocityRows.map((v) => [v.productId, v.units30d / 30]));

    // 4. Dead stock: 60-day window
    const sixtyDaysAgo = addDays(dhakaDate(new Date()), -60);
    const sold60dRows = await tx.$queryRaw<{ productId: string }[]>`
      SELECT DISTINCT oi."productId"
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."deletedAt" IS NULL
        AND o.status NOT IN ('CANCELLED')
        AND ((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date >= ${sixtyDaysAgo}::date
    `;
    const soldIn60d = new Set(sold60dRows.map((s) => s.productId));

    let inventoryValuation = 0;
    let lowStockCount = 0;
    let deadStockCount = 0;
    const stockByProductId = new Map<string, number>();

    const stockRunway: StockRunwayItem[] = allProducts.map((p) => {
      const stock = p.variants.reduce((n: number, v: { stockQuantity: number }) => n + Math.max(v.stockQuantity ?? 0, 0), 0);
      stockByProductId.set(p.id, stock);

      const cost = p.costPrice
        ? Number(p.costPrice)
        : Number(p.basePrice) * 0.7; // fallback 70% if no cost set

      inventoryValuation += stock * cost;

      const dailyVelocity = velocityMap.get(p.id) ?? 0;
      const daysRemaining = dailyVelocity > 0 ? Math.round(stock / dailyVelocity) : null;

      let status: StockRunwayItem["status"] = "HEALTHY";
      if (stock === 0) {
        status = "OUT_OF_STOCK";
        lowStockCount++;
      } else if (stock <= 5 || (daysRemaining !== null && daysRemaining <= 7)) {
        status = "LOW_STOCK";
        lowStockCount++;
      } else if (!soldIn60d.has(p.id) && p.status === "ACTIVE") {
        status = "DEAD_STOCK";
        deadStockCount++;
      }

      return {
        productId: p.id,
        title: p.title,
        currentStock: stock,
        dailyVelocity: Math.round(dailyVelocity * 10) / 10,
        daysRemaining,
        status,
      };
    });

    // 5. Aggregate top products metrics
    let totalUnitsSold = 0;
    let totalSales = 0;
    let totalCost = 0;
    let hasCostForAll = true;

    const topProducts: ProductPerformanceItem[] = rows.map((r) => {
      totalUnitsSold += r.units;
      totalSales += r.sales;
      const cost = r.costPrice ? r.costPrice * r.units : null;
      if (cost !== null) totalCost += cost;
      else hasCostForAll = false;

      const marginPercent =
        r.costPrice && r.sales > 0
          ? Math.round(((r.sales - r.costPrice * r.units) / r.sales) * 100)
          : null;

      const returnRatePercent =
        r.units > 0 ? Math.round((r.returnUnits / r.units) * 1000) / 10 : 0;

      const currentStock = stockByProductId.get(r.id) ?? 0;

      return {
        productId: r.id,
        title: r.title,
        categoryName: r.categoryName ?? "Uncategorized",
        units: r.units,
        sales: Math.round(r.sales),
        cost: cost !== null ? Math.round(cost) : null,
        marginPercent,
        currentStock,
        returnUnits: r.returnUnits,
        returnRatePercent,
      };
    });

    const grossProfit = hasCostForAll ? Math.round(totalSales - totalCost) : null;
    const averageMarginPercent =
      grossProfit !== null && totalSales > 0
        ? Math.round((grossProfit / totalSales) * 100)
        : null;

    // 6. Aggregate Categories
    const catMap = new Map<string, { units: number; sales: number }>();
    for (const p of topProducts) {
      const prev = catMap.get(p.categoryName) ?? { units: 0, sales: 0 };
      catMap.set(p.categoryName, {
        units: prev.units + p.units,
        sales: prev.sales + p.sales,
      });
    }

    const categories: CategorySalesSummary[] = Array.from(catMap.entries())
      .map(([name, val]) => ({
        categoryName: name,
        units: val.units,
        sales: val.sales,
        percentOfTotal: totalSales > 0 ? Math.round((val.sales / totalSales) * 100) : 0,
      }))
      .sort((a, b) => b.sales - a.sales);

    return {
      range,
      totalUnitsSold,
      totalSales: Math.round(totalSales),
      totalCost: hasCostForAll ? Math.round(totalCost) : null,
      grossProfit,
      averageMarginPercent,
      inventoryValuation: Math.round(inventoryValuation),
      lowStockCount,
      deadStockCount,
      topProducts,
      categories,
      stockRunway: stockRunway
        .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999))
        .slice(0, 50),
    };
  });
}

export function productReportCsv(r: ProductReport): string {
  const rows: (string | number | null)[][] = [
    ["Product & Stock Velocity Report", `${r.range.from} to ${r.range.to}`],
    ["Total Units Sold", r.totalUnitsSold],
    ["Total Product Sales (BDT)", r.totalSales],
    ["Inventory Valuation (BDT)", r.inventoryValuation],
    ["Low Stock Items", r.lowStockCount],
    ["Dead Stock Items (0 sales in 60d)", r.deadStockCount],
    [],
    [
      "Product Name",
      "Category",
      "Units Sold",
      "Total Sales (BDT)",
      "Current Stock",
      "Margin (%)",
      "Returned Units",
      "Return Rate (%)",
    ],
    ...r.topProducts.map((p) => [
      p.title,
      p.categoryName,
      p.units,
      p.sales,
      p.currentStock,
      p.marginPercent ?? "",
      p.returnUnits,
      `${p.returnRatePercent}%`,
    ]),
    [],
    ["Category Breakdown", "Units Sold", "Sales (BDT)", "Share of Sales (%)"],
    ...r.categories.map((c) => [c.categoryName, c.units, c.sales, `${c.percentOfTotal}%`]),
    [],
    ["Stock Runway & Velocity", "Current Stock", "Daily Sales Rate", "Runway (Days)", "Status"],
    ...r.stockRunway.map((s) => [
      s.title,
      s.currentStock,
      s.dailyVelocity,
      s.daysRemaining ?? "No velocity",
      s.status,
    ]),
  ];

  return createCsvDocument(rows);
}
