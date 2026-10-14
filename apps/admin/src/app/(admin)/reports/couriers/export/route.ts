import { NextResponse, type NextRequest } from "next/server";
import {
  DomainError,
  ForbiddenError,
  courierReportCsv,
  getCourierReport,
  resolveReportRange,
} from "@biztrackbd/core";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (s.demo) return new Response("Exports are not available in the demo.", { status: 403 });

  const u = req.nextUrl.searchParams;
  const range = resolveReportRange({
    range: u.get("range"),
    from: u.get("from"),
    to: u.get("to"),
  });

  try {
    const csv = courierReportCsv(await getCourierReport(s.tenantId, s.actor, range));
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="courier-performance-${range.from}-to-${range.to}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return new NextResponse("Forbidden", { status: 403 });
    if (e instanceof DomainError) return new NextResponse(e.message, { status: 400 });
    throw e;
  }
}
