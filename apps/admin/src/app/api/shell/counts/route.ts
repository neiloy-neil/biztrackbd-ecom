import { NextResponse } from "next/server";
import { shellCounts } from "@biztrackbd/core";
import { getSessionOrNull } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Numbers for the sidebar badges and the bell. The shell asks every half minute while the tab is visible. */
export async function GET() {
  const s = await getSessionOrNull();
  if (!s) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (s.access.state === "LOCKED") return NextResponse.json({ check: 0, newOrders: 0, toPack: 0, returnsPending: 0, lowStock: 0, items: [] });
  return NextResponse.json(await shellCounts(s.tenantId, s.actor), { headers: { "cache-control": "no-store" } });
}
