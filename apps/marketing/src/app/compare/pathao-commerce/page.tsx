import type { Metadata } from "next";
import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";
import { TcoCalculator } from "@/components/tco-calculator";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: {
    absolute: "BizTrackBD vs Pathao Commerce: Multi-Courier Choice & Brand Ownership (Oct 2026)",
  },
  description:
    "An honest comparison of BizTrackBD vs Pathao Commerce for Bangladesh online sellers. Compare single-carrier lock-in vs multi-courier choice (Steadfast, Pathao, RedX), custom domain ownership, and COD fraud protection.",
  alternates: {
    canonical: `${siteUrl}/compare/pathao-commerce`,
  },
};

const PATHAO_FAQS = [
  {
    q: "Why is multi-courier dispatch important for a Bangladeshi online business?",
    a: "No single courier has the best price or delivery performance everywhere in Bangladesh. For example, Pathao excels at same-day and next-day deliveries inside Dhaka metro, while Steadfast has an unmatched ground network in rural upazilas and smaller district towns with lower delivery fees (typically ৳ 130 vs ৳ 150). Locking your business into one courier prevents you from rate-shopping and exposes you to operational bottlenecks when that courier experiences seasonal rider strikes or backlog.",
  },
  {
    q: "Can I use Pathao Courier on BizTrackBD?",
    a: "Yes! BizTrackBD does not compete with couriers—we are an independent operating system. You connect your own Pathao Courier Merchant API key and can book Pathao pickups with 1 click. You can also connect Steadfast and RedX side by side, allowing you to choose the best courier for each specific customer address.",
  },
  {
    q: "Does Pathao Commerce allow custom domains and independent Meta Pixel / CAPI tracking?",
    a: "Pathao Commerce primarily hosts storefronts within the Pathao ecosystem. BizTrackBD gives you complete brand autonomy: your own custom domain (yourbrand.com or yourbrand.com.bd) with free SSL, direct ownership of customer order histories, and dedicated server-side Meta Conversions API (CAPI) tracking for resilient ad attribution alongside browser tracking.",
  },
  {
    q: "When is Pathao Commerce legitimately the better choice?",
    a: "Pathao Commerce is a great choice if you are a casual hobbyist or social seller testing products on Facebook, only deliver parcels within Dhaka city, and want a simple checkout link without setting up custom domains or managing multiple carrier contracts.",
  },
];

const COMPARISON_ROWS = [
  {
    feature: "Courier Provider Freedom",
    pathao: "Locked to Pathao Courier exclusively",
    biztrack: "Multi-carrier choice: Steadfast, Pathao, RedX side by side",
    verdict: "BizTrackBD allows rate-shopping and backup courier routing",
  },
  {
    feature: "Outside-Dhaka Shipping Rates",
    pathao: "Standard Pathao outside-Dhaka rates (~৳ 150/parcel)",
    biztrack: "Freedom to dispatch via Steadfast outside Dhaka (~৳ 130/parcel)",
    verdict: "Save ৳ 20+ per parcel on outside-Dhaka deliveries",
  },
  {
    feature: "Brand Autonomy & Custom Domain",
    pathao: "Subdomain within Pathao commerce ecosystem",
    biztrack: "Full custom domain (yourbrand.com / yourbrand.com.bd) with SSL",
    verdict: "Build your own long-term brand equity with BizTrackBD",
  },
  {
    feature: "Meta Pixel & Conversions API (CAPI)",
    pathao: "Basic client-side tracking subject to ad-blockers",
    biztrack: "Dual browser Pixel + server CAPI deduplication with SHA-256",
    verdict: "Recovers 15–25% of lost attribution data from iOS users",
  },
  {
    feature: "National COD Fraud Detection",
    pathao: "Limited to internal Pathao delivery history",
    biztrack: "Cross-checks delivery track records across Steadfast & Pathao",
    verdict: "Comprehensive protection against serial parcel rejectors",
  },
  {
    feature: "True Profit & Expense Ledger",
    pathao: "Basic order total tracking",
    biztrack: "Waterfall ledger deducting wholesale cost, courier fee, & ad spend",
    verdict: "See exact net Taka profit per order after all operational expenses",
  },
];

