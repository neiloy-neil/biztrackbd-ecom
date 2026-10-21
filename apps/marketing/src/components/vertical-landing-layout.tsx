"use client";

import { useState } from "react";
import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";

export interface BlueprintTab {
  id: string;
  label: string;
  customerHeading: string;
  customerSub: string;
  customerContent: React.ReactNode;
  ownerHeading: string;
  ownerStatus: { text: string; stampClass: string };
  ownerContent: React.ReactNode;
}

export interface CoreModule {
  icon: string;
  title: string;
  desc: string;
}

export interface BilingualProof {
  title: string;
  badge: string;
  enExcerpt: string;
  bnExcerpt: string;
  note: string;
}

export interface VerticalLandingLayoutProps {
  eyebrow: string;
  title: string;
  titleHighlight: string;
  lead: string;
  badge: string;
  demoId: string;
  demoLabel: string;
  templateSignupId: string;
  blueprintTabs: BlueprintTab[];
  coreModules: CoreModule[];
  bilingualProof: BilingualProof;
  faq: [string, string][];
  schemaJsonLd: object;
  ctaHeading: string;
  ctaSub: string;
}

export function VerticalLandingLayout({
  eyebrow,
  title,
  titleHighlight,
  lead,
  badge,
  demoId,
  demoLabel,
  templateSignupId,
  blueprintTabs,
  coreModules,
  bilingualProof,
  faq,
  schemaJsonLd,
  ctaHeading,
  ctaSub,
}: VerticalLandingLayoutProps) {
  const [activeTab, setActiveTab] = useState<number>(0);
  const currentTab = blueprintTabs[activeTab] ?? blueprintTabs[0]!;

  if (!currentTab) return null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaJsonLd) }}
      />

      {/* Hero Section */}
      <section className="hero hero-center" style={{ background: "var(--bg-paper)", borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <nav aria-label="Breadcrumb" style={{ marginBottom: 14 }}>
            <ol style={{ display: "inline-flex", alignItems: "center", gap: 8, listStyle: "none", margin: 0, padding: 0, fontSize: 13, color: "var(--ink-3)" }}>
              <li><Link href="/" style={{ color: "var(--ink-2)", textDecoration: "underline" }}>Home</Link></li>
              <li aria-hidden="true">&rsaquo;</li>
              <li><Link href="/business" style={{ color: "var(--ink-2)", textDecoration: "underline" }}>Business Websites</Link></li>
              <li aria-hidden="true">&rsaquo;</li>
              <li aria-current="page" style={{ color: "var(--ink-ledger)", fontWeight: 700 }}>{eyebrow}</li>
            </ol>
          </nav>

          <div style={{ marginBottom: 12 }}>
            <span
              className="eyebrow"
              style={{
                color: "var(--business)",
                background: "var(--business-tint)",
                borderColor: "var(--business-border)",
                borderWidth: 1,
                borderStyle: "solid",
                padding: "4px 14px",
                borderRadius: 20,
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                display: "inline-block",
              }}
            >
              {eyebrow}
            </span>
          </div>

          <h1 style={{ color: "var(--ink-ledger)", fontSize: "clamp(34px, 5.5vw, 54px)", lineHeight: 1.12, letterSpacing: "-1.5px" }}>
            {title} <span style={{ color: "var(--business)" }}>{titleHighlight}</span>
          </h1>

          <p className="lead" style={{ maxWidth: 740, margin: "18px auto 0", color: "var(--ink-2)", fontSize: "clamp(16px, 2vw, 19px)", lineHeight: 1.6 }}>
            {lead}
          </p>

          <div className="cta" style={{ marginTop: 28, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href={`/start?mode=business&theme=${templateSignupId}`}
              className="btn btn-primary btn-lg"
              style={{ background: "var(--business)", borderColor: "var(--business-dark)" }}
              prefetch={false}
            >
              Start Free Trial with this Blueprint
            </Link>
            <a
              href={demoAdminUrl(demoId)}
              className="btn btn-secondary btn-lg"
              style={{ background: "#FFFFFF", color: "var(--ink-ledger)", border: "1.5px solid var(--line-strong)" }}
            >
              {demoLabel} ↗
            </a>
          </div>

          <p className="fine" style={{ marginTop: 14, fontSize: 13.5, color: "var(--ink-3)" }}>
            Custom domain included &middot; Bilingual Bangla &amp; English &middot; Editable from your phone &middot; 0% commission
          </p>
        </div>
      </section>

      {/* Two-Pane Blueprint Inspector */}
      <section className="block" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 32px" }}>
            <span className="status-stamp stamp-lead" style={{ marginBottom: 12 }}>
              THE TWO-PANE BLUEPRINT INSPECTOR
            </span>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px", color: "var(--ink-ledger)" }}>
              See what your visitor sees &middot; See what you manage
            </h2>
            <p style={{ margin: "12px auto 0", fontSize: 16, color: "var(--ink-2)", lineHeight: 1.6 }}>
              A high-converting website isn&apos;t just a pretty design. Watch customer actions connect straight to your smartphone lead desk.
            </p>
          </div>

          {/* Stepper Tabs */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              marginBottom: 24,
              flexWrap: "wrap",
            }}
          >
            {blueprintTabs.map((t, idx) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(idx)}
                style={{
                  padding: "9px 18px",
                  borderRadius: 24,
                  border: activeTab === idx ? "2px solid var(--business)" : "1px solid var(--line)",
                  background: activeTab === idx ? "var(--business-tint)" : "#FFFFFF",
                  color: activeTab === idx ? "var(--business)" : "var(--ink-2)",
                  fontWeight: activeTab === idx ? 700 : 500,
                  fontSize: 14,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Two Pane Container */}
          <div
            className="card ledger-border"
            style={{
              padding: "28px 24px",
              background: "#FFFFFF",
              boxShadow: "0 10px 30px rgba(11, 77, 59, 0.06)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 28,
              }}
            >
              {/* Left Pane: Customer Action */}
              <div
                style={{
                  background: "#FBF7EC",
                  borderRadius: 12,
                  padding: "20px 22px",
                  border: "1px solid var(--line)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase" }}>
                    1. Customer Facing View
                  </span>
                  <span className="status-stamp stamp-paid" style={{ fontSize: 10 }}>VISITOR ACTION</span>
                </div>
                <h4 style={{ margin: 0, fontSize: 17, color: "var(--ink-ledger)" }}>
                  {currentTab.customerHeading}
                </h4>
                <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
                  {currentTab.customerSub}
                </p>
                <div style={{ marginTop: 8 }}>
                  {currentTab.customerContent}
                </div>
              </div>

              {/* Right Pane: Owner Lead Desk */}
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: 12,
                  padding: "20px 22px",
                  border: "1.5px solid var(--business-border)",
                  boxShadow: "0 4px 16px rgba(17, 121, 90, , 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--business)", textTransform: "uppercase" }}>
                    2. Business Owner Admin Desk
                  </span>
                  <span className={`status-stamp ${currentTab.ownerStatus.stampClass}`} style={{ fontSize: 10 }}>
                    {currentTab.ownerStatus.text}
                  </span>
                </div>
                <h4 style={{ margin: 0, fontSize: 17, color: "var(--ink-ledger)" }}>
                  {currentTab.ownerHeading}
                </h4>
                <div style={{ marginTop: 8 }}>
                  {currentTab.ownerContent}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Vertical Modules */}
      <section className="block soft" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 36px" }}>
            <span className="eyebrow">Built-In Capabilities</span>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px", color: "var(--ink-ledger)" }}>
              Everything needed to run this business online
            </h2>
            <p style={{ margin: "12px auto 0", fontSize: 16, color: "var(--ink-2)" }}>
              No messy third-party plugins. Every feature is native, secure, and manageable from your phone.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 20,
            }}
          >
            {coreModules.map((m, idx) => (
              <div key={idx} className="card ledger-border" style={{ padding: "22px 20px", background: "#FFFFFF" }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>{m.icon}</div>
                <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ink-ledger)" }}>{m.title}</h3>
                <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Authentic Paired Bilingual Proof Box */}
      <section className="block" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div
            className="card ledger-border"
            style={{
              padding: "32px 28px",
              background: "#FBF7EC",
              border: "1.5px solid var(--line-strong)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
              <div>
                <span className="status-stamp stamp-lead">{bilingualProof.badge}</span>
                <h3 style={{ margin: "6px 0 0", fontSize: 22, color: "var(--ink-ledger)" }}>
                  {bilingualProof.title}
                </h3>
              </div>
              <span style={{ fontSize: 13, color: "var(--ink-3)", fontWeight: 600 }}>
                Clean Google &amp; Facebook Open Graph Preview
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
              <div style={{ background: "#FFFFFF", padding: "18px 20px", borderRadius: 10, border: "1px solid var(--line)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand)", marginBottom: 8, textTransform: "uppercase" }}>
                  English Version
                </div>
                <div style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.6, fontStyle: "italic" }}>
                  &ldquo;{bilingualProof.enExcerpt}&rdquo;
                </div>
              </div>

              <div style={{ background: "#FFFFFF", padding: "18px 20px", borderRadius: 10, border: "1px solid var(--line)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--business)", marginBottom: 8, textTransform: "uppercase" }}>
                  বাংলা সংস্করণ (Bengali Version)
                </div>
                <div style={{ fontSize: 14.5, color: "var(--ink)", lineHeight: 1.7, fontStyle: "italic" }}>
                  &ldquo;{bilingualProof.bnExcerpt}&rdquo;
                </div>
              </div>
            </div>

            <p style={{ margin: "16px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
              {bilingualProof.note}
            </p>
          </div>
        </div>
      </section>

      {/* Sibling Business Directory */}
      <section className="block" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <span className="eyebrow" style={{ color: "var(--business)" }}>Business Website Solutions</span>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 34px)", letterSpacing: "-0.8px" }}>Explore other specialized industry blueprints</h2>
            <p className="sub" style={{ margin: "8px auto 0" }}>Tailored lead flows, bilingual menus, booking calendars, and credential displays for Bangladeshi businesses.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <Link href="/business/company-website" className="card ledger-border" style={{ padding: 18, background: "#FFFFFF", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <span className="status-stamp stamp-lead">Corporate</span>
                <h4 style={{ margin: "8px 0 4px", fontSize: 16 }}>Company &amp; B2B Agency</h4>
                <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: 0 }}>Service catalogue, credentials &amp; quote requests.</p>
              </div>
              <span style={{ marginTop: 12, fontSize: 12.5, color: "var(--business)", fontWeight: 700 }}>Learn more &rarr;</span>
            </Link>
            <Link href="/business/service-websites" className="card ledger-border" style={{ padding: 18, background: "#FFFFFF", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <span className="status-stamp stamp-lead">Services</span>
                <h4 style={{ margin: "8px 0 4px", fontSize: 16 }}>Local Service Contractors</h4>
                <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: 0 }}>Package pricing, coverage areas &amp; WhatsApp leads.</p>
              </div>
              <span style={{ marginTop: 12, fontSize: 12.5, color: "var(--business)", fontWeight: 700 }}>Learn more &rarr;</span>
            </Link>
            <Link href="/business/doctor-websites" className="card ledger-border" style={{ padding: 18, background: "#FFFFFF", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <span className="status-stamp stamp-lead">Medical</span>
                <h4 style={{ margin: "8px 0 4px", fontSize: 16 }}>Doctors &amp; Clinics</h4>
                <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: 0 }}>Verified BMDC credentials &amp; chamber serial requests.</p>
              </div>
              <span style={{ marginTop: 12, fontSize: 12.5, color: "var(--business)", fontWeight: 700 }}>Learn more &rarr;</span>
            </Link>
            <Link href="/business/restaurant-websites" className="card ledger-border" style={{ padding: 18, background: "#FFFFFF", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <span className="status-stamp stamp-lead">Dining</span>
                <h4 style={{ margin: "8px 0 4px", fontSize: 16 }}>Restaurants &amp; Cafes</h4>
                <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: 0 }}>Mobile QR menus &amp; instant table reservations.</p>
              </div>
              <span style={{ marginTop: 12, fontSize: 12.5, color: "var(--business)", fontWeight: 700 }}>Learn more &rarr;</span>
            </Link>
            <Link href="/business/portfolio-websites" className="card ledger-border" style={{ padding: 18, background: "#FFFFFF", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <span className="status-stamp stamp-lead">Creative</span>
                <h4 style={{ margin: "8px 0 4px", fontSize: 16 }}>Portfolios &amp; Creators</h4>
                <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: 0 }}>Case studies, CV downloads &amp; client contracts.</p>
              </div>
              <span style={{ marginTop: 12, fontSize: 12.5, color: "var(--business)", fontWeight: 700 }}>Learn more &rarr;</span>
            </Link>
            <Link href="/business/public-profile-websites" className="card ledger-border" style={{ padding: 18, background: "#FFFFFF", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <span className="status-stamp stamp-lead">Leadership</span>
                <h4 style={{ margin: "8px 0 4px", fontSize: 16 }}>Public Figures &amp; Leaders</h4>
                <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: 0 }}>Op-eds, press kit, bio &amp; speaking invitations.</p>
              </div>
              <span style={{ marginTop: 12, fontSize: 12.5, color: "var(--business)", fontWeight: 700 }}>Learn more &rarr;</span>
            </Link>
          </div>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <Link href="/business" style={{ fontSize: 13.5, color: "var(--ink-2)", textDecoration: "underline", fontWeight: 600 }}>
              &larr; Return to BizTrackBD Business Overview
            </Link>
          </div>
        </div>
      </section>

      {/* Industry FAQ */}
      <section className="block soft" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap">
          <h2 style={{ textAlign: "center", margin: "0 auto 32px", fontSize: "clamp(26px, 4vw, 38px)", letterSpacing: "-1px" }}>
            Frequently asked questions
          </h2>
          <dl className="faq-list">
            {faq.map(([q, a]) => (
              <div key={q}>
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="cta-band">
        <div className="wrap">
          <h2 style={{ color: "#FFFFFF", fontSize: "clamp(28px, 4.5vw, 42px)", letterSpacing: "-1.2px" }}>
            {ctaHeading}
          </h2>
          <p style={{ color: "#E3F1EA", fontSize: 17, marginTop: 10 }}>
            {ctaSub}
          </p>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href={`/start?mode=business&theme=${templateSignupId}`}
              className="btn btn-lg btn-primary"
              style={{ background: "#FFFFFF", color: "var(--business-dark)" }}
              prefetch={false}
            >
              Start 14-day free trial
            </Link>
            <a
              href={demoAdminUrl(demoId)}
              className="btn btn-lg btn-secondary"
              style={{ background: "rgba(255,255,255,0.15)", color: "#FFFFFF", borderColor: "rgba(255,255,255,0.3)" }}
            >
              Open live demo workspace ↗
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
