import { withTenant } from "@biztrackbd/db";
import { assertCan, type StaffActor } from "../permissions";
import { createCsvDocument, resolveReportRange, type ResolvedReportRange } from "./reports-shared";

export interface CourierComparisonRow {
  courier: string;
  total: number;
  delivered: number;
  deliveredPercent: number;
  returned: number;
  returnPercent: number;
  inTransit: number;
  averageDays: number | null;
  codCollected: number;
}

export interface DistrictDeliveryRow {
  district: string;
  total: number;
  delivered: number;
  deliveredPercent: number;
  returned: number;
  returnPercent: number;
}

export interface ReturnReasonSummary {
  reason: string;
  count: number;
  percent: number;
}

export interface CourierReport {
  range: ResolvedReportRange;
  totalDispatched: number;
  deliverySuccessRate: number;
  returnRate: number;
  inTransitRate: number;
  averageLeadDays: number | null;
  totalCodCollected: number;
  couriers: CourierComparisonRow[];
  districts: DistrictDeliveryRow[];
  returnReasons: ReturnReasonSummary[];
}

export async function getCourierReport(
  tenantId: string,
  actor: StaffActor,
  rangeInput: { range?: string | null; from?: string | null; to?: string | null }
): Promise<CourierReport> {
  assertCan(actor, "reports", "view");
  const range = resolveReportRange(rangeInput);

  return withTenant(tenantId, async (tx) => {
    // 1. Fetch courier shipment stats
    const rows = await tx.$queryRaw<
      {
        courier: string | null;
        status: string;
        totalAmount: number;
        createdAt: Date;
        deliveredAt: Date | null;
      }[]
    >`
      SELECT 
        COALESCE("courierProvider", 'MANUAL') AS courier,
        status,
        "totalAmount"::float8 AS "totalAmount",
        "createdAt",
        "deliveredAt"
      FROM "Order"
      WHERE "deletedAt" IS NULL
        AND status NOT IN ('CANCELLED')
        AND (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date BETWEEN ${range.from}::date AND ${range.to}::date
    `;

    // 2. Fetch district fulfillment stats
    const districtRows = await tx.$queryRaw<
      {
        district: string | null;
        total: number;
        delivered: number;
        returned: number;
      }[]
    >`
      SELECT 
        COALESCE("shippingDistrict", 'Unspecified') AS district,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'DELIVERED')::int AS delivered,
        COUNT(*) FILTER (WHERE status IN ('RETURNED', 'REFUNDED'))::int AS returned
      FROM "Order"
      WHERE "deletedAt" IS NULL
        AND status NOT IN ('CANCELLED')
        AND (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date BETWEEN ${range.from}::date AND ${range.to}::date
      GROUP BY 1
      ORDER BY total DESC
    `;

    // 3. Return reasons from customer returns or order events
    const returnEvents = await tx.$queryRaw<{ reason: string | null; count: number }[]>`
      SELECT 
        COALESCE(cr.reason, 'Customer changed mind / unreachable') AS reason,
        COUNT(*)::int AS count
      FROM "CustomerReturn" cr
      WHERE cr."createdAt"::date BETWEEN ${range.from}::date AND ${range.to}::date
      GROUP BY 1
      ORDER BY count DESC
    `;

    // Aggregate by courier
    const courierMap = new Map<
      string,
      {
        total: number;
        delivered: number;
        returned: number;
        inTransit: number;
        leadDaysSum: number;
        leadDaysCount: number;
        codCollected: number;
      }
    >();

    let totalDispatched = 0;
    let totalDelivered = 0;
    let totalReturned = 0;
    let totalInTransit = 0;
    let totalCodCollected = 0;
    let allLeadDaysSum = 0;
    let allLeadDaysCount = 0;

    for (const r of rows) {
      const cName = (r.courier || "MANUAL").toUpperCase();
      const cur = courierMap.get(cName) ?? {
        total: 0,
        delivered: 0,
        returned: 0,
        inTransit: 0,
        leadDaysSum: 0,
        leadDaysCount: 0,
        codCollected: 0,
      };

      cur.total++;
      totalDispatched++;

      if (r.status === "DELIVERED") {
        cur.delivered++;
        totalDelivered++;
        cur.codCollected += r.totalAmount;
        totalCodCollected += r.totalAmount;

        if (r.deliveredAt && r.createdAt) {
          const days = Math.max(
            1,
            Math.round(
              (new Date(r.deliveredAt).getTime() - new Date(r.createdAt).getTime()) / 86_400_000
            )
          );
          cur.leadDaysSum += days;
          cur.leadDaysCount++;
          allLeadDaysSum += days;
          allLeadDaysCount++;
        }
      } else if (r.status === "RETURNED" || r.status === "REFUNDED") {
        cur.returned++;
        totalReturned++;
      } else {
        cur.inTransit++;
        totalInTransit++;
      }

      courierMap.set(cName, cur);
    }

    const couriers: CourierComparisonRow[] = Array.from(courierMap.entries())
      .map(([name, data]) => ({
        courier: name,
        total: data.total,
        delivered: data.delivered,
        deliveredPercent: data.total > 0 ? Math.round((data.delivered / data.total) * 100) : 0,
        returned: data.returned,
        returnPercent: data.total > 0 ? Math.round((data.returned / data.total) * 100) : 0,
        inTransit: data.inTransit,
        averageDays:
          data.leadDaysCount > 0 ? Math.round((data.leadDaysSum / data.leadDaysCount) * 10) / 10 : null,
        codCollected: Math.round(data.codCollected),
      }))
      .sort((a, b) => b.total - a.total);

    const districts: DistrictDeliveryRow[] = districtRows.map((d) => ({
      district: d.district ?? "Unspecified",
      total: d.total,
      delivered: d.delivered,
      deliveredPercent: d.total > 0 ? Math.round((d.delivered / d.total) * 100) : 0,
      returned: d.returned,
      returnPercent: d.total > 0 ? Math.round((d.returned / d.total) * 100) : 0,
    }));

    const totalReturnCount = returnEvents.reduce((s, r) => s + r.count, 0);
    const returnReasons: ReturnReasonSummary[] = returnEvents.map((r) => ({
      reason: r.reason ?? "Other",
      count: r.count,
      percent: totalReturnCount > 0 ? Math.round((r.count / totalReturnCount) * 100) : 0,
    }));

    const deliverySuccessRate =
      totalDispatched > 0 ? Math.round((totalDelivered / totalDispatched) * 1000) / 10 : 0;
    const returnRate =
      totalDispatched > 0 ? Math.round((totalReturned / totalDispatched) * 1000) / 10 : 0;
    const inTransitRate =
      totalDispatched > 0 ? Math.round((totalInTransit / totalDispatched) * 1000) / 10 : 0;
    const averageLeadDays =
      allLeadDaysCount > 0 ? Math.round((allLeadDaysSum / allLeadDaysCount) * 10) / 10 : null;

    return {
      range,
      totalDispatched,
      deliverySuccessRate,
      returnRate,
      inTransitRate,
      averageLeadDays,
      totalCodCollected: Math.round(totalCodCollected),
      couriers,
      districts: districts.slice(0, 30),
      returnReasons,
    };
  });
}

