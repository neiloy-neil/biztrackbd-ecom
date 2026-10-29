"use client";

import { useState } from "react";

interface PlanRecommenderProps {
  onSelectFamily: (family: "store" | "portfolio") => void;
  onHighlightPlan?: (tier: string) => void;
}

export function PlanRecommender({ onSelectFamily, onHighlightPlan }: PlanRecommenderProps) {
  const [goal, setGoal] = useState<"store" | "business" | "portfolio">("store");
  const [scale, setScale] = useState<"starter" | "growth" | "high">("growth");

  // Determine recommendation
  let recTier = "PRO";
  let recFamily: "store" | "portfolio" = "store";
  let recReason = "";
  let recPrice = "৳ 1,499 / mo";

  if (goal === "store") {
    recFamily = "store";
    if (scale === "starter") {
      recTier = "STARTER";
      recPrice = "৳ 699 / mo";
      recReason = "Ideal for launching your first store with up to 500 orders a month and bKash/Nagad checkout.";
    } else if (scale === "growth") {
      recTier = "PRO";
      recPrice = "৳ 1,499 / mo";
      recReason = "Best for active D2C brands needing automated Steadfast/Pathao courier booking and full COD fraud protection.";
    } else {
      recTier = "BUSINESS";
      recPrice = "৳ 3,499 / mo";
      recReason = "Built for high-volume operations with 15 staff accounts, unlimited products and unlimited orders.";
    }
  } else {
    recFamily = "portfolio";
    if (scale === "starter") {
      recTier = "STARTER";
      recPrice = "৳ 399 / mo";
      recReason = "Perfect for a personal portfolio or professional landing page with custom domain and contact lead capture.";
    } else if (scale === "growth") {
      recTier = "PRO";
      recPrice = "৳ 799 / mo";
      recReason = "Best for clinics, restaurants, and local service providers needing structured bookings, menus, and WhatsApp dispatch.";
    } else {
      recTier = "BUSINESS";
      recPrice = "৳ 1,499 / mo";
      recReason = "For corporate firms and multi-branch agencies needing comprehensive page collections and team access.";
    }
  }

  const handleApply = () => {
    onSelectFamily(recFamily);
    onHighlightPlan?.(recTier);
    // Smooth scroll to the plan cards
    const el = document.getElementById("plan-cards-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div
      className="card ledger-border"
      style={{
        maxWidth: 780,
        width: "100%",
        boxSizing: "border-box",
        margin: "0 auto 36px",
        padding: "clamp(16px, 4vw, 24px)",
        background: "#FBF7EC",
        border: "1.5px solid var(--line-strong)",
        boxShadow: "0 4px 16px rgba(11, 77, 59, 0.05)",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <span className="status-stamp stamp-paid" style={{ fontSize: 11 }}>
            2-Question Plan Recommender
          </span>
          <h3 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700, color: "var(--ink-ledger)" }}>
            Not sure which plan matches your business?
          </h3>
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
          14-day free trial on all plans
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, marginBottom: 20 }}>
        {/* Question 1: Goal */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
            1. What is your primary website goal?
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { id: "store", label: "🛍️ Sell products online (Ecommerce)" },
              { id: "business", label: "💼 Win clients, quotes & bookings (Business)" },
              { id: "portfolio", label: "🎨 Showcase personal work (Portfolio)" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setGoal(opt.id as any)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  textAlign: "left",
                  fontSize: 13,
                  fontWeight: goal === opt.id ? 700 : 500,
                  border: goal === opt.id ? "1.5px solid var(--brand)" : "1px solid var(--line)",
                  background: goal === opt.id ? "#FFFFFF" : "transparent",
                  color: goal === opt.id ? "var(--brand)" : "var(--ink-2)",
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Question 2: Scale */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
            2. What scale is your current operation?
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { id: "starter", label: "🌱 Solo / Just getting started" },
              { id: "growth", label: "🚀 Growing business with active flow" },
              { id: "high", label: "🏢 Established company / Team operation" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setScale(opt.id as any)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  textAlign: "left",
                  fontSize: 13,
                  fontWeight: scale === opt.id ? 700 : 500,
                  border: scale === opt.id ? "1.5px solid var(--brand)" : "1px solid var(--line)",
                  background: scale === opt.id ? "#FFFFFF" : "transparent",
                  color: scale === opt.id ? "var(--brand)" : "var(--ink-2)",
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendation Banner */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          padding: "14px 18px",
          border: "1.5px solid #C6DFD3",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--brand)" }}>
            Recommended For You:
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink-ledger)", marginTop: 2 }}>
            {recFamily === "store" ? "Commerce" : "Business"} {recTier} · <span style={{ color: "var(--brand)" }}>{recPrice}</span>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 2 }}>{recReason}</div>
        </div>
        <button
          type="button"
          onClick={handleApply}
          className="btn btn-primary btn-sm"
          style={{ background: "var(--brand)" }}
        >
          View Plan Details ↓
        </button>
      </div>
    </div>
  );
}
