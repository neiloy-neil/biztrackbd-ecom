import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RETURN_REASONS, exchangeOptions, getOrderDetail, returnableItems } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { NewReturnForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Start a return" };

export default async function NewReturn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("orders", "edit");
  const orderId = one(sp.order);
  // A return starts from an order: without one, go to the returns list (which explains how) instead of a 404.
  if (!orderId) redirect("/returns");
  const order = await getOrderDetail(s.tenantId, s.actor, orderId).catch(() => null);
  if (!order) notFound();
  const [{ eligible, items }, options] = await Promise.all([returnableItems(s.tenantId, s.actor, orderId), exchangeOptions(s.tenantId, s.actor)]);

  return (
    <>
      <PageHeader
        title="Start a return"
        crumbs={[
          { label: "Orders", href: "/orders" },
          { label: order.orderNumber, href: `/orders/${orderId}` },
          { label: "Start a return" },
        ]}
        sub={`${order.customerName} · order ${order.orderNumber}`}
      />
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
