import { NextResponse, type NextRequest } from "next/server";
import { adminSearch } from "@biztrackbd/core";
import { getSessionOrNull } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Ctrl+K search: a few orders, products and customers for the signed-in store only. */
export async function GET(req: NextRequest) {
  const s = await getSessionOrNull();
  if (!s) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (s.access.state === "LOCKED") return NextResponse.json({ hits: [] });
  const hits = await adminSearch(s.tenantId, s.actor, req.nextUrl.searchParams.get("q") ?? "");
  return NextResponse.json({ hits }, { headers: { "cache-control": "no-store" } });
}
