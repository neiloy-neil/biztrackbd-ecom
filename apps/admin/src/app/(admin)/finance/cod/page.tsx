import type { Metadata } from "next";
import Link from "next/link";
import {
  COURIER_PROVIDERS,
  can,
  getCodDashboard,
  getCourierRates,
  listConnectedCouriers,
  listReconciliation,
  listSettlements,
  type ReconFilter,
  type ReconRow,
} from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateOnly, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import {
  acceptAction,
  batchAcceptAction,
  disputeAction,
  importAction,
  saveSettingsAction,
  syncNowAction,
  verifyDepositAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "COD Reconciliation & Remittance" };

const FILTERS: [ReconFilter, string][] = [
  ["attention", "Needs checking"],
  ["matched", "Matched"],
  ["unpaid", "Not paid yet"],
  ["returns", "Returns"],
  ["all", "All"],
];

const VIEWS = [
  ["recon", "Parcels & Discrepancies"],
  ["history", "Remittances & Bank Clearing"],
  ["import", "Import & API Sync"],
  ["settings", "Settings & Rates"],
] as const;

type View = (typeof VIEWS)[number][0];

const COURIERS: Record<string, string> = {
  STEADFAST: "Steadfast",
  PATHAO: "Pathao",
  REDX: "RedX",
};

const STATE: Record<string, [string, string]> = {
  MATCHED: ["Matched", "ok"],
  SHORT_PAID: ["Paid short", "bad"],
  RETURNED: ["Returned", "grey"],
  MISSING: ["Missing", "bad"],
  NOT_PAID: ["Not paid yet", "warn"],
};

function Resolve({ r, canEdit }: { r: ReconRow; canEdit: boolean }) {
  if (!canEdit || r.state !== "SHORT_PAID" || !r.lineId) return null;
  return (
    <details style={{ marginTop: 6 }}>
      <summary className="link" style={{ cursor: "pointer", fontSize: 13 }}>
        Resolve
      </summary>
      <div className="stack" style={{ marginTop: 8 }}>
        <form action={acceptAction.bind(null, r.lineId)}>
          <SubmitButton className="btn btn-secondary btn-sm" pending="…">
            Mark matched. Accept variance
          </SubmitButton>
        </form>
        <form action={disputeAction.bind(null, r.lineId)} className="stack">
          <input
            className="input input-sm"
            name="note"
            required
            minLength={3}
            maxLength={200}
            defaultValue={r.disputeNote ?? ""}
            placeholder="What you told courier manager"
            aria-label="Dispute note"
          />
          <SubmitButton className="btn btn-secondary btn-sm" pending="…">
            {r.disputeStatus === "OPEN" ? "Update dispute note" : "Raise dispute"}
          </SubmitButton>
        </form>
      </div>
    </details>
  );
}

function Result({ r }: { r: ReconRow }) {
  const [label, tone] = STATE[r.state] ?? [r.state, "grey"];
  return (
    <>
      <span className={`pill ${tone}`}>
        {r.toleranceApplied > 0 && r.state === "MATCHED" ? "Tolerance Matched" : label}
      </span>
      {r.toleranceApplied > 0 && (
        <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
          ৳{r.toleranceApplied} variance accepted
        </div>
      )}
      {r.state === "SHORT_PAID" && (
        <div style={{ fontSize: 12.5, marginTop: 4 }}>
          <b className="num">{taka(r.shortfall)}</b> short
          {r.reason ? `. ${r.reason}` : ""}
          {r.disputeStatus === "OPEN" && r.disputeNote && (
            <div style={{ color: "var(--color-primary-dark, #2b6cb0)", marginTop: 2 }}>
              Dispute: <i>"{r.disputeNote}"</i>
            </div>
          )}
        </div>
      )}
      {r.state === "NOT_PAID" && (
        <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
          {r.daysWaiting} {r.daysWaiting === 1 ? "day" : "days"} since delivery
          {r.overdue ? ". Overdue." : ""}
        </div>
      )}
      {r.invoiceNumber && <div className="muted" style={{ fontSize: 12 }}>Payout {r.invoiceNumber}</div>}
    </>
  );
}

