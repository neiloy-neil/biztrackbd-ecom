import { NextResponse } from "next/server";
import { listTenants, type TenantFilter } from "@biztrackbd/core";
import type { TenantLeadStage } from "@biztrackbd/db";
import { getPlatformMobileSession } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { session, error, status } = await getPlatformMobileSession(req);
  if (!session) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? undefined;
    const filter = (searchParams.get("filter") as TenantFilter) || "all";
    const leadStageRaw = searchParams.get("leadStage");
    const leadStage = leadStageRaw && leadStageRaw !== "all" ? (leadStageRaw.toUpperCase() as TenantLeadStage) : undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(200, parseInt(searchParams.get("pageSize") || "100", 10));

    const result = await listTenants(session.actor, {
      q,
      filter,
      leadStage,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Platform mobile tenants list error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load tenants directory." },
      { status: 500 }
    );
  }
}
