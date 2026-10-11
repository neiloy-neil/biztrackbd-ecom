import type { Metadata } from "next";
import Link from "next/link";
import { EXPENSE_CATEGORIES, EXPENSE_LABELS, addDays, can, dhakaDate, getProfitReport, lastDays, listExpenses } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateOnly, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { addExpenseAction, deleteExpenseAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profit and loss" };

const RANGES: [string, string][] = [["month", "This month"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"]];

function rangeOf(key: string): { from: string; to: string } {
  if (key === "month") {
    const today = dhakaDate(new Date());
    return { from: `${today.slice(0, 8)}01`, to: today };
  }
  return lastDays(Number(key));
}

export default async function Profit({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("reports");
  const key = RANGES.find((r) => r[0] === one(sp.range))?.[0] ?? "month";
  const range = rangeOf(key);
  const canEdit = can(s.user.role, "reports", "edit");
  const [r, expenses] = await Promise.all([getProfitReport(s.tenantId, s.actor, range), listExpenses(s.tenantId, s.actor, range)]);
  const today = dhakaDate(new Date());
  const label = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const maxLine = Math.max(1, ...r.lines.map((l) => l.amount));
  const maxDay = Math.max(1, ...r.days.map((d) => Math.abs(d.net)));
  const err = one(sp.err);
  const done = one(sp.done);

  return (
    <>
      <div className="page-head"><h1>Profit and loss</h1></div>
      <p className="page-sub">{label(r.from)} to {label(r.to)} · parcels delivered in this period</p>
      <nav className="tabs" aria-label="Period">
        {RANGES.map(([k, l]) => <Link key={k} href={`/finance/profit?range=${k}`} aria-current={k === key ? "page" : undefined} prefetch={false}>{l}</Link>)}
      </nav>
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {done && <div className="notice good" role="status" style={{ marginBottom: 12 }}>{done === "added" ? "Expense added." : "Expense deleted."}</div>}

      <div className="grid grid-4" data-testid="profit-stats">
        <div className="stat"><div className="k">Delivered sales</div><div className="v num" data-testid="profit-sales">{taka(r.sales)}</div><div className="d">{r.deliveredOrders} {r.deliveredOrders === 1 ? "order" : "orders"}</div></div>
        <div className="stat"><div className="k">Total costs</div><div className="v num" data-testid="profit-costs">{taka(r.totalCosts)}</div></div>
        <div className="stat"><div className="k">Net profit</div><div className={`v num ${r.net < 0 ? "bad" : ""}`} data-testid="profit-net">{r.net < 0 ? "−" : ""}{taka(Math.abs(r.net))}</div></div>
        <div className="stat"><div className="k">Margin</div><div className="v num">{r.netMarginPercent == null ? "—" : `${r.netMarginPercent}%`}</div><div className="d">Before costs of goods: {r.grossMarginPercent == null ? "—" : `${r.grossMarginPercent}%`}</div></div>
      </div>

      {r.itemsWithoutCost > 0 && <div className="notice" style={{ marginTop: 14 }} data-testid="cost-warning">{r.itemsWithoutCost} items sold have no cost price, so their cost counts as zero and profit looks higher than it is. Add a cost price to each product.</div>}
      {r.estimatedFeeParcels > 0 && <div className="notice info" style={{ marginTop: 10 }}>Courier charges for {r.estimatedFeeParcels} {r.estimatedFeeParcels === 1 ? "parcel are" : "parcels are"} estimated from your <Link href="/settings/shipping" className="link" prefetch={false}>courier rates</Link> until you import the payout statement.</div>}
      {r.biggestLeak && r.net < r.sales && (
        <div className="notice" style={{ marginTop: 10 }} data-testid="biggest-leak">Biggest leak: <b>{r.biggestLeak.label.toLowerCase()}</b> took {taka(r.biggestLeak.amount)}{r.biggestLeak.percentOfSales != null ? `, ${r.biggestLeak.percentOfSales}% of sales` : ""}.</div>
      )}

      <section className="card" style={{ marginTop: 14 }}>
        <h2>Where the money went</h2>
        <table className="table" data-testid="profit-lines" style={{ boxShadow: "none" }}>
          <tbody>
            <tr><td><b>Delivered sales</b></td><td className="r num"><b>{taka(r.sales)}</b></td><td style={{ width: "30%" }}></td></tr>
            {r.lines.map((l) => (
              <tr key={l.key} data-line={l.key}>
                <td>− {l.label}{l.key === "gateway" && l.amount === 0 ? <span className="muted" style={{ fontSize: 12.5 }}> (bKash and Nagad go straight to you)</span> : null}</td>
                <td className="r num">{taka(l.amount)}</td>
                <td><div className="meter"><i style={{ width: `${(l.amount / maxLine) * 100}%` }} /></div></td>
              </tr>
            ))}
            <tr><td><b>Net profit</b></td><td className="r num"><b data-testid="profit-net-line">{r.net < 0 ? "−" : ""}{taka(Math.abs(r.net))}</b></td><td></td></tr>
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <div className="card-head"><h2>Profit by day</h2><span className="muted" style={{ fontSize: 12.5 }}>Red bars are losses</span></div>
        <div className="bars" style={{ height: 120, gap: r.days.length > 40 ? 1 : 4 }} role="img" aria-label={`Daily net profit from ${label(r.from)} to ${label(r.to)}. Total ${taka(r.net)}.`}>
          {r.days.map((d, i) => (
            <div className="bar" key={d.date} title={`${label(d.date)}: ${d.net < 0 ? "−" : ""}${taka(Math.abs(d.net))}`}>
              <i style={{ height: `${Math.max(2, Math.round((Math.abs(d.net) / maxDay) * 100))}%`, background: d.net < 0 ? "var(--danger)" : undefined }} />
              {r.days.length <= 14 || i % Math.ceil(r.days.length / 7) === 0 ? <span>{label(d.date)}</span> : <span aria-hidden="true">&nbsp;</span>}
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-2" style={{ marginTop: 14 }}>
        <section className="card">
          <h2>Costs you enter</h2>
          {expenses.length === 0 ? <p className="muted">No expenses in this period. Add your ad spend, packaging, rent and salaries so profit is real.</p> : (
            <table className="table" data-testid="expenses-table" style={{ boxShadow: "none" }}>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td>{EXPENSE_LABELS[e.category]}<div className="muted" style={{ fontSize: 12.5 }}>{dateOnly(`${e.incurredOn}T00:00:00Z`)}{e.note ? ` · ${e.note}` : ""}</div></td>
                    <td className="r num">{taka(e.amount)}</td>
                    {canEdit && <td className="r"><form action={deleteExpenseAction.bind(null, key, e.id)}><SubmitButton className="btn btn-secondary btn-sm" pending="…" aria-label={`Delete ${EXPENSE_LABELS[e.category]} expense`}>Delete</SubmitButton></form></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        {canEdit && (
          <form action={addExpenseAction.bind(null, key)} className="card stack" data-testid="expense-form">
            <h2>Add a cost</h2>
            <div className="row-2">
              <label className="field" style={{ marginBottom: 0 }}><span className="label">What for</span><select className="select" name="category">{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{EXPENSE_LABELS[c]}</option>)}</select></label>
              <label className="field" style={{ marginBottom: 0 }}><span className="label">Amount (৳)</span><input className="input" name="amount" inputMode="decimal" required /></label>
            </div>
            <div className="row-2">
              <label className="field" style={{ marginBottom: 0 }}><span className="label">Date</span><input className="input" type="date" name="incurredOn" defaultValue={today} max={addDays(today, 1)} required /></label>
              <label className="field" style={{ marginBottom: 0 }}><span className="label">Note <span className="opt">(optional)</span></span><input className="input" name="note" maxLength={150} /></label>
            </div>
            <div><SubmitButton className="btn btn-primary" pending="Adding…">Add cost</SubmitButton></div>
          </form>
        )}
      </div>
      <p className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>
        Sales are parcels delivered in the period. Product cost comes from each product's cost price. Courier charges are real once you import a payout statement, estimated before that. Refunds paid by bKash or Nagad count when you paid them; store credit does not count until it is spent.
      </p>
    </>
  );
}
