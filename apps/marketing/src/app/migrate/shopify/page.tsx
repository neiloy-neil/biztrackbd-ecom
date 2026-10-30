import { getContact } from "@/lib/contact";
import type { Metadata } from "next";
import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";

export const metadata: Metadata = {
  title: "Migrate from Shopify to BizTrackBD, No Downtime",
  description:
    "Move your Bangladeshi store from Shopify to BizTrackBD step by step. Keep your domain, photos and variants; drop USD fees and 2% commissions.",
  alternates: {
    canonical: "https://biztrack.bd/migrate/shopify",
  },
};

const MIGRATION_MATRIX = [
  {
    asset: "Product Titles, Descriptions & Prices",
    status: "Automatic (100%)",
    badge: "AUTOMATIC",
    detail: "Directly imported from Shopify products CSV export with zero re-formatting.",
  },
  {
    asset: "Multi-Variant Matrices (Sizes, Colors, SKUs)",
    status: "Automatic (100%)",
    badge: "AUTOMATIC",
    detail: "All size, color, SKU barcodes, and stock levels map automatically.",
  },
  {
    asset: "High-Resolution Product Photos",
    status: "Automatic (Mirrored)",
    badge: "AUTOMATIC",
    detail: "BizTrackBD mirrors your image URLs to resilient media storage so photos never 404 even after closing Shopify.",
  },
  {
    asset: "Custom Domain (yourbrand.com)",
    status: "Assisted (0s Downtime)",
    badge: "ASSISTED",
    detail: "Simply update your DNS CNAME record. Automatic SSL certificate provisioned in seconds.",
  },
  {
    asset: "Meta Pixel & Conversions API (CAPI)",
    status: "Assisted (Token Copy)",
    badge: "ASSISTED",
    detail: "Paste your Meta Pixel ID and Access Token. Server-side CAPI tracking activates immediately.",
  },
  {
    asset: "Saved Customer Passwords & Credit Cards",
    status: "Cannot Migrate",
    badge: "HELD BY SHOPIFY",
    detail: "PCI security standards prohibit exporting card numbers. Bangladeshi buyers checkout friction-free via COD and bKash without passwords.",
  },
  {
    asset: "Proprietary Shopify Liquid Theme Code",
    status: "Cannot Migrate",
    badge: "REPLACED BY NEXT.JS",
    detail: "Liquid is replaced by ultra-fast, server-rendered Next.js edge storefronts that load in under 0.8 seconds on local 4G networks.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Export Catalog from Shopify Admin",
    time: "2 Minutes",
    description:
      "Log into your Shopify admin, navigate to Products → Export, and select 'All products' in CSV format. Download the file. No spreadsheet editing or column renaming is necessary.",
    tips: "Ensure all published products and hidden drafts are exported if you want complete catalog parity.",
  },
  {
    number: "02",
    title: "1-Click Catalog Import & Image Mirroring",
    time: "3 Minutes",
    description:
      "In your BizTrackBD admin desk, go to Products → Import → Shopify CSV. Upload your exported file. Our background worker imports your items, generates variant combinations, and downloads your product photos to our high-speed edge CDN.",
    tips: "Images are mirrored automatically so you can safely terminate your Shopify account later without broken image links.",
  },
  {
    number: "03",
    title: "Configure bKash, Nagad & Courier APIs",
    time: "5 Minutes",
    description:
      "Enter your Steadfast or Pathao API keys and your personal or merchant bKash/Nagad wallet numbers in Settings. Test your automatic dispatch rules and set up your Bangla SMS confirmation templates.",
    tips: "Unlike Shopify, no third-party monthly paid apps are required for courier booking or wallet verification.",
  },
  {
    number: "04",
    title: "Zero-Downtime DNS Pointing",
    time: "5 Minutes",
    description:
      "Update your domain DNS (at Cloudflare, Namecheap, or GoDaddy) to point the CNAME record to BizTrackBD edge servers. Your old Shopify store continues serving shoppers until DNS propagates globally with 0 seconds of store downtime.",
    tips: "Free zero-configuration SSL certificates are generated automatically within 60 seconds of DNS detection.",
  },
];

