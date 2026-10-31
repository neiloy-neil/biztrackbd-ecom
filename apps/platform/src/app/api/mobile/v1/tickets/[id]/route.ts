import { NextResponse } from "next/server";
import {
  getPlatformTicketDetail,
  replyPlatformTicket,
  updateTicketStatus,
  type TicketStatusType,
} from "@biztrackbd/core";
import { getPlatformMobileSession } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/mobile/v1/tickets/[id]
 * Retrieves full ticket detail, merchant context, and conversation history.
 */
export async function GET(req: Request, { params }: RouteProps) {
  const { session, error, status } = await getPlatformMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Ticket ID required" }, { status: 400 });
  }

  try {
    const ticket = await getPlatformTicketDetail(session.actor, id);
    return NextResponse.json({ ticket });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load ticket details";
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}

/**
 * POST /api/mobile/v1/tickets/[id]
 * Platform Admin action dispatcher:
 * - action: "reply" { body: string; isInternal?: boolean; newStatus?: TicketStatusType }
 * - action: "status" { status: TicketStatusType }
 */
export async function POST(req: Request, { params }: RouteProps) {
  const { session, error, status } = await getPlatformMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Ticket ID required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const action = String(body.action || "reply");

    if (action === "reply") {
      const messageBody = String(body.body || "").trim();
      const isInternal = Boolean(body.isInternal);
      const newStatus = (body.newStatus as TicketStatusType) || (isInternal ? undefined : "WAITING_ON_TENANT");

      if (!messageBody) {
        return NextResponse.json({ error: "Message body is required" }, { status: 400 });
      }

      await replyPlatformTicket(session.actor, {
        ticketId: id,
        body: messageBody,
        isInternal,
        newStatus,
      });
    } else if (action === "status") {
      const targetStatus = body.status as TicketStatusType;
      if (!targetStatus || !["OPEN", "WAITING_ON_TENANT", "SOLVED"].includes(targetStatus)) {
        return NextResponse.json({ error: "Invalid ticket status" }, { status: 400 });
      }

      await updateTicketStatus(session.actor, id, targetStatus);
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    // Return the updated ticket detail
    const ticket = await getPlatformTicketDetail(session.actor, id);
    return NextResponse.json({
      success: true,
      ticket,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Operation failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
