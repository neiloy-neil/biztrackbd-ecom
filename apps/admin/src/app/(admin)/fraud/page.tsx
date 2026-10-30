import type { Metadata } from "next";
import Link from "next/link";
import { TRUST_LABELS, can, getFraudOverview, listBlocked, listFlaggedOrders, lookupPhone, DomainError, type PhoneLookup } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { SubmitButton } from "@/components/ui";
import { dateOnly, prettyPhone, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { blockNumberAction, unblockNumberAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fraud check" };

const TABS = [["held", "Held for review"], ["watch", "Watch list"], ["blocked", "Blocked numbers"], ["check", "Check a number"]] as const;
type Tab = (typeof TABS)[number][0];

const SOURCE: Record<string, string> = { MANUAL: "Added by you", FRAUD_REVIEW: "From a risky order", REFUSED_PARCELS: "Refused parcels" };

function RiskPill({ level, score }: { level: string; score: number }) {
  return <span className={`pill ${level === "HIGH" ? "bad" : level === "MEDIUM" ? "warn" : "ok"}`}>{level === "HIGH" ? "High risk" : level === "MEDIUM" ? "Medium" : "Trusted"} · {score}</span>;
}

function LookupResult({ r }: { r: PhoneLookup }) {
  const n = r.network;
  const c = r.courier;
  const cd = r.courierDetails;

  const courierList = cd ? [
    { name: "Steadfast", stats: cd.response?.steadfast, color: "#059669" },
    { name: "Pathao", stats: cd.response?.pathao, color: "#DC2626" },
    { name: "RedX", stats: cd.response?.redx, color: "#EA580C" },
    { name: "CarryBee", stats: cd.response?.carrybee, color: "#2563EB" },
    { name: "Paperfly", stats: cd.response?.paperfly, color: "#4F46E5" },
  ] : [];

  return (
    <section className="card" data-testid="lookup-result" style={{ marginTop: 14 }}>
      <div className="card-head">
        <h2>{prettyPhone(r.phone)}</h2>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {r.unifiedScore != null && (
            <span className={`pill ${r.unifiedLevel === "HIGH" ? "bad" : r.unifiedLevel === "MEDIUM" ? "warn" : "ok"}`}>
              Score: {r.unifiedScore}/100 ({r.unifiedLevel === "HIGH" ? "High risk" : r.unifiedLevel === "MEDIUM" ? "Medium" : "Low risk"})
            </span>
          )}
          <span className={`pill ${n.level === "HIGH" ? "bad" : n.level === "MEDIUM" ? "warn" : n.level === "TRUSTED" ? "ok" : "grey"}`}>
            Network: {TRUST_LABELS[n.level]}{n.score != null ? ` · ${n.score}` : ""}
          </span>
        </div>
      </div>
      <dl className="kv">
        <dt>Across all stores</dt>
        <dd>
          {n.level === "NEW"
            ? "No parcels sent to this number yet"
            : `${n.delivered} delivered, ${n.failed} came back${n.refused ? `, ${n.refused} refused in the last 60 days` : ""}${n.stores > 1 ? ` (${n.stores} stores)` : ""}`}
        </dd>
        <dt>In your store</dt>
        <dd>
          {r.here.orders} orders · {r.here.delivered} delivered · {r.here.returned} returned · {r.here.cancelled} cancelled
        </dd>
        {c && (
          <>
            <dt>5-Courier Record</dt>
            <dd>
              <strong>{c.totalParcels}</strong> parcels · <strong style={{ color: "#15803D" }}>{c.deliveredParcels}</strong> delivered ({c.successRatio}% success) · <strong style={{ color: "#DC2626" }}>{c.cancelledParcels}</strong> returned/cancelled
            </dd>
          </>
        )}
        <dt>Your blocklist</dt>
        <dd>{r.blocked ? "Blocked" : "Not blocked"}</dd>
      </dl>

      {/* 5-Courier Network Breakdown Grid if available */}
      {cd && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line, #E2E8F0)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>5-Courier Delivery Breakdown</h3>
            <span style={{ fontSize: 12, color: "#64748B" }}>Steadfast, Pathao, RedX, CarryBee, Paperfly</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
            {courierList.map((item) => {
              const s = item.stats;
              const hasData = s && s.status && s.data.total > 0;
              return (
                <div
                  key={item.name}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: hasData ? "#F8FAFC" : "transparent",
                    border: "1px solid #E2E8F0",
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: item.color, marginBottom: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, display: "inline-block" }} />
                    {item.name}
                  </div>
                  {hasData ? (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{s.data.deliveredPercentage}%</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>
                        {s.data.success}/{s.data.total} delivered
                      </div>
                    </div>
                  ) : (
                    <div className="muted" style={{ fontSize: 12 }}>No record</div>
                  )}
                </div>
              );
            })}
          </div>

          {cd.community_reports && cd.community_reports.length > 0 && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, color: "#991B1B" }}>
              <strong>Caution ({cd.community_reports.length} report):</strong> {cd.community_reports[0]?.details || "Reported for refused delivery by online merchants."}
            </div>
          )}
        </div>
      )}

      <p className="muted" style={{ marginTop: 12, fontSize: 13.5 }}>
        {n.level === "HIGH" || r.unifiedLevel === "HIGH"
          ? "Pause booking. Ask for ৳100 in advance by bKash."
          : n.level === "MEDIUM" || r.unifiedLevel === "MEDIUM"
            ? "Call the customer or send a confirmation message before packing."
            : n.level === "TRUSTED"
              ? "Safe to pack and ship cash on delivery."
              : "Normal processing. Check the address is complete."}
      </p>
      <p className="muted" style={{ fontSize: 12.5 }}>Only counts are shared between stores. Other stores' customers, addresses and items are never shown.</p>
    </section>
  );
}

