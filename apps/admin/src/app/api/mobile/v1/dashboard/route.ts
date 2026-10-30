import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import { shellCounts, getDashboard } from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  try {
    const [counts, dashboard, codSum] = await Promise.all([
      shellCounts(session.tenantId, session.actor),
      getDashboard(session.tenantId, session.actor).catch(() => null),
      withTenant(session.tenantId, async (tx) => {
        return tx.order.aggregate({
          where: {
            paymentMethod: "COD",
            paymentStatus: "UNPAID",
            status: { in: ["SHIPPED", "DELIVERED", "PROCESSING"] },
            deletedAt: null,
          },
          _sum: {
            totalAmount: true,
          },
        });
      }).catch(() => null),
    ]);

    const pendingCourierCod = Number(codSum?._sum?.totalAmount || 0);

    return NextResponse.json({
      store: {
        id: session.tenantId,
        name: session.storeName,
        subdomain: session.tenantSubdomain,
      },
      counts,
      metrics: dashboard
        ? {
            revenueToday: dashboard.today.sales,
            ordersToday: dashboard.today.orders,
            netProfit: 0,
            pendingCourierCod,
            pendingVerification: counts.check,
            toPackCount: counts.toPack,
            returnsPending: counts.returnsPending,
            courierHealth: dashboard.courierHealth,
            funnel: dashboard.funnel,
          }
        : {
            revenueToday: 0,
            ordersToday: counts.newOrders,
            netProfit: 0,
            pendingCourierCod,
            pendingVerification: counts.check,
            toPackCount: counts.toPack,
            returnsPending: counts.returnsPending,
            courierHealth: null,
            funnel: null,
          },
    });
  } catch (err) {
    console.error("[Mobile Dashboard Error]", err);
    return NextResponse.json({ error: "Failed to load dashboard data." }, { status: 500 });
  }
}