export default function ComparePathaoCommercePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "BizTrackBD vs Pathao Commerce: Multi-Courier Choice & Brand Ownership",
    description:
      "Honest comparison between BizTrackBD and Pathao Commerce for Bangladeshi online retailers, covering courier independence and brand ownership.",
    publisher: {
      "@type": "Organization",
      name: "BizTrackBD",
      url: siteUrl,
    },
    mainEntity: {
      "@type": "FAQPage",
      mainEntity: PATHAO_FAQS.map((faq) => ({
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

      {/* Hero Header */}
      {/* Hero Header with Gradient Mesh */}
      <section className="gradient-mesh-hero compare-section-hero">
        <div className="compare-container">
          <div className="compare-breadcrumb">
            <Link href="/compare">
              ← All Platform Comparisons
            </Link>
            <span>/</span>
            <span style={{ fontWeight: 700, color: "#EA580C" }}>BizTrackBD vs Pathao Commerce</span>
          </div>

          <div className="pill-tag-banner pill-tag-orange">
            <span className="pulse-dot-orange" />
            <span>HONEST BANGLADESH MARKET COMPARISON • 2026</span>
          </div>

          <h1 className="compare-hero-title">
            BizTrackBD vs Pathao Commerce: <br />
            <span className="gradient-text-orange">
              Multi-Courier Freedom &amp; Brand Sovereignty
            </span>
          </h1>

          <p className="compare-hero-desc">
            Pathao Commerce provides a convenient starting point if you exclusively deliver with Pathao. But serious eCommerce brands in Bangladesh need multi-courier flexibility, custom domain identity (yourbrand.com), and independent customer data sovereignty. Here is an authentic, balanced look at the operational differences.
          </p>

          <div className="compare-btn-row">
            <Link
              href="/start"
              className="btn btn-orange btn-lg"
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
              <span>🚚</span>
              <span><strong>Courier Choice:</strong> Steadfast, Pathao &amp; RedX multi-booking vs single Pathao lock-in</span>
            </div>
            <div className="metric-pill">
              <span>🌐</span>
              <span><strong>Brand Identity:</strong> Custom root domain (yourbrand.com) vs pathaoshop.com/subdomain</span>
            </div>
            <div className="metric-pill">
              <span>💰</span>
              <span><strong>Outside-Dhaka Margin:</strong> Save ৳20/parcel with Steadfast vs ৳150 Pathao standard fee</span>
            </div>
            <div className="metric-pill">
              <span>📊</span>
              <span><strong>Audience Data:</strong> 100% customer phone &amp; purchase export vs closed platform audience</span>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Comparison Console Stage */}
      <section className="compare-section-subtle">
        <div className="compare-container">
          <div className="stage-section-title">
            <span className="eyebrow" style={{ color: "#EA580C" }}>Interactive Simulation</span>
            <h2>Logistics Routing &amp; Brand Sovereignty</h2>
            <p>
              What happens behind the scenes when routing orders across Dhaka and 64 national districts.
            </p>
          </div>

          <div className="comparison-preview-stage shadow-xl">
            <div className="comparison-window-header">
              <div className="comparison-window-dots">
                <span className="window-dot dot-red" />
                <span className="window-dot dot-yellow" />
                <span className="window-dot dot-green" />
              </div>
              <span className="text-xs font-mono text-slate-400">dispatch-logistics-optimizer.sim</span>
            </div>

            <div className="split-console">
              {/* Left Pane: Pathao Commerce */}
              <div className="console-pane console-pane-legacy">
                <div className="console-pane-header">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>Pathao Commerce Ecosystem</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>Single-carrier closed network</div>
                  </div>
                  <span className="console-status-pill-fail">CARRIER LOCK-IN</span>
                </div>

                <div style={{ borderRadius: 8, background: "rgba(127, 29, 29, 0.4)", border: "1px solid rgba(185, 28, 28, 0.4)", padding: 12, fontSize: 12, color: "#FECACA" }}>
                  <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "#FCA5A5", marginBottom: 4 }}>
                    <span>⚠️</span> Restricted Carrier Choice &amp; Subdomain Lock
                  </div>
                  <div>Locked to Pathao logistics only. Cannot route outside-Dhaka orders to Steadfast (paying ৳150 instead of ৳130). When local hub backlogs occur, merchant has no fallback courier. Customer purchases on platform subdomain without building independent brand equity.</div>
                </div>

                <div className="console-metric-list">
                  <div className="console-metric-item">
                    <span>Carrier Flexibility</span>
                    <span className="console-metric-val console-val-fail">Pathao riders only</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Outside-Dhaka Rate</span>
                    <span className="console-metric-val console-val-fail">৳150 flat fee</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Brand Domain</span>
                    <span className="console-metric-val console-val-fail">pathaoshop.com/subdomain</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Customer Data Equity</span>
                    <span className="console-metric-val console-val-fail">Platform ecosystem lock-in</span>
                  </div>
                </div>
              </div>

              {/* Right Pane: BizTrackBD */}
              <div className="console-pane console-pane-biztrack">
                <div className="console-pane-header">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>BizTrackBD Sovereign Multi-Courier</div>
                    <div style={{ fontSize: 11, color: "#6EE7B7" }}>Independent Merchant Operating Desk</div>
                  </div>
                  <span className="console-status-pill-success">MULTI-CARRIER DESK</span>
                </div>

                <div style={{ borderRadius: 8, background: "rgba(6, 78, 59, 0.4)", border: "1px solid rgba(16, 185, 129, 0.4)", padding: 12, fontSize: 12, color: "#A7F3D0" }}>
                  <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "#6EE7B7", marginBottom: 4 }}>
                    <span>✓</span> Intelligent Carrier Dispatch &amp; Full Brand Ownership
                  </div>
                  <div>Multi-carrier flexibility: Pathao for express Dhaka same-day, Steadfast for 64 districts at flat ৳130 (saves ৳10,000+/mo on 500 parcels). Custom domain (yourbrand.com) with SSL. 100% customer phone &amp; order history data ownership.</div>
                </div>

                <div className="console-metric-list">
                  <div className="console-metric-item">
                    <span>Carrier Flexibility</span>
                    <span className="console-metric-val console-val-success">Steadfast, Pathao, RedX &amp; Paperfly</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Outside-Dhaka Rate</span>
                    <span className="console-metric-val console-val-success">৳130 (Save ৳20/parcel)</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Brand Domain</span>
                    <span className="console-metric-val console-val-success">Custom Root Domain (SSL)</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Customer Data Equity</span>
                    <span className="console-metric-val console-val-success">100% Sovereign Data Ownership</span>
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
            <span className="eyebrow" style={{ color: "#EA580C" }}>Decision Matrix</span>
            <h2>The Honest Verdict: Who is each platform for?</h2>
            <p>
              We believe in vendor neutrality. Choose the platform that best fits your business stage and long-term brand goals.
            </p>
          </div>

          <div className="decision-grid">
            {/* Choose Pathao Commerce If */}
            <div className="decision-card decision-card-neutral">
              <div className="decision-card-eyebrow neutral">
                <span>📦</span> Choose Pathao Commerce If
              </div>
              <h3>You are a casual social chat seller</h3>
              <ul className="decision-list">
                <li>
                  <span style={{ color: "#16A34A", fontWeight: "bold" }}>✓</span>
                  <span><strong>Casual Chat Commerce:</strong> You are an individual social seller sharing occasional product links directly inside Facebook Messenger chats.</span>
                </li>
                <li>
                  <span style={{ color: "#16A34A", fontWeight: "bold" }}>✓</span>
                  <span><strong>Dhaka-Centric Deliveries:</strong> You deliver almost exclusively within Dhaka metropolitan areas using Pathao riders.</span>
                </li>
                <li>
                  <span style={{ color: "#16A34A", fontWeight: "bold" }}>✓</span>
                  <span><strong>Zero Technical Setup:</strong> You do not need a custom .com or .com.bd brand domain and want zero DNS configuration.</span>
                </li>
                <li>
                  <span style={{ color: "#16A34A", fontWeight: "bold" }}>✓</span>
                  <span><strong>Immediate Pickup:</strong> You want instant courier rider calls without creating commercial merchant logistics accounts.</span>
                </li>
              </ul>
            </div>

            {/* Choose BizTrackBD If */}
            <div className="decision-card decision-card-orange">
              <div className="decision-card-eyebrow orange">
                <span>🚀</span> Choose BizTrackBD If
              </div>
              <h3>You are scaling an eCommerce brand</h3>
              <ul className="decision-list">
                <li>
                  <span style={{ color: "#EA580C", fontWeight: "bold" }}>✓</span>
                  <span><strong>Multi-Courier Choice:</strong> Dispatch via Pathao inside Dhaka, but switch to Steadfast outside Dhaka to save ৳20/parcel.</span>
                </li>
                <li>
                  <span style={{ color: "#EA580C", fontWeight: "bold" }}>✓</span>
                  <span><strong>Custom Brand Identity:</strong> Build long-term brand equity on your own custom domain (yourbrand.com) with SEO ranking.</span>
                </li>
                <li>
                  <span style={{ color: "#EA580C", fontWeight: "bold" }}>✓</span>
                  <span><strong>Meta Ads Server-Side CAPI:</strong> Run high-ROI Facebook &amp; Instagram campaigns with server-side event tracking.</span>
                </li>
                <li>
                  <span style={{ color: "#EA580C", fontWeight: "bold" }}>✓</span>
                  <span><strong>COD Fraud Prevention:</strong> Stop serial parcel rejectors across 5,000+ stores before paying courier delivery and return fees.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* The Danger of Single-Carrier Lock-in */}
      <section className="py-16 border-b border-[var(--border)] bg-[var(--surface-subtle)]">
        <div className="compare-container">
          <div className="stage-section-title">
            <span className="eyebrow" style={{ color: "#EA580C" }}>Logistics Independence</span>
            <h2>Why Locking Your Store to One Courier Restricts Growth</h2>
            <p>
              Why relying on a single delivery partner creates hidden costs and operational bottlenecks.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
            <div className="decision-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "17px", margin: 0 }}>1. Steadfast is ৳20 Cheaper Outside Dhaka</h3>
                <span className="status-stamp stamp-risk">Price Margin</span>
              </div>
              <p style={{ fontSize: "13.5px", color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
                For retail brands in Bangladesh, 60% to 70% of deliveries occur outside Dhaka. Pathao typically charges ৳150 for outside-Dhaka parcels, while Steadfast charges approximately ৳130. On 500 outside-Dhaka orders each month, a single-courier lock-in costs your business an extra <strong>৳10,000 every single month</strong> in unnecessary shipping expenses.
              </p>
            </div>

            <div className="decision-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "17px", margin: 0 }}>2. District Hub Coverage Varies Significantly</h3>
                <span className="status-stamp stamp-review">Zone Agility</span>
              </div>
              <p style={{ fontSize: "13.5px", color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
                In certain rural upazilas in Rajshahi, Rangpur, or Barisal, Steadfast maintains dedicated physical delivery hubs where Pathao relies on third-party sub-contractors. When parcels get delayed or refused, you need the operational agility to switch courier providers instantly based on recipient upazila.
              </p>
            </div>

            <div className="decision-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "17px", margin: 0 }}>3. Customer Loyalty Belongs to Your Domain</h3>
                <span className="status-stamp stamp-paid">Data Sovereignty</span>
              </div>
              <p style={{ fontSize: "13.5px", color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
                When customers purchase on your own domain (yourbrand.com), your brand builds repeat value and direct customer goodwill. Selling inside a delivery app&apos;s ecosystem makes you vulnerable to algorithm changes and third-party policy shifts.
              </p>
            </div>

            <div className="decision-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "17px", margin: 0 }}>4. True Net Taka Profit Waterfall</h3>
                <span className="status-stamp stamp-lead">Profit Ledger</span>
              </div>
              <p style={{ fontSize: "13.5px", color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
                BizTrackBD provides a real-time waterfall profit ledger that subtracts product cost of goods sold (COGS), actual courier shipping fees, packaging costs, and ad spend to reveal what you actually earned in Taka on each order before courier payout disbursement.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Breakdown Table */}
      <section className="py-16 border-b border-[var(--border)]">
        <div className="compare-container">
          <div className="compare-header-row">
            <span className="eyebrow" style={{ color: "#EA580C" }}>
              Capability Comparison
            </span>
            <h2>Pathao Commerce vs BizTrackBD Matrix</h2>
            <p>
              Compare independent merchant ownership against a single-courier platform ecosystem.
            </p>
          </div>

          <div className="table-wrapper-card">
            <table className="comparison-table-v2">
              <thead>
                <tr>
                  <th style={{ width: "26%" }}>Capability</th>
                  <th className="cell-highlight-primary" style={{ width: "28%" }}>
                    <div className="flex items-center gap-1.5" style={{ color: "#1E3A8A", fontWeight: 800 }}>
                      <span>🛍️ BizTrackBD</span>
                    </div>
                  </th>
                  <th style={{ width: "26%" }}>Pathao Commerce</th>
                  <th style={{ width: "20%" }}>Operational Advantage</th>
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
                      <span className="spec-chip-positive">✓ Merchant Ownership</span>
                    </td>
                    <td>
                      <div className="text-[var(--muted)] mb-1">{row.pathao}</div>
                      <span className="spec-chip-negative">— Single Courier Lock-in</span>
                    </td>
                    <td>
                      <span className="text-[11px] font-mono font-semibold" style={{ color: "#EA580C" }}>
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

      {/* Interactive TCO Calculator */}
      <section className="compare-section-subtle">
        <div className="compare-container">
          <TcoCalculator initialCompetitor="pathao" hideSelector={true} />
        </div>
      </section>

      {/* FAQs */}
      <section className="compare-section">
        <div className="compare-container">
          <div className="stage-section-title">
            <h2>Frequently Asked Questions: Pathao Commerce vs BizTrackBD</h2>
            <p>
              Independent answers on courier integration, domain ownership, and store migration.
            </p>
          </div>

          <div className="faq-grid-v2">
            {PATHAO_FAQS.map((faq, idx) => (
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
            <p>Ready to gain multi-courier freedom and full brand ownership?</p>
            <div className="compare-btn-row" style={{ justifyContent: "center" }}>
              <Link
                href="/start"
                className="btn btn-orange btn-lg"
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
    </div>
  );
}
