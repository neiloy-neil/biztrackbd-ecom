import { withTenant } from "@biztrackbd/db";
import { assertCan, type StaffActor } from "../permissions";
import { addDays, dhakaDate } from "./dashboard";
import {
  createCsvDocument,
  resolveReportRange,
  type ResolvedReportRange,
} from "./reports-shared";

export * from "./reports-shared";

export interface PeriodTotals {
  sales: number;
  orders: number;
  averageOrder: number;
  /** Returned or refunded orders as a share of orders placed in the period. */
  returnRate: number;
}

export interface SalesReport {
  from: string;
  to: string;
  days: number;
  resolvedRange?: ResolvedReportRange;
  current: PeriodTotals;
  previous: PeriodTotals;
  series: { date: string; sales: number; previousSales: number }[];
  byDistrict: { district: string; sales: number }[];
  topProducts: {
    productId: string;
    title: string;
    units: number;
    sales: number;
    marginPercent: number | null;
  }[];
  byPayment: { method: string; orders: number; sales: number }[];
}

/** Percent change, or null when there is nothing to compare against. */
export const changePercent = (now: number, before: number): number | null =>
  before > 0 ? Math.round(((now - before) / before) * 100) : null;

interface TotalsRow {
  orders: number;
  sales: number;
  returns: number;
}

