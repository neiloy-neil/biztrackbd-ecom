"use client";

import Link from "next/link";
import { useState } from "react";

export interface PlanCardData {
  tier: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  monthsFree: number;
  bullets: string[];
}

const taka = (n: number) => `৳ ${n.toLocaleString("en-IN")}`;

/** The plan cards with a Monthly or Yearly choice. The first view is monthly, which is what the page shows without scripts. */
export function PlanCards({ plans, best, compactBullets }: { plans: PlanCardData[]; best?: string; compactBullets?: number }) {
  const [yearly, setYearly] = useState(false);
  const free = Math.max(0, ...plans.map((p) => p.monthsFree));
  return (
    <>
      <div className="billing-toggle" role="group" aria-label="Billing period">
        <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
        <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly{free > 0 && <span className="pill live">{free} months free</span>}</button>
      </div>
      <div className="grid g3" data-testid="plans">
        {plans.map((p) => (
          <div key={p.tier} className={`card plan${p.tier === best ? " featured" : ""}`} data-testid={`plan-${p.tier}`}>
            {p.tier === best && <span className="pill" style={{ alignSelf: "flex-start", marginBottom: 8 }}>Most stores start here</span>}
            <h3>{p.name}</h3>
            <div className="price num">{taka(yearly ? Math.round(p.priceYearly / 12) : p.priceMonthly)}<small> / month</small></div>
            <p className="muted" style={{ fontSize: 14 }}>{yearly ? `${taka(p.priceYearly)} billed once a year` : `${taka(p.priceYearly)} a year${p.monthsFree > 0 ? `, ${p.monthsFree} months free` : ""}`}</p>
            <ul>{(compactBullets ? p.bullets.slice(0, compactBullets) : p.bullets).map((b) => <li key={b}>{b}</li>)}</ul>
            <Link href={`/start?plan=${p.tier}`} className={`btn ${p.tier === best ? "btn-primary" : "btn-secondary"}`} prefetch={false}>Start free with {p.name}</Link>
          </div>
        ))}
      </div>
    </>
  );
}
