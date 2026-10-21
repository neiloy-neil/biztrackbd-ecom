import type { Metadata } from "next";
import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";
import { ArchitectureExplorer } from "./architecture-explorer";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Product Architecture & Platform Capabilities: Commerce, Business & Hybrid",
  description:
    "Explore the BizTrackBD product suite: Commerce engine for online retail, Business engine for services and clinics, and unified Hybrid mode for dual operations in Bangladesh.",
  keywords: [
    "biztrackbd product architecture",
    "ecommerce platform bangladesh",
    "business website builder dhaka",
    "hybrid commerce software",
    "restaurant qr menu system",
    "doctor appointment platform bd",
    "bangladesh software platform",
  ],
  alternates: {
    canonical: `${siteUrl}/product`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/product`,
    siteName: "BizTrackBD",
    title: "Product Architecture & Platform Capabilities | BizTrackBD",
    description:
      "Commerce engine for online retail, Business engine for services and clinics, and unified Hybrid mode for Bangladesh.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "BizTrackBD Product Architecture" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Product Architecture & Platform Capabilities | BizTrackBD",
    description: "One core engine, three specialized deployment modes for Bangladeshi businesses.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

interface CapabilityRow {
  feature: string;
  category: string;
  commerce: boolean | string;
  business: boolean | string;
  hybrid: boolean | string;
  note: string;
}

const CAPABILITIES: CapabilityRow[] = [
  {
    feature: "Custom Domain & SSL (.com, .com.bd)",
    category: "Infrastructure",
    commerce: true,
    business: true,
    hybrid: true,
    note: "Automated Let's Encrypt SSL certificates with zero server maintenance.",
  },
  {
    feature: "Dhaka & Singapore Edge Cache (<100ms)",
    category: "Infrastructure",
    commerce: true,
    business: true,
    hybrid: true,
    note: "Instant page renders on local 4G/3G mobile networks without caching plugins.",
  },
  {
    feature: "bKash & Nagad Online Checkout",
    category: "Payments",
    commerce: true,
    business: "Add-on",
    hybrid: true,
    note: "Merchant gateway API or direct personal bKash/Nagad number with TrxID desk.",
  },
  {
    feature: "Steadfast & Pathao Courier Auto-Dispatch",
    category: "Logistics",
    commerce: true,
    business: false,
    hybrid: true,
    note: "1-click consignment creation, tracking code sync, and thermal label printing.",
  },
  {
    feature: "COD Return Fraud & Courier Score Shield",
    category: "Logistics",
    commerce: true,
    business: false,
    hybrid: true,
    note: "Flags habitual returners before parcel dispatch to protect shipping margins.",
  },
  {
    feature: "Product Variants, Stock Tracking & SKU Matrix",
    category: "Catalog",
    commerce: true,
    business: false,
    hybrid: true,
    note: "Real-time inventory decrement with size guides and color swatches.",
  },
  {
    feature: "Contactless QR Table Ordering & Digital Menu",
    category: "Business",
    commerce: false,
    business: true,
    hybrid: true,
    note: "Table-specific QR tokens with live order trays and call-waiter action.",
  },
  {
    feature: "Doctor Multi-Chamber Appointments",
    category: "Business",
    commerce: false,
    business: true,
    hybrid: true,
    note: "Verified BMDC credentials, multi-chamber visiting hours, and serial requests.",
  },
  {
    feature: "Affirmative Consent Lead & Quote Capture",
    category: "Business",
    commerce: false,
    business: true,
    hybrid: true,
    note: "Versioned privacy consent logging with bot shielding and honeypots.",
  },
  {
    feature: "Staff Internal Notes & WhatsApp Dispatch",
    category: "Admin",
    commerce: true,
    business: true,
    hybrid: true,
    note: "Private follow-up notes and 1-tap WhatsApp chat links on leads & orders.",
  },
  {
    feature: "Role-Based Staff Access (RBAC)",
    category: "Security",
    commerce: true,
    business: true,
    hybrid: true,
    note: "Granular permissions for Orders, Catalog, Leads, Bookings, and Settings.",
  },
  {
    feature: "Meta Pixel & CAPI Dual-Layer Server Tracking",
    category: "Growth",
    commerce: true,
    business: true,
    hybrid: true,
    note: "Normalized SHA-256 hashed server events with zero raw contact PII leaks.",
  },
  {
    feature: "0% Sales or Lead Commission",
    category: "Pricing",
    commerce: true,
    business: true,
    hybrid: true,
    note: "Flat transparent BDT monthly subscription with zero hidden turnover cuts.",
  },
];

const productJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${siteUrl}/product#software`,
  name: "BizTrackBD Operating Platform",
  applicationCategory: "BusinessApplication",
  operatingSystem: "All (Web, Android, iOS PWA)",
  url: `${siteUrl}/product`,
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "BDT",
    lowPrice: "399",
    highPrice: "1499",
    offerCount: "3",
    offers: [
      {
        "@type": "Offer",
        name: "Starter Plan",
        price: "399",
        priceCurrency: "BDT",
        priceValidUntil: "2027-12-31",
        description: "For personal portfolios, local service firms, and boutique emerging brands.",
      },
      {
        "@type": "Offer",
        name: "Growth Plan",
        price: "799",
        priceCurrency: "BDT",
        priceValidUntil: "2027-12-31",
        description: "For active eCommerce stores and clinics dispatching daily orders.",
      },
      {
        "@type": "Offer",
        name: "Scale Plan",
        price: "1499",
        priceCurrency: "BDT",
        priceValidUntil: "2027-12-31",
        description: "For high-volume retail operations with multi-staff permission desks.",
      },
    ],
  },
  featureList: [
    "bKash and Nagad direct payment verification",
    "Pathao and Steadfast automated courier dispatch",
    "Cash on Delivery return fraud prevention",
    "Bangla SMS notifications",
    "0% sales commission",
    "Sub-second mobile storefront speed",
    "Doctor chamber schedules and consultation requests",
    "Unified Hybrid eCommerce + Business presence",
  ],
};

