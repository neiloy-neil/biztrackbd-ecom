import Link from "next/link";
import { THEMES, listPublicPlans } from "@biztrackbd/core";
import { HeroMock } from "@/components/hero-mock";
import { PlanCards } from "@/components/plan-cards";
import { TemplateCard } from "@/components/template-card";
import { planBullets, taka } from "@/lib/plans";

export const dynamic = "force-dynamic";

const FAQ: [string, string][] = [
  ["Do I need a card to start?", "No. The 14-day trial needs no card and no payment. You choose a plan only when you are ready."],
  ["How do I pay for my plan?", "Send the plan price by bKash or Nagad to our number, enter the transaction ID, and we switch your plan on after we check it, usually within a few hours."],
  ["Does BizTrackBD hold my customers' money?", "Never. Customers pay you directly by cash on delivery, or to your own bKash or Nagad number. We charge a plan price and no commission on your sales."],
  ["What happens if I stop paying?", "You get 3 days when everything keeps working, then your store goes offline and your admin turns read-only until you pay. Your data is kept, and you can download it."],
  ["Which couriers can I use?", "Steadfast, Pathao and RedX, with your own courier account and keys. We encrypt the keys and never show them again."],
];

const SHOWCASE = ["kapor", "gadgetstudio", "berber"];

export default async function Home() {
  const plans = await listPublicPlans().catch(() => []);
  const from = plans[0]?.priceMonthly;
  const best = plans.find((p) => p.tier === "PRO")?.tier;
  const showcase = SHOWCASE.map((id) => THEMES.find((t) => t.id === id)).filter((t): t is (typeof THEMES)[number] => Boolean(t));
  return (
    <>
      <section className="hero hero-center">
        <div className="wrap">
          <span className="eyebrow">Online store software for Bangladesh</span>
          <h1>Launch your online store in a day. Sell with bKash, Nagad and cash on delivery.</h1>
          <p className="lead">Pick a template, add your products from your phone, and share your link. Book Pathao or Steadfast pickups straight from each order.</p>
          <div className="cta">
            <Link href="/start" className="btn btn-primary btn-lg" prefetch={false} data-testid="hero-cta">Start free trial</Link>
            <Link href="/templates" className="btn btn-secondary btn-lg" prefetch={false}>See templates</Link>
          </div>
          <p className="fine">14 days free · No card needed · Bangla and English{from ? ` · Plans from ${taka(from)} a month` : ""}</p>
        </div>
        <div className="wrap"><HeroMock /></div>
      </section>

      <section className="block">
        <div className="wrap">
          <span className="eyebrow">How it works</span>
          <h2>From signup to first order in three steps</h2>
          <ol className="steps3">
            <li><span>1</span><h3>Choose a template</h3><p>Ready-made stores for fashion, gadgets, kids wear, streetwear, beauty and tailoring. Switch any time without losing your products.</p></li>
            <li><span>2</span><h3>Add products and your brand</h3><p>Take photos on your phone, set prices in taka, and upload your logo. Prefer to look around first? Start with sample products.</p></li>
            <li><span>3</span><h3>Share your link and sell</h3><p>Your store is live at yourname.biztrack.bd. Add your own domain whenever you are ready.</p></li>
          </ol>
        </div>
      </section>

      <section className="block soft">
        <div className="wrap">
          <div className="row-between" style={{ alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div><span className="eyebrow">Templates</span><h2>Real stores you can open and try</h2></div>
            <Link href="/templates" className="link" prefetch={false}>Browse all templates</Link>
          </div>
          <div className="grid g3" style={{ marginTop: 28 }} data-testid="home-templates">
            {showcase.map((t) => <TemplateCard key={t.id} t={{ ...t, audience: undefined }} compact />)}
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="bd-panel">
            <div>
              <span className="eyebrow">Built for Bangladesh</span>
              <h2>The way your customers actually pay and receive</h2>
              <p className="sub">Not a foreign tool with a taka symbol added. Checkout, address fields, SMS and couriers follow how orders work here.</p>
            </div>
            <dl className="bd-list">
              <div><dt>bKash and Nagad checkout</dt><dd>Customers enter their TrxID. You confirm it in one tap.</dd></div>
              <div><dt>Cash on delivery</dt><dd>With limits, fees and fake-order protection.</dd></div>
              <div><dt>Pathao, Steadfast, RedX</dt><dd>Book pickups and print labels from the order page.</dd></div>
              <div><dt>Division, district, upazila</dt><dd>Address fields that match Bangladesh and your courier.</dd></div>
              <div><dt>SMS in Bangla</dt><dd>Order, payment and tracking messages in your customers' words.</dd></div>
              <div><dt>Built for your phone</dt><dd>Run the whole shop from an installable mobile app.</dd></div>
            </dl>
          </div>
        </div>
      </section>

      {plans.length > 0 && (
        <section className="block soft">
          <div className="wrap" style={{ textAlign: "center" }}>
            <span className="eyebrow">Pricing</span>
            <h2 style={{ margin: "0 auto" }}>Start free, pay when you grow</h2>
            <div style={{ textAlign: "left", marginTop: 28 }}>
              <PlanCards
                plans={plans.map((p) => ({ tier: p.tier, name: p.name, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly, monthsFree: p.yearlyMonthsFree, bullets: planBullets(p) }))}
                best={best}
                compactBullets={4}
              />
            </div>
            <p style={{ marginTop: 20 }}><Link href="/pricing" className="link" prefetch={false}>Compare all plans</Link></p>
          </div>
        </section>
      )}

      <section className="block">
        <div className="wrap">
          <h2 style={{ textAlign: "center", margin: "0 auto" }}>Questions shop owners ask</h2>
          <dl className="faq-list">
            {FAQ.map(([q, a]) => <div key={q}><dt>{q}</dt><dd>{a}</dd></div>)}
          </dl>
        </div>
      </section>

      <section className="cta-band">
        <div className="wrap">
          <h2>Open your store this week</h2>
          <p>14 days free. No card. Cancel any time.</p>
          <Link href="/start" className="btn btn-lg btn-white" prefetch={false}>Start free trial</Link>
        </div>
      </section>
    </>
  );
}
