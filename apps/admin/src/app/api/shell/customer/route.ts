import { NextResponse, type NextRequest } from "next/server";
import { DomainError, can, getCustomerDetail } from "@biztrackbd/core";
import { getSessionOrNull } from "@/lib/session";

export const dynamic = "force-dynamic";

/** What the customers list's quick-view drawer shows: the customer at a glance, for the signed-in store only. */
export async function GET(req: NextRequest) {
  const s = await getSessionOrNull();
  if (!s) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!can(s.user.role, "customers") || s.access.state === "LOCKED") return NextResponse.json({ error: "You do not have access to this." }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const c = await getCustomerDetail(s.tenantId, s.actor, id);
    return NextResponse.json({
      id: c.id, name: c.name, phone: c.phone, email: c.email, since: c.since, isVip: c.isVip, isBlocked: c.isBlocked, tags: c.tags,
      address: c.address ? { line: c.address.line, area: c.address.area, district: c.address.district } : null,
      stats: c.stats,
      orders: c.orders.slice(0, 5).map((o) => ({ id: o.id, orderNumber: o.orderNumber, createdAt: o.createdAt, status: o.status, totalAmount: o.totalAmount })),
      canOrder: can(s.user.role, "orders", "edit"),
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof DomainError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
}
