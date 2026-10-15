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

export interface FunnelStage {
  count: number;
  amount: number;
}

export interface FulfillmentFunnel {
  unverified: FunnelStage;
  toPack: FunnelStage;
  inTransit: FunnelStage;
  delivered: FunnelStage;
  returns: FunnelStage;
}

export interface CodCashflowLedger {
  inTransitAmount: number;
  inTransitOrders: number;
  awaitingPayoutAmount: number;
  awaitingPayoutOrders: number;
  settledAmount: number;
  settledOrders: number;
  directMfsAmount: number;
  directMfsOrders: number;
}

export interface CourierShareItem {
  courier: string;
  count: number;
  percentage: number;
}

export interface CourierHealth {
  successRate: number;
  returnRate: number;
  isReturnRateElevated: boolean;
  totalShipped: number;
  courierBreakdown: CourierShareItem[];
}

export interface DashboardTelemetry {
  aovToday: number;
  aovYesterday: number;
  cashAtRisk: number;
  highRiskOrdersCount: number;
  conversionRate: number;
}

export interface DashboardActivityEvent {
  id: string;
  orderId?: string;
  orderNumber?: string;
  type: string;
  message: string;
  createdAt: string | Date;
  actorName: string;
}

export interface DashboardFraudRadarItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  fraudRiskLevel: "LOW" | "MEDIUM" | "HIGH";
  fraudTrustScore: number;
  fraudReview: string | null;
  createdAt: string | Date;
  district?: string | null;
}

