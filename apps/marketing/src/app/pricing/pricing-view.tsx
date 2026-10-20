"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { PlanCards, type PlanCardData } from "@/components/plan-cards";
import { PlanRecommender } from "@/components/plan-recommender";
import { demoAdminUrl } from "@/lib/demo-admin";
import { handleTabListKeyDown } from "@/lib/a11y";
import { ModeArchitectureMatrix } from "@/components/mode-architecture-matrix";

export interface ComparisonRow {
  label: string;
  starter: string;
  pro: string;
  business: string;
}

export type PricingTab = "store" | "portfolio";
const PRICING_TABS: readonly PricingTab[] = ["store", "portfolio"];

interface PricingViewProps {
  storePlans: PlanCardData[];
  portfolioPlans: PlanCardData[];
  bestStore?: string;
  bestPortfolio?: string;
  storeRows: ComparisonRow[];
  portfolioRows: ComparisonRow[];
}

export function PricingView({
  storePlans,
  portfolioPlans,
  bestStore = "PRO",
  bestPortfolio = "PRO",
  storeRows,
  portfolioRows,
}: PricingViewProps) {
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get("mode")?.toLowerCase();
  const [tab, setTab] = useState<PricingTab>(
    requestedMode === "portfolio" || requestedMode === "website" ? "portfolio" : "store"
  );
  const [highlightedTier, setHighlightedTier] = useState<string | null>(null);

  const isStore = tab === "store";
  const currentPlans = isStore ? storePlans : portfolioPlans;
  const currentBest = highlightedTier ?? (isStore ? bestStore : bestPortfolio);
  const currentRows = isStore ? storeRows : portfolioRows;

  return (
    <>
      {/* 2-Question Plan Recommender */}
      <div style={{ marginTop: 24 }}>
        <PlanRecommender
          onSelectFamily={(family) => setTab(family)}
          onHighlightPlan={(tier) => setHighlightedTier(tier)}
        />
      </div>

      {/* Segmented Mode Switcher */}
      <div id="plan-cards-section" style={{ textAlign: "center", marginTop: 28, marginBottom: 8, maxWidth: "100%", padding: "0 8px", boxSizing: "border-box" }}>
        <div
          role="tablist"
          aria-label="Choose plan category"
          onKeyDown={(e) => handleTabListKeyDown(e, PRICING_TABS, tab, setTab)}
          style={{
            display: "inline-flex",
            maxWidth: "100%",
            flexWrap: "wrap",
            justifyContent: "center",
            padding: 5,
            borderRadius: 28,
            background: "#F1F1F7",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
            gap: 4,
          }}
        >
          <button
            id="pricing-tab-store"
            type="button"
            role="tab"
            aria-selected={isStore}
            aria-controls="pricing-panel-store"
            tabIndex={isStore ? 0 : -1}
            onClick={() => setTab("store")}
            data-testid="tab-store-plans"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px clamp(12px, 3vw, 22px)",
              borderRadius: 22,
              border: isStore ? "1px solid #E2E1F6" : "1px solid transparent",
              background: isStore ? "#FFFFFF" : "transparent",
              color: isStore ? "var(--brand, #5B4FE8)" : "var(--ink-2, #64647A)",
              fontWeight: 700,
              fontSize: "clamp(13px, 2.5vw, 15px)",
              cursor: "pointer",
              boxShadow: isStore ? "0 2px 8px rgba(91,79,232,0.12)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            <span aria-hidden="true">🛍️</span> Online Store Plans <span style={{ fontSize: 11, opacity: 1, fontWeight: 600 }}>(From ৳699/mo)</span>
          </button>

          <button
            id="pricing-tab-portfolio"
            type="button"
            role="tab"
            aria-selected={!isStore}
            aria-controls="pricing-panel-portfolio"
            tabIndex={!isStore ? 0 : -1}
            onClick={() => setTab("portfolio")}
            data-testid="tab-portfolio-plans"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px clamp(12px, 3vw, 22px)",
              borderRadius: 22,
              border: !isStore ? "1px solid #E2E1F6" : "1px solid transparent",
              background: !isStore ? "#FFFFFF" : "transparent",
              color: !isStore ? "var(--brand, #5B4FE8)" : "var(--ink-2, #64647A)",
              fontWeight: 700,
              fontSize: "clamp(13px, 2.5vw, 15px)",
              cursor: "pointer",
              boxShadow: !isStore ? "0 2px 8px rgba(91,79,232,0.12)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            <span aria-hidden="true">🏢</span> Business &amp; Dining <span style={{ fontSize: 11, opacity: 1, fontWeight: 600 }}>(From ৳399/mo)</span>
          </button>
        </div>
      </div>

      {/* Pricing Tab Panel */}
      <div
        role="tabpanel"
        id={isStore ? "pricing-panel-store" : "pricing-panel-portfolio"}
        aria-labelledby={isStore ? "pricing-tab-store" : "pricing-tab-portfolio"}
        tabIndex={0}
        style={{ outline: "none" }}
      >

      {/* Dynamic Sub-heading Description */}
      <div style={{ textAlign: "center", margin: "16px auto 32px", maxWidth: 680 }}>
        <p style={{ fontSize: 16, color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
          {isStore
            ? "Complete e-commerce stores with cart, bKash/Nagad checkout, and 1-click Pathao & Steadfast courier dispatch. 0% sales commission."
            : "High-speed business websites for clinics, restaurants, agencies, and professionals. Capture WhatsApp leads, appointment bookings, and table reservations."}
        </p>
      </div>

      {/* Plan Cards */}
      <div style={{ textAlign: "center" }}>
        <PlanCards key={tab} plans={currentPlans} best={currentBest} />
      </div>

      <p className="fine" style={{ textAlign: "center", marginTop: 28, fontSize: 14.5 }}>
        Not sure yet?{" "}
        <a href={demoAdminUrl()} className="link" data-testid="pricing-demo-admin" style={{ fontWeight: 600 }}>
          Try the admin desk first, with no signup
        </a>
        .
      </p>

      {/* Comparison Table */}
      <div style={{ marginTop: 64 }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.6px", marginBottom: 12 }}>
          Compare {isStore ? "online store" : "business website"} features
        </h2>
        <div className="mobile-scroll-cue" style={{ display: "none", fontSize: 12.5, color: "var(--ink-3)", marginBottom: 8, fontStyle: "italic" }}>
          &larr; Swipe horizontally to inspect all plan tiers &rarr;
        </div>
        <div className="table-wrap" data-testid="compare" tabIndex={0} role="region" aria-label="Plan comparison">
          <table className="compare">
            <thead>
              <tr>
                <th scope="col" style={{ width: "34%" }}>Feature</th>
                <th scope="col">Starter</th>
                <th scope="col" className="best">
                  Pro
                  <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: "var(--brand)" }}>
                    MOST CHOSEN
                  </div>
                </th>
                <th scope="col">Business</th>
              </tr>
            </thead>
            <tbody>
              {currentRows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td>{r.starter}</td>
                  <td className="best">{r.pro}</td>
                  <td>{r.business}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* Multi-Mode Architecture & Zero-Data-Loss Transition Matrix */}
      <ModeArchitectureMatrix />
    </>
  );
}
