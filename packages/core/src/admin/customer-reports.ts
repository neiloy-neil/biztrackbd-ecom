import { withTenant } from "@biztrackbd/db";
import { assertCan, type StaffActor } from "../permissions";
import { addDays, dhakaDate } from "./dashboard";
import { createCsvDocument, resolveReportRange, type ResolvedReportRange } from "./reports-shared";

export interface BuyerSegmentSummary {
  label: string;
  customersCount: number;
  ordersCount: number;
  revenue: number;
  averageOrderValue: number;
  percentOfTotalRevenue: number;
}

export interface VipCustomerRow {
  customerId: string;
  name: string;
  phone: string;
  district: string;
  ordersCount: number;
  totalSpend: number;
  lastOrderDate: string;
}

export interface RfmCohortSummary {
  segment: "CHAMPIONS" | "LOYAL" | "AT_RISK" | "ONE_TIME";
  label: string;
  description: string;
  count: number;
  totalRevenue: number;
  percentOfBase: number;
}

export interface CustomerReport {
  range: ResolvedReportRange;
  totalCustomers: number;
  repeatPurchaseRate: number;
  averageLtv: number;
  averageOrdersPerCustomer: number;
  repeatRevenueShare: number;
  segments: {
    firstTime: BuyerSegmentSummary;
    returning: BuyerSegmentSummary;
  };
  topVipCustomers: VipCustomerRow[];
  rfmCohorts: RfmCohortSummary[];
}

