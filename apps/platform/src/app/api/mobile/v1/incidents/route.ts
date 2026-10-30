import { NextResponse } from "next/server";
import { getOverview, getPlatformHealthMatrix } from "@biztrackbd/core";
import { getPlatformMobileSession } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { session, error, status } = await getPlatformMobileSession(req);
  if (!session) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const [overview, health] = await Promise.all([
      getOverview(session.actor),
      getPlatformHealthMatrix().catch(() => null),
    ]);

    return NextResponse.json({
      incidents: overview.needsAttentionQueue,
      health,
      summary: {
        criticalCount: overview.needsAttentionQueue.filter((i) => i.severity === "CRIT").length,
        highCount: overview.needsAttentionQueue.filter((i) => i.severity === "HIGH").length,
        warnCount: overview.needsAttentionQueue.filter((i) => i.severity === "WARN").length,
        openTickets: overview.openTickets,
        failingDomains: overview.failingDomains,
      },
    });
  } catch (err: any) {
    console.error("Platform mobile incidents error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load platform incident queue." },
      { status: 500 }
    );
  }
}
