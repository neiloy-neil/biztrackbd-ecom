import type { Metadata } from "next";
import Link from "next/link";
import { MigrateAnalyzer } from "./migrate-analyzer";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: "Migrate from Shopify or WooCommerce: Zero Downtime Switch",
  description: "Switch your Bangladeshi ecommerce store from Shopify or WooCommerce to BizTrackBD with zero downtime. Keep your domain, product photos, and variants. Save over ৳ 90,000/year with native bKash and Pathao integration.",
  alternates: {
    canonical: `${siteUrl}/migrate`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/migrate`,
    siteName: "BizTrackBD",
    title: "Migrate from Shopify or WooCommerce: Zero Downtime Switch",
    description: "Switch your store with zero downtime. Keep your domain, photos, and variants while avoiding USD card billing.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "Migrate to BizTrackBD" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Migrate from Shopify or WooCommerce: Zero Downtime Switch",
    description: "Keep your catalog and domain intact with native Bangladesh courier and payment integrations.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const STEPS = [
  {
    step: "01",
    title: "Export your catalog in 1 click",
    desc: "From your Shopify Admin, click Products → Export → All products (CSV). No re-formatting or column editing required.",
  },
  {
    step: "02",
    title: "Instant multi-variant & photo mapping",
    desc: "BizTrackBD automatically maps your Size/Color matrices, SKU barcodes, inventory counts, and high-resolution CDN images.",
  },
  {
    step: "03",
    title: "Keep your custom domain (0s downtime)",
    desc: "Simply point your DNS CNAME record. Your existing Google search ranking and customer links remain intact with automatic SSL.",
  },
  {
    step: "04",
    title: "Turn on native bKash & courier APIs",
    desc: "Enter your Pathao or Steadfast API token and bKash wallet number. You're ready to print thermal labels and verify TrxIDs immediately.",
  },
];

const FAQS = [
  {
    q: "Will my product photos or variants break when I close Shopify?",
    a: "No. BizTrackBD immediately links all external CDN photo URLs upon import and safely mirrors them to resilient media storage so your images never 404 even after closing your Shopify account.",
  },
  {
    q: "Do I need an international credit card or passport endorsement?",
    a: "Never. Unlike Shopify which bills in USD and requires international dual-currency credit cards with bank endorsements, BizTrackBD is billed in BDT (৳) via bKash, Nagad, or local bank transfer.",
  },
  {
    q: "Can the BizTrackBD team handle the migration for me?",
    a: "Yes! We offer 100% free concierge migration. Our Dhaka engineering team will connect with you via WhatsApp or phone, assist with your DNS records, import your products, and ensure your couriers are fully tested before you flip the switch.",
  },
  {
    q: "What about my existing Google search rankings (SEO)?",
    a: "BizTrackBD automatically preserves clean, search-friendly slugs matching your product titles, generates dynamic OpenGraph cards, and outputs automated XML sitemaps to ensure your search rankings continue thriving.",
  },
];

export default function MigratePage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };

  return (
    <div className="migrate-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Hero Header */}
      <section className="sec" style={{ paddingTop: 48, paddingBottom: 36, background: "var(--soft)" }}>
        <div className="wrap" style={{ textAlign: "center", maxWidth: 840 }}>
          <span
            className="chip"
            style={{
              background: "var(--tint)",
              color: "var(--brand)",
              border: "1px solid var(--tint-border)",
              fontWeight: 700,
              fontSize: 12.5,
              letterSpacing: "0.04em",
              marginBottom: 16,
              display: "inline-block",
            }}
          >
            ZERO-DOWNTIME MIGRATION HUB
          </span>
          <h1 style={{ fontSize: "clamp(28px, 4.5vw, 46px)", fontWeight: 800, color: "var(--ink)", lineHeight: 1.15, marginBottom: 16 }}>
            Switch from Shopify or WooCommerce in Minutes
          </h1>
          <p className="muted" style={{ fontSize: "clamp(16px, 2vw, 18px)", lineHeight: 1.6, maxWidth: 680, margin: "0 auto 28px" }}>
            Keep your domain, your customer links, and all your product photos. Eliminate dollar credit card friction, 2% sales commissions, and manual courier copy-pasting.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
            <Link
              href="/migrate/shopify"
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 700 }}
            >
              Shopify Migration Playbook →
            </Link>
            <Link
              href="/migrate/woocommerce"
              className="btn btn-secondary btn-sm"
              style={{ fontWeight: 700 }}
            >
              WooCommerce Migration Playbook →
            </Link>
          </div>
        </div>
      </section>

      {/* Interactive Tool */}
      <section className="sec" style={{ paddingTop: 20, paddingBottom: 60 }}>
        <div className="wrap">
          <MigrateAnalyzer />
        </div>
      </section>

      {/* 4-Step Zero Downtime Blueprint */}
      <section className="sec" style={{ background: "var(--soft)", padding: "72px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 48px" }}>
            <span className="chip" style={{ background: "var(--tint)", color: "var(--brand)", fontWeight: 700, marginBottom: 12 }}>
              THE 4-STEP BLUEPRINT
            </span>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: "var(--ink)", lineHeight: 1.25, marginBottom: 12 }}>
              How the Zero-Downtime Transition Works
            </h2>
            <p className="muted" style={{ fontSize: 16 }}>
              You don&apos;t lose a single visitor or order. Your old store can continue taking orders right up until your new BizTrackBD storefront is verified and live.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 20,
            }}
          >
            {STEPS.map((s) => (
              <div
                key={s.step}
                className="card"
                style={{
                  padding: 24,
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--line)",
                  background: "var(--bg)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: "var(--brand)",
                    fontFamily: "var(--font-jakarta)",
                  }}
                >
                  {s.step}
                </span>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>{s.title}</h3>
                <p className="muted" style={{ fontSize: 14.5, lineHeight: 1.55 }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Recap */}
      <section className="sec" style={{ padding: "72px 0" }}>
        <div className="wrap">
          <div
            className="card"
            style={{
              background: "var(--ink)",
              color: "#FFFFFF",
              borderRadius: "var(--radius-lg)",
              padding: "48px 36px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 36,
              alignItems: "center",
            }}
          >
            <div>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 12px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.12)",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  marginBottom: 14,
                }}
              >
                BACKED BY THE DIGITAL DUDE
              </span>
              <h2 style={{ fontSize: "clamp(24px, 3vw, 34px)", fontWeight: 800, lineHeight: 1.25, marginBottom: 14 }}>
                Ready to stop leaking profits to USD exchange rates?
              </h2>
              <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "rgba(255,255,255,0.8)", marginBottom: 24 }}>
                Join hundreds of apparel, electronics, and beauty merchants in Dhaka, Chittagong, and Sylhet who switched from Shopify to BizTrackBD.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <Link href="/start" className="btn btn-primary" style={{ background: "#5B4FE8", color: "#FFF", fontWeight: 700 }}>
                  Start Onboarding &rarr;
                </Link>
                <Link href="/compare" className="btn btn-secondary" style={{ background: "transparent", color: "#FFF", borderColor: "rgba(255,255,255,0.3)" }}>
                  See Shopify Cost Matrix
                </Link>
              </div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.06)",
                borderRadius: "var(--radius)",
                padding: 24,
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: "#FFFFFF" }}>
                What BizTrackBD Replaces:
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10, fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
                <li style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: "#4ADE80" }}>✓</span>
                  <span><b>$39 USD/mo Shopify base fee</b> &rarr; Replaced by ৳ 699/mo flat BDT</span>
                </li>
                <li style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: "#4ADE80" }}>✓</span>
                  <span><b>2% Shopify transaction commission</b> &rarr; Replaced by 0% commission</span>
                </li>
                <li style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: "#4ADE80" }}>✓</span>
                  <span><b>3rd-party bKash app ($15/mo)</b> &rarr; Replaced by built-in bKash desk</span>
                </li>
                <li style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: "#4ADE80" }}>✓</span>
                  <span><b>Manual Pathao/Steadfast copy-paste</b> &rarr; Replaced by 1-click bulk booking</span>
                </li>
                <li style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: "#4ADE80" }}>✓</span>
                  <span><b>Twilio SMS USD account</b> &rarr; Replaced by native Bangla SMS</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Migration FAQs */}
      <section className="sec" style={{ padding: "64px 0", background: "var(--soft)" }}>
        <div className="wrap" style={{ maxWidth: 840 }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <span className="chip" style={{ background: "var(--tint)", color: "var(--brand)", fontWeight: 700, marginBottom: 10 }}>
              MIGRATION QUESTIONS
            </span>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)" }}>
              Frequently Asked Questions About Switching
            </h2>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            {FAQS.map((f, i) => (
              <div
                key={i}
                className="card"
                style={{
                  padding: "20px 24px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--line)",
                  background: "var(--bg)",
                }}
              >
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
                  {f.q}
                </h3>
                <p className="muted" style={{ fontSize: 14.5, lineHeight: 1.6 }}>
                  {f.a}
                </p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 36 }}>
            <p className="muted" style={{ fontSize: 14.5, marginBottom: 12 }}>
              Have questions about your custom theme or order history?
            </p>
            <a
              href="https://wa.me/8801700000000?text=Hello%20BizTrackBD%20team,%20I%20have%20questions%20about%20migrating%20my%20store."
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ fontWeight: 600 }}
            >
              Chat with our Dhaka Technical Team on WhatsApp
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