export default async function Fraud({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("orders");
  const tab = (TABS.find((t) => t[0] === one(sp.tab))?.[0] ?? "held") as Tab;
  const canBlock = can(s.user.role, "customers", "edit");
  const overview = await getFraudOverview(s.tenantId, s.actor);
  const flagged = tab === "held" || tab === "watch" ? await listFlaggedOrders(s.tenantId, s.actor, tab) : [];
  const blocked = tab === "blocked" ? await listBlocked(s.tenantId, s.actor) : [];
  const phone = one(sp.phone)?.trim();
  let lookup: PhoneLookup | null = null;
  let lookupError: string | null = null;
  if (tab === "check" && phone) {
    try {
      lookup = await lookupPhone(s.tenantId, s.actor, phone);
    } catch (e) {
      if (e instanceof DomainError) lookupError = e.message;
      else throw e;
    }
  }
  const err = one(sp.err);
  const done = one(sp.done);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Fraud check" }]}
        title="Fraud check"
        sub="Screen risky COD buyer numbers, check delivery histories across Bangladesh, and manage blocked numbers."
      />

      <div className="grid grid-4" data-testid="fraud-stats">
        <div className="stat"><div className="k">Held for review</div><div className="v num" data-testid="stat-held">{overview.held}</div></div>
        <div className="stat"><div className="k">Risky orders, 30 days</div><div className="v num">{overview.flaggedThisMonth}</div></div>
        <div className="stat"><div className="k">Blocked numbers</div><div className="v num">{overview.blockedNumbers}</div></div>
        <div className="stat"><div className="k">Cash orders stopped, 30 days</div><div className="v num">{taka(overview.valueStopped)}</div></div>
      </div>

      <nav className="tabs" aria-label="Fraud views" style={{ marginTop: 14 }}>
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/fraud?tab=${k}`} aria-current={k === tab ? "page" : undefined} prefetch={false}>
            {l}{k === "held" && <span className={`n${overview.held > 0 ? " alert" : ""}`}>{overview.held}</span>}
          </Link>
        ))}
      </nav>

      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {done && <div className="notice good" role="status" style={{ marginBottom: 12 }}>{done === "blocked" ? "Number blocked." : "Number unblocked."}</div>}

      {(tab === "held" || tab === "watch") && (
        flagged.length === 0 ? (
          <div className="card empty" data-testid="fraud-empty">{tab === "held" ? "Nothing is waiting. Every order has a clear record." : "No open orders with a medium or high risk score."}</div>
        ) : (
          <table className="table" data-testid="flagged-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Risk</th><th>Why</th><th className="r">Total</th></tr></thead>
            <tbody>
              {flagged.map((o) => (
                <tr key={o.id} data-testid="flagged-row">
                  <td><Link href={`/orders/${o.id}`} className="link" prefetch={false}>{o.orderNumber}</Link><div className="muted" style={{ fontSize: 12.5 }}>{o.paymentMethod === "COD" ? "Cash on delivery" : "Prepaid"}</div></td>
                  <td>{o.customerName}<div className="muted" style={{ fontSize: 12.5 }}>{prettyPhone(o.customerPhone)} · {o.district}</div></td>
                  <td><RiskPill level={o.level} score={o.score} />{o.held && <div className="pill bad" style={{ marginTop: 4 }}>Held</div>}</td>
                  <td>{o.flags.length === 0 ? <span className="muted">Score only</span> : o.flags.map((f) => <div key={f.code} style={{ fontSize: 13.5 }}>{f.label}</div>)}</td>
                  <td className="r num">{taka(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === "blocked" && (
        <>
          {canBlock && (
            <form action={blockNumberAction} className="card stack" style={{ marginBottom: 14 }} data-testid="block-form">
              <h2>Block a number</h2>
              <div className="row-2">
                <label className="field" style={{ marginBottom: 0 }}><span className="label">Mobile number</span><input className="input" name="phone" inputMode="tel" required placeholder="01712345678" /></label>
                <label className="field" style={{ marginBottom: 0 }}><span className="label">Reason</span><input className="input" name="reason" required minLength={3} maxLength={150} placeholder="Refused 3 parcels" /></label>
              </div>
              <div><SubmitButton className="btn btn-danger" pending="Blocking…">Block number</SubmitButton></div>
              <p className="muted" style={{ fontSize: 13 }}>They will not be able to place orders in your store, and are not told why. Other stores are not affected.</p>
            </form>
          )}
          {blocked.length === 0 ? <div className="card empty">No blocked numbers.</div> : (
            <table className="table" data-testid="blocked-table">
              <thead><tr><th>Number</th><th>Reason</th><th>Added</th>{canBlock && <th></th>}</tr></thead>
              <tbody>
                {blocked.map((b) => (
                  <tr key={b.id}>
                    <td className="num">{prettyPhone(b.phone)}</td>
                    <td>{b.reason}<div className="muted" style={{ fontSize: 12.5 }}>{SOURCE[b.source] ?? b.source}</div></td>
                    <td className="muted">{dateOnly(b.createdAt)}</td>
                    {canBlock && <td><form action={unblockNumberAction.bind(null, b.id)}><SubmitButton className="btn btn-secondary btn-sm" pending="…">Unblock</SubmitButton></form></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {tab === "check" && (
        <>
          <form method="get" className="card stack" data-testid="check-form">
            <input type="hidden" name="tab" value="check" />
            <label className="field" style={{ marginBottom: 0 }}><span className="label">Customer's mobile number</span><input className="input" name="phone" inputMode="tel" defaultValue={phone ?? ""} placeholder="01712345678" required /></label>
            <div><button className="btn btn-primary" type="submit">Check</button></div>
          </form>
          {lookupError && <div className="notice bad" role="alert" style={{ marginTop: 12 }}>{lookupError}</div>}
          {lookup && <LookupResult r={lookup} />}
        </>
      )}
    </>
  );
}
