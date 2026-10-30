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
      overview,
      health,
      user: session.user,
    });
  } catch (err: any) {
    console.error("Platform mobile overview error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load platform telemetry overview." },
      { status: 500 }
    );
  }
}
