import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import { withTenant } from "@biztrackbd/db";
import {
  fetchUnifiedCourierFraud,
  toCourierFraudStats,
  fetchSteadfastFraudStats,
  normalizeBdPhone,
} from "@biztrackbd/core";

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

    // 2. Query 5-Courier Unified Fraud Verification API first (Steadfast, Pathao, RedX, CarryBee, Paperfly)
    const unifiedCourierData = await fetchUnifiedCourierFraud(phone).catch(() => null);

    // 3. Fallback to store's direct Steadfast connection if unified API returns null
    let courierStats = unifiedCourierData
      ? toCourierFraudStats(unifiedCourierData)
      : await fetchSteadfastFraudStats(session.tenantId, phone).catch(() => null);

    let deliveredCount = localDelivered;
    let returnedCount = localReturned;
    let totalParcels = localTotal;

    if (unifiedCourierData) {
      deliveredCount = Math.max(deliveredCount, unifiedCourierData.success_parcel);
      returnedCount = Math.max(returnedCount, unifiedCourierData.cancel_parcel);
      totalParcels = Math.max(totalParcels, unifiedCourierData.total_parcel);
    } else if (courierStats) {
      deliveredCount = Math.max(deliveredCount, courierStats.deliveredParcels);
      returnedCount = Math.max(returnedCount, courierStats.cancelledParcels);
      totalParcels = Math.max(totalParcels, courierStats.totalParcels);
    }

    // Calculate score
    let trustScore = 95;
    if (unifiedCourierData && typeof unifiedCourierData.score === "number") {
      trustScore = Math.round(unifiedCourierData.score);
    } else if (totalParcels > 0) {
      trustScore = Math.round((deliveredCount / totalParcels) * 100);
    }

    const hasReports = (unifiedCourierData?.unresolved_reports || 0) > 0;
    const isRisky = trustScore < 60 || returnedCount >= 3 || hasReports;
    const riskLevel =
      isRisky || trustScore < 50
        ? "HIGH"
        : trustScore >= 80
        ? "LOW"
        : "MEDIUM";

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
      courierNetworkData: !!(unifiedCourierData || courierStats),
      courierBreakdown: unifiedCourierData?.response || (courierStats ? {
        [courierStats.provider.toLowerCase()]: {
          total: courierStats.totalParcels,
          success: courierStats.deliveredParcels,
          cancel: courierStats.cancelledParcels,
          deliveredPercentage: Math.round(courierStats.successRatio),
          returnPercentage: Math.round(100 - courierStats.successRatio),
        },
      } : null),
      communityReports: unifiedCourierData?.community_reports || [],
      unresolvedReportsCount: unifiedCourierData?.unresolved_reports || 0,
      apiStatus: unifiedCourierData?.status || (riskLevel === "LOW" ? "Safe" : "High Risk"),
    });
  } catch (err) {
    console.error("[Mobile Trust Radar Error]", err);
    return NextResponse.json(
      { error: "Failed to perform fraud trust lookup." },
      { status: 500 }
    );
  }
}
