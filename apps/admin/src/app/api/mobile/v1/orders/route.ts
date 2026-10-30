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

    return NextResponse.json({
      orders: result.rows,
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
