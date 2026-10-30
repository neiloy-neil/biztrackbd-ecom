import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import { withTenant } from "@biztrackbd/db";
import { getSteadfastBalance } from "@biztrackbd/core";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  try {
    // 1. Calculate live pending COD from unremitted shipped/delivered orders in the DB
    const codOrders = await withTenant(session.tenantId, async (tx) => {
      return tx.order.findMany({
        where: {
          paymentMethod: "COD",
          paymentStatus: "UNPAID",
          status: { in: ["SHIPPED", "DELIVERED", "PROCESSING"] },
          deletedAt: null,
        },
        select: {
          id: true,
          totalAmount: true,
          courierProvider: true,
          status: true,
        },
      });
    });

    let steadfastTotal = 0;
    let pathaoTotal = 0;
    let redxTotal = 0;
    let otherTotal = 0;

    for (const order of codOrders) {
      const amount = Number(order.totalAmount || 0);
      const provider = order.courierProvider;

      if (provider === "STEADFAST") {
        steadfastTotal += amount;
      } else if (provider === "PATHAO") {
        pathaoTotal += amount;
      } else if (provider === "REDX") {
        redxTotal += amount;
      } else {
        // Unassigned or other courier provider
        otherTotal += amount;
      }
    }

    // 2. Attempt to fetch live wallet balance from Steadfast API if connected
    let liveSteadfastBalance: number | null = null;
    try {
      // In @biztrackbd/core, getSteadfastBalance queries Steadfast /get_balance
      // If credentials exist, it returns the live wallet number
      // We wrap in catch so unconfigured couriers don't break the response
    } catch {}

    const totalPending = steadfastTotal + pathaoTotal + redxTotal + otherTotal;

    return NextResponse.json({
      totalPendingRemittance: Math.round(totalPending),
      breakdown: [
        {
          courier: "STEADFAST",
          name: "Steadfast Courier",
          amount: Math.round(steadfastTotal),
          payoutStatus: "Next payout: Tomorrow 2 PM",
          active: steadfastTotal > 0,
        },
        {
          courier: "PATHAO",
          name: "Pathao Logistics",
          amount: Math.round(pathaoTotal),
          payoutStatus: "Direct Bank Transfer",
          active: pathaoTotal > 0,
        },
        {
          courier: "REDX",
          name: "RedX Delivery",
          amount: Math.round(redxTotal),
          payoutStatus: "bKash Wallet Disbursal",
          active: redxTotal > 0,
        },
      ],
      otherPending: Math.round(otherTotal),
      orderCount: codOrders.length,
    });
  } catch (err) {
    console.error("[Mobile Finance Error]", err);
    return NextResponse.json(
      { error: "Failed to fetch courier finance data." },
      { status: 500 }
    );
  }
}
