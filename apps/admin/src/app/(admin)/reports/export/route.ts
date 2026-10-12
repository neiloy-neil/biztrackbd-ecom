import { NextResponse, type NextRequest } from "next/server";
import { DomainError, ForbiddenError, getSalesReport, lastDays, salesReportCsv } from "@biztrackbd/core";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The report as a CSV download. Needs reports access (the service checks it again). */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (s.demo) return new Response("Exports are not available in the demo.", { status: 403 });
  const u = req.nextUrl.searchParams;
  const range = u.get("from") && u.get("to") ? { from: u.get("from")!, to: u.get("to")! } : lastDays(30);
  try {
    const csv = salesReportCsv(await getSalesReport(s.tenantId, s.actor, range));
    return new NextResponse(`\uFEFF${csv}`, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="sales-${range.from}-to-${range.to}.csv"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return new NextResponse("Forbidden", { status: 403 });
    if (e instanceof DomainError) return new NextResponse(e.message, { status: 400 });
    throw e;
  }
}
