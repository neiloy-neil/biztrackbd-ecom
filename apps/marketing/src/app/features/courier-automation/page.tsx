import type { Metadata } from "next";
import Link from "next/link";
import { CourierDispatchSimulator } from "@/components/courier-dispatch-simulator";
import { demoAdminUrl } from "@/lib/demo-admin";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Automated Courier Booking: Steadfast, Pathao & RedX Integration",
  description:
    "Automate courier bookings across Steadfast, Pathao, and RedX with 1 click. Print thermal shipping labels, send automated Bangla tracking SMS, and reconcile COD delivery payouts.",
  keywords: [
    "steadfast courier integration bangladesh",
    "pathao courier api automated booking",
    "redx courier ecommerce integration",
    "thermal shipping label printer bangladesh",
    "কুরিয়ার অটোমেশন",
  ],
  alternates: {
    canonical: `${siteUrl}/features/courier-automation`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/features/courier-automation`,
    siteName: "BizTrackBD",
    title: "Automated Courier Booking: Steadfast, Pathao & RedX",
    description: "Book courier pickups straight from each order and print thermal barcode labels in 1 tap.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "Courier Automation" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Automated Courier Booking: Steadfast, Pathao & RedX",
    description: "Eliminate midnight manual data entry into courier portals.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const COURIER_FAQ: [string, string][] = [
  [
    "Do I need to sign a new contract with couriers to use BizTrackBD?",
    "No. You use your existing merchant accounts with Steadfast, Pathao, or RedX. You simply copy your API key and Secret from your courier merchant dashboard into BizTrackBD once. Your courier balance and delivery rates stay 100% yours.",
  ],
  [
    "Can I print thermal shipping labels on standard 4×6 barcode printers?",
    "Yes. In 1 click, BizTrackBD generates standard thermal shipping labels formatted for Xprinter, Rongta, and standard thermal label machines, complete with consignment barcodes and customer addresses.",
  ],
  [
    "Does BizTrackBD choose which courier to ship with automatically?",
    "BizTrackBD is strictly provider-neutral. It shows you the delivery rate and expected speed for each provider (e.g. Steadfast vs Pathao), and lets you book with the courier of your choice in 1 click.",
  ],
  [
    "Do customers receive an automated tracking link?",
    "Yes. As soon as you click 'Book Pickup', BizTrackBD can dispatch an automated Bangla SMS to the customer containing their tracking code and live delivery status link.",
  ],
];

const schemaJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://biztrackbd.com" },
        { "@type": "ListItem", "position": 2, "name": "Features", "item": "https://biztrackbd.com/features" },
        { "@type": "ListItem", "position": 3, "name": "Courier Automation", "item": "https://biztrackbd.com/features/courier-automation" },
      ],
    },
    {
      "@type": "SoftwareApplication",
      name: "BizTrackBD Courier Automation Desk",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      offers: {
        "@type": "Offer",
        price: "799",
        priceCurrency: "BDT",
      },
    },
    {
      "@type": "FAQPage",
      "mainEntity": COURIER_FAQ.map(([q, a]) => ({
        "@type": "Question",
        "name": q,
        "acceptedAnswer": { "@type": "Answer", "text": a },
      })),
    },
  ],
};

export default function CourierAutomationPage() {
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
              color: "#11795A",
              background: "#E3F1EA",
              borderColor: "#8FD3B8",
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
            Provider-Neutral Courier Automation
          </span>
          <h1 style={{ color: "var(--ink-ledger)", fontSize: "clamp(34px, 5.5vw, 54px)", lineHeight: 1.12, letterSpacing: "-1.5px" }}>
            Book Steadfast, Pathao &amp; RedX <br className="hidden-mobile" />
            <span style={{ color: "#11795A" }}>straight from each order in 1 click.</span>
          </h1>
          <p className="lead" style={{ maxWidth: 740, margin: "18px auto 0", color: "var(--ink-2)", fontSize: "clamp(16px, 2vw, 19px)", lineHeight: 1.6 }}>
            Stop copying customer names, phone numbers, and addresses into separate courier tabs at midnight. Connect your courier merchant keys once, print standard thermal labels, and send automated tracking SMS.
          </p>

          <div className="cta" style={{ marginTop: 28, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/start?mode=ecommerce"
              className="btn btn-primary btn-lg"
              style={{ background: "#11795A", borderColor: "#0B4D3B" }}
              prefetch={false}
            >
              Start 14-day free trial
            </Link>
            <a
              href={demoAdminUrl("gadgetstudio")}
              className="btn btn-secondary btn-lg"
              style={{ background: "#FFFFFF", color: "var(--ink-ledger)", border: "1.5px solid var(--line-strong)" }}
            >
              Test 1-Click Booking in Demo Admin ↗
            </a>
          </div>

          <p className="fine" style={{ marginTop: 14, fontSize: 13.5, color: "var(--ink-3)" }}>
            Encrypted API keys &middot; Provider-neutral rates &middot; 0% commission on deliveries
          </p>
        </div>
      </section>

      {/* Interactive Simulator */}
      <section className="block" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 36px" }}>
            <span className="status-stamp stamp-courier" style={{ marginBottom: 12 }}>
              THE DISPATCH ENGINE
            </span>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px", color: "var(--ink-ledger)" }}>
              One unified desk for all your courier dispatches
            </h2>
            <p style={{ margin: "12px auto 0", fontSize: 16, color: "var(--ink-2)" }}>
              Compare rates and booking speeds between Steadfast and Pathao, and inspect the resulting thermal barcode label.
            </p>
          </div>

          <CourierDispatchSimulator />

          {/* Authentic Admin Workspace Proof */}
          <div className="admin-mockup-stage">
            <div className="admin-mockup-topbar">
              <div className="admin-mockup-dots">
                <span className="admin-mockup-dot admin-mockup-dot-red" />
                <span className="admin-mockup-dot admin-mockup-dot-yellow" />
                <span className="admin-mockup-dot admin-mockup-dot-green" />
              </div>
              <div className="admin-mockup-url">admin.biztrackbd.com/orders/courier-dispatch</div>
              <div className="admin-mockup-live">
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#11795A", display: "inline-block" }} />
                LIVE WORKSPACE DESK
              </div>
            </div>

            <div className="admin-mockup-inner">
              <div className="admin-desk-toolbar">
                <div className="admin-desk-pill-tabs">
                  <span className="admin-desk-tab is-active">All Dispatches (48)</span>
                  <span className="admin-desk-tab">Ready for Pickup (12)</span>
                  <span className="admin-desk-tab">In Transit (29)</span>
                  <span className="admin-desk-tab">Delivered (7)</span>
                </div>
                <div className="admin-desk-actions">
                  <button type="button" className="admin-action-btn-primary">
                    <span>⚡</span> 1-Click Bulk Dispatch
                  </button>
                  <button type="button" className="admin-action-btn-ghost">
                    <span>🖨️</span> Print 4×6 Thermal Labels
                  </button>
                </div>
              </div>

              <div className="admin-desk-table-wrap">
                <table className="admin-desk-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Recipient &amp; Destination</th>
                      <th>Carrier &amp; Rate</th>
                      <th>Consignment ID</th>
                      <th>Delivery Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 700, color: "#8FD3B8" }}>#BD-1092</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>Fahim Chowdhury</div>
                        <div style={{ fontSize: 11, color: "#8FD3B8" }}>Mirpur-10, Dhaka · 01711-***420</div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: "#8FD3B8" }}>Steadfast ৳60</span>
                        <div style={{ fontSize: 10, color: "#8FD3B8" }}>COD: ৳2,450</div>
                      </td>
                      <td style={{ fontFamily: "var(--font-mono, monospace)", color: "#C3D4CB" }}>ST-902184</td>
                      <td>
                        <span className="admin-badge-safe">Ready for Pickup</span>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: "#8FD3B8", fontWeight: 600 }}>Print Thermal Label ↗</span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "#8FD3B8" }}>#BD-1093</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>Nusrat Jahan</div>
                        <div style={{ fontSize: 11, color: "#8FD3B8" }}>Chawkbazar, Chattogram · 01823-***551</div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: "#8FD3B8" }}>Steadfast ৳110</span>
                        <div style={{ fontSize: 10, color: "#8FD3B8" }}>COD: ৳3,800</div>
                      </td>
                      <td style={{ fontFamily: "var(--font-mono, monospace)", color: "#C3D4CB" }}>ST-902185</td>
                      <td>
                        <span className="admin-badge-safe">Label Printed</span>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: "#8FD3B8", fontWeight: 600 }}>Track Courier ↗</span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700, color: "#8FD3B8" }}>#BD-1094</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>Tanvir Ahmed</div>
                        <div style={{ fontSize: 11, color: "#8FD3B8" }}>Sylhet Sadar · 01912-***892</div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: "#F2A900" }}>Pathao 24h ৳120</span>
                        <div style={{ fontSize: 10, color: "#8FD3B8" }}>COD: ৳1,650</div>
                      </td>
                      <td style={{ fontFamily: "var(--font-mono, monospace)", color: "#C3D4CB" }}>PTH-491028</td>
                      <td>
                        <span className="admin-badge-warn">In Transit</span>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, color: "#8FD3B8", fontWeight: 600 }}>Send SMS Update ↗</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Feature Pillars */}
      <section className="block soft" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 36px" }}>
            <span className="eyebrow">Operational Advantages</span>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px", color: "var(--ink-ledger)" }}>
              Built for high-volume Bangladesh fulfillment
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>⚡</div>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ink-ledger)" }}>Bulk Label Printing</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Select 50 orders at once, click print, and generate a continuous PDF of standard 4×6 inch thermal shipping labels.
              </p>
            </div>

            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>📱</div>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ink-ledger)" }}>Automated Bangla SMS</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Keep buyers informed with automatic SMS alerts when the parcel is booked, out for delivery, or ready for pickup.
              </p>
            </div>

            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>🔒</div>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ink-ledger)" }}>AES-256 Key Encryption</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Your courier API keys and secrets are encrypted at rest with military-grade AES-256 and never accessible to staff.
              </p>
            </div>

            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>📊</div>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ink-ledger)" }}>Courier Settlement Audit</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Automatically verify that the COD money deposited into your bank account matches the courier delivery invoices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="block">
        <div className="wrap">
          <h2 style={{ textAlign: "center", margin: "0 auto 32px", fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px" }}>
            Frequently asked questions about Courier Automation
          </h2>
          <dl className="faq-list">
            {COURIER_FAQ.map(([q, a]) => (
              <div key={q}>
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="cta-band">
        <div className="wrap">
          <h2 style={{ color: "#FFFFFF", fontSize: "clamp(28px, 4.5vw, 42px)", letterSpacing: "-1.2px" }}>
            Automate your next courier dispatch with BizTrackBD
          </h2>
          <p style={{ color: "var(--green-light)", fontSize: 17, marginTop: 10 }}>
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
              Open Live Demo Desk ↗
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
