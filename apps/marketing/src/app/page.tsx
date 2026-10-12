import Link from "next/link";
import { THEMES, listPublicPlans } from "@biztrackbd/core";
import { HeroMock } from "@/components/hero-mock";
import { PlanCards } from "@/components/plan-cards";
import { TemplateCard } from "@/components/template-card";
import { demoAdminUrl } from "@/lib/demo-admin";
import { planBullets, taka } from "@/lib/plans";

export const dynamic = "force-dynamic";

const FAQ: [string, string][] = [
  ["Do I need an international credit card to use BizTrackBD?", "No. You never need a dollar card. You pay for your subscription in Bangladeshi Taka using personal or merchant bKash or Nagad."],
  ["Does BizTrackBD take a cut or commission from my sales?", "Never. We charge 0% commission. You keep 100% of every sale. Your customers pay you directly via bKash, Nagad, or Cash on Delivery."],
  ["Does BizTrackBD hold my customer's money in an escrow account?", "No. Your money never touches our bank account. Customer payments go straight to your personal or merchant bKash/Nagad number."],
  ["How does the Cash on Delivery (COD) return check work?", "When a customer places an order, BizTrackBD checks their phone number against courier delivery logs across Pathao and Steadfast. If they have a history of rejecting parcels, the order is flagged so you can request an advance delivery fee or confirm by phone before shipping."],
  ["Which couriers can I connect?", "Steadfast, Pathao, and RedX. You connect your own courier merchant accounts using your API keys. We encrypt your keys and you can book pickups and print shipping labels in 1 click."],
  ["Can I run my store completely from my smartphone?", "Yes. Our merchant admin is built mobile-first. You can take photos on your phone, set prices, confirm orders, and book couriers without ever opening a computer."],
  ["What happens to my data if I cancel or pause my plan?", "Your data is always yours. You can download all your products, customer phone numbers, and order histories as CSV spreadsheets at any time in 1 click."],
];

const SHOWCASE = ["kapor", "gadgetstudio", "berber"];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  })),
};

