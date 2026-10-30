import type { Metadata } from "next";
import Link from "next/link";
import { THEMES, listPublicPlans } from "@biztrackbd/core";
import { DualHero } from "@/components/dual-hero";
import { OperationalScenarios } from "@/components/operational-scenarios";
import { PlanCards } from "@/components/plan-cards";
import { TemplateCard } from "@/components/template-card";
import { demoAdminUrl } from "@/lib/demo-admin";
import { planBullets, taka } from "@/lib/plans";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: "Online Store & Business Website Platform for Bangladesh",
  description:
    "Launch your online store in a day. Sell with bKash, Nagad and COD, book Pathao and Steadfast pickups from each order, and keep 0% sales commission.",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "en_BD",
    alternateLocale: ["bn_BD"],
    url: siteUrl,
    siteName: "BizTrackBD",
    title: "BizTrackBD: Online Store & Business Website Platform for Bangladesh",
    description:
      "Launch your online store or business website in a day. Sell with bKash, Nagad, and Cash on Delivery. Book Pathao and Steadfast pickups straight from each order with 0% sales commission.",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "BizTrackBD Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BizTrackBD: Online Store & Business Website Platform for Bangladesh",
    description:
      "Launch your online store or business website in a day. Sell with bKash, Nagad, and Cash on Delivery with 0% commission.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

export const dynamic = "force-dynamic";

const FAQ: [string, string][] = [
  [
    "Do I need an international credit card to use BizTrackBD?",
    "No. You never need a dollar card. You pay for your monthly or yearly plan in Bangladeshi Taka using personal or merchant bKash, Nagad, or local bank transfer.",
  ],
  [
    "Does BizTrackBD take a cut or sales commission from my revenue?",
    "Never. We charge 0% commission. You keep 100% of every sale. Your customers pay you directly via bKash, Nagad, or Cash on Delivery.",
  ],
  [
    "Does BizTrackBD hold my customer's money in an escrow account?",
    "No. Your money never touches our bank account. Customer payments go straight to your personal or merchant bKash/Nagad wallet or courier settlement account.",
  ],
  [
    "How does the Cash on Delivery (COD) return fraud protection work?",
    "When a customer places an order, BizTrackBD checks their phone number against delivery performance records across Pathao and Steadfast. If they have a history of rejecting parcels, the order is flagged so you can request an advance delivery fee or confirm by phone before shipping.",
  ],
  [
    "Can I build a business, clinic, or portfolio website without an online store?",
    "Yes. BizTrackBD Business is designed specifically for non-ecommerce businesses—such as medical practices, restaurants, consulting firms, service providers, and creators. You get custom domains, bilingual Bangla & English content, WhatsApp direct inquiries, and an organized lead inbox.",
  ],
  [
    "Which couriers can I automate?",
    "Steadfast, Pathao, and RedX. You connect your own courier merchant accounts using your API keys. We encrypt your keys using AES-256 and you can book pickups and print shipping labels in 1 click.",
  ],
  [
    "Can I run my store or business completely from my smartphone?",
    "Yes. Our merchant and business admin is built mobile-first. You can upload photos on your phone, set prices, confirm orders, assign leads, and book couriers without ever opening a computer.",
  ],
  [
    "What happens to my data if I cancel or pause my plan?",
    "Your data is always yours. You can download all your products, customer contacts, leads, and order histories as CSV spreadsheets at any time in 1 click.",
  ],
];

const SHOWCASE = ["kapor", "gadgetstudio", "berber"];

const BUSINESS_SHOWCASE = [
  {
    id: "dhaka-bistro",
    name: "Dhaka Bistro",
    blurb: "Atmospheric restaurant & dining website with digital QR menu, reservation requests, and location map.",
    audience: "Restaurants, cafes, bistros & cloud kitchens",
    live: true,
  },
  {
    id: "modern-clinic",
    name: "Modern Clinic",
    blurb: "Doctor profile & medical clinic with verified BMDC credentials, chamber schedules, and appointment requests.",
    audience: "Specialist doctors, clinics & diagnostic centers",
    live: true,
  },
  {
    id: "corporate-trust",
    name: "Corporate Trust",
    blurb: "Authoritative corporate presence for consultancies, agencies, enterprises, and holding ventures.",
    audience: "Corporate firms, consultancies & B2B agencies",
    live: true,
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  })),
};

