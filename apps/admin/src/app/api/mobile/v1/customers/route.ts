import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import { withTenant } from "@biztrackbd/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/customers
 * Returns customer list, VIP directory, segmentation counts, and SMS balance.
 * Query params: segment ('all' | 'vip' | 'at_risk' | 'abandoned'), q (search query)
 */
export async function GET(req: Request) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  const { searchParams } = new URL(req.url);
  const segment = searchParams.get("segment") || "all";
  const query = searchParams.get("q")?.trim() || "";

  try {
    const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);

    const data = await withTenant(session.tenantId, async (tx) => {
      // 1. Fetch all store customers
      const whereClause: any = {
        deletedAt: undefined,
      };

      if (query) {
        whereClause.OR = [
          { name: { contains: query, mode: "insensitive" } },
          { phone: { contains: query } },
        ];
      }

      const customers = await tx.customer.findMany({
        where: whereClause,
        orderBy: { totalSpent: "desc" },
        take: 100,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          totalOrders: true,
          totalSpent: true,
          deliveryScore: true,
          isBlacklisted: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
          orders: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { createdAt: true, status: true },
          },
        },
      });

      // 2. Compute segmentation counts
      const allCustomers = customers.map((c) => {
        const lastOrderDate = c.orders[0]?.createdAt || c.createdAt;
        const isVip = c.totalOrders >= 2 || Number(c.totalSpent) >= 3000;
        const isAtRisk =
          c.totalOrders > 0 && new Date(lastOrderDate) < fortyFiveDaysAgo;

        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          totalOrders: c.totalOrders,
          totalSpent: Number(c.totalSpent),
          deliveryScore: c.deliveryScore,
          isBlacklisted: c.isBlacklisted,
          tags: c.tags,
          isVip,
          isAtRisk,
          lastOrderDate,
          createdAt: c.createdAt,
        };
      });

      const vipList = allCustomers.filter((c) => c.isVip);
      const atRiskList = allCustomers.filter((c) => c.isAtRisk);

      // Filter by requested segment
      let filtered = allCustomers;
      if (segment === "vip") filtered = vipList;
      else if (segment === "at_risk") filtered = atRiskList;

      // 3. Fetch SMS usage counter / credits if available
      const smsUsage = await tx.$queryRaw<{ value: number }[]>`
        SELECT "value"::int FROM "UsageCounter"
        WHERE "tenantId" = ${session.tenantId} AND "metric" = 'sms'
        ORDER BY "periodStart" DESC LIMIT 1
      `.catch(() => [{ value: 0 }]);

      const creditsUsed = smsUsage[0]?.value || 0;

      return {
        customers: filtered,
        counts: {
          all: allCustomers.length,
          vip: vipList.length,
          atRisk: atRiskList.length,
        },
        creditsUsed,
      };
    });

    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load customers";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
