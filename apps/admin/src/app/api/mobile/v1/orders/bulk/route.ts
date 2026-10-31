import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import {
  bulkChangeStatus,
  markPacked,
  bookCouriers,
  listConnectedCouriers,
  DomainError,
} from "@biztrackbd/core";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  try {
    const connectedCouriers = await listConnectedCouriers(session.tenantId).catch(() => []);
    return NextResponse.json({
      connectedCouriers,
    });
  } catch (err: any) {
    console.error("[Mobile Bulk Couriers Error]", err);
    return NextResponse.json({ error: "Failed to list connected couriers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, orderIds, reason, provider, weightGrams, note } = body;

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: "orderIds must be a non-empty array" }, { status: 400 });
  }

  try {
    switch (action) {
      case "confirm": {
        const result = await bulkChangeStatus(
          session.tenantId,
          session.actor,
          orderIds,
          "CONFIRMED",
          reason || "Bulk confirmed via mobile app"
        );
        return NextResponse.json({
          success: true,
          action,
          done: result.done,
          skipped: result.skipped,
          message: `Confirmed ${result.done.length} order(s)${result.skipped.length > 0 ? ` (${result.skipped.length} skipped)` : ""}`,
        });
      }

      case "pack": {
        const result = await markPacked(session.tenantId, session.actor, orderIds);
        return NextResponse.json({
          success: true,
          action,
          done: result.done,
          skipped: result.skipped,
          message: `Sent ${result.done.length} order(s) to pack${result.skipped.length > 0 ? ` (${result.skipped.length} skipped)` : ""}`,
        });
      }

      case "cancel": {
        if (!reason || reason.trim().length < 3) {
          return NextResponse.json({ error: "Say briefly why you are cancelling (at least 3 characters)" }, { status: 400 });
        }
        const result = await bulkChangeStatus(
          session.tenantId,
          session.actor,
          orderIds,
          "CANCELLED",
          reason.trim()
        );
        return NextResponse.json({
          success: true,
          action,
          done: result.done,
          skipped: result.skipped,
          message: `Cancelled ${result.done.length} order(s)${result.skipped.length > 0 ? ` (${result.skipped.length} skipped)` : ""}`,
        });
      }

      case "book_courier": {
        if (!provider) {
          return NextResponse.json({ error: "Courier provider is required (e.g. STEADFAST, PATHAO)" }, { status: 400 });
        }
        const result = await bookCouriers(session.tenantId, session.actor, orderIds, {
          provider,
          weightGrams: weightGrams ? Number(weightGrams) : undefined,
          note,
        });
        return NextResponse.json({
          success: true,
          action,
          done: result.done,
          skipped: result.skipped,
          message: `Dispatched ${result.done.length} order(s) to ${provider}${result.skipped.length > 0 ? ` (${result.skipped.length} skipped)` : ""}`,
        });
      }

      default:
        return NextResponse.json({ error: `Unsupported bulk action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[Mobile Bulk Orders Error]", err);
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus || 400 });
    }
    return NextResponse.json({ error: err?.message || "Failed to process bulk order action" }, { status: 500 });
  }
}