export default async function Home() {
  const plans = await listPublicPlans().catch(() => []);
  const from = plans[0]?.priceMonthly;
  const best = plans.find((p) => p.tier === "PRO")?.tier;
  const showcase = SHOWCASE.map((id) => THEMES.find((t) => t.id === id)).filter((t): t is (typeof THEMES)[number] => Boolean(t));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {/* Handcrafted Hero Section */}
      <section className="hero hero-center">
        <div className="wrap">
          <span className="eyebrow">Honest eCommerce Software for Bangladesh</span>
          <h1>Launch your online store in a day. Sell with bKash, Nagad and Cash on Delivery.</h1>
          <p className="lead">
            Run your shop from your phone. Take orders directly into your bKash or Nagad wallet. Book Steadfast and Pathao pickups straight from each order. Zero sales commission, no dollar cards, and plans starting at {from ? taka(from) : "৳ 699"} a month.
          </p>
          <div className="cta">
            <Link href="/start" className="btn btn-primary btn-lg" prefetch={false} data-testid="hero-cta">Start 14-day free trial</Link>
            <a href={demoAdminUrl()} className="btn btn-secondary btn-lg" data-testid="hero-demo-admin">Try the admin desk (no signup)</a>
          </div>
          <p className="fine">
            14 days free · No card needed · Bangla and English · 0% commission on sales
          </p>
        </div>
        <div className="wrap" style={{ marginTop: 40 }}>
          <HeroMock />
        </div>
      </section>

      {/* How It Works */}
      <section className="block">
        <div className="wrap">
          <span className="eyebrow">How it works</span>
          <h2>From setup to first order in three practical steps</h2>
          <ol className="steps3">
            <li>
              <span>01</span>
              <h3>Pick a template</h3>
              <p>Ready-to-use stores for clothing, gadgets, kids wear, beauty, and tailoring. Switch designs any time without losing your products or orders.</p>
            </li>
            <li>
              <span>02</span>
              <h3>Add your products and bKash</h3>
              <p>Take photos on your phone, set prices in Taka, and enter your bKash or Nagad number. You can also start with sample products to explore.</p>
            </li>
            <li>
              <span>03</span>
              <h3>Share your link and take orders</h3>
              <p>Your store goes live immediately at yourname.biztrack.bd. Connect your own custom domain (yourbrand.com) whenever you are ready.</p>
            </li>
          </ol>
        </div>
      </section>

      {/* Built for Bangladesh Operational Reality */}
      <section className="block soft">
        <div className="wrap">
          <div className="bd-panel">
            <div>
              <span className="eyebrow">Built for Bangladesh</span>
              <h2>Built around how Bangladeshi commerce actually operates</h2>
              <p className="sub">
                Not a foreign Western tool with a Taka sign slapped on. Every screen is designed around bKash payments, Cash on Delivery risks, and local courier hubs.
              </p>
              <div style={{ marginTop: 24 }}>
                <Link href="/features" className="btn btn-primary" prefetch={false}>
                  Explore all 6 operational features →
                </Link>
              </div>
            </div>
            <dl className="bd-list">
              <div>
                <dt>bKash & Nagad checkout</dt>
                <dd>Customers enter their TrxID. You confirm it in one tap. Money goes directly to your wallet, not our bank.</dd>
              </div>
              <div>
                <dt>COD return fraud protection</dt>
                <dd>Checks customer delivery success rates across Pathao and Steadfast before you pack, saving return courier fees.</dd>
              </div>
              <div>
                <dt>Pathao, Steadfast, RedX</dt>
                <dd>Connect your courier API keys once. Click book pickup and print thermal shipping labels right from the order.</dd>
              </div>
              <div>
                <dt>Division, District, Upazila</dt>
                <dd>Cascading address dropdowns matching Bangladesh geography, so customers don&apos;t misspell addresses and parcels don&apos;t get lost.</dd>
              </div>
              <div>
                <dt>Automated Bangla SMS</dt>
                <dd>Send automatic order confirmations, dispatch alerts, and live tracking links in clear Bangla.</dd>
              </div>
              <div>
                <dt>Built for your phone</dt>
                <dd>Run your full store from your phone while shopping for fabrics in Gausia or stock in Elephant Road.</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Templates Showcase */}
      <section className="block">
        <div className="wrap">
          <div className="row-between" style={{ alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <span className="eyebrow">Storefronts</span>
              <h2>Real templates you can open and try right now</h2>
            </div>
            <Link href="/templates" className="link" prefetch={false}>Browse all templates →</Link>
          </div>
          <div className="grid g3" style={{ marginTop: 28 }} data-testid="home-templates">
            {showcase.map((t) => (
              <TemplateCard key={t.id} t={{ ...t, audience: undefined }} compact />
            ))}
          </div>
        </div>
      </section>

      {/* Real Merchant Case Studies */}
      <section className="block soft">
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 40px" }}>
            <span className="eyebrow">Real Merchant Stories</span>
            <h2>How stores in Dhaka, Chittagong &amp; Sylhet run on BizTrackBD</h2>
            <p className="sub">
              Real Bangladeshi sellers who moved away from chaotic Facebook Messenger orders, manual paper ledgers, and costly foreign eCommerce tools.
            </p>
          </div>

          <div className="grid g3" style={{ gap: 24 }}>
            {/* Story 1: Dhaka */}
            <div
              className="card"
              style={{
                padding: "28px 24px",
                background: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid var(--line)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                    Narayanganj Silk &amp; Handloom
                  </h3>
                  <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>
                    📍 Elephant Road &amp; Gausia, Dhaka · Clothing
                  </div>
                </div>
                <span className="pill live" style={{ fontSize: 11 }}>Steadfast COD</span>
              </div>

              <blockquote
                style={{
                  margin: "8px 0 0",
                  fontSize: 14.5,
                  color: "var(--ink)",
                  lineHeight: 1.6,
                  fontStyle: "italic",
                }}
              >
                &ldquo;Before BizTrackBD, we spent 3 hours every evening copying customer addresses from Messenger into our courier app. We lost over ৳ 15,000 every month on fake orders. The COD fraud shield cut our parcel returns by 80%.&rdquo;
              </blockquote>

              <div
                style={{
                  marginTop: "auto",
                  paddingTop: 14,
                  borderTop: "1px solid var(--line)",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  fontSize: 12.5,
                }}
              >
                <div>
                  <span style={{ color: "var(--ink-3)", display: "block" }}>Monthly shipments</span>
                  <strong style={{ fontSize: 15, color: "var(--ink)" }}>650+ orders</strong>
                </div>
                <div>
                  <span style={{ color: "var(--ink-3)", display: "block" }}>Courier return rate</span>
                  <strong style={{ fontSize: 15, color: "#15803D" }}>Dropped to 3.2%</strong>
                </div>
              </div>
            </div>

            {/* Story 2: Chittagong */}
            <div
              className="card"
              style={{
                padding: "28px 24px",
                background: "#FFFFFF",
                borderRadius: 16,
                border: "1.5px solid var(--brand)",
                boxShadow: "0 8px 24px rgba(91, 79, 232, 0.08)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                    PortCity Tech Accessories
                  </h3>
                  <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>
                    📍 GEC Circle, Chittagong · Electronics
                  </div>
                </div>
                <span className="pill" style={{ fontSize: 11 }}>Shopify Switcher</span>
              </div>

              <blockquote
                style={{
                  margin: "8px 0 0",
                  fontSize: 14.5,
                  color: "var(--ink)",
                  lineHeight: 1.6,
                  fontStyle: "italic",
                }}
              >
                &ldquo;We paid Shopify $39 every month plus currency conversion fees, but our customers wanted to pay with bKash and COD. Switching to BizTrackBD saved us over ৳ 85,000 a year and our store loads in under a second on 4G.&rdquo;
              </blockquote>

              <div
                style={{
                  marginTop: "auto",
                  paddingTop: 14,
                  borderTop: "1px solid var(--line)",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  fontSize: 12.5,
                }}
              >
                <div>
                  <span style={{ color: "var(--ink-3)", display: "block" }}>Annual savings</span>
                  <strong style={{ fontSize: 15, color: "var(--brand)" }}>৳ 87,000/yr</strong>
                </div>
                <div>
                  <span style={{ color: "var(--ink-3)", display: "block" }}>Courier dispatch</span>
                  <strong style={{ fontSize: 15, color: "var(--ink)" }}>1-click Pathao API</strong>
                </div>
              </div>
            </div>

            {/* Story 3: Sylhet */}
            <div
              className="card"
              style={{
                padding: "28px 24px",
                background: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid var(--line)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                    Surma Valley Organics
                  </h3>
                  <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>
                    📍 Zindabazar, Sylhet · Artisanal Tea
                  </div>
                </div>
                <span className="pill live" style={{ fontSize: 11 }}>bKash Verified</span>
              </div>

              <blockquote
                style={{
                  margin: "8px 0 0",
                  fontSize: 14.5,
                  color: "var(--ink)",
                  lineHeight: 1.6,
                  fontStyle: "italic",
                }}
              >
                &ldquo;Customers order from Sylhet, Dhaka, and Rajshahi. When they enter their bKash TrxID, we verify it in 1 tap from our phone. The automatic Bangla SMS with live Pathao tracking makes our brand look 10x more professional.&rdquo;
              </blockquote>

              <div
                style={{
                  marginTop: "auto",
                  paddingTop: 14,
                  borderTop: "1px solid var(--line)",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  fontSize: 12.5,
                }}
              >
                <div>
                  <span style={{ color: "var(--ink-3)", display: "block" }}>Payment wallet</span>
                  <strong style={{ fontSize: 15, color: "#E2136E" }}>100% Direct bKash</strong>
                </div>
                <div>
                  <span style={{ color: "var(--ink-3)", display: "block" }}>Customer SMS</span>
                  <strong style={{ fontSize: 15, color: "var(--ink)" }}>Automated Bangla</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BizTrackBD vs Shopify Teaser */}
      <section className="block">
        <div className="wrap">
          <div className="demo-band" style={{ background: "#FFFFFF", border: "1px solid var(--line)" }}>
            <div>
              <span className="eyebrow">Platform Comparison</span>
              <h2>Why spend $39/month on Shopify when you sell in Bangladesh?</h2>
              <p>
                Shopify requires a passport-endorsed dollar credit card, takes up to 2% of your sales, and has no native Pathao, Steadfast, or bKash TrxID integration. BizTrackBD gives you a complete local store engine for ৳ 699/month, saving you over ৳ 80,000 every year.
              </p>
            </div>
            <Link href="/compare" className="btn btn-secondary btn-lg" prefetch={false}>
              Read the Shopify comparison →
            </Link>
          </div>
        </div>
      </section>

      {/* Try Admin Demo Banner */}
      <section className="block">
        <div className="wrap">
          <div className="demo-band" data-testid="demo-admin-band">
            <div>
              <span className="eyebrow">Try it before signing up</span>
              <h2>Test the merchant admin with sample products and orders</h2>
              <p>
                Open a private store with sample products and orders. Check a real bKash payment, pack an order, book a courier pickup, and see your sales. It is yours to test for three hours. No email or password needed.
              </p>
            </div>
            <a href={demoAdminUrl()} className="btn btn-primary btn-lg" data-testid="demo-admin-cta">
              Open instant demo
            </a>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      {plans.length > 0 && (
        <section className="block soft">
          <div className="wrap" style={{ textAlign: "center" }}>
            <span className="eyebrow">Honest Pricing</span>
            <h2 style={{ margin: "0 auto" }}>Simple plans. Zero sales commission.</h2>
            <p className="sub" style={{ margin: "12px auto 0" }}>
              Pay monthly or yearly via bKash or Nagad. Cancel any time. We never take a cut of your revenue.
            </p>
            <div style={{ textAlign: "left", marginTop: 32 }}>
              <PlanCards
                plans={plans.map((p) => ({
                  tier: p.tier,
                  name: p.name,
                  priceMonthly: p.priceMonthly,
                  priceYearly: p.priceYearly,
                  monthsFree: p.yearlyMonthsFree,
                  bullets: planBullets(p),
                }))}
                best={best}
                compactBullets={4}
              />
            </div>
            <p style={{ marginTop: 24 }}>
              <Link href="/pricing" className="link" prefetch={false}>Compare all plan features and limits →</Link>
            </p>
          </div>
        </section>
      )}

      {/* Trust & Guarantees Bar */}
      <section className="block">
        <div className="wrap">
          <div className="trust-grid">
            <div className="trust-item">
              <b>🔒 We never touch your money</b>
              <p>Customers pay directly to your bKash, Nagad, or by Cash on Delivery. 0% commission on your sales.</p>
            </div>
            <div className="trust-item">
              <b>🔑 Encrypted courier keys</b>
              <p>Your Steadfast and Pathao API keys are encrypted with AES-256 and never shared with anyone.</p>
            </div>
            <div className="trust-item">
              <b>📦 1-click CSV data export</b>
              <p>Your products, customers, and order history belong to you. Download everything in 1 click at any time.</p>
            </div>
            <div className="trust-item">
              <b>💬 Direct WhatsApp support in Dhaka</b>
              <p>Real support from people who know Bangladesh eCommerce. No generic chatbots that waste your time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="block soft">
        <div className="wrap">
          <h2 style={{ textAlign: "center", margin: "0 auto" }}>Frequently asked questions</h2>
          <dl className="faq-list">
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Closing CTA Band */}
      <section className="cta-band">
        <div className="wrap">
          <h2>Start selling the way Bangladesh actually shops</h2>
          <p>14 days free · No credit card required · Set up in 10 minutes</p>
          <Link href="/start" className="btn btn-lg btn-primary" prefetch={false}>
            Start your free 14-day trial
          </Link>
        </div>
      </section>
    </>
  );
}