async function totalsFor(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  from: string,
  to: string
): Promise<PeriodTotals> {
  const [r] = await tx.$queryRaw<TotalsRow[]>`
    SELECT count(*) FILTER (WHERE status NOT IN ('CANCELLED', 'RETURNED', 'REFUNDED'))::int AS orders,
           COALESCE(sum("totalAmount") FILTER (WHERE status NOT IN ('CANCELLED', 'RETURNED', 'REFUNDED')), 0)::float8 AS sales,
           count(*) FILTER (WHERE status IN ('RETURNED', 'REFUNDED'))::int AS returns,
           count(*) FILTER (WHERE status <> 'CANCELLED')::int AS placed
    FROM "Order" WHERE "deletedAt" IS NULL
      AND (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date BETWEEN ${from}::date AND ${to}::date`;
  const placed = await tx.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM "Order" WHERE "deletedAt" IS NULL AND status <> 'CANCELLED'
      AND (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date BETWEEN ${from}::date AND ${to}::date`;
  const row = r ?? { orders: 0, sales: 0, returns: 0 };
  return {
    sales: Math.round(row.sales),
    orders: row.orders,
    averageOrder: row.orders > 0 ? Math.round(row.sales / row.orders) : 0,
    returnRate:
      (placed[0]?.n ?? 0) > 0
        ? Math.round((row.returns / placed[0]!.n) * 1000) / 10
        : 0,
  };
}

/** Sales for a date range in Bangladesh time (both ends included), compared with the same number of days before it. */
export async function getSalesReport(
  tenantId: string,
  actor: StaffActor,
  rangeInput: { range?: string | null; from?: string | null; to?: string | null } | { from: string; to: string }
): Promise<SalesReport> {
  assertCan(actor, "reports", "view");
  const resolved = resolveReportRange(rangeInput);
  const { from, to, days, prevFrom, prevTo } = resolved;

  return withTenant(tenantId, async (tx) => {
    const current = await totalsFor(tx, from, to);
    const previous = await totalsFor(tx, prevFrom, prevTo);

    const cur = await tx.$queryRaw<{ d: string; sales: number }[]>`
      SELECT to_char((("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date, 'YYYY-MM-DD') AS d, COALESCE(sum("totalAmount"), 0)::float8 AS sales
      FROM "Order" WHERE "deletedAt" IS NULL AND status NOT IN ('CANCELLED', 'RETURNED', 'REFUNDED')
        AND (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date BETWEEN ${prevFrom}::date AND ${to}::date GROUP BY 1`;
    const sale = (d: string) => Math.round(cur.find((r) => r.d === d)?.sales ?? 0);
    const series = Array.from({ length: days }, (_, i) => {
      const date = addDays(from, i);
      return { date, sales: sale(date), previousSales: sale(addDays(prevFrom, i)) };
    });

    const districts = await tx.$queryRaw<{ district: string; sales: number }[]>`
      SELECT "shippingDistrict" AS district, sum("totalAmount")::float8 AS sales FROM "Order"
      WHERE "deletedAt" IS NULL AND status NOT IN ('CANCELLED', 'RETURNED', 'REFUNDED')
        AND (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1 ORDER BY 2 DESC`;
    const top5 = districts.slice(0, 5).map((d) => ({ district: d.district, sales: Math.round(d.sales) }));
    const rest = Math.round(districts.slice(5).reduce((s, d) => s + d.sales, 0));
    const byDistrict = rest > 0 ? [...top5, { district: "Other districts", sales: rest }] : top5;

    const products = await tx.$queryRaw<{ id: string; title: string; units: number; sales: number; cost: number | null }[]>`
      SELECT oi."productId" AS id, max(oi."productTitle") AS title, sum(oi.quantity)::int AS units, sum(oi."totalPrice")::float8 AS sales,
             CASE WHEN bool_and(p."costPrice" IS NOT NULL) THEN sum(oi.quantity * p."costPrice")::float8 ELSE NULL END AS cost
      FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId" JOIN "Product" p ON p.id = oi."productId"
      WHERE o."deletedAt" IS NULL AND o.status NOT IN ('CANCELLED', 'RETURNED', 'REFUNDED')
        AND ((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date BETWEEN ${from}::date AND ${to}::date
      GROUP BY oi."productId" ORDER BY 4 DESC LIMIT 10`;

    const pay = await tx.$queryRaw<{ method: string; orders: number; sales: number }[]>`
      SELECT "paymentMethod"::text AS method, count(*)::int AS orders, sum("totalAmount")::float8 AS sales FROM "Order"
      WHERE "deletedAt" IS NULL AND status NOT IN ('CANCELLED', 'RETURNED', 'REFUNDED')
        AND (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1 ORDER BY 3 DESC`;

    return {
      from,
      to,
      days,
      resolvedRange: resolved,
      current,
      previous,
      series,
      byDistrict,
      topProducts: products.map((p) => ({
        productId: p.id,
        title: p.title,
        units: p.units,
        sales: Math.round(p.sales),
        marginPercent:
          p.cost != null && p.sales > 0
            ? Math.round(((p.sales - p.cost) / p.sales) * 100)
            : null,
      })),
      byPayment: pay.map((p) => ({
        method: p.method,
        orders: p.orders,
        sales: Math.round(p.sales),
      })),
    };
  });
}

/** Today and the number of days back, as a range ending today in Bangladesh time. */
export function lastDays(n: number, now = new Date()): { from: string; to: string } {
  const to = dhakaDate(now);
  return { from: addDays(to, -(n - 1)), to };
}

export function salesReportCsv(r: SalesReport): string {
  const lines: (string | number | null)[][] = [
    ["Sales & Revenue Report", `${r.from} to ${r.to}`],
    ["Total sales (BDT)", r.current.sales],
    ["Orders", r.current.orders],
    ["Average order (BDT)", r.current.averageOrder],
    ["Return rate (%)", `${r.current.returnRate}%`],
    [],
    ["Date", "Sales (BDT)", "Previous period (BDT)"],
    ...r.series.map((s) => [s.date, s.sales, s.previousSales]),
    [],
    ["Product", "Units", "Sales (BDT)", "Margin (%)"],
    ...r.topProducts.map((p) => [p.title, p.units, p.sales, p.marginPercent ?? ""]),
    [],
    ["District", "Sales (BDT)"],
    ...r.byDistrict.map((d) => [d.district, d.sales]),
    [],
    ["Payment Method", "Orders", "Sales (BDT)"],
    ...r.byPayment.map((p) => [p.method, p.orders, p.sales]),
  ];
  return createCsvDocument(lines);
}
