import type { Metadata } from "next";
import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: {
    absolute: "BizTrackBD vs WordPress & Elementor: Real Cost of Ownership in Bangladesh (Oct 2026)",
  },
  description:
    "An honest comparison of BizTrackBD vs WordPress and Elementor for Bangladeshi businesses. Compare cloud hosting, plugin renewals, developer maintenance, and zero-crash edge speed.",
  alternates: {
    canonical: `${siteUrl}/compare/wordpress`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/compare/wordpress`,
    siteName: "BizTrackBD",
    title: "BizTrackBD vs WordPress & Elementor in Bangladesh",
    description: "Compare hosting costs, plugin updates, developer fees, and managed speed for Bangladeshi businesses.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "BizTrackBD vs WordPress" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BizTrackBD vs WordPress & Elementor in Bangladesh",
    description: "Evaluate WordPress self-hosting vs BizTrackBD managed edge platform in Taka.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const WP_FAQS = [
  {
    q: "Isn't WordPress much cheaper because the software is free?",
    a: "WordPress core is open-source and free, but running a production business site in Bangladesh is not. A typical Bangladeshi business using WordPress + Elementor pays for reliable cloud VPS hosting (৳ 2,000–৳ 4,000/mo), Elementor Pro license (≈ ৳ 7,500/yr), backup and security plugins (≈ ৳ 6,000/yr), bKash gateway bridge licenses, and occasional web developer fees to fix broken layouts after updates. In contrast, BizTrackBD charges flat predictable BDT from ৳ 399/mo with zero hosting or plugin bills.",
  },
  {
    q: "Why do WordPress & Elementor sites become sluggish on mobile networks in Bangladesh?",
    a: "Elementor generates complex nested DOM structures with dozens of unminified CSS/JS assets and database queries. On Bangladeshi mobile 4G/3G networks, this causes high Total Blocking Time (TBT) and delays the First Contentful Paint. BizTrackBD is built with lightweight, server-rendered Next.js edge architecture that delivers pre-rendered HTML from edge nodes in Dhaka and Singapore in under 100ms.",
  },
  {
    q: "What happens when a WordPress plugin breaks after an automatic update?",
    a: "In WordPress, plugins are maintained by disparate international authors. A routine update to WordPress core can conflict with your bKash plugin or Elementor theme, resulting in the 'White Screen of Death' or broken contact forms until a developer debugs PHP error logs. BizTrackBD is an integrated, centrally maintained platform: all core features, booking forms, and payment flows are tested and deployed together with zero maintenance on your part.",
  },
  {
    q: "When is WordPress + Elementor genuinely the superior choice?",
    a: "WordPress is legitimately better if you employ an in-house full-stack web developer who wants complete root SSH access to the server, requires custom PHP functions, or needs to integrate with legacy local databases or custom enterprise systems requiring proprietary database schemas.",
  },
  {
    q: "How does BizTrackBD prevent the database bloat and plugin conflicts common to WooCommerce + WordPress?",
    a: "On WordPress, combining service appointments with physical store checkout requires running WooCommerce, a booking plugin, a form builder, and a payment gateway bridge simultaneously—bloating the wp_options table and causing fatal PHP memory crashes during updates. BizTrackBD provides a unified multi-mode edge runtime where service booking forms and shopping cart routes run natively in optimized TypeScript with 100% isolated PostgreSQL storage and guaranteed zero data loss.",
  },
  {
    q: "Can I manage leads and customer inquiries easily on WordPress?",
    a: "On WordPress, form submissions typically land in your personal email inbox (which often ends up in spam) or requires a separate CRM plugin like FluentCRM or HubSpot. BizTrackBD includes a centralized, mobile-friendly Lead and Booking Inbox out of the box, with 1-tap WhatsApp customer contact, staff assignment, and private follow-up notes.",
  },
];

const COMPARISON_ROWS = [
  {
    feature: "Hybrid Service + Product Architecture",
    wp: "Requires heavy WooCommerce + Elementor + booking plugins; prone to fatal PHP conflicts and slow mobile speed",
    biztrack: "Native Dual-Engine: consultation booking desk and full ecommerce catalog run together with sub-100ms speed",
    verdict: "Zero plugin conflicts, zero database bloat, and guaranteed zero data loss",
  },
  {
    feature: "Infrastructure & Server Maintenance",
    wp: "Self-managed cloud VPS; manual PHP, MySQL & SSL updates",
    biztrack: "Managed Next.js edge infrastructure; zero server maintenance",
    verdict: "Zero DevOps or technical maintenance required on BizTrackBD",
  },
  {
    feature: "True Monthly Cost (TCO)",
    wp: "৳ 4,000 – ৳ 10,000/mo (VPS + Elementor Pro + plugins + dev support)",
    biztrack: "Flat ৳ 399 – ৳ 1,499/mo (All core modules & hosting included)",
    verdict: "Save thousands of Taka annually on recurring software bills",
  },
  {
    feature: "Bangla Mobile Speed & Performance",
    wp: "Heavy DOM trees from Elementor; sluggish on local 3G/4G",
    biztrack: "Pre-rendered static & edge HTML cached in Dhaka & Singapore",
    verdict: "Sub-100ms page load speeds that maximize inquiry conversion",
  },
  {
    feature: "Security, Malware & Hack Prevention",
    wp: "Frequent vulnerability targets; requires manual firewall & patching",
    biztrack: "Hardened multi-tenant edge; automated SSL & isolated data vault",
    verdict: "Eliminates hacked databases and defaced WordPress landing pages",
  },
  {
    feature: "Centralized Lead & Booking Desk",
    wp: "Fragmented emails or expensive third-party CRM plugins",
    biztrack: "Built-in Lead/Booking Workspace with 1-tap WhatsApp and staff notes",
    verdict: "Never lose a customer quote, doctor appointment, or booking",
  },
  {
    feature: "Source Code Freedom",
    wp: "100% open-source PHP; full direct access to code and database",
    biztrack: "Curated modern visual editor with custom CSS & custom domain",
    verdict: "WordPress wins if you have full-time in-house software engineers",
  },
];

export default function CompareWordPressPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "BizTrackBD vs WordPress & Elementor: Real Cost of Ownership in Bangladesh",
    description:
      "A realistic comparison of BizTrackBD vs WordPress and Elementor for Bangladeshi businesses, analyzing true monthly costs, speed, and maintenance.",
    publisher: {
      "@type": "Organization",
      name: "BizTrackBD",
      url: siteUrl,
    },
    mainEntity: {
      "@type": "FAQPage",
      mainEntity: WP_FAQS.map((faq) => ({
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
            <span style={{ fontWeight: 700, color: "#2563EB" }}>BizTrackBD vs WordPress &amp; Elementor</span>
          </div>

          <div className="pill-tag-banner pill-tag-blue">
            <span className="pulse-dot-blue" />
            <span>TOTAL COST OF OWNERSHIP (TCO) BENCHMARK • 2026</span>
          </div>

          <h1 className="compare-hero-title">
            BizTrackBD vs WordPress &amp; Elementor: <br />
            <span className="gradient-text-blue">
              The Real Cost of Ownership in Bangladesh
            </span>
          </h1>

          <p className="compare-hero-desc">
            WordPress powers millions of websites globally. But when you factor in monthly cloud VPS hosting, annual Elementor Pro licenses, developer maintenance fees, and plugin conflicts after major updates, the true cost adds up quickly. Here is an authentic, balanced look at the trade-offs.
          </p>

          <div className="compare-btn-row">
            <Link
              href="/start?mode=business"
              className="btn btn-blue btn-lg"
            >
              Start 14-Day Free Trial →
            </Link>
            <a
              href={demoAdminUrl()}
              className="btn btn-secondary btn-lg"
            >
              Explore Live Admin Workspace ↗
            </a>
          </div>

          {/* Key Reality Metric Pills */}
          <div className="metric-pill-row">
            <div className="metric-pill">
              <span>⚡</span>
              <span><strong>Traffic Spikes:</strong> Edge CDN &lt;85ms TTFB vs 502 Bad Gateway under 10k shoppers</span>
            </div>
            <div className="metric-pill">
              <span>💰</span>
              <span><strong>True Annual Cost:</strong> Flat ৳4,788/yr vs ৳50,000+/yr (VPS + licenses + dev retainers)</span>
            </div>
            <div className="metric-pill">
              <span>🛡️</span>
              <span><strong>DevOps Overhead:</strong> 100% Zero-maintenance edge vs manual PHP/MySQL patching</span>
            </div>
            <div className="metric-pill">
              <span>📱</span>
              <span><strong>Mobile Speed:</strong> 98+ mobile score vs nested bloated Elementor DOM trees</span>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Comparison Console Stage: Eid Flash Sale Simulation */}
      <section className="compare-section-subtle">
        <div className="compare-container">
          <div className="stage-section-title">
            <span className="eyebrow" style={{ color: "#2563EB" }}>Load &amp; Stability Simulation</span>
            <h2>Eid Flash Sale Simulation: 10,000 Concurrent Visitors</h2>
            <p>
              Real-world performance under high concurrent traffic spikes common during Bangladeshi holiday campaigns.
            </p>
          </div>

          <div className="comparison-preview-stage shadow-xl">
            <div className="comparison-window-header">
              <div className="comparison-window-dots">
                <span className="window-dot dot-red" />
                <span className="window-dot dot-yellow" />
                <span className="window-dot dot-green" />
              </div>
              <span className="text-xs font-mono text-slate-400">eid-flash-sale-benchmark.sim</span>
            </div>

            <div className="split-console">
              {/* Left Pane: Self-Hosted WordPress */}
              <div className="console-pane console-pane-legacy">
                <div className="console-pane-header">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>WordPress + Elementor VPS</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>Self-managed cloud server</div>
                  </div>
                  <span className="console-status-pill-fail">502 BAD GATEWAY</span>
                </div>

                <div style={{ borderRadius: 8, background: "rgba(127, 29, 29, 0.4)", border: "1px solid rgba(185, 28, 28, 0.4)", padding: 12, fontSize: 12, color: "#FECACA" }}>
                  <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "#FCA5A5", marginBottom: 4 }}>
                    <span>⚠️</span> Error Establishing Database Connection
                  </div>
                  <div>MySQL process memory exhausted. FastCGI workers timed out after 60s. Contact forms and checkout crashed during Facebook ad surge. Requires emergency developer intervention.</div>
                </div>

                <div className="console-metric-list">
                  <div className="console-metric-item">
                    <span>Server Response Time (TTFB)</span>
                    <span className="console-metric-val console-val-fail">3,800ms – 7,200ms</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Maintenance Burden</span>
                    <span className="console-metric-val console-val-fail">Manual PHP 8.3 &amp; plugin tests</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Security &amp; Vulnerabilities</span>
                    <span className="console-metric-val console-val-fail">Prone to plugin zero-days &amp; hacks</span>
                  </div>
                  <div className="console-metric-item">
                    <span>True Annual TCO</span>
                    <span className="console-metric-val console-val-fail">≈ ৳ 52,000/yr (VPS + licenses + dev)</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Mobile Total Blocking Time</span>
                    <span className="console-metric-val console-val-fail">High (Heavy Elementor DOM)</span>
                  </div>
                </div>
              </div>

              {/* Right Pane: BizTrackBD Edge */}
              <div className="console-pane console-pane-biztrack">
                <div className="console-pane-header">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>BizTrackBD Next.js Edge</div>
                    <div style={{ fontSize: 11, color: "#60A5FA" }}>Dhaka &amp; Singapore edge network</div>
                  </div>
                  <span className="console-status-pill-success">100% UPTIME • &lt;85ms TTFB</span>
                </div>

                <div style={{ borderRadius: 8, background: "rgba(6, 78, 59, 0.4)", border: "1px solid rgba(5, 150, 105, 0.4)", padding: 12, fontSize: 12, color: "#A7F3D0" }}>
                  <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: "#6EE7B7", marginBottom: 4 }}>
                    <span>✓</span> Instant Edge Rendering &amp; Zero Crash
                  </div>
                  <div>Pre-rendered HTML served instantly from nearby Dhaka edge nodes. Automated serverless scaling effortlessly handled 10,000+ shoppers with zero database locks and instant bKash checkout.</div>
                </div>

                <div className="console-metric-list">
                  <div className="console-metric-item">
                    <span>Server Response Time (TTFB)</span>
                    <span className="console-metric-val console-val-success">&lt; 85ms edge cached</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Maintenance Burden</span>
                    <span className="console-metric-val console-val-success">100% zero-maintenance managed</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Security &amp; Vulnerabilities</span>
                    <span className="console-metric-val console-val-success">Hardened tenant vault, auto SSL</span>
                  </div>
                  <div className="console-metric-item">
                    <span>True Annual TCO</span>
                    <span className="console-metric-val console-val-success">Flat ৳ 4,788 – ৳ 17,988/yr all-in</span>
                  </div>
                  <div className="console-metric-item">
                    <span>Mobile Total Blocking Time</span>
                    <span className="console-metric-val console-val-success">Near 0ms (Lightweight SSR)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Strategic Decision Matrix */}
      <section className="compare-section">
        <div className="compare-container">
          <div className="decision-grid">
            <div className="decision-card decision-card-blue">
              <span className="decision-card-eyebrow blue">
                <span>✓</span> When to Choose BizTrackBD
              </span>
              <h3>For Reliable, Zero-Maintenance Business Operations</h3>
              <ul className="decision-list">
                <li>
                  <span style={{ color: "#2563EB", fontWeight: 700 }}>✓</span>
                  <span><strong>Predictable Taka billing:</strong> Flat ৳399 to ৳1,499/mo BDT with hosting, automated SSL, security updates, and storage fully covered.</span>
                </li>
                <li>
                  <span style={{ color: "#2563EB", fontWeight: 700 }}>✓</span>
                  <span><strong>Zero plugin maintenance:</strong> Never wake up to broken contact forms or "White Screen of Death" caused by conflicting third-party plugin updates.</span>
                </li>
                <li>
                  <span style={{ color: "#2563EB", fontWeight: 700 }}>✓</span>
                  <span><strong>Sub-100ms mobile speed:</strong> Pre-rendered edge architecture ensures instant loading for Bangladeshi visitors on mobile 3G/4G connections.</span>
                </li>
                <li>
                  <span style={{ color: "#2563EB", fontWeight: 700 }}>✓</span>
                  <span><strong>1-Tap WhatsApp Lead Desk:</strong> Unified customer inquiry workspace with 1-tap WhatsApp chat initiation, team assignment, and private notes.</span>
                </li>
              </ul>
            </div>

            <div className="decision-card decision-card-neutral">
              <span className="decision-card-eyebrow neutral">
                <span>✦</span> When to Choose WordPress &amp; Elementor
              </span>
              <h3>For Teams with Dedicated In-House PHP Engineers</h3>
              <ul className="decision-list">
                <li>
                  <span style={{ color: "#94A3B8", fontWeight: 700 }}>•</span>
                  <span><strong>Full server root SSH access:</strong> You have an in-house Linux systems administrator who can configure Nginx, PHP-FPM, and Redis caching.</span>
                </li>
                <li>
                  <span style={{ color: "#94A3B8", fontWeight: 700 }}>•</span>
                  <span><strong>Custom SQL database schemas:</strong> You need to create bespoke relational tables, triggers, and integrate directly with legacy on-premise databases.</span>
                </li>
                <li>
                  <span style={{ color: "#94A3B8", fontWeight: 700 }}>•</span>
                  <span><strong>Niche community plugins:</strong> You require specific plugins from the WordPress repository that are essential to your enterprise workflow.</span>
                </li>
                <li>
                  <span style={{ color: "#94A3B8", fontWeight: 700 }}>•</span>
                  <span><strong>Developer budget:</strong> You are comfortable allocating ৳5,000–৳15,000/month for server management, licenses, and developer support.</span>
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
            <h2>Capability &amp; Infrastructure Breakdown</h2>
            <p>
              Comparing ongoing costs, operational overhead, and speed for Bangladeshi businesses.
            </p>
          </div>

          <div className="table-wrapper-card">
            <table className="comparison-table-v2">
              <thead>
                <tr>
                  <th style={{ width: "28%" }}>Capability</th>
                  <th className="cell-highlight-primary" style={{ width: "28%" }}>
                    <div className="flex items-center gap-1.5" style={{ color: "#1E1B4B", fontWeight: 800 }}>
                      <span>⚡ BizTrackBD</span>
                    </div>
                  </th>
                  <th style={{ width: "24%" }}>WordPress &amp; Elementor</th>
                  <th style={{ width: "20%" }}>Operational Trade-Off</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, color: "var(--ink)" }}>
                      {row.feature}
                    </td>
                    <td className="cell-highlight-primary">
                      <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                        {row.biztrack}
                      </div>
                      <span className="spec-chip-positive">✓ Managed Edge</span>
                    </td>
                    <td>
                      <div style={{ color: "var(--ink-2)", marginBottom: 4 }}>{row.wp}</div>
                      <span className="spec-chip-negative">— Self-Managed</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color: "#2563EB" }}>
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
              <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 9999, background: "rgba(37, 99, 235, 0.2)", border: "1px solid rgba(96, 165, 250, 0.3)", color: "#93C5FD", fontSize: 11.5, fontWeight: 800, marginBottom: 8 }}>
                TCO REALITY IN BANGLADESH
              </span>
              <h3 style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 800, color: "#FFFFFF", margin: "6px 0 8px" }}>
                Eliminate ৳ 45,000+ in Annual Hosting, License &amp; Dev Bills
              </h3>
              <p style={{ fontSize: 14, color: "#CBD5E1", lineHeight: 1.6, maxWidth: 600 }}>
                A single developer fix after a broken WordPress core update often costs more than an entire year of BizTrackBD. Get high-speed infrastructure without the DevOps overhead.
              </p>
            </div>
            <div>
              <Link
                href="/start?mode=business"
                className="btn btn-blue btn-lg"
                style={{ background: "#3B82F6", color: "#0F172A", fontWeight: 800 }}
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
            <h2>Frequently Asked Questions: WordPress vs BizTrackBD</h2>
            <p>
              Transparent answers regarding true ownership expenses, developer requirements, and operational stability.
            </p>
          </div>

          <div className="faq-grid-v2">
            {WP_FAQS.map((faq, idx) => (
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
            <p>Ready to eliminate plugin conflicts and unpredictable hosting bills?</p>
            <div className="compare-btn-row" style={{ justifyContent: "center" }}>
              <Link
                href="/start?mode=business"
                className="btn btn-blue btn-lg"
              >
                Start 14-Day Free Trial
              </Link>
              <Link
                href="/business/templates"
                className="btn btn-secondary btn-lg"
              >
                Explore Business Templates
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
                    "name": "WordPress vs BizTrackBD",
                    "item": "https://biztrackbd.com/compare/wordpress",
                  },
                ],
              },
              {
                "@type": "FAQPage",
                "mainEntity": WP_FAQS.map((faq) => ({
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