const SHOPIFY_MIGRATE_FAQS = [
  {
    q: "Will my store experience downtime while migrating from Shopify?",
    a: "No. The migration is completely zero-downtime. Your Shopify store remains active and accepting orders until you update your DNS records. As DNS caches propagate worldwide, traffic transitions seamlessly to your new BizTrackBD storefront with zero gap in availability.",
  },
  {
    q: "What if I want to rollback to Shopify after switching?",
    a: "We offer a 2-Minute Rollback Guarantee. If for any reason you are not completely satisfied, simply change your DNS record back to Shopify's IP (`23.227.38.65`). Your original Shopify store remains unchanged until you deliberately choose to cancel your subscription.",
  },
  {
    q: "Will my product photos break when I cancel my Shopify subscription?",
    a: "No. When you upload your Shopify CSV to BizTrackBD, our ingestion engine downloads and mirrors all high-resolution images to our dedicated media cloud. Your images will continue loading fast even after your Shopify account is closed.",
  },
  {
    q: "How much money does a typical Bangladesh store save after switching from Shopify?",
    a: "An average online store processing 400 orders per month saves approximately ৳ 8,000 to ৳ 14,000 every month. This includes eliminating Shopify's base USD subscription, foreign card VAT (15%), 2.0% third-party gateway penalty fees, and third-party apps for COD OTP and courier bridges.",
  },
  {
    q: "Can the BizTrackBD team handle this migration for me?",
    a: "Yes! We provide 100% free concierge migration assistance. Our Dhaka engineering team will connect with you via WhatsApp or phone, verify your CSV file, configure your courier API keys, and assist with DNS records at no cost.",
  },
];

