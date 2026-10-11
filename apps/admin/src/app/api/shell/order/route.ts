import { NextResponse, type NextRequest } from "next/server";
import { DomainError, can, getOrderDetail } from "@biztrackbd/core";
import { getSessionOrNull } from "@/lib/session";

export const dynamic = "force-dynamic";

/** What the orders list's quick-view drawer shows: the order at a glance, for the signed-in store only. */
export async function GET(req: NextRequest) {
  const s = await getSessionOrNull();
  if (!s) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!can(s.user.role, "orders") || s.access.state === "LOCKED") return NextResponse.json({ error: "You do not have access to this." }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const o = await getOrderDetail(s.tenantId, s.actor, id);
    return NextResponse.json({
      id: o.id, orderNumber: o.orderNumber, status: o.status, paymentStatus: o.paymentStatus, paymentMethod: o.paymentMethod, channel: o.channel, createdAt: o.createdAt,
      customer: { name: o.customerName, phone: o.customerPhone, email: o.customerEmail }, address: o.address, notes: o.notes,
      items: o.items.map((i) => ({ title: i.title, variant: i.variantTitle, quantity: i.quantity, total: i.total, imageUrl: i.imageUrl })),
      totals: { subtotal: o.totals.subtotal, delivery: o.totals.delivery, discount: o.totals.discount, total: o.totals.total },
      trxId: o.mfs.trxId, courier: { provider: o.courier.provider, trackingCode: o.courier.trackingCode, statusLabel: o.courier.statusLabel },
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof DomainError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
}
