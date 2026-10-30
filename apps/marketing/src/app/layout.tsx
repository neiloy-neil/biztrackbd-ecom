import type { Metadata, Viewport } from "next";
import { Baloo_Da_2, Hind_Siliguri } from "next/font/google";
import Link from "next/link";
import { BrandLockup } from "@/components/brand-logo";
import { ContactIcon } from "@biztrackbd/ui";
import { getContact, type Contact } from "@/lib/contact";
import "./marketing.css";
import "./site.css";

const baloo = Baloo_Da_2({ subsets: ["bengali", "latin"], weight: ["800"], variable: "--font-baloo", display: "swap" });
const hind = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "600"], variable: "--font-hind", display: "swap" });

import { getPlatformSeoConfig, getPlatformSiteVerificationCode } from "@biztrackbd/core";

const siteUrl =
  process.env.NEXT_PUBLIC_MARKETING_URL ??
  (process.env.NODE_ENV === "production" ? "https://biztrack.bd" : "http://localhost:3002");

// Pages are cached and rebuilt in the background every 5 minutes, so SEO and contact settings saved in Platform Admin show up within that
// time. Pages that read the request (search parameters) or set their own force-dynamic stay dynamic.
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const seoConfig = await getPlatformSeoConfig().catch(() => ({
    title: "BizTrackBD: Online Store Software for Bangladesh",
    description:
      "Launch your online store in a day. Sell with bKash, Nagad, and Cash on Delivery. Book Pathao and Steadfast pickups straight from each order with 0% sales commission.",
    keywords:
      "online store bangladesh, ecommerce website builder bangladesh, bkash payment gateway, nagad checkout, steadfast courier integration, pathao courier delivery, cash on delivery return protection, shopify alternative bangladesh, অনলাইন শপ তৈরি",
    ogImageUrl: `${siteUrl}/opengraph-image`,
    sitemapUrl: `${siteUrl}/sitemap.xml`,
    robotsUrl: `${siteUrl}/robots.txt`,
    siteVerificationCode: process.env.GOOGLE_SITE_VERIFICATION || null,
    updatedAt: null,
    updatedBy: null,
  }));
  const tokenSet = new Set<string>();

  const siteCode = seoConfig.siteVerificationCode || (await getPlatformSiteVerificationCode().catch(() => null));
  if (siteCode) {
    tokenSet.add(siteCode);
    const withoutExt = siteCode.replace(/\.html$/i, "");
    tokenSet.add(withoutExt);
    if (withoutExt.toLowerCase().startsWith("google")) {
      tokenSet.add(withoutExt.slice(6));
    }
  }

  // Ensure user's verified token is present as fallback
  tokenSet.add("google0668054f248577b1");
  tokenSet.add("0668054f248577b1");

  const tokens = Array.from(tokenSet).filter(Boolean);
  const keywordsList = (seoConfig.keywords || "").split(",").map((k) => k.trim()).filter(Boolean);

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: seoConfig.title,
      template: "%s | BizTrackBD",
    },
    description: seoConfig.description,
    keywords: keywordsList,
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", sizes: "32x32" },
      ],
      shortcut: "/favicon.ico",
      apple: "/apple-touch-icon.png",
    },
    openGraph: {
      type: "website",
      locale: "en_BD",
      alternateLocale: ["bn_BD"],
      url: siteUrl,
      siteName: "BizTrackBD",
      title: seoConfig.title,
      description: seoConfig.description,
      images: [
        {
          url: seoConfig.ogImageUrl,
          width: 1200,
          height: 630,
          alt: seoConfig.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: seoConfig.title,
      description: seoConfig.description,
      images: [seoConfig.ogImageUrl],
    },
    verification: tokens.length > 0 ? { google: tokens } : undefined,
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0B4D3B" };

const buildGlobalJsonLd = (CONTACT: Contact) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "BizTrackBD",
      url: siteUrl,
      logo: `${siteUrl}/logo.png`,
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
      email: CONTACT.email,
      telephone: CONTACT.phoneTel,
      sameAs: [CONTACT.facebook, CONTACT.instagram],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "Customer Support",
        email: CONTACT.email,
        telephone: CONTACT.phoneTel,
        availableLanguage: ["English", "Bengali"],
      },
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "BizTrackBD",
      publisher: {
        "@id": `${siteUrl}/#organization`,
      },
      inLanguage: "en-BD",
    },
  ],
});

