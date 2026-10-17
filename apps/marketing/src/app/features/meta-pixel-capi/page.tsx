import type { Metadata } from "next";
import Link from "next/link";
import { MetaCapiSimulator } from "@/components/meta-capi-simulator";
import { demoAdminUrl } from "@/lib/demo-admin";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meta Pixel & Conversions API (CAPI): Server-Side Tracking",
  description:
    "Recover lost browser purchase signals with built-in server-side Meta Conversions API (CAPI). Deduplicated events, SHA-256 cryptographic hashing, and accurate Taka ROAS.",
  keywords: [
    "meta conversions api bangladesh",
    "facebook pixel server capi",
    "ios 14 facebook tracking bangladesh",
    "facebook ad roas tracking taka",
    "মেটা পিক্সেল ট্র্যাকিং",
  ],
  alternates: {
    canonical: `${siteUrl}/features/meta-pixel-capi`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/features/meta-pixel-capi`,
    siteName: "BizTrackBD",
    title: "Meta Pixel & Conversions API (CAPI)",
    description: "Server-side event tracking with SHA-256 hashing and exact Taka ROAS.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "Meta CAPI" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Meta Pixel & Conversions API (CAPI)",
    description: "Reliable purchase tracking and deduplication for Bangladeshi Facebook advertisers.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const CAPI_FAQ: [string, string][] = [
  [
    "Why is a standard browser Facebook Pixel no longer enough in Bangladesh?",
    "Since Apple iOS 14 updates, Safari ITP, and the widespread adoption of Brave browser and uBlock Origin, 25% to 35% of browser-based JavaScript tracking events are completely blocked. Meta's ad algorithm never sees those purchases, which inflates your cost-per-purchase.",
  ],
  [
    "How does BizTrackBD prevent duplicate events if both the browser and server send the purchase?",
    "Every customer order generates a single, cryptographically unique `event_id` (e.g. `ord_4820`). Both the browser Pixel and server CAPI send this identical ID. When Meta receives both, its deduplication engine matches them and records exactly one clean conversion.",
  ],
  [
    "What customer data is sent to Meta, and is it private?",
    "We send only what is legally required for ad conversion matching: purchase amount in Taka, currency (BDT), and SHA-256 cryptographically hashed phone and email. Private chat logs, customer passwords, TrxIDs, and internal order notes are strictly excluded.",
  ],
  [
    "Does BizTrackBD also support TikTok Pixel or Google Analytics 4?",
    "Yes. You can connect Google Analytics 4 (GA4) with recommended e-commerce events and TikTok Pixel directly from your marketing settings with zero coding.",
  ],
];

const schemaJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "BizTrackBD Meta Conversions API Engine",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  offers: {
    "@type": "Offer",
    price: "699",
    priceCurrency: "BDT",
  },
};

export default function MetaPixelCapiPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaJsonLd) }}
      />

      {/* Hero */}
      <section className="hero hero-center" style={{ background: "var(--bg-paper)", borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <span
            className="eyebrow"
            style={{
              color: "#0284C7",
              background: "#E0F2FE",
              borderColor: "#BAE6FD",
              borderWidth: 1,
              borderStyle: "solid",
              padding: "4px 14px",
              borderRadius: 20,
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              display: "inline-block",
              marginBottom: 14,
            }}
          >
            Server-Side Attribution &middot; Meta CAPI
          </span>
          <h1 style={{ color: "var(--ink-ledger)", fontSize: "clamp(34px, 5.5vw, 54px)", lineHeight: 1.12, letterSpacing: "-1.5px" }}>
            Recover dropped checkout conversions with <br className="hidden-mobile" />
            <span style={{ color: "#0284C7" }}>server-side Meta Conversions API.</span>
          </h1>
          <p className="lead" style={{ maxWidth: 740, margin: "18px auto 0", color: "var(--ink-2)", fontSize: "clamp(16px, 2vw, 19px)", lineHeight: 1.6 }}>
            Complement browser tracking with resilient server-to-server purchase signals. Transmit direct server events with exact Taka values and automatic deduplication to train Meta&apos;s ad algorithm on your highest-paying buyers.
          </p>

          <div className="cta" style={{ marginTop: 28, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/start?mode=ecommerce"
              className="btn btn-primary btn-lg"
              style={{ background: "#0284C7", borderColor: "#0369A1" }}
              prefetch={false}
            >
              Start 14-day free trial
            </Link>
            <a
              href={demoAdminUrl("gadgetstudio")}
              className="btn btn-secondary btn-lg"
              style={{ background: "#FFFFFF", color: "var(--ink-ledger)", border: "1.5px solid var(--line-strong)" }}
            >
              Inspect Tracking Settings in Demo Admin ↗
            </a>
          </div>

          <p className="fine" style={{ marginTop: 14, fontSize: 13.5, color: "var(--ink-3)" }}>
            Included on all plans &middot; Zero code integration &middot; SHA-256 cryptographic hashing
          </p>
        </div>
      </section>

      {/* Interactive Simulator */}
      <section className="block" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 36px" }}>
            <span className="status-stamp stamp-paid" style={{ marginBottom: 12 }}>
              THE TRACKING ENGINE
            </span>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px", color: "var(--ink-ledger)" }}>
              Deduplication simulator &middot; Zero duplicate counts
            </h2>
            <p style={{ margin: "12px auto 0", fontSize: 16, color: "var(--ink-2)" }}>
              Toggle browser conditions below to see how server CAPI rescues blocked browser conversions in real time.
            </p>
          </div>

          <MetaCapiSimulator />
        </div>
      </section>

      {/* 4 Pillars */}
      <section className="block soft" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 36px" }}>
            <span className="eyebrow">Marketing Advantage</span>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px", color: "var(--ink-ledger)" }}>
              Scale winning Facebook ads with complete conversion data
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>🎯</div>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ink-ledger)" }}>Event Match Quality (9+/10)</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                High-quality parameter transmission gives Meta the exact data needed to lower your cost-per-result (CPA).
              </p>
            </div>

            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>🔄</div>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ink-ledger)" }}>Automatic Deduplication</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Every purchase receives a unique event ID, preventing Meta from double-counting orders when both channels fire.
              </p>
            </div>

            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>🇧🇩</div>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ink-ledger)" }}>Real BDT Purchase Values</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Orders report exact Taka amounts without foreign currency distortions, training Meta on true cart sizes.
              </p>
            </div>

            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>🔒</div>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ink-ledger)" }}>SHA-256 Customer Privacy</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Customer identifiers are cryptographically hashed before leaving your server, ensuring full data privacy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="block">
        <div className="wrap">
          <h2 style={{ textAlign: "center", margin: "0 auto 32px", fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px" }}>
            Frequently asked questions about Meta Pixel &amp; CAPI
          </h2>
          <dl className="faq-list">
            {CAPI_FAQ.map(([q, a]) => (
              <div key={q}>
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="cta-band" style={{ background: "#0369A1" }}>
        <div className="wrap">
          <h2 style={{ color: "#FFFFFF", fontSize: "clamp(28px, 4.5vw, 42px)", letterSpacing: "-1.2px" }}>
            Supercharge your Facebook advertising with BizTrackBD
          </h2>
          <p style={{ color: "#E0F2FE", fontSize: 17, marginTop: 10 }}>
            14 days free &middot; Server-side CAPI included &middot; Zero sales commission
          </p>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/start?mode=ecommerce" className="btn btn-lg btn-primary" style={{ background: "#FFFFFF", color: "#0369A1" }} prefetch={false}>
              Start 14-day free trial
            </Link>
            <a
              href={demoAdminUrl("gadgetstudio")}
              className="btn btn-lg btn-secondary"
              style={{ background: "rgba(255,255,255,0.15)", color: "#FFFFFF", borderColor: "rgba(255,255,255,0.3)" }}
            >
              Open Live Demo Desk ↗
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
