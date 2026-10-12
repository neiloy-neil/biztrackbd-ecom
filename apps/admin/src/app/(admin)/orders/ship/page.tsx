import type { Metadata } from "next";
import Link from "next/link";
import { can, getOrderDetail, listConnectedCouriers, listOrders } from "@biztrackbd/core";
import { CopyButton } from "@/components/copy-button";
import { SubmitButton } from "@/components/ui";
import { prettyPhone, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { bookDeskAction, shipByHandAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Book couriers" };

const WEIGHTS = ["0.5", "1", "2", "5"];

/**
 * Orders ready to go, one at a time, for a phone: who and where, how much cash to collect, the courier and the weight, and one large
 * button to book it. The next order opens after each booking.
 */
export default async function ShipDesk({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("orders");
  const canEdit = can(s.user.role, "orders", "edit");
  const [list, couriers] = await Promise.all([listOrders(s.tenantId, s.actor, { tab: "to_pack", pageSize: 100 }), listConnectedCouriers(s.tenantId)]);
  // Ready to book: not booked yet, and paid or cash on delivery.
  const queue = list.rows.filter((r) => !r.trackingCode && !r.courierProvider && (r.paymentMethod === "COD" || r.paymentStatus === "PAID"));
  const waitingOnPayment = list.rows.filter((r) => !r.trackingCode && !(r.paymentMethod === "COD" || r.paymentStatus === "PAID")).length;
  const at = Math.max(0, queue.findIndex((r) => r.id === one(sp.o)));
  const current = queue[at];
  const nextId = queue.length > 1 ? queue[(at + 1) % queue.length]!.id : null;
  const o = current ? await getOrderDetail(s.tenantId, s.actor, current.id) : null;
  const msg = one(sp.msg);
  const err = one(sp.err);
  const [kind, num, tracking] = msg ? msg.split(":") : [];
  const cash = o && o.paymentMethod === "COD" && o.paymentStatus !== "PAID" ? o.totals.total : 0;
  const address = o ? `${o.address.line}, ${o.address.area}, ${o.address.district}` : "";

  return (
    <div className="desk" data-testid="ship-desk">
      <Link href="/orders?tab=to_pack" className="back" prefetch={false}>← All orders</Link>
      <h1 className="desk-title">Book couriers</h1>
      {kind === "booked" && <div className="notice good" role="status" data-testid="ship-done">Booked {num}. Tracking code <b className="mono">{tracking}</b>.</div>}
      {kind === "shipped" && <div className="notice good" role="status" data-testid="ship-done">{num} is marked as shipped.</div>}
      {err && <div className="notice bad" role="alert" data-testid="ship-error">{err}</div>}

      {!o || !current ? (
        <div className="card empty" data-testid="ship-empty">
          <b>Nothing to book.</b>
          <p className="muted" style={{ margin: "6px 0 14px" }}>{waitingOnPayment > 0 ? `${waitingOnPayment} ${waitingOnPayment === 1 ? "order is" : "orders are"} waiting for a payment to be checked first.` : "Every order that is ready has been booked."}</p>
          <div className="row" style={{ gap: 8, justifyContent: "center" }}>
            {waitingOnPayment > 0 && <Link href="/orders/check" className="btn btn-primary" prefetch={false}>Check payments</Link>}
            <Link href="/orders" className="btn btn-secondary" prefetch={false}>Back to orders</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="desk-progress" role="status" aria-label={`Order ${at + 1} of ${queue.length}`}>
            <span><b>{at + 1}</b> of {queue.length} ready</span>
            <span className="desk-bar" aria-hidden="true"><i style={{ width: `${((at + 1) / queue.length) * 100}%` }} /></span>
          </div>

          <section className="card desk-card" data-testid="ship-card" data-order={o.orderNumber}>
            <div className="desk-head">
              <Link href={`/orders/${o.id}`} className="link" prefetch={false}><b>{o.orderNumber}</b></Link>
              {current.priority && <span className="pill info">Priority</span>}
              <span className="muted">{o.items.reduce((n, i) => n + i.quantity, 0)} {o.items.reduce((n, i) => n + i.quantity, 0) === 1 ? "item" : "items"}</span>
            </div>

            <div className="desk-field">
              <span className="desk-k">Deliver to</span>
              <span className="desk-v"><b>{o.customerName}</b></span>
              <span className="desk-row"><span className="desk-v num">{prettyPhone(o.customerPhone)}</span><a className="btn btn-secondary btn-sm" href={`tel:${o.customerPhone}`}>Call</a></span>
              <span className="desk-row"><span className="desk-v" style={{ flex: 1 }} data-testid="ship-address">{address}</span><CopyButton value={address} label="address" /></span>
            </div>
            <div className="desk-field">
              <span className="desk-k">Cash to collect</span>
              <span className={`desk-big num${cash === 0 ? " muted" : ""}`} data-testid="ship-cash">{cash > 0 ? taka(cash) : "Nothing: already paid"}</span>
            </div>
            <ul className="desk-items">
              {o.items.slice(0, 4).map((i) => <li key={i.id}>{i.quantity} × {i.title}{i.variantTitle && i.variantTitle.toLowerCase() !== "default" ? ` (${i.variantTitle})` : ""}</li>)}
              {o.items.length > 4 && <li className="muted">and {o.items.length - 4} more</li>}
            </ul>
            {o.risk.review === "HELD" && <div className="notice bad" role="alert" data-testid="ship-held">This order is held for review. Open it to call the customer and release the hold.</div>}

            {canEdit && couriers.length > 0 && (
              <form action={bookDeskAction.bind(null, o.id, nextId, o.orderNumber)} className="desk-actions" data-testid="ship-form">
                <fieldset className="desk-chips">
                  <legend className="label">Courier</legend>
                  {couriers.map((c, i) => <label key={c.provider} className="chip-radio"><input type="radio" name="provider" value={c.provider} defaultChecked={i === 0} /><span>{c.label}</span></label>)}
                </fieldset>
                <fieldset className="desk-chips">
                  <legend className="label">Weight</legend>
                  {WEIGHTS.map((w) => <label key={w} className="chip-radio"><input type="radio" name="weight" value={w} defaultChecked={w === "0.5"} /><span>{w} kg</span></label>)}
                </fieldset>
                <SubmitButton className="btn btn-primary btn-xl" pending="Booking…" data-testid="ship-book">Book this parcel</SubmitButton>
              </form>
            )}
            {canEdit && couriers.length === 0 && (
              <div className="stack">
                <div className="notice">No courier is connected yet. <Link href="/settings/integrations" className="link" prefetch={false}>Connect Steadfast, Pathao or RedX</Link>, or write a tracking code yourself.</div>
                <form action={shipByHandAction.bind(null, o.id, nextId, o.orderNumber)} className="stack">
                  <label className="field" style={{ marginBottom: 0 }}><span className="label">Tracking code</span><input className="input" name="tracking" required maxLength={60} data-testid="ship-tracking" /></label>
                  <SubmitButton className="btn btn-primary btn-xl" pending="Saving…" data-testid="ship-byhand">Mark as shipped</SubmitButton>
                </form>
              </div>
            )}
            {!canEdit && <div className="notice">You can look at orders but not book them.</div>}

            <div className="desk-links">
              <a className="btn btn-secondary" href={`/orders/print?ids=${o.id}&doc=slip`} target="_blank" rel="noopener noreferrer">Print packing slip</a>
              {nextId && <Link href={`/orders/ship?o=${nextId}`} className="btn btn-secondary" prefetch={false} data-testid="ship-skip">Skip for now</Link>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
