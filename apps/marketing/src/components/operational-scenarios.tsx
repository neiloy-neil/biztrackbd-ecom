import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";

interface Scenario {
  tag: string;
  badgeType: "commerce" | "business" | "migration";
  title: string;
  context: string;
  challenge: string;
  workflow: string;
  proofBadge: string;
  demoLink: string;
  demoLabel: string;
}

const SCENARIOS: Scenario[] = [
  {
    tag: "High-Volume COD Operations",
    badgeType: "commerce",
    title: "Apparel & Fashion Merchant Shipping 500+ Parcels a Month",
    context: "Multi-channel clothing brand receiving orders via Facebook, WhatsApp, and Web Storefront",
    challenge:
      "Customer addresses were scattered across chat messages. Refused parcels cost ৳130–৳150 in round-trip courier fees, causing cashflow losses on fake phone numbers.",
    workflow:
      "All orders funnel into one BizTrackBD desk. Phone numbers are automatically cross-checked against Steadfast and Pathao delivery histories. High-risk numbers are held for advance delivery fee confirmation before parcel booking.",
    proofBadge: "Automated Courier API + COD Fraud Shield",
    demoLink: demoAdminUrl("kapor"),
    demoLabel: "Inspect Apparel Demo Admin ↗",
  },
  {
    tag: "Global Platform Migration",
    badgeType: "migration",
    title: "Consumer Electronics Retailer Switching from USD Subscriptions",
    context: "Chittagong-based gadget retailer evaluating Shopify vs locally native software",
    challenge:
      "Paying $39 monthly subscription plus 3% foreign currency exchange fees. Manually cross-checking bKash TrxIDs on a personal phone while copying customer names into separate courier tabs.",
    workflow:
      "Native BDT plans with zero sales commission. Direct bKash and Nagad payment forms, encrypted courier credentials for 1-click dispatch, and thermal shipping label printing.",
    proofBadge: "0% Sales Commission · Encrypted Courier Keys",
    demoLink: demoAdminUrl("gadgetstudio"),
    demoLabel: "Inspect Gadgets Demo Admin ↗",
  },
  {
    tag: "Local Service & Clinic Practice",
    badgeType: "business",
    title: "Specialist Consultant Managing Multi-Chamber Appointments",
    context: "Healthcare practice & consulting chamber with locations in Banani and Dhanmondi",
    challenge:
      "Patient booking requests were lost across WhatsApp and phone calls during consultation hours. Lack of clear schedule information caused crowded waiting rooms.",
    workflow:
      "Fast bilingual website featuring verified BMDC registration, weekly chamber schedule tables, Google Maps integration, and a mobile-friendly appointment queue with SMS status alerts.",
    proofBadge: "Structured Lead Inbox · Bilingual SEO Ready",
    demoLink: demoAdminUrl("modern-clinic"),
    demoLabel: "Inspect Clinic Demo Desk ↗",
  },
];

export function OperationalScenarios() {
  return (
    <section className="block" style={{ background: "var(--bg-paper)", borderTop: "1px solid var(--line)" }}>
      <div className="wrap">
        <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 40px" }}>
          <span
            className="eyebrow"
            style={{
              color: "var(--ink-2)",
              background: "#ECEEF2",
              borderColor: "var(--line)",
              borderWidth: 1,
              borderStyle: "solid",
              padding: "4px 14px",
              borderRadius: 20,
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              display: "inline-block",
              marginBottom: 12,
            }}
          >
            Verifiable Workflows &middot; Labelled Scenarios
          </span>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", letterSpacing: "-1.2px", color: "var(--ink-ledger)", lineHeight: 1.15 }}>
            Designed around how Bangladeshi commerce and business actually works
          </h2>
          <p style={{ margin: "14px auto 0", fontSize: 16.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
            Rather than hypothetical marketing testimonials, these workflow blueprints illustrate the exact operational friction BizTrackBD solves every single day.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 24,
          }}
        >
          {SCENARIOS.map((s, idx) => (
            <div
              key={idx}
              className="card ledger-border"
              style={{
                padding: "28px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)",
                background: "#FFFFFF",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span
                  className="status-stamp"
                  style={{
                    color: s.badgeType === "business" ? "var(--business)" : "var(--brand)",
                    borderColor: s.badgeType === "business" ? "var(--business-border)" : "var(--tint-border)",
                    background: s.badgeType === "business" ? "var(--business-tint)" : "var(--tint)",
                  }}
                >
                  {s.tag}
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600 }}>Scenario #{idx + 1}</span>
              </div>

              <div>
                <h3 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700, color: "var(--ink-ledger)", lineHeight: 1.3 }}>
                  {s.title}
                </h3>
                <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>
                  📍 {s.context}
                </div>
              </div>

              <div style={{ background: "#F8FAFC", borderRadius: 8, padding: "12px 14px", border: "1px solid var(--line)", fontSize: 13, lineHeight: 1.5 }}>
                <div style={{ fontWeight: 700, color: "#B91C1C", marginBottom: 3, fontSize: 12, textTransform: "uppercase" }}>
                  The Operational Friction:
                </div>
                <div style={{ color: "var(--ink-2)" }}>{s.challenge}</div>
              </div>

              <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ink)" }}>
                <div style={{ fontWeight: 700, color: "#15803D", marginBottom: 3, fontSize: 12, textTransform: "uppercase" }}>
                  The BizTrackBD Solution:
                </div>
                {s.workflow}
              </div>

              <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span className="pill" style={{ fontSize: 11, fontWeight: 600 }}>
                  {s.proofBadge}
                </span>
                <a
                  href={s.demoLink}
                  style={{ fontSize: 12.5, fontWeight: 700, color: "var(--brand)" }}
                >
                  {s.demoLabel}
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Claims Transparency Policy Box */}
        <div
          style={{
            marginTop: 36,
            background: "#F1F5F9",
            borderRadius: 12,
            padding: "18px 24px",
            border: "1px solid var(--line-strong)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 14,
            fontSize: 13.5,
          }}
        >
          <div style={{ color: "var(--ink-2)", maxWidth: 780 }}>
            <strong style={{ color: "var(--ink-ledger)" }}>Our Honest Claims Policy:</strong> BizTrackBD does not publish unverified customer outcome percentages or fabricated customer reviews. Every feature, courier connection, and calculation shown on this website is testable live inside our public demo workspaces.
          </div>
          <Link
            href="/demo"
            className="btn btn-secondary btn-sm"
            style={{ background: "#FFFFFF", color: "var(--ink-ledger)", fontWeight: 700 }}
          >
            Verify in Live Demo →
          </Link>
        </div>
      </div>
    </section>
  );
}