import { PlatformTracker } from "@/components/platform-tracker";
import { NativeAnalyticsTracker } from "@/components/native-analytics-tracker";
import { PostHogProvider } from "@/components/posthog-provider";
import { SiteNavigation } from "@/components/site-navigation";
import { DoubleSubmitGuard } from "@biztrackbd/ui";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const CONTACT = await getContact();
  const whatsappLink = CONTACT.whatsappLink;
  const globalJsonLd = buildGlobalJsonLd(CONTACT);
  const googleVerification = await getPlatformSiteVerificationCode().catch(() => null);
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${baloo.variable} ${hind.variable}`}>
      <head>
        {googleVerification && (
          <meta name="google-site-verification" content={googleVerification} />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(globalJsonLd) }}
        />
      </head>
      <body>
        <PostHogProvider>
          <DoubleSubmitGuard />
        <a className="skip-link" href="#main">Skip to main content</a>
        <PlatformTracker />
        <NativeAnalyticsTracker />
        <header className="site-head">
          <div className="wrap row-between">
            <Link href="/" className="brand" prefetch={false}>
              <BrandLockup />
            </Link>

            <SiteNavigation />
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="site-foot">
          <div className="wrap">
            <div className="foot-cols">
              <div className="foot-brand-col">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <BrandLockup tone="dark" />
                </div>
                <p>
                  The Commerce and Business Operating Platform for Bangladesh. Sell products, verify payments, protect against fake COD returns, and capture high-value customer inquiries with 0% sales commission.
                </p>
                <div className="foot-social" aria-label="BizTrackBD on social media">
                  <a href={CONTACT.facebook} target="_blank" rel="noopener noreferrer" aria-label="BizTrackBD on Facebook"><ContactIcon name="facebook" size={18} /></a>
                  <a href={CONTACT.instagram} target="_blank" rel="noopener noreferrer" aria-label="BizTrackBD on Instagram"><ContactIcon name="instagram" size={18} /></a>
                  <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" aria-label="Chat with BizTrackBD on WhatsApp"><ContactIcon name="whatsapp" size={18} /></a>
                  <a href={`mailto:${CONTACT.email}`} aria-label="Email BizTrackBD"><ContactIcon name="email" size={18} /></a>
                </div>
                <div className="foot-sister-badge">
                  A product &amp; sister concern of <strong>The Digital Dude</strong>
                </div>
              </div>

              <div className="foot-col">
                <h4>Platform</h4>
                <nav aria-label="Product Links">
                  <Link href="/product" prefetch={false}>Platform Architecture</Link>
                  <Link href="/features" prefetch={false}>Commerce Overview</Link>
                  <Link href="/business" prefetch={false}>Business &amp; Services</Link>
                  <Link href="/templates" prefetch={false}>Storefront Templates</Link>
                  <Link href="/business/templates" prefetch={false}>Business Templates</Link>
                  <Link href="/compare" prefetch={false}>Compare Platforms</Link>
                  <Link href="/migrate" prefetch={false}>Migrate from Shopify</Link>
                  <Link href="/pricing" prefetch={false}>Transparent Pricing</Link>
                </nav>
              </div>

              <div className="foot-col">
                <h4>Logistics &amp; Pay</h4>
                <nav aria-label="Integrations Links">
                  <Link href="/tools/courier-fraud-checker" prefetch={false}>Free Courier Fraud Checker</Link>
                  <Link href="/couriers#steadfast" prefetch={false}>Steadfast Automation</Link>
                  <Link href="/couriers#pathao" prefetch={false}>Pathao Delivery</Link>
                  <Link href="/couriers#redx" prefetch={false}>RedX Integration</Link>
                  <Link href="/couriers" prefetch={false}>COD Return Risk Shield</Link>
                </nav>
              </div>

              <div className="foot-col foot-contact">
                <h4>Get in touch</h4>
                <ul className="contact-cards" aria-label="Contact details">
                  <li>
                    <a href={`mailto:${CONTACT.email}`}>
                      <span className="cc-icon"><ContactIcon name="email" size={20} /></span>
                      <span className="cc-text"><small>Email us</small><strong>{CONTACT.email}</strong></span>
                    </a>
                  </li>
                  <li>
                    <a href={`tel:${CONTACT.phoneTel}`}>
                      <span className="cc-icon"><ContactIcon name="phone" size={20} /></span>
                      <span className="cc-text"><small>Call us</small><strong>{CONTACT.phoneDisplay}</strong></span>
                    </a>
                  </li>
                  <li>
                    <a href={whatsappLink()} target="_blank" rel="noopener noreferrer">
                      <span className="cc-icon"><ContactIcon name="whatsapp" size={20} /></span>
                      <span className="cc-text"><small>WhatsApp</small><strong>{CONTACT.whatsappDisplay}</strong></span>
                    </a>
                  </li>
                </ul>
                <div className="contact-pills">
                  <a href={CONTACT.facebook} target="_blank" rel="noopener noreferrer"><ContactIcon name="facebook" size={16} /><span>Facebook</span></a>
                  <a href={CONTACT.instagram} target="_blank" rel="noopener noreferrer"><ContactIcon name="instagram" size={16} /><span>Instagram</span></a>
                </div>
              </div>

              <div className="foot-col">
                <h4>Company &amp; Trust</h4>
                <nav aria-label="Company Links">
                  <a href="https://digitaldude.co.uk" target="_blank" rel="noopener noreferrer">
                    The Digital Dude ↗
                  </a>
                  <Link href="/security" prefetch={false}>Security Architecture</Link>
                  <Link href="/data-ownership" prefetch={false}>Zero Lock-In Charter</Link>
                  <Link href="/demo" prefetch={false}>Live Sandbox Demos</Link>
                  <Link href="/blog" prefetch={false}>Guides</Link>
                  <Link href="/about" prefetch={false}>About</Link>
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
              <div>Dhaka, Bangladesh · London, UK · Honest Taka Pricing</div>
            </div>
          </div>
        </footer>
        </PostHogProvider>
      </body>
    </html>
  );
}
