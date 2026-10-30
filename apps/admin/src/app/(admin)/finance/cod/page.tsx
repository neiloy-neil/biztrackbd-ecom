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
import { PageHeader } from "@biztrackbd/ui";
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
    <details className="mt-xs">
      <summary className="link cursor-pointer text-sm">
        Resolve
      </summary>
      <div className="stack mt-sm">
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
        <div className="muted text-xs mt-xs">
          ৳{r.toleranceApplied} variance accepted
        </div>
      )}
      {r.state === "SHORT_PAID" && (
        <div className="text-xs mt-xs">
          <b className="num">{taka(r.shortfall)}</b> short
          {r.reason ? `. ${r.reason}` : ""}
          {r.disputeStatus === "OPEN" && r.disputeNote && (
            <div className="text-brand mt-xs">
              Dispute: <i>"{r.disputeNote}"</i>
            </div>
          )}
        </div>
      )}
      {r.state === "NOT_PAID" && (
        <div className="muted text-xs mt-xs">
          {r.daysWaiting} {r.daysWaiting === 1 ? "day" : "days"} since delivery
          {r.overdue ? ". Overdue." : ""}
        </div>
      )}
      {r.invoiceNumber && <div className="muted text-xs">Payout {r.invoiceNumber}</div>}
    </>
  );
}

