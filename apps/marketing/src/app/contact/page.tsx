import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Contact", description: "How to reach BizTrackBD for help, billing questions or to ask about your data." };

/** Support details come from the environment, so nothing personal is written into the page. */
export default function Contact() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  const whatsapp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  const admin = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001";
  return (
    <section className="block">
      <div className="wrap prose" data-testid="contact">
        <span className="eyebrow">Contact</span>
        <h1>We are here to help</h1>
        <p>The quickest way to get help is from inside your store: <a href={`${admin}/support`}>open Help in your admin</a> and tell us what happened. We see which store you are in, so you do not need to explain your setup.</p>
        {(email || whatsapp) && (
          <ul>
            {whatsapp && <li>WhatsApp: <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} rel="noopener noreferrer">{whatsapp}</a></li>}
            {email && <li>Email: <a href={`mailto:${email}`}>{email}</a></li>}
          </ul>
        )}
        <h2>Billing and payments</h2>
        <p>Sent your plan payment and it is not showing yet? Open <b>Plan and usage</b> in your admin: you will see whether it is waiting to be checked. We aim to check payments within a few working hours.</p>
        <h2>Your data</h2>
        <p>To see, export or delete your data, write to us from your admin or at the address above, from the email your store uses. See the <Link href="/privacy" prefetch={false}>privacy page</Link>.</p>
        <h2>Thinking about opening a store?</h2>
        <p><Link href="/start" prefetch={false}>Start the free trial</Link>, or look around first with <a href={`${admin}/demo`}>the demo admin</a>.</p>
      </div>
    </section>
  );
}
