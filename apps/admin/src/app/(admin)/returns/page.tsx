import type { Metadata } from "next";
import Link from "next/link";
import { can, exchangeOptions, getModuleStatus, getReturnMetrics, listReturns, returnTabCounts, type ReturnRow, type ReturnTab } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { AppDisabledNotice } from "@/components/app-disabled-notice";
import { dateOnly, prettyPhone, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { approveAction, declineAction, pickupAction, receiveAction, refundAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Returns" };

const TABS: { key: ReturnTab; label: string; alert?: boolean }[] = [
  { key: "requested", label: "Requested", alert: true }, { key: "approved", label: "Approved" }, { key: "coming_back", label: "Parcel coming back" },
  { key: "done", label: "Refunded or exchanged" }, { key: "declined", label: "Declined" },
];
const STATUS: Record<string, [string, string]> = {
  PENDING: ["Waiting for you", "warn"], APPROVED: ["Approved", "info"], PICKUP_BOOKED: ["Parcel coming back", "info"], RECEIVED: ["Parcel received", "warn"],
  REFUNDED: ["Refunded", "ok"], EXCHANGED: ["Exchanged", "ok"], DECLINED: ["Declined", "grey"],
};
const TYPE: Record<string, string> = { REFUND: "Refund", EXCHANGE: "Exchange", STORE_CREDIT: "Store credit" };

function Card({ r, tab, canEdit, options }: { r: ReturnRow; tab: ReturnTab; canEdit: boolean; options: { id: string; label: string; stock: number }[] }) {
  const [label, tone] = STATUS[r.status] ?? [r.status, "grey"];
  const value = r.lines.reduce((n, l) => n + l.unitPrice * l.qty, 0);
  return (
    <section className="card" data-testid="return-card" data-status={r.status}>
      <div className="card-head">
        <h2><Link href={`/orders/${r.orderId}`} className="link" prefetch={false}>{r.code}</Link> <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}>· order {r.orderNumber}</span></h2>
        <span className={`pill ${tone}`}>{label}</span>
      </div>
      <div style={{ fontWeight: 600 }}>{r.customerName} <span className="muted num" style={{ fontWeight: 400 }}>{prettyPhone(r.customerPhone)}</span></div>
      <ul style={{ margin: "8px 0", paddingLeft: 18 }}>
        {r.lines.map((l) => <li key={l.orderItemId}>{l.title}{l.variantTitle && l.variantTitle.toLowerCase() !== "default" ? ` (${l.variantTitle})` : ""} × {l.qty} <span className="muted num">{taka(l.unitPrice * l.qty)}</span></li>)}
      </ul>
      <dl className="kv">
        <dt>Reason</dt><dd>{r.reason}{r.customerNote ? ` · ${r.customerNote}` : ""}</dd>
        <dt>Wants</dt><dd>{TYPE[r.type] ?? r.type}{r.exchangeLabel ? ` → ${r.exchangeLabel}` : ""}</dd>
        {r.type !== "EXCHANGE" && <><dt>{r.status === "REFUNDED" ? "Refunded" : "Refund"}</dt><dd className="num">{taka(r.refundAmount ?? value)}</dd></>}
        {r.returnTrackingCode && <><dt>Return tracking</dt><dd>{r.returnTrackingCode}</dd></>}
        {r.adminNote && <><dt>Note</dt><dd>{r.adminNote}</dd></>}
        <dt>Opened</dt><dd>{dateOnly(r.createdAt)}</dd>
      </dl>

      {canEdit && r.status === "PENDING" && (
        <div className="stack" style={{ marginTop: 12 }}>
          <form action={approveAction.bind(null, r.id)} className="stack" data-testid="approve-form">
            <div className="row-2">
              <label className="field" style={{ marginBottom: 0 }}><span className="label">Resolution</span>
                <select className="select" name="type" defaultValue={r.type}><option value="REFUND">Refund to bKash or Nagad</option><option value="STORE_CREDIT">Store credit</option><option value="EXCHANGE">Exchange</option></select>
              </label>
              <label className="field" style={{ marginBottom: 0 }}><span className="label">Refund amount (৳)</span><input className="input" name="amount" inputMode="decimal" defaultValue={r.refundAmount ?? value} /></label>
            </div>
            <label className="field" style={{ marginBottom: 0 }}><span className="label">Send instead <span className="opt">(exchange only)</span></span>
              <select className="select" name="exchangeVariantId" defaultValue={r.exchangeVariantId ?? ""}>
                <option value="">Choose size or colour</option>
                {options.map((o) => <option key={o.id} value={o.id} disabled={o.stock <= 0}>{o.label} · {o.stock > 0 ? `${o.stock} in stock` : "out of stock"}</option>)}
              </select>
            </label>
            <SubmitButton className="btn btn-primary" pending="Approving…">Approve</SubmitButton>
          </form>
          <DeclineForm id={r.id} tab={tab} />
        </div>
      )}

      {canEdit && (r.status === "APPROVED" || r.status === "PICKUP_BOOKED") && (
        <div className="stack" style={{ marginTop: 12 }}>
          {r.status === "APPROVED" && (
            <form action={pickupAction.bind(null, r.id)} className="row" style={{ flexWrap: "nowrap" }}>
              <input className="input" name="tracking" maxLength={60} placeholder="Return tracking code (optional)" aria-label="Return tracking code" />
              <SubmitButton className="btn btn-secondary" pending="…">Parcel is coming back</SubmitButton>
            </form>
          )}
          <form action={receiveAction.bind(null, r.id, tab)} className="stack" data-testid="receive-form">
            <label className="row" style={{ flexWrap: "nowrap", gap: 8 }}><input type="checkbox" name="damaged" style={{ width: 20, height: 20 }} /> It came back damaged. Do not put it back in stock.</label>
            <SubmitButton className="btn btn-primary" pending="Saving…">{r.type === "EXCHANGE" ? "Parcel received. Send the replacement" : "Parcel received"}</SubmitButton>
          </form>
          <DeclineForm id={r.id} tab={tab} />
        </div>
      )}

      {canEdit && r.status === "RECEIVED" && (
        <form action={refundAction.bind(null, r.id)} className="stack" style={{ marginTop: 12 }} data-testid="refund-form">
          <div className="row-3">
            <label className="field" style={{ marginBottom: 0 }}><span className="label">Pay back</span>
              <select className="select" name="method" defaultValue={r.type === "STORE_CREDIT" ? "STORE_CREDIT" : "BKASH_SEND_MONEY"}><option value="BKASH_SEND_MONEY">Send money (bKash or Nagad)</option><option value="STORE_CREDIT">Store credit</option></select>
            </label>
            <label className="field" style={{ marginBottom: 0 }}><span className="label">Amount (৳)</span><input className="input" name="amount" inputMode="decimal" defaultValue={r.refundAmount ?? value} /></label>
            <label className="field" style={{ marginBottom: 0 }}><span className="label">Your TrxID <span className="opt">(send money)</span></span><input className="input" name="trxId" maxLength={12} autoCapitalize="characters" /></label>
          </div>
          <SubmitButton className="btn btn-success" pending="Recording…">I sent the money. Mark refunded</SubmitButton>
          <p className="muted" style={{ fontSize: 13 }}>Send the money from your own bKash or Nagad app first, then paste its transaction ID here. Store credit is added to the customer's balance.</p>
        </form>
      )}
      {r.status === "REFUNDED" && <p className="muted" style={{ marginTop: 10, fontSize: 13.5 }}>{r.refundMethod === "STORE_CREDIT" ? "Added as store credit" : "Sent by bKash or Nagad"}{r.refundedAt ? ` on ${dateOnly(r.refundedAt)}` : ""}.</p>}
    </section>
  );
}

function DeclineForm({ id, tab }: { id: string; tab: ReturnTab }) {
  return (
    <details>
      <summary className="link" style={{ cursor: "pointer" }}>Decline</summary>
      <form action={declineAction.bind(null, id, tab)} className="stack" style={{ marginTop: 10 }}>
        <input className="input" name="reason" required minLength={3} maxLength={150} placeholder="Why? For example: worn and washed" aria-label="Reason for declining" />
        <SubmitButton className="btn btn-danger" pending="Declining…">Decline return</SubmitButton>
      </form>
    </details>
  );
}

export default async function Returns({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("orders");
  const mod = await getModuleStatus(s.tenantId, "customer_returns");

  if (!mod.active) {
    return (
      <AppDisabledNotice
        appName="Customer Returns & Reverse Logistics"
        appKey="customer_returns"
        planTier={mod.planTier}
        minPlan="STARTER"
        description="Self-service storefront return requests, courier return parcel tracking, inspection workflows, and automated bKash/Nagad/credit refunds."
      />
    );
  }

  const tab = (TABS.find((t) => t.key === one(sp.tab))?.key ?? "requested") as ReturnTab;
  const canEdit = can(s.user.role, "orders", "edit");
  const [rows, counts, metrics, options] = await Promise.all([
    listReturns(s.tenantId, s.actor, tab), returnTabCounts(s.tenantId, s.actor), getReturnMetrics(s.tenantId, s.actor), exchangeOptions(s.tenantId, s.actor),
  ]);
  const err = one(sp.err);
  const done = one(sp.done);
  const DONE: Record<string, string> = { opened: "Return opened.", approved: "Return approved.", declined: "Return declined.", pickup: "Marked as coming back.", received: "Parcel received.", refunded: "Refund recorded." };

  return (
    <>
      <div className="page-head"><h1>Returns</h1><div className="actions"><p className="muted" style={{ margin: 0, fontSize: 13 }}>Start one from a delivered order.</p></div></div>
      <div className="grid grid-4" data-testid="return-stats">
        <div className="stat"><div className="k">Waiting for you</div><div className="v num">{metrics.waiting}</div></div>
        <div className="stat"><div className="k">Parcels coming back</div><div className="v num">{metrics.comingBack}</div></div>
        <div className="stat"><div className="k">Return rate, 30 days</div><div className="v num">{metrics.returnRatePercent == null ? "—" : `${metrics.returnRatePercent}%`}</div></div>
        <div className="stat"><div className="k">Refunded, 30 days</div><div className="v num">{taka(metrics.refunded30Days)}</div></div>
      </div>

      <nav className="tabs" aria-label="Return stages" style={{ marginTop: 14 }}>
        {TABS.map((t) => (
          <Link key={t.key} href={`/returns?tab=${t.key}`} aria-current={t.key === tab ? "page" : undefined} prefetch={false}>
            {t.label}<span className={`n${t.alert && counts[t.key] > 0 ? " alert" : ""}`}>{counts[t.key]}</span>
          </Link>
        ))}
      </nav>
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }} data-testid="return-error">{err}</div>}
      {done && DONE[done] && <div className="notice good" role="status" style={{ marginBottom: 12 }}>{DONE[done]}</div>}

      {rows.length === 0 ? <div className="card empty" data-testid="returns-empty">Nothing here.</div> : <div className="stack">{rows.map((r) => <Card key={r.id} r={r} tab={tab} canEdit={canEdit} options={options} />)}</div>}
    </>
  );
}
