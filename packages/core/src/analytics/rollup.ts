import type { TenantTx } from "@biztrackbd/db";
import type { DailyMetricsSummary } from "./types";

export const STORE_TZ = "Asia/Dhaka";

/**
 * Returns YYYY-MM-DD for a Date in Bangladesh calendar time (Asia/Dhaka).
 */
export function dhakaDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "numeric",
  }).format(d);
}

/**
 * Adds or subtracts days from a YYYY-MM-DD string.
 */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Converts a Dhaka calendar day ("YYYY-MM-DD") into exact UTC start and end bounds.
 * Note: Dhaka is UTC+6 (Asia/Dhaka has no DST).
 * So 2026-10-19 00:00:00 Dhaka = 2026-10-18 18:00:00 UTC.
 */
export function getDhakaDayRange(dateStr: string): { startUtc: Date; endUtc: Date } {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = parseInt(yearStr || "2026", 10);
  const month = parseInt(monthStr || "1", 10) - 1;
  const day = parseInt(dayStr || "1", 10);

  // 00:00:00 Dhaka is 18:00:00 previous day UTC (-6 hours)
  const startUtc = new Date(Date.UTC(year, month, day, 0 - 6, 0, 0, 0));
  const endUtc = new Date(Date.UTC(year, month, day, 24 - 6, 0, 0, -1));

  return { startUtc, endUtc };
}

/**
 * Computes an immutable daily aggregation row for a given tenant on a specific calendar date in Dhaka,
 * and upserts it into DailyStoreMetrics.
 */
export async function aggregateDayForTenant(
  tx: TenantTx,
  tenantId: string,
  dateStr: string
): Promise<DailyMetricsSummary> {
  const { startUtc, endUtc } = getDhakaDayRange(dateStr);

  const orders = await tx.order.findMany({
    where: {
      tenantId,
      deletedAt: null,
      createdAt: {
        gte: startUtc,
        lte: endUtc,
      },
    },
    select: {
      id: true,
      customerId: true,
      customerPhone: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      subtotalAmount: true,
      deliveryCharge: true,
      discountAmount: true,
      totalAmount: true,
      createdAt: true,
    },
  });

  const totalOrders = orders.length;

  let grossSalesBDT = 0;
  let discountsTotalBDT = 0;
  let shippingTotalBDT = 0;
  let refundsTotalBDT = 0;
  let paidOrders = 0;
  let codOrders = 0;
  let cancelledOrders = 0;
  let returnedOrders = 0;

  for (const o of orders) {
    const total = Number(o.totalAmount);
    const discount = Number(o.discountAmount);
    const shipping = Number(o.deliveryCharge);

    discountsTotalBDT += discount;
    shippingTotalBDT += shipping;

    if (o.status === "REFUNDED") {
      refundsTotalBDT += total;
    } else if (o.status === "CANCELLED") {
      cancelledOrders += 1;
    } else if (o.status === "RETURNED") {
      returnedOrders += 1;
    } else {
      grossSalesBDT += total;
    }

    if (o.paymentStatus === "PAID") {
      paidOrders += 1;
    }
    if (o.paymentMethod === "COD") {
      codOrders += 1;
    }
  }

  const netSalesBDT = Math.max(0, grossSalesBDT - discountsTotalBDT);
  const averageOrderValue = totalOrders > 0 ? Math.round((grossSalesBDT / totalOrders) * 100) / 100 : 0;

  // Compute new vs repeat buyers on this day
  const customerPhones = Array.from(new Set(orders.map((o) => o.customerPhone).filter(Boolean)));
  let newCustomersCount = 0;
  let repeatOrdersCount = 0;

  if (customerPhones.length > 0) {
    const priorOrders = await tx.order.findMany({
      where: {
        tenantId,
        customerPhone: { in: customerPhones },
        createdAt: { lt: startUtc },
        deletedAt: null,
      },
      select: { customerPhone: true },
    });

    const priorPhoneSet = new Set(priorOrders.map((p) => p.customerPhone));

    for (const o of orders) {
      if (priorPhoneSet.has(o.customerPhone)) {
        repeatOrdersCount += 1;
      } else {
        newCustomersCount += 1;
      }
    }
  }

  const dbDate = new Date(`${dateStr}T00:00:00.000Z`);

  await tx.dailyStoreMetrics.upsert({
    where: {
      tenantId_date: {
        tenantId,
        date: dbDate,
      },
    },
    create: {
      tenantId,
      date: dbDate,
      grossSalesBDT,
      netSalesBDT,
      discountsTotalBDT,
      shippingTotalBDT,
      refundsTotalBDT,
      totalOrders,
      paidOrders,
      codOrders,
      cancelledOrders,
      returnedOrders,
      averageOrderValue,
      newCustomersCount,
      repeatOrdersCount,
    },
    update: {
      grossSalesBDT,
      netSalesBDT,
      discountsTotalBDT,
      shippingTotalBDT,
      refundsTotalBDT,
      totalOrders,
      paidOrders,
      codOrders,
      cancelledOrders,
      returnedOrders,
      averageOrderValue,
      newCustomersCount,
      repeatOrdersCount,
    },
  });

  return {
    date: dateStr,
    grossSalesBDT,
    netSalesBDT,
    discountsTotalBDT,
    shippingTotalBDT,
    refundsTotalBDT,
    totalOrders,
    paidOrders,
    codOrders,
    cancelledOrders,
    returnedOrders,
    averageOrderValue,
    newCustomersCount,
    repeatOrdersCount,
  };
}

/**
 * On-demand lazy backfiller: Checks historical dates from yesterday back to `days` ago.
 * If any daily rows are missing from DailyStoreMetrics, it calculates and stores them immediately.
 */
export async function ensureDailyMetricsBackfilled(
  tx: TenantTx,
  tenantId: string,
  days: number = 30
): Promise<void> {
  const today = dhakaDate();
  const datesToCheck: string[] = [];

  for (let i = 1; i <= days; i++) {
    datesToCheck.push(addDays(today, -i));
  }

  const dateObjects = datesToCheck.map((d) => new Date(`${d}T00:00:00.000Z`));

  const existingRows = await tx.dailyStoreMetrics.findMany({
    where: {
      tenantId,
      date: { in: dateObjects },
    },
    select: { date: true },
  });

  const existingDateStrings = new Set(
    existingRows.map((r) => r.date.toISOString().slice(0, 10))
  );

  const missingDates = datesToCheck.filter((d) => !existingDateStrings.has(d));

  for (const missingDate of missingDates) {
    await aggregateDayForTenant(tx, tenantId, missingDate);
  }
}

/**
 * Nightly scheduled worker function to aggregate yesterday's completed day.
 */
export async function executeDailyMetricsRollup(
  tx: TenantTx,
  tenantId: string
): Promise<DailyMetricsSummary> {
  const yesterday = addDays(dhakaDate(), -1);
  return aggregateDayForTenant(tx, tenantId, yesterday);
}
