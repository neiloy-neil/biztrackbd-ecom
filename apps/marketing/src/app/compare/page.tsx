import type { Metadata } from "next";
import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";
import { CompareView, type ComparisonCard, type MatrixRow } from "./compare-view";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: "eCommerce & Business Platform Comparisons: Shopify, Woo, Pathao, Wix",
  description:
    "An honest, vendor-neutral comparison of website and eCommerce solutions in Bangladesh. Compare BizTrackBD, Shopify, WooCommerce, Pathao, Wix, and WordPress by BDT costs, local payments, and operational fit.",
  alternates: {
    canonical: `${siteUrl}/compare`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/compare`,
    siteName: "BizTrackBD",
    title: "eCommerce & Business Platform Comparisons for Bangladesh",
    description: "Honest comparison of BizTrackBD vs Shopify, WooCommerce, Pathao, Wix, and WordPress.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "Platform Comparisons" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "eCommerce & Business Platform Comparisons for Bangladesh",
    description: "Evaluate platforms on total cost of ownership, local courier automation, and return prevention.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const STOREFRONT_CARDS: ComparisonCard[] = [
  {
    slug: "shopify",
    title: "BizTrackBD vs Shopify",
    tagline: "Global Multicurrency Giant vs Local Cash & Courier Operating System",
    summary:
      "Shopify is the gold standard for global international trade in USD. In Bangladesh, international credit card limits, 15% card tax, 2% third-party gateway cuts, and missing local address hierarchies make BizTrackBD the superior domestic operational choice.",
    bestForComp: "Global cross-border exports, enterprise stores selling in USD, multi-currency brands.",
    bestForBiztrack: "Domestic Bangladeshi brands shipping via Cash on Delivery, bKash, Steadfast, and Pathao.",
    badge: "Most Common Switch",
    hasDeepPage: true,
  },
  {
    slug: "woocommerce",
    title: "BizTrackBD vs WooCommerce",
    tagline: "Open-Source WordPress Freedom vs Zero-Maintenance Managed Operations",
    summary:
      "WooCommerce provides unlimited source-code customization if you have in-house PHP engineers. BizTrackBD eliminates server crashes during Eid flash sales, plugin conflicts, annual plugin renewal fees, and provides a national pooled COD fraud network.",
    bestForComp: "Agencies with dedicated PHP developers wanting self-hosted bare metal control.",
    bestForBiztrack: "Growing online retail teams who want reliable, high-speed sales without server maintenance.",
    badge: "Stability & Speed",
    hasDeepPage: true,
  },
  {
    slug: "pathao-commerce",
    title: "BizTrackBD vs Pathao Commerce",
    tagline: "Single-Courier Logistics Lock-in vs Neutral Multi-Carrier Independence",
    summary:
      "Pathao Commerce offers a quick start for casual sellers already delivering with Pathao. BizTrackBD gives you true brand ownership (custom domain, Meta CAPI) and multi-courier choice—allowing you to rate-shop Steadfast, Pathao, and RedX side by side.",
    bestForComp: "Casual social sellers shipping exclusively with Pathao riders within Dhaka metro.",
    bestForBiztrack: "Serious retail merchants who need Steadfast for nationwide upazila reach and lower return rates.",
    badge: "Courier Independence",
    hasDeepPage: true,
  },
];

const BUSINESS_CARDS: ComparisonCard[] = [
  {
    slug: "wix",
    title: "BizTrackBD vs Wix",
    tagline: "Global Drag-and-Drop Canvas vs Localized Bangladesh Business Engine",
    summary:
      "Wix offers pixel-perfect free-form visual layout freedom. In Bangladesh, dollar billing barriers, 15% bank surcharge, lack of BMDC doctor chambers, and missing local table QR menus make BizTrackBD Business the practical, high-conversion choice.",
    bestForComp: "International designers needing arbitrary pixel placement and access to 300+ Western apps.",
    bestForBiztrack: "Bangladeshi doctors, clinics, restaurants, and service firms needing BDT bKash billing and local workflows.",
    badge: "Local Service Fit",
    hasDeepPage: true,
  },
  {
    slug: "wordpress",
    title: "BizTrackBD vs WordPress & Elementor",
    tagline: "Complex Open-Source Stack vs Fast, Managed Edge Platform in Taka",
    summary:
      "WordPress with Elementor provides unlimited plugins if you budget for developers and cloud hosting. BizTrackBD eliminates plugin conflicts, server defacement, and delivers sub-100ms mobile speed with an organized Lead Inbox.",
    bestForComp: "Companies with full-time PHP engineers who require direct database and SSH server access.",
    bestForBiztrack: "Professional service businesses, clinics, and portfolios wanting zero maintenance and predictable BDT pricing.",
    badge: "Zero Maintenance",
    hasDeepPage: true,
  },
  {
    slug: "squarespace",
    title: "BizTrackBD vs Squarespace",
    tagline: "Curated Western Editorial Aesthetics vs Bilingual Bangla/English Business Workflows",
    summary:
      "Squarespace is revered for minimalist Western typography and podcast/blog styling. But with no BDT payment options, no WhatsApp routing, and no local address hierarchies, it leaves Bangladeshi service providers disconnected from their customers.",
    bestForComp: "Western lifestyle bloggers and creative consultants selling digital products in North America.",
    bestForBiztrack: "Bangladeshi consultants, agencies, and clinics communicating via WhatsApp and local mobile networks.",
    badge: "Bilingual Speed",
    hasDeepPage: false,
  },
];

const STOREFRONT_MATRIX: MatrixRow[] = [
  {
    dimension: "Monthly Base Price Currency",
    biztrack: "Flat BDT (৳ 399 - ৳ 1,499)",
    comp1: "USD ($39 - $399/mo + 15% tax)",
    comp2: "Hosting & Plugins (৳ 4,000+/mo)",
    comp3: "Free / ৳ 500/mo (Tied to courier)",
    comp1Name: "Shopify",
    comp2Name: "WooCommerce",
    comp3Name: "Pathao Commerce",
  },
  {
    dimension: "Payment Method for Subscription",
    biztrack: "Personal or Merchant bKash/Nagad",
    comp1: "Passport-endorsed Dual Currency Card",
    comp2: "Credit card for hosting / USD plugins",
    comp3: "Deducted from courier payouts",
    comp1Name: "Shopify",
    comp2Name: "WooCommerce",
    comp3Name: "Pathao Commerce",
  },
  {
    dimension: "Sales Commission / Gateway Cut",
    biztrack: "0% commission",
    comp1: "0.5% - 2.0% cut on all sales",
    comp2: "0% (Gateway fees apply)",
    comp3: "0% (Courier parcel charges apply)",
    comp1Name: "Shopify",
    comp2Name: "WooCommerce",
    comp3Name: "Pathao Commerce",
  },
  {
    dimension: "Native bKash & Nagad Checkout",
    biztrack: "Built-in customer TrxID + 1-tap verify",
    comp1: "Requires 3rd-party monthly paid apps",
    comp2: "Requires 3rd-party community plugins",
    comp3: "Built-in digital payment options",
    comp1Name: "Shopify",
    comp2Name: "WooCommerce",
    comp3Name: "Pathao Commerce",
  },
  {
    dimension: "Multi-Courier Dispatch (Steadfast, Pathao, RedX)",
    biztrack: "Multi-carrier rate shopping & bulk labels",
    comp1: "Manual copy-paste or custom webhooks",
    comp2: "Multiple disparate plugins",
    comp3: "Locked to Pathao Courier only",
    comp1Name: "Shopify",
    comp2Name: "WooCommerce",
    comp3Name: "Pathao Commerce",
  },
  {
    dimension: "National COD Return Fraud Checker",
    biztrack: "Built-in delivery track record check",
    comp1: "None for Bangladeshi phone numbers",
    comp2: "None (Manual checking required)",
    comp3: "Pathao internal history only",
    comp1Name: "Shopify",
    comp2Name: "WooCommerce",
    comp3Name: "Pathao Commerce",
  },
  {
    dimension: "Where This Platform Wins",
    biztrack: "All-in-one Bangladesh domestic operations",
    comp1: "Global international sales in USD/EUR",
    comp2: "100% self-hosted source code control",
    comp3: "Zero-effort setup for single-courier users",
    comp1Name: "Shopify",
    comp2Name: "WooCommerce",
    comp3Name: "Pathao Commerce",
  },
];

const BUSINESS_MATRIX: MatrixRow[] = [
  {
    dimension: "Monthly Base Price Currency",
    biztrack: "Flat BDT (৳ 399 - ৳ 1,499)",
    comp1: "USD ($17 - $36/mo + 15% tax)",
    comp2: "VPS & Plugins (৳ 4,000 - ৳ 10,000/mo)",
    comp3: "USD ($16 - $52/mo + 15% tax)",
    comp1Name: "Wix",
    comp2Name: "WordPress",
    comp3Name: "Squarespace",
  },
  {
    dimension: "Payment Method for Plan",
    biztrack: "bKash, Nagad, Rocket, or local cards",
    comp1: "Dual-currency credit card with passport",
    comp2: "USD hosting card + plugin licenses",
    comp3: "Dual-currency credit card in USD",
    comp1Name: "Wix",
    comp2Name: "WordPress",
    comp3Name: "Squarespace",
  },
  {
    dimension: "Medical Doctor Multi-Chambers",
    biztrack: "BMDC verified badges & weekly visiting hours",
    comp1: "Generic calendar without chamber routing",
    comp2: "Requires 3rd-party appointment plugins",
    comp3: "Basic Acuity scheduling (English only)",
    comp1Name: "Wix",
    comp2Name: "WordPress",
    comp3Name: "Squarespace",
  },
  {
    dimension: "Restaurant Contactless Table QR Menu",
    biztrack: "Native table QR, bilingual dishes, table tray",
    comp1: "Static PDF or Western restaurant app",
    comp2: "Heavy WooCommerce dining plugins",
    comp3: "Static PDF menu display only",
    comp1Name: "Wix",
    comp2Name: "WordPress",
    comp3Name: "Squarespace",
  },
  {
    dimension: "Centralized Lead & Booking Desk",
    biztrack: "Built-in inbox with 1-tap WhatsApp & staff notes",
    comp1: "Email notifications only",
    comp2: "Fragmented form entries or external CRM",
    comp3: "Email alerts; no WhatsApp dispatch",
    comp1Name: "Wix",
    comp2Name: "WordPress",
    comp3Name: "Squarespace",
  },
  {
    dimension: "Bangla Mobile Font Rendering",
    biztrack: "Pre-rendered Hind Siliguri subsetting (<100ms)",
    comp1: "Ligature breakages & font fallback flash",
    comp2: "Heavy Elementor DOM; sluggish on 3G/4G",
    comp3: "Limited Bengali font support",
    comp1Name: "Wix",
    comp2Name: "WordPress",
    comp3Name: "Squarespace",
  },
  {
    dimension: "Where This Platform Wins",
    biztrack: "Bangladeshi business workflows & BDT pricing",
    comp1: "Free-form drag-and-drop canvas freedom",
    comp2: "100% open-source PHP & database access",
    comp3: "Minimalist Western editorial aesthetics",
    comp1Name: "Wix",
    comp2Name: "WordPress",
    comp3Name: "Squarespace",
  },
];

const FAQS = [
  {
    q: "Why does BizTrackBD publish trade-offs where competitors win?",
    a: "We believe in authentic operational fit. If you are selling handmade crafts to customers in London or New York and accepting Stripe or PayPal in USD, Shopify is legitimately the better tool. If you have an in-house software team that modifies database tables directly, WordPress offers maximum control. But for merchants and business owners operating domestically in Bangladesh with Cash on Delivery, bKash, and local couriers, BizTrackBD eliminates thousands of Taka in unnecessary foreign fees and operational headache.",
  },
  {
    q: "How often are these comparison details verified?",
    a: "Every page in our comparison suite is reviewed quarterly against official vendor pricing, release notes, and documentation. The current audit was completed in October 2026.",
  },
  {
    q: "Can I migrate my store catalog from Shopify or WooCommerce?",
    a: "Yes. BizTrackBD supports direct 1-click CSV catalog imports compatible with standard Shopify and WooCommerce product export structures. Titles, variations, prices, descriptions, and images map automatically.",
  },
  {
    q: "Do I have to pay transaction fees or sales commissions on BizTrackBD?",
    a: "No. Unlike Shopify which charges 2.0% on orders when you do not use Shopify Payments (which is unavailable in Bangladesh), BizTrackBD charges 0% sales commission on all plans. What you earn belongs 100% to your business.",
  },
];

export default function CompareHubPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "eCommerce & Business Platform Comparisons for Bangladesh | BizTrackBD",
    description:
      "A vendor-neutral, honest comparison of eCommerce and business website builders in Bangladesh: BizTrackBD vs Shopify, WooCommerce, Pathao Commerce, Wix, and WordPress.",
    publisher: {
      "@type": "Organization",
      name: "BizTrackBD",
      url: siteUrl,
    },
    mainEntity: {
      "@type": "FAQPage",
      mainEntity: FAQS.map((faq) => ({
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
    <div style={{ background: "#FAFAFC", minHeight: "100vh" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Header */}
      <section
        style={{
          padding: "60px 20px 48px",
          background: "linear-gradient(180deg, #FFFFFF 0%, #F5F7FA 100%)",
          borderBottom: "1px solid var(--line, #E5E7EB)",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto", textAlign: "center" }}>
          {/* Breadcrumb Hierarchy */}
          <nav
            aria-label="Breadcrumbs"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--ink-3, #667085)",
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            <Link href="/" style={{ color: "var(--ink-2, #475467)", textDecoration: "none" }}>
              Home
            </Link>
            <span aria-hidden="true">›</span>
            <span style={{ color: "var(--ink, #101828)", fontWeight: 600 }}>Platform Comparisons</span>
          </nav>

          <span
            style={{
              display: "inline-block",
              padding: "4px 14px",
              borderRadius: "20px",
              background: "#EEF2FF",
              color: "var(--accent, #3B5BFD)",
              fontSize: "12.5px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Objective Bangladesh Platform Evaluation
          </span>

          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 50px)",
              letterSpacing: "-1.3px",
              lineHeight: 1.15,
              fontWeight: 800,
              color: "var(--ink, #101828)",
              margin: "0 auto 16px",
              maxWidth: 900,
            }}
          >
            An Honest, Vendor-Neutral Platform Comparison
          </h1>

          <p
            style={{
              fontSize: "clamp(16px, 2.5vw, 19px)",
              color: "var(--ink-2, #475467)",
              lineHeight: 1.6,
              maxWidth: 820,
              margin: "0 auto",
            }}
          >
            No software platform is best at everything. We believe in complete transparency about where competitors excel and where BizTrackBD solves specific operational bottlenecks for Bangladeshi businesses—from courier automation and COD return protection to local bKash billing and doctor chambers.
          </p>

          <div style={{ marginTop: 28, display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/start"
              className="btn btn-primary"
              style={{
                padding: "11px 24px",
                fontSize: 14.5,
                fontWeight: 700,
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              Start Free 14-Day Trial →
            </Link>
            <a
              href={demoAdminUrl()}
              className="btn btn-secondary"
              data-testid="compare-hero-demo-admin"
              style={{
                padding: "11px 20px",
                fontSize: 14.5,
                fontWeight: 600,
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              Explore Sandbox Admin Desk
            </a>
          </div>
        </div>
      </section>

      {/* Main Comparison Section with Dual Mode Tab Switcher */}
      <section style={{ padding: "40px 20px 80px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <CompareView
            storefrontCards={STOREFRONT_CARDS}
            businessCards={BUSINESS_CARDS}
            storefrontMatrix={STOREFRONT_MATRIX}
            businessMatrix={BUSINESS_MATRIX}
          />
        </div>
      </section>

      {/* FAQs */}
      <section style={{ padding: "64px 20px", background: "#FFFFFF", borderTop: "1px solid var(--line, #E5E7EB)" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 34px)", fontWeight: 800, color: "var(--ink, #101828)", margin: "0 0 10px" }}>
              Frequently Asked Comparison Questions
            </h2>
            <p style={{ fontSize: 15, color: "var(--ink-2, #475467)", margin: 0 }}>
              Practical answers regarding local Bangladeshi operations, switching platforms, and commission policies.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {FAQS.map((faq, idx) => (
              <div
                key={idx}
                style={{
                  background: "#FAFAFC",
                  borderRadius: 12,
                  border: "1px solid var(--line, #E5E7EB)",
                  padding: "20px 24px",
                }}
              >
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink, #101828)", margin: "0 0 8px" }}>
                  {faq.q}
                </h3>
                <p style={{ fontSize: 14.5, color: "var(--ink-2, #475467)", lineHeight: 1.6, margin: 0 }}>
                  {faq.a}
                </p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 48 }}>
            <h3 style={{ fontSize: 19, fontWeight: 800, color: "var(--ink, #101828)", margin: "0 0 8px" }}>
              Ready to experience an operating system built specifically for Bangladesh?
            </h3>
            <p style={{ fontSize: 14.5, color: "var(--ink-2, #475467)", margin: "0 0 20px" }}>
              14-day free trial &middot; 0% sales commission &middot; Setup in 10 minutes with zero dollar cards
            </p>
            <Link
              href="/start"
              className="btn btn-primary"
              style={{
                padding: "12px 28px",
                fontSize: 15,
                fontWeight: 700,
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              Build My Store or Website Free →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
