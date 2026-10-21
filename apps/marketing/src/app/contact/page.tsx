import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "./contact-form";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: "Contact & Support: Direct WhatsApp & Dhaka Office Assistance",
  description:
    "Get direct human support for your online store. Talk with our Dhaka team on WhatsApp, get help with Steadfast/Pathao API setup, bKash checkout, or Shopify migration.",
  alternates: {
    canonical: `${siteUrl}/contact`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/contact`,
    siteName: "BizTrackBD",
    title: "Contact & Support: Direct WhatsApp & Dhaka Office Assistance",
    description: "Get direct human assistance for courier setup, bKash payments, or migrations.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "BizTrackBD Contact" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact & Support: Direct WhatsApp & Dhaka Office Assistance",
    description: "Connect with our local team in Dhaka for setup and platform support.",
    images: [`${siteUrl}/opengraph-image`],
  },
};
const whatsappNumber = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "+880 1711 000000";
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@biztrack.bd";

const contactJsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "BizTrackBD Contact & Support",
  url: `${siteUrl}/contact`,
  description: "Direct merchant support and inquiries for BizTrackBD eCommerce software.",
  mainEntity: {
    "@type": "Organization",
    name: "BizTrackBD",
    parentOrganization: {
      "@type": "Organization",
      name: "The Digital Dude",
      url: "https://digitaldude.co.uk",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: whatsappNumber,
        contactType: "Customer Support & WhatsApp Desk",
        areaServed: "BD",
        availableLanguage: ["Bengali", "English"],
      },
      {
        "@type": "ContactPoint",
        email: supportEmail,
        contactType: "Technical & Billing Desk",
        areaServed: "BD",
        availableLanguage: ["Bengali", "English"],
      },
    ],
  },
};

const SUPPORT_FAQS = [
  {
    q: "How fast are manual bKash and Nagad plan payments verified?",
    a: "When you send your plan payment via bKash or Nagad and submit your TrxID in your admin desk, our Dhaka team verifies it within 2–4 working hours (usually within 30 minutes during daytime). Your store remains fully active while verification takes place.",
  },
  {
    q: "Can someone help me connect my Steadfast or Pathao courier API keys?",
    a: "Yes! If you have trouble finding your API key or secret in your Steadfast or Pathao courier merchant dashboard, simply message us on WhatsApp. We will send you step-by-step screenshots or walk you through the connection.",
  },
  {
    q: "How do I migrate my existing products and customers from Shopify?",
    a: "Export your product CSV catalog from your Shopify admin. You can import that CSV directly into BizTrackBD, and all your titles, prices, descriptions, and images transfer over cleanly without re-typing.",
  },
  {
    q: "Do you take any cut or percentage commission from my orders?",
    a: "Never. BizTrackBD charges 0% commission on your sales. Customer payments go straight into your personal or merchant bKash/Nagad wallet or courier cash-on-delivery balance.",
  },
];

export default function ContactPage() {
  const cleanPhone = whatsappNumber.replace(/\D/g, "");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }}
      />

      <section className="block">
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 48px" }}>
            <span className="eyebrow">Support · Direct in Dhaka</span>
            <h1
              style={{
                fontSize: "clamp(34px, 5.5vw, 50px)",
                letterSpacing: "-1.2px",
                lineHeight: 1.1,
                fontWeight: 800,
              }}
            >
              Real support from people who know Bangladesh eCommerce
            </h1>
            <p
              className="lead"
              style={{
                marginTop: 16,
                fontSize: 18,
                color: "var(--ink-2)",
                lineHeight: 1.6,
              }}
            >
              No generic automated chatbots that waste your time. Get direct human support for store setup, Steadfast and Pathao courier troubleshooting, bKash verification, or Shopify migration.
            </p>
          </div>

          {/* 3 Support Channels Grid */}
          <div className="grid g3" style={{ gap: 24, marginBottom: 56 }}>
            {/* WhatsApp Card */}
            <div
              className="card"
              style={{
                padding: "28px 24px",
                borderRadius: 16,
                border: "1.5px solid var(--line)",
                background: "#FFFFFF",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "#E3F1EA",
                  color: "#11795A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 800,
                }}
              >
                💬
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                Direct WhatsApp Desk
              </h3>
              <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55, margin: 0 }}>
                Quickest way to reach us. For live order questions, courier connection bugs, or general guidance.
              </p>
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
                ⏱ Typical reply: <strong>under 20 minutes</strong><br />
                🕒 Hours: 10:00 AM – 9:00 PM (Daily)
              </div>
              <a
                href={`https://wa.me/${cleanPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
                style={{
                  marginTop: "auto",
                  paddingTop: 10,
                  background: "#11795A",
                  borderRadius: 20,
                }}
              >
                Chat on WhatsApp ↗
              </a>
            </div>

            {/* Email Card */}
            <div
              className="card"
              style={{
                padding: "28px 24px",
                borderRadius: 16,
                border: "1.5px solid var(--line)",
                background: "#FFFFFF",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "var(--tint)",
                  color: "var(--brand)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 800,
                }}
              >
                ✉️
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                Email &amp; Billing Desk
              </h3>
              <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55, margin: 0 }}>
                For official billing receipts, custom domain setup, CSV bulk catalog imports, and data requests.
              </p>
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
                ⏱ Typical reply: <strong>same business day</strong><br />
                📬 <strong style={{ color: "var(--ink)" }}>{supportEmail}</strong>
              </div>
              <a
                href={`mailto:${supportEmail}`}
                className="btn btn-secondary btn-sm"
                style={{ marginTop: "auto", borderRadius: 20 }}
              >
                Send an email ↗
              </a>
            </div>

            {/* Dhaka Office & Sister Concern Card */}
            <div
              className="card"
              style={{
                padding: "28px 24px",
                borderRadius: 16,
                border: "1.5px solid var(--line)",
                background: "#FFFFFF",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "#FDF1CC",
                  color: "#946300",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  fontWeight: 800,
                }}
              >
                🏢
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                Dhaka Office &amp; Group
              </h3>
              <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55, margin: 0 }}>
                BizTrackBD is a product &amp; sister concern of <strong>The Digital Dude</strong>. Consultations available for high-volume enterprise stores.
              </p>
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
                📍 Dhaka, Bangladesh<br />
                🌐 London, UK &amp; Dhaka, BD
              </div>
              <a
                href="https://digitaldude.co.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: "auto", borderRadius: 20 }}
              >
                Visit The Digital Dude ↗
              </a>
            </div>
          </div>

          {/* Form and Context Split */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 40,
              alignItems: "start",
              marginBottom: 64,
            }}
          >
            <div>
              <span className="eyebrow">Quick Inquiry</span>
              <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.6px", marginBottom: 12 }}>
                Have a question before starting your trial?
              </h2>
              <p style={{ fontSize: 15.5, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 20 }}>
                Whether you need help choosing between templates, want to know if your specific courier is supported, or have a custom product catalog with variants, write to us and we will give you a clear, honest answer.
              </p>
              <div
                style={{
                  padding: 20,
                  background: "var(--soft)",
                  borderRadius: 12,
                  border: "1px solid var(--line)",
                }}
              >
                <b style={{ color: "var(--ink)", display: "block", marginBottom: 6 }}>
                  Already have an active store?
                </b>
                <p style={{ fontSize: 14, color: "var(--ink-2)", margin: 0, lineHeight: 1.55 }}>
                  The quickest way to get help is directly from inside your store: log into your admin desk, click <b>Help &amp; Support</b>, and send your issue. Our engineers immediately see your order logs and setup.
                </p>
                <div style={{ marginTop: 14 }}>
                  <Link href="/start" className="link" prefetch={false} style={{ fontWeight: 700 }}>
                    Open your store trial (14 days free) →
                  </Link>
                </div>
              </div>
            </div>

            <div>
              <ContactForm />
            </div>
          </div>

          {/* Support FAQs */}
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 48 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, textAlign: "center", marginBottom: 28 }}>
              Common Support Questions
            </h2>
            <dl className="faq-list">
              {SUPPORT_FAQS.map((faq) => (
                <div key={faq.q}>
                  <dt>{faq.q}</dt>
                  <dd>{faq.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}
