import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RETURN_REASONS, exchangeOptions, getOrderDetail, returnableItems } from "@biztrackbd/core";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { NewReturnForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Start a return" };

export default async function NewReturn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("orders", "edit");
  const orderId = one(sp.order);
  if (!orderId) notFound();
  const order = await getOrderDetail(s.tenantId, s.actor, orderId).catch(() => null);
  if (!order) notFound();
  const [{ eligible, items }, options] = await Promise.all([returnableItems(s.tenantId, s.actor, orderId), exchangeOptions(s.tenantId, s.actor)]);

  return (
    <>
      <Link href={`/orders/${orderId}`} className="back" prefetch={false}>← {order.orderNumber}</Link>
      <div className="page-head"><h1>Start a return</h1></div>
      <p className="page-sub">{order.customerName} · order {order.orderNumber}</p>
      {!eligible ? (
        <div className="notice bad" role="alert">Only a delivered order can have a return.</div>
      ) : items.every((i) => i.left === 0) ? (
        <div className="notice">Everything on this order is already in a return.</div>
      ) : (
        <NewReturnForm orderId={orderId} reasons={RETURN_REASONS} items={items.map((i) => ({ id: i.id, title: i.title, variantTitle: i.variantTitle, unitPrice: i.unitPrice, left: i.left }))} options={options.map((o) => ({ id: o.id, label: o.label, stock: o.stock }))} />
      )}
    </>
  );
}