export default async function Home() {
  const plans = await listPublicPlans().catch(() => []);
  const from = plans[0]?.priceMonthly;
  const best = plans.find((p) => p.tier === "PRO")?.tier;
  const showcase = SHOWCASE.map((id) => THEMES.find((t) => t.id === id)).filter((t): t is (typeof THEMES)[number] => Boolean(t));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Dual Umbrella Hero with Goal Switcher and Progressive Interactive Rail */}
      <DualHero
        fromPriceCommerce={from ? taka(from) : "৳ 399"}
        fromPriceBusiness="৳ 399"
      />

      {/* The Messy Before vs BizTrackBD Operating Desk */}
      <section className="block soft" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 780, margin: "0 auto 36px" }}>
            <span
              className="eyebrow"
              style={{
                color: "var(--ink-2)",
                background: "#FBF7EC",
                borderColor: "var(--line)",
                borderWidth: 1,
                borderStyle: "solid",
                padding: "4px 14px",
                borderRadius: 20,
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                display: "inline-block",
                marginBottom: 12,
              }}
            >
              One Operating Desk
            </span>
            <h2 style={{ fontSize: "clamp(28px, 4.5vw, 44px)", letterSpacing: "-1.2px", color: "var(--ink-ledger)", lineHeight: 1.15 }}>
              Your business should not live in five browser tabs
            </h2>
            <p style={{ margin: "14px auto 0", fontSize: 17, color: "var(--ink-2)", lineHeight: 1.6 }}>
              When orders, customer inquiries, payment checks, and courier bookings are scattered across different apps, mistakes happen and profits disappear.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
            {/* The Before Card */}
            <div
              className="card ledger-border"
              style={{
                padding: "28px 24px",
                background: "#FBE9DF",
                border: "1.5px solid #F2C9B3",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span className="status-stamp stamp-risk">THE SCATTERED BEFORE</span>
                <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>5 Tabs &amp; Manual Friction</span>
              </div>
              <h3 style={{ margin: 0, fontSize: 20, color: "#9A3412" }}>
                Messy manual copying &amp; lost revenue
              </h3>
              <ul style={{ margin: "16px 0 0", paddingLeft: 20, color: "var(--ink-2)", fontSize: 14, lineHeight: 1.8 }}>
                <li><strong>Tab 1: Facebook Messenger:</strong> Addresses copied by hand; customer typos go unnoticed.</li>
                <li><strong>Tab 2: Personal bKash SMS:</strong> Staring at SMS alerts trying to match TrxIDs against customer names.</li>
                <li><strong>Tab 3: Courier Portals:</strong> Re-typing customer details into Steadfast or Pathao one by one.</li>
                <li><strong>Tab 4: Spreadsheet:</strong> Out-of-sync stock; overselling items that are already out of stock.</li>
                <li><strong>Tab 5: Fake COD Returns:</strong> Shipping blind to repeat-refusal buyers, paying ৳130+ return fees.</li>
              </ul>
            </div>

            {/* The BizTrackBD Desk Card */}
            <div
              className="card ledger-border"
              style={{
                padding: "28px 24px",
                background: "#FFFFFF",
                border: "1.5px solid #C6DFD3",
                boxShadow: "0 8px 24px rgba(17, 121, 90, 0.08)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span className="status-stamp stamp-paid">THE BIZTRACKBD DESK</span>
                <span style={{ fontSize: 12, color: "var(--brand)", fontWeight: 700 }}>One Unified Workflow</span>
              </div>
              <h3 style={{ margin: 0, fontSize: 20, color: "var(--brand)" }}>
                Every order, courier, and taka under control
              </h3>
              <ul style={{ margin: "16px 0 0", paddingLeft: 20, color: "var(--ink)", fontSize: 14, lineHeight: 1.8 }}>
                <li><strong>One Order Desk:</strong> Storefront orders and phone orders converge in one clean status queue.</li>
                <li><strong>Automated TrxID Verification:</strong> Customers enter bKash/Nagad TrxID; verified straight to your wallet.</li>
                <li><strong>COD Return Risk Shield:</strong> Checks 6-month courier delivery history before you pack.</li>
                <li><strong>1-Click Courier Dispatch:</strong> Steadfast &amp; Pathao booking with barcode thermal labels.</li>
                <li><strong>True Net Profit:</strong> Automated ledger calculates courier fees, product costs, and true net earnings.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Verifiable Operational Scenarios (Compliance with Claims Proof Policy) */}
      <OperationalScenarios />

      {/* Templates Showcase (Commerce & Business) */}
      <section className="block" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="wrap">
          <div className="row-between" style={{ alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
            <div>
              <span className="eyebrow">Real Working Websites</span>
              <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px", color: "var(--ink-ledger)" }}>
                Start with a template built for your specific business
              </h2>
              <p style={{ margin: "8px 0 0", color: "var(--ink-2)", fontSize: 15.5 }}>
                Switch designs at any time without losing your products, orders, pages, or customer records.
              </p>
            </div>
            <Link href="/templates" className="btn btn-secondary btn-sm" prefetch={false}>
              Browse Full Template Library &rarr;
            </Link>
          </div>

          {/* Section Subheading: Online Stores */}
          <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <span className="status-stamp stamp-paid">COMMERCE STOREFRONTS</span>
            <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Optimized for bKash, Nagad, and mobile checkout</span>
          </div>
          <div className="grid g3" style={{ marginBottom: 36 }} data-testid="home-templates">
            {showcase.map((t) => (
              <TemplateCard key={t.id} t={{ ...t, audience: undefined }} compact />
            ))}
          </div>

          {/* Section Subheading: Business & Services */}
          <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <span className="status-stamp stamp-lead">BUSINESS &amp; SERVICE WEBSITES</span>
            <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Optimized for inquiries, WhatsApp chats, and client bookings</span>
          </div>
          <div className="grid g3">
            {BUSINESS_SHOWCASE.map((t) => (
              <div
                key={t.id}
                className="card ledger-border"
                style={{
                  padding: "24px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  background: "#FFFFFF",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ink-ledger)" }}>{t.name}</h3>
                  <span className="pill live" style={{ fontSize: 11 }}>Ready</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--business)", fontWeight: 600 }}>{t.audience}</div>
                <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.5, margin: 0 }}>{t.blurb}</p>
                <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid var(--line)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a
                    href={demoAdminUrl(t.id)}
                    className="btn btn-secondary btn-sm"
                    data-testid={`biz-demo-${t.id}`}
                  >
                    Try demo desk ↗
                  </a>
                  <Link
                    href={`/start?mode=business&theme=${t.id}`}
                    className="btn btn-primary btn-sm"
                    style={{ background: "var(--business)" }}
                    prefetch={false}
                  >
                    Use template
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fair Alternatives Comparison Block */}
      <section className="block soft" style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 36px" }}>
            <span className="eyebrow">Fair Platform Comparison</span>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px", color: "var(--ink-ledger)" }}>
              Choose the right software for the market you operate in
            </h2>
            <p style={{ margin: "12px auto 0", fontSize: 16, color: "var(--ink-2)" }}>
              We respect international platforms and local logistics providers. Here is an honest summary of who each tool is best suited for.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 18 }}>
            <div className="card ledger-border" style={{ padding: "22px 20px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--ink-3)", textTransform: "uppercase" }}>Global Benchmark</div>
              <h3 style={{ margin: "4px 0 8px", fontSize: 18, color: "var(--ink-ledger)" }}>Shopify</h3>
              <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
                <strong>Best for:</strong> Global brands selling internationally in USD/EUR with extensive plugin budgets.
              </p>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                Requires passport-endorsed credit card. No native Steadfast or bKash TrxID verification.
              </div>
            </div>

            <div className="card ledger-border" style={{ padding: "22px 20px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--ink-3)", textTransform: "uppercase" }}>Open Source</div>
              <h3 style={{ margin: "4px 0 8px", fontSize: 18, color: "var(--ink-ledger)" }}>WooCommerce</h3>
              <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
                <strong>Best for:</strong> Developers with in-house server management and WordPress maintenance capacity.
              </p>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                High maintenance overhead; plugin conflicts frequently break checkout during flash sales.
              </div>
            </div>

            <div className="card ledger-border" style={{ padding: "22px 20px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--ink-3)", textTransform: "uppercase" }}>Logistics Ecosystem</div>
              <h3 style={{ margin: "4px 0 8px", fontSize: 18, color: "var(--ink-ledger)" }}>Pathao Commerce</h3>
              <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
                <strong>Best for:</strong> Sellers operating exclusively within the Pathao logistics network.
              </p>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                Tied to single delivery provider. Less flexibility for multi-courier arbitrage or custom domains.
              </div>
            </div>

            <div className="card ledger-border" style={{ padding: "22px 20px", background: "#E3F1EA", border: "1.5px solid var(--brand)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--brand)", textTransform: "uppercase" }}>Locally Native Desk</div>
              <h3 style={{ margin: "4px 0 8px", fontSize: 18, color: "var(--brand)" }}>BizTrackBD</h3>
              <p style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5 }}>
                <strong>Best for:</strong> Bangladeshi sellers &amp; businesses wanting courier neutrality, COD return protection, and 0% commission.
              </p>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 10, borderTop: "1px solid var(--tint-border)", paddingTop: 10 }}>
                Transparent Taka plans, Steadfast &amp; Pathao integration, phone-first admin, and bilingual websites.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Preview Section */}
      {plans.length > 0 && (
        <section className="block" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="wrap" style={{ textAlign: "center" }}>
            <span className="eyebrow">Honest Pricing in Taka</span>
            <h2 style={{ margin: "0 auto", fontSize: "clamp(28px, 4vw, 42px)", letterSpacing: "-1.2px", color: "var(--ink-ledger)" }}>
              Simple monthly plans. 0% sales commission.
            </h2>
            <p className="sub" style={{ margin: "12px auto 0", fontSize: 16.5, color: "var(--ink-2)" }}>
              Pay monthly or yearly via bKash or Nagad. 14 days free trial, no credit card needed.
            </p>
            <div style={{ textAlign: "left", marginTop: 32 }}>
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
                compactBullets={4}
              />
            </div>
            <p style={{ marginTop: 28 }}>
              <Link href="/pricing" className="btn btn-secondary btn-sm" prefetch={false}>
                Open Plan Recommender &amp; Feature Comparison &rarr;
              </Link>
            </p>
          </div>
        </section>
      )}

      {/* Trust & Operational Guarantees */}
      <section className="block soft" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div className="trust-grid">
            <div className="trust-item">
              <b>🔒 Direct wallet settlement</b>
              <p>Customers pay directly into your bKash, Nagad, or bank. BizTrackBD never holds your money in escrow.</p>
            </div>
            <div className="trust-item">
              <b>🔑 AES-256 encrypted courier keys</b>
              <p>Your Steadfast and Pathao API keys are encrypted at rest and never shared with third parties.</p>
            </div>
            <div className="trust-item">
              <b>📦 1-click CSV data ownership</b>
              <p>Your products, customers, and order history belong to you. Download everything as CSV at any time.</p>
            </div>
            <div className="trust-item">
              <b>💬 Dhaka-based support</b>
              <p>Direct WhatsApp and phone assistance from specialists who understand local commerce logistics.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Switching and comparison links */}
      <section className="block">
        <div className="wrap" style={{ textAlign: "center" }}>
          <h2 style={{ margin: "0 auto 16px", fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px" }}>
            Already selling on another platform?
          </h2>
          <p style={{ maxWidth: 640, margin: "0 auto 20px", color: "var(--ink-2)" }}>
            See how BizTrackBD compares, move your store without downtime, or screen a risky COD order for free.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/compare/shopify" className="btn btn-secondary btn-sm" prefetch={false}>
              BizTrackBD vs Shopify
            </Link>
            <Link href="/compare/woocommerce" className="btn btn-secondary btn-sm" prefetch={false}>
              BizTrackBD vs WooCommerce
            </Link>
            <Link href="/migrate/shopify" className="btn btn-secondary btn-sm" prefetch={false}>
              Migrate from Shopify
            </Link>
            <Link href="/tools/courier-fraud-checker" className="btn btn-secondary btn-sm" prefetch={false}>
              Free courier fraud checker
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="block">
        <div className="wrap">
          <h2 style={{ textAlign: "center", margin: "0 auto 32px", fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px" }}>
            Frequently asked questions
          </h2>
          <dl className="faq-list">
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Closing CTA Band */}
      <section className="cta-band">
        <div className="wrap">
          <span className="brand-tagline-arrow" aria-hidden="true" />
          <h2 style={{ color: "#FFFFFF", fontSize: "clamp(28px, 4.5vw, 42px)", letterSpacing: "-1.2px" }}>
            Put your next order or client inquiry through BizTrackBD
          </h2>
          <p style={{ fontSize: 17, marginTop: 10 }}>
            14 days free &middot; No credit card required &middot; Set up in 10 minutes
          </p>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/start" className="btn btn-lg btn-primary" prefetch={false}>
              Start your free 14-day trial
            </Link>
            <a
              href={demoAdminUrl()}
              className="btn btn-lg btn-secondary"
              style={{ background: "rgba(255,255,255,0.1)", color: "#FFFFFF", borderColor: "rgba(255,255,255,0.2)" }}
            >
              Open Live Demo Desk ↗
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