export interface DashboardDispatchQueueItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  paymentMethod: string;
  shippingDistrict: string | null;
  shippingCity: string | null;
  shippingAddress: string;
  itemsSummary: string;
  createdAt: string | Date;
}

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
  funnel: FulfillmentFunnel;
  codLedger: CodCashflowLedger;
  courierHealth: CourierHealth;
  telemetry: DashboardTelemetry;
  activityFeed: DashboardActivityEvent[];
  fraudRadar: DashboardFraudRadarItem[];
  dispatchQueue: DashboardDispatchQueueItem[];
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

    // Compute Funnel, COD Ledger, and Courier Health metrics across active orders
    const allOrders = await tx.order.findMany({
      where: { deletedAt: null },
      select: {
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        settlementStatus: true,
        totalAmount: true,
        courierProvider: true,
      },
    });

    let unverifiedCount = 0, unverifiedAmt = 0;
    let toPackFunnelCount = 0, toPackFunnelAmt = 0;
    let inTransitCount = 0, inTransitAmt = 0;
    let deliveredCount = 0, deliveredAmt = 0;
    let returnsCount = 0, returnsAmt = 0;

    let codInTransitAmt = 0, codInTransitOrders = 0;
    let codAwaitingAmt = 0, codAwaitingOrders = 0;
    let codSettledAmt = 0, codSettledOrders = 0;
    let directMfsAmt = 0, directMfsOrders = 0;

    const courierCounts: Record<string, number> = {};

    for (const ord of allOrders) {
      const amt = Number(ord.totalAmount) || 0;

      // Fulfillment Funnel
      if (ord.paymentStatus === "PENDING_VERIFICATION" && ord.status !== "CANCELLED" && ord.status !== "REFUNDED") {
        unverifiedCount++;
        unverifiedAmt += amt;
      }
      if (ord.status === "CONFIRMED" || ord.status === "PROCESSING") {
        toPackFunnelCount++;
        toPackFunnelAmt += amt;
      }
      if (ord.status === "SHIPPED") {
        inTransitCount++;
        inTransitAmt += amt;
      }
      if (ord.status === "DELIVERED") {
        deliveredCount++;
        deliveredAmt += amt;
      }
      if (ord.status === "RETURNED" || ord.status === "CANCELLED") {
        returnsCount++;
        returnsAmt += amt;
      }

      // 3-Way COD Cashflow Ledger
      const isCod = ord.paymentMethod === "COD";
      const isMfs = ord.paymentMethod === "MANUAL_BKASH" || ord.paymentMethod === "MANUAL_NAGAD" || ord.paymentMethod === "MANUAL_ROCKET" || ord.paymentMethod === "GATEWAY_SSLCOMMERZ" || ord.paymentMethod === "GATEWAY_UDDOKTAPAY";

      if (isCod) {
        if (ord.status === "SHIPPED" && ord.paymentStatus !== "PAID") {
          codInTransitOrders++;
          codInTransitAmt += amt;
        } else if (ord.status === "DELIVERED" && ord.settlementStatus !== "SETTLED") {
          codAwaitingOrders++;
          codAwaitingAmt += amt;
        } else if (ord.settlementStatus === "SETTLED" || (ord.status === "DELIVERED" && ord.paymentStatus === "PAID")) {
          codSettledOrders++;
          codSettledAmt += amt;
        }
      } else if (isMfs && ord.paymentStatus === "PAID") {
        directMfsOrders++;
        directMfsAmt += amt;
      }

      // Courier distribution
      if (ord.courierProvider) {
        courierCounts[ord.courierProvider] = (courierCounts[ord.courierProvider] ?? 0) + 1;
      }
    }

    const funnel: FulfillmentFunnel = {
      unverified: { count: unverifiedCount, amount: Math.round(unverifiedAmt) },
      toPack: { count: toPackFunnelCount, amount: Math.round(toPackFunnelAmt) },
      inTransit: { count: inTransitCount, amount: Math.round(inTransitAmt) },
      delivered: { count: deliveredCount, amount: Math.round(deliveredAmt) },
      returns: { count: returnsCount, amount: Math.round(returnsAmt) },
    };

    const codLedger: CodCashflowLedger = {
      inTransitAmount: Math.round(codInTransitAmt),
      inTransitOrders: codInTransitOrders,
      awaitingPayoutAmount: Math.round(codAwaitingAmt),
      awaitingPayoutOrders: codAwaitingOrders,
      settledAmount: Math.round(codSettledAmt),
      settledOrders: codSettledOrders,
      directMfsAmount: Math.round(directMfsAmt),
      directMfsOrders: directMfsOrders,
    };

    const totalResolved = deliveredCount + returnsCount;
    const successRate = totalResolved > 0 ? Math.round((deliveredCount / totalResolved) * 1000) / 10 : 100;
    const returnRate = totalResolved > 0 ? Math.round((returnsCount / totalResolved) * 1000) / 10 : 0;
    const isReturnRateElevated = returnRate > 12.0;

    const totalCouriers = Object.values(courierCounts).reduce((a, b) => a + b, 0);
    const courierBreakdown: CourierShareItem[] = Object.entries(courierCounts).map(([courier, count]) => ({
      courier,
      count,
      percentage: totalCouriers > 0 ? Math.round((count / totalCouriers) * 100) : 0,
    })).sort((a, b) => b.count - a.count);

    const courierHealth: CourierHealth = {
      successRate,
      returnRate,
      isReturnRateElevated,
      totalShipped: inTransitCount + deliveredCount + returnsCount,
      courierBreakdown,
    };

    const [fraudRadarOrders, dispatchQueueOrders, recentOrderEvents] = await Promise.all([
      tx.order.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: { notIn: ["CANCELLED", "RETURNED", "REFUNDED", "DELIVERED"] },
          OR: [
            { fraudRiskLevel: { in: ["HIGH", "MEDIUM"] } },
            { fraudReview: "HELD" },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          customerPhone: true,
          totalAmount: true,
          fraudRiskLevel: true,
          fraudTrustScore: true,
          fraudReview: true,
          createdAt: true,
          shippingDistrict: true,
        },
      }),
      tx.order.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: ["CONFIRMED", "PROCESSING"] },
          trackingCode: null,
          courierProvider: null,
          OR: [
            { paymentMethod: "COD" },
            { paymentStatus: "PAID" },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: 15,
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          customerPhone: true,
          totalAmount: true,
          paymentMethod: true,
          shippingDistrict: true,
          shippingCity: true,
          shippingAddress: true,
          createdAt: true,
          items: {
            take: 3,
            select: {
              quantity: true,
              productTitle: true,
              variantTitle: true,
            },
          },
        },
      }),
      tx.orderEvent.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          order: {
            select: { orderNumber: true },
          },
        },
      }),
    ]);

    const todayDay = get(today);
    const yesterdayDay = get(addDays(today, -1));
    const aovToday = todayDay.orders > 0 ? Math.round(todayDay.sales / todayDay.orders) : 0;
    const aovYesterday = yesterdayDay.orders > 0 ? Math.round(yesterdayDay.sales / yesterdayDay.orders) : 0;
    const cashAtRisk = fraudRadarOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const highRiskOrdersCount = fraudRadarOrders.filter((o) => o.fraudRiskLevel === "HIGH" || o.fraudReview === "HELD").length;

    const telemetry: DashboardTelemetry = {
      aovToday,
      aovYesterday,
      cashAtRisk: Math.round(cashAtRisk),
      highRiskOrdersCount,
      conversionRate: 3.4,
    };

    const activityFeed: DashboardActivityEvent[] = recentOrderEvents.map((ev) => ({
      id: ev.id,
      orderId: ev.orderId,
      orderNumber: ev.order?.orderNumber || "ORD",
      type: ev.type,
      message: ev.message,
      createdAt: ev.createdAt,
      actorName: ev.actorName || "System",
    }));

    const fraudRadar: DashboardFraudRadarItem[] = fraudRadarOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      totalAmount: Number(o.totalAmount),
      fraudRiskLevel: o.fraudRiskLevel,
      fraudTrustScore: o.fraudTrustScore,
      fraudReview: o.fraudReview,
      createdAt: o.createdAt,
      district: o.shippingDistrict,
    }));

    const dispatchQueue: DashboardDispatchQueueItem[] = dispatchQueueOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      totalAmount: Number(o.totalAmount),
      paymentMethod: o.paymentMethod,
      shippingDistrict: o.shippingDistrict,
      shippingCity: o.shippingCity,
      shippingAddress: o.shippingAddress,
      itemsSummary: o.items.map((i) => `${i.quantity}x ${i.productTitle}${i.variantTitle && i.variantTitle.toLowerCase() !== "default" ? ` (${i.variantTitle})` : ""}`).join(", "),
      createdAt: o.createdAt,
    }));

    return {
      today: todayDay,
      yesterday: yesterdayDay,
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
      funnel,
      codLedger,
      courierHealth,
      telemetry,
      activityFeed,
      fraudRadar,
      dispatchQueue,
    };
  });
}
