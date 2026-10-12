import type { Metadata } from "next";
import Link from "next/link";
import { can, getOrderDetail, listOrders } from "@biztrackbd/core";
import { CopyButton } from "@/components/copy-button";
import { SubmitButton } from "@/components/ui";
import { friendlyDate, prettyPhone, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { methodName } from "@/lib/status";
import { confirmPaymentAction, rejectPaymentAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Check payments" };

const REASONS = ["Not in my bKash history", "Not in my Nagad history", "The amount is less than the order total", "The TrxID is wrong"];

/**
 * bKash and Nagad payments waiting to be checked, one at a time, for a phone: the TrxID, sender and amount big enough to compare with
 * the bKash app, and two large buttons. The next payment opens after each answer.
 */
export default async function CheckPayments({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("orders");
  const canEdit = can(s.user.role, "orders", "edit");
  const list = await listOrders(s.tenantId, s.actor, { tab: "check", pageSize: 100 });
  const queue = [...list.rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const wanted = one(sp.o);
  const at = Math.max(0, queue.findIndex((r) => r.id === wanted));
  const current = queue[at];
  const nextId = queue.length > 1 ? queue[(at + 1) % queue.length]!.id : null;
  const o = current ? await getOrderDetail(s.tenantId, s.actor, current.id) : null;
  const msg = one(sp.msg);
  const err = one(sp.err);
  const [kind, num] = msg ? msg.split(":") : [];

  return (
    <div className="desk" data-testid="check-desk">
      <Link href="/orders?tab=check" className="back" prefetch={false}>← All orders</Link>
      <h1 className="desk-title">Check payments</h1>
      {kind === "confirmed" && <div className="notice good" role="status" data-testid="check-done">Payment confirmed for {num}.</div>}
      {kind === "rejected" && <div className="notice" role="status" data-testid="check-done">Marked as not received for {num}. The order stays open.</div>}
      {err && <div className="notice bad" role="alert" data-testid="check-error">{err}</div>}

      {!o || !current ? (
        <div className="card empty" data-testid="check-empty">
          <b>Nothing waiting.</b>
          <p className="muted" style={{ margin: "6px 0 14px" }}>Every bKash and Nagad payment has been checked.</p>
          <Link href="/orders" className="btn btn-primary" prefetch={false}>Back to orders</Link>
        </div>
      ) : (
        <>
          <div className="desk-progress" role="status" aria-label={`Payment ${at + 1} of ${queue.length}`}>
            <span><b>{at + 1}</b> of {queue.length} waiting</span>
            <span className="desk-bar" aria-hidden="true"><i style={{ width: `${((at + 1) / queue.length) * 100}%` }} /></span>
          </div>

          <section className="card desk-card" data-testid="check-card" data-order={o.orderNumber}>
            <div className="desk-head">
              <Link href={`/orders/${o.id}`} className="link" prefetch={false}><b>{o.orderNumber}</b></Link>
              <span className="muted">{o.customerName} · {friendlyDate(current.createdAt)}</span>
            </div>

            <div className="desk-field">
              <span className="desk-k">Method</span>
              <span className="desk-v">{methodName(o.paymentMethod)}</span>
            </div>
            <div className="desk-field">
              <span className="desk-k">Amount to find</span>
              <span className="desk-big num" data-testid="check-amount">{taka(o.totals.total)}</span>
            </div>
            <div className="desk-field">
              <span className="desk-k">Transaction ID (TrxID)</span>
              <span className="desk-row"><span className="desk-big mono" data-testid="check-trx">{o.mfs.trxId ?? "Not given"}</span>{o.mfs.trxId && <CopyButton value={o.mfs.trxId} label="TrxID" />}</span>
            </div>
            <div className="desk-field">
              <span className="desk-k">Sent from</span>
              <span className="desk-row"><span className="desk-v num" data-testid="check-sender">{o.mfs.sender ? prettyPhone(o.mfs.sender) : "Not given"}</span>{o.mfs.sender && <CopyButton value={o.mfs.sender} label="sender number" />}</span>
            </div>

            {o.trxReuse.length > 0 && (
              <div className="notice bad" role="alert" data-testid="check-reuse">This TrxID was also used on {o.trxReuse.map((r) => r.orderNumber).join(", ")}. Look closely before confirming.</div>
            )}
            {o.risk.flags.length > 0 && <div className="notice" data-testid="check-flags">{o.risk.flags.map((f) => f.label).join(" · ")}</div>}
            <p className="muted desk-hint">Open your {o.paymentMethod === "MANUAL_NAGAD" ? "Nagad" : "bKash"} app and look for this TrxID. It should be {taka(o.totals.total)} from this number.</p>

            {canEdit ? (
              <div className="desk-actions">
                <form action={confirmPaymentAction.bind(null, o.id, nextId, o.orderNumber)}>
                  <SubmitButton className="btn btn-primary btn-xl" pending="Confirming…" data-testid="check-confirm">It is in my {o.paymentMethod === "MANUAL_NAGAD" ? "Nagad" : "bKash"}: confirm</SubmitButton>
                </form>
                <details className="desk-reject" open={one(sp.reject) === "1"}>
                  <summary className="btn btn-secondary btn-xl" data-testid="check-notfound">I cannot find it</summary>
                  <form action={rejectPaymentAction.bind(null, o.id, nextId, o.orderNumber)} className="stack" style={{ marginTop: 12 }}>
                    <fieldset className="desk-reasons">
                      <legend className="label">What did you find?</legend>
                      {REASONS.map((r, i) => <label key={r} className="check"><input type="radio" name="reason" value={r} defaultChecked={i === 0} /><span>{r}</span></label>)}
                    </fieldset>
                    <label className="field" style={{ marginBottom: 0 }}><span className="label">Or write your own <span className="opt">(optional)</span></span><input className="input" name="other" maxLength={150} /></label>
                    <SubmitButton className="btn btn-danger btn-xl" pending="Saving…" data-testid="check-reject">Mark as not received</SubmitButton>
                  </form>
                </details>
              </div>
            ) : (
              <div className="notice">You can look at payments but not confirm them.</div>
            )}

            {nextId && <Link href={`/orders/check?o=${nextId}`} className="btn btn-secondary desk-skip" prefetch={false} data-testid="check-skip">Skip for now</Link>}
          </section>
        </>
      )}
    </div>
  );
}
