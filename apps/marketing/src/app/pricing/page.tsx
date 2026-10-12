import type { Metadata } from "next";
import { listPublicPlans, type PlanView } from "@biztrackbd/core";
import { PlanCards } from "@/components/plan-cards";
import { demoAdminUrl } from "@/lib/demo-admin";
import { planBullets } from "@/lib/plans";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing Plans: Transparent Taka Pricing with 0% Commission",
  description:
    "Honest monthly plans in Bangladeshi Taka. 14 days free trial, no credit card required, 0% commission on your sales. Pay via bKash or Nagad.",
};

const lim = (v: number | null) => (v == null ? "Unlimited" : v.toLocaleString("en-IN"));
const yes = (v: unknown) => (v ? "Yes" : "No");

/** One row per feature that differs between plans, verified directly against the core schema. */
const ROWS: { label: string; of: (p: PlanView) => string }[] = [
  { label: "Products", of: (p) => lim(p.limits.products) },
  { label: "Orders a month", of: (p) => lim(p.limits.ordersPerMonth) },
  { label: "Staff accounts", of: (p) => lim(p.limits.staff) },
  { label: "Sales commission", of: () => "0%" },
  { label: "Courier booking from the order", of: (p) => (p.features.courierBooking === "auto" ? "1-click automated" : "By hand") },
  { label: "COD return fraud protection", of: (p) => (p.features.fraud === "full" ? "Full cross-store score" : "Basic check") },
  { label: "Your own custom domain", of: (p) => (p.features.customDomain ? "Included (free SSL)" : "Subdomain only") },
  { label: "SMS credits a month", of: (p) => (p.limits.smsCredits ? `${p.limits.smsCredits.toLocaleString("en-IN")} free` : "Pay as you go") },
  { label: "Photo storage", of: (p) => (p.limits.storageGb == null ? "Unlimited" : `${p.limits.storageGb} GB`) },
];

export default async function Pricing() {
  const plans = await listPublicPlans();
  const best = plans.find((p) => p.tier === "PRO")?.tier;

  return (
    <section className="block">
      <div className="wrap">
        <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
          <span className="eyebrow">Honest Pricing</span>
          <h1 style={{ fontSize: "clamp(34px, 5.5vw, 52px)", letterSpacing: "-1.3px", lineHeight: 1.1, fontWeight: 800 }}>
            Simple monthly pricing in taka
          </h1>
          <p className="lead" style={{ margin: "16px auto 0", fontSize: 18, color: "var(--ink-2)", lineHeight: 1.6 }}>
            Every plan starts with a 14-day free trial. No setup fee, no dollar cards, and 0% commission on your sales.
          </p>
        </div>

        <div style={{ marginTop: 36, textAlign: "center" }}>
          <PlanCards
            plans={plans.map((p) => ({
              tier: p.tier,
              name: p.name,
              priceMonthly: p.priceMonthly,
              priceYearly: p.priceYearly,
              monthsFree: p.yearlyMonthsFree,
              bullets: planBullets(p),
            }))}
            best={best}
          />
        </div>

        <p className="fine" style={{ textAlign: "center", marginTop: 28, fontSize: 14.5 }}>
          Not sure yet?{" "}
          <a href={demoAdminUrl()} className="link" data-testid="pricing-demo-admin" style={{ fontWeight: 600 }}>
            Try the admin desk first, with no signup
          </a>
          .
        </p>

        {/* Comparison Table */}
        <div style={{ marginTop: 64 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.6px", marginBottom: 20 }}>
            Compare plan features
          </h2>
          <div className="table-wrap" data-testid="compare" tabIndex={0} role="region" aria-label="Plan comparison">
            <table className="compare">
              <thead>
                <tr>
                  <th scope="col" style={{ width: "34%" }}>Feature</th>
                  {plans.map((p) => (
                    <th scope="col" key={p.tier} className={p.tier === best ? "best" : ""}>
                      {p.name}
                      {p.tier === best && (
                        <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: "var(--brand)" }}>
                          MOST CHOSEN
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    {plans.map((p) => (
                      <td key={p.tier} className={p.tier === best ? "best" : ""}>
                        {r.of(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Methods Banner matching MktPricing.dc.html */}
        <div className="pay-panel">
          <div style={{ flex: "1 1 340px" }}>
            <h2>Pay the way that suits you</h2>
            <p>
              Pay monthly or yearly via bKash, Nagad, Visa, Mastercard, or local bank transfer. Enter your transaction ID or pay directly online. Your account is activated instantly.
            </p>
          </div>
          <div className="pay-chips" aria-label="Payment methods">
            <span className="chip-bkash">bKash</span>
            <span className="chip-nagad">Nagad</span>
            <span className="chip-card">Visa · Mastercard</span>
            <span className="chip-card">Bank Transfer</span>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 24, fontSize: 14, lineHeight: 1.6 }}>
          * Order limits are soft: if you experience a sales surge in a busy Eid or wedding season, customer checkouts are never blocked. We will simply invite you to upgrade before your next cycle. Product limits are firm. You can upgrade, downgrade, or pause anytime.
        </p>
      </div>
    </section>
  );
}
