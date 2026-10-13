import { NextResponse, type NextRequest } from "next/server";
import { BD_GEO, ForbiddenError, ordersCsv, type OrderTab } from "@biztrackbd/core";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const TABS = ["new", "check", "risk", "to_pack", "shipped", "delivered", "returns", "cancelled"];
const DISTRICTS = new Set(BD_GEO.flatMap((d) => d.districts.map((x) => x.name)));

/** The orders list as a CSV download, with the same filters as the screen. Needs orders access (the service checks it again). */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (s.demo) return new NextResponse("Exports are not available in the demo.", { status: 403 });
  if (s.actor.isImpersonator) return new NextResponse("Bulk export is prohibited during super admin impersonation.", { status: 403 });
  const q = req.nextUrl.searchParams;
  const tab = TABS.includes(q.get("tab") ?? "") ? (q.get("tab") as OrderTab) : "all";
  const payment = (["COD", "MANUAL_BKASH", "MANUAL_NAGAD"] as const).find((p) => p === q.get("payment"));
  const district = DISTRICTS.has(q.get("district") ?? "") ? q.get("district")! : undefined;
  const range = q.get("range");
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
  const days = range === "today" ? 1 : range === "7" ? 7 : range === "30" ? 30 : 0;
  const from = days ? new Date(`${shiftDay(todayIso, -(days - 1))}T00:00:00+06:00`) : undefined;
  try {
    const csv = await ordersCsv(s.tenantId, s.actor, { tab, q: q.get("q") ?? undefined, payment, district, courier: q.get("courier") ?? undefined, tag: q.get("tag") ?? undefined, from });
    return new NextResponse(`﻿${csv}`, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="orders-${todayIso}.csv"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return new NextResponse("Forbidden", { status: 403 });
    throw e;
  }
}

function shiftDay(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
