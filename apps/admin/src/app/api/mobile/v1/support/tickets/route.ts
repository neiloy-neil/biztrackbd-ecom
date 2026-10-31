import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import {
  listTenantTickets,
  createTenantTicket,
  type TicketPriority,
} from "@biztrackbd/core";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/support/tickets
 * Lists all support tickets opened by this store/tenant.
 */
export async function GET(req: Request) {
  const { session, error, status } = await getMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  try {
    const tickets = await listTenantTickets(session.tenantId, session.actor);
    return NextResponse.json({ tickets });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load support tickets";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/mobile/v1/support/tickets
 * Creates a new support ticket for this merchant store.
 * Body: { subject: string; message: string; category?: string; contextRef?: string; priority?: TicketPriority }
 */
export async function POST(req: Request) {
  const { session, error, status } = await getMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  try {
    const body = await req.json();
    const subject = String(body.subject || "").trim();
    const rawMessage = String(body.message || "").trim();
    const category = body.category ? String(body.category).trim() : null;
    const contextRef = body.contextRef ? String(body.contextRef).trim() : null;
    const priority = (body.priority as TicketPriority) || "NORMAL";

    if (!subject) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }
    if (!rawMessage) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Compose formatted message including category and optional context reference (Order # / TrxID)
    let fullMessage = "";
    if (category || contextRef) {
      const metaParts: string[] = [];
      if (category) metaParts.push(`Category: ${category}`);
      if (contextRef) metaParts.push(`Reference (Order/TrxID): ${contextRef}`);
      fullMessage = `[${metaParts.join(" | ")}]\n\n${rawMessage}`;
    } else {
      fullMessage = rawMessage;
    }

    const created = await createTenantTicket(session.tenantId, session.actor, {
      subject,
      message: fullMessage,
      priority,
    });

    return NextResponse.json({
      success: true,
      ticket: created,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create support ticket";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
