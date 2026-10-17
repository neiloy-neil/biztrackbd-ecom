"use client";

import Link from "next/link";
import { useState } from "react";
import { TcoCalculator } from "@/components/tco-calculator";

export type CompareTab = "storefronts" | "business";

export interface ComparisonCard {
  slug: string;
  title: string;
  tagline: string;
  summary: string;
  bestForComp: string;
  bestForBiztrack: string;
  badge: string;
  hasDeepPage?: boolean;
}

export interface MatrixRow {
  dimension: string;
  biztrack: string;
  comp1: string;
  comp2: string;
  comp3: string;
  comp1Name: string;
  comp2Name: string;
  comp3Name: string;
}

interface CompareViewProps {
  storefrontCards: ComparisonCard[];
  businessCards: ComparisonCard[];
  storefrontMatrix: MatrixRow[];
  businessMatrix: MatrixRow[];
}

export function CompareView({
  storefrontCards,
  businessCards,
  storefrontMatrix,
  businessMatrix,
}: CompareViewProps) {
  const [activeTab, setActiveTab] = useState<CompareTab>("storefronts");

  const isStore = activeTab === "storefronts";
  const currentCards = isStore ? storefrontCards : businessCards;
  const currentMatrix = isStore ? storefrontMatrix : businessMatrix;

  return (
    <>
      {/* Segmented Tab Switcher */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          margin: "32px 0 24px",
          maxWidth: "100%",
          padding: "0 8px",
          boxSizing: "border-box",
        }}
      >
        <div
          role="tablist"
          aria-label="Comparison category"
          style={{
            display: "inline-flex",
            maxWidth: "100%",
            background: "#F1F1F8",
            padding: "5px",
            borderRadius: "32px",
            border: "1px solid var(--line, #E2E2EC)",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.04)",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "4px",
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={isStore}
            onClick={() => setActiveTab("storefronts")}
            style={{
              padding: "9px clamp(14px, 3.5vw, 24px)",
              borderRadius: "28px",
              background: isStore ? "#FFFFFF" : "transparent",
              color: isStore ? "var(--ink, #101828)" : "#667085",
              fontWeight: 700,
              fontSize: "clamp(13px, 2.5vw, 15px)",
              border: "none",
              cursor: "pointer",
              boxShadow: isStore ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <span>🛍️</span> Online Storefronts
            <span
              style={{
                fontSize: "12px",
                padding: "2px 8px",
                borderRadius: "12px",
                background: isStore ? "#EFEFF6" : "#E5E5EE",
                color: "var(--ink, #101828)",
              }}
            >
              Shopify · WooCommerce · Pathao
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={!isStore}
            onClick={() => setActiveTab("business")}
            style={{
              padding: "9px clamp(14px, 3.5vw, 24px)",
              borderRadius: "28px",
              background: !isStore ? "#FFFFFF" : "transparent",
              color: !isStore ? "var(--ink, #101828)" : "#667085",
              fontWeight: 700,
              fontSize: "clamp(13px, 2.5vw, 15px)",
              border: "none",
              cursor: "pointer",
              boxShadow: !isStore ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <span>💼</span> Business &amp; Service Websites
            <span
              style={{
                fontSize: "12px",
                padding: "2px 8px",
                borderRadius: "12px",
                background: !isStore ? "#EEF2FF" : "#E5E5EE",
                color: !isStore ? "var(--accent, #3B5BFD)" : "var(--ink, #101828)",
                fontWeight: 700,
              }}
            >
              Wix · WordPress · Squarespace
            </span>
          </button>
        </div>
      </div>

      {/* Comparison Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 24,
          marginTop: 20,
        }}
      >
        {currentCards.map((c) => (
          <div
            key={c.slug}
            className="premium-glass-card"
            style={{
              padding: "28px 24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              borderTop: isStore ? "4px solid #5B4FE8" : "4px solid #0D9488",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: isStore ? "#F0FDF4" : "#EEF2FF",
                    color: isStore ? "#166534" : "var(--accent, #3B5BFD)",
                    border: isStore ? "1px solid #BBF7D0" : "1px solid #C7D2FE",
                  }}
                >
                  {c.badge}
                </span>

                {c.hasDeepPage && (
                  <Link
                    href={`/compare/${c.slug}`}
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: isStore ? "var(--brand, #5B4FE8)" : "var(--accent, #3B5BFD)",
                      textDecoration: "none",
                    }}
                  >
                    Deep Breakdown →
                  </Link>
                )}
              </div>

              <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink, #101828)", margin: "0 0 6px" }}>
                {c.title}
              </h3>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-3, #667085)", margin: "0 0 14px", lineHeight: 1.4 }}>
                {c.tagline}
              </p>
              <p style={{ fontSize: 14.5, color: "var(--ink-2, #475467)", lineHeight: 1.6, margin: "0 0 20px" }}>
                {c.summary}
              </p>

              <div style={{ background: "#F9FAFB", padding: "14px 16px", borderRadius: 10, border: "1px solid #F1F2F6", marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, textTransform: "uppercase" }}>
                  Where Competitor Wins:
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-2, #475467)", lineHeight: 1.5 }}>
                  {c.bestForComp}
                </div>
              </div>

              <div style={{ background: isStore ? "#ECFDF5" : "#F5F3FF", padding: "14px 16px", borderRadius: 10, border: isStore ? "1px solid #D1FAE5" : "1px solid #EDE9FE" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isStore ? "#065F46" : "#5B21B6", marginBottom: 4, textTransform: "uppercase" }}>
                  Where BizTrackBD Wins in Bangladesh:
                </div>
                <div style={{ fontSize: 13, color: "var(--ink, #101828)", fontWeight: 500, lineHeight: 1.5 }}>
                  {c.bestForBiztrack}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--line, #F1F2F6)" }}>
              {c.hasDeepPage ? (
                <Link
                  href={`/compare/${c.slug}`}
                  className="btn btn-secondary"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 14,
                    padding: "10px 16px",
                  }}
                >
                  Read Full {c.title} Analysis →
                </Link>
              ) : (
                <Link
                  href={isStore ? "/start?mode=ecommerce" : "/start?mode=business"}
                  className="btn btn-secondary"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 14,
                    padding: "10px 16px",
                  }}
                >
                  Start BizTrackBD Free Trial →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Comprehensive Operational Comparison Table */}
      <div style={{ marginTop: 64 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: isStore ? "var(--brand, #5B4FE8)" : "var(--accent, #3B5BFD)",
            }}
          >
            {isStore ? "Retail Platform Matrix" : "Professional Website Matrix"}
          </span>
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 800, color: "var(--ink, #101828)", margin: "6px 0 10px" }}>
            {isStore ? "Side-by-Side Online Storefront Comparison" : "Side-by-Side Business Website Comparison"}
          </h2>
          <p style={{ fontSize: 15, color: "var(--ink-2, #475467)", maxWidth: 700, margin: "0 auto", lineHeight: 1.6 }}>
            {isStore
              ? "Compare operational capabilities, payment methods, courier automation, and true monthly expenses in Bangladeshi Taka."
              : "Compare local BDT billing, medical doctor chamber scheduling, restaurant table QR menus, and lead management."}
          </p>
        </div>

        <div
          style={{
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            borderRadius: 14,
            border: "1px solid var(--line, #E5E7EB)",
            background: "#FFFFFF",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
          }}
        >
          <table className="comparison-table-v2" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ width: "28%" }}>
                  Operational Dimension
                </th>
                <th
                  className={isStore ? "cell-highlight-primary" : "cell-highlight-teal"}
                  style={{ width: "24%" }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{isStore ? "🛍️ BizTrackBD" : "💼 BizTrackBD"}</span>
                  </div>
                </th>
                <th style={{ width: "16%" }}>
                  {currentMatrix[0]?.comp1Name}
                </th>
                <th style={{ width: "16%" }}>
                  {currentMatrix[0]?.comp2Name}
                </th>
                <th style={{ width: "16%" }}>
                  {currentMatrix[0]?.comp3Name}
                </th>
              </tr>
            </thead>
            <tbody>
              {currentMatrix.map((row) => (
                <tr key={row.dimension}>
                  <td className="font-semibold text-[var(--foreground)]">
                    {row.dimension}
                  </td>
                  <td className={isStore ? "cell-highlight-primary" : "cell-highlight-teal"}>
                    <div className="font-bold mb-1">{row.biztrack}</div>
                    <span className="spec-chip-positive">✓ Native BDT</span>
                  </td>
                  <td className="text-[var(--muted)]">
                    {row.comp1}
                  </td>
                  <td className="text-[var(--muted)]">
                    {row.comp2}
                  </td>
                  <td className="text-[var(--muted)]">
                    {row.comp3}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive TCO Calculator (for Storefronts) or Business ROI Showcase */}
      {isStore ? (
        <div style={{ marginTop: 64 }}>
          <TcoCalculator initialCompetitor="shopify" />
        </div>
      ) : (
        <div
          style={{
            marginTop: 64,
            padding: "36px 32px",
            borderRadius: 16,
            background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
            color: "#FFFFFF",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.15)",
          }}
        >
          <div style={{ maxWidth: 760 }}>
            <span
              style={{
                display: "inline-block",
                padding: "3px 12px",
                borderRadius: 20,
                background: "rgba(59, 91, 253, 0.2)",
                color: "#93C5FD",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Zero Currency Risk &middot; Flat BDT Pricing
            </span>
            <h3 style={{ fontSize: "clamp(22px, 3.5vw, 30px)", fontWeight: 800, margin: "0 0 10px", color: "#FFFFFF" }}>
              Stop Paying 15% Foreign Card Tax for Business Websites
            </h3>
            <p style={{ margin: 0, fontSize: 16, color: "#CBD5E1", lineHeight: 1.6 }}>
              International builders like Wix and Squarespace bill in USD, draining personal credit card travel limits and adding bank conversion fees. BizTrackBD gives your business high-speed edge hosting, custom domain, and an organized Lead Inbox starting from ৳ 399/mo payable directly with bKash or Nagad.
            </p>
          </div>

          <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/business/pricing"
              className="btn btn-primary"
              style={{
                background: "var(--accent, #3B5BFD)",
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: 14,
                padding: "10px 22px",
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              View Business Plans (৳399 to ৳1,499) →
            </Link>
            <Link
              href="/business/templates"
              style={{
                background: "transparent",
                color: "#FFFFFF",
                fontWeight: 600,
                fontSize: 14,
                padding: "10px 18px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.3)",
                textDecoration: "none",
              }}
            >
              Browse 6 Verified Business Templates
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
