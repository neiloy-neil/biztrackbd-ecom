import type { Metadata } from "next";
import { listPublicPlans, type PlanView } from "@biztrackbd/core";
import { PlanCards } from "@/components/plan-cards";
import { planBullets } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pricing", description: "Simple monthly plans in taka. 14 days free, no card, no commission on your sales." };

const lim = (v: number | null) => (v == null ? "Unlimited" : v.toLocaleString("en-IN"));
const yes = (v: unknown) => (v ? "Yes" : "No");

/** One row per thing that differs between plans, read from the Plan table so this page cannot disagree with the product. */
const ROWS: { label: string; of: (p: PlanView) => string }[] = [
  { label: "Products", of: (p) => lim(p.limits.products) },
  { label: "Orders a month", of: (p) => lim(p.limits.ordersPerMonth) },
  { label: "Staff accounts", of: (p) => lim(p.limits.staff) },
  { label: "SMS credits a month", of: (p) => lim(p.limits.smsCredits) },
  { label: "Photo storage", of: (p) => (p.limits.storageGb == null ? "Unlimited" : `${p.limits.storageGb} GB`) },
  { label: "Courier booking from the order", of: (p) => (p.features.courierBooking === "auto" ? "Yes" : "By hand") },
  { label: "Cross-store fraud and trust score", of: (p) => (p.features.fraud === "full" ? "Yes" : "Basic") },
  { label: "Your own domain", of: (p) => yes(p.features.customDomain) },
];

export default async function Pricing() {
  const plans = await listPublicPlans();
  const best = plans.find((p) => p.tier === "PRO")?.tier;
  return (
    <section className="block">
      <div className="wrap">
        <div style={{ textAlign: "center" }}>
          <span className="eyebrow">Pricing</span>
          <h1 style={{ fontSize: "clamp(32px, 6vw, 48px)", letterSpacing: "-1.2px", lineHeight: 1.1, fontWeight: 800 }}>Pay for your plan. Keep all your sales.</h1>
          <p className="sub" style={{ margin: "12px auto 0" }}>Every plan starts with 14 days free, no card. We charge a flat monthly price and take no commission. Pay by bKash or Nagad.</p>
        </div>
        <div style={{ marginTop: 28 }}>
          <PlanCards plans={plans.map((p) => ({ tier: p.tier, name: p.name, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly, monthsFree: p.yearlyMonthsFree, bullets: planBullets(p) }))} best={best} />
        </div>

        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.5px", margin: "56px 0 16px" }}>Compare plans</h2>
        <div className="table-wrap" data-testid="compare" tabIndex={0} role="region" aria-label="Plan comparison">
          <table className="compare">
            <thead>
              <tr><th scope="col">Feature</th>{plans.map((p) => <th scope="col" key={p.tier} className={p.tier === best ? "best" : ""}>{p.name}</th>)}</tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.label}><th scope="row">{r.label}</th>{plans.map((p) => <td key={p.tier} className={p.tier === best ? "best" : ""}>{r.of(p)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pay-panel">
          <div>
            <h2>Pay the way that suits you</h2>
            <p>Send your plan price by bKash or Nagad, enter the transaction ID, and we switch your plan on after we check it, usually within a few hours.</p>
          </div>
          <div className="pay-chips" aria-label="Payment methods"><span className="chip-bkash">bKash</span><span className="chip-nagad">Nagad</span></div>
        </div>
        <p className="muted" style={{ marginTop: 20, fontSize: 14.5 }}>Order limits are soft: if you go a little over in a busy month, customers can still order and we ask you to upgrade. Product limits are firm. You can change plan at any time.</p>
      </div>
    </section>
  );
}
