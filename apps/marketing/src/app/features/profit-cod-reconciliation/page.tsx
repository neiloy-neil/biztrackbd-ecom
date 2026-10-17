import type { Metadata } from "next";
import Link from "next/link";
import { WaterfallProfitLedger } from "@/components/waterfall-profit-ledger";
import { demoAdminUrl } from "@/lib/demo-admin";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profit & COD Reconciliation: True Net Accounting in Taka",
  description:
    "Know your true net profit after product costs, courier fees, return losses, and Facebook ad spend. Automatically reconcile Steadfast and Pathao courier payouts.",
  keywords: [
    "cod reconciliation bangladesh",
    "ecommerce profit calculator bangladesh",
    "courier payout tracking",
    "steadfast settlement reconciliation",
    "প্রকৃত লাভ হিসাব",
  ],
  alternates: {
    canonical: `${siteUrl}/features/profit-cod-reconciliation`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/features/profit-cod-reconciliation`,
    siteName: "BizTrackBD",
    title: "Profit & COD Reconciliation: True Net Accounting",
    description: "Reconcile Steadfast and Pathao payouts against order COGS, ad spend, and return charges.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "Profit Ledger" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Profit & COD Reconciliation: True Net Accounting",
    description: "Know your true net profit in Bangladeshi Taka on every single order.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const PROFIT_FAQ: [string, string][] = [
  [
    "How does BizTrackBD calculate True Net Profit?",
    "For every order, BizTrackBD takes the Gross Sale Price and automatically subtracts Wholesale Product Cost, Outbound Courier Delivery Fee, Packaging Expense, Facebook Ad Spend (CPA), and Return Losses. What remains is your True Net Profit.",
  ],
  [
    "How does Courier Settlement Reconciliation work?",
    "When Steadfast, Pathao, or RedX deposits COD money into your bank account, you can import or match their settlement statement. BizTrackBD reconciles each delivered parcel to confirm that the courier deposited the exact amount owed, flagging any unpaid parcels.",
  ],
  [
    "Can I enter my product wholesale purchase costs in bulk?",
    "Yes. You can set the cost price for each product in your catalog or import them via CSV. The profit engine automatically applies the cost to every order.",
  ],
  [
    "Can I download financial statements for my accountant or tax filings?",
    "Yes. You can export complete monthly financial statements, itemized expense breakdowns, and courier settlement histories as clean CSV spreadsheets in 1 click.",
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
        { "@type": "ListItem", "position": 3, "name": "Profit & COD Reconciliation", "item": "https://biztrackbd.com/features/profit-cod-reconciliation" },
      ],
    },
    {
      "@type": "SoftwareApplication",
      name: "BizTrackBD Profit & COD Reconciliation Engine",
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
      "mainEntity": PROFIT_FAQ.map(([q, a]) => ({
        "@type": "Question",
        "name": q,
        "acceptedAnswer": { "@type": "Answer", "text": a },
      })),
    },
  ],
};

export default function ProfitCodReconciliationPage() {
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
              color: "#15803D",
              background: "#DCFCE7",
              borderColor: "#86EFAC",
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
            True Net Profit &middot; Ledger Accounting
          </span>
          <h1 style={{ color: "var(--ink-ledger)", fontSize: "clamp(34px, 5.5vw, 54px)", lineHeight: 1.12, letterSpacing: "-1.5px" }}>
            Topline sales mean nothing <br className="hidden-mobile" />
            <span style={{ color: "#15803D" }}>until you know your true net profit.</span>
          </h1>
          <p className="lead" style={{ maxWidth: 740, margin: "18px auto 0", color: "var(--ink-2)", fontSize: "clamp(16px, 2vw, 19px)", lineHeight: 1.6 }}>
            Automatically deduct product wholesale costs, courier delivery fees, fake COD return losses, and Facebook ad spend from every order. Track exactly how much money couriers owe you down to the last Taka.
          </p>

          <div className="cta" style={{ marginTop: 28, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/start?mode=ecommerce"
              className="btn btn-primary btn-lg"
              style={{ background: "#15803D", borderColor: "#166534" }}
              prefetch={false}
            >
              Start 14-day free trial
            </Link>
            <a
              href={demoAdminUrl("gadgetstudio")}
              className="btn btn-secondary btn-lg"
              style={{ background: "#FFFFFF", color: "var(--ink-ledger)", border: "1.5px solid var(--line-strong)" }}
            >
              Inspect Profit Ledger in Demo Admin ↗
            </a>
          </div>

          <p className="fine" style={{ marginTop: 14, fontSize: 13.5, color: "var(--ink-3)" }}>
            Ledger-accurate formulas &middot; Automatic courier payout matching &middot; CSV exports included
          </p>
        </div>
      </section>

      {/* Interactive Simulator */}
      <section className="block" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 36px" }}>
            <span className="status-stamp stamp-paid" style={{ marginBottom: 12 }}>
              THE RECONCILIATION ENGINE
            </span>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px", color: "var(--ink-ledger)" }}>
              Itemized waterfall ledger &middot; Zero financial guesswork
            </h2>
            <p style={{ margin: "12px auto 0", fontSize: 16, color: "var(--ink-2)" }}>
              Adjust product costs, courier fees, and ad spend to see how true net profit is calculated in real time.
            </p>
          </div>

          <WaterfallProfitLedger />

          {/* Authentic Admin Reconciliation Desk Proof */}
          <div className="admin-mockup-stage">
            <div className="admin-mockup-topbar">
              <div className="admin-mockup-dots">
                <span className="admin-mockup-dot admin-mockup-dot-red" />
                <span className="admin-mockup-dot admin-mockup-dot-yellow" />
                <span className="admin-mockup-dot admin-mockup-dot-green" />
              </div>
              <div className="admin-mockup-url">admin.biztrackbd.com/finances/courier-reconciliation</div>
              <div className="admin-mockup-live">
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
                AUTOMATED SETTLEMENT DESK
              </div>
            </div>

            <div className="admin-mockup-inner">
              <div className="admin-desk-toolbar">
                <div className="admin-desk-pill-tabs">
                  <span className="admin-desk-tab is-active">Batch #ST-2026-10-16 (Steadfast)</span>
                  <span className="admin-desk-tab">Disbursed: ৳ 84,200</span>
                  <span className="admin-desk-tab" style={{ color: "#34D399" }}>Matched: 100%</span>
                </div>
                <div className="admin-desk-actions">
                  <button type="button" className="admin-action-btn-primary">
                    <span>📑</span> Export Financial Voucher CSV
                  </button>
                </div>
              </div>

              <div className="admin-desk-table-wrap">
                <table className="admin-desk-table">
                  <thead>
                    <tr>
                      <th>Consignment / Order</th>
                      <th>Gross COD</th>
                      <th>Courier Delivery Fee</th>
                      <th>Wholesale COGS</th>
                      <th>True Net Margin</th>
                      <th>Settlement Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div style={{ fontWeight: 600, color: "#60A5FA" }}>ST-902180</div>
                        <div style={{ fontSize: 11, color: "#94A3B8" }}>Order #BD-1088 · Dhaka City</div>
                      </td>
                      <td style={{ fontWeight: 700, color: "#F8FAFC" }}>৳ 2,400</td>
                      <td style={{ color: "#F87171" }}>- ৳ 60</td>
                      <td style={{ color: "#F87171" }}>- ৳ 1,150</td>
                      <td>
                        <span style={{ fontWeight: 800, color: "#34D399" }}>+ ৳ 1,190</span>
                        <div style={{ fontSize: 10, color: "#34D399" }}>49.6% Net Profit</div>
                      </td>
                      <td>
                        <span className="admin-badge-safe">Deposited to Bank</span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div style={{ fontWeight: 600, color: "#60A5FA" }}>ST-902181</div>
                        <div style={{ fontSize: 11, color: "#94A3B8" }}>Order #BD-1089 · Rajshahi Sadar</div>
                      </td>
                      <td style={{ fontWeight: 700, color: "#F8FAFC" }}>৳ 3,650</td>
                      <td style={{ color: "#F87171" }}>- ৳ 110</td>
                      <td style={{ color: "#F87171" }}>- ৳ 1,800</td>
                      <td>
                        <span style={{ fontWeight: 800, color: "#34D399" }}>+ ৳ 1,740</span>
                        <div style={{ fontSize: 10, color: "#34D399" }}>47.7% Net Profit</div>
                      </td>
                      <td>
                        <span className="admin-badge-safe">Deposited to Bank</span>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div style={{ fontWeight: 600, color: "#60A5FA" }}>ST-902182</div>
                        <div style={{ fontSize: 11, color: "#94A3B8" }}>Order #BD-1090 · Bogura (Returned)</div>
                      </td>
                      <td style={{ fontWeight: 700, color: "#94A3B8" }}>৳ 0 (Returned)</td>
                      <td style={{ color: "#F87171", fontWeight: 700 }}>- ৳ 110 (Loss)</td>
                      <td style={{ color: "#94A3B8" }}>৳ 0 (Stock Back)</td>
                      <td>
                        <span style={{ fontWeight: 800, color: "#F87171" }}>- ৳ 110</span>
                        <div style={{ fontSize: 10, color: "#F87171" }}>Return Courier Penalty</div>
                      </td>
                      <td>
                        <span className="admin-badge-danger">Reconciled Loss</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Pillars */}
      <section className="block soft" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 36px" }}>
            <span className="eyebrow">Financial Soundness</span>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px", color: "var(--ink-ledger)" }}>
              Stop guessing if your Facebook ads are profitable
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>📉</div>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ink-ledger)" }}>Return Loss Isolation</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                See exactly how many thousands of Taka in courier return penalties are eroding your daily marketing margins.
              </p>
            </div>

            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>🏦</div>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ink-ledger)" }}>Courier Payout Audit</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Identify unpaid or missing parcels across Steadfast and Pathao before monthly bank statement cutoffs.
              </p>
            </div>

            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>🎯</div>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ink-ledger)" }}>Per-Product Net Margins</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Know which products genuinely generate cash profit versus items that just create packing work.
              </p>
            </div>

            <div className="card ledger-border" style={{ padding: "24px 22px", background: "#FFFFFF" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>📑</div>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ink-ledger)" }}>1-Click Accountant Export</h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                Download clean, formatted Excel or CSV ledgers ready for tax audits and business partnership accounting.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="block">
        <div className="wrap">
          <h2 style={{ textAlign: "center", margin: "0 auto 32px", fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px" }}>
            Frequently asked questions about Profit Reconciliation
          </h2>
          <dl className="faq-list">
            {PROFIT_FAQ.map(([q, a]) => (
              <div key={q}>
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="cta-band" style={{ background: "#166534" }}>
        <div className="wrap">
          <h2 style={{ color: "#FFFFFF", fontSize: "clamp(28px, 4.5vw, 42px)", letterSpacing: "-1.2px" }}>
            Take control of your true business profit today
          </h2>
          <p style={{ color: "#DCFCE7", fontSize: 17, marginTop: 10 }}>
            14 days free &middot; Complete financial ledger &middot; Zero sales commission
          </p>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/start?mode=ecommerce" className="btn btn-lg btn-primary" style={{ background: "#FFFFFF", color: "#166534" }} prefetch={false}>
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
