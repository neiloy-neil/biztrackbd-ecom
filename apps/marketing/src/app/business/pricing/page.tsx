import type { Metadata } from "next";
import Link from "next/link";
import { ModeArchitectureMatrix } from "@/components/mode-architecture-matrix";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Business Website Pricing Plans (৳399 to ৳1,499)",
  description:
    "Affordable, transparent BDT pricing for Bangladesh business, service, doctor, restaurant, and portfolio websites. 0% commission, lead capture, booking requests, and custom domain.",
  keywords: [
    "business website pricing bangladesh",
    "doctor website cost dhaka",
    "restaurant website price bd",
    "portfolio website pricing taka",
    "ওয়েবসাইট তৈরির খরচ বাংলাদেশ",
  ],
  alternates: {
    canonical: `${siteUrl}/business/pricing`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/business/pricing`,
    siteName: "BizTrackBD",
    title: "Business Website Pricing Plans | BizTrackBD",
    description: "Transparent BDT pricing from ৳399/mo. Custom domain, lead forms, and booking requests included.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "Business Pricing Plans" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Business Website Pricing Plans | BizTrackBD",
    description: "Transparent BDT pricing for Bangladesh business websites with 0% commission.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const BUSINESS_FAQ: [string, string][] = [
  [
    "Can I connect my own custom domain (e.g. yourcompany.com or doctor.com.bd)?",
    "Yes! All Business plans support connecting your custom domain with automatic, free SSL certificate setup and zero server maintenance.",
  ],
  [
    "Can I pay in Bangladeshi Taka using bKash or Nagad?",
    "Yes. You can pay your subscription directly in BDT using personal or merchant bKash, Nagad, Rocket, or local Bangladeshi debit/credit cards.",
  ],
  [
    "What is the difference between Business Starter and Business Pro?",
    "Business Starter (৳399/mo) is ideal for personal portfolios, consultants, and single-location businesses that need lead forms and up to 5 pages. Business Pro (৳799/mo) adds the interactive appointment and reservation booking engine, unlimited downloads, team profiles, and up to 20 pages.",
  ],
  [
    "What if I need both an online store with courier delivery and a business website?",
    "You can choose BizTrackBD Hybrid mode! It combines the online store engine (bKash checkout, Pathao/Steadfast courier dispatch, COD fraud protection) with business lead and booking workflows in a single unified dashboard.",
  ],
  [
    "Is there any sales commission or hidden setup fee?",
    "Never. We charge 0% commission on any leads, bookings, or client contracts. You only pay the flat transparent monthly subscription fee.",
  ],
];

const schemaJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "BizTrackBD Business Website Builder",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  offers: [
    {
      "@type": "Offer",
      name: "Business Starter",
      price: "399",
      priceCurrency: "BDT",
    },
    {
      "@type": "Offer",
      name: "Business Pro",
      price: "799",
      priceCurrency: "BDT",
    },
    {
      "@type": "Offer",
      name: "Business Plus",
      price: "1499",
      priceCurrency: "BDT",
    },
  ],
};

export default function BusinessPricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaJsonLd) }}
      />

      {/* Hero */}
      <section className="hero hero-center" style={{ background: "var(--bg-paper)", borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <span
              className="eyebrow"
              style={{
                color: "var(--business)",
                background: "var(--tint-business)",
                borderColor: "var(--tint-business-border)",
                borderWidth: 1,
                borderStyle: "solid",
                padding: "4px 14px",
                borderRadius: 20,
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              BizTrackBD Business · Transparent Taka Pricing
            </span>
          </div>

          <h1 style={{ color: "var(--ink-ledger)", fontSize: "clamp(32px, 5vw, 50px)", lineHeight: 1.15, letterSpacing: "-1.5px" }}>
            Professional websites for Bangladesh businesses. <br className="hidden-mobile" />
            <span style={{ color: "var(--business)" }}>Transparent BDT plans. 0% commission.</span>
          </h1>

          <p className="lead" style={{ maxWidth: 720, margin: "16px auto 0", color: "var(--ink-2)", fontSize: "clamp(15px, 2vw, 18px)", lineHeight: 1.6 }}>
            Empower your company, service firm, medical chamber, restaurant, or creative career with lead capture, booking scheduling, and custom domain inclusion.
          </p>

          {/* Cross-Link Banner to Commerce */}
          <div
            style={{
              marginTop: 24,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 18px",
              background: "#FFFFFF",
              border: "1px solid var(--line-strong)",
              borderRadius: 30,
              fontSize: 13.5,
              color: "var(--ink-2)",
            }}
          >
            <span>Need an eCommerce store with Pathao/Steadfast dispatch?</span>
            <Link href="/pricing" style={{ color: "var(--brand)", fontWeight: 700, textDecoration: "underline" }}>
              View eCommerce Plans (from ৳399/mo) →
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="block" style={{ borderBottom: "1px solid var(--line)", background: "#FFFFFF" }}>
        <div className="wrap">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
              gap: 24,
              maxWidth: 1080,
              margin: "0 auto",
            }}
          >
            {/* Starter Plan */}
            <div
              className="card ledger-border"
              style={{
                padding: "32px 26px",
                background: "#FFFFFF",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
              }}
            >
              <div>
                <span className="status-stamp stamp-lead">STARTER</span>
                <h3 style={{ margin: "14px 0 6px", fontSize: 22, color: "var(--ink-ledger)" }}>Business Starter</h3>
                <p style={{ fontSize: 13.5, color: "var(--ink-3)", minHeight: 40, margin: 0 }}>
                  For individual consultants, creators, and single-service businesses needing lead capture.
                </p>

                <div style={{ margin: "22px 0 20px" }}>
                  <span style={{ fontSize: 38, fontWeight: 800, color: "var(--ink-ledger)" }}>৳399</span>
                  <span style={{ fontSize: 14, color: "var(--ink-3)" }}> / month</span>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>৳3,990 billed annually (2 months free)</div>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "20px 0", fontSize: 13.5, color: "var(--ink-2)", display: "flex", flexDirection: "column", gap: 10 }}>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>Up to 5 Pages</strong> (Home, About, Services, Contact)</li>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>Custom Domain</strong> with free SSL</li>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>Inbound Lead Capture</strong> with WhatsApp alert</li>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>5 Downloadable Files</strong> (CV, Press Kit, PDF)</li>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>15 Content Showcase Items</strong></li>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>1 Staff Admin Account</strong></li>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>0% Sales Commission</strong></li>
                </ul>
              </div>

              <Link
                href="/start?mode=portfolio&plan=starter"
                className="btn btn-secondary"
                style={{ width: "100%", textAlign: "center", justifyContent: "center", padding: "12px 0" }}
                prefetch={false}
              >
                Start 14-day free trial
              </Link>
            </div>

            {/* Pro Plan (Featured) */}
            <div
              className="card ledger-border"
              style={{
                padding: "32px 26px",
                background: "#FBF7EC",
                borderColor: "var(--business)",
                borderWidth: 2,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                boxShadow: "0 10px 25px rgba(242, 169, 0, 0.12)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -12,
                  right: 24,
                  background: "var(--business)",
                  color: "#FFFFFF",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.5px",
                  padding: "4px 12px",
                  borderRadius: 20,
                  textTransform: "uppercase",
                }}
              >
                MOST POPULAR
              </div>

              <div>
                <span className="status-stamp stamp-paid">BUSINESS PRO</span>
                <h3 style={{ margin: "14px 0 6px", fontSize: 22, color: "var(--ink-ledger)" }}>Business</h3>
                <p style={{ fontSize: 13.5, color: "var(--ink-3)", minHeight: 40, margin: 0 }}>
                  For established doctors, clinics, restaurants, agencies, and growing service firms.
                </p>

                <div style={{ margin: "22px 0 20px" }}>
                  <span style={{ fontSize: 38, fontWeight: 800, color: "var(--business)" }}>৳799</span>
                  <span style={{ fontSize: 14, color: "var(--ink-3)" }}> / month</span>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>৳7,990 billed annually (2 months free)</div>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "20px 0", fontSize: 13.5, color: "var(--ink-2)", display: "flex", flexDirection: "column", gap: 10 }}>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>Up to 20 Pages</strong> with visual page builder</li>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>Appointment &amp; Table Booking Engine</strong></li>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>Custom Domain</strong> with free automatic SSL</li>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>Unlimited Content &amp; Portfolio Items</strong></li>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>Unlimited Downloadable Files</strong></li>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>Team &amp; Specialist Bio Profiles</strong></li>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>3 Staff Admin Accounts</strong></li>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>Instant WhatsApp Dispatch Links</strong></li>
                </ul>
              </div>

              <Link
                href="/start?mode=portfolio&plan=pro"
                className="btn btn-primary"
                style={{ width: "100%", textAlign: "center", justifyContent: "center", padding: "12px 0", background: "var(--business)", borderColor: "var(--business)" }}
                prefetch={false}
              >
                Start 14-day free trial
              </Link>
            </div>

            {/* Plus Plan */}
            <div
              className="card ledger-border"
              style={{
                padding: "32px 26px",
                background: "#FFFFFF",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
              }}
            >
              <div>
                <span className="status-stamp stamp-lead">ENTERPRISE</span>
                <h3 style={{ margin: "14px 0 6px", fontSize: 22, color: "var(--ink-ledger)" }}>Business Plus</h3>
                <p style={{ fontSize: 13.5, color: "var(--ink-3)", minHeight: 40, margin: 0 }}>
                  For multi-chamber medical clinics, corporate advisory firms, and large institutions.
                </p>

                <div style={{ margin: "22px 0 20px" }}>
                  <span style={{ fontSize: 38, fontWeight: 800, color: "var(--ink-ledger)" }}>৳1,499</span>
                  <span style={{ fontSize: 14, color: "var(--ink-3)" }}> / month</span>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>৳14,990 billed annually (2 months free)</div>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "20px 0", fontSize: 13.5, color: "var(--ink-2)", display: "flex", flexDirection: "column", gap: 10 }}>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>Unlimited Custom Pages</strong></li>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>Multi-Chamber &amp; Multi-Doctor Schedules</strong></li>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>Custom Domain</strong> with SSL &amp; DDoS protection</li>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>Priority Concierge Setup &amp; DNS Pointer</strong></li>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>10 Staff Admin Accounts</strong></li>
                  <li style={{ display: "flex", gap: 8 }}><span>✓</span> <strong>Dedicated Dhaka Account Support</strong></li>
                </ul>
              </div>

              <Link
                href="/start?mode=portfolio&plan=business"
                className="btn btn-secondary"
                style={{ width: "100%", textAlign: "center", justifyContent: "center", padding: "12px 0" }}
                prefetch={false}
              >
                Start 14-day free trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="block" style={{ borderBottom: "1px solid var(--line)", background: "var(--bg-paper)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 700, margin: "0 auto 32px" }}>
            <span className="eyebrow" style={{ color: "var(--business)" }}>Detailed Comparison</span>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 36px)", letterSpacing: "-1px" }}>Everything included on each plan</h2>
            <p className="sub" style={{ margin: "8px 0 0" }}>All plans include zero sales commission, mobile responsiveness, and Dhaka engineering support.</p>
          </div>

          <div className="pricing-table-mobile-cue" style={{ textAlign: "center", marginBottom: 10 }}>
            <span>⟵ Swipe horizontally to compare all plan features ⟶</span>
          </div>

          <div
            className="pricing-table-scroll-wrap"
            tabIndex={0}
            role="region"
            aria-label="Business plan feature comparison table"
            style={{
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              background: "#FFFFFF",
              borderRadius: 12,
              border: "1px solid var(--line)",
              maxWidth: 960,
              margin: "0 auto",
            }}
          >
            <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#FBF7EC", borderBottom: "1.5px solid var(--line-strong)" }}>
                  <th style={{ padding: "16px 20px", textAlign: "left", color: "var(--ink-ledger)" }}>Capability / Feature</th>
                  <th style={{ padding: "16px 16px", textAlign: "center", color: "var(--ink-ledger)" }}>Starter (৳399)</th>
                  <th style={{ padding: "16px 16px", textAlign: "center", color: "var(--business)", background: "#FBF7EC" }}>Business (৳799)</th>
                  <th style={{ padding: "16px 16px", textAlign: "center", color: "var(--ink-ledger)" }}>Plus (৳1,499)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "14px 20px", fontWeight: 700, color: "var(--ink-ledger)" }}>Operating Architecture</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>PORTFOLIO (Lead Engine)</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", background: "#FBF7EC", fontWeight: 700, color: "var(--business)" }}>PORTFOLIO or HYBRID (Dual)</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: 700 }}>PORTFOLIO or HYBRID (Dual)</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "14px 20px", fontWeight: 700, color: "var(--ink-ledger)" }}>Zero Data Loss Guarantee</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", color: "#0B4D3B", fontWeight: 700 }}>100% Leads Retained</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", background: "#FBF7EC", color: "#0B4D3B", fontWeight: 700 }}>100% Leads Retained</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", color: "#0B4D3B", fontWeight: 700 }}>100% Leads Retained</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "14px 20px", fontWeight: 600 }}>Custom Domain Support</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>✓ Included</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", background: "#FBF7EC" }}>✓ Included</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>✓ Included</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "14px 20px", fontWeight: 600 }}>Inbound Lead Capture</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>✓ Included</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", background: "#FBF7EC" }}>✓ Included</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>✓ Included</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "14px 20px", fontWeight: 600 }}>Appointment &amp; Table Booking Engine</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", color: "var(--ink-3)" }}>—</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", background: "#FBF7EC", color: "var(--business)", fontWeight: 700 }}>✓ Included</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: 700 }}>✓ Included</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "14px 20px", fontWeight: 600 }}>Dual Engine Merchandise Sales</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>Up to 10 products</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", background: "#FBF7EC", fontWeight: 600, color: "var(--business)" }}>Full Dual Engine (50 items)</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: 600 }}>Full Dual Engine (200 items)</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "14px 20px", fontWeight: 600 }}>Custom Pages Limit</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>Up to 5 Pages</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", background: "#FBF7EC" }}>Up to 20 Pages</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>Unlimited</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "14px 20px", fontWeight: 600 }}>Downloadable File Center (PDF/CV)</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>5 Files</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", background: "#FBF7EC" }}>Unlimited</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>Unlimited</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "14px 20px", fontWeight: 600 }}>Staff Admin Accounts</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>1 Account</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", background: "#FBF7EC" }}>3 Accounts</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>10 Accounts</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "14px 20px", fontWeight: 600 }}>Sales Commission</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", color: "#0B4D3B", fontWeight: 700 }}>0%</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", background: "#FBF7EC", color: "#0B4D3B", fontWeight: 700 }}>0%</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", color: "#0B4D3B", fontWeight: 700 }}>0%</td>
                </tr>
                <tr>
                  <td style={{ padding: "14px 20px", fontWeight: 600 }}>Dhaka Support Assistance</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>WhatsApp &amp; Email</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", background: "#FBF7EC" }}>WhatsApp &amp; Phone</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>Dedicated Concierge</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Multi-Mode Architecture & Zero-Data-Loss Transition Matrix */}
          <ModeArchitectureMatrix />
        </div>
      </section>

      {/* FAQ */}
      <section className="block">
        <div className="wrap">
          <h2 style={{ textAlign: "center", margin: "0 auto 32px", fontSize: "clamp(26px, 4vw, 36px)", letterSpacing: "-1px" }}>
            Frequently asked questions about Business pricing
          </h2>
          <dl className="faq-list">
            {BUSINESS_FAQ.map(([q, a]) => (
              <div key={q}>
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="block soft" style={{ background: "var(--ink-ledger)", color: "#FFFFFF", textAlign: "center" }}>
        <div className="wrap">
          <h2 style={{ color: "#FFFFFF", fontSize: "clamp(26px, 4.5vw, 42px)", letterSpacing: "-1px", margin: 0 }}>
            Launch your professional business website today
          </h2>
          <p style={{ color: "var(--green-light)", maxWidth: 560, margin: "14px auto 28px", fontSize: 16 }}>
            Start with our 14-day free trial. No foreign credit card required. Pay easily via bKash or Nagad.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/start?mode=portfolio"
              className="btn btn-primary btn-lg"
              style={{ background: "var(--business)", borderColor: "var(--business)" }}
              prefetch={false}
            >
              Start 14-day free trial →
            </Link>
            <Link
              href="/business/templates"
              className="btn btn-secondary btn-lg"
              style={{ background: "transparent", color: "#FFFFFF", borderColor: "#3D5A52" }}
            >
              Explore Business Templates
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
