import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import {
  getTenantTicketDetail,
  replyTenantTicket,
} from "@biztrackbd/core";

export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/mobile/v1/support/tickets/[id]
 * Retrieves ticket detail and customer-facing conversation thread.
 */
export async function GET(req: Request, { params }: RouteProps) {
  const { session, error, status } = await getMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Ticket ID required" }, { status: 400 });
  }

  try {
    const ticket = await getTenantTicketDetail(session.tenantId, session.actor, id);
    return NextResponse.json({ ticket });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load ticket details";
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}

/**
 * POST /api/mobile/v1/support/tickets/[id]
 * Merchant replies to the ticket thread.
 * Body: { message: string }
 */
export async function POST(req: Request, { params }: RouteProps) {
  const { session, error, status } = await getMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Ticket ID required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const message = String(body.message || "").trim();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    await replyTenantTicket(session.tenantId, session.actor, {
      ticketId: id,
      message,
    });

    // Return the updated ticket detail
    const ticket = await getTenantTicketDetail(session.tenantId, session.actor, id);
    return NextResponse.json({
      success: true,
      ticket,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reply to ticket";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
