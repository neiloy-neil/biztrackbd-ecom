import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import { listConnectedCouriers } from "@biztrackbd/core";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/couriers
 * Lists connected courier accounts (Steadfast, Pathao, RedX, etc.) for the current store.
 */
export async function GET(req: Request) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  try {
    const couriers = await listConnectedCouriers(session.tenantId).catch(() => []);
    return NextResponse.json({ couriers });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load connected couriers";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
