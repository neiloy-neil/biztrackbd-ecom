import type { Metadata } from "next";
import Link from "next/link";
import { listPublicPlans } from "@biztrackbd/core";
import { planBullets, taka } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pricing", description: "Simple monthly plans in taka. 14 days free, no card, no commission on your sales." };

export default async function Pricing() {
  const plans = await listPublicPlans();
  const best = plans.find((p) => p.tier === "PRO")?.tier;
  return (
    <section className="block">
      <div className="wrap">
        <span className="eyebrow">Pricing</span>
        <h1 style={{ fontSize: "clamp(32px, 6vw, 48px)", letterSpacing: "-1.2px", lineHeight: 1.1, fontWeight: 800 }}>Pay for your plan. Keep all your sales.</h1>
        <p className="sub">Every plan starts with 14 days free, no card. We charge a flat monthly price and take no commission. Pay by bKash or Nagad.</p>
        <div className="grid g3" data-testid="plans">
          {plans.map((p) => (
            <div key={p.tier} className={`card plan${p.tier === best ? " featured" : ""}`} data-testid={`plan-${p.tier}`}>
              {p.tier === best && <span className="pill" style={{ alignSelf: "flex-start", marginBottom: 8 }}>Most stores start here</span>}
              <h3>{p.name}</h3>
              <div className="price num">{taka(p.priceMonthly)}<small> / month</small></div>
              <p className="muted" style={{ fontSize: 14 }}>{taka(p.priceYearly)} a year{p.yearlyMonthsFree > 0 ? `, ${p.yearlyMonthsFree} months free` : ""}</p>
              <ul>{planBullets(p).map((b) => <li key={b}>{b}</li>)}</ul>
              <Link href={`/start?plan=${p.tier}`} className={`btn ${p.tier === best ? "btn-primary" : "btn-secondary"}`} prefetch={false}>Start free with {p.name}</Link>
            </div>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 24, fontSize: 14.5 }}>Order limits are soft: if you go a little over in a busy month, customers can still order and we ask you to upgrade. Product limits are firm. You can change plan at any time.</p>
      </div>
    </section>
  );
}
