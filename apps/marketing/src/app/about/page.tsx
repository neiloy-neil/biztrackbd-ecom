import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "BizTrackBD is online store software built in Dhaka for Bangladeshi sellers: bKash, Nagad, COD and courier booking with 0% sales commission.",
  alternates: { canonical: `${siteUrl}/about` },
  openGraph: {
    type: "website",
    url: `${siteUrl}/about`,
    siteName: "BizTrackBD",
    title: "About BizTrackBD",
    description: "Online store software built in Dhaka for Bangladeshi sellers.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "About BizTrackBD" }],
  },
};

export default function AboutPage() {
  return (
    <section className="block">
      <div className="wrap prose">
        <span className="eyebrow">About</span>
        <h1>Online store software built for how Bangladesh sells</h1>
        <p>
          BizTrackBD helps Bangladeshi sellers run a real online store without a dollar card, a developer or a
          platform that takes a cut of every sale. It is built and supported from Dhaka, and operated by The Digital
          Dude.
        </p>

        <h2>What we believe</h2>
        <p>
          <b>Your money goes to you.</b> Customers pay your own bKash or Nagad wallet, or cash on delivery. We charge a
          flat monthly plan in taka and take 0% of your sales.
        </p>
        <p>
          <b>Your data is yours.</b> You can export your products, customers and orders at any time. Read how we handle
          it on our <Link href="/data-ownership">data ownership</Link> and <Link href="/security">security</Link>{" "}
          pages.
        </p>
        <p>
          <b>Built for local problems.</b> Fake COD orders, TrxID matching and booking Steadfast, Pathao and RedX
          pickups are first-class features, not plugins.
        </p>

        <h2>Talk to us</h2>
        <p>
          Questions before you start? <Link href="/contact">Message our team on WhatsApp</Link>, or{" "}
          <Link href="/start">start the 14-day free trial</Link>. No card is needed.
        </p>
      </div>
    </section>
  );
}