export default function ProductArchitecturePage() {
  return (
    <div style={{ background: "#FBF7EC", minHeight: "100vh" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      {/* Hero Header with Gradient Mesh */}
      <section
        className="gradient-mesh-hero"
        style={{
          padding: "70px 20px 56px",
          borderBottom: "1px solid var(--line, #DCE7E1)",
        }}
      >
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          {/* Breadcrumb Hierarchy */}
          <nav
            aria-label="Breadcrumbs"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--ink-3, #3D5A52)",
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            <Link href="/" style={{ color: "var(--ink-2, #3D5A52)", textDecoration: "none" }}>
              Home
            </Link>
            <span aria-hidden="true">›</span>
            <span style={{ color: "var(--ink, #0B4D3B)", fontWeight: 600 }}>Platform Architecture</span>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 14px",
                borderRadius: "20px",
                background: "#E3F1EA",
                color: "var(--accent, #11795A)",
                fontSize: "12.5px",
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                border: "1px solid #C6DFD3",
              }}
            >
              <span>🏛️</span> Unified Platform Architecture
            </span>

            <span className="spec-chip-positive" style={{ fontSize: 11.5 }}>
              ● 42ms Dhaka Edge Latency
            </span>
            <span className="spec-chip-neutral" style={{ fontSize: 11.5 }}>
              🔒 Let&apos;s Encrypt Auto-SSL
            </span>
          </div>

          <h1
            style={{
              fontSize: "clamp(34px, 5.5vw, 56px)",
              letterSpacing: "-1.5px",
              lineHeight: 1.12,
              fontWeight: 800,
              color: "var(--ink, #0B4D3B)",
              margin: "0 0 16px",
              maxWidth: 960,
            }}
          >
            One Core Engine. <br className="hidden-mobile" />
            Three Specialized Deployments.
          </h1>

          <p
            style={{
              fontSize: "clamp(17px, 2.5vw, 20px)",
              color: "var(--ink-2, #3D5A52)",
              lineHeight: 1.6,
              maxWidth: 820,
              margin: 0,
            }}
          >
            BizTrackBD is engineered from the ground up for Bangladesh. Whether you operate a high-velocity fashion retail store shipping parcels across 64 districts, a medical clinic scheduling multi-chamber appointments, or a hybrid enterprise doing both — our platform provides the right architecture without compromise.
          </p>

          <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/start"
              className="btn btn-primary"
              style={{
                padding: "12px 26px",
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 8,
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(17, 121, 90, 0.25)",
              }}
            >
              Start Free 14-Day Trial →
            </Link>
            <a
              href={demoAdminUrl()}
              className="btn btn-secondary"
              data-testid="product-hero-demo-admin"
              style={{
                padding: "12px 22px",
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 8,
                background: "#FFFFFF",
                textDecoration: "none",
              }}
            >
              Explore Live Admin Desk
            </a>
          </div>

          {/* Interactive Architecture Explorer */}
          <ArchitectureExplorer />
        </div>
      </section>

      {/* 3 Core Operating Modes Breakdown */}
      <section style={{ padding: "72px 20px" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48, maxWidth: 740, margin: "0 auto 48px" }}>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 800,
                color: "var(--accent, #11795A)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Operating Modes
            </span>
            <h2
              style={{
                fontSize: "clamp(26px, 4vw, 38px)",
                fontWeight: 800,
                letterSpacing: "-0.8px",
                color: "var(--ink, #0B4D3B)",
                margin: "8px 0 12px",
              }}
            >
              Choose the Engine Built for Your Business Model
            </h2>
            <p style={{ fontSize: 16, color: "var(--ink-2, #3D5A52)", lineHeight: 1.6, margin: 0 }}>
              Every deployment shares our high-speed edge infrastructure, automatic SSL, and zero sales commission policy, while activating tools tuned to how you serve customers.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 24,
            }}
          >
            {/* Mode 1: Commerce */}
            <div
              className="premium-glass-card"
              style={{
                padding: "36px 30px",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                borderTop: "4px solid #11795A",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 50,
                    height: 50,
                    borderRadius: 14,
                    background: "#E3F1EA",
                    color: "#11795A",
                    fontSize: 26,
                  }}
                >
                  🛍️
                </div>
                <span className="status-stamp stamp-paid" style={{ fontSize: 11 }}>
                  PHYSICAL RETAIL
                </span>
              </div>

              <span style={{ fontSize: 12.5, fontWeight: 800, color: "#11795A", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Physical Retail &amp; D2C Brands
              </span>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink, #0B4D3B)", margin: "4px 0 12px" }}>
                BizTrackBD Commerce
              </h3>
              <p style={{ fontSize: 15, color: "var(--ink-2, #3D5A52)", lineHeight: 1.6, margin: "0 0 20px" }}>
                For fashion apparel, gadget stores, cosmetics, kids brands, and retail merchants selling physical products with home delivery across Bangladesh.
              </p>

              <div style={{ borderTop: "1px solid var(--line, #FBF7EC)", paddingTop: 18, flexGrow: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink, #0B4D3B)", margin: "0 0 12px" }}>
                  Key Capabilities:
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "var(--ink-2, #3D5A52)", lineHeight: 1.75 }}>
                  <li>Instant bKash, Nagad &amp; Cash on Delivery checkout</li>
                  <li>1-click Steadfast &amp; Pathao courier booking</li>
                  <li>COD Return Shield: detects habitual parcel returners</li>
                  <li>Inventory matrix with size, color &amp; drop countdowns</li>
                  <li>Bulk thermal shipping labels &amp; packing slips</li>
                </ul>
              </div>

              <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
                <Link
                  href="/templates"
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "11px 14px",
                    background: "#11795A",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    borderRadius: 8,
                    fontSize: 14,
                    textDecoration: "none",
                    boxShadow: "0 2px 8px rgba(17, 121, 90, 0.2)",
                  }}
                >
                  View Storefronts →
                </Link>
                <Link
                  href="/start?mode=ecommerce"
                  style={{
                    padding: "11px 16px",
                    background: "#FBF7EC",
                    color: "var(--ink, #0B4D3B)",
                    fontWeight: 600,
                    borderRadius: 8,
                    fontSize: 14,
                    textDecoration: "none",
                  }}
                >
                  Start Retail
                </Link>
              </div>
            </div>

            {/* Mode 2: Business */}
            <div
              className="premium-glass-card"
              style={{
                padding: "36px 30px",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                borderTop: "4px solid var(--accent, #11795A)",
                boxShadow: "0 10px 30px rgba(17, 121, 90, 0.08)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 50,
                    height: 50,
                    borderRadius: 14,
                    background: "#E3F1EA",
                    color: "var(--accent, #11795A)",
                    fontSize: 26,
                  }}
                >
                  🩺
                </div>
                <span className="status-stamp stamp-lead" style={{ fontSize: 11 }}>
                  LEAD &amp; BOOKING
                </span>
              </div>

              <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--accent, #11795A)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Services, Dining &amp; Clinics
              </span>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink, #0B4D3B)", margin: "4px 0 12px" }}>
                BizTrackBD Business
              </h3>
              <p style={{ fontSize: 15, color: "var(--ink-2, #3D5A52)", lineHeight: 1.6, margin: "0 0 20px" }}>
                For medical doctors, dining establishments, corporate advisors, tech and home services, portfolios, and public figures needing bookings and leads.
              </p>

              <div style={{ borderTop: "1px solid var(--line, #FBF7EC)", paddingTop: 18, flexGrow: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink, #0B4D3B)", margin: "0 0 12px" }}>
                  Key Capabilities:
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "var(--ink-2, #3D5A52)", lineHeight: 1.75 }}>
                  <li>Contactless QR table ordering &amp; digital menu tray</li>
                  <li>Multi-chamber BMDC doctor appointment booking</li>
                  <li>Affirmative consent lead &amp; quote inquiry routing</li>
                  <li>Admin lead/booking desk with private staff notes</li>
                  <li>0% commission on all client leads &amp; reservations</li>
                </ul>
              </div>

              <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
                <Link
                  href="/business/templates"
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "11px 14px",
                    background: "var(--accent, #11795A)",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    borderRadius: 8,
                    fontSize: 14,
                    textDecoration: "none",
                    boxShadow: "0 2px 8px rgba(17, 121, 90, 0.25)",
                  }}
                >
                  View Business Sites →
                </Link>
                <Link
                  href="/start?mode=business"
                  style={{
                    padding: "11px 16px",
                    background: "#FBF7EC",
                    color: "var(--ink, #0B4D3B)",
                    fontWeight: 600,
                    borderRadius: 8,
                    fontSize: 14,
                    textDecoration: "none",
                  }}
                >
                  Start Business
                </Link>
              </div>
            </div>

            {/* Mode 3: Hybrid */}
            <div
              className="premium-glass-card"
              style={{
                padding: "36px 30px",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                borderTop: "4px solid #11795A",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 50,
                    height: 50,
                    borderRadius: 14,
                    background: "#E3F1EA",
                    color: "#11795A",
                    fontSize: 26,
                  }}
                >
                  ⚡
                </div>
                <span className="status-stamp stamp-review" style={{ fontSize: 11 }}>
                  DUAL UNIFIED
                </span>
              </div>

              <span style={{ fontSize: 12.5, fontWeight: 800, color: "#11795A", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Dual Unified Operation
              </span>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink, #0B4D3B)", margin: "4px 0 12px" }}>
                BizTrackBD Hybrid
              </h3>
              <p style={{ fontSize: 15, color: "var(--ink-2, #3D5A52)", lineHeight: 1.6, margin: "0 0 20px" }}>
                For bespoke tailoring ateliers, salons selling beauty products, clinics with pharmacies, or workshops pairing part sales with on-site service appointments.
              </p>

              <div style={{ borderTop: "1px solid var(--line, #FBF7EC)", paddingTop: 18, flexGrow: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink, #0B4D3B)", margin: "0 0 12px" }}>
                  Key Capabilities:
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "var(--ink-2, #3D5A52)", lineHeight: 1.75 }}>
                  <li>Both retail cart checkout and booking on one domain</li>
                  <li>Unified catalog: shippable goods alongside bookable services</li>
                  <li>Single admin desk managing parcels, leads &amp; appointments</li>
                  <li>Shared customer history across orders and service requests</li>
                  <li>Consolidated transparent BDT monthly subscription</li>
                </ul>
              </div>

              <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
                <Link
                  href="/start?mode=hybrid"
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "11px 14px",
                    background: "#11795A",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    borderRadius: 8,
                    fontSize: 14,
                    textDecoration: "none",
                    boxShadow: "0 2px 8px rgba(17, 121, 90, 0.2)",
                  }}
                >
                  Configure Hybrid Mode →
                </Link>
                <Link
                  href="/contact"
                  style={{
                    padding: "11px 16px",
                    background: "#FBF7EC",
                    color: "var(--ink, #0B4D3B)",
                    fontWeight: 600,
                    borderRadius: 8,
                    fontSize: 14,
                    textDecoration: "none",
                  }}
                >
                  Talk to Architect
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comprehensive Capability Matrix with Elevated Styling */}
      <section style={{ padding: "50px 20px 80px", background: "#FFFFFF", borderTop: "1px solid var(--line, #DCE7E1)" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div style={{ marginBottom: 36 }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--accent, #11795A)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Technical Specification
            </span>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 800, color: "var(--ink, #0B4D3B)", margin: "6px 0 10px" }}>
              Side-by-Side Platform Capability Matrix
            </h2>
            <p style={{ fontSize: 16, color: "var(--ink-2, #3D5A52)", maxWidth: 740, margin: 0, lineHeight: 1.6 }}>
              Review the concrete technical features activated in each mode. You can upgrade, downgrade, or switch modes at any time as your operational needs evolve.
            </p>
          </div>

          <div
            style={{
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              borderRadius: 14,
              border: "1px solid var(--line, #DCE7E1)",
              background: "#FFFFFF",
              boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
            }}
          >
            <table className="comparison-table-v2">
              <thead>
                <tr>
                  <th style={{ width: "32%" }}>Capability &amp; Scope</th>
                  <th style={{ width: "16%", textAlign: "center", color: "#11795A" }}>Commerce Engine</th>
                  <th style={{ width: "16%", textAlign: "center", color: "var(--accent, #11795A)" }}>Business Engine</th>
                  <th style={{ width: "16%", textAlign: "center", color: "#11795A" }}>Hybrid Stack</th>
                  <th style={{ width: "20%" }}>Implementation Detail</th>
                </tr>
              </thead>
              <tbody>
                {CAPABILITIES.map((row) => (
                  <tr key={row.feature}>
                    <td style={{ fontWeight: 600, color: "var(--ink, #0B4D3B)" }}>
                      {row.feature}
                    </td>

                    <td style={{ textAlign: "center" }}>
                      {typeof row.commerce === "boolean" ? (
                        row.commerce ? (
                          <span className="spec-chip-positive">✓ Native</span>
                        ) : (
                          <span style={{ color: "#C3D4CB", fontSize: 18 }}>—</span>
                        )
                      ) : (
                        <span className="spec-chip-neutral">{row.commerce}</span>
                      )}
                    </td>

                    <td style={{ textAlign: "center" }}>
                      {typeof row.business === "boolean" ? (
                        row.business ? (
                          <span className="spec-chip-positive">✓ Native</span>
                        ) : (
                          <span style={{ color: "#C3D4CB", fontSize: 18 }}>—</span>
                        )
                      ) : (
                        <span className="spec-chip-neutral">{row.business}</span>
                      )}
                    </td>

                    <td style={{ textAlign: "center" }}>
                      {typeof row.hybrid === "boolean" ? (
                        row.hybrid ? (
                          <span className="spec-chip-positive">✓ Native</span>
                        ) : (
                          <span style={{ color: "#C3D4CB", fontSize: 18 }}>—</span>
                        )
                      ) : (
                        <span className="spec-chip-neutral">{row.hybrid}</span>
                      )}
                    </td>

                    <td style={{ color: "var(--ink-2, #3D5A52)", fontSize: 13, lineHeight: 1.45 }}>
                      {row.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing Navigation Hub */}
      <section style={{ padding: "72px 20px", background: "#FBF7EC", borderTop: "1px solid var(--line, #DCE7E1)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(26px, 3.5vw, 34px)", fontWeight: 800, color: "var(--ink, #0B4D3B)", margin: "0 0 12px" }}>
            Transparent Bangladeshi Taka Pricing for All Deployments
          </h2>
          <p style={{ fontSize: 16, color: "var(--ink-2, #3D5A52)", margin: "0 auto 32px", maxWidth: 640, lineHeight: 1.6 }}>
            Every plan starts at flat, predictable rates from ৳399 to ৳1,499 per month. Pay via bKash, Nagad, or debit cards with zero sales commission.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <Link
              href="/pricing"
              className="btn btn-primary"
              style={{
                padding: "12px 26px",
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 8,
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(17, 121, 90, 0.25)",
              }}
            >
              View Unified Retail &amp; Platform Pricing →
            </Link>
            <Link
              href="/business/pricing"
              className="btn btn-secondary"
              style={{
                padding: "12px 22px",
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 8,
                background: "#FFFFFF",
                textDecoration: "none",
              }}
            >
              View Business &amp; Clinic Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
