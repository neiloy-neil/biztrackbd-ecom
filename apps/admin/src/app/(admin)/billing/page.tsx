import Link from "next/link";
import { DemoLocked } from "@/components/demo-locked";
import { trialHref } from "@/lib/demo";
import type { Metadata } from "next";
import { ACCESS_LABELS, getBillingOverview } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateOnly, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { PageHeader } from "@biztrackbd/ui";
import { Meter, limitNote } from "@/lib/usage";
import { cancelProofAction } from "./actions";
import { PayForm } from "./pay-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plan and usage" };

const PROOF: Record<string, [string, string]> = { PENDING: ["Waiting to be checked", "warn"], APPROVED: ["Approved", "ok"], REJECTED: ["Not accepted", "bad"] };
const TIER: Record<string, string> = { STARTER: "Starter", PRO: "Pro", BUSINESS: "Business" };

export default async function Billing({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("billing");
  if (s.demo) return <DemoLocked what="Plan and billing" keepHref={trialHref(s.demo.keep)} />;
  const b = await getBillingOverview(s.tenantId, s.actor);
  const a = b.access;
  const notes = [limitNote("products", b.usage.products), limitNote("orders", b.usage.orders)].filter(Boolean);
  const suggested = b.plans.find((p) => p.tier === b.tier)?.tier ?? b.plans[0]!.tier;
  const isUnlimited = a.daysLeft === null && a.paidThrough.getUTCFullYear() >= 2099;
  const status =
    a.state === "TRIAL" ? `Free trial, ${a.daysLeft} ${a.daysLeft === 1 ? "day" : "days"} left (ends ${dateOnly(a.paidThrough)})`
    : a.state === "ACTIVE" ? (isUnlimited ? "Active (Unlimited Demo)" : `Active until ${dateOnly(a.paidThrough)}`)
    : a.state === "GRACE" ? `Payment overdue by ${a.overdueDays} ${a.overdueDays === 1 ? "day" : "days"}. Your store goes offline in ${4 - (a.overdueDays ?? 0)} days`
    : a.state === "READ_ONLY" ? "Store offline and admin read-only until you pay"
    : a.suspendedByPlatform ? "Your store has been switched off by BizTrackBD. Please contact support." : "Store locked until you pay";
  const summary = (p: (typeof b.plans)[number]) =>
    `${p.limits.products == null ? "Unlimited" : p.limits.products.toLocaleString("en-IN")} products, ${p.limits.ordersPerMonth == null ? "unlimited" : p.limits.ordersPerMonth.toLocaleString("en-IN")} orders a month, ${p.limits.staff ?? "unlimited"} staff${p.features.courierBooking === "auto" ? ", courier booking" : ""}${p.features.customDomain ? ", your own domain" : ""}`;

  return (
    <>
      <PageHeader
        title="Plan & Billing"
        crumbs={[{ label: "Home", href: "/" }, { label: "Billing" }]}
        sub={status}
      />
      {one(sp.success) && (
        <div className="notice good" role="status" style={{ marginBottom: 12 }} data-testid="payment-success">
          Payment confirmed! Your {TIER[String(one(sp.plan) ?? "").toUpperCase()] ?? one(sp.plan) ?? ""} plan is now active.
        </div>
      )}
      {one(sp.sent) && <div className="notice good" role="status" style={{ marginBottom: 12 }} data-testid="proof-sent">Thank you. We will check your payment and switch your plan on.</div>}
      {one(sp.cancelled) && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Payment details removed. You can send them again.</div>}
      {one(sp.err) && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{one(sp.err)}</div>}

      <section className="card" data-testid="plan-status">
        <div className="card-head">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2>{TIER[b.tier] ?? b.tier} plan</h2>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 6,
                backgroundColor: b.siteMode === "PORTFOLIO" ? "rgba(249,115,22,0.12)" : b.siteMode === "HYBRID" ? "rgba(99,102,241,0.12)" : "rgba(16,185,129,0.12)",
                color: b.siteMode === "PORTFOLIO" ? "#ea580c" : b.siteMode === "HYBRID" ? "#6366f1" : "#059669",
              }}
            >
              {b.siteMode === "PORTFOLIO" ? "Business & Dining Plan" : b.siteMode === "HYBRID" ? "Hybrid Dual-Engine Plan" : "Online Store Plan"}
            </span>
          </div>
          <span className={`pill ${a.state === "ACTIVE" || a.state === "TRIAL" ? "ok" : a.state === "GRACE" ? "warn" : "bad"}`} data-testid="access-state">{ACCESS_LABELS[a.state]}</span>
        </div>
        <p style={{ margin: 0 }} data-testid="plan-status-text">{status}</p>
        {b.subscription && b.subscription.amount > 0 && <p className="muted" style={{ margin: "6px 0 0", fontSize: 13.5 }}>Last payment {taka(b.subscription.amount)} for {b.subscription.interval === "YEARLY" ? "a year" : "a month"}.</p>}

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border, #eee)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 13 }}>
          <span className="muted">
            Need to change between Business Website, Online Store, or Hybrid?
          </span>
          <Link href="/settings/mode" className="btn btn-secondary btn-sm" prefetch={false}>
            Configure Operating Mode →
          </Link>
        </div>
      </section>

      {notes.map((n) => <div key={n} className="notice" style={{ marginTop: 12 }}>{n}</div>)}
      <section className="card" style={{ marginTop: 14 }}>
        <Meter label="Products" usage={b.usage.products} />
        <Meter label="Orders this month" usage={b.usage.orders} />
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h2>{a.state === "ACTIVE" ? "Renew or change your plan" : "Choose a plan and pay"}</h2>
        {b.pending ? (
          <div className="stack" data-testid="pending-proof">
            <div className="notice info">Waiting for us to check your {taka(b.pending.amount)} payment (TrxID <b>{b.pending.trxId}</b>) for the {TIER[b.pending.planTier]} plan. You can pay for a different plan only after this one is checked.</div>
            <form action={cancelProofAction.bind(null, b.pending.id)}><SubmitButton className="btn btn-secondary btn-sm" pending="…">I made a mistake. Remove it</SubmitButton></form>
          </div>
        ) : (
          <PayForm plans={b.plans.map((p) => ({ tier: p.tier, name: p.name, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly, yearlyMonthsFree: p.yearlyMonthsFree, summary: summary(p) }))} payTo={b.payTo} current={b.tier} suggested={suggested} />
        )}
      </section>

      <section style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Payments</h2>
        {b.proofs.length === 0 ? <div className="card empty">No payments yet.</div> : (
          <table className="table" data-testid="proofs-table">
            <thead><tr><th>Sent</th><th>Plan</th><th className="r">Amount</th><th>Result</th></tr></thead>
            <tbody>
              {b.proofs.map((p) => {
                const [label, tone] = PROOF[p.status] ?? [p.status, "grey"];
                return (
                  <tr key={p.id}>
                    <td>{dateOnly(p.createdAt)}<div className="muted" style={{ fontSize: 12.5 }}>{p.provider === "BKASH" ? "bKash" : p.provider === "NAGAD" ? "Nagad" : p.provider} · {p.trxId}</div></td>
                    <td>{TIER[p.planTier] ?? p.planTier}<div className="muted" style={{ fontSize: 12.5 }}>{p.interval === "YEARLY" ? "1 year" : "1 month"}</div></td>
                    <td className="r num">{taka(p.amount)}</td>
                    <td><span className={`pill ${tone}`}>{label}</span>{p.rejectionReason && <div className="err" style={{ fontSize: 12.5 }}>{p.rejectionReason}</div>}{p.appliedTo && <div className="muted" style={{ fontSize: 12.5 }}>Paid until {dateOnly(p.appliedTo)}</div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
