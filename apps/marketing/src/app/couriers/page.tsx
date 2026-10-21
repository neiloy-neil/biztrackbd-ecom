import type { Metadata } from "next";
import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: "Courier Automation: Steadfast, Pathao & RedX Integration Guide",
  description:
    "Automate Steadfast, Pathao, and RedX pickups straight from each order. Check customer COD return rates, print thermal barcode labels, and track parcels across all 64 districts.",
  keywords: [
    "steadfast courier api bangladesh",
    "pathao courier integration",
    "redx courier automation",
    "cash on delivery return protection",
    "thermal shipping label bangladesh",
    "ecommerce courier booking bangladesh",
  ],
  alternates: {
    canonical: `${siteUrl}/couriers`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/couriers`,
    siteName: "BizTrackBD",
    title: "Courier Automation: Steadfast, Pathao & RedX Integration",
    description: "Compare courier rates, automate 1-click booking, print barcode labels, and protect against COD returns.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "Courier Automation Guide" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Courier Automation: Steadfast, Pathao & RedX Integration",
    description: "Multi-courier dispatch and rate comparison for Bangladesh online merchants.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const COURIER_COMPARISON = [
  {
    feature: "Dhaka Metro Delivery Rate (up to 1kg)",
    steadfast: "৳ 60 – ৳ 70",
    pathao: "৳ 60 – ৳ 70",
    redx: "৳ 60 – ৳ 70",
  },
  {
    feature: "Outside Dhaka / Thana Rate (up to 1kg)",
    steadfast: "৳ 110 – ৳ 130",
    pathao: "৳ 120 – ৳ 140",
    redx: "৳ 120 – ৳ 130",
  },
  {
    feature: "Cash-on-Delivery (COD) Commission",
    steadfast: "0.5% – 1%",
    pathao: "1%",
    redx: "1%",
  },
  {
    feature: "Disbursement & Payout Schedule",
    steadfast: "Daily / Next day via bKash or Bank",
    pathao: "2 times weekly via bKash or Bank",
    redx: "Weekly bank transfer",
  },
  {
    feature: "Coverage Across Bangladesh",
    steadfast: "All 64 districts & sub-district thanas",
    pathao: "All 64 districts & rural hubs",
    redx: "All 64 districts nationwide",
  },
  {
    feature: "BizTrackBD 1-Click Pickup Booking",
    steadfast: "✓ Native 1-click booking",
    pathao: "✓ Native 1-click booking",
    redx: "✓ Native 1-click booking",
  },
  {
    feature: "Live Tracking Webhooks",
    steadfast: "✓ Automatic status sync",
    pathao: "✓ Automatic status sync",
    redx: "✓ Automatic status sync",
  },
  {
    feature: "Thermal Barcode Shipping Labels (4×6)",
    steadfast: "✓ 1-click PDF download",
    pathao: "✓ 1-click PDF download",
    redx: "✓ 1-click PDF download",
  },
];

const couriersJsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "Automating Steadfast, Pathao & RedX Courier Pickups in Bangladesh",
  description:
    "Complete merchant guide for connecting courier API credentials and preventing Cash on Delivery return parcel fraud in Bangladeshi eCommerce stores.",
  articleSection: "Logistics Automation",
  author: {
    "@type": "Organization",
    name: "BizTrackBD",
    url: "https://biztrack.bd",
  },
};

export default function CouriersPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(couriersJsonLd) }}
      />

      {/* Hero Section */}
      <section className="hero hero-center">
        <div className="wrap">
          <span className="eyebrow">Local Logistics Automation</span>
          <h1>Automate Steadfast, Pathao &amp; RedX pickups straight from your orders</h1>
          <p className="lead">
            No more copying customer phone numbers, street names, and parcel values into courier portals one by one. Connect your courier API keys once, screen serial parcel rejecters before dispatching, and book pickups with a single tap.
          </p>
          <div className="cta">
            <Link href="/start" className="btn btn-primary btn-lg" prefetch={false}>
              Start free 14-day trial
            </Link>
            <a href={demoAdminUrl()} className="btn btn-secondary btn-lg">
              Test courier booking in demo admin
            </a>
          </div>
          <p className="fine">
            Encrypted API keys · 0% commission on shipping · All 64 districts supported
          </p>
        </div>
      </section>

      {/* How It Works Workflow */}
      <section className="block">
        <div className="wrap">
          <span className="eyebrow">Zero-Friction Workflow</span>
          <h2>How automated courier dispatch works in BizTrackBD</h2>
          <ol className="steps3">
            <li>
              <span>01</span>
              <h3>Order Placed &amp; Fraud Screened</h3>
              <p>
                When a customer orders via Cash on Delivery, BizTrackBD automatically checks their phone number across delivery histories to verify their parcel acceptance rate.
              </p>
            </li>
            <li>
              <span>02</span>
              <h3>1-Click Booking &amp; Consignment ID</h3>
              <p>
                Confirm the order in your admin desk and click &quot;Book Pickup&quot;. BizTrackBD sends the parcel details via API to your courier account and retrieves a consignment tracking number instantly.
              </p>
            </li>
            <li>
              <span>03</span>
              <h3>Thermal Label &amp; Bangla SMS</h3>
              <p>
                Print standard 4×6 inch thermal shipping labels in 1 click and automatically send your customer a Bangla SMS with their live delivery tracking link.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* Courier Comparison Matrix */}
      <section className="block soft">
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 36px" }}>
            <span className="eyebrow">Comparison Matrix</span>
            <h2>Steadfast vs. Pathao vs. RedX: Overview for Merchants</h2>
            <p className="sub">
              BizTrackBD works with all three major Bangladeshi couriers. You connect your own merchant accounts, so you keep your own discounted rates and deal directly with your account managers.
            </p>
          </div>

          <div className="table-wrap">
            <table className="compare">
              <thead>
                <tr>
                  <th scope="col" style={{ width: "36%" }}>Feature / Rate</th>
                  <th scope="col">Steadfast Courier</th>
                  <th scope="col" className="best">Pathao Courier</th>
                  <th scope="col">RedX Delivery</th>
                </tr>
              </thead>
              <tbody>
                {COURIER_COMPARISON.map((row) => (
                  <tr key={row.feature}>
                    <th scope="row">{row.feature}</th>
                    <td>{row.steadfast}</td>
                    <td className="best">{row.pathao}</td>
                    <td>{row.redx}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* COD Return Fraud Shield Deep-Dive */}
      <section className="block">
        <div className="wrap">
          <div className="bd-panel">
            <div>
              <span className="eyebrow">COD Return Fraud Shield</span>
              <h2>Stop losing ৳ 120–240 on fake or rejected orders</h2>
              <p className="sub">
                In Bangladesh, uncollected Cash on Delivery parcels are the #1 hidden cost destroying eCommerce profits. Every returned parcel costs you two-way courier fees and ties up your inventory for 7 to 10 days.
              </p>
              <div style={{ marginTop: 24 }}>
                <Link href="/start" className="btn btn-primary" prefetch={false}>
                  Protect your store with BizTrackBD →
                </Link>
              </div>
            </div>

            <dl className="bd-list">
              <div>
                <dt style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="status-stamp stamp-paid" style={{ fontSize: 10 }}>API LIVE</span>
                  <span>Cross-Courier Delivery Scoring</span>
                </dt>
                <dd>
                  BizTrackBD verifies the recipient phone number against courier delivery logs. You immediately see whether a shopper accepts 98% of parcels or has a track record of serial rejections.
                </dd>
              </div>
              <div>
                <dt style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="status-stamp stamp-review" style={{ fontSize: 10 }}>FEE ALERT</span>
                  <span>Automated Advance Courier Fee Alerts</span>
                </dt>
                <dd>
                  When a risky order arrives, our admin desk displays an amber warning recommending you collect a ৳ 120 advance courier fee via bKash before packing the box.
                </dd>
              </div>
              <div>
                <dt style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="status-stamp stamp-paid" style={{ fontSize: 10 }}>GEO CADASTRE</span>
                  <span>District &amp; Thana Cascade Validation</span>
                </dt>
                <dd>
                  Customers select their Division, District, and Upazila from verified dropdowns matching courier hub databases, eliminating misspelled delivery addresses.
                </dd>
              </div>
              <div>
                <dt style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="status-stamp stamp-paid" style={{ fontSize: 10 }}>SMS QUEUE</span>
                  <span>Automated Dispatch Alerts</span>
                </dt>
                <dd>
                  Customers receive automatic SMS reminders when their parcel is handed over to the courier rider, significantly increasing final collection rates.
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Step-by-Step API Setup Guides */}
      <section className="block soft" id="setup">
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 40px" }}>
            <span className="eyebrow">Direct Courier Protocols</span>
            <h2>Connecting your courier merchant API keys</h2>
            <p className="sub">
              Takes less than 3 minutes. Your API keys are encrypted with AES-256 and only used to request parcel pickups on your behalf.
            </p>
          </div>

          <div className="grid g3" style={{ gap: 24 }}>
            {/* Steadfast Guide */}
            <div
              className="card"
              id="steadfast"
              style={{
                padding: "28px 24px",
                background: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid var(--line)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Steadfast Courier</h3>
                <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#FBF7EC", color: "#3D5A52" }}>
                  STEADFAST_V1
                </span>
              </div>
              <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Popular for fast outside-Dhaka deliveries and daily bKash remittances.
              </p>
              <ol style={{ paddingLeft: 20, margin: "16px 0", fontSize: 13.5, color: "var(--ink)", display: "grid", gap: 8 }}>
                <li>Log in to your Steadfast Merchant portal (<strong>steadfast.com.bd</strong>).</li>
                <li>Go to <strong>Settings → API Credentials</strong>.</li>
                <li>Copy your <strong>API Key</strong> and <strong>Secret Key</strong>.</li>
                <li>Paste them into BizTrackBD Admin → <strong>Couriers → Steadfast</strong>.</li>
              </ol>
              <div style={{ marginTop: "auto", paddingTop: 12 }}>
                <span className="pill live">1-Click Dispatch Ready</span>
              </div>
            </div>

            {/* Pathao Guide */}
            <div
              className="card"
              id="pathao"
              style={{
                padding: "28px 24px",
                background: "#FFFFFF",
                borderRadius: 16,
                border: "2px solid var(--brand)",
                boxShadow: "0 8px 24px rgba(17, 121, 90, 0.1)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Pathao Courier</h3>
                <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#E3F1EA", color: "#11795A" }}>
                  PATHAO_OAUTH2
                </span>
              </div>
              <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Preferred for high-speed inside-Dhaka deliveries and nationwide coverage.
              </p>
              <ol style={{ paddingLeft: 20, margin: "16px 0", fontSize: 13.5, color: "var(--ink)", display: "grid", gap: 8 }}>
                <li>Log in to Pathao Merchant panel (<strong>merchant.pathao.com</strong>).</li>
                <li>Open <strong>Developer API / Store Access</strong>.</li>
                <li>Generate your <strong>Client ID</strong> &amp; <strong>Client Secret</strong>.</li>
                <li>Select your default store pickup location (e.g. Mirpur Hub).</li>
              </ol>
              <div style={{ marginTop: "auto", paddingTop: 12 }}>
                <span className="pill live">Full Webhook Tracking</span>
              </div>
            </div>

            {/* RedX Guide */}
            <div
              className="card"
              id="redx"
              style={{
                padding: "28px 24px",
                background: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid var(--line)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>RedX Delivery</h3>
                <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#FBF7EC", color: "#3D5A52" }}>
                  REDX_BEARER
                </span>
              </div>
              <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Ideal for high-volume enterprise stores and nationwide parcel fulfillment.
              </p>
              <ol style={{ paddingLeft: 20, margin: "16px 0", fontSize: 13.5, color: "var(--ink)", display: "grid", gap: 8 }}>
                <li>Log in to your RedX Merchant account (<strong>redx.com.bd</strong>).</li>
                <li>Navigate to <strong>Settings → Developer Token</strong>.</li>
                <li>Generate your <strong>Production Bearer Token</strong>.</li>
                <li>Paste into BizTrackBD Admin → <strong>Couriers → RedX</strong>.</li>
              </ol>
              <div style={{ marginTop: "auto", paddingTop: 12 }}>
                <span className="pill live">Bulk Label Printing</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Thermal Labels Showcase */}
      <section className="block">
        <div className="wrap">
          <div className="demo-band" style={{ background: "#FFFFFF", border: "1px solid var(--line)" }}>
            <div>
              <span className="eyebrow">Packaging &amp; Dispatch</span>
              <h2>Print standard 4×6 inch thermal labels in seconds</h2>
              <p>
                No more hand-writing addresses with markers. When you book a courier pickup, BizTrackBD generates a standard shipping sticker containing the courier barcode, consignment number, order items, customer address, and COD cash collection amount.
              </p>
            </div>
            <Link href="/start" className="btn btn-primary btn-lg" prefetch={false}>
              Test thermal printing free
            </Link>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="cta-band">
        <div className="wrap">
          <h2>Ship faster with zero courier copy-pasting</h2>
          <p>14 days free trial · No card needed · Connect your courier in 3 minutes</p>
          <Link href="/start" className="btn btn-primary btn-lg" prefetch={false}>
            Start 14-day free trial
          </Link>
        </div>
      </section>
    </>
  );
}
