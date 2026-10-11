import Link from "next/link";
import { listPublicPlans } from "@biztrackbd/core";
import { taka } from "@/lib/plans";

export const dynamic = "force-dynamic";

const FAQ: [string, string][] = [
  ["Do I need a card to start?", "No. The 14-day trial needs no card and no payment. You choose a plan only when you are ready."],
  ["How do I pay for my plan?", "Send the plan price by bKash or Nagad to our number, enter the transaction ID, and we switch your plan on after we check it, usually within a few hours."],
  ["Does BizTrackBD hold my customers' money?", "Never. Customers pay you directly by cash on delivery, or to your own bKash or Nagad number. We charge a plan price and no commission on your sales."],
  ["What happens if I stop paying?", "You get 3 days when everything keeps working, then your store goes offline and your admin turns read-only until you pay. Your data is kept, and you can download it."],
  ["Which couriers can I use?", "Steadfast, Pathao and RedX, with your own courier account and keys. We encrypt the keys and never show them again."],
];

export default async function Home() {
  const plans = await listPublicPlans().catch(() => []);
  const from = plans[0]?.priceMonthly;
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <span className="eyebrow">Online stores for Bangladesh</span>
          <h1>Open your online store today. Know your real profit.</h1>
          <p className="lead">A store that takes cash on delivery, bKash and Nagad, books your couriers, checks what they owe you, and shows what you actually earn.</p>
          <div className="cta">
            <Link href="/start" className="btn btn-primary btn-lg" prefetch={false} data-testid="hero-cta">Start free for 14 days</Link>
            <Link href="/templates" className="btn btn-secondary btn-lg" prefetch={false}>See the template</Link>
          </div>
          <p className="fine">No card needed.{from ? ` Plans from ${taka(from)} a month.` : ""} No commission on your sales.</p>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <h2>Built for how Bangladesh actually sells</h2>
          <p className="sub">Most of your orders are cash on delivery, half arrive by phone or Messenger, and the courier pays you weeks later. We start there.</p>
          <div className="grid g3">
            <div className="card"><h3>Checkout customers trust</h3><p>Cash on delivery and manual bKash or Nagad with the TrxID, in Bangla or English, on a page that loads fast on a phone.</p></div>
            <div className="card"><h3>Couriers and COD, sorted</h3><p>Book Steadfast, Pathao or RedX from the order, follow every parcel, and upload the payout statement to see what was paid short.</p></div>
            <div className="card"><h3>Fake orders held back</h3><p>A delivery trust score for every phone number, built from parcels across stores. Risky cash orders wait until you have called.</p></div>
            <div className="card"><h3>Returns and exchanges</h3><p>Approve a return, get the stock back, send the refund or an exchange, and keep a record of every step.</p></div>
            <div className="card"><h3>Profit, not just sales</h3><p>Sales minus product cost, courier fees, returns, refunds and ads. One screen, and the lines always add up.</p></div>
            <div className="card"><h3>Runs from your phone</h3><p>Pack, print slips, verify payments and key in phone orders from your mobile. Install it like an app.</p></div>
          </div>
        </div>
      </section>

      <section className="block soft">
        <div className="wrap">
          <h2>Ready in three steps</h2>
          <div className="grid g3">
            <div className="card"><span className="step">1</span><h3>Tell us about your store</h3><p>Your name, store name and the address you want, like yourshop.biztrackbd.com. It takes about two minutes.</p></div>
            <div className="card"><span className="step">2</span><h3>Look around a working store</h3><p>We add a few sample products so you see how it works. Replace them with yours.</p></div>
            <div className="card"><span className="step">3</span><h3>Take your first order</h3><p>Share the link. Pay for a plan when the trial ends, by bKash or Nagad.</p></div>
          </div>
          <div style={{ marginTop: 28 }}><Link href="/start" className="btn btn-primary btn-lg" prefetch={false}>Start free</Link></div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <h2>Questions</h2>
          <div style={{ marginTop: 20, maxWidth: 760 }}>
            {FAQ.map(([q, a]) => <details key={q} className="faq"><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </div>
      </section>
    </>
  );
}