export default async function MigrateShopifyPage() {
  const contact = await getContact();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Migrate from Shopify to BizTrackBD with Zero Downtime",
    description:
      "Step-by-step guide to migrating a Bangladeshi eCommerce store from Shopify to BizTrackBD, preserving custom domains, products, and search rankings.",
    totalTime: "PT15M",
    step: STEPS.map((step, idx) => ({
      "@type": "HowToStep",
      position: idx + 1,
      name: step.title,
      text: step.description,
    })),
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Header */}
      <section className="border-b border-[var(--border)] bg-[var(--surface-subtle)] py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Link
              href="/migrate"
              className="text-xs font-mono text-[var(--muted)] hover:text-[var(--foreground)] transition"
            >
              ← Migration Hub
            </Link>
            <span className="text-xs text-[var(--border)]">/</span>
            <span className="stamp stamp-paid text-[10px]">SHOPIFY PLAYBOOK</span>
            <span className="text-xs font-mono text-[var(--muted)]">Zero Downtime Guaranteed</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[var(--foreground)] max-w-4xl">
            How to Migrate from Shopify to BizTrackBD with Zero Downtime
          </h1>
          <p className="mt-4 text-base sm:text-lg text-[var(--muted)] max-w-3xl leading-relaxed">
            Eliminate $39 USD monthly card fees, 2% third-party gateway cuts, and fragile courier bridges. Switch your catalog, images, and custom domain to BizTrackBD in under 15 minutes.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/start"
              className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-xs sm:text-sm font-semibold text-[var(--primary-foreground)] shadow-xs hover:opacity-95 transition"
            >
              Start Free Migration Trial
            </Link>
            <a
              href={`${contact.whatsappBase}?text=Hi%2C%20I%20want%20help%20migrating%20my%20store%20from%20Shopify%20to%20BizTrackBD`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-xs sm:text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-subtle)] transition"
            >
              Request Free WhatsApp Concierge Help ↗
            </a>
          </div>
        </div>
      </section>

      {/* 2-Minute Rollback Guarantee Banner */}
      <section className="py-8 border-b border-[var(--border)] bg-emerald-500/5">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="stamp stamp-paid text-xs">SAFETY PROMISE</span>
              <div className="text-sm font-medium text-[var(--foreground)]">
                <strong>2-Minute Rollback Guarantee:</strong> Your existing Shopify store stays live. If you are not 100% happy with BizTrackBD, simply change your DNS back in 2 minutes. Zero risk.
              </div>
            </div>
            <Link
              href="/compare/shopify"
              className="text-xs font-bold text-[var(--primary)] hover:underline shrink-0"
            >
              Read Shopify Comparison →
            </Link>
          </div>
        </div>
      </section>

      {/* Technical Migration Matrix: What Migrates vs What Cannot */}
      <section className="py-16 border-b border-[var(--border)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-8">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--primary)] font-bold">
              TECHNICAL AUDIT
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)] mt-1">
              What Migrates Automatically vs What Cannot
            </h2>
            <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">
              Complete transparency on catalog portability, images, domain handling, and security constraints.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
                  <th className="p-4 font-bold text-[var(--foreground)]">Data Asset / Feature</th>
                  <th className="p-4 font-bold text-[var(--primary)]">Migration Status</th>
                  <th className="p-4 font-semibold text-[var(--foreground)]">Technical Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] font-sans">
                {MIGRATION_MATRIX.map((row, idx) => (
                  <tr key={idx} className="hover:bg-[var(--surface-subtle)] transition">
                    <td className="p-4 font-bold text-[var(--foreground)]">{row.asset}</td>
                    <td className="p-4">
                      <span className="stamp stamp-review text-[10px]">{row.badge}</span>
                      <div className="text-xs font-semibold text-[var(--foreground)] mt-1">{row.status}</div>
                    </td>
                    <td className="p-4 text-[var(--muted)] leading-relaxed">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 4-Step Playbook Sequence */}
      <section className="py-16 border-b border-[var(--border)] bg-[var(--surface-subtle)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-10">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--primary)] font-bold">
              STEP-BY-STEP PLAYBOOK
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)] mt-1">
              The 4-Step Zero-Downtime Migration Process
            </h2>
            <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">
              Estimated total execution time: 15 minutes.
            </p>
          </div>

          <div className="space-y-6">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8 shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[var(--border)]">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base font-bold text-[var(--primary)]">
                      STEP {step.number}
                    </span>
                    <h3 className="text-lg font-bold text-[var(--foreground)]">{step.title}</h3>
                  </div>
                  <span className="stamp stamp-paid text-[10px] self-start sm:self-auto font-mono">
                    {step.time}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[var(--foreground)] mt-4 leading-relaxed">
                  {step.description}
                </p>

                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3 text-xs text-[var(--muted)]">
                  <strong className="text-[var(--foreground)]">Pro Tip: </strong>
                  {step.tips}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free Concierge Migration Assistance Box */}
      <section className="py-16 border-b border-[var(--border)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="rounded-2xl border-2 border-[var(--primary)] bg-[var(--surface)] p-6 md:p-8 shadow-xs">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <span className="stamp stamp-paid text-[10px]">FREE CONCIERGE SERVICE</span>
                <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)] mt-2">
                  Prefer our Dhaka engineering team to handle it for you?
                </h2>
                <p className="text-xs sm:text-sm text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
                  We migrate your complete catalog, verify high-resolution photo mirroring, configure your Steadfast/Pathao courier credentials, and manage DNS pointing with zero charge and zero store downtime.
                </p>
              </div>

              <div className="shrink-0 flex flex-col gap-2">
                <a
                  href={`${contact.whatsappBase}?text=Hi%2C%20I%20want%20concierge%20migration%20from%20Shopify%20to%20BizTrackBD`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-xs font-bold text-[var(--primary-foreground)] text-center shadow-xs hover:opacity-95 transition"
                >
                  Message on WhatsApp
                </a>
                <Link
                  href="/contact"
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-xs font-semibold text-[var(--foreground)] text-center hover:bg-[var(--surface-subtle)] transition"
                >
                  Submit Migration Request
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-[var(--foreground)]">
              Shopify Migration FAQs
            </h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              Practical answers to questions about domain propagation, SEO rankings, and photos.
            </p>
          </div>

          <div className="space-y-4">
            {SHOPIFY_MIGRATE_FAQS.map((faq, idx) => (
              <div key={idx} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <h3 className="text-sm font-bold text-[var(--foreground)]">{faq.q}</h3>
                <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <div className="text-sm font-medium text-[var(--foreground)] mb-3">
              Ready to eliminate USD credit card fees and switch to BizTrackBD?
            </div>
            <div className="flex justify-center gap-3">
              <Link
                href="/start"
                className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-xs font-bold text-[var(--primary-foreground)] shadow-xs hover:opacity-95 transition"
              >
                Start 14-Day Free Trial
              </Link>
              <a
                href={demoAdminUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-subtle)] transition"
              >
                Test Live Demo Desk
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
