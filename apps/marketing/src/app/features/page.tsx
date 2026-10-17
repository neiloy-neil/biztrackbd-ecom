import type { Metadata } from "next";
import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: "Features: Built for the realities of Bangladesh eCommerce",
  description: "Combat COD returns, automate Pathao and Steadfast pickups, accept bKash and Nagad with zero commission, and run your shop from your phone.",
  alternates: {
    canonical: `${siteUrl}/features`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/features`,
    siteName: "BizTrackBD",
    title: "Features: Built for Bangladesh eCommerce",
    description: "Combat COD returns, automate Pathao and Steadfast pickups, accept bKash and Nagad with zero commission.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "BizTrackBD features" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Features: Built for Bangladesh eCommerce",
    description: "Automate pickups, accept bKash/Nagad, and protect profits against fake returns.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const PILLARS = [
  {
    badge: "Protection",
    title: "Cash on Delivery Return Protection",
    link: "/features/cod-fraud-protection",
    problem: "1 in 4 COD parcels in Bangladesh gets rejected by customers who changed their mind or gave a fake number. Every returned parcel costs the seller ৳ 120–৳ 160 in delivery charges, wiping out daily profits.",
    solution: "BizTrackBD checks customer phone numbers against delivery logs across Pathao and Steadfast networks before you pack. Orders from serial parcel rejectors are flagged so you can require a partial bKash delivery advance (e.g. ৳ 150) before shipping.",
    points: [
      "Customer courier delivery track record checker (e.g., 98% success rate)",
      "Automatic high-risk warning on habitual returners and incomplete addresses",
      "Option to enforce mandatory partial bKash advance delivery fee on risky orders",
      "Incomplete order phone capture: follow up via 1-tap WhatsApp call list",
    ],
    proof: "Saves typical sellers thousands every month in avoided return courier bills.",
  },
  {
    badge: "Logistics",
    title: "1-Click Courier Pickup & Shipping Labels",
    link: "/features/courier-automation",
    problem: "Manually copying customer names, phone numbers, and addresses from Facebook chat or spreadsheets into Steadfast and Pathao portals at midnight is slow, tiring, and leads to courier delivery mistakes.",
    solution: "Enter your courier API credentials once. Click 'Book Pickup' directly from the order page. BizTrackBD creates the consignment, retrieves the tracking code, and generates standard thermal shipping labels and packing slips.",
    points: [
      "1-click native booking with Steadfast, Pathao, and RedX",
      "Bulk print thermal shipping labels and branded packing slips in 1 tap",
      "Automated tracking links sent straight to customers via Bangla SMS",
      "COD settlement reconciliation: clearly track how much money the courier owes you",
    ],
    proof: "Pack, book, and print labels for 50 orders in under 10 minutes.",
  },
  {
    badge: "Payments",
    title: "Direct bKash & Nagad Payments (0% Commission)",
    link: "/features/bkash-nagad-cod",
    problem: "Foreign tools force you to pay 2% on every sale and hold your funds for days. Other platforms require complicated merchant bank agreements and charge steep setup fees.",
    solution: "Customers pay directly to your personal or merchant bKash or Nagad wallet. They enter their TrxID at checkout, and you verify it with 1 tap on your admin desk. BizTrackBD never touches your money and charges zero commission.",
    points: [
      "Direct-to-merchant bKash and Nagad checkout with customer TrxID entry",
      "1-tap transaction verification desk inside your store admin",
      "Flexible Cash on Delivery with customizable minimum and maximum order limits",
      "0% commission on your sales — you keep 100% of your earnings",
    ],
    proof: "Customer money goes directly into your mobile wallet, with zero payout holding delays.",
  },
  {
    badge: "Accounting",
    title: "Profit & COD Reconciliation",
    link: "/features/profit-cod-reconciliation",
    problem: "Most sellers calculate revenue from gross sales without accounting for courier fees, refused parcel return penalties, and ad spend, leading to cashflow surprises.",
    solution: "BizTrackBD itemizes gross order value, product wholesale costs, delivery charges, packaging expenses, and ad costs in one automated waterfall ledger to reveal your True Net Profit.",
    points: [
      "Itemized net profit waterfall per order and across monthly cohorts",
      "Courier settlement statement auditing to catch unpaid delivered parcels",
      "True net margin tracking in Taka without manual spreadsheet formulas",
      "1-click CSV and Excel export for partnership accounting and tax filing",
    ],
    proof: "Know your true business profit down to the last Taka.",
  },
  {
    badge: "Marketing",
    title: "Server-Side Meta Conversions API (CAPI)",
    link: "/features/meta-pixel-capi",
    problem: "Since Apple's iOS 14 update and ad-blockers, standard browser-based Facebook Pixels miss up to 30% of purchases in Bangladesh, throwing off Meta's ad algorithms and raising your cost per customer.",
    solution: "BizTrackBD includes server-side Meta Conversions API (CAPI) built-in. Every completed order is sent directly from our server to Meta with 100% purchase delivery match, training Facebook's algorithm on your exact purchase values in Taka.",
    points: [
      "Server-side Meta Conversions API (CAPI) with high event match quality",
      "Native support for TikTok Pixel and Google Analytics 4 (GA4)",
      "High-converting single-product landing pages tailored for Facebook ads",
      "Track real return on ad spend (ROAS) in Taka to scale winning campaigns",
    ],
    proof: "Accurate purchase signaling trains Meta to find higher-spending buyers.",
  },
  {
    badge: "Operations",
    title: "Run Your Entire Business from Your Phone",
    problem: "Most Bangladeshi business owners don't work behind a desktop computer. You are out sourcing fabrics in Gausia or Islampur, checking warehouse stock, or packing parcels in your workshop.",
    solution: "BizTrackBD is engineered mobile-first. An installable app (PWA) gives you full access on Android and iPhone. Take photos of new products, set prices in Taka, approve bKash payments, and book couriers without touching a computer.",
    points: [
      "Installable PWA works like a native mobile app on your smartphone",
      "Take photos on your phone and upload directly to your product catalog",
      "Automated Bangla SMS notifications for order confirmations and dispatch alerts",
      "Quick WhatsApp customer sharing for order links, receipts, and invoices",
    ],
    proof: "Zero computer needed. Run your entire business from your pocket.",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <section className="hero hero-center">
        <div className="wrap">
          <span className="eyebrow">Operational Features · Built for Bangladesh</span>
          <h1>Every tool you need to run a profitable online store in Bangladesh</h1>
          <p className="lead">
            Built specifically around how Bangladeshi commerce operates: Cash on Delivery risks, bKash TrxID verification, Steadfast courier pickups, and Facebook ad marketing.
          </p>
          <div className="cta">
            <Link href="/start" className="btn btn-primary btn-lg" prefetch={false}>Start 14-day free trial</Link>
            <a href={demoAdminUrl()} className="btn btn-secondary btn-lg">Try live admin demo</a>
          </div>
          <p className="fine">No card required · Set up in 10 minutes · Plans from ৳ 699 a month</p>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="features-grid">
            {PILLARS.map((p, idx) => (
              <div key={p.title} className="card feature-card">
                <div className="row-between">
                  <span className="pill">{p.badge}</span>
                  <span className="feat-num">0{idx + 1}</span>
                </div>
                <h3>{p.title}</h3>
                <div className="feat-problem">
                  <strong>The Daily Problem:</strong>
                  <p>{p.problem}</p>
                </div>
                <div className="feat-solution">
                  <strong>How BizTrackBD Solves It:</strong>
                  <p>{p.solution}</p>
                </div>
                <ul className="feat-points">
                  {p.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
                <div className="feat-highlight">
                  <span>💡 {p.proof}</span>
                </div>
                {p.link && (
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                    <Link href={p.link} className="btn btn-secondary btn-sm" style={{ width: "100%", justifyContent: "center" }} prefetch={false}>
                      Read Deep-Dive Guide &amp; Interactive Simulator &rarr;
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="block soft">
        <div className="wrap">
          <div className="demo-band" style={{ background: "#FFFFFF", border: "1px solid var(--line)" }}>
            <div>
              <span className="eyebrow">Try it before you sign up</span>
              <h2>Test the merchant desk with real sample data right now</h2>
              <p>
                Open our interactive demo admin to approve sample bKash transactions, test courier pickup booking, and inspect our delivery return checker. No signup or email needed.
              </p>
            </div>
            <a href={demoAdminUrl()} className="btn btn-primary btn-lg">Launch instant demo</a>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="wrap">
          <h2>Ready to upgrade your online business?</h2>
          <p>Join hundreds of smart Bangladeshi merchants selling with BizTrackBD.</p>
          <Link href="/start" className="btn btn-lg btn-primary" prefetch={false}>Start your free 14-day trial</Link>
        </div>
      </section>
    </>
  );
}
