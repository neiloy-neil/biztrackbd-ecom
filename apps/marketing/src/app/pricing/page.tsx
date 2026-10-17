import type { Metadata } from "next";
import { listPublicPlans, listPublicPortfolioPlans, type PlanView } from "@biztrackbd/core";
import { PricingView, type ComparisonRow } from "./pricing-view";
import { planBullets, portfolioPlanBullets } from "@/lib/plans";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing Plans: Transparent Taka Pricing with 0% Commission",
  description:
    "Honest monthly plans in Bangladeshi Taka. 14 days free trial, no credit card required, 0% commission on your sales. Pay via bKash or Nagad.",
  alternates: {
    canonical: `${siteUrl}/pricing`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/pricing`,
    siteName: "BizTrackBD",
    title: "Transparent Pricing Plans: 0% Commission in Bangladeshi Taka",
    description: "Flat BDT monthly plans for Commerce and Business. 14-day free trial, pay via bKash or Nagad.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "BizTrackBD Pricing" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Transparent Pricing Plans: 0% Commission in Bangladeshi Taka",
    description: "No dollar card needed. 0% sales commission, flat monthly pricing in Taka.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const lim = (v: number | null) => (v == null ? "Unlimited" : v.toLocaleString("en-IN"));

/** Features comparison for Online Store plans */
const STORE_ROWS_DEF: { label: string; of: (p: PlanView) => string }[] = [
  { label: "Operating Architecture", of: () => "COMMERCE (Full Retail e-Commerce)" },
  { label: "Mode Transition Guarantee", of: () => "Atomic toggle to HYBRID (100% data preserved)" },
  { label: "Products", of: (p) => lim(p.limits.products) },
  { label: "Orders a month", of: (p) => lim(p.limits.ordersPerMonth) },
  { label: "Staff accounts", of: (p) => lim(p.limits.staff) },
  { label: "Sales commission", of: () => "0%" },
  { label: "Courier booking from the order", of: (p) => (p.features.courierBooking === "auto" ? "1-click automated (Pathao, Steadfast, RedX)" : "By hand") },
  { label: "COD return fraud protection", of: (p) => (p.features.fraud === "full" ? "Full cross-store score" : "Basic check") },
  { label: "Your own custom domain", of: (p) => (p.features.customDomain ? "Included (free SSL)" : "Subdomain only") },
  { label: "SMS credits a month", of: (p) => (p.limits.smsCredits ? `${p.limits.smsCredits.toLocaleString("en-IN")} free` : "Pay as you go") },
  { label: "Photo storage", of: (p) => (p.limits.storageGb == null ? "Unlimited" : `${p.limits.storageGb} GB`) },
];

/** Features comparison for Business Website & Portfolio plans */
const PORTFOLIO_ROWS: ComparisonRow[] = [
  { label: "Operating Architecture", starter: "PORTFOLIO (Lead & Booking Engine)", pro: "PORTFOLIO or HYBRID (Dual Engine)", business: "PORTFOLIO or HYBRID (Enterprise Dual)" },
  { label: "Mode Transition Guarantee", starter: "100% Leads Retained (Zero Data Loss)", pro: "100% Leads Retained (Zero Data Loss)", business: "100% Leads Retained (Zero Data Loss)" },
  { label: "Your own custom domain", starter: "Included (free SSL)", pro: "Included (free SSL)", business: "Included (free SSL)" },
  { label: "Services & portfolio showcase", starter: "Up to 15 items", pro: "Unlimited", business: "Unlimited" },
  { label: "Digital downloads & lead magnets", starter: "Up to 5 files", pro: "Unlimited", business: "Unlimited" },
  { label: "Lead capture & WhatsApp alerts", starter: "Yes (direct inbox)", pro: "Yes (with smart routing)", business: "Yes (team dispatch)" },
  { label: "Online booking & reservations", starter: "Contact form only", pro: "Included (with SMS alert)", business: "Included (multi-schedule)" },
  { label: "Digital menu & QR code (food)", starter: "Included", pro: "Included", business: "Included" },
  { label: "Team & doctor profiles", starter: "2 staff accounts", pro: "5 staff accounts", business: "15 staff accounts" },
  { label: "Document & photo storage", starter: "5 GB", pro: "20 GB", business: "100 GB" },
  { label: "Hybrid store (sell merchandise)", starter: "Up to 10 products", pro: "Full Dual Engine (up to 50 products)", business: "Full Dual Engine (up to 200 products)" },
  { label: "Sales commission", starter: "0%", pro: "0%", business: "0%" },
];

const PORTFOLIO_FOR: Record<string, string> = {
  STARTER: "For freelancers, doctors, and solo consultants.",
  PRO: "For growing clinics, restaurants, and professional agencies.",
  BUSINESS: "For established corporate firms and multi-branch companies.",
};

export default async function Pricing() {
  const [storePlans, portfolioPlans] = await Promise.all([
    listPublicPlans().catch(() => []),
    listPublicPortfolioPlans().catch(() => []),
  ]);

  const bestStore = storePlans.find((p) => p.tier === "PRO")?.tier ?? "PRO";
  const bestPortfolio = portfolioPlans.find((p) => p.tier === "PRO")?.tier ?? "PRO";

  const starterStore = storePlans.find((p) => p.tier === "STARTER");
  const proStore = storePlans.find((p) => p.tier === "PRO");
  const businessStore = storePlans.find((p) => p.tier === "BUSINESS");

  const storeRows: ComparisonRow[] = STORE_ROWS_DEF.map((r) => ({
    label: r.label,
    starter: starterStore ? r.of(starterStore) : "—",
    pro: proStore ? r.of(proStore) : "—",
    business: businessStore ? r.of(businessStore) : "—",
  }));

  const storeCardData = storePlans.map((p) => ({
    tier: p.tier,
    name: p.name,
    priceMonthly: p.priceMonthly,
    priceYearly: p.priceYearly,
    monthsFree: p.yearlyMonthsFree,
    bullets: planBullets(p),
    linkHref: `/start?mode=ecommerce&plan=${p.tier}`,
  }));

  const portfolioCardData = portfolioPlans.map((p) => ({
    tier: p.tier,
    name: p.name,
    priceMonthly: p.priceMonthly,
    priceYearly: p.priceYearly,
    monthsFree: p.yearlyMonthsFree,
    bullets: portfolioPlanBullets(p),
    forText: PORTFOLIO_FOR[p.tier],
    linkHref: `/start?mode=business&plan=${p.tier}`,
  }));

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

        <PricingView
          storePlans={storeCardData}
          portfolioPlans={portfolioCardData}
          bestStore={bestStore}
          bestPortfolio={bestPortfolio}
          storeRows={storeRows}
          portfolioRows={PORTFOLIO_ROWS}
        />

        {/* Payment Methods Banner matching MktPricing.dc.html */}
        <div className="pay-panel" style={{ marginTop: 64 }}>
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

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <p style={{ fontSize: 14.5, color: "var(--ink-2)" }}>
            Looking exclusively for service business, clinic appointment, or restaurant menu website pricing?{" "}
            <a href="/business/pricing" className="link" style={{ fontWeight: 600 }}>
              View dedicated Business Website Pricing &amp; FAQs →
            </a>
          </p>
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "BreadcrumbList",
                  "itemListElement": [
                    {
                      "@type": "ListItem",
                      "position": 1,
                      "name": "Home",
                      "item": "https://biztrackbd.com",
                    },
                    {
                      "@type": "ListItem",
                      "position": 2,
                      "name": "Pricing",
                      "item": "https://biztrackbd.com/pricing",
                    },
                  ],
                },
                {
                  "@type": "Product",
                  "name": "BizTrackBD Platform Subscription",
                  "description": "Transparent eCommerce store software and business website subscription in Bangladeshi Taka with 0% sales commission.",
                  "offers": {
                    "@type": "AggregateOffer",
                    "priceCurrency": "BDT",
                    "lowPrice": "399",
                    "highPrice": "1499",
                    "offerCount": "3",
                  },
                },
              ],
            }),
          }}
        />
      </div>
    </section>
  );
}