function Card({ r, canEdit }: { r: ReconRow; canEdit: boolean }) {
  return (
    <div className="list-card" data-testid="recon-row" data-state={r.state}>
      <div className="top">
        <Link href={`/orders/${r.orderId}`} className="link" prefetch={false} style={{ flex: 1 }}>
          <b>{r.orderNumber}</b>
        </Link>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {COURIERS[r.courier] ?? r.courier}
        </span>
      </div>
      <div style={{ marginTop: 4 }}>
        {r.customerName}
        {r.consignmentId && <span className="muted" style={{ fontSize: 12 }}> · CID: {r.consignmentId}</span>}
      </div>
      <dl className="kv" style={{ marginTop: 8 }}>
        <dt>Collected</dt>
        <dd className="num">{taka(r.collected)}</dd>
        <dt>Should pay</dt>
        <dd className="num">{taka(r.expectedNet)}</dd>
        <dt>Paid net</dt>
        <dd className="num">{r.netPaid == null ? "—" : taka(r.netPaid)}</dd>
      </dl>
      <div style={{ marginTop: 8 }}>
        <Result r={r} />
      </div>
      <Resolve r={r} canEdit={canEdit} />
    </div>
  );
}

function Row({ r, canEdit }: { r: ReconRow; canEdit: boolean }) {
  return (
    <tr data-testid="recon-row" data-state={r.state}>
      <td>
        <Link href={`/orders/${r.orderId}`} className="link" prefetch={false}>
          {r.orderNumber}
        </Link>
        <div className="muted" style={{ fontSize: 12.5 }}>
          {COURIERS[r.courier] ?? r.courier}
          {r.consignmentId ? ` · CID: ${r.consignmentId}` : ""}
        </div>
      </td>
      <td>{r.customerName}</td>
      <td className="r num">{taka(r.collected)}</td>
      <td className="r num">{taka(r.expectedNet)}</td>
      <td className="r num">{r.netPaid == null ? "—" : taka(r.netPaid)}</td>
      <td>
        <Result r={r} />
        <Resolve r={r} canEdit={canEdit} />
      </td>
    </tr>
  );
}

