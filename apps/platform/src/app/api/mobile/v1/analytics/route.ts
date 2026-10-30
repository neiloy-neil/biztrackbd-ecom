import { NextResponse } from "next/server";
import { getAnalyticsDashboardData } from "@biztrackbd/core";
import { getPlatformMobileSession } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { session, error, status } = await getPlatformMobileSession(req);
  if (!session) {
    return NextResponse.json({ error }, { status });
  }

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") || "30";
  const campaign = searchParams.get("campaign") || undefined;
  const device = searchParams.get("device") || undefined;

  try {
    const data = await getAnalyticsDashboardData({
      range,
      campaign,
      device,
    });

    return NextResponse.json({
      summary: data.summary,
      funnel: data.funnel,
      trend: data.trend,
      campaigns: data.campaigns.slice(0, 15),
      topPages: data.topPages.slice(0, 10),
      recentErrors: data.recentErrors.slice(0, 10),
      activeRange: data.activeRange,
    });
  } catch (err: any) {
    console.error("Platform mobile analytics error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load platform analytics data." },
      { status: 500 }
    );
  }
}
