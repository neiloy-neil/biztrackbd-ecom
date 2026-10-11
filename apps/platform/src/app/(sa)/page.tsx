import type { Metadata } from "next";
import Link from "next/link";
import { getOverview } from "@biztrackbd/core";
import { taka } from "@/lib/format";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Overview" };

export default async function Overview() {
  const s = await requireAccess("tenants");
  const o = await getOverview(s.actor);
  const max = Math.max(1, ...o.signups.map((d) => d.count));
  const label = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  return (
    <>
      <div className="page-head"><h1>Overview</h1></div>
      <div className="grid grid-4" data-testid="sa-stats">
        <div className="stat"><div className="k">Monthly revenue (MRR)</div><div className="v num" data-testid="mrr">{taka(o.mrr)}</div><div className="d">Yearly {taka(o.arr)}</div></div>
        <div className="stat"><div className="k">Paying stores</div><div className="v num" data-testid="paying">{o.payingStores}</div><div className="d">{o.byPlan.map((p) => `${p.stores} ${p.tier.toLowerCase()}`).join(" · ") || "None yet"}</div></div>
        <div className="stat"><div className="k">Active trials</div><div className="v num" data-testid="trials">{o.activeTrials}</div><div className="d">{o.trialToPaidPercent == null ? "No finished trials yet" : `${o.trialToPaidPercent}% of finished trials paid`}</div></div>
        <div className="stat"><div className="k">Churn, 30 days</div><div className="v num">{o.churnPercent == null ? "—" : `${o.churnPercent}%`}</div><div className="d">{o.pastDue} overdue · {o.readOnlyOrLocked} read-only or locked</div></div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 14 }}>
        <section className="card">
          <div className="card-head"><h2>Needs you</h2></div>
          <dl className="kv">
            <dt>Payments to check</dt><dd><Link href="/payments" className="link" prefetch={false} data-testid="pending-count">{o.pendingPayments.count}</Link>{o.pendingPayments.count > 0 ? ` (${taka(o.pendingPayments.amount)})` : ""}</dd>
            <dt>Stores flagged for review</dt><dd><Link href="/tenants?filter=flagged" className="link" prefetch={false}>{o.quarantined}</Link></dd>
            <dt>Overdue stores</dt><dd><Link href="/tenants?filter=overdue" className="link" prefetch={false}>{o.pastDue}</Link></dd>
          </dl>
        </section>
        <section className="card">
          <div className="card-head"><h2>New stores, 14 days</h2></div>
          <div className="bars" style={{ height: 110 }} role="img" aria-label={`Signups per day, ${o.signups.reduce((n, d) => n + d.count, 0)} in total`}>
            {o.signups.map((d, i) => (
              <div className="bar" key={d.date} title={`${label(d.date)}: ${d.count}`}>
                <i style={{ height: `${Math.max(2, Math.round((d.count / max) * 100))}%` }} />
                {i % 3 === 0 ? <span>{label(d.date)}</span> : <span aria-hidden="true">&nbsp;</span>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
