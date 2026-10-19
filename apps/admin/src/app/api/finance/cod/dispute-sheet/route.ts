import { NextResponse, type NextRequest } from "next/server";
import { exportDisputeSheet } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await requireAccess("reports");
  const courier = req.nextUrl.searchParams.get("courier") || undefined;
  const csv = await exportDisputeSheet(s.tenantId, s.actor, { courier });
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="courier-disputes-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
