import type { Metadata } from "next";
import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: "Security Architecture & Data Protection",
  description:
    "How BizTrackBD protects merchant business records, customer phone numbers, courier API secrets, and bKash credentials with strict multi-tenant isolation and AES-256 encryption.",
  alternates: {
    canonical: `${siteUrl}/security`,
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/security`,
    siteName: "BizTrackBD",
    title: "Security Architecture & Data Protection",
    description: "Multi-tenant database isolation, AES-256 encrypted courier keys, and staff phone-masking.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "Security Architecture" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Security Architecture & Data Protection",
    description: "Rigorous data protection, tenant isolation, and encryption for Bangladesh commerce.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const SECURITY_PILLARS = [
  {
    title: "Multi-Tenant Data Isolation",
    badge: "TENANT PARTITION",
    description:
      "Every merchant account operates inside a strictly partitioned logical silo with database-level tenant isolation. A query executed by Store A can never access, read, or infer customer phone numbers, orders, revenue figures, or catalog data belonging to Store B.",
    guarantees: [
      "Strict tenant scoping on every database read and write",
      "No cross-store customer data pooling or leakages",
      "Zero platform staff access to customer lists without merchant authorization",
    ],
  },
  {
    title: "Secret Vault for Courier & Gateway Credentials",
    badge: "AES-256-GCM",
    description:
      "Your Steadfast API keys, Pathao client secrets, bKash merchant credentials, and Meta Pixel access tokens are encrypted at rest using AES-256-GCM. Keys are decrypted exclusively in ephemeral serverless execution memory during dispatch requests and are never exposed in browser JavaScript.",
    guarantees: [
      "Zero plain-text storage of third-party API credentials",
      "One-way write fields: masked tokens in administrative settings",
      "Automated key rotation and revocation support",
    ],
  },
  {
    title: "Role-Based Staff Permissions & Phone Masking",
    badge: "ACCESS CONTROL",
    description:
      "Protect your customer database from internal theft. Assign custom roles (Manager, Dispatcher, Support, Packing Staff). Warehouse packing staff only see item lists and shipping barcode labels, while customer phone numbers and net profit figures remain masked.",
    guarantees: [
      "Fine-grained permissions by staff responsibility",
      "Phone-number and customer address masking for pack station operators",
      "Full audit logs recording who exported, modified, or viewed records",
    ],
  },
  {
    title: "High-Availability Edge Architecture & Backups",
    badge: "99.9% UPTIME",
    description:
      "Storefronts run on globally distributed serverless edge infrastructure with automatic horizontal scaling. During high-traffic Eid campaigns or flash sales, traffic surges are absorbed without memory lockups or 502 errors.",
    guarantees: [
      "Automated daily encrypted database backups stored across isolated regions",
      "Point-in-time recovery (PITR) protection against accidental data deletion",
      "Continuous DDoS mitigation and TLS 1.3 encryption across all custom domains",
    ],
  },
];

const SECURITY_FAQS = [
  {
    q: "Can other merchants or BizTrackBD employees see my customer lists and order history?",
    a: "No. BizTrackBD enforces strict multi-tenant isolation. Your database records are scoped to your unique tenant identifier. Furthermore, platform engineers operate under strict least-privilege policies and cannot inspect or export merchant business records without written authorization for support debugging.",
  },
  {
    q: "How are my bKash merchant credentials and Pathao/Steadfast API keys kept secure?",
    a: "All integration credentials are encrypted at rest using industry-standard AES-256-GCM encryption before being committed to our database. When an order is dispatched, credentials are decrypted in memory only for the duration of the API call to Steadfast or Pathao, and are never sent to the client browser.",
  },
  {
    q: "How do you protect against staff stealing customer phone numbers?",
    a: "BizTrackBD includes Role-Based Access Control (RBAC). You can create restricted accounts for dispatch staff, warehouse operators, and call agents. Restricted staff can print shipping labels and update order statuses, but customer phone numbers and financial profit ledgers can be masked to prevent database poaching.",
  },
  {
    q: "What happens if a major power outage or server disaster occurs?",
    a: "Our infrastructure includes automated continuous replication and daily off-site encrypted snapshots. In the event of a regional datacenter failure, systems failover to backup instances with a target Recovery Point Objective (RPO) of under 1 hour.",
  },
  {
    q: "How do I report a security vulnerability?",
    a: "We welcome responsible security research. If you discover a vulnerability or security flaw, please contact us immediately at security@biztrack.bd. We acknowledge reports within 24 hours and commit to rapid remediation under our responsible disclosure guidelines.",
  },
];

export default function SecurityPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Security Architecture & Data Protection | BizTrackBD",
    description:
      "Technical architecture, multi-tenant isolation, AES-256 credential encryption, and data security guarantees at BizTrackBD.",
    publisher: {
      "@type": "Organization",
      name: "BizTrackBD",
      url: "https://biztrack.bd",
    },
    mainEntity: {
      "@type": "FAQPage",
      mainEntity: SECURITY_FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.a,
        },
      })),
    },
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
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-mono mb-6">
            <span className="stamp stamp-paid text-[10px]">SECURITY BLUEPRINT</span>
            <span className="text-[var(--muted)]">Bank-Grade Merchant Privacy</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[var(--foreground)] max-w-4xl">
            Your orders, customer data, and profits are strictly isolated and protected.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-[var(--muted)] max-w-3xl leading-relaxed">
            In Bangladeshi commerce, customer records and courier credentials are core business assets. Learn how BizTrackBD isolates multi-tenant records, encrypts API secrets with AES-256, and prevents internal staff data leaks.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/data-ownership"
              className="rounded-lg bg-[var(--primary)] px-5 py-2.5 text-xs sm:text-sm font-semibold text-[var(--primary-foreground)] shadow-xs hover:opacity-95 transition"
            >
              Read Zero Lock-In Charter →
            </Link>
            <a
              href="mailto:security@biztrack.bd"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-xs sm:text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-subtle)] transition"
            >
              Security Disclosure Contact
            </a>
          </div>
        </div>
      </section>

      {/* Security Pillars Grid */}
      <section className="py-16 border-b border-[var(--border)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-10">
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--primary)] font-bold">
              SECURITY CONTROLS
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)] mt-1">
              Architectural Trust Pillars
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SECURITY_PILLARS.map((pillar, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-7 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="stamp stamp-paid text-[10px]">{pillar.badge}</span>
                    <span className="font-mono text-xs text-[var(--muted)]">SEC-0{idx + 1}</span>
                  </div>
                  <h3 className="text-lg font-bold text-[var(--foreground)] tracking-tight">
                    {pillar.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--muted)] mt-2 leading-relaxed">
                    {pillar.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--border)] space-y-2">
                  {pillar.guarantees.map((item, gIdx) => (
                    <div key={gIdx} className="flex items-start gap-2 text-xs text-[var(--foreground)]">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Operational Trust Protocol */}
      <section className="py-16 border-b border-[var(--border)] bg-[var(--surface-subtle)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="stamp stamp-review text-[10px]">INCIDENT RESPONSE</span>
              <h2 className="text-xl font-bold text-[var(--foreground)]">
                Vulnerability Disclosure & Security Commitments
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed max-w-3xl">
              We treat the security of our platform with the utmost seriousness. Our security team regularly conducts automated vulnerability scans, dependency audits, and penetration tests across our edge network.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-[var(--border)]">
              <div>
                <div className="text-xs font-mono uppercase text-[var(--muted)]">REPORTING CHANNEL</div>
                <div className="text-sm font-bold text-[var(--foreground)] mt-1 font-mono">
                  security@biztrack.bd
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  PGP keys available upon request for encrypted disclosure.
                </div>
              </div>

              <div>
                <div className="text-xs font-mono uppercase text-[var(--muted)]">RESPONSE TIME SLA</div>
                <div className="text-sm font-bold text-[var(--foreground)] mt-1 font-mono">
                  &lt; 24 Hours Triage
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  Initial acknowledgment and assessment within one business day.
                </div>
              </div>

              <div>
                <div className="text-xs font-mono uppercase text-[var(--muted)]">SAFE HARBOR</div>
                <div className="text-sm font-bold text-[var(--foreground)] mt-1 font-mono">
                  Full Protection
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  We will not pursue legal action against ethical researchers acting in good faith.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security FAQs */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-[var(--foreground)]">
              Security & Privacy FAQ
            </h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              Common questions on merchant data ownership, backups, and encryption standards.
            </p>
          </div>

          <div className="space-y-4">
            {SECURITY_FAQS.map((faq, idx) => (
              <div key={idx} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <h3 className="text-sm font-bold text-[var(--foreground)]">{faq.q}</h3>
                <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <div className="text-sm font-medium text-[var(--foreground)] mb-3">
              Learn how your business retains 100% data ownership anytime.
            </div>
            <Link
              href="/data-ownership"
              className="inline-flex items-center justify-center rounded-lg bg-[var(--primary)] px-5 py-2.5 text-xs font-bold text-[var(--primary-foreground)] shadow-xs hover:opacity-95 transition"
            >
              Explore The Zero Lock-in Charter →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