export function courierReportCsv(r: CourierReport): string {
  const rows: (string | number | null)[][] = [
    ["Courier & Delivery Performance Report", `${r.range.from} to ${r.range.to}`],
    ["Total Dispatched Orders", r.totalDispatched],
    ["Delivery Success Rate (%)", `${r.deliverySuccessRate}%`],
    ["Return (RTO) Rate (%)", `${r.returnRate}%`],
    ["In-Transit Rate (%)", `${r.inTransitRate}%`],
    ["Average Delivery Lead Time (Days)", r.averageLeadDays ?? "—"],
    ["Total COD Cash Collected (BDT)", r.totalCodCollected],
    [],
    [
      "Courier Name",
      "Total Parcels",
      "Delivered",
      "Delivered (%)",
      "Returned",
      "Returned (%)",
      "In Transit",
      "Avg Days",
      "COD Collected (BDT)",
    ],
    ...r.couriers.map((c) => [
      c.courier,
      c.total,
      c.delivered,
      `${c.deliveredPercent}%`,
      c.returned,
      `${c.returnPercent}%`,
      c.inTransit,
      c.averageDays ?? "—",
      c.codCollected,
    ]),
    [],
    ["District Fulfillment Breakdown", "Total Parcels", "Delivered", "Delivered (%)", "Returned", "Returned (%)"],
    ...r.districts.map((d) => [
      d.district,
      d.total,
      d.delivered,
      `${d.deliveredPercent}%`,
      d.returned,
      `${d.returnPercent}%`,
    ]),
    [],
    ["Return Reasons Breakdown", "Count", "Share (%)"],
    ...r.returnReasons.map((res) => [res.reason, res.count, `${res.percent}%`]),
  ];

  return createCsvDocument(rows);
}
