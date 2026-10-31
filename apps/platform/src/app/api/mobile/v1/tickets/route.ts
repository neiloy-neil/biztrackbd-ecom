import { NextResponse } from "next/server";
import {
  listPlatformTickets,
  type TicketStatusType,
} from "@biztrackbd/core";
import { getPlatformMobileSession } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/tickets
 * Lists tickets for platform super admins with status filtering and search.
 */
export async function GET(req: Request) {
  const { session, error, status } = await getPlatformMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const filterParam = searchParams.get("status")?.toUpperCase();
    const search = searchParams.get("q")?.trim() || undefined;

    let filterStatus: TicketStatusType | "MINE" | undefined = undefined;
    if (filterParam === "OPEN" || filterParam === "WAITING_ON_TENANT" || filterParam === "SOLVED" || filterParam === "MINE") {
      filterStatus = filterParam as TicketStatusType | "MINE";
    }

    const tickets = await listPlatformTickets(session.actor, {
      status: filterStatus,
      search,
    });

    return NextResponse.json({ tickets });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load platform tickets";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
