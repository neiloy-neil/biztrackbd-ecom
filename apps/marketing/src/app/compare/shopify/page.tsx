import type { Metadata } from "next";
import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";
import { TcoCalculator } from "@/components/tco-calculator";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: {
    absolute: "BizTrackBD vs Shopify in Bangladesh: An Honest Comparison (Oct 2026)",
  },
  description:
    "An honest, vendor-neutral comparison of BizTrackBD vs Shopify for Bangladesh eCommerce. Compare dollar credit card hurdles, 2% transaction cuts, native bKash checkout, Steadfast/Pathao courier booking, and true Taka costs.",
  alternates: {
    canonical: `${siteUrl}/compare/shopify`,
  },
};

const SHOPIFY_FAQS = [
  {
    q: "Why do so many Bangladeshi merchants struggle with Shopify?",
    a: "Shopify was architected for Western markets where shoppers pay via credit card and goods ship via FedEx or DHL. In Bangladesh, over 90% of online retail is Cash on Delivery, mobile wallets (bKash/Nagad), and local couriers (Steadfast, Pathao). Shopify requires a passport-endorsed dual-currency credit card, charges in USD, levies a 2.0% transaction penalty on third-party gateways, lacks native Division/District/Thana address dropdowns, and requires multiple expensive third-party apps just to operate in Bangladesh.",
  },
  {
    q: "Does Shopify charge a percentage of my sales in Bangladesh?",
    a: "Yes. Because Shopify Payments is not supported in Bangladesh, Shopify levies an additional 2.0% third-party transaction fee on every order processed on the Basic plan, on top of whatever local gateway fees you pay.",
  },
  {
    q: "How does BizTrackBD handle Bangladesh addresses differently than Shopify?",
    a: "Shopify uses Western address forms (Address Line 1, City, Postal Code, State) where Bangladeshi buyers frequently enter confusing fragments. BizTrackBD has built-in cascading dropdowns for all 8 Divisions, 64 Districts, and 495+ Upazilas/Thanas, ensuring couriers receive exact route codes and reducing refused or misdirected parcels.",
  },
  {
    q: "Can I migrate my existing products and inventory from Shopify to BizTrackBD?",
    a: "Yes. You can export your catalog CSV directly from your Shopify admin and import it into BizTrackBD in a few minutes. Product titles, descriptions, SKU, variants, inventory counts, and images map automatically.",
  },
  {
    q: "Can I use Shopify for a doctor clinic, restaurant, or professional service firm?",
    a: "Shopify is built exclusively around the shopping cart and physical product checkout. Attempting to use Shopify for a doctor clinic, law firm, or restaurant requires awkward workarounds, disabling buy buttons via custom liquid code, and paying $39+/month for retail e-commerce features you don't need. BizTrackBD offers dedicated Portfolio and Hybrid modes: you can start with pure appointment bookings and dining menus, and seamlessly unlock ecommerce delivery whenever you expand with 100% data preservation.",
  },
  {
    q: "When is Shopify legitimately better than BizTrackBD?",
    a: "Shopify is the superior platform if you are targeting international customers in North America or Europe, selling in USD, GBP, or EUR, accepting international credit cards via Stripe, or running global dropshipping operations with Oberlo/DSers.",
  },
];

