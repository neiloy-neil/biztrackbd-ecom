import type { Metadata } from "next";
import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";

export const metadata: Metadata = {
  title: "BizTrackBD vs Shopify: Why Bangladeshi Sellers Switch",
  description: "An honest comparison of BizTrackBD vs Shopify in Bangladesh. No dollar credit cards needed, 0% sales commission, native bKash/Nagad checkout, and built-in Pathao/Steadfast pickups at 1/10th the cost.",
};

const COMPARISON = [
  {
    feature: "Monthly Base Price",
    shopify: "$39 USD / month (≈ ৳ 4,800 - ৳ 5,200)",
    biztrack: "৳ 699 / month (Flat in BDT)",
    winner: "biztrack",
  },
  {
    feature: "Payment Method for Subscription",
    shopify: "Requires International Credit Card with Passport Endorsement",
    biztrack: "Pay with personal or merchant bKash or Nagad wallet",
    winner: "biztrack",
  },
  {
    feature: "Sales Commission / Transaction Cuts",
    shopify: "0.5% to 2.0% on every order (Shopify Payments unavailable in BD)",
    biztrack: "0% commission — you keep 100% of your earnings",
    winner: "biztrack",
  },
  {
    feature: "Native bKash & Nagad Checkout",
    shopify: "Requires expensive 3rd-party apps or custom code",
    biztrack: "Built-in checkout with customer TrxID & 1-tap verify desk",
    winner: "biztrack",
  },
  {
    feature: "Pathao, Steadfast & RedX Courier Booking",
    shopify: "Manual copy-pasting into courier portals or custom webhook bridges",
    biztrack: "1-click native booking, bulk pickup requests, & shipping label printing",
    winner: "biztrack",
  },
  {
    feature: "Bangladesh Address Fields",
    shopify: "Generic Western fields (customers confuse Zip codes, leading to lost parcels)",
    biztrack: "Native Division → District → Upazila cascading dropdowns",
    winner: "biztrack",
  },
  {
    feature: "COD Return Fraud Checker",
    shopify: "No delivery track record check for Bangladeshi phone numbers",
    biztrack: "Built-in delivery track record check across Pathao & Steadfast networks",
    winner: "biztrack",
  },
  {
    feature: "Bangla SMS Notifications",
    shopify: "Requires USD-billed Twilio account and manual webhook wiring",
    biztrack: "Built-in Bangla SMS for order confirmation and parcel dispatch",
    winner: "biztrack",
  },
  {
    feature: "Mobile Storefront Speed on 4G",
    shopify: "Slows down to 3–6s as third-party apps inject scripts",
    biztrack: "Sub-second load times (<0.8s) on mobile networks across Bangladesh",
    winner: "biztrack",
  },
  {
    feature: "Custom Domain Support (yourbrand.com)",
    shopify: "Supported",
    biztrack: "Supported with automatic zero-config SSL",
    winner: "tie",
  },
];

const FAQS = [
  {
    q: "Why do so many Bangladeshi merchants struggle with Shopify?",
    a: "Shopify is built for Western markets where shoppers pay with credit cards and parcels ship via FedEx or DHL. In Bangladesh, over 90% of eCommerce orders rely on Cash on Delivery, bKash, and local couriers like Pathao and Steadfast. Shopify charges in USD, demands a passport-endorsed credit card, lacks native local address hierarchies, and takes a percentage cut of your sales.",
  },
  {
    q: "How much money do I actually save by switching to BizTrackBD?",
    a: "A typical store on Shopify spends approximately $39/month on base fees, $20–$40/month on extra plugins (SMS, COD forms, courier bridges), and up to 2% on transaction fees. That totals roughly ৳ 8,000 to ৳ 12,000 every single month. On BizTrackBD, everything is built-in for ৳ 699/month, saving you over ৳ 80,000 a year in software costs alone.",
  },
  {
    q: "Can I move my existing products from Shopify to BizTrackBD?",
    a: "Yes! You can export your product CSV file from Shopify and import your catalog directly into your BizTrackBD store in a few clicks. Your product titles, descriptions, prices, and images carry over smoothly.",
  },
  {
    q: "Can I use my own custom .com or .com.bd domain?",
    a: "Absolutely. All paid plans on BizTrackBD support custom domains (like yourbrand.com or yourbrand.com.bd) with automatic SSL certificate provisioning and zero complex server configuration.",
  },
];

const compareFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
};

export default function ComparePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareFaqJsonLd) }}
      />
      <section className="hero hero-center">
        <div className="wrap">
          <span className="eyebrow">Platform Comparison · Honest Breakdown</span>
          <h1>Why Bangladeshi stores are choosing BizTrackBD over Shopify</h1>
          <p className="lead">
            Shopify costs over ৳ 5,000 a month, demands a passport-endorsed international credit card, and has no native support for Pathao, Steadfast, or bKash TrxID verification. BizTrackBD gives you a complete Bangladeshi store engine for ৳ 699 a month.
          </p>
          <div className="cta">
            <Link href="/start" className="btn btn-primary btn-lg" prefetch={false}>Switch to BizTrackBD for free</Link>
            <a href={demoAdminUrl()} className="btn btn-secondary btn-lg">Test the admin desk</a>
          </div>
          <p className="fine">14-day free trial · No credit card required · Free migration assistance</p>
        </div>
      </section>

      {/* Comparison Table Section */}
      <section className="block">
        <div className="wrap">
          <div className="table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th style={{ width: "34%" }}>Feature / Capability</th>
                  <th style={{ width: "33%" }}>Shopify</th>
                  <th className="highlight-col" style={{ width: "33%" }}>BizTrackBD</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature}>
                    <td>
                      <strong>{row.feature}</strong>
                    </td>
                    <td className="comp-foreign">{row.shopify}</td>
                    <td className="comp-biztrack">
                      <span>✓ {row.biztrack}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Real Math Card */}
      <section className="block soft">
        <div className="wrap">
          <div className="roi-card">
            <div className="roi-header">
              <span className="eyebrow">The Real Math</span>
              <h2>Compare the annual software bill</h2>
              <p>Based on a boutique store shipping 300 orders a month in Bangladesh</p>
            </div>
            <div className="roi-grid">
              <div className="roi-box foreign-box">
                <span className="roi-label">Shopify (Annual Cost)</span>
                <strong className="roi-amount">৳ 96,000+</strong>
                <ul className="roi-list">
                  <li>$39/mo base subscription (৳ 57,600)</li>
                  <li>Courier & SMS third-party apps (৳ 24,000)</li>
                  <li>Credit card foreign conversion markups (৳ 5,000)</li>
                  <li>Shopify transaction cuts on COD (৳ 10,000+)</li>
                </ul>
              </div>
              <div className="roi-box biztrack-box">
                <span className="roi-badge">91% Savings</span>
                <span className="roi-label">BizTrackBD (Annual Cost)</span>
                <strong className="roi-amount num">৳ 8,388</strong>
                <ul className="roi-list">
                  <li>All-in Pro annual plan: ৳ 699/month</li>
                  <li>Pathao, Steadfast, RedX native tools included</li>
                  <li>Zero commissions on your order revenue</li>
                  <li>No dollar card or foreign currency fees</li>
                </ul>
                <Link href="/start" className="btn btn-primary" style={{ marginTop: 20 }} prefetch={false}>
                  Save ৳ 87,000+ this year
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Migration FAQs */}
      <section className="block">
        <div className="wrap">
          <h2 style={{ textAlign: "center", margin: "0 auto" }}>Frequently asked comparison questions</h2>
          <dl className="faq-list">
            {FAQS.map((faq) => (
              <div key={faq.q}>
                <dt>{faq.q}</dt>
                <dd>{faq.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Final Callout */}
      <section className="cta-band">
        <div className="wrap">
          <h2>Start selling the way Bangladesh actually shops</h2>
          <p>Get your store ready today with bKash, Steadfast, and Pathao integration.</p>
          <Link href="/start" className="btn btn-lg btn-primary" prefetch={false}>Start free 14-day trial</Link>
        </div>
      </section>
    </>
  );
}
