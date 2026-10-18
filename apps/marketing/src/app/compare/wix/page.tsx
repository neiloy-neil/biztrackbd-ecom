import type { Metadata } from "next";
import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: {
    absolute: "BizTrackBD vs Wix in Bangladesh: Honest Business Website Comparison (Oct 2026)",
  },
  description:
    "An honest comparison of BizTrackBD vs Wix for Bangladeshi businesses, clinics, and restaurants. Compare USD credit card barriers, 15% bank surcharge, Bangla typography, BMDC doctor chambers, QR dining menus, and local WhatsApp lead capture.",
  alternates: {
    canonical: `${siteUrl}/compare/wix`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/compare/wix`,
    siteName: "BizTrackBD",
    title: "BizTrackBD vs Wix in Bangladesh: Honest Business Website Comparison",
    description: "Compare USD card barriers, Bangla typography, BMDC clinic schedules, and BDT bKash billing.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "BizTrackBD vs Wix" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BizTrackBD vs Wix in Bangladesh: Honest Business Website Comparison",
    description: "Evaluate platforms on local Taka pricing, clinic appointment booking, and QR menus.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const WIX_FAQS = [
  {
    q: "Why do Bangladeshi service businesses struggle when paying for Wix?",
    a: "Wix bills exclusively in foreign currencies (primarily USD). To pay for a Wix premium plan, a Bangladeshi business owner must hold a bank credit card endorsed against their personal international passport travel quota ($12,000 annual cap). On top of the USD exchange rate, Bangladeshi banks levy a 15% foreign exchange surcharge and VAT. With BizTrackBD, you pay directly in Bangladeshi Taka using personal or merchant bKash, Nagad, Rocket, or local debit cards without any bank approvals.",
  },
  {
    q: "How does BizTrackBD support Bangladeshi doctors and clinics compared to Wix?",
    a: "Wix Bookings is designed around Western solo practices with simple calendar slots. It lacks Bangladeshi medical realities: displaying official BMDC registration numbers, managing multiple visiting chambers across different neighborhoods (e.g., Banani on Saturday/Monday and Dhanmondi on Tuesday/Thursday), and generating non-clinical serial appointment requests. BizTrackBD has native fields and verified trust badges specifically engineered for Bangladeshi medical consultants.",
  },
  {
    q: "Can I accept contactless table orders at my restaurant with Wix?",
    a: "Wix Restaurants offers digital menu display, but ordering requires international payment gateways and lacks local table QR workflows. BizTrackBD includes table-specific QR codes where guests scan their physical table token, browse bilingual Bangla/English dishes with spicy/Halal indicators, build a live table order tray, and optionally alert the floor captain—without forcing diners to download an app.",
  },
  {
    q: "When is Wix legitimately the better platform?",
    a: "Wix is genuinely superior if you are an international agency or designer needing an unconstrained, free-form drag-and-drop canvas where elements can be nudged to exact pixel coordinates. It also has a massive global App Market with hundreds of specialized niche integrations, and excellent global multilingual tools for European and East Asian languages.",
  },
  {
    q: "What happens if my business starts with a portfolio and later wants to sell merchandise or physical products?",
    a: "On Wix, adding ecommerce requires upgrading to an expensive international plan in USD ($29–$36/mo), rebuilding store components, and dealing with unsupported local couriers and lack of bKash/Nagad checkout. On BizTrackBD, your store can transition atomically to Hybrid mode: your existing lead capture forms, patient bookings, and customer history remain 100% intact, while instantly unlocking bKash/Nagad checkout and 1-click Steadfast/Pathao courier booking.",
  },
  {
    q: "How does Bangla typography render on Wix versus BizTrackBD?",
    a: "Wix often struggles with complex South Asian scripts like Bengali, causing conjunct ligature breakage (যুক্তবর্ণ ত্রুটি) and font fallback flash on mobile devices. BizTrackBD natively embeds Google Fonts Hind Siliguri and Plus Jakarta Sans with optimized subsetting, ensuring crisp, authentic Bangla text rendering across all Android and iOS smartphones.",
  },
];

const COMPARISON_ROWS = [
  {
    feature: "Evolution from Portfolio to Full Commerce",
    wix: "Forces upgrade to expensive USD ecommerce plans ($36+/mo); no local couriers or bKash",
    biztrack: "Atomic 1-click transition to Hybrid mode; bKash & Steadfast dispatch with 100% data preserved",
    verdict: "Grow from a portfolio to a national retail brand without rebuilding your website",
  },
  {
    feature: "Monthly Subscription Currency",
    wix: "USD ($17 – $36/month + 15% bank surcharge)",
    biztrack: "Business from ৳399/mo · Commerce from ৳699/mo (Flat BDT)",
    verdict: "BizTrackBD saves ৳ 2,000–৳ 4,000 monthly with zero currency risk",
  },
  {
    feature: "Payment Method for Subscription",
    wix: "Dual-currency credit card with passport endorsement",
    biztrack: "bKash, Nagad, Rocket, or local Bangladeshi debit cards",
    verdict: "No bank visits, foreign quota deduction, or dollar limits",
  },
  {
    feature: "Doctor & Medical Clinic Chambers",
    wix: "Generic calendar slots; no BMDC or multi-chamber support",
    biztrack: "Verified BMDC badge, multi-chamber schedule, visiting hours",
    verdict: "Purpose-built for Bangladeshi medical specialists",
  },
  {
    feature: "Restaurant Dining & QR Menus",
    wix: "Static PDF upload or complex Western app add-on",
    biztrack: "Contactless table QR menu, bilingual dishes, live table tray",
    verdict: "Ready-to-use dining operations built into standard plans",
  },
  {
    feature: "Bangla & English Bilingual Typography",
    wix: "Prone to conjunct ligature breakages and font flash",
    biztrack: "Native Hind Siliguri subsetting; crisp rendering on 3G/4G",
    verdict: "Flawless Bengali reading experience on local mobile networks",
  },
  {
    feature: "Lead Capture & WhatsApp Outreach",
    wix: "Email alerts; third-party paid WhatsApp widgets required",
    biztrack: "Structured Lead Inbox with 1-tap WhatsApp chat & staff notes",
    verdict: "Follow up with Bangladeshi clients on the platform they use daily",
  },
  {
    feature: "Visual Design & Customization",
    wix: "Free-form drag-and-drop canvas with 300+ third-party apps",
    biztrack: "Phone-friendly block editor with vertical-specific presets",
    verdict: "Wix wins on free-form canvas; BizTrackBD wins on structured speed",
  },
];

export default function CompareWixPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "BizTrackBD vs Wix in Bangladesh: Honest Business Website Comparison",
    description:
      "A realistic comparison between BizTrackBD and Wix for Bangladeshi service businesses, doctors, and dining establishments.",
    publisher: {
      "@type": "Organization",
      name: "BizTrackBD",
      url: siteUrl,
    },
    mainEntity: {
      "@type": "FAQPage",
      mainEntity: WIX_FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.a,
        },
      })),
    },
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Header with Gradient Mesh */}
      <section className="gradient-mesh-hero compare-section-hero">
        <div className="compare-container">
          <div className="compare-breadcrumb">
            <Link href="/compare">
              ← All Platform Comparisons
            </Link>
            <span>/</span>
            <span style={{ fontWeight: 700, color: "#0D9488" }}>BizTrackBD vs Wix</span>
          </div>

          <div className="pill-tag-banner pill-tag-teal">
            <span className="pulse-dot-teal" />
            <span>HONEST BANGLADESH MARKET COMPARISON • 2026</span>
          </div>

          <h1 className="compare-hero-title">
            BizTrackBD vs Wix in Bangladesh: <br />
            <span className="gradient-text-teal">
              The Real Cost &amp; Operational Reality
            </span>
          </h1>

          <p className="compare-hero-desc">
            Wix is an internationally acclaimed drag-and-drop website builder. But in Bangladesh, dollar credit card barriers, 15% bank foreign exchange surcharges, lack of local bKash billing, and generic Western booking slots make local operations frustrating. Here is an authentic, balanced breakdown.
          </p>

          <div className="compare-btn-row">
            <Link
              href="/start?mode=business"
              className="btn btn-teal btn-lg"
            >
              Start Free Business Trial →
            </Link>
            <a
              href={demoAdminUrl("modern-clinic")}
              className="btn btn-secondary btn-lg"
            >
              Try Clinic &amp; Booking Demo Desk ↗
            </a>
          </div>

          {/* Key Reality Metric Pills */}
          <div className="metric-pill-row">
            <div className="metric-pill">
              <span>💳</span>
              <span><strong>Billing:</strong> Flat BDT ৳399/mo (bKash) vs USD $17/mo + 15% card tax</span>
            </div>
            <div className="metric-pill">
              <span>🩺</span>
              <span><strong>Clinic Setup:</strong> BMDC doctor multi-chamber schedules vs simple cal slot</span>
            </div>
            <div className="metric-pill">
              <span>🍽️</span>
              <span><strong>Dining Ops:</strong> 1-Tap table QR tray vs static PDF menu</span>
            </div>
            <div className="metric-pill">
              <span>🇧🇩</span>
              <span><strong>Bangla Rendering:</strong> Native Hind Siliguri subsetting vs conjunct font breakage</span>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Comparison Console Stage */}
      <section className="compare-section-subtle">
        <div className="compare-container">
          <div className="stage-section-title">
            <span className="eyebrow" style={{ color: "#0D9488" }}>Interactive Simulation</span>
            <h2>Real-World Operating Friction in Bangladesh</h2>
            <p>
              What happens when a Bangladeshi clinic, restaurant, or service business tries to run day-to-day operations.
            </p>
          </div>

          <div className="comparison-preview-stage shadow-xl">
            <div className="comparison-window-header">
              <div className="comparison-window-dots">
                <span className="window-dot dot-red" />
                <span className="window-dot dot-yellow" />
                <span className="window-dot dot-green" />
              </div>
              <span className="text-xs font-mono text-slate-400">bangladesh-production-workflow.sim</span>
            </div>

            <div className="split-console">
              {/* Left Pane: Wix Legacy */}
              <div className="console-pane console-pane-legacy">
                <div className="console-pane-header">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>Wix (Global SaaS Engine)</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>Western solo practitioner model</div>
                  </div>
                  <span className="console-status-pill-fail">DOLLAR CARD FRICTION</span>
                </div>

                <div style={{ borderRadius: 8, background: "rgba(127, 29, 29, 0.4)", border: "1px solid rgba(185, 28, 28, 0.4)", padding: 12, fontSize: 12, color: "#FECACA" }}>
                  <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "#FCA5A5", marginBottom: 4 }}>
                    <span>⚠️</span> Card Declined: Travel Quota Depleted
                  </div>
                  <div>Subscription renewal failed. Dual-currency credit card endorsed against international travel quota ($12,000/yr limit) required. 15% bank surcharge + 15% VAT added.</div>
                </div>

                <div className="console-metric-list">
                  <div className="console-metric-item">
                    <span>Monthly Software Bill</span>
                    <span className="console-metric-val console-val-fail">$17 USD + 15% Bank Tax (≈ ৳ 2,720)</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Payment Channels</span>
                    <span className="console-metric-val console-val-fail">Passport credit card only</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Doctor Multi-Chambers</span>
                    <span className="console-metric-val console-val-fail">Not supported (Single slot only)</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Dine-In Table Orders</span>
                    <span className="console-metric-val console-val-fail">Static PDF menu download</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Bangla Complex Ligatures</span>
                    <span className="console-metric-val console-val-fail">Prone to conjunct font breakage</span>
                  </div>
                </div>
              </div>

              {/* Right Pane: BizTrackBD Business */}
              <div className="console-pane console-pane-biztrack">
                <div className="console-pane-header">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>BizTrackBD Business OS</div>
                    <div style={{ fontSize: 11, color: "#2DD4BF" }}>Bangladesh-native business operating system</div>
                  </div>
                  <span className="console-status-pill-success">NATIVE BDT • ZERO FRICTION</span>
                </div>

                <div style={{ borderRadius: 8, background: "rgba(6, 78, 59, 0.4)", border: "1px solid rgba(5, 150, 105, 0.4)", padding: 12, fontSize: 12, color: "#A7F3D0" }}>
                  <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "#6EE7B7", marginBottom: 4 }}>
                    <span>✓</span> Instant bKash QR Auto-Billing
                  </div>
                  <div>Flat ৳ 399/mo billed directly in Bangladeshi Taka. Pay with personal or merchant bKash, Nagad, Rocket, or local debit. Zero dollar cards, zero bank approvals.</div>
                </div>

                <div className="console-metric-list">
                  <div className="console-metric-item">
                    <span>Monthly Software Bill</span>
                    <span className="console-metric-val console-val-success">Flat ৳ 399 – ৳ 1,499/mo BDT</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Payment Channels</span>
                    <span className="console-metric-val console-val-success">bKash, Nagad, Rocket, local debit</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Doctor Multi-Chambers</span>
                    <span className="console-metric-val console-val-success">BMDC verified badge, 4 chambers</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Dine-In Table Orders</span>
                    <span className="console-metric-val console-val-success">Table QR token, live tray dispatch</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Bangla Complex Ligatures</span>
                    <span className="console-metric-val console-val-success">Native Hind Siliguri edge subsetting</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Honest Decision Matrix (When to Choose) */}
      <section className="compare-section">
        <div className="compare-container">
          <div className="decision-grid">
            <div className="decision-card decision-card-teal">
              <span className="decision-card-eyebrow teal">
                <span>✓</span> When to Choose BizTrackBD Business
              </span>
              <h3>For Bangladeshi Doctors, Dining &amp; Service Firms</h3>
              <ul className="decision-list">
                <li>
                  <span style={{ color: "#0D9488", fontWeight: 700 }}>✓</span>
                  <span><strong>Zero dollar cards:</strong> Pay in Bangladeshi Taka via bKash, Nagad, or debit cards (৳399 to ৳1,499/mo) without international quotas.</span>
                </li>
                <li>
                  <span style={{ color: "#0D9488", fontWeight: 700 }}>✓</span>
                  <span><strong>Bangladeshi vertical realities:</strong> BMDC doctor registration badges, visiting chambers across Banani/Dhanmondi, and QR dining table trays.</span>
                </li>
                <li>
                  <span style={{ color: "#0D9488", fontWeight: 700 }}>✓</span>
                  <span><strong>WhatsApp lead velocity:</strong> Centralized Lead &amp; Booking Inbox with 1-tap WhatsApp chat initiation and internal staff notes.</span>
                </li>
                <li>
                  <span style={{ color: "#0D9488", fontWeight: 700 }}>✓</span>
                  <span><strong>Crisp mobile Bengali:</strong> Native font subsetting for flawless typography on Grameenphone, Robi, and Banglalink connections.</span>
                </li>
              </ul>
            </div>

            <div className="decision-card decision-card-neutral">
              <span className="decision-card-eyebrow neutral">
                <span>✦</span> When to Choose Wix
              </span>
              <h3>For Global Creative Agencies &amp; Pixel Customizers</h3>
              <ul className="decision-list">
                <li>
                  <span style={{ color: "#94A3B8", fontWeight: 700 }}>•</span>
                  <span><strong>Free-form pixel canvas:</strong> Drag and drop any visual element to arbitrary coordinates on an unconstrained design canvas.</span>
                </li>
                <li>
                  <span style={{ color: "#94A3B8", fontWeight: 700 }}>•</span>
                  <span><strong>Global App Market:</strong> Access over 300 specialized niche extensions, Western booking widgets, and international marketing add-ons.</span>
                </li>
                <li>
                  <span style={{ color: "#94A3B8", fontWeight: 700 }}>•</span>
                  <span><strong>European &amp; US clientele:</strong> Your audience is primarily Western, speaks English or European languages, and transacts via Stripe/PayPal.</span>
                </li>
                <li>
                  <span style={{ color: "#94A3B8", fontWeight: 700 }}>•</span>
                  <span><strong>USD card budget:</strong> You hold an active corporate dual-currency credit card and are comfortable with ongoing dollar exchange tax.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison Table V2 */}
      <section className="compare-section" style={{ background: "#FFFFFF" }}>
        <div className="compare-container">
          <div className="compare-header-row">
            <h2>Detailed Feature &amp; Operational Comparison</h2>
            <p>
              Side-by-side evaluation of business features, local payments, and operational efficiency in Bangladesh.
            </p>
          </div>

          <div className="table-wrapper-card">
            <table className="comparison-table-v2">
              <thead>
                <tr>
                  <th style={{ width: "28%" }}>Capability</th>
                  <th className="cell-highlight-teal" style={{ width: "28%" }}>
                    <div className="flex items-center gap-1.5" style={{ color: "#0F766E", fontWeight: 800 }}>
                      <span>🏛️ BizTrackBD Business</span>
                    </div>
                  </th>
                  <th style={{ width: "24%" }}>Wix</th>
                  <th style={{ width: "20%" }}>Operational Impact</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, color: "var(--ink)" }}>
                      {row.feature}
                    </td>
                    <td className="cell-highlight-teal">
                      <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                        {row.biztrack}
                      </div>
                      <span className="spec-chip-positive">✓ Native BDT</span>
                    </td>
                    <td>
                      <div style={{ color: "var(--ink-2)", marginBottom: 4 }}>{row.wix}</div>
                      <span className="spec-chip-negative">— USD Card Required</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color: "#0F766E" }}>
                        {row.verdict}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* TCO Annual Savings Banner */}
      <section className="compare-section" style={{ background: "#FFFFFF" }}>
        <div className="compare-container">
          <div className="tco-savings-banner">
            <div>
              <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 9999, background: "rgba(13, 148, 136, 0.2)", border: "1px solid rgba(45, 212, 191, 0.3)", color: "#2DD4BF", fontSize: 11.5, fontWeight: 800, marginBottom: 8 }}>
                ANNUAL COST REALITY
              </span>
              <h3 style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 800, color: "#FFFFFF", margin: "6px 0 8px" }}>
                Save ৳ 25,000 to ৳ 45,000 Every Year on Software Bills
              </h3>
              <p style={{ fontSize: 14, color: "#CBD5E1", lineHeight: 1.6, maxWidth: 600 }}>
                By switching from Wix USD billing and eliminating bank foreign exchange surcharges, third-party WhatsApp popups, and currency friction, your business keeps hard-earned profits in local currency.
              </p>
            </div>
            <div>
              <Link
                href="/start?mode=business"
                className="btn btn-teal btn-lg"
                style={{ background: "#14B8A6", color: "#042F2E", fontWeight: 800 }}
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="compare-section-subtle">
        <div className="compare-container">
          <div className="stage-section-title">
            <h2>Frequently Asked Questions: BizTrackBD vs Wix</h2>
            <p>
              Direct, transparent answers regarding local currency payments, clinic schedules, and Bangla typography.
            </p>
          </div>

          <div className="faq-grid-v2">
            {WIX_FAQS.map((faq, idx) => (
              <div key={idx} className="faq-card-v2">
                <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4 }}>
                  {faq.q}
                </h3>
                <p style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 8, lineHeight: 1.55 }}>
                  {faq.a}
                </p>
              </div>
            ))}
          </div>

          <div className="compare-footer-cta">
            <p>Ready to launch an authentic business website with zero dollar credit cards?</p>
            <div className="compare-btn-row" style={{ justifyContent: "center" }}>
              <Link
                href="/start?mode=business"
                className="btn btn-teal btn-lg"
              >
                Start 14-Day Free Trial
              </Link>
              <Link
                href="/business/templates"
                className="btn btn-secondary btn-lg"
              >
                Browse Business Templates
              </Link>
            </div>
          </div>
        </div>
      </section>

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
                    "name": "Compare",
                    "item": "https://biztrackbd.com/compare",
                  },
                  {
                    "@type": "ListItem",
                    "position": 3,
                    "name": "Wix vs BizTrackBD",
                    "item": "https://biztrackbd.com/compare/wix",
                  },
                ],
              },
              {
                "@type": "FAQPage",
                "mainEntity": WIX_FAQS.map((faq) => ({
                  "@type": "Question",
                  "name": faq.q,
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": faq.a,
                  },
                })),
              },
            ],
          }),
        }}
      />
    </div>
  );
}
