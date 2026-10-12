import { NextResponse } from "next/server";
import { ForbiddenError, customersCsv } from "@biztrackbd/core";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Customer list as a CSV download. Needs customers access (the service checks it again). */
export async function GET() {
  const s = await getSession();
  if (s.demo) return new NextResponse("Exports are not available in the demo.", { status: 403 });
  if (s.actor.isImpersonator) {
    return new NextResponse("Customer bulk export is prohibited during super admin impersonation.", { status: 403 });
  }
  try {
    const csv = await customersCsv(s.tenantId, s.actor);
    return new NextResponse(`\uFEFF${csv}`, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return new NextResponse("Forbidden", { status: 403 });
    throw e;
  }
}
