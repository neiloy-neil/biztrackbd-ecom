import type { Metadata } from "next";
import Link from "next/link";
import { PaymentWalletMatcher } from "@/components/payment-wallet-matcher";
import { demoAdminUrl } from "@/lib/demo-admin";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Direct bKash, Nagad & COD Payments: 0% Commission",
  description:
    "Accept customer bKash and Nagad payments directly into your mobile wallet with 0% sales commission. Verify TrxIDs in 1 tap from your smartphone without payment gateway escrow delays.",
  keywords: [
    "bkash payment gateway bangladesh",
    "nagad ecommerce checkout",
    "direct bkash trxid verification",
    "cash on delivery bangladesh ecommerce",
    "০% কমিশন পেমেন্ট",
  ],
  alternates: {
    canonical: `${siteUrl}/features/bkash-nagad-cod`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/features/bkash-nagad-cod`,
    siteName: "BizTrackBD",
    title: "Direct bKash, Nagad & COD: 0% Commission",
    description: "Receive payments straight to your personal or merchant wallet with 0 gateway delays.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "bKash & Nagad Direct Checkout" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Direct bKash, Nagad & COD: 0% Commission",
    description: "Accept customer bKash and Nagad payments directly with 0% commission.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const PAYMENT_FAQ: [string, string][] = [
  [
    "Do I need a commercial bKash Merchant account, or can I use a personal bKash number?",
    "You can use either. Many growing sellers start with their personal bKash or Nagad wallet number. As your store grows, you can connect a bKash Merchant account or gateway at any time. BizTrackBD works seamlessly with both.",
  ],
  [
    "Does BizTrackBD take a percentage or fee from my customer payments?",
    "Never. We charge 0% commission. When a customer sends ৳ 2,450 to your bKash, you receive the full ৳ 2,450. Your money never passes through our bank account or escrow.",
  ],
  [
    "How does the customer verify their payment at checkout?",
    "After sending the money via their bKash or Nagad app to your displayed store number, the customer enters their 8-to-10 digit Transaction ID (TrxID) into the checkout form. The order appears in your admin with the TrxID highlighted for 1-tap confirmation.",
  ],
  [
    "Can I require advance delivery charges for Cash on Delivery (COD) orders?",
    "Yes. You can enforce a mandatory partial payment (e.g. ৳ 120 delivery charge) via bKash/Nagad before the COD order is accepted, protecting you against fake orders and courier returns.",
  ],
];

const schemaJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "BizTrackBD Direct Payments Engine",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  offers: {
    "@type": "Offer",
    price: "399",
    priceCurrency: "BDT",
  },
};

export default function BkashNagadCodPage() {
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
              color: "#E2136E",
              background: "#FDF2F8",
              borderColor: "#FBCFE8",
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
            Direct Payments &middot; 0% Commission
          </span>
          <h1 style={{ color: "var(--ink-ledger)", fontSize: "clamp(34px, 5.5vw, 54px)", lineHeight: 1.12, letterSpacing: "-1.5px" }}>
            Accept bKash, Nagad &amp; COD <br className="hidden-mobile" />
            <span style={{ color: "#E2136E" }}>straight into your own mobile wallet.</span>
          </h1>
          <p className="lead" style={{ maxWidth: 740, margin: "18px auto 0", color: "var(--ink-2)", fontSize: "clamp(16px, 2vw, 19px)", lineHeight: 1.6 }}>
            Customers send money directly to your personal or merchant wallet. Verify TrxIDs with 1 tap from your smartphone. Zero sales commission, zero escrow delays, and 100% immediate cash liquidity.
          </p>

          <div className="cta" style={{ marginTop: 28, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/start?mode=ecommerce"
              className="btn btn-primary btn-lg"
              style={{ background: "#E2136E", borderColor: "#BE185D" }}
              prefetch={false}
            >
              Start 14-day free trial
            </Link>
            <a
              href={demoAdminUrl("gadgetstudio")}
              className="btn btn-secondary btn-lg"
              style={{ background: "#FFFFFF", color: "var(--ink-ledger)", border: "1.5px solid var(--line-strong)" }}
            >
              Try bKash Verification in Live Demo ↗
            </a>
          </div>

          <p className="fine" style={{ marginTop: 14, fontSize: 13.5, color: "var(--ink-3)" }}>
            0% sales commission &middot; No middleman escrow &middot; bKash, Nagad, Rocket &amp; COD supported
          </p>
        </div>
      </section>

      {/* Interactive Simulator */}
      <section className="block" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 36px" }}>
            <span className="status-stamp stamp-paid" style={{ marginBottom: 12 }}>
              THE PAYMENT WORKFLOW
            </span>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px", color: "var(--ink-ledger)" }}>
              Direct wallet settlement &middot; 1-tap TrxID verification
            </h2>
            <p style={{ margin: "12px auto 0", fontSize: 16, color: "var(--ink-2)" }}>
              See the exact difference between traditional escrow gateways and BizTrackBD&apos;s direct wallet verification.
            </p>
          </div>

          <PaymentWalletMatcher />
        </div>
      </section>

      {/* 4 Pillars */}
      <section className="block soft" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 36px" }}>
            <span className="eyebrow">Payment Integrity</span>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px", color: "var(--ink-ledger)" }}>
              Why Bangladeshi merchants love direct wallet settlement
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>💰</div>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ink-ledger)" }}>0% Platform Commission</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Other platforms take 2% to 3% of your gross sales. BizTrackBD charges 0% commission on your revenue.
              </p>
            </div>

            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>⚡</div>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ink-ledger)" }}>Instant Working Capital</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Funds are immediately in your mobile wallet. You can buy materials in Gausia or Elephant Road without waiting for bank payouts.
              </p>
            </div>

            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>🛡️</div>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ink-ledger)" }}>No Dollar Cards Needed</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Pay for your BizTrackBD software subscription in Bangladeshi Taka via bKash or Nagad. Zero passport endorsement required.
              </p>
            </div>

            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>📋</div>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ink-ledger)" }}>Advance COD Delivery Fee</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Enforce mandatory ৳ 120 courier booking advances on risky orders to confirm genuine buyer commitment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="block">
        <div className="wrap">
          <h2 style={{ textAlign: "center", margin: "0 auto 32px", fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px" }}>
            Frequently asked questions about Payments
          </h2>
          <dl className="faq-list">
            {PAYMENT_FAQ.map(([q, a]) => (
              <div key={q}>
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="cta-band" style={{ background: "#BE185D" }}>
        <div className="wrap">
          <h2 style={{ color: "#FFFFFF", fontSize: "clamp(28px, 4.5vw, 42px)", letterSpacing: "-1.2px" }}>
            Keep 100% of your sales with BizTrackBD
          </h2>
          <p style={{ color: "#FCE7F3", fontSize: 17, marginTop: 10 }}>
            14 days free &middot; Direct bKash &amp; Nagad settlement &middot; 0% commission
          </p>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/start?mode=ecommerce" className="btn btn-lg btn-primary" style={{ background: "#FFFFFF", color: "#BE185D" }} prefetch={false}>
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
