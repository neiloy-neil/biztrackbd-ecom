import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The rules for using BizTrackBD: plans, payment, your store and your customers.",
  alternates: {
    canonical: `${siteUrl}/terms`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/terms`,
    siteName: "BizTrackBD",
    title: "Terms of Use",
    description: "Terms and conditions for merchants using the BizTrackBD platform.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "BizTrackBD Terms" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Use",
    description: "Clear and straightforward terms for store and business owners.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const UPDATED = "12 October 2026";

export default function Terms() {
  return (
    <section className="block">
      <div className="wrap prose" data-testid="terms">
        <span className="eyebrow">Terms</span>
        <h1>Terms of use</h1>
        <p className="fine">Last updated {UPDATED}</p>
        <p>These terms are the agreement between you (the store owner) and BizTrackBD. By opening a store you accept them.</p>

        <h2>The service</h2>
        <p>BizTrackBD gives you an online store, an admin to run it, and tools to take orders, check bKash and Nagad payments, book couriers and see your sales. We work to keep it available and secure, but we cannot promise it will never be interrupted.</p>

        <h2>Your account</h2>
        <p>You must give true details, keep your sign-in safe, and tell us if you think someone else has used it. You are responsible for what staff you invite do in your store.</p>

        <h2>Free trial and plans</h2>
        <p>A new store gets a free trial with no card needed. After it, you choose a plan and pay by sending the plan price to our bKash or Nagad number and entering the transaction ID; we switch the plan on after we check the payment. Prices are shown on the pricing page in taka. We charge a plan price and <b>no commission on your sales</b>.</p>

        <h2>If a plan is not paid</h2>
        <p>You get 3 days when everything keeps working. After that your storefront goes offline and your admin becomes read-only until you pay. If it stays unpaid your admin is locked except the billing screen. Your data is kept, and paying brings the store back.</p>

        <h2>Your store and your customers</h2>
        <p>You are the seller. You are responsible for your products, prices, descriptions, delivery and refunds, for following the laws that apply to selling in Bangladesh, and for the way you use your customers&apos; data. Customers pay you directly; BizTrackBD does not hold customers&apos; money.</p>

        <h2>What you may not do</h2>
        <p>You may not sell goods that are illegal or counterfeit, use another business&apos;s name or brand without permission, send spam, try to break into or overload the service or another store, or use it to deceive customers. We may hold, suspend or remove a store that does, and we will tell you why.</p>

        <h2>Your data</h2>
        <p>Your store&apos;s content and customer data are yours. You can download your data at any time and ask us to delete it. How we handle personal data is described in the <a href="/privacy">privacy page</a>.</p>

        <h2>Ending the agreement</h2>
        <p>You can stop at any time. We may end or suspend an account that breaks these terms or stays unpaid for a long time, after telling you. Fees already paid for a period are not refunded unless we ended your account without cause.</p>

        <h2>Limits on what we are responsible for</h2>
        <p>The service is provided as it is. To the extent the law allows, we are not responsible for lost sales or profit, for what couriers, mobile wallets, messaging or hosting providers do or fail to do, or for indirect losses. Our total responsibility for a claim is limited to what you paid us in the 3 months before it.</p>

        <h2>Changes and law</h2>
        <p>We may update these terms and will tell store owners by email before a change that matters applies. These terms are governed by the laws of Bangladesh.</p>
      </div>
    </section>
  );
}
