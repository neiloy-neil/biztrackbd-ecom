import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEditableOrder, getOrderDetail } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { ItemsEditor } from "./items-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Change items" };

export default async function ChangeItems({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireAccess("orders", "edit");
  const [o, e] = await Promise.all([getOrderDetail(s.tenantId, s.actor, id).catch(() => null), getEditableOrder(s.tenantId, s.actor, id).catch(() => null)]);
  if (!o || !e) notFound();
  return (
    <>
      <Link href={`/orders/${id}`} className="back" prefetch={false}>← {o.orderNumber}</Link>
      <div className="page-head"><h1 data-testid="items-title">Change items on {o.orderNumber}</h1></div>
      {!e.editable ? (
        <div className="notice bad" role="alert" data-testid="items-locked">{e.reason}</div>
      ) : (
        <ItemsEditor orderId={id} orderNumber={o.orderNumber} lines={e.lines} paid={o.paymentStatus === "PAID" || o.paymentStatus === "PENDING_VERIFICATION"} currentTotal={o.totals.total} />
      )}
    </>
  );
}
