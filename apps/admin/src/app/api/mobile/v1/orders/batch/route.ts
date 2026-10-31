import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import {
  bookCouriers,
  markPacked,
  type CourierProviderKey,
} from "@biztrackbd/core";

export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/v1/orders/batch
 * Bulk operations on multiple orders:
 * - action: "book_couriers" { orderIds: string[]; provider: CourierProviderKey; weightGrams?: number; note?: string }
 * - action: "pack" { orderIds: string[] }
 */
export async function POST(req: Request) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  try {
    const body = await req.json();
    const action = String(body.action || "book_couriers");
    const orderIds = Array.isArray(body.orderIds)
      ? (body.orderIds as string[]).filter(Boolean)
      : [];

    if (orderIds.length === 0) {
      return NextResponse.json({ error: "At least one order ID is required" }, { status: 400 });
    }

    if (action === "book_couriers") {
      const provider = body.provider as CourierProviderKey;
      if (!provider) {
        return NextResponse.json({ error: "Courier provider is required (e.g. STEADFAST, PATHAO)" }, { status: 400 });
      }

      const weightGrams = body.weightGrams ? Number(body.weightGrams) : undefined;
      const note = body.note ? String(body.note).trim() : undefined;

      const result = await bookCouriers(session.tenantId, session.actor, orderIds, {
        provider,
        weightGrams,
        note,
      });

      return NextResponse.json({
        success: true,
        done: result.done,
        skipped: result.skipped,
        totalRequested: orderIds.length,
        totalBooked: result.done.length,
        totalSkipped: result.skipped.length,
      });
    }

    if (action === "pack") {
      const result = await markPacked(session.tenantId, session.actor, orderIds);
      return NextResponse.json({
        success: true,
        done: result.done,
        skipped: result.skipped,
        totalRequested: orderIds.length,
        totalPacked: result.done.length,
        totalSkipped: result.skipped.length,
      });
    }

    return NextResponse.json({ error: "Unknown batch action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to execute batch operation";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
