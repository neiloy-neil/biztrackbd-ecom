import type { Metadata } from "next";
import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";
import { TcoCalculator } from "@/components/tco-calculator";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: {
    absolute: "BizTrackBD vs WooCommerce: Why Bangladeshi Brands Leave WordPress (Oct 2026)",
  },
  description:
    "An honest comparison of BizTrackBD vs WooCommerce in Bangladesh. Compare server crashes during Eid sales, expensive plugin renewals, manual courier booking, and cross-merchant COD fraud prevention.",
  alternates: {
    canonical: `${siteUrl}/compare/woocommerce`,
  },
};

const WOO_FAQS = [
  {
    q: "Why do WooCommerce sites in Bangladesh frequently crash during Eid flash sales?",
    a: "WooCommerce runs on a single relational database (MySQL) where every product view, cart update, and checkout writes to the `wp_posts` and `wp_postmeta` tables. When hundreds of shoppers click your Facebook ad simultaneously during an Eid campaign, database queries queue up, causing memory exhaustion and the dreaded '502 Bad Gateway' error. BizTrackBD uses modern server-rendered edge infrastructure with isolated tenant scaling that absorbs sudden traffic spikes effortlessly.",
  },
  {
    q: "How does BizTrackBD prevent COD return fraud compared to WooCommerce?",
    a: "On WooCommerce, you only have access to your own store's order history. If a serial parcel rejector orders from you for the first time, you have no way of knowing their track record. BizTrackBD connects directly to courier delivery histories across Steadfast and Pathao networks, checking whether a customer's phone number has a high parcel refusal rate before you pack and dispatch the order.",
  },
  {
    q: "Isn't WooCommerce 'free' since it is open source?",
    a: "While the WordPress core software is free, running a reliable eCommerce store is definitely not. A Bangladesh brand with 500+ monthly orders typically spends ৳ 3,000–৳ 5,000/month on cloud VPS hosting (to prevent crashes), ৳ 2,000–৳ 3,000/month on amortized premium plugin licenses (bKash gateways, courier bridges, SMS plugins), and thousands more on developer maintenance to fix plugin conflicts after WordPress updates.",
  },
  {
    q: "When is WooCommerce genuinely the better choice?",
    a: "WooCommerce is the right choice if you have dedicated, full-time PHP engineers on your payroll who need direct root access to the database, want to build custom server-side algorithms, or integrate with legacy enterprise ERPs that require custom on-premise WordPress hooks.",
  },
  {
    q: "Can I import my WooCommerce products and categories into BizTrackBD?",
    a: "Yes. From your WooCommerce admin, go to Products → Export and generate a CSV. You can import this file directly into BizTrackBD in a few clicks. Product titles, variations, pricing, SKUs, and images will migrate seamlessly.",
  },
];

const COMPARISON_ROWS = [
  {
    feature: "Infrastructure & Server Maintenance",
    woo: "Self-hosted VPS; you are responsible for PHP, MySQL, SSL & caching",
    biztrack: "Fully managed Next.js edge infrastructure; zero server maintenance",
    verdict: "Zero DevOps or server administration required on BizTrackBD",
  },
  {
    feature: "Flash Sale Scalability (Eid / Payday)",
    woo: "Frequently crashes with 502 errors due to MySQL database lockup",
    biztrack: "Serverless edge architecture handles high concurrency traffic effortlessly",
    verdict: "Never lose a sale during high-budget Facebook ad campaigns",
  },
  {
    feature: "National COD Fraud Checker",
    woo: "Isolated to your own store history only; blind to external fraudsters",
    biztrack: "Built-in delivery track record check across Pathao & Steadfast networks",
    verdict: "Stop serial COD returners before wasting courier fees",
  },
  {
    feature: "Courier Integration (Steadfast, Pathao, RedX)",
    woo: "Requires multiple separate third-party plugins with annual renewals",
    biztrack: "Native 1-click booking, thermal barcode labels, & automated status sync",
    verdict: "Single unified dispatch desk without fragile plugin bridges",
  },
  {
    feature: "bKash & Nagad Checkout Experience",
    woo: "Requires third-party gateway plugins that break on WordPress major updates",
    biztrack: "Native TrxID checkout with 1-tap verification desk built into the core",
    verdict: "Zero broken checkout flows after platform updates",
  },
  {
    feature: "Security & Vulnerability Management",
    woo: "Constant vulnerability patches; plugin exploits compromise customer data",
    biztrack: "Isolated multi-tenant architecture; AES-256 secret vault; automatic patching",
    verdict: "Eliminates malware injections and customer database leaks",
  },
  {
    feature: "Source Code Customization",
    woo: "100% open-source PHP; customize anything at the database level",
    biztrack: "Curated modern template engine with custom CSS & domain support",
    verdict: "WooCommerce wins if you have an in-house software engineering team",
  },
];

