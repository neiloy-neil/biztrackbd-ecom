import type { Metadata } from "next";
import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";

export const metadata: Metadata = {
  title: "How to Migrate from WooCommerce to BizTrackBD with Zero Downtime (Oct 2026)",
  description:
    "Step-by-step playbook to switch your Bangladeshi online store from WooCommerce to BizTrackBD. Stop 502 Bad Gateway crashes during Eid sales, cancel expensive plugin renewals, and automate courier dispatch.",
  alternates: {
    canonical: "https://biztrack.bd/migrate/woocommerce",
  },
};

const MIGRATION_MATRIX = [
  {
    asset: "Product Titles, Categories & Pricing",
    status: "Automatic (100%)",
    badge: "AUTOMATIC",
    detail: "Imported seamlessly from your WooCommerce product CSV export.",
  },
  {
    asset: "Variable Products (Sizes, Colors, Attributes)",
    status: "Automatic (100%)",
    badge: "AUTOMATIC",
    detail: "WooCommerce variations, stock levels, and SKUs map automatically to BizTrackBD variant matrices.",
  },
  {
    asset: "Product Images & Media Gallery",
    status: "Automatic (Mirrored)",
    badge: "AUTOMATIC",
    detail: "Our background ingestion mirrors photos to high-speed CDN storage so you can shut down your WordPress media server.",
  },
  {
    asset: "Custom Domain (yourbrand.com)",
    status: "Assisted (0s Downtime)",
    badge: "ASSISTED",
    detail: "Point your DNS CNAME record to BizTrackBD. Automatic zero-config SSL certificate issued in seconds.",
  },
  {
    asset: "bKash, Nagad & Couriers (Steadfast, Pathao)",
    status: "Native Integration",
    badge: "NATIVE CORE",
    detail: "Replace fragile third-party WordPress plugins with direct, native API integrations built into BizTrackBD.",
  },
  {
    asset: "Bloated WordPress Plugins & Database Cache",
    status: "Permanently Eliminated",
    badge: "NO MORE BUGS",
    detail: "Say goodbye to 20+ plugins (caching, security, bKash, courier connectors) and database lockups.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Export Products from WooCommerce Admin",
    time: "2 Minutes",
    description:
      "In your WordPress dashboard, navigate to WooCommerce → Products → Export. Check 'Export all columns' and 'Export all products', then generate your CSV file.",
    tips: "No need to edit the exported CSV file; BizTrackBD's importer is specifically calibrated for WooCommerce column headers.",
  },
  {
    number: "02",
    title: "1-Click Catalog Import & Image Mirroring",
    time: "3 Minutes",
    description:
      "In your BizTrackBD admin desk, go to Products → Import → WooCommerce CSV. Upload your file. Our system parses variations, prices, descriptions, and mirrors product photos to edge media storage.",
    tips: "Image mirroring ensures that when you terminate your WordPress hosting account, your store images will never 404.",
  },
  {
    number: "03",
    title: "Configure bKash Wallet & Courier API Tokens",
    time: "5 Minutes",
    description:
      "Connect your Steadfast or Pathao API keys in Settings. Add your bKash/Nagad wallet numbers for customer checkout. Unlike WordPress, no external plugin licenses or annual renewal fees are required.",
    tips: "Enable the built-in COD fraud checker to automatically screen customers against national courier refusal databases.",
  },
  {
    number: "04",
    title: "Point DNS CNAME & Say Goodbye to 502 Crashes",
    time: "5 Minutes",
    description:
      "Update your domain CNAME record at your DNS provider (Cloudflare, cPanel, Namecheap) to BizTrackBD. Traffic transitions instantly with zero seconds of store downtime.",
    tips: "Once DNS propagation is confirmed, you can safely cancel your expensive cloud VPS server and paid WordPress plugin renewals.",
  },
];