function Card({ r, canEdit }: { r: ReconRow; canEdit: boolean }) {
  return (
    <div className="list-card" data-testid="recon-row" data-state={r.state}>
      <div className="top">
        <Link href={`/orders/${r.orderId}`} className="link flex-1" prefetch={false}>
          <b>{r.orderNumber}</b>
        </Link>
        <span className="muted text-xs">
          {COURIERS[r.courier] ?? r.courier}
        </span>
      </div>
      <div className="mt-xs">
        {r.customerName}
        {r.consignmentId && <span className="muted text-xs"> · CID: {r.consignmentId}</span>}
      </div>
      <dl className="kv mt-sm">
        <dt>Collected</dt>
        <dd className="num">{taka(r.collected)}</dd>
        <dt>Should pay</dt>
        <dd className="num">{taka(r.expectedNet)}</dd>
        <dt>Paid net</dt>
        <dd className="num">{r.netPaid == null ? "—" : taka(r.netPaid)}</dd>
      </dl>
      <div className="mt-sm">
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
        <div className="muted text-xs">
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
      <PageHeader
        title="COD Reconciliation & Treasury"
        crumbs={[{ label: "Finance", href: "/finance/cod" }, { label: "COD Reconciliation" }]}
        sub="Auto-match courier payouts, resolve remittance variances, verify bank deposits, and track return logistics losses."
        actions={
          can(s.user.role, "orders", "edit") ? (
            <form action={syncNowAction}>
              <SubmitButton className="btn btn-secondary" pending="Checking couriers…">
                Sync couriers now
              </SubmitButton>
            </form>
          ) : undefined
        }
      />

      {err && (
        <div className="notice bad mb-md" role="alert" data-testid="cod-error">
          {err}
        </div>
      )}
      {imported && (
        <div className="notice good mb-md" role="status" data-testid="import-result">
          Payout {imported} imported: {one(sp.parcels)} parcels, {one(sp.matched)} matched, {one(sp.short)} paid short
          {Number(one(sp.shortfall)) > 0 ? ` (${taka(Number(one(sp.shortfall)))} in total)` : ""}, {one(sp.returned)} returned.
          {Number(one(sp.unmatched)) > 0 && ` ${one(sp.unmatched)} rows did not match any of your parcels.`}
          {Number(one(sp.dup)) > 0 && ` ${one(sp.dup)} rows were already settled and skipped.`}
        </div>
      )}
      {done === "accepted" && <div className="notice good mb-md" role="status">Variance accepted and marked as matched.</div>}
      {done === "disputed" && <div className="notice good mb-md" role="status">Dispute note recorded on order and audit ledger.</div>}
      {done === "batch_accepted" && (
        <div className="notice good mb-md" role="status">
          Batch accepted {one(sp.count)} parcels ({taka(Number(one(sp.amount) ?? 0))} shortfall cleared).
        </div>
      )}
      {done === "deposit_verified" && <div className="notice good mb-md" role="status">Deposit confirmed and marked Bank Verified.</div>}
      {done === "settings_saved" && <div className="notice good mb-md" role="status">Courier rate cards, auto-tolerance threshold, and restock guard saved.</div>}
      {done === "synced" && (
        <div className="notice good mb-md" role="status">
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
      <nav className="tabs mt-md" aria-label="COD sections" data-testid="cod-tabs">
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
          <div className="flex-between flex-wrap gap-sm mt-xs">
            <nav className="tabs mb-0" aria-label="Courier">
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
            <div className="flex-center-y flex-wrap gap-sm">
              <a
                href={`/api/finance/cod/dispute-sheet${courier ? `?courier=${courier}` : ""}`}
                download
                className="btn btn-secondary btn-sm"
                title="Download CSV of all flagged discrepancies formatted for courier managers"
              >
                Download Dispute Sheet (CSV)
              </a>
              {canEdit && (
                <form action={batchAcceptAction} className="d-inline">
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

          <nav className="tabs mt-xs" aria-label="Filter">
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

          <p className="muted text-xs mt-md">
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
        <section className="card stack mt-sm">
          <div className="flex-between flex-wrap gap-sm">
            <div>
              <h2>Remittance Invoices & Treasury Clearing</h2>
              <p className="muted text-sm mt-xs">
                Track payout invoices disbursed by couriers. Enter your bank statement UTR or bKash TrxID to clear remittances and export accounting journals.
              </p>
            </div>
          </div>

          {payouts.length === 0 ? (
            <p className="muted">No payout statements imported yet.</p>
          ) : (
            <table className="table" data-testid="payouts-table">
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
                      <div className="muted text-xs">
                        {COURIERS[p.courier] ?? p.courier} · {dateOnly(p.disbursedAt)}
                      </div>
                      <div className="muted text-xs">
                        {p.paymentMethod === "BKASH_COMMERCIAL" ? "bKash" : "Bank Transfer"}
                        {p.bankAccountLast4 ? ` (…${p.bankAccountLast4})` : ""}
                      </div>
                    </td>
                    <td>
                      <span className={`pill ${p.source === "API_SYNC" ? "ok" : "grey"} text-xs`}>
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
                          <span className="pill ok text-xs">
                            Bank Verified
                          </span>
                          <div className="text-xs mt-xs">
                            Ref: <code>{p.bankTxnRef}</code>
                          </div>
                          <div className="muted text-xs">
                            {p.verifiedBy} on {dateOnly(p.verifiedAt)}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="pill warn text-xs">
                            In-Transit (Awaiting Bank)
                          </span>
                          {canEdit && (
                            <details className="mt-xs">
                              <summary className="link text-xs cursor-pointer">
                                Enter Bank UTR
                              </summary>
                              <form action={verifyDepositAction} className="flex-center-y gap-xs mt-xs">
                                <input type="hidden" name="settlementId" value={p.id} />
                                <input
                                  className="input input-sm max-w-300"
                                  name="bankTxnRef"
                                  required
                                  minLength={3}
                                  placeholder="Bank UTR / TrxID"
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
                        Journal CSV
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
        <div className="grid-2 gap-lg mt-sm">
          {/* Live Courier API Sync Status */}
          <div className="card stack">
            <h2>Automated Courier API & Webhooks</h2>
            <p className="muted text-sm">
              Live remittance intake from courier portals. When payouts are released, remittances auto-sync into your ledger.
            </p>

            <div className="stack gap-sm mt-xs">
              {["STEADFAST", "PATHAO"].map((provKey) => {
                const conn = connectedCouriers.find((c) => c.provider === provKey);
                return (
                  <div
                    key={provKey}
                    className="card-panel-muted"
                  >
                    <div className="flex-between flex-center-y">
                      <b>{COURIERS[provKey]} Courier</b>
                      {conn ? (
                        <span className="pill ok text-xs">
                          Connected ({conn.mode})
                        </span>
                      ) : (
                        <span className="pill warn text-xs">
                          Not Configured
                        </span>
                      )}
                    </div>
                    <p className="muted text-xs mt-xs">
                      {conn
                        ? `Live remittance sync enabled. Automated webhooks listen for payment disbursements.`
                        : `API keys missing. Add keys in Settings → Integrations to enable automated remittance polling.`}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-xs">
              <form action={syncNowAction}>
                <SubmitButton className="btn btn-secondary" pending="Syncing couriers…">
                  Trigger Courier Status Sweep
                </SubmitButton>
              </form>
            </div>
          </div>

          {/* Statement File Import Form */}
          {canEdit && (
            <form action={importAction} className="card stack" data-testid="import-form">
              <h2>Import a Courier Statement (CSV)</h2>
              <p className="muted text-sm">
                Download the payout CSV from your courier merchant portal. We automatically detect column headers, match consignment IDs, and calculate discrepancies.
              </p>
              <div className="row-2">
                <label className="field mb-0">
                  <span className="label">Courier</span>
                  <select className="select" name="courier">
                    {COURIER_PROVIDERS.map((c) => (
                      <option key={c} value={c}>
                        {COURIERS[c]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field mb-0">
                  <span className="label">Payout invoice number</span>
                  <input className="input" name="invoiceNumber" required maxLength={60} placeholder="e.g. INV-SF-1082" />
                </label>
              </div>
              <div className="row-3">
                <label className="field mb-0">
                  <span className="label">Paid on</span>
                  <input className="input" name="disbursedAt" type="date" required defaultValue={today} max={today} />
                </label>
                <label className="field mb-0">
                  <span className="label">Paid into</span>
                  <select className="select" name="paymentMethod">
                    <option value="BEFTN_BANK">Bank account</option>
                    <option value="BKASH_COMMERCIAL">bKash Merchant</option>
                  </select>
                </label>
                <label className="field mb-0">
                  <span className="label">
                    Last 4 digits <span className="opt">(optional)</span>
                  </span>
                  <input className="input" name="last4" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="1234" />
                </label>
              </div>
              <label className="field mb-0">
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
        <div className="max-w-640 mt-sm">
          <form action={saveSettingsAction} className="card stack">
            <h2>Courier Rate Cards & Tolerance Settings</h2>
            <p className="muted text-sm">
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
            <p className="muted text-xs">
              Variances equal to or less than ৳{rates.toleranceAmount} (such as minor courier weight surcharges or rounding) are automatically accepted as Matched without blocking the parcel.
            </p>

            <div className="field mt-sm">
              <span className="label">Return Parcel Restock Guard</span>
              <p className="muted text-xs mb-xs">
                Controls whether shelf inventory increments automatically when a courier marks a parcel RETURNED.
              </p>
              <label className="check-label mb-xs">
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
              <label className="check-label">
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
              <div className="mt-sm">
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