export default function CompareWooCommercePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "BizTrackBD vs WooCommerce: Why Bangladeshi Brands Leave WordPress",
    description:
      "A realistic comparison of BizTrackBD vs WooCommerce for Bangladesh eCommerce, analyzing hosting costs, flash sale stability, and courier integrations.",
    publisher: {
      "@type": "Organization",
      name: "BizTrackBD",
      url: siteUrl,
    },
    mainEntity: {
      "@type": "FAQPage",
      mainEntity: WOO_FAQS.map((faq) => ({
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
            <span style={{ fontWeight: 700, color: "#11795A" }}>BizTrackBD vs WooCommerce</span>
          </div>

          <div className="pill-tag-banner pill-tag-purple">
            <span className="pulse-dot-purple" />
            <span>HONEST BANGLADESH MARKET COMPARISON • 2026</span>
          </div>

          <h1 className="compare-hero-title">
            BizTrackBD vs WooCommerce in Bangladesh: <br />
            <span className="gradient-text-purple">
              Why Brands Leave WordPress Behind
            </span>
          </h1>

          <p className="compare-hero-desc">
            WooCommerce offers complete source-code freedom. But running it reliably in Bangladesh means managing server crashes during flash sales, juggling 20+ conflicting plugins, dealing with unverified COD returns, and paying expensive developer retainers. Here is an authentic, balanced look at the trade-offs.
          </p>

          <div className="compare-btn-row">
            <Link
              href="/start"
              className="btn btn-purple btn-lg"
            >
              Start 14-Day Free Trial →
            </Link>
            <a
              href={demoAdminUrl()}
              className="btn btn-secondary btn-lg"
            >
              Explore Live Store &amp; Courier Desk ↗
            </a>
          </div>

          {/* Key Reality Metric Pills */}
          <div className="metric-pill-row">
            <div className="metric-pill">
              <span>⚡</span>
              <span><strong>Traffic Spikes:</strong> Edge CDN &lt;85ms TTFB vs MySQL 502 Bad Gateway under 500+ shoppers</span>
            </div>
            <div className="metric-pill">
              <span>🔌</span>
              <span><strong>Plugin Maintenance:</strong> 0 extra plugins vs 20+ plugins ($300+/yr) prone to breaking on core updates</span>
            </div>
            <div className="metric-pill">
              <span>📦</span>
              <span><strong>Logistics Ops:</strong> Native Steadfast &amp; Pathao 1-click dispatch vs fragile community connectors</span>
            </div>
            <div className="metric-pill">
              <span>💰</span>
              <span><strong>True Annual Cost:</strong> From ৳6,990/yr (৳699/mo) vs ৳45,000–৳90,000/yr (VPS + licenses + dev retainers)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Comparison Console Stage */}
      <section className="compare-section-subtle">
        <div className="compare-container">
          <div className="stage-section-title">
            <span className="eyebrow" style={{ color: "#11795A" }}>Interactive Simulation</span>
            <h2>Checkout &amp; Order Pipeline Under Heavy Traffic</h2>
            <p>
              What happens behind the scenes when a campaign surge hits a WordPress store in Bangladesh.
            </p>
          </div>

          <div className="comparison-preview-stage shadow-xl">
            <div className="comparison-window-header">
              <div className="comparison-window-dots">
                <span className="window-dot dot-red" />
                <span className="window-dot dot-yellow" />
                <span className="window-dot dot-green" />
              </div>
              <span className="text-xs font-mono text-slate-400">woocommerce-order-pipeline.sim</span>
            </div>

            <div className="split-console">
              {/* Left Pane: WooCommerce */}
              <div className="console-pane console-pane-legacy">
                <div className="console-pane-header">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>WooCommerce (Self-Hosted VPS)</div>
                    <div style={{ fontSize: 11, color: "#8FD3B8" }}>24 active plugins + MySQL single node</div>
                  </div>
                  <span className="console-status-pill-fail">502 BAD GATEWAY</span>
                </div>

                <div style={{ borderRadius: 8, background: "rgba(154, 52, 18, 0.4)", border: "1px solid rgba(194, 65, 12, 0.4)", padding: 12, fontSize: 12, color: "#F2C9B3" }}>
                  <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "#F2B79B", marginBottom: 4 }}>
                    <span>⚠️</span> Plugin Conflict &amp; Database Lock
                  </div>
                  <div>PHP Fatal error after automated WooCommerce update. bKash gateway failed silently. Abandoned cart rate surged to 42%. MySQL memory exhausted during concurrent checkout. Emergency developer intervention required.</div>
                </div>

                <div className="console-metric-list">
                  <div className="console-metric-item">
                    <span>DevOps Overhead</span>
                    <span className="console-metric-val console-val-fail">Manual PHP/MySQL patching</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Courier Consignment</span>
                    <span className="console-metric-val console-val-fail">Fragile third-party webhooks</span>
                  </div>
                  <div className="console-metric-item">
                    <span>COD Return Insight</span>
                    <span className="console-metric-val console-val-fail">Zero national history data</span>
                  </div>
                  <div className="console-metric-item">
                    <span>True Annual Cost</span>
                    <span className="console-metric-val console-val-fail">৳45,000 - ৳90,000/year</span>
                  </div>
                </div>
              </div>

              {/* Right Pane: BizTrackBD */}
              <div className="console-pane console-pane-biztrack">
                <div className="console-pane-header">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>BizTrackBD Managed Platform</div>
                    <div style={{ fontSize: 11, color: "#8FD3B8" }}>Serverless Next.js Edge Architecture</div>
                  </div>
                  <span className="console-status-pill-success">100% UPTIME</span>
                </div>

                <div style={{ borderRadius: 8, background: "rgba(11, 77, 59, 0.4)", border: "1px solid rgba(17, 121, 90, 0.4)", padding: 12, fontSize: 12, color: "#C6DFD3" }}>
                  <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "#8FD3B8", marginBottom: 4 }}>
                    <span>✓</span> Zero Maintenance &amp; 1-Click Operations
                  </div>
                  <div>Zero plugin conflicts. Direct customer bKash TrxID verified in 1 tap. Real-time COD delivery rate verified across 5,000+ local merchants. Steadfast parcel booked with barcode sticker in 1 click. Edge TTFB: 68ms.</div>
                </div>

                <div className="console-metric-list">
                  <div className="console-metric-item">
                    <span>DevOps Overhead</span>
                    <span className="console-metric-val console-val-success">Zero (Fully Managed Edge)</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Courier Consignment</span>
                    <span className="console-metric-val console-val-success">1-Click Native API Booking</span>
                  </div>
                  <div className="console-metric-item">
                    <span>COD Return Insight</span>
                    <span className="console-metric-val console-val-success">National Delivery History Score</span>
                  </div>
                  <div className="console-metric-item">
                    <span>True Annual Cost</span>
                    <span className="console-metric-val console-val-success">From ৳6,990/yr (৳699/mo)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Two-Column Decision Grid */}
      <section className="py-16 border-b border-[var(--border)]">
        <div className="compare-container">
          <div className="stage-section-title">
            <span className="eyebrow" style={{ color: "#11795A" }}>Decision Matrix</span>
            <h2>The Honest Verdict: Who is each platform for?</h2>
            <p>
              We believe in vendor neutrality. Choose the platform that best fits your technical capability and operational focus.
            </p>
          </div>

          <div className="decision-grid">
            {/* Choose WooCommerce If */}
            <div className="decision-card decision-card-neutral">
              <div className="decision-card-eyebrow neutral">
                <span>💻</span> Choose WooCommerce If
              </div>
              <h3>You have dedicated software engineers</h3>
              <ul className="decision-list">
                <li>
                  <span style={{ color: "#11795A", fontWeight: "bold" }}>✓</span>
                  <span><strong>In-House Developers:</strong> You employ full-time software engineers who specialize in PHP and WordPress plugin development.</span>
                </li>
                <li>
                  <span style={{ color: "#11795A", fontWeight: "bold" }}>✓</span>
                  <span><strong>Custom Database Architecture:</strong> You require direct database-level customizations and custom server plugins.</span>
                </li>
                <li>
                  <span style={{ color: "#11795A", fontWeight: "bold" }}>✓</span>
                  <span><strong>Private Server Stack:</strong> You operate your own on-premise private cloud server infrastructure and custom firewalls.</span>
                </li>
                <li>
                  <span style={{ color: "#11795A", fontWeight: "bold" }}>✓</span>
                  <span><strong>DevOps Comfort:</strong> You are comfortable managing MySQL caching, security patches, Redis layers, and database indexing.</span>
                </li>
              </ul>
            </div>

            {/* Choose BizTrackBD If */}
            <div className="decision-card decision-card-purple">
              <div className="decision-card-eyebrow purple">
                <span>⚡</span> Choose BizTrackBD If
              </div>
              <h3>You want an automated commerce desk</h3>
              <ul className="decision-list">
                <li>
                  <span style={{ color: "#11795A", fontWeight: "bold" }}>✓</span>
                  <span><strong>100% Campaign Stability:</strong> You want a reliable online store that never crashes during Eid or Facebook ad traffic spikes.</span>
                </li>
                <li>
                  <span style={{ color: "#11795A", fontWeight: "bold" }}>✓</span>
                  <span><strong>Built-In Logistics:</strong> You want native multi-courier booking (Steadfast, Pathao, RedX) without buying buggy third-party plugins.</span>
                </li>
                <li>
                  <span style={{ color: "#11795A", fontWeight: "bold" }}>✓</span>
                  <span><strong>COD Fraud Prevention:</strong> You want a built-in fraud checker that verifies national courier delivery track records before dispatch.</span>
                </li>
                <li>
                  <span style={{ color: "#11795A", fontWeight: "bold" }}>✓</span>
                  <span><strong>Zero Maintenance Overhead:</strong> You want to focus on marketing and order fulfillment, not debugging broken plugin updates.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* The 4 WooCommerce Pain Points */}
      <section className="py-16 border-b border-[var(--border)] bg-[var(--surface-subtle)]">
        <div className="compare-container">
          <div className="stage-section-title">
            <span className="eyebrow" style={{ color: "#11795A" }}>Operational Friction</span>
            <h2>The Hidden Costs of Running WordPress in Bangladesh</h2>
            <p>
              Why standard WooCommerce stores turn into expensive maintenance sinks for local merchants.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
            <div className="decision-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "17px", margin: 0 }}>1. 502 Bad Gateway During Campaign Spikes</h3>
                <span className="status-stamp stamp-risk">Crash Risk</span>
              </div>
              <p style={{ fontSize: "13.5px", color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
                When you run Meta ads with heavy daily budgets, hundreds of simultaneous visitors overwhelm standard WordPress hosting. MySQL postmeta table locking causes transactions to stall, resulting in white screens and lost sales. BizTrackBD runs on autoscaling serverless edge architecture that absorbs traffic surges seamlessly.
              </p>
            </div>

            <div className="decision-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "17px", margin: 0 }}>2. Plugin Update Breakage &amp; Security Holes</h3>
                <span className="status-stamp stamp-review">Fragile Stack</span>
              </div>
              <p style={{ fontSize: "13.5px", color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
                A typical Bangladesh WooCommerce store requires 15–25 separate plugins: bKash gateways, courier connectors, SMS gateways, cache managers, and SEO tools. When WordPress updates, plugins often conflict, breaking checkout forms or exposing your customer database to malware attacks.
              </p>
            </div>

            <div className="decision-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "17px", margin: 0 }}>3. Blindness to Serial COD Rejectors</h3>
                <span className="status-stamp stamp-risk">No Fraud Data</span>
              </div>
              <p style={{ fontSize: "13.5px", color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
                WooCommerce only knows what happened on your own website. If a customer has a 30% delivery completion rate across other online stores, WooCommerce happily lets them place an order. You only find out after paying ৳135 for a refused return. BizTrackBD checks cross-network courier records instantly.
              </p>
            </div>

            <div className="decision-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "17px", margin: 0 }}>4. The Illusion of &quot;Free&quot; Software</h3>
                <span className="status-stamp stamp-paid">True TCO</span>
              </div>
              <p style={{ fontSize: "13.5px", color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
                Between high-spec VPS hosting (৳3,000/mo), paid plugin renewal licenses (৳2,500/mo), and developer retainer fees (৳4,000–৳10,000/mo), running WooCommerce reliably costs far more than BizTrackBD’s predictable, all-inclusive flat monthly subscription.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16 border-b border-[var(--border)]">
        <div className="compare-container">
          <div className="compare-header-row">
            <span className="eyebrow" style={{ color: "#11795A" }}>
              Head-to-Head Matrix
            </span>
            <h2>WooCommerce vs BizTrackBD Feature Breakdown</h2>
            <p>
              Compare self-hosted open-source complexity against our managed Bangladesh commerce engine.
            </p>
          </div>

          <div className="table-wrapper-card">
            <table className="comparison-table-v2">
              <thead>
                <tr>
                  <th style={{ width: "26%" }}>Capability</th>
                  <th className="cell-highlight-primary" style={{ width: "28%" }}>
                    <div className="flex items-center gap-1.5" style={{ color: "#0B4D3B", fontWeight: 800 }}>
                      <span>🛍️ BizTrackBD</span>
                    </div>
                  </th>
                  <th style={{ width: "26%" }}>WooCommerce (WordPress)</th>
                  <th style={{ width: "20%" }}>Business Value</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr key={idx}>
                    <td className="font-semibold text-[var(--foreground)]">{row.feature}</td>
                    <td className="cell-highlight-primary">
                      <div className="font-bold text-[var(--foreground)] mb-1">
                        {row.biztrack}
                      </div>
                      <span className="spec-chip-positive">✓ Native Operating Desk</span>
                    </td>
                    <td>
                      <div className="text-[var(--muted)] mb-1">{row.woo}</div>
                      <span className="spec-chip-negative">— Fragile Plugin Stack</span>
                    </td>
                    <td>
                      <span className="text-[11px] font-mono font-semibold" style={{ color: "#11795A" }}>
                        {row.verdict}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="migration-card-footer" style={{ marginTop: 24, borderTop: "1px solid var(--line)" }}>
            <div style={{ fontSize: 13, color: "var(--ink-2)", maxWidth: 500 }}>
              Already running a WooCommerce store? Export your catalog CSV and switch in 15 minutes with zero downtime.
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <Link
                href="/migrate/woocommerce"
                style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)" }}
              >
                Step-by-Step WooCommerce Migration Guide →
              </Link>
              <Link
                href="/contact"
                style={{ fontSize: 13, color: "var(--ink-3)" }}
              >
                Assisted Migration Support
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive TCO Calculator */}
      <section className="compare-section-subtle">
        <div className="compare-container">
          <TcoCalculator initialCompetitor="woocommerce" hideSelector={true} />
        </div>
      </section>

      {/* FAQs */}
      <section className="compare-section">
        <div className="compare-container">
          <div className="stage-section-title">
            <h2>Frequently Asked Questions: WooCommerce vs BizTrackBD</h2>
            <p>
              Technical trade-offs, server stability, and migration details.
            </p>
          </div>

          <div className="faq-grid-v2">
            {WOO_FAQS.map((faq, idx) => (
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
            <p>Ready to leave plugin conflicts and server crashes behind?</p>
            <div className="compare-btn-row" style={{ justifyContent: "center" }}>
              <Link
                href="/start"
                className="btn btn-purple btn-lg"
              >
                Start 14-Day Free Trial →
              </Link>
              <a
                href={demoAdminUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-lg"
              >
                Test Live Demo Desk ↗
              </a>
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
                    "name": "WooCommerce vs BizTrackBD",
                    "item": "https://biztrackbd.com/compare/woocommerce",
                  },
                ],
              },
              {
                "@type": "FAQPage",
                "mainEntity": WOO_FAQS.map((faq) => ({
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
