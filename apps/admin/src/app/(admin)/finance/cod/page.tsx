import type { Metadata } from "next";
import Link from "next/link";
import { COURIER_PROVIDERS, can, getCodDashboard, listReconciliation, listSettlements, type ReconFilter, type ReconRow } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateOnly, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { acceptAction, disputeAction, importAction, syncNowAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "COD payouts" };

const FILTERS: [ReconFilter, string][] = [["attention", "Needs checking"], ["matched", "Matched"], ["unpaid", "Not paid yet"], ["returns", "Returns"], ["all", "All"]];
const COURIERS: Record<string, string> = { STEADFAST: "Steadfast", PATHAO: "Pathao", REDX: "RedX" };
const STATE: Record<string, [string, string]> = {
  MATCHED: ["Matched", "ok"], SHORT_PAID: ["Paid short", "bad"], RETURNED: ["Returned", "grey"], MISSING: ["Missing", "bad"], NOT_PAID: ["Not paid yet", "warn"],
};

function Resolve({ r, canEdit }: { r: ReconRow; canEdit: boolean }) {
  if (!canEdit || r.state !== "SHORT_PAID" || !r.lineId) return null;
  return (
    <details style={{ marginTop: 6 }}>
      <summary className="link" style={{ cursor: "pointer", fontSize: 13 }}>Resolve</summary>
      <div className="stack" style={{ marginTop: 8 }}>
        <form action={acceptAction.bind(null, r.lineId)}><SubmitButton className="btn btn-secondary btn-sm" pending="…">Mark matched. I accept this</SubmitButton></form>
        <form action={disputeAction.bind(null, r.lineId)} className="stack">
          <input className="input input-sm" name="note" required minLength={3} maxLength={200} placeholder="What you told the courier" aria-label="Dispute note" />
          <SubmitButton className="btn btn-secondary btn-sm" pending="…">Raise dispute</SubmitButton>
        </form>
      </div>
    </details>
  );
}

function Result({ r }: { r: ReconRow }) {
  const [label, tone] = STATE[r.state] ?? [r.state, "grey"];
  return (
    <>
      <span className={`pill ${tone}`}>{label}</span>
      {r.state === "SHORT_PAID" && <div style={{ fontSize: 12.5, marginTop: 4 }}><b className="num">{taka(r.shortfall)}</b> short{r.reason ? `. ${r.reason}` : ""}</div>}
      {r.state === "NOT_PAID" && <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{r.daysWaiting} {r.daysWaiting === 1 ? "day" : "days"} since delivery{r.overdue ? ". Overdue." : ""}</div>}
      {r.invoiceNumber && <div className="muted" style={{ fontSize: 12.5 }}>Payout {r.invoiceNumber}</div>}
    </>
  );
}

function Card({ r, canEdit }: { r: ReconRow; canEdit: boolean }) {
  return (
    <div className="list-card" data-testid="recon-row" data-state={r.state}>
      <div className="top"><Link href={`/orders/${r.orderId}`} className="link" prefetch={false} style={{ flex: 1 }}><b>{r.orderNumber}</b></Link><span className="muted" style={{ fontSize: 12.5 }}>{COURIERS[r.courier] ?? r.courier}</span></div>
      <div style={{ marginTop: 4 }}>{r.customerName}</div>
      <dl className="kv" style={{ marginTop: 8 }}>
        <dt>Collected</dt><dd className="num">{taka(r.collected)}</dd>
        <dt>Should pay</dt><dd className="num">{taka(r.expectedNet)}</dd>
        <dt>Paid</dt><dd className="num">{r.netPaid == null ? "—" : taka(r.netPaid)}</dd>
      </dl>
      <div style={{ marginTop: 8 }}><Result r={r} /></div>
      <Resolve r={r} canEdit={canEdit} />
    </div>
  );
}

function Row({ r, canEdit }: { r: ReconRow; canEdit: boolean }) {
  return (
    <tr data-testid="recon-row" data-state={r.state}>
      <td><Link href={`/orders/${r.orderId}`} className="link" prefetch={false}>{r.orderNumber}</Link><div className="muted" style={{ fontSize: 12.5 }}>{COURIERS[r.courier] ?? r.courier} · {r.consignmentId ?? ""}</div></td>
      <td>{r.customerName}</td>
      <td className="r num">{taka(r.collected)}</td>
      <td className="r num">{taka(r.expectedNet)}</td>
      <td className="r num">{r.netPaid == null ? "—" : taka(r.netPaid)}</td>
      <td><Result r={r} /><Resolve r={r} canEdit={canEdit} /></td>
    </tr>
  );
}

