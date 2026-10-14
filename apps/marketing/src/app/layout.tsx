import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import "./marketing.css";
import "./site.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-jakarta", display: "swap" });
const hind = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-hind", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "BizTrackBD: Online Store Software for Bangladesh",
    template: "%s | BizTrackBD",
  },
  description:
    "Launch your online store in a day. Sell with bKash, Nagad, and Cash on Delivery. Book Pathao and Steadfast pickups straight from each order with 0% sales commission.",
  keywords: [
    "online store bangladesh",
    "ecommerce website builder bangladesh",
    "bkash payment gateway",
    "nagad checkout",
    "steadfast courier integration",
    "pathao courier delivery",
    "cash on delivery return protection",
    "shopify alternative bangladesh",
    "অনলাইন শপ তৈরি",
  ],
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "en_BD",
    alternateLocale: ["bn_BD"],
    url: siteUrl,
    siteName: "BizTrackBD",
    title: "BizTrackBD: Online Store Software for Bangladesh",
    description:
      "Run your shop from your phone. Accept bKash, Nagad, and Cash on Delivery with zero commission. Automated Steadfast and Pathao courier pickups.",
  },
  twitter: {
    card: "summary_large_image",
    title: "BizTrackBD: Online Store Software for Bangladesh",
    description:
      "Run your shop from your phone. Accept bKash, Nagad, and Cash on Delivery with zero commission. Automated Steadfast and Pathao courier pickups.",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#FFFFFF" };

const globalJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "BizTrackBD",
      url: siteUrl,
      logo: `${siteUrl}/opengraph-image`,
      description: "eCommerce store software and courier automation platform built for Bangladesh.",
      parentOrganization: {
        "@type": "Organization",
        name: "The Digital Dude",
        url: "https://digitaldude.co.uk",
      },
      address: {
        "@type": "PostalAddress",
        addressLocality: "Dhaka",
        addressCountry: "BD",
      },
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "Customer Support",
        availableLanguage: ["English", "Bengali"],
      },
    },
    {
      "@type": "WebApplication",
      "@id": `${siteUrl}/#webapp`,
      name: "BizTrackBD Store Platform",
      applicationCategory: "BusinessApplication",
      operatingSystem: "All (Web, Android, iOS PWA)",
      offers: {
        "@type": "Offer",
        price: "699",
        priceCurrency: "BDT",
        priceValidUntil: "2027-12-31",
      },
      featureList: [
        "bKash and Nagad direct payment verification",
        "Pathao and Steadfast automated courier dispatch",
        "Cash on Delivery return fraud prevention",
        "Bangla SMS notifications",
        "0% sales commission",
        "Sub-second mobile storefront speed",
      ],
    },
  ],
};

import { PlatformTracker } from "@/components/platform-tracker";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${jakarta.variable} ${hind.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(globalJsonLd) }}
        />
      </head>
      <body>
        <PlatformTracker />
        <header className="site-head">
          <div className="wrap row-between">
            <Link href="/" className="brand" prefetch={false}>
              <svg width="30" height="30" viewBox="0 0 44 44" role="img" aria-label="BizTrackBD">
                <rect width="44" height="44" rx="12" fill="#5B4FE8" />
                <path d="M13 32V22M22 32V14M31 32V19" stroke="#fff" strokeWidth="4.4" strokeLinecap="round" />
              </svg>
              <span>BizTrack<span style={{ color: "#5B4FE8" }}>BD</span></span>
            </Link>
            <nav aria-label="Main" className="site-nav">
              <Link href="/features" prefetch={false}>Features</Link>
              <Link href="/templates" prefetch={false}>Templates</Link>
              <Link href="/compare" prefetch={false}>Why Us</Link>
              <Link href="/migrate" prefetch={false}>Migrate</Link>
              <Link href="/pricing" prefetch={false}>Pricing</Link>
              <Link href="/start" className="btn btn-primary btn-sm" prefetch={false}>Start free</Link>
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="site-foot">
          <div className="wrap">
            <div className="foot-cols">
              <div className="foot-brand-col">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="30" height="30" viewBox="0 0 44 44" role="img" aria-label="BizTrackBD">
                    <rect width="44" height="44" rx="12" fill="#5B4FE8" />
                    <path d="M13 32V22M22 32V14M31 32V19" stroke="#fff" strokeWidth="4.4" strokeLinecap="round" />
                  </svg>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    BizTrack<span style={{ color: "#A9A2FF" }}>BD</span>
                  </div>
                </div>
                <p>
                  Online store software built for Bangladeshi businesses. Sell with bKash, Nagad, and Cash on Delivery with zero commission. Direct Pathao and Steadfast pickup automation.
                </p>
                <div className="foot-sister-badge">
                  A product &amp; sister concern of <strong>The Digital Dude</strong>
                </div>
              </div>

              <div className="foot-col">
                <h4>Product</h4>
                <nav aria-label="Product Links">
                  <Link href="/templates" prefetch={false}>Templates</Link>
                  <Link href="/features" prefetch={false}>Features</Link>
                  <Link href="/compare" prefetch={false}>Why Us (vs Shopify)</Link>
                  <Link href="/migrate" prefetch={false}>Migrate from Shopify</Link>
                  <Link href="/pricing" prefetch={false}>Pricing</Link>
                </nav>
              </div>

              <div className="foot-col">
                <h4>Logistics &amp; Pay</h4>
                <nav aria-label="Integrations Links">
                  <Link href="/tools/courier-fraud-checker" prefetch={false}>Free Fraud Checker API</Link>
                  <Link href="/couriers#steadfast" prefetch={false}>Steadfast Automation</Link>
                  <Link href="/couriers#pathao" prefetch={false}>Pathao Delivery</Link>
                  <Link href="/couriers#redx" prefetch={false}>RedX Integration</Link>
                  <Link href="/couriers" prefetch={false}>COD Return Shield</Link>
                </nav>
              </div>

              <div className="foot-col">
                <h4>Company</h4>
                <nav aria-label="Company Links">
                  <a href="https://digitaldude.co.uk" target="_blank" rel="noopener noreferrer">
                    The Digital Dude ↗
                  </a>
                  <Link href="/contact" prefetch={false}>Contact Support</Link>
                  <Link href="/privacy" prefetch={false}>Privacy Policy</Link>
                  <Link href="/terms" prefetch={false}>Terms of Service</Link>
                </nav>
              </div>
            </div>

            <div className="foot-bottom">
              <div style={{ flexGrow: 1 }}>
                © 2026 BizTrackBD. A product &amp; sister concern of{" "}
                <a href="https://digitaldude.co.uk" target="_blank" rel="noopener noreferrer">
                  The Digital Dude (digitaldude.co.uk)
                </a>
                .
              </div>
              <div>Dhaka, Bangladesh · London, UK</div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
