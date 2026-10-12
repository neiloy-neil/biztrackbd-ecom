import { withTenant } from "@biztrackbd/db";
import { assertCan, type StaffActor } from "../permissions";
import type { OrderRow } from "./orders";

export const STORE_TZ = "Asia/Dhaka";

/** YYYY-MM-DD for a moment, as the calendar date in Bangladesh. */
export function dhakaDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TZ, year: "numeric", month: "2-digit", day: "numeric" }).format(d);
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Orders that count as sales: placed and not cancelled, returned or refunded. */
export const SALES_STATUSES_EXCLUDED = ["CANCELLED", "RETURNED", "REFUNDED"] as const;

export interface DayTotals {
  orders: number;
  sales: number;
}

export interface SetupStep {
  key: "products" | "details" | "payments" | "delivery" | "courier" | "publish";
  done: boolean;
}

export type DashboardRange = 7 | 30 | 90;
export const DASHBOARD_RANGES: DashboardRange[] = [7, 30, 90];

export interface Dashboard {
  today: DayTotals;
  yesterday: DayTotals;
  /** New orders in the last 24 hours versus the 24 hours before. */
  newOrders: { count: number; previous: number };
  toPack: { count: number; waitingOver24h: number };
  awaitingCheck: { count: number; oldestHours: number | null };
  week: { days: { date: string; sales: number; orders: number }[]; total: number; previousTotal: number };
  /** The sales chart: the chosen number of days, each with the matching day of the period before for the comparison line. */
  series: { range: DashboardRange; days: { date: string; sales: number; orders: number; previousSales: number }[]; total: number; previousTotal: number; orders: number; previousOrders: number };
  recent: Pick<OrderRow, "id" | "orderNumber" | "customerName" | "district" | "area" | "paymentMethod" | "paymentStatus" | "status" | "totalAmount">[];
  lowStock: { variantId: string; productTitle: string; variantTitle: string; stock: number }[];
  outOfStock: { count: number; examples: string[] };
  setup: { steps: SetupStep[]; done: number };
}

interface DayRow { d: string; orders: number; sales: number }

