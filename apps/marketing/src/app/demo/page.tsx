import type { Metadata } from "next";
import Link from "next/link";
import { THEMES } from "@biztrackbd/core";
import { demoAdminUrl } from "@/lib/demo-admin";
import { AuthenticUiProof } from "@/components/authentic-ui-proof";

const siteUrl = process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  title: "Live Product Demos & Operational Desks",
  description:
    "Choose a BizTrackBD Commerce or Business demo. Preview the customer website or explore the owner dashboard with sample data.",
  alternates: { canonical: `${siteUrl}/demo` },
  openGraph: {
    type: "website",
    url: `${siteUrl}/demo`,
    siteName: "BizTrackBD",
    title: "BizTrackBD Live Product Demos & Operational Desks",
    description:
      "Preview customer-facing websites and explore owner dashboards for BizTrackBD Commerce and Business.",
    images: [{ url: `${siteUrl}/opengraph-image`, width: 1200, height: 630, alt: "BizTrackBD live product demos" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BizTrackBD Live Product Demos & Operational Desks",
    description: "Choose a Commerce or Business demo and inspect both the public website and owner dashboard.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const BUSINESS_DEMOS = [
  { id: "dhaka-bistro", name: "Dhaka Bistro", audience: "Restaurant digital menu, table tray, and dining reservation requests", guideHref: "/business/restaurant-websites" },
  { id: "modern-clinic", name: "Modern Clinic", audience: "Doctor profile, BMDC credentials, chambers and appointment queue", guideHref: "/business/doctor-websites" },
  { id: "apex-corporate", name: "Apex Corporate", audience: "Company profile, practice areas, services and corporate enquiries", guideHref: "/business/company-website" },
  { id: "local-service-pro", name: "Local Service Pro", audience: "Upfront pricing tiers, service areas, quote requests and WhatsApp", guideHref: "/business/service-websites" },
  { id: "portfolio-focus", name: "Portfolio Focus", audience: "Project case studies, CV download, technical stack and client enquiries", guideHref: "/business/portfolio-websites" },
  { id: "public-profile", name: "Public Figure & Leader", audience: "Author & speaker profile, press kit, op-eds, and invitation forms", guideHref: "/business/public-profile-websites" },
] as const;

function DemoCard({
  id,
  name,
  audience,
  mode,
  guideHref,
}: {
  id: string;
  name: string;
  audience: string;
  mode: "commerce" | "business";
  guideHref?: string;
}) {
  return (
    <article className="card ledger-border demo-choice-card">
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span className={`status-stamp ${mode === "commerce" ? "stamp-paid" : "stamp-lead"}`}>
            {mode === "commerce" ? "Commerce" : "Business"}
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <span className="pill ok" style={{ fontSize: 10 }}>Live Storefront</span>
            <span className="pill" style={{ fontSize: 10 }}>Sample Data</span>
          </div>
        </div>
        <h3 style={{ marginTop: 12 }}>{name}</h3>
        <p style={{ marginTop: 7, color: "var(--ink-2)", fontSize: 13.5, lineHeight: 1.5 }}>{audience}</p>
        {guideHref && (
          <div style={{ marginTop: 8 }}>
            <Link href={guideHref} className="link" style={{ fontSize: 12, fontWeight: 600 }}>
              Read vertical blueprint guide →
            </Link>
          </div>
        )}
      </div>
      <div className="demo-choice-actions" style={{ marginTop: 16 }}>
        <Link href={`/demo/${id}`} className="btn btn-primary btn-sm" target="_blank" data-testid={`demo-preview-${id}`}>
          Preview customer website
        </Link>
        <a href={demoAdminUrl(id)} className="btn btn-secondary btn-sm" rel="nofollow" data-testid={`demo-admin-${id}`}>
          Explore owner dashboard
        </a>
      </div>
    </article>
  );
}

export default function DemoPage() {
  return (
    <>
      <section className="block soft" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap" style={{ maxWidth: 920 }}>
          <span className="eyebrow">Working product previews</span>
          <h1 style={{ fontSize: "clamp(36px, 6vw, 58px)", lineHeight: 1.05, letterSpacing: "-1.8px" }}>
            See the customer website and the owner dashboard.
          </h1>
          <p className="lead" style={{ marginTop: 18, maxWidth: 760 }}>
            Choose a sample business below. The website preview shows what visitors see; the dashboard demo shows how the owner manages the operation. Demo records are illustrative sample data.
          </p>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow">Sell products</span>
              <h2>BizTrackBD Commerce demos</h2>
            </div>
            <Link href="/templates" className="link">Browse all templates →</Link>
          </div>
          <div className="grid g3">
            {THEMES.map((theme) => (
              <DemoCard key={theme.id} id={theme.id} name={theme.name} audience={theme.blurb} mode="commerce" />
            ))}
          </div>
        </div>
      </section>

      <section className="block paper-block">
        <div className="wrap">
          <div className="section-heading-row">
            <div>
              <span className="eyebrow" style={{ color: "var(--business)" }}>Win enquiries</span>
              <h2>BizTrackBD Business demos</h2>
            </div>
            <Link href="/business" className="link">Explore BizTrackBD Business →</Link>
          </div>
          <div className="grid g3">
            {BUSINESS_DEMOS.map((demo) => (
              <DemoCard key={demo.id} {...demo} mode="business" />
            ))}
          </div>
        </div>
      </section>

      {/* Operational Desks UI Evidence (DEMO-004) */}
      <section className="block soft" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 36px" }}>
            <span className="eyebrow" style={{ color: "var(--business)" }}>Authentic Merchant Workspaces</span>
            <h2 style={{ fontSize: "clamp(28px, 4.5vw, 40px)", letterSpacing: "-1.2px", color: "var(--ink-ledger)" }}>
              What running BizTrackBD looks like behind the scenes
            </h2>
            <p style={{ margin: "14px auto 0", fontSize: 16, color: "var(--ink-2)", lineHeight: 1.6 }}>
              Inspect the live operational desks powering inquiries, appointments, dining tables, and CAPI conversion health across Bangladeshi businesses.
            </p>
          </div>

          <AuthenticUiProof />
        </div>
      </section>

      <section className="cta-band">
        <div className="wrap">
          <h2>Ready to build with your own content?</h2>
          <p>Start with a template and review everything before publishing.</p>
          <Link href="/start" className="btn btn-lg btn-primary">Start your 14-day trial</Link>
        </div>
      </section>
    </>
  );
}