export default async function CodRecon({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const s = await requireAccess("reports");
  const filter = (FILTERS.find((f) => f[0] === one(sp.filter))?.[0] ?? "attention") as ReconFilter;
  const courier = COURIER_PROVIDERS.find((c) => c === one(sp.courier));
  const canEdit = can(s.user.role, "reports", "edit");
  const asked = one(sp.view);
  const view = (VIEWS.find(([k]) => k === asked)?.[0] ?? "recon") as View;

  const [dash, rows, payouts, rates, connectedCouriers] = await Promise.all([
    getCodDashboard(s.tenantId, s.actor),
    listReconciliation(s.tenantId, s.actor, { filter, courier }),
    listSettlements(s.tenantId, s.actor),
    getCourierRates(s.tenantId, s.actor),
    listConnectedCouriers(s.tenantId).catch(() => []),
  ]);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

  const q = (over: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = { view: view === "recon" ? undefined : view, filter, courier, ...over };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "filter" && v === "attention")) u.set(k, v);
    const t = u.toString();
    return `/finance/cod${t ? `?${t}` : ""}`;
  };

  const err = one(sp.err);
  const imported = one(sp.imported);
  const done = one(sp.done);

  const attentionCount = rows.filter((r) => r.state === "SHORT_PAID" || r.state === "MISSING").length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>COD Reconciliation & Treasury</h1>
          <p className="page-sub" style={{ marginTop: 4 }}>
            Auto-match courier payouts, resolve remittance variances, verify bank deposits, and track return logistics losses.
          </p>
        </div>
        {can(s.user.role, "orders", "edit") && (
          <div className="actions">
            <form action={syncNowAction}>
              <SubmitButton className="btn btn-secondary" pending="Checking couriers…">
                Sync couriers now
              </SubmitButton>
            </form>
          </div>
        )}
      </div>

      {err && (
        <div className="notice bad" role="alert" style={{ marginBottom: 12 }} data-testid="cod-error">
          {err}
        </div>
      )}
      {imported && (
        <div className="notice good" role="status" style={{ marginBottom: 12 }} data-testid="import-result">
          Payout {imported} imported: {one(sp.parcels)} parcels, {one(sp.matched)} matched, {one(sp.short)} paid short
          {Number(one(sp.shortfall)) > 0 ? ` (${taka(Number(one(sp.shortfall)))} in total)` : ""}, {one(sp.returned)} returned.
          {Number(one(sp.unmatched)) > 0 && ` ${one(sp.unmatched)} rows did not match any of your parcels.`}
          {Number(one(sp.dup)) > 0 && ` ${one(sp.dup)} rows were already settled and skipped.`}
        </div>
      )}
      {done === "accepted" && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Variance accepted and marked as matched.</div>}
      {done === "disputed" && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Dispute note recorded on order and audit ledger.</div>}
      {done === "batch_accepted" && (
        <div className="notice good" role="status" style={{ marginBottom: 12 }}>
          Batch accepted {one(sp.count)} parcels ({taka(Number(one(sp.amount) ?? 0))} shortfall cleared).
        </div>
      )}
      {done === "deposit_verified" && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Deposit confirmed and marked Bank Verified.</div>}
      {done === "settings_saved" && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Courier rate cards, auto-tolerance threshold, and restock guard saved.</div>}
      {done === "synced" && (
        <div className="notice good" role="status" style={{ marginBottom: 12 }}>
          Checked {one(sp.checked)} parcels, {one(sp.changed)} changed
          {Number(one(sp.failed)) > 0 ? `, ${one(sp.failed)} could not be checked` : ""}.
        </div>
      )}

      {/* Top 4 Stat Cards */}
      <div className="grid grid-4" data-testid="cod-stats">
        <div className="stat">
          <div className="k">Couriers owe you</div>
          <div className="v num" data-testid="owed-total">
            {taka(dash.owed.total)}
          </div>
          <div className="d">
            {dash.owed.byCourier.map((c) => `${COURIERS[c.courier] ?? c.courier} ${taka(c.amount)}`).join(" · ") || "Nothing waiting"}
          </div>
        </div>
        <div className="stat">
          <div className="k">Received this month</div>
          <div className="v num">{taka(dash.settledThisMonth.amount)}</div>
          <div className="d">
            {dash.settledThisMonth.payouts} {dash.settledThisMonth.payouts === 1 ? "payout" : "payouts"}
          </div>
        </div>
        <div className="stat">
          <div className="k">Courier deductions this month</div>
          <div className="v num">{taka(dash.deductionsThisMonth.total)}</div>
          <div className="d">
            Delivery {taka(dash.deductionsThisMonth.delivery)} · COD fee {taka(dash.deductionsThisMonth.codFee)} · Returns {taka(dash.deductionsThisMonth.returns)}
          </div>
        </div>
        <div className="stat">
          <div className="k">Discrepancies & Overdue</div>
          <div className={`v num${dash.mismatch.parcels > 0 ? " bad" : ""}`} data-testid="mismatch">
            {dash.mismatch.parcels}
          </div>
          <div className="d">
            {dash.mismatch.parcels > 0 ? `${taka(dash.mismatch.shortfall)} short` : "All payouts add up"}
            {dash.overdue.parcels > 0 ? ` · ${dash.overdue.parcels} overdue` : ""}
          </div>
        </div>
      </div>

      {/* Primary 4-Tab Navigation */}
      <nav className="tabs" aria-label="COD sections" style={{ marginTop: 14 }} data-testid="cod-tabs">
        {VIEWS.map(([k, l]) => (
          <Link
            key={k}
            href={k === "recon" ? "/finance/cod" : `/finance/cod?view=${k}`}
            aria-current={k === view ? "page" : undefined}
            prefetch={false}
          >
            {l}
          </Link>
        ))}
      </nav>

      {/* Tab 1: Parcels & Discrepancies */}
      {view === "recon" && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 8 }}>
            <nav className="tabs" aria-label="Courier" style={{ marginBottom: 0 }}>
              <Link href={q({ courier: undefined })} aria-current={!courier ? "page" : undefined} prefetch={false}>
                All couriers
              </Link>
              {COURIER_PROVIDERS.map((c) => (
                <Link key={c} href={q({ courier: c })} aria-current={courier === c ? "page" : undefined} prefetch={false}>
                  {COURIERS[c]}
                </Link>
              ))}
            </nav>

            {/* Quick Action Toolbar */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <a
                href={`/api/finance/cod/dispute-sheet${courier ? `?courier=${courier}` : ""}`}
                download
                className="btn btn-secondary btn-sm"
                title="Download CSV of all flagged discrepancies formatted for courier managers"
              >
                📥 Download Dispute Sheet (CSV)
              </a>
              {canEdit && (
                <form action={batchAcceptAction} style={{ display: "inline-block" }}>
                  <input type="hidden" name="maxShortfall" value={rates.toleranceAmount} />
                  <SubmitButton
                    className="btn btn-secondary btn-sm"
                    pending="Accepting…"
                    title={`Accept variances equal to or less than ৳${rates.toleranceAmount}`}
                  >
                    Accept All Within Tolerance (≤ ৳{rates.toleranceAmount})
                  </SubmitButton>
                </form>
              )}
            </div>
          </div>

          <nav className="tabs" aria-label="Filter" style={{ marginTop: 8 }}>
            {FILTERS.map(([k, l]) => (
              <Link key={k} href={q({ filter: k })} aria-current={k === filter ? "page" : undefined} prefetch={false}>
                {l}
                {k === "attention" && attentionCount > 0 && ` (${attentionCount})`}
              </Link>
            ))}
          </nav>

          {rows.length === 0 ? (
            <div className="card empty" data-testid="recon-empty">
              {filter === "attention" ? "Nothing needs checking. All payouts match expected rates!" : "No parcels here."}
            </div>
          ) : (
            <>
              <div className="only-mobile stack" data-testid="recon-cards">
                {rows.map((r) => (
                  <Card key={r.key} r={r} canEdit={canEdit} />
                ))}
              </div>
              <table className="table only-desktop" data-testid="recon-table">
                <thead>
                  <tr>
                    <th>Parcel</th>
                    <th>Customer</th>
                    <th className="r">Cash collected</th>
                    <th className="r">Should pay</th>
                    <th className="r">Paid net</th>
                    <th>Result & Resolution</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <Row key={r.key} r={r} canEdit={canEdit} />
                  ))}
                </tbody>
              </table>
            </>
          )}

          <p className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>
            "Should pay" is the cash collected minus the courier's delivery charge and COD fee, based on rates in{" "}
            <Link href="/finance/cod?view=settings" className="link" prefetch={false}>
              Settings & Rates
            </Link>{" "}
            (configured tolerance: ৳{rates.toleranceAmount}).
          </p>
        </>
      )}

      {/* Tab 2: Remittances & Bank Clearing */}
      {view === "history" && (
        <section className="card stack" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2>Remittance Invoices & Treasury Clearing</h2>
              <p className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
                Track payout invoices disbursed by couriers. Enter your bank statement UTR or bKash TrxID to clear remittances and export accounting journals.
              </p>
            </div>
          </div>

          {payouts.length === 0 ? (
            <p className="muted">No payout statements imported yet.</p>
          ) : (
            <table className="table" data-testid="payouts-table" style={{ boxShadow: "none" }}>
              <thead>
                <tr>
                  <th>Payout Invoice</th>
                  <th>Source</th>
                  <th className="r">Parcels</th>
                  <th className="r">Collected</th>
                  <th className="r">Deductions</th>
                  <th className="r">Disbursed Net</th>
                  <th>Bank / Treasury Status</th>
                  <th className="r">Accounting Journal</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <b>{p.invoiceNumber}</b>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {COURIERS[p.courier] ?? p.courier} · {dateOnly(p.disbursedAt)}
                      </div>
                      <div className="muted" style={{ fontSize: 11.5 }}>
                        {p.paymentMethod === "BKASH_COMMERCIAL" ? "bKash" : "Bank Transfer"}
                        {p.bankAccountLast4 ? ` (…${p.bankAccountLast4})` : ""}
                      </div>
                    </td>
                    <td>
                      <span className={`pill ${p.source === "API_SYNC" ? "ok" : "grey"}`} style={{ fontSize: 11 }}>
                        {p.source === "API_SYNC" ? "API Sync" : "CSV Statement"}
                      </span>
                    </td>
                    <td className="r num">{p.parcels}</td>
                    <td className="r num">{taka(p.collected)}</td>
                    <td className="r num">{taka(p.deductions)}</td>
                    <td className="r num">
                      <b>{taka(p.disbursedAmount)}</b>
                    </td>
                    <td>
                      {p.verifiedAt ? (
                        <div>
                          <span className="pill ok" style={{ fontSize: 11 }}>
                            Bank Verified ✅
                          </span>
                          <div style={{ fontSize: 11.5, marginTop: 3 }}>
                            Ref: <code>{p.bankTxnRef}</code>
                          </div>
                          <div className="muted" style={{ fontSize: 11 }}>
                            {p.verifiedBy} on {dateOnly(p.verifiedAt)}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="pill warn" style={{ fontSize: 11 }}>
                            In-Transit (Awaiting Bank)
                          </span>
                          {canEdit && (
                            <details style={{ marginTop: 4 }}>
                              <summary className="link" style={{ fontSize: 12, cursor: "pointer" }}>
                                Enter Bank UTR
                              </summary>
                              <form action={verifyDepositAction} style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
                                <input type="hidden" name="settlementId" value={p.id} />
                                <input
                                  className="input input-sm"
                                  name="bankTxnRef"
                                  required
                                  minLength={3}
                                  placeholder="Bank UTR / TrxID"
                                  style={{ maxWidth: 160 }}
                                />
                                <SubmitButton className="btn btn-secondary btn-sm" pending="Saving…">
                                  Verify
                                </SubmitButton>
                              </form>
                            </details>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="r">
                      <a
                        href={`/api/finance/cod/accounting-journal/${p.id}`}
                        download
                        className="btn btn-secondary btn-sm"
                        title="Download double-entry journal voucher CSV for Tally or QuickBooks"
                      >
                        📄 Journal CSV
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Tab 3: Import & API Sync */}
      {view === "import" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginTop: 12 }}>
          {/* Live Courier API Sync Status */}
          <div className="card stack">
            <h2>Automated Courier API & Webhooks</h2>
            <p className="muted" style={{ fontSize: 13.5 }}>
              Live remittance intake from courier portals. When payouts are released, remittances auto-sync into your ledger.
            </p>

            <div className="stack" style={{ gap: 12, marginTop: 6 }}>
              {["STEADFAST", "PATHAO"].map((provKey) => {
                const conn = connectedCouriers.find((c) => c.provider === provKey);
                return (
                  <div
                    key={provKey}
                    style={{
                      border: "1px solid var(--color-border, #e2e8f0)",
                      borderRadius: 8,
                      padding: 12,
                      background: "var(--color-bg-subtle, #f8fafc)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <b>{COURIERS[provKey]} Courier</b>
                      {conn ? (
                        <span className="pill ok" style={{ fontSize: 11 }}>
                          Connected ({conn.mode})
                        </span>
                      ) : (
                        <span className="pill warn" style={{ fontSize: 11 }}>
                          Not Configured
                        </span>
                      )}
                    </div>
                    <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {conn
                        ? `Live remittance sync enabled. Automated webhooks listen for payment disbursements.`
                        : `API keys missing. Add keys in Settings → Integrations to enable automated remittance polling.`}
                    </p>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 8 }}>
              <form action={syncNowAction}>
                <SubmitButton className="btn btn-secondary" pending="Syncing couriers…">
                  🔄 Trigger Courier Status Sweep Now
                </SubmitButton>
              </form>
            </div>
          </div>

          {/* Statement File Import Form */}
          {canEdit && (
            <form action={importAction} className="card stack" data-testid="import-form">
              <h2>Import a Courier Statement (CSV)</h2>
              <p className="muted" style={{ fontSize: 13.5 }}>
                Download the payout CSV from your courier merchant portal. We automatically detect column headers, match consignment IDs, and calculate discrepancies.
              </p>
              <div className="row-2">
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Courier</span>
                  <select className="select" name="courier">
                    {COURIER_PROVIDERS.map((c) => (
                      <option key={c} value={c}>
                        {COURIERS[c]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Payout invoice number</span>
                  <input className="input" name="invoiceNumber" required maxLength={60} placeholder="e.g. INV-SF-1082" />
                </label>
              </div>
              <div className="row-3">
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Paid on</span>
                  <input className="input" name="disbursedAt" type="date" required defaultValue={today} max={today} />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Paid into</span>
                  <select className="select" name="paymentMethod">
                    <option value="BEFTN_BANK">Bank account</option>
                    <option value="BKASH_COMMERCIAL">bKash Merchant</option>
                  </select>
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">
                    Last 4 digits <span className="opt">(optional)</span>
                  </span>
                  <input className="input" name="last4" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="1234" />
                </label>
              </div>
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="label">Statement file (.csv)</span>
                <input className="input" type="file" name="file" accept=".csv,text/csv" required />
              </label>
              <div>
                <SubmitButton className="btn btn-primary" pending="Reading and reconciling statement…">
                  Import and match statement
                </SubmitButton>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Tab 4: Settings & Rates */}
      {view === "settings" && (
        <div style={{ maxWidth: 640, marginTop: 12 }}>
          <form action={saveSettingsAction} className="card stack">
            <h2>Courier Rate Cards & Tolerance Settings</h2>
            <p className="muted" style={{ fontSize: 13.5 }}>
              Set your agreed courier rates, auto-tolerance threshold, and return parcel restocking policies.
            </p>

            <label className="field">
              <span className="label">Default Courier Provider</span>
              <select className="select" name="defaultCourier" defaultValue={rates.defaultCourier ?? ""}>
                <option value="">None (Select at booking time)</option>
                {COURIER_PROVIDERS.map((c) => (
                  <option key={c} value={c}>
                    {COURIERS[c]}
                  </option>
                ))}
              </select>
            </label>

            <div className="row-2">
              <label className="field">
                <span className="label">Inside Dhaka Delivery Fee (৳)</span>
                <input className="input" type="number" name="inside" required min={0} max={5000} defaultValue={rates.inside} />
              </label>
              <label className="field">
                <span className="label">Outside Dhaka Delivery Fee (৳)</span>
                <input className="input" type="number" name="outside" required min={0} max={5000} defaultValue={rates.outside} />
              </label>
            </div>

            <div className="row-2">
              <label className="field">
                <span className="label">COD Commission Rate (%)</span>
                <input className="input" type="number" step="0.01" name="codPercent" required min={0} max={10} defaultValue={rates.codPercent} />
              </label>
              <label className="field">
                <span className="label">Auto-Tolerance Threshold (৳)</span>
                <input
                  className="input"
                  type="number"
                  name="toleranceAmount"
                  required
                  min={0}
                  max={500}
                  defaultValue={rates.toleranceAmount}
                />
              </label>
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: -6 }}>
              Variances equal to or less than ৳{rates.toleranceAmount} (such as minor courier weight surcharges or rounding) are automatically accepted as Matched without blocking the parcel.
            </p>

            <div className="field" style={{ marginTop: 10 }}>
              <span className="label">Return Parcel Restock Guard</span>
              <p className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
                Controls whether shelf inventory increments automatically when a courier marks a parcel RETURNED.
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 6 }}>
                <input
                  type="radio"
                  name="autoRestockOnReturn"
                  value="false"
                  defaultChecked={!rates.autoRestockOnReturn}
                />
                <span>
                  <b>Require Warehouse Physical Receipt (Recommended)</b> — Stock is not added back to inventory until warehouse staff physically inspects the returned parcel.
                </span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="autoRestockOnReturn"
                  value="true"
                  defaultChecked={rates.autoRestockOnReturn}
                />
                <span>
                  <b>Auto-Restock Shelf Stock Immediately</b> — Stock increments as soon as the courier statement or sync reports the order as returned.
                </span>
              </label>
            </div>

            {canEdit && (
              <div style={{ marginTop: 12 }}>
                <SubmitButton className="btn btn-primary" pending="Saving settings…">
                  Save Settings & Rate Cards
                </SubmitButton>
              </div>
            )}
          </form>
        </div>
      )}
    </>
  );
}
