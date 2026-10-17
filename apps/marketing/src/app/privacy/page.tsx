import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What BizTrackBD collects, why, who sees it, and how to have it removed.",
  alternates: {
    canonical: `${siteUrl}/privacy`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/privacy`,
    siteName: "BizTrackBD",
    title: "Privacy Policy",
    description: "What BizTrackBD collects, merchant data ownership, and customer privacy protections.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "BizTrackBD Privacy" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy",
    description: "Our clear privacy principles and zero customer data selling charter.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const UPDATED = "12 October 2026";

export default function Privacy() {
  return (
    <section className="block">
      <div className="wrap prose" data-testid="privacy">
        <span className="eyebrow">Privacy</span>
        <h1>How we handle your data</h1>
        <p className="fine">Last updated {UPDATED}</p>
        <p>BizTrackBD is online store software. There are two kinds of people whose data we hold: the <b>store owners and staff</b> who use BizTrackBD, and the <b>customers</b> of those stores. This page explains both.</p>

        <h2>Store owners and staff</h2>
        <p>When you open a store we keep your name, email address and mobile number, your store name and address, your plan and payment records (the bKash or Nagad TrxID you send us and its status), and what you do in the admin (an audit log of changes, so you can see who did what). We use this to run your store, to bill you, to contact you about your account, and to keep the service safe.</p>

        <h2>Your store&apos;s customers</h2>
        <p>Customers give a store their name, phone number, address and order details so the store can deliver. <b>Each store owns its customers&apos; data and decides what to do with it</b>; BizTrackBD holds it on the store&apos;s behalf and only to provide the service. One store can never see another store&apos;s customers: every store&apos;s data is separated in the database itself, not just in the application.</p>
        <p>To help stores avoid fake and abandoned orders, we keep a shared delivery record for each phone number that holds only a one-way scrambled form of the number (a hash) and counts of delivered, returned and refused parcels. It does not contain names, addresses or what was bought, and the number cannot be read back from it.</p>

        <h2>Messages</h2>
        <p>We send text messages and emails for sign-in codes, order updates a store has switched on, and account notices. A customer can opt out of a store&apos;s marketing texts by replying as instructed in the message. We do not sell phone numbers or email addresses.</p>

        <h2>Keys and passwords</h2>
        <p>Courier and payment keys that a store adds are encrypted and are never shown again. We do not store card numbers: stores are paid directly by customers (cash on delivery, or to the store&apos;s own bKash or Nagad), and your plan is paid to us by bKash or Nagad.</p>

        <h2>Who else handles data</h2>
        <p>We use a small number of providers to run the service: hosting (Vercel), the database, sign-in and file storage (Supabase), email (Brevo) and text messages (sms.net.bd). They process data only to provide those services. Couriers a store connects (Steadfast, Pathao, RedX) receive the delivery details needed to collect and deliver a parcel.</p>

        <h2>Cookies</h2>
        <p>We use cookies that keep you signed in and remember your language and cart. Stores may add their own advertising pixels (for example Meta); that is the store&apos;s choice and the store&apos;s responsibility to tell its customers.</p>

        <h2>How long we keep it</h2>
        <p>We keep a store&apos;s data while the account is open. If a plan is not paid the store goes offline and then locked, but the data is kept so the owner can pay and return, or download it. You can ask us to delete your account and your store&apos;s data and we will, apart from records we must keep for accounting or the law.</p>

        <h2>Your choices</h2>
        <p>You can ask to see, correct, export or delete your data, or object to how it is used. Use the <a href="/contact">contact page</a>. Customers of a store should ask the store first; we will help the store respond.</p>

        <h2>Changes</h2>
        <p>If this page changes in a way that matters, we will tell store owners by email before it applies.</p>
      </div>
    </section>
  );
}
