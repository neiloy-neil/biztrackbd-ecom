import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEditableOrder, getOrderDetail } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
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
      <PageHeader
        crumbs={[{ label: "Orders", href: "/orders" }, { label: o.orderNumber, href: `/orders/${id}` }, { label: "Change items" }]}
        title={<span data-testid="items-title">Change items on {o.orderNumber}</span>}
        sub="Add or remove items, or adjust quantities on open orders."
      />
      {!e.editable ? (
        <div className="notice bad" role="alert" data-testid="items-locked">{e.reason}</div>
      ) : (
        <ItemsEditor orderId={id} orderNumber={o.orderNumber} lines={e.lines} paid={o.paymentStatus === "PAID" || o.paymentStatus === "PENDING_VERIFICATION"} currentTotal={o.totals.total} />
      )}
    </>
  );
}