const COMPARISON_ROWS = [
  {
    feature: "Operating Architecture (Multi-Mode)",
    shopify: "Rigid retail cart only; cannot run a clean clinic schedule or restaurant menu",
    biztrack: "3 distinct modes: Portfolio (leads & bookings), Hybrid (dual engine), or Commerce (pure retail)",
    verdict: "BizTrackBD adapts to service, dining, and retail models with zero data loss",
  },
  {
    feature: "Monthly Base Price",
    shopify: "$39 USD / month (≈ ৳ 5,600 with card tax)",
    biztrack: "Business from ৳399/mo · Commerce from ৳699/mo (Flat BDT)",
    verdict: "BizTrackBD saves ৳ 4,100–৳ 5,200 monthly on base software alone",
  },
  {
    feature: "Payment Method for Plan",
    shopify: "Requires International Credit Card with Passport Endorsement",
    biztrack: "Pay with personal or merchant bKash or Nagad wallet",
    verdict: "BizTrackBD requires no foreign travel quota or bank visits",
  },
  {
    feature: "Sales Commission / Transaction Cuts",
    shopify: "2.0% cut on every sale (Shopify Payments unavailable in BD)",
    biztrack: "0% sales commission — you keep 100% of revenue",
    verdict: "BizTrackBD charges zero percentage cuts on your turnover",
  },
  {
    feature: "Native bKash & Nagad Checkout",
    shopify: "Requires expensive monthly 3rd-party apps ($10–$25/mo)",
    biztrack: "Built-in checkout with customer TrxID & 1-tap verify desk",
    verdict: "BizTrackBD includes wallet checkout natively with zero extra app fees",
  },
  {
    feature: "Courier Booking (Steadfast, Pathao, RedX)",
    shopify: "Manual copy-pasting into courier portals or fragile webhooks",
    biztrack: "1-click native booking, bulk pickup requests, & shipping label printing",
    verdict: "BizTrackBD automates courier consignment creation out of the box",
  },
  {
    feature: "Bangladesh Address Fields",
    shopify: "Generic Western fields (postal codes cause customer confusion)",
    biztrack: "Native Division → District → Upazila cascading dropdowns",
    verdict: "BizTrackBD prevents courier misdirection and lost parcels",
  },
  {
    feature: "COD Return Fraud Checker",
    shopify: "No delivery track record check for Bangladeshi phone numbers",
    biztrack: "Built-in delivery track record check across Pathao & Steadfast networks",
    verdict: "BizTrackBD flags serial parcel rejectors before you pay courier fees",
  },
  {
    feature: "Bangla SMS Notifications",
    shopify: "Requires USD-billed Twilio account & manual webhook wiring",
    biztrack: "Built-in Bangla SMS for order confirmation & dispatch tracking",
    verdict: "BizTrackBD includes local SMS integration with zero developer setup",
  },
  {
    feature: "Mobile Storefront Speed on 4G",
    shopify: "Slows down to 3–6s as third-party apps inject unoptimized scripts",
    biztrack: "Sub-second load times (<0.8s) on mobile networks across Bangladesh",
    verdict: "BizTrackBD runs on modern server-rendered Next.js edge infrastructure",
  },
  {
    feature: "Global Multi-Currency Sales in USD",
    shopify: "Best-in-class multi-currency checkout & global app ecosystem",
    biztrack: "Engineered specifically for Bangladesh domestic commerce (BDT)",
    verdict: "Shopify wins for cross-border exports to the US/Europe",
  },
];