export async function getCustomerReport(
  tenantId: string,
  actor: StaffActor,
  rangeInput: { range?: string | null; from?: string | null; to?: string | null }
): Promise<CustomerReport> {
  assertCan(actor, "reports", "view");
  const range = resolveReportRange(rangeInput);

  return withTenant(tenantId, async (tx) => {
    // 1. Fetch all orders in this period with customer information
    const periodOrders = await tx.$queryRaw<
      {
        orderId: string;
        customerId: string | null;
        customerName: string | null;
        customerPhone: string | null;
        totalAmount: number;
        createdAt: Date;
      }[]
    >`
      SELECT 
        id AS "orderId",
        "customerId",
        "customerName",
        "customerPhone",
        "totalAmount"::float8 AS "totalAmount",
        "createdAt"
      FROM "Order"
      WHERE "deletedAt" IS NULL
        AND status NOT IN ('CANCELLED')
        AND (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date BETWEEN ${range.from}::date AND ${range.to}::date
    `;

    // 2. Query all customers for lifetime analysis and repeat metrics
    const allCustomers = await tx.customer.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        totalOrders: true,
        totalSpent: true,
        createdAt: true,
        addresses: {
          select: { district: true },
          take: 1,
        },
        orders: {
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const sixtyDaysAgo = addDays(dhakaDate(new Date()), -60);
    const thirtyDaysAgo = addDays(dhakaDate(new Date()), -30);

    let championsCount = 0;
    let championsRevenue = 0;
    let loyalCount = 0;
    let loyalRevenue = 0;
    let atRiskCount = 0;
    let atRiskRevenue = 0;
    let oneTimeCount = 0;
    let oneTimeRevenue = 0;

    let repeatCustomersCount = 0;
    let totalLifetimeRevenue = 0;

    for (const c of allCustomers) {
      const spent = Number(c.totalSpent ?? 0);
      const orders = c.totalOrders ?? 0;
      totalLifetimeRevenue += spent;
      if (orders >= 2) repeatCustomersCount++;

      const lastOrderDate = c.orders[0]?.createdAt
        ? dhakaDate(new Date(c.orders[0].createdAt))
        : null;

      if (orders >= 3 && spent >= 5000 && lastOrderDate && lastOrderDate >= thirtyDaysAgo) {
        championsCount++;
        championsRevenue += spent;
      } else if (orders >= 2 && lastOrderDate && lastOrderDate >= sixtyDaysAgo) {
        loyalCount++;
        loyalRevenue += spent;
      } else if (orders >= 2 && (!lastOrderDate || lastOrderDate < sixtyDaysAgo)) {
        atRiskCount++;
        atRiskRevenue += spent;
      } else {
        oneTimeCount++;
        oneTimeRevenue += spent;
      }
    }

    const totalCustCount = allCustomers.length;
    const repeatPurchaseRate =
      totalCustCount > 0 ? Math.round((repeatCustomersCount / totalCustCount) * 1000) / 10 : 0;
    const averageLtv =
      totalCustCount > 0 ? Math.round(totalLifetimeRevenue / totalCustCount) : 0;
    const totalAllOrdersCount = allCustomers.reduce((s, c) => s + (c.totalOrders ?? 0), 0);
    const averageOrdersPerCustomer =
      totalCustCount > 0 ? Math.round((totalAllOrdersCount / totalCustCount) * 10) / 10 : 0;

    // 3. Classify Period Orders into First-Time vs Returning
    // Look at customer totalOrders or if customer was created in this period
    let firstTimeCount = 0;
    let firstTimeOrders = 0;
    let firstTimeRevenue = 0;

    let returningCount = 0;
    let returningOrders = 0;
    let returningRevenue = 0;

    const seenFirstTime = new Set<string>();
    const seenReturning = new Set<string>();

    const customerMap = new Map(allCustomers.map((c) => [c.id, c]));

    for (const o of periodOrders) {
      const cust = o.customerId ? customerMap.get(o.customerId) : null;
      const isRepeat = cust ? (cust.totalOrders ?? 0) > 1 : false;
      const phoneOrId = o.customerId || o.customerPhone || o.orderId;

      if (isRepeat) {
        returningOrders++;
        returningRevenue += o.totalAmount;
        if (!seenReturning.has(phoneOrId)) {
          seenReturning.add(phoneOrId);
          returningCount++;
        }
      } else {
        firstTimeOrders++;
        firstTimeRevenue += o.totalAmount;
        if (!seenFirstTime.has(phoneOrId)) {
          seenFirstTime.add(phoneOrId);
          firstTimeCount++;
        }
      }
    }

    const periodTotalRev = firstTimeRevenue + returningRevenue;
    const repeatRevenueShare =
      periodTotalRev > 0 ? Math.round((returningRevenue / periodTotalRev) * 100) : 0;

    const firstTimeSegment: BuyerSegmentSummary = {
      label: "First-Time Customers",
      customersCount: firstTimeCount,
      ordersCount: firstTimeOrders,
      revenue: Math.round(firstTimeRevenue),
      averageOrderValue:
        firstTimeOrders > 0 ? Math.round(firstTimeRevenue / firstTimeOrders) : 0,
      percentOfTotalRevenue:
        periodTotalRev > 0 ? Math.round((firstTimeRevenue / periodTotalRev) * 100) : 0,
    };

    const returningSegment: BuyerSegmentSummary = {
      label: "Repeat Returning Buyers",
      customersCount: returningCount,
      ordersCount: returningOrders,
      revenue: Math.round(returningRevenue),
      averageOrderValue:
        returningOrders > 0 ? Math.round(returningRevenue / returningOrders) : 0,
      percentOfTotalRevenue:
        periodTotalRev > 0 ? Math.round((returningRevenue / periodTotalRev) * 100) : 0,
    };

    // 4. Top 20 VIP Spenders Leaderboard
    const sortedVips = [...allCustomers]
      .sort((a, b) => Number(b.totalSpent ?? 0) - Number(a.totalSpent ?? 0))
      .slice(0, 20);

    const topVipCustomers: VipCustomerRow[] = sortedVips.map((c) => ({
      customerId: c.id,
      name: c.name || "Customer",
      phone: c.phone,
      district: c.addresses[0]?.district ?? "Dhaka",
      ordersCount: c.totalOrders ?? 0,
      totalSpend: Math.round(Number(c.totalSpent ?? 0)),
      lastOrderDate: c.orders[0]?.createdAt
        ? dhakaDate(new Date(c.orders[0].createdAt))
        : "—",
    }));

    // 5. RFM Cohorts
    const rfmCohorts: RfmCohortSummary[] = [
      {
        segment: "CHAMPIONS",
        label: "Champions / High VIPs",
        description: "Spent ৳5,000+, 3+ orders, active in last 30 days",
        count: championsCount,
        totalRevenue: Math.round(championsRevenue),
        percentOfBase:
          totalCustCount > 0 ? Math.round((championsCount / totalCustCount) * 100) : 0,
      },
      {
        segment: "LOYAL",
        label: "Loyal Regulars",
        description: "2+ orders, bought in past 60 days",
        count: loyalCount,
        totalRevenue: Math.round(loyalRevenue),
        percentOfBase:
          totalCustCount > 0 ? Math.round((loyalCount / totalCustCount) * 100) : 0,
      },
      {
        segment: "AT_RISK",
        label: "At-Risk / Slipping",
        description: "Past repeat buyers with no orders in 60+ days",
        count: atRiskCount,
        totalRevenue: Math.round(atRiskRevenue),
        percentOfBase:
          totalCustCount > 0 ? Math.round((atRiskCount / totalCustCount) * 100) : 0,
      },
      {
        segment: "ONE_TIME",
        label: "One-Time Shoppers",
        description: "Placed exactly 1 order, yet to repurchase",
        count: oneTimeCount,
        totalRevenue: Math.round(oneTimeRevenue),
        percentOfBase:
          totalCustCount > 0 ? Math.round((oneTimeCount / totalCustCount) * 100) : 0,
      },
    ];

    return {
      range,
      totalCustomers: totalCustCount,
      repeatPurchaseRate,
      averageLtv,
      averageOrdersPerCustomer,
      repeatRevenueShare,
      segments: {
        firstTime: firstTimeSegment,
        returning: returningSegment,
      },
      topVipCustomers,
      rfmCohorts,
    };
  });
}

export function customerReportCsv(r: CustomerReport): string {
  const rows: (string | number | null)[][] = [
    ["Customer & Cohort Analytics Report", `${r.range.from} to ${r.range.to}`],
    ["Total Customer Database", r.totalCustomers],
    ["Repeat Purchase Rate (%)", `${r.repeatPurchaseRate}%`],
    ["Customer Lifetime Value (BDT)", r.averageLtv],
    ["Average Orders per Customer", r.averageOrdersPerCustomer],
    ["Repeat Buyer Revenue Share (%)", `${r.repeatRevenueShare}%`],
    [],
    [
      "Shopper Segment",
      "Customer Count",
      "Orders Placed",
      "Total Revenue (BDT)",
      "Avg Order Value (BDT)",
      "Share of Revenue (%)",
    ],
    [
      r.segments.firstTime.label,
      r.segments.firstTime.customersCount,
      r.segments.firstTime.ordersCount,
      r.segments.firstTime.revenue,
      r.segments.firstTime.averageOrderValue,
      `${r.segments.firstTime.percentOfTotalRevenue}%`,
    ],
    [
      r.segments.returning.label,
      r.segments.returning.customersCount,
      r.segments.returning.ordersCount,
      r.segments.returning.revenue,
      r.segments.returning.averageOrderValue,
      `${r.segments.returning.percentOfTotalRevenue}%`,
    ],
    [],
    ["Top 20 VIP Customers", "Phone", "District", "Orders Count", "Lifetime Spend (BDT)", "Last Active"],
    ...r.topVipCustomers.map((v) => [
      v.name,
      v.phone,
      v.district,
      v.ordersCount,
      v.totalSpend,
      v.lastOrderDate,
    ]),
    [],
    ["RFM Lifecycle Cohorts", "Customer Count", "Total Revenue (BDT)", "Share of Base (%)", "Criteria"],
    ...r.rfmCohorts.map((rfm) => [
      rfm.label,
      rfm.count,
      rfm.totalRevenue,
      `${rfm.percentOfBase}%`,
      rfm.description,
    ]),
  ];

  return createCsvDocument(rows);
}
