# Analytics Data Pipeline & Fast Dashboard Query Optimization

Status: COMPLETE SPECIFICATION  
Scope: `packages/db`, `packages/core/src/analytics`, `apps/admin`, `apps/platform`

---

## 1. Overview & The "Zero-Slow-Query" Philosophy

In a high-volume multi-tenant ecommerce SaaS with hundreds of stores, executing live `COUNT(*)` or `SUM(total)` queries with complex `date_trunc` aggregations on raw `Order` and `Customer` tables on every page load leads to database CPU spikes and slow response times (> 1.5s).

### Architecture Strategy:
1. **Daily Rollup Table (`DailyStoreMetrics`)**: Historical days (yesterday and older) are aggregated once per night via Inngest and stored as immutable daily rows.
2. **Real-Time "Today" Cache**: Today's live sales are computed directly from the composite index `@@index([tenantId, createdAt])` and cached in Redis / React Server Component cache for 60 seconds.
3. **Sub-50ms Dashboard Response**: Querying a 30-day or 12-month trend requires scanning only **30 or 365 rows** from `DailyStoreMetrics`, rather than tens of thousands of raw orders.

---

## 2. Rollup Schema Definition

`DailyStoreMetrics` and `PlatformDailyMetrics` are defined once, in `docs/08-database-schema-and-rls-spec.md` (sections 2 and 16). Do not redefine them here. Fields used by the rollup: gross, net, discounts, shipping and refund totals; total, paid, COD, cancelled and returned order counts; average order value; new and repeat customer counts. `PlatformDailyMetrics` is platform-level (no `tenantId`) and is written only by the `biztrack_platform` role.

---

## 3. Inngest Midnight Rollup Worker (`packages/core/src/analytics/rollup.ts`)

Runs every night at 00:05 AM Asia/Dhaka time to lock in the previous day's metrics:

```typescript
import { inngest } from "../client";
import { db } from "@biztrackbd/db";

export const executeDailyMetricsRollup = inngest.createFunction(
  {
    id: "cron-daily-metrics-rollup",
    name: "Daily Store & Platform Metrics Aggregation",
  },
  { cron: "5 0 * * *" }, // Daily at 00:05 AM
  async ({ step }) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0));
    const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999));

    // Step 1: Query all active tenants
    const tenants = await step.run("get-all-active-tenants", async () => {
      return db.tenant.findMany({
        where: { status: { in: ["ACTIVE", "TRIAL", "PAST_DUE"] } },
        select: { id: true },
      });
    });

    // Step 2: Batch compute daily rollup for each tenant
    for (const tenant of tenants) {
      await step.run(`rollup-tenant-${tenant.id}`, async () => {
        const orders = await db.order.findMany({
          where: {
            tenantId: tenant.id,
            createdAt: { gte: startOfYesterday, lte: endOfYesterday },
          },
        });

        const totalOrders = orders.length;
        if (totalOrders === 0) return;

        const grossSales = orders.reduce((sum, o) => sum + Number(o.total), 0);
        const discounts = orders.reduce((sum, o) => sum + Number(o.discountTotal), 0);
        const shipping = orders.reduce((sum, o) => sum + Number(o.deliveryFee), 0);
        const paidCount = orders.filter((o) => o.paymentStatus === "PAID").length;
        const codCount = orders.filter((o) => o.paymentMethod === "COD").length;
        const aov = totalOrders > 0 ? grossSales / totalOrders : 0;

        await db.dailyStoreMetrics.upsert({
          where: {
            tenantId_date: { tenantId: tenant.id, date: startOfYesterday },
          },
          create: {
            tenantId: tenant.id,
            date: startOfYesterday,
            grossSalesBDT: grossSales,
            netSalesBDT: grossSales - discounts,
            discountsTotalBDT: discounts,
            shippingTotalBDT: shipping,
            totalOrders,
            paidOrders: paidCount,
            codOrders: codCount,
            averageOrderValue: aov,
          },
          update: {
            grossSalesBDT: grossSales,
            netSalesBDT: grossSales - discounts,
            discountsTotalBDT: discounts,
            shippingTotalBDT: shipping,
            totalOrders,
            paidOrders: paidCount,
            codOrders: codCount,
            averageOrderValue: aov,
          },
        });
      });
    }

    return { status: "rollup_completed", tenantsCount: tenants.length };
  }
);
```

---

## 4. Ultra-Fast Dashboard Query Helper (`packages/core/src/analytics/dashboard.ts`)

Combines historical daily rollups with today's live cache in a single fast call:

```typescript
import { db } from "@biztrackbd/db";

export async function getStoreDashboardMetrics(tenantId: string, days = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // 1. Fetch historical daily summaries (ultra-fast index scan: 7 rows)
  const historical = await db.dailyStoreMetrics.findMany({
    where: {
      tenantId,
      date: { gte: startDate, lt: today },
    },
    orderBy: { date: "asc" },
  });

  // 2. Fetch today's live orders
  const todayOrders = await db.order.findMany({
    where: {
      tenantId,
      createdAt: { gte: today },
    },
    select: { total: true, status: true, paymentStatus: true },
  });

  const todayGross = todayOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const todayCount = todayOrders.length;
  const pendingPacking = todayOrders.filter((o) => o.status === "TO_PACK" || o.status === "NEW").length;

  return {
    historicalPoints: historical.map((h) => ({
      date: h.date.toISOString().split("T")[0],
      sales: Number(h.grossSalesBDT),
      orders: h.totalOrders,
    })),
    today: {
      sales: todayGross,
      orders: todayCount,
      pendingPacking,
    },
  };
}
```