export default function CompareShopifyPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "BizTrackBD vs Shopify in Bangladesh: Honest Comparison",
    description:
      "Detailed analysis comparing BizTrackBD and Shopify for Bangladeshi eCommerce sellers, covering payments, couriers, and total Taka cost.",
    publisher: {
      "@type": "Organization",
      name: "BizTrackBD",
      url: "https://biztrack.bd",
    },
    mainEntity: {
      "@type": "FAQPage",
      mainEntity: SHOPIFY_FAQS.map((faq) => ({
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
            <span style={{ fontWeight: 700, color: "#4F46E5" }}>BizTrackBD vs Shopify</span>
          </div>

          <div className="pill-tag-banner pill-tag-indigo">
            <span className="pulse-dot-indigo" />
            <span>HONEST BANGLADESH MARKET COMPARISON • 2026</span>
          </div>

          <h1 className="compare-hero-title">
            BizTrackBD vs Shopify in Bangladesh: <br />
            <span className="gradient-text-indigo">
              The Real Cost &amp; Operational Reality
            </span>
          </h1>

          <p className="compare-hero-desc">
            Shopify is the global giant for cross-border trade. But for merchants selling domestically inside Bangladesh with Cash on Delivery, bKash, and local couriers, the hidden USD card requirements, 2.0% transaction penalties, and recurring app subscriptions add up fast. Here is an authentic, balanced breakdown.
          </p>

          <div className="compare-btn-row">
            <Link
              href="/start"
              className="btn btn-indigo btn-lg"
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
              <span>💳</span>
              <span><strong>Base Price:</strong> Business from ৳399/mo · Commerce from ৳699/mo (via bKash) vs $39 USD/mo</span>
            </div>
            <div className="metric-pill">
              <span>✂️</span>
              <span><strong>Sales Cut:</strong> 0% sales commission vs 2.0% penalty cut on every transaction</span>
            </div>
            <div className="metric-pill">
              <span>📦</span>
              <span><strong>Courier Ops:</strong> 1-Click Steadfast/Pathao auto-booking vs manual portal copy-pasting</span>
            </div>
            <div className="metric-pill">
              <span>🛡️</span>
              <span><strong>COD Defense:</strong> Built-in parcel rejection risk predictor vs zero delivery history insight</span>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Comparison Console Stage */}
      <section className="compare-section-subtle">
        <div className="compare-container">
          <div className="stage-section-title">
            <span className="eyebrow" style={{ color: "#4F46E5" }}>Interactive Simulation</span>
            <h2>Checkout &amp; Order Fulfillment in Bangladesh</h2>
            <p>
              What happens behind the scenes when a local shopper places an order via mobile phone.
            </p>
          </div>

          <div className="comparison-preview-stage shadow-xl">
            <div className="comparison-window-header">
              <div className="comparison-window-dots">
                <span className="window-dot dot-red" />
                <span className="window-dot dot-yellow" />
                <span className="window-dot dot-green" />
              </div>
              <span className="text-xs font-mono text-slate-400">bangladesh-checkout-experience.sim</span>
            </div>

            <div className="split-console">
              {/* Left Pane: Shopify */}
              <div className="console-pane console-pane-legacy">
                <div className="console-pane-header">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>Shopify Basic ($39/mo + Apps)</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>Global SaaS + fragmented local plugins</div>
                  </div>
                  <span className="console-status-pill-fail">2.0% PENALTY CUT</span>
                </div>

                <div style={{ borderRadius: 8, background: "rgba(127, 29, 29, 0.4)", border: "1px solid rgba(185, 28, 28, 0.4)", padding: 12, fontSize: 12, color: "#FECACA" }}>
                  <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "#FCA5A5", marginBottom: 4 }}>
                    <span>⚠️</span> Third-Party Gateway Penalty &amp; Address Confusion
                  </div>
                  <div>Shopify Payments unavailable in BD. Levied 2.0% extra penalty fee. Customer confused by Western ZIP code input. 4 injected app scripts increased mobile page weight to 2.4MB (4.6s load time). Requires manual copy-paste into Steadfast portal.</div>
                </div>

                <div className="console-metric-list">
                  <div className="console-metric-item">
                    <span>Transaction Penalty</span>
                    <span className="console-metric-val console-val-fail">+2.0% on every order</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Courier Dispatch</span>
                    <span className="console-metric-val console-val-fail">Manual portal data entry</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Address Input</span>
                    <span className="console-metric-val console-val-fail">Western Street / ZIP format</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Total Monthly Cost</span>
                    <span className="console-metric-val console-val-fail">≈ ৳8,500 - ৳12,000/mo</span>
                  </div>
                </div>
              </div>

              {/* Right Pane: BizTrackBD */}
              <div className="console-pane console-pane-biztrack">
                <div className="console-pane-header">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>BizTrackBD Commerce Platform</div>
                    <div style={{ fontSize: 11, color: "#6EE7B7" }}>Engineered for Bangladesh Domestic Retail</div>
                  </div>
                  <span className="console-status-pill-success">0% COMMISSION</span>
                </div>

                <div style={{ borderRadius: 8, background: "rgba(6, 78, 59, 0.4)", border: "1px solid rgba(16, 185, 129, 0.4)", padding: 12, fontSize: 12, color: "#A7F3D0" }}>
                  <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "#6EE7B7", marginBottom: 4 }}>
                    <span>✓</span> Instant bKash &amp; 1-Click Steadfast Automation
                  </div>
                  <div>Direct customer bKash TrxID verified in 1 tap. Native cascading Division → District → Upazila dropdowns prevented courier misdirection. Steadfast consignment created automatically with barcode label. Return fraud risk: LOW. TTFB: 72ms.</div>
                </div>

                <div className="console-metric-list">
                  <div className="console-metric-item">
                    <span>Transaction Commission</span>
                    <span className="console-metric-val console-val-success">0% (Keep 100% Revenue)</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Courier Dispatch</span>
                    <span className="console-metric-val console-val-success">1-Click Native API Booking</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Address Dropdowns</span>
                    <span className="console-metric-val console-val-success">8 Div / 64 Dist / 495 Thanas</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Monthly Software Cost</span>
                    <span className="console-metric-val console-val-success">Flat ৳699 - ৳3,499/mo (bKash)</span>
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
            <span className="eyebrow" style={{ color: "#4F46E5" }}>Decision Matrix</span>
            <h2>The Honest Verdict: Who is each platform for?</h2>
            <p>
              We believe in vendor neutrality. Choose the platform that best fits your business model and target audience.
            </p>
          </div>

          <div className="decision-grid">
            {/* Choose Shopify If */}
            <div className="decision-card decision-card-neutral">
              <div className="decision-card-eyebrow neutral">
                <span>🌐</span> Choose Shopify If
              </div>
              <h3>You are targeting international buyers</h3>
              <ul className="decision-list">
                <li>
                  <span style={{ color: "#16A34A", fontWeight: "bold" }}>✓</span>
                  <span><strong>Global Cross-Border Exports:</strong> You export apparel, leather goods, or handicrafts to customers in the US, UK, Canada, or EU.</span>
                </li>
                <li>
                  <span style={{ color: "#16A34A", fontWeight: "bold" }}>✓</span>
                  <span><strong>Foreign Currency Checkout:</strong> You charge in USD, EUR, or GBP using international credit cards via Stripe or PayPal.</span>
                </li>
                <li>
                  <span style={{ color: "#16A34A", fontWeight: "bold" }}>✓</span>
                  <span><strong>Active Dual-Currency Card:</strong> You already possess a bank-endorsed credit card with sufficient annual travel quota ($12k limit).</span>
                </li>
                <li>
                  <span style={{ color: "#16A34A", fontWeight: "bold" }}>✓</span>
                  <span><strong>Global Dropshipping:</strong> You rely heavily on overseas dropshipping ecosystems like DSers, CJdropshipping, or AliExpress.</span>
                </li>
              </ul>
            </div>

            {/* Choose BizTrackBD If */}
            <div className="decision-card decision-card-indigo">
              <div className="decision-card-eyebrow indigo">
                <span>🇧🇩</span> Choose BizTrackBD If
              </div>
              <h3>You are selling inside Bangladesh</h3>
              <ul className="decision-list">
                <li>
                  <span style={{ color: "#4F46E5", fontWeight: "bold" }}>✓</span>
                  <span><strong>Domestic Cash on Delivery &amp; bKash:</strong> Over 80% of your customer orders are paid via COD or mobile wallets (bKash, Nagad).</span>
                </li>
                <li>
                  <span style={{ color: "#4F46E5", fontWeight: "bold" }}>✓</span>
                  <span><strong>Zero Sales Commission:</strong> You refuse to pay Shopify's 2.0% penalty cut on every sale on top of local payment gateway charges.</span>
                </li>
                <li>
                  <span style={{ color: "#4F46E5", fontWeight: "bold" }}>✓</span>
                  <span><strong>Courier Automation:</strong> You deliver via Steadfast, Pathao, or RedX and want 1-click booking, pickup requests, and barcode label printing.</span>
                </li>
                <li>
                  <span style={{ color: "#4F46E5", fontWeight: "bold" }}>✓</span>
                  <span><strong>COD Fraud Prevention:</strong> You want to stop serial parcel rejectors and fake orders before paying courier return penalties (৳135+ each).</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Five Bangladesh Reality Pillars */}
      <section className="py-16 border-b border-[var(--border)] bg-[var(--surface-subtle)]">
        <div className="compare-container">
          <div className="stage-section-title">
            <span className="eyebrow" style={{ color: "#4F46E5" }}>The 5 Local Realities</span>
            <h2>Why Global Ecommerce Software Struggles in Bangladesh</h2>
            <p>
              The structural hurdles that turn standard Shopify stores into expensive operational bottlenecks.
            </p>
          </div>

          <div style={{ display: "grid", gap: "20px" }}>
            <div className="decision-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "17px", margin: 0 }}>1. The USD Credit Card &amp; 15% Foreign Exchange Tax</h3>
                <span className="status-stamp stamp-review">Payment Hurdle</span>
              </div>
              <p style={{ fontSize: "13.5px", color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
                Shopify bills exclusively in US Dollars. To maintain a Shopify store from Bangladesh, you must visit a commercial bank with your valid physical passport, endorse your international credit card against your annual travel quota ($12,000 max), and pay an extra 15% government VAT on digital cross-border services. On BizTrackBD, subscriptions are billed in flat Bangladeshi Taka (৳) and can be paid directly through personal or merchant bKash or Nagad.
              </p>
            </div>

            <div className="decision-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "17px", margin: 0 }}>2. The 2.0% Third-Party Gateway Penalty Cut</h3>
                <span className="status-stamp stamp-paid">Hidden Cost</span>
              </div>
              <p style={{ fontSize: "13.5px", color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
                In countries where Shopify Payments is supported (US, UK, Canada), Shopify charges zero transaction fees. In Bangladesh, Shopify Payments is completely unavailable. Therefore, Shopify penalizes merchants with an additional <strong>2.0% transaction fee</strong> on every single order processed through bKash, Nagad, SSLCOMMERZ, or Cash on Delivery. On ৳5,00,000 monthly sales, you pay Shopify ৳10,000 in penalties alone. BizTrackBD charges <strong>0% sales commission</strong> on every plan.
              </p>
            </div>

            <div className="decision-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "17px", margin: 0 }}>3. The Missing Bangladesh Address Hierarchy</h3>
                <span className="status-stamp stamp-review">Lost Parcels</span>
              </div>
              <p style={{ fontSize: "13.5px", color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
                Shopify's checkout requires "Address Line 1, City, Postal Code". Bangladeshi shoppers outside Dhaka frequently do not know their 4-digit postal code, entering vague terms or typos. When courier riders attempt delivery, parcels get misrouted across districts, resulting in expensive returned courier fees (৳135+ each). BizTrackBD provides native cascading dropdowns: <strong>Division → District → Upazila/Thana</strong>, matching Steadfast and Pathao routing nodes directly.
              </p>
            </div>

            <div className="decision-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "17px", margin: 0 }}>4. The Expensive "App Stack Tax"</h3>
                <span className="status-stamp stamp-lead">App Overhead</span>
              </div>
              <p style={{ fontSize: "13.5px", color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
                A bare Shopify store cannot handle Bangladesh operations. To operate effectively, a merchant must install third-party Shopify apps: a COD order confirmation OTP app ($10–$15/mo), a courier booking connector ($15–$25/mo), and a Twilio SMS integration ($10–$20/mo in USD). Suddenly, your $39/month store costs $80–$100/month. BizTrackBD includes all these capabilities natively in the core platform.
              </p>
            </div>

            <div className="decision-card" style={{ padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "17px", margin: 0 }}>5. Mobile 4G Loading Speed &amp; JavaScript Bloat</h3>
                <span className="status-stamp stamp-paid">Speed</span>
              </div>
              <p style={{ fontSize: "13.5px", color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
                As Shopify merchants add third-party apps for bKash, COD forms, and social proof popups, each app injects separate unoptimized JavaScript files. Mobile load times on local Robi or Grameenphone 4G connections degrade to 4–7 seconds. BizTrackBD storefronts are built on server-rendered Next.js edge architecture with sub-second (&lt;0.8s) page loads, zero third-party app bloat, and lightweight Meta CAPI server-side event tracking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-16 border-b border-[var(--border)]">
        <div className="compare-container">
          <div className="compare-header-row">
            <span className="eyebrow" style={{ color: "#4F46E5" }}>
              Feature-by-Feature Breakdown
            </span>
            <h2>Detailed Platform Comparison</h2>
            <p>
              Compare core eCommerce architecture, localized checkout, and fulfillment operations side-by-side.
            </p>
          </div>

          <div className="table-wrapper-card">
            <table className="comparison-table-v2">
              <thead>
                <tr>
                  <th style={{ width: "26%" }}>Feature</th>
                  <th className="cell-highlight-primary" style={{ width: "28%" }}>
                    <div className="flex items-center gap-1.5" style={{ color: "#1E3A8A", fontWeight: 800 }}>
                      <span>🛍️ BizTrackBD</span>
                    </div>
                  </th>
                  <th style={{ width: "26%" }}>Shopify Basic</th>
                  <th style={{ width: "20%" }}>Impact on Your Business</th>
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
                      <span className="spec-chip-positive">✓ Built-in Bangladesh</span>
                    </td>
                    <td>
                      <div className="text-[var(--muted)] mb-1">{row.shopify}</div>
                      <span className="spec-chip-negative">— Global App / Add-on</span>
                    </td>
                    <td>
                      <span className="text-[11px] font-mono font-semibold" style={{ color: "#4338CA" }}>
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
          <TcoCalculator initialCompetitor="shopify" hideSelector={true} />
        </div>
      </section>

      {/* Migration Guide Preview */}
      <section className="compare-section">
        <div className="compare-container">
          <div className="migration-container-card">
            <div className="stage-section-title" style={{ textAlign: "left", marginBottom: 0 }}>
              <span className="status-stamp stamp-paid" style={{ alignSelf: "flex-start" }}>SMOOTH MIGRATION</span>
              <h2 style={{ marginTop: 8 }}>
                How to Migrate from Shopify to BizTrackBD in 3 Steps
              </h2>
              <p>
                Switching platforms takes under an hour with zero catalog downtime.
              </p>
            </div>

            <div className="migration-grid-v2">
              <div className="migration-step-card">
                <div className="migration-step-tag">STEP 01</div>
                <h3 className="migration-step-title">Export Products CSV</h3>
                <p className="migration-step-desc">
                  Go to your Shopify Admin → Products → Export → All Products. Download the standard CSV file containing titles, descriptions, prices, variants, and image URLs.
                </p>
              </div>

              <div className="migration-step-card">
                <div className="migration-step-tag">STEP 02</div>
                <h3 className="migration-step-title">1-Click Catalog Import</h3>
                <p className="migration-step-desc">
                  In your BizTrackBD dashboard, navigate to Products → Import → Shopify CSV. Upload your file. Our system automatically downloads and hosts your images.
                </p>
              </div>

              <div className="migration-step-card">
                <div className="migration-step-tag">STEP 03</div>
                <h3 className="migration-step-title">Connect bKash &amp; Couriers</h3>
                <p className="migration-step-desc">
                  Enter your Steadfast or Pathao API keys and bKash wallet number. Connect your custom domain (DNS records). You are ready to accept orders with zero commission.
                </p>
              </div>
            </div>

            <div className="migration-card-footer">
              <div style={{ fontSize: 13, color: "var(--ink-2)", maxWidth: 500 }}>
                Already have an active shop on Shopify? Export your catalog CSV and switch in 15 minutes with zero downtime.
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <Link
                  href="/migrate/shopify"
                  style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)" }}
                >
                  Step-by-Step Shopify Migration Guide →
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
        </div>
      </section>

      {/* FAQs */}
      <section className="compare-section-subtle">
        <div className="compare-container">
          <div className="stage-section-title">
            <h2>Frequently Asked Questions: Shopify vs BizTrackBD</h2>
            <p>
              Direct, transparent answers to common questions about costs, limits, and technical switching.
            </p>
          </div>

          <div className="faq-grid-v2">
            {SHOPIFY_FAQS.map((faq, idx) => (
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
            <p>Ready to eliminate USD credit card headaches and 2% sales commissions?</p>
            <div className="compare-btn-row" style={{ justifyContent: "center" }}>
              <Link
                href="/start"
                className="btn btn-indigo btn-lg"
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
                    "name": "Shopify vs BizTrackBD",
                    "item": "https://biztrackbd.com/compare/shopify",
                  },
                ],
              },
              {
                "@type": "FAQPage",
                "mainEntity": SHOPIFY_FAQS.map((faq) => ({
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