const WOO_MIGRATE_FAQS = [
  {
    q: "Will my store experience downtime while migrating from WooCommerce?",
    a: "No. Your WooCommerce website remains online and fully operational while you import your products and set up your BizTrackBD store. Once you update your domain DNS records, traffic moves seamlessly to BizTrackBD with zero downtime.",
  },
  {
    q: "What if I want to rollback to WooCommerce after switching?",
    a: "We offer a 2-Minute Rollback Guarantee. If you ever wish to return to your WooCommerce site, simply point your DNS records back to your existing VPS server IP address. Your WordPress installation remains untouched.",
  },
  {
    q: "How does BizTrackBD prevent the 502 Bad Gateway crashes we experienced during Eid sales?",
    a: "WooCommerce executes complex relational MySQL queries against `wp_posts` and `wp_postmeta` on every page visit and checkout. During high-budget Facebook ad campaigns, database locks cause server crashes. BizTrackBD runs on serverless edge architecture with dedicated multi-tenant isolation, effortlessly absorbing sudden traffic spikes without memory exhaustion.",
  },
  {
    q: "Do I still need to pay for annual WordPress plugin renewals?",
    a: "No. All essential Bangladesh ecommerce capabilities—including bKash/Nagad checkout with 1-tap TrxID verification, Steadfast/Pathao multi-courier dispatch, COD return fraud checking, and Meta CAPI server tracking—are built directly into the core platform.",
  },
  {
    q: "Can the BizTrackBD engineering team perform this migration for us?",
    a: "Yes! We offer 100% free concierge migration assistance. Our Dhaka team will connect with you via WhatsApp or phone, verify your WooCommerce CSV file, and manage DNS pointing with zero downtime.",
  },
];

export default function MigrateWooCommercePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Migrate from WooCommerce to BizTrackBD with Zero Downtime",
    description:
      "Step-by-step playbook to switch a Bangladeshi WooCommerce store to BizTrackBD, eliminating server crashes during flash sales and fragile plugin stacks.",
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
            <span className="stamp stamp-paid text-[10px]">WOOCOMMERCE PLAYBOOK</span>
            <span className="text-xs font-mono text-[var(--muted)]">Zero Downtime Guaranteed</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[var(--foreground)] max-w-4xl">
            How to Migrate from WooCommerce to BizTrackBD with Zero Downtime
          </h1>
          <p className="mt-4 text-base sm:text-lg text-[var(--muted)] max-w-3xl leading-relaxed">
            Eliminate server crashes during Eid flash sales, stop paying annual plugin license renewals, and automate your Steadfast and Pathao deliveries in under 15 minutes.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/start"
              className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-xs sm:text-sm font-semibold text-[var(--primary-foreground)] shadow-xs hover:opacity-95 transition"
            >
              Start Free Migration Trial
            </Link>
            <a
              href="https://wa.me/8801886675596?text=Hi%2C%20I%20want%20help%20migrating%20my%20store%20from%20WooCommerce%20to%20BizTrackBD"
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
                <strong>2-Minute Rollback Guarantee:</strong> Your WooCommerce VPS server remains untouched. If you are not completely satisfied, simply point your DNS back in 2 minutes. Zero risk.
              </div>
            </div>
            <Link
              href="/compare/woocommerce"
              className="text-xs font-bold text-[var(--primary)] hover:underline shrink-0"
            >
              Read WooCommerce Comparison →
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
              What Migrates from WordPress to BizTrackBD
            </h2>
            <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">
              Complete breakdown of catalog data, media assets, and plugin deprecations.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-subtle)]">
                  <th className="p-4 font-bold text-[var(--foreground)]">Asset / System Component</th>
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
              The 4-Step Zero-Downtime WooCommerce Switch
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

      {/* Free Concierge Migration Box */}
      <section className="py-16 border-b border-[var(--border)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="rounded-2xl border-2 border-[var(--primary)] bg-[var(--surface)] p-6 md:p-8 shadow-xs">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <span className="stamp stamp-paid text-[10px]">FREE CONCIERGE SERVICE</span>
                <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)] mt-2">
                  Want our Dhaka engineering team to handle your WordPress migration?
                </h2>
                <p className="text-xs sm:text-sm text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
                  We export your products, verify variant mappings, download and mirror images, and test your Steadfast/Pathao courier credentials with zero downtime.
                </p>
              </div>

              <div className="shrink-0 flex flex-col gap-2">
                <a
                  href="https://wa.me/8801886675596?text=Hi%2C%20I%20want%20concierge%20migration%20from%20WooCommerce%20to%20BizTrackBD"
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

      {/* FAQs */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-[var(--foreground)]">
              WooCommerce Migration FAQs
            </h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              Straightforward answers regarding database migration, photo safety, and server costs.
            </p>
          </div>

          <div className="space-y-4">
            {WOO_MIGRATE_FAQS.map((faq, idx) => (
              <div key={idx} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <h3 className="text-sm font-bold text-[var(--foreground)]">{faq.q}</h3>
                <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <div className="text-sm font-medium text-[var(--foreground)] mb-3">
              Ready to leave plugin conflicts and server crashes behind?
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