export async function getDashboard(tenantId: string, actor: StaffActor, now = new Date(), opts: { range?: number } = {}): Promise<Dashboard> {
  assertCan(actor, "orders", "view");
  const today = dhakaDate(now);
  const range = (DASHBOARD_RANGES.find((r) => r === opts.range) ?? 7) as DashboardRange;
  const from = addDays(today, -(2 * range - 1)); // the chosen days plus the same number before, for the comparison

  return withTenant(tenantId, async (tx) => {
    const byDay = await tx.$queryRaw<DayRow[]>`
      SELECT to_char((("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date, 'YYYY-MM-DD') AS d,
             count(*)::int AS orders, COALESCE(sum("totalAmount"), 0)::float8 AS sales
      FROM "Order"
      WHERE "deletedAt" IS NULL AND status NOT IN ('CANCELLED', 'RETURNED', 'REFUNDED')
        AND (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date >= ${from}::date
      GROUP BY 1`;
    const get = (date: string): DayTotals => {
      const r = byDay.find((x) => x.d === date);
      return { orders: r?.orders ?? 0, sales: Math.round(r?.sales ?? 0) };
    };
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((date) => ({ date, ...get(date) }));
    const previousTotal = Array.from({ length: 7 }, (_, i) => get(addDays(today, i - 13)).sales).reduce((a, b) => a + b, 0);
    const chartDays = Array.from({ length: range }, (_, i) => addDays(today, i - (range - 1))).map((date, i) => {
      const prev = get(addDays(today, i - (2 * range - 1)));
      return { date, ...get(date), previousSales: prev.sales, previousOrders: prev.orders };
    });
    const series = {
      range,
      days: chartDays.map((d) => ({ date: d.date, sales: d.sales, orders: d.orders, previousSales: d.previousSales })),
      total: chartDays.reduce((a, d) => a + d.sales, 0),
      previousTotal: chartDays.reduce((a, d) => a + d.previousSales, 0),
      orders: chartDays.reduce((a, d) => a + d.orders, 0),
      previousOrders: chartDays.reduce((a, d) => a + d.previousOrders, 0),
    };

    const h24 = new Date(now.getTime() - 24 * 3_600_000);
    const h48 = new Date(now.getTime() - 48 * 3_600_000);
    const newCount = await tx.order.count({ where: { deletedAt: null, createdAt: { gt: h24 } } });
    const newPrev = await tx.order.count({ where: { deletedAt: null, createdAt: { gt: h48, lte: h24 } } });

    const toPack = await tx.order.count({ where: { deletedAt: null, status: { in: ["CONFIRMED", "PROCESSING"] } } });
    const toPackLate = await tx.order.count({ where: { deletedAt: null, status: { in: ["CONFIRMED", "PROCESSING"] }, createdAt: { lt: h24 } } });
    const checkWhere = { deletedAt: null, paymentStatus: "PENDING_VERIFICATION" as const, status: { notIn: ["CANCELLED" as const, "REFUNDED" as const] } };
    const checkCount = await tx.order.count({ where: checkWhere });
    const oldest = checkCount > 0 ? await tx.order.findFirst({ where: checkWhere, orderBy: { createdAt: "asc" }, select: { createdAt: true } }) : null;

    const recent = await tx.order.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 5 });

    const low = await tx.$queryRaw<{ id: string; product: string; variant: string; stock: number }[]>`
      SELECT v.id, p.title AS product, v.title AS variant, v."stockQuantity" AS stock
      FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
      WHERE p.status = 'ACTIVE' AND p."deletedAt" IS NULL AND v."stockQuantity" > 0 AND v."stockQuantity" <= v."reorderLevel"
      ORDER BY v."stockQuantity" ASC, p.title LIMIT 5`;
    const out = await tx.$queryRaw<{ product: string; variant: string }[]>`
      SELECT p.title AS product, v.title AS variant
      FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
      WHERE p.status = 'ACTIVE' AND p."deletedAt" IS NULL AND v."stockQuantity" <= 0
      ORDER BY p.title LIMIT 50`;

    const tenant = await tx.tenant.findFirstOrThrow({ select: { status: true, productCount: true } });
    const settings = await tx.storeSettings.findFirst();
    const zones = await tx.shippingZone.count();
    const courier = await tx.tenantIntegration.count({ where: { provider: { in: ["STEADFAST", "PATHAO", "REDX"] } } });
    const steps: SetupStep[] = [
      { key: "products", done: tenant.productCount > 0 },
      { key: "details", done: Boolean(settings?.contactPhone && settings.storeName) },
      { key: "payments", done: Boolean(settings && (settings.codEnabled || settings.bkashNumber || settings.nagadNumber)) },
      { key: "delivery", done: zones > 0 },
      { key: "courier", done: courier > 0 },
      { key: "publish", done: tenant.productCount > 0 && !settings?.ordersPaused && (tenant.status === "ACTIVE" || tenant.status === "TRIAL") },
    ];

    return {
      today: get(today),
      yesterday: get(addDays(today, -1)),
      newOrders: { count: newCount, previous: newPrev },
      toPack: { count: toPack, waitingOver24h: toPackLate },
      awaitingCheck: { count: checkCount, oldestHours: oldest ? Math.max(0, Math.floor((now.getTime() - oldest.createdAt.getTime()) / 3_600_000)) : null },
      week: { days, total: days.reduce((a, d) => a + d.sales, 0), previousTotal },
      series,
      recent: recent.map((o) => ({
        id: o.id, orderNumber: o.orderNumber, customerName: o.customerName, district: o.shippingDistrict, area: o.shippingCity,
        paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus, status: o.status, totalAmount: Number(o.totalAmount),
      })),
      lowStock: low.map((r) => ({ variantId: r.id, productTitle: r.product, variantTitle: r.variant, stock: r.stock })),
      outOfStock: { count: out.length, examples: out.slice(0, 3).map((r) => (r.variant.toLowerCase() === "default" ? r.product : `${r.product}, ${r.variant}`)) },
      setup: { steps, done: steps.filter((s) => s.done).length },
    };
  });
}
