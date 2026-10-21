"use client";

import Link from "next/link";
import { useState } from "react";
import { TcoCalculator } from "@/components/tco-calculator";
import { handleTabListKeyDown } from "@/lib/a11y";

export type CompareTab = "storefronts" | "business";
const COMPARE_TABS: readonly CompareTab[] = ["storefronts", "business"];

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
          onKeyDown={(e) => handleTabListKeyDown(e, COMPARE_TABS, activeTab, setActiveTab)}
          style={{
            display: "inline-flex",
            maxWidth: "100%",
            background: "#FBF7EC",
            padding: "5px",
            borderRadius: "32px",
            border: "1px solid var(--line, #DCE7E1)",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.04)",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "4px",
          }}
        >
          <button
            id="compare-tab-storefronts"
            type="button"
            role="tab"
            aria-selected={isStore}
            aria-controls="compare-panel-storefronts"
            tabIndex={isStore ? 0 : -1}
            onClick={() => setActiveTab("storefronts")}
            style={{
              padding: "9px clamp(14px, 3.5vw, 24px)",
              borderRadius: "28px",
              background: isStore ? "#FFFFFF" : "transparent",
              color: isStore ? "var(--ink, #0B4D3B)" : "#3D5A52",
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
            <span aria-hidden="true">🛍️</span> Online Storefronts
            <span
              style={{
                fontSize: "12px",
                padding: "2px 8px",
                borderRadius: "12px",
                background: isStore ? "#FBF7EC" : "#DCE7E1",
                color: "var(--ink, #0B4D3B)",
              }}
            >
              Shopify · WooCommerce · Pathao
            </span>
          </button>

          <button
            id="compare-tab-business"
            type="button"
            role="tab"
            aria-selected={!isStore}
            aria-controls="compare-panel-business"
            tabIndex={!isStore ? 0 : -1}
            onClick={() => setActiveTab("business")}
            style={{
              padding: "9px clamp(14px, 3.5vw, 24px)",
              borderRadius: "28px",
              background: !isStore ? "#FFFFFF" : "transparent",
              color: !isStore ? "var(--ink, #0B4D3B)" : "#3D5A52",
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
            <span aria-hidden="true">💼</span> Business &amp; Service Websites
            <span
              style={{
                fontSize: "12px",
                padding: "2px 8px",
                borderRadius: "12px",
                background: !isStore ? "#E3F1EA" : "#DCE7E1",
                color: !isStore ? "var(--accent, #11795A)" : "var(--ink, #0B4D3B)",
                fontWeight: 700,
              }}
            >
              Wix · WordPress · Squarespace
            </span>
          </button>
        </div>
      </div>

      {/* Comparison Tab Panel */}
      <div
        role="tabpanel"
        id={isStore ? "compare-panel-storefronts" : "compare-panel-business"}
        aria-labelledby={isStore ? "compare-tab-storefronts" : "compare-tab-business"}
        tabIndex={0}
        style={{ outline: "none" }}
      >
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
              borderTop: isStore ? "4px solid #11795A" : "4px solid #11795A",
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
                    background: isStore ? "#E3F1EA" : "#E3F1EA",
                    color: isStore ? "#0B4D3B" : "var(--accent, #11795A)",
                    border: isStore ? "1px solid #C6DFD3" : "1px solid #C6DFD3",
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
                      color: isStore ? "var(--brand, #11795A)" : "var(--accent, #11795A)",
                      textDecoration: "none",
                    }}
                  >
                    Deep Breakdown →
                  </Link>
                )}
              </div>

              <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink, #0B4D3B)", margin: "0 0 6px" }}>
                {c.title}
              </h3>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-3, #3D5A52)", margin: "0 0 14px", lineHeight: 1.4 }}>
                {c.tagline}
              </p>
              <p style={{ fontSize: 14.5, color: "var(--ink-2, #3D5A52)", lineHeight: 1.6, margin: "0 0 20px" }}>
                {c.summary}
              </p>

              <div style={{ background: "#FBF7EC", padding: "14px 16px", borderRadius: 10, border: "1px solid #FBF7EC", marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#3D5A52", marginBottom: 4, textTransform: "uppercase" }}>
                  Where Competitor Wins:
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-2, #3D5A52)", lineHeight: 1.5 }}>
                  {c.bestForComp}
                </div>
              </div>

              <div style={{ background: isStore ? "#E3F1EA" : "#E3F1EA", padding: "14px 16px", borderRadius: 10, border: isStore ? "1px solid #E3F1EA" : "1px solid #E3F1EA" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isStore ? "#0B4D3B" : "#11795A", marginBottom: 4, textTransform: "uppercase" }}>
                  Where BizTrackBD Wins in Bangladesh:
                </div>
                <div style={{ fontSize: 13, color: "var(--ink, #0B4D3B)", fontWeight: 500, lineHeight: 1.5 }}>
                  {c.bestForBiztrack}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--line, #FBF7EC)" }}>
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
              color: isStore ? "var(--brand, #11795A)" : "var(--accent, #11795A)",
            }}
          >
            {isStore ? "Retail Platform Matrix" : "Professional Website Matrix"}
          </span>
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 800, color: "var(--ink, #0B4D3B)", margin: "6px 0 10px" }}>
            {isStore ? "Side-by-Side Online Storefront Comparison" : "Side-by-Side Business Website Comparison"}
          </h2>
          <p style={{ fontSize: 15, color: "var(--ink-2, #3D5A52)", maxWidth: 700, margin: "0 auto", lineHeight: 1.6 }}>
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
            border: "1px solid var(--line, #DCE7E1)",
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
            background: "linear-gradient(135deg, #0B4D3B 0%, #0B4D3B 100%)",
            color: "#FFFFFF",
            boxShadow: "0 10px 30px rgba(11, 77, 59, 0.15)",
          }}
        >
          <div style={{ maxWidth: 760 }}>
            <span
              style={{
                display: "inline-block",
                padding: "3px 12px",
                borderRadius: 20,
                background: "rgba(17, 121, 90, 0.2)",
                color: "#8FD3B8",
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
            <p style={{ margin: 0, fontSize: 16, color: "#C3D4CB", lineHeight: 1.6 }}>
              International builders like Wix and Squarespace bill in USD, draining personal credit card travel limits and adding bank conversion fees. BizTrackBD gives your business high-speed edge hosting, custom domain, and an organized Lead Inbox starting from ৳ 399/mo payable directly with bKash or Nagad.
            </p>
          </div>

          <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/business/pricing"
              className="btn btn-primary"
              style={{
                background: "var(--accent, #11795A)",
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
      </div>
    </>
  );
}