export default async function CodRecon({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("reports");
  const filter = (FILTERS.find((f) => f[0] === one(sp.filter))?.[0] ?? "attention") as ReconFilter;
  const courier = COURIER_PROVIDERS.find((c) => c === one(sp.courier));
  const canEdit = can(s.user.role, "reports", "edit");
  const [dash, rows, payouts] = await Promise.all([getCodDashboard(s.tenantId, s.actor), listReconciliation(s.tenantId, s.actor, { filter, courier }), listSettlements(s.tenantId, s.actor)]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
  const q = (over: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = { filter, courier, ...over };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "filter" && v === "attention")) u.set(k, v);
    const t = u.toString();
    return `/finance/cod${t ? `?${t}` : ""}`;
  };
  const err = one(sp.err);
  const imported = one(sp.imported);
  const done = one(sp.done);

  return (
    <>
      <div className="page-head">
        <h1>COD payouts</h1>
        {can(s.user.role, "orders", "edit") && <div className="actions"><form action={syncNowAction}><SubmitButton className="btn btn-secondary" pending="Checking couriers…">Sync couriers now</SubmitButton></form></div>}
      </div>
      <p className="page-sub">Couriers collect cash from your customers and pay you later, minus their charges. Check each payout here.</p>

      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }} data-testid="cod-error">{err}</div>}
      {imported && (
        <div className="notice good" role="status" style={{ marginBottom: 12 }} data-testid="import-result">
          Payout {imported} imported: {one(sp.parcels)} parcels, {one(sp.matched)} matched, {one(sp.short)} paid short{Number(one(sp.shortfall)) > 0 ? ` (${taka(Number(one(sp.shortfall)))} in total)` : ""}, {one(sp.returned)} returned.
          {Number(one(sp.unmatched)) > 0 && ` ${one(sp.unmatched)} rows did not match any of your parcels.`}
          {Number(one(sp.dup)) > 0 && ` ${one(sp.dup)} rows were parcels already settled and were skipped.`}
        </div>
      )}
      {done === "accepted" && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Marked as matched.</div>}
      {done === "disputed" && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Dispute noted on the order.</div>}
      {done === "synced" && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Checked {one(sp.checked)} parcels, {one(sp.changed)} changed{Number(one(sp.failed)) > 0 ? `, ${one(sp.failed)} could not be checked` : ""}.</div>}

      <div className="grid grid-4" data-testid="cod-stats">
        <div className="stat"><div className="k">Couriers owe you</div><div className="v num" data-testid="owed-total">{taka(dash.owed.total)}</div><div className="d">{dash.owed.byCourier.map((c) => `${COURIERS[c.courier] ?? c.courier} ${taka(c.amount)}`).join(" · ") || "Nothing waiting"}</div></div>
        <div className="stat"><div className="k">Received this month</div><div className="v num">{taka(dash.settledThisMonth.amount)}</div><div className="d">{dash.settledThisMonth.payouts} {dash.settledThisMonth.payouts === 1 ? "payout" : "payouts"}</div></div>
        <div className="stat"><div className="k">Courier charges this month</div><div className="v num">{taka(dash.deductionsThisMonth.total)}</div><div className="d">Delivery {taka(dash.deductionsThisMonth.delivery)} · COD fee {taka(dash.deductionsThisMonth.codFee)} · returns {taka(dash.deductionsThisMonth.returns)}</div></div>
        <div className="stat"><div className="k">Does not match</div><div className={`v num${dash.mismatch.parcels > 0 ? " bad" : ""}`} data-testid="mismatch">{dash.mismatch.parcels}</div><div className="d">{dash.mismatch.parcels > 0 ? `${taka(dash.mismatch.shortfall)} short` : "All payouts add up"}{dash.overdue.parcels > 0 ? ` · ${dash.overdue.parcels} overdue` : ""}</div></div>
      </div>

      <nav className="tabs" aria-label="Courier" style={{ marginTop: 14 }}>
        <Link href={q({ courier: undefined })} aria-current={!courier ? "page" : undefined} prefetch={false}>All couriers</Link>
        {COURIER_PROVIDERS.map((c) => <Link key={c} href={q({ courier: c })} aria-current={courier === c ? "page" : undefined} prefetch={false}>{COURIERS[c]}</Link>)}
      </nav>
      <nav className="tabs" aria-label="Filter">
        {FILTERS.map(([k, l]) => <Link key={k} href={q({ filter: k })} aria-current={k === filter ? "page" : undefined} prefetch={false}>{l}</Link>)}
      </nav>

      {rows.length === 0 ? (
        <div className="card empty" data-testid="recon-empty">{filter === "attention" ? "Nothing needs checking." : "No parcels here."}</div>
      ) : (
        <>
        <div className="only-mobile stack" data-testid="recon-cards">{rows.map((r) => <Card key={r.key} r={r} canEdit={canEdit} />)}</div>
        <table className="table only-desktop" data-testid="recon-table">
          <thead><tr><th>Parcel</th><th>Customer</th><th className="r">Cash collected</th><th className="r">Should pay</th><th className="r">Paid</th><th>Result</th></tr></thead>
          <tbody>{rows.map((r) => <Row key={r.key} r={r} canEdit={canEdit} />)}</tbody>
        </table>
        </>
      )}

      <div className="grid grid-2" style={{ marginTop: 14 }}>
        {canEdit && (
          <form action={importAction} className="card stack" data-testid="import-form">
            <h2>Import a payout statement</h2>
            <p className="muted" style={{ fontSize: 13.5 }}>Download the CSV from your courier's merchant portal. We read the consignment IDs, what was collected and what was paid.</p>
            <div className="row-2">
              <label className="field" style={{ marginBottom: 0 }}><span className="label">Courier</span><select className="select" name="courier">{COURIER_PROVIDERS.map((c) => <option key={c} value={c}>{COURIERS[c]}</option>)}</select></label>
              <label className="field" style={{ marginBottom: 0 }}><span className="label">Payout invoice number</span><input className="input" name="invoiceNumber" required maxLength={60} /></label>
            </div>
            <div className="row-3">
              <label className="field" style={{ marginBottom: 0 }}><span className="label">Paid on</span><input className="input" name="disbursedAt" type="date" required defaultValue={today} max={today} /></label>
              <label className="field" style={{ marginBottom: 0 }}><span className="label">Paid into</span><select className="select" name="paymentMethod"><option value="BEFTN_BANK">Bank account</option><option value="BKASH_COMMERCIAL">bKash</option></select></label>
              <label className="field" style={{ marginBottom: 0 }}><span className="label">Last 4 digits <span className="opt">(optional)</span></span><input className="input" name="last4" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} /></label>
            </div>
            <label className="field" style={{ marginBottom: 0 }}><span className="label">Statement file (.csv)</span><input className="input" type="file" name="file" accept=".csv,text/csv" required /></label>
            <div><SubmitButton className="btn btn-primary" pending="Reading the statement…">Import and match</SubmitButton></div>
          </form>
        )}
        <section className="card">
          <h2>Payout history</h2>
          {payouts.length === 0 ? <p className="muted">No statements imported yet.</p> : (
            <table className="table" data-testid="payouts-table" style={{ boxShadow: "none" }}>
              <thead><tr><th>Payout</th><th className="r">Parcels</th><th className="r">Received</th></tr></thead>
              <tbody>{payouts.map((p) => <tr key={p.id}><td>{p.invoiceNumber}<div className="muted" style={{ fontSize: 12.5 }}>{COURIERS[p.courier] ?? p.courier} · {dateOnly(p.disbursedAt)}</div></td><td className="r num">{p.parcels}</td><td className="r num">{taka(p.disbursedAmount)}</td></tr>)}</tbody>
            </table>
          )}
        </section>
      </div>
      <p className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>
        "Should pay" is the cash collected minus the courier's delivery charge and COD fee, using the charges set in <Link href="/settings/shipping" className="link" prefetch={false}>Delivery charges</Link> unless the courier told us the real figure.
      </p>
    </>
  );
}
