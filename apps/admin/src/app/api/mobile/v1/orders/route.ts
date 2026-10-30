import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import { listOrders, orderTabCounts, type OrderTab, type OrderFilters } from "@biztrackbd/core";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  const { searchParams } = new URL(req.url);
  const tab = (searchParams.get("tab") || "all") as OrderTab;
  const search = searchParams.get("search") || undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20", 10), 100);

  const filters: OrderFilters = {
    tab,
    q: search,
    page: isNaN(page) ? 1 : page,
    pageSize: isNaN(pageSize) ? 20 : pageSize,
  };

  try {
    const [result, tabCounts] = await Promise.all([
      listOrders(session.tenantId, session.actor, filters),
      orderTabCounts(session.tenantId, session.actor),
    ]);

    const mappedOrders = result.rows.map((r: any) => {
      const totalNum = Number(r.totalAmount ?? r.total ?? 0);
      return {
        id: r.id,
        orderNumber: r.orderNumber,
        customerName: r.customerName || "Customer",
        customerPhone: r.customerPhone || "",
        city: r.area || r.district || "Dhaka",
        address: [r.area, r.district].filter(Boolean).join(", ") || "",
        total: totalNum,
        totalAmount: totalNum,
        paymentMethod: r.paymentMethod || "COD",
        paymentStatus: r.paymentStatus || "UNPAID",
        status: r.status || "PROCESSING",
        courierName: r.courierProvider || null,
        trackingCode: r.trackingCode || null,
        itemsCount: r.itemCount ?? 1,
        itemCount: r.itemCount ?? 1,
        createdAt: r.createdAt ? (typeof r.createdAt === "string" ? r.createdAt : r.createdAt.toISOString()) : new Date().toISOString(),
        riskLevel: r.fraudRiskLevel || "LOW",
        trustScore: r.fraudTrustScore ?? 85,
      };
    });

    return NextResponse.json({
      orders: mappedOrders,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: Math.ceil(result.total / result.pageSize),
      tabCounts,
    });
  } catch (err) {
    console.error("[Mobile Orders Error]", err);
    return NextResponse.json({ error: "Failed to fetch orders." }, { status: 500 });
  }
}
