import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import { withTenant } from "@biztrackbd/db";
import { fetchSteadfastFraudStats, normalizeBdPhone } from "@biztrackbd/core";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  const { searchParams } = new URL(req.url);
  const rawPhone = searchParams.get("phone") || "";

  if (!rawPhone.trim()) {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
  }

  let phone = rawPhone.trim().replace(/[^\d+]/g, "");
  try {
    phone = normalizeBdPhone(phone);
  } catch {
    // If normalization fails, keep numeric string
  }

  try {
    // 1. Query this tenant's local order history for the phone number
    const localOrders = await withTenant(session.tenantId, async (tx) => {
      return tx.order.findMany({
        where: {
          customerPhone: { contains: phone.slice(-10) },
          deletedAt: null,
        },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        },
      });
    });

    const localTotal = localOrders.length;
    const localDelivered = localOrders.filter((o) => o.status === "DELIVERED").length;
    const localReturned = localOrders.filter((o) => o.status === "RETURNED").length;
    const localCancelled = localOrders.filter((o) => o.status === "CANCELLED").length;

    // 2. Query Steadfast cross-merchant delivery statistics
    let courierStats = await fetchSteadfastFraudStats(session.tenantId, phone).catch(() => null);

    let deliveredCount = localDelivered;
    let returnedCount = localReturned;
    let totalParcels = localTotal;

    if (courierStats) {
      deliveredCount = Math.max(deliveredCount, courierStats.deliveredParcels);
      returnedCount = Math.max(returnedCount, courierStats.cancelledParcels);
      totalParcels = Math.max(totalParcels, courierStats.totalParcels);
    }

    // Calculate score
    let trustScore = 95;
    if (totalParcels > 0) {
      trustScore = Math.round((deliveredCount / totalParcels) * 100);
    }

    const isRisky = trustScore < 60 || returnedCount >= 3;
    const riskLevel = trustScore >= 80 ? "LOW" : trustScore >= 50 ? "MEDIUM" : "HIGH";

    return NextResponse.json({
      phone,
      trustScore,
      totalOrders: totalParcels,
      deliveredCount,
      returnedCount,
      riskLevel,
      localHistory: {
        total: localTotal,
        delivered: localDelivered,
        returned: localReturned,
        cancelled: localCancelled,
      },
      courierNetworkData: !!courierStats,
    });
  } catch (err) {
    console.error("[Mobile Trust Radar Error]", err);
    return NextResponse.json(
      { error: "Failed to perform fraud trust lookup." },
      { status: 500 }
    );
  }
}
