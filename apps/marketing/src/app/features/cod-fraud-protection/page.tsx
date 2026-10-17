import type { Metadata } from "next";
import Link from "next/link";
import { CodCalculatorSimulator } from "@/components/cod-calculator-simulator";
import { demoAdminUrl } from "@/lib/demo-admin";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cash on Delivery (COD) Return Fraud Protection & Risk Shield",
  description:
    "Protect your online business against fake and rejected COD orders. Automatically check customer delivery performance histories across Steadfast and Pathao before shipping.",
  keywords: [
    "cod fraud protection bangladesh",
    "courier return check",
    "cash on delivery return protection",
    "steadfast courier fraud check",
    "pathao delivery rate",
    "পার্সেল রিটার্ন রোধ",
  ],
  alternates: {
    canonical: `${siteUrl}/features/cod-fraud-protection`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/features/cod-fraud-protection`,
    siteName: "BizTrackBD",
    title: "COD Return Fraud Protection & Risk Shield",
    description: "Screen repeat parcel rejectors across Steadfast and Pathao before shipping.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "COD Return Protection" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "COD Return Fraud Protection & Risk Shield",
    description: "Avoid wasted delivery fees with cross-courier phone delivery records.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const COD_FAQ: [string, string][] = [
  [
    "How does the COD return protection know if a customer has returned parcels?",
    "When an order is placed, BizTrackBD queries courier delivery logs across Steadfast and Pathao associated with that phone number. It calculates the delivery success ratio (for example, 24 of 25 delivered vs 2 of 9 delivered) to give you an objective historical signal.",
  ],
  [
    "Does BizTrackBD ever block or cancel an order automatically?",
    "No. BizTrackBD never automatically cancels customer orders. It provides an operational risk badge (Safe, Review, or High Return Risk) so you can make an informed decision—such as calling the customer or requesting an advance courier fee.",
  ],
  [
    "Why shouldn't I just ship every order and hope for the best?",
    "In Bangladesh ecommerce, round-trip delivery fees for rejected parcels typically cost ৳ 130 to ৳ 150. If you ship 300 orders a month with a 15% return rate, you lose over ৳ 6,000 every month just in wasted courier fees, plus lost sales while inventory sits in courier vans.",
  ],
  [
    "How does requesting an advance delivery fee work?",
    "When an order is flagged with repeat returns, BizTrackBD allows you to send an automated Bangla SMS with a bKash payment link for just the courier fee (৳ 100–৳ 120). When the customer pays, it confirms their genuine buying intent before you dispatch the parcel.",
  ],
  [
    "Is checking courier delivery history legal and privacy-compliant?",
    "Yes. Courier delivery records assess operational fulfillment reliability without exposing private medical, financial, or personal messaging data. We strictly prohibit public blacklisting or defamatory language.",
  ],
];

const schemaJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "BizTrackBD COD Return Fraud Protection",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  offers: {
    "@type": "Offer",
    price: "699",
    priceCurrency: "BDT",
  },
  featureList: [
    "Cross-courier delivery success rate check across Pathao & Steadfast",
    "Automated risk scoring badges (Safe, Review, High Risk)",
    "Advance courier fee request SMS integration",
    "1-click dispatch for verified customers",
    "0% sales commission",
  ],
};

export default function CodFraudProtectionPage() {
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
              color: "#B91C1C",
              background: "#FEE2E2",
              borderColor: "#FCA5A5",
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
            Operational COD Protection
          </span>
          <h1 style={{ color: "var(--ink-ledger)", fontSize: "clamp(34px, 5.5vw, 54px)", lineHeight: 1.12, letterSpacing: "-1.5px" }}>
            Stop losing money on <br className="hidden-mobile" />
            <span style={{ color: "#B91C1C" }}>refused Cash on Delivery parcels.</span>
          </h1>
          <p className="lead" style={{ maxWidth: 740, margin: "18px auto 0", color: "var(--ink-2)", fontSize: "clamp(16px, 2vw, 19px)", lineHeight: 1.6 }}>
            Check customer delivery performance records across Steadfast and Pathao before packing. Hold high-risk orders for advance delivery confirmation and protect your hard-earned profit.
          </p>

          <div className="cta" style={{ marginTop: 28, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/start?mode=ecommerce"
              className="btn btn-primary btn-lg"
              style={{ background: "var(--brand)", borderColor: "var(--brand-dark)" }}
              prefetch={false}
            >
              Start 14-day free trial
            </Link>
            <a
              href={demoAdminUrl("gadgetstudio")}
              className="btn btn-secondary btn-lg"
              style={{ background: "#FFFFFF", color: "var(--ink-ledger)", border: "1.5px solid var(--line-strong)" }}
            >
              Try COD Risk Check in Demo Admin ↗
            </a>
          </div>

          <p className="fine" style={{ marginTop: 14, fontSize: 13.5, color: "var(--ink-3)" }}>
            Included on all Commerce plans &middot; Encrypted courier keys &middot; 0% commission on sales
          </p>
        </div>
      </section>

      {/* The Real Cost of a Rejected Parcel */}
      <section className="block" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 36px" }}>
            <span className="status-stamp stamp-risk" style={{ marginBottom: 12 }}>
              THE COST ANATOMY
            </span>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px", color: "var(--ink-ledger)" }}>
              What happens when a customer refuses a COD parcel?
            </h2>
            <p style={{ margin: "12px auto 0", fontSize: 16, color: "var(--ink-2)" }}>
              A refused delivery doesn&apos;t just cost you the initial shipping fee. The compounding operational losses eat away at your marketing margin.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>💸</div>
              <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "var(--ink-ledger)" }}>৳ 130–৳ 150 Courier Penalty</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Couriers charge full outbound delivery plus 50% return shipping fees for returned parcels, even though you made zero revenue.
              </p>
            </div>

            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
              <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "var(--ink-ledger)" }}>10 to 14 Days Held Stock</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Your product sits trapped inside delivery vans and return hubs for nearly two weeks, preventing you from selling it to genuine buyers.
              </p>
            </div>

            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📉</div>
              <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "var(--ink-ledger)" }}>Wasted Facebook Ad Spend</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                You paid Meta ৳ 150 to ৳ 250 in ad costs to generate the purchase click, which is permanently lost when the buyer refuses the parcel.
              </p>
            </div>

            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🏷️</div>
              <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "var(--ink-ledger)" }}>Damaged Packaging</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Boxes, garment polybags, and security seals get scuffed and torn during return transit, requiring re-packaging at your own expense.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Calculator & Simulator */}
      <section className="block soft" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 36px" }}>
            <span className="eyebrow">Interactive Simulator</span>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px", color: "var(--ink-ledger)" }}>
              Test your parcel return risk &amp; recovery margin
            </h2>
            <p style={{ margin: "12px auto 0", fontSize: 16, color: "var(--ink-2)" }}>
              Adjust the sliders below to calculate your business&apos;s current courier loss and see how the risk shield evaluates real orders.
            </p>
          </div>

          <CodCalculatorSimulator />
        </div>
      </section>

      {/* Respectful, Privacy-Conscious Policy Box */}
      <section className="block" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div
            className="card ledger-border"
            style={{
              padding: "32px 28px",
              background: "#F8FAFC",
              border: "1.5px solid var(--line-strong)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span className="status-stamp stamp-paid">RESPONSIBLE DATA GOVERNANCE</span>
              <span style={{ fontSize: 13, color: "var(--ink-3)", fontWeight: 600 }}>Ethical &amp; Legal Compliance</span>
            </div>
            <h3 style={{ margin: 0, fontSize: 20, color: "var(--ink-ledger)" }}>
              Why BizTrackBD focuses on delivery performance, not defamation
            </h3>
            <p style={{ margin: "12px 0 0", fontSize: 14.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
              We never label a human being as a &ldquo;fraudster&rdquo; or publish public buyer blacklists. Customers occasionally return parcels due to valid delivery delays, emergencies, or incorrect courier routing. BizTrackBD strictly assesses statistical fulfillment reliability (successful delivery ratio) and recommends fair merchant actions: confirming by phone or requesting a standard ৳ 120 advance courier fee.
            </p>
            <div style={{ display: "flex", gap: 20, marginTop: 16, fontSize: 13, color: "var(--ink-3)", flexWrap: "wrap" }}>
              <span>✓ No public shaming lists</span>
              <span>✓ Objective courier logistics metrics</span>
              <span>✓ Encrypted tenant API credentials</span>
              <span>✓ Merchant retains 100% final approval power</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="block soft" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <h2 style={{ textAlign: "center", margin: "0 auto 32px", fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px" }}>
            Frequently asked questions about COD Protection
          </h2>
          <dl className="faq-list">
            {COD_FAQ.map(([q, a]) => (
              <div key={q}>
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="cta-band" style={{ background: "var(--ink-ledger)" }}>
        <div className="wrap">
          <h2 style={{ color: "#FFFFFF", fontSize: "clamp(28px, 4.5vw, 42px)", letterSpacing: "-1.2px" }}>
            Protect your next COD shipment with BizTrackBD
          </h2>
          <p style={{ color: "#94A3B8", fontSize: 17, marginTop: 10 }}>
            14 days free &middot; Works with Steadfast, Pathao &amp; RedX &middot; Zero sales commission
          </p>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/start?mode=ecommerce" className="btn btn-lg btn-primary" prefetch={false}>
              Start 14-day free trial
            </Link>
            <a
              href={demoAdminUrl("gadgetstudio")}
              className="btn btn-lg btn-secondary"
              style={{ background: "rgba(255,255,255,0.1)", color: "#FFFFFF", borderColor: "rgba(255,255,255,0.2)" }}
            >
              Test COD Check in Live Demo ↗
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
