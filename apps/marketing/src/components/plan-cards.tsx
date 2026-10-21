"use client";

import Link from "next/link";
import { useState } from "react";

export interface PlanCardData {
  tier: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  monthsFree: number;
  bullets: string[];
  forText?: string;
  linkHref?: string;
}

const taka = (n: number) => `৳ ${n.toLocaleString("en-IN")}`;

const PLAN_FOR: Record<string, string> = {
  STARTER: "For new brands starting to take online orders.",
  PRO: "For growing stores with daily Pathao & Steadfast shipments.",
  BUSINESS: "For established brands managing large order volumes.",
};

/** The plan cards matching MktPricing.dc.html with Monthly or Yearly toggle. */
export function PlanCards({
  plans,
  best,
  compactBullets,
}: {
  plans: PlanCardData[];
  best?: string;
  compactBullets?: number;
}) {
  const [yearly, setYearly] = useState(false);
  const free = Math.max(0, ...plans.map((p) => p.monthsFree));

  return (
    <>
      {/* Canvas Billing Period Switch */}
      <div
        className="billing-toggle"
        role="group"
        aria-label="Billing period"
        style={{
          display: "inline-flex",
          padding: 4,
          borderRadius: 22,
          background: "#FBF7EC",
          fontSize: 14,
          fontWeight: 700,
          margin: "0 auto 36px",
        }}
      >
        <button
          type="button"
          aria-pressed={!yearly}
          onClick={() => setYearly(false)}
          style={{
            padding: "8px 22px",
            borderRadius: 18,
            border: !yearly ? "1px solid #DCE7E1" : "1px solid transparent",
            background: !yearly ? "#FFFFFF" : "transparent",
            color: !yearly ? "var(--ink)" : "var(--ink-2)",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          Monthly
        </button>
        <button
          type="button"
          aria-pressed={yearly}
          onClick={() => setYearly(true)}
          style={{
            padding: "8px 22px",
            borderRadius: 18,
            border: yearly ? "1px solid #DCE7E1" : "1px solid transparent",
            background: yearly ? "#FFFFFF" : "transparent",
            color: yearly ? "var(--ink)" : "var(--ink-2)",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          Yearly
          {free > 0 && (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 9,
                background: "#E3F1EA",
                color: "#11795A",
                fontSize: 11.5,
                fontWeight: 700,
              }}
            >
              {free} months free
            </span>
          )}
        </button>
      </div>

      {/* Canvas Cards Grid */}
      <div className="grid g3" data-testid="plans">
        {plans.map((p) => {
          const isBest = p.tier === best;
          const displayPrice = yearly ? Math.round(p.priceYearly / 12) : p.priceMonthly;
          const bulletsToShow = compactBullets ? p.bullets.slice(0, compactBullets) : p.bullets;
          const subText = p.forText || PLAN_FOR[p.tier] || "Storefront and admin desk included.";

          return (
            <div
              key={p.tier}
              className={`card plan${isBest ? " featured" : ""}`}
              data-testid={`plan-${p.tier}`}
              style={{
                border: isBest ? "2px solid #11795A" : "1px solid #DCE7E1",
                borderRadius: 18,
                padding: "32px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                background: "#FFFFFF",
                boxShadow: isBest ? "0 8px 24px rgba(17, 121, 90, 0.12)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{p.name}</h3>
                {isBest && (
                  <span
                    style={{
                      padding: "3px 11px",
                      borderRadius: 11,
                      background: "#E3F1EA",
                      color: "#11795A",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Most chosen
                  </span>
                )}
              </div>

              <div style={{ fontSize: 14.5, color: "var(--ink-2)", lineHeight: 1.55, minHeight: 44 }}>
                {subText}
              </div>

              <div>
                <span
                  style={{
                    fontSize: 44,
                    fontWeight: 800,
                    letterSpacing: "-1px",
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--ink)",
                  }}
                >
                  {taka(displayPrice)}
                </span>
                <span style={{ fontSize: 15, color: "var(--ink-2)", marginLeft: 6 }}>
                  /month
                </span>
                <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
                  {yearly
                    ? `${taka(p.priceYearly)} billed once a year`
                    : `${taka(p.priceMonthly * 12)} /year if paid monthly`}
                </div>
              </div>

              <Link
                href={p.linkHref || `/start?plan=${p.tier}`}
                className={`btn btn-lg ${isBest ? "btn-primary" : "btn-secondary"}`}
                style={{
                  height: 48,
                  borderRadius: 24,
                  fontSize: 15,
                  fontWeight: 700,
                  marginTop: 6,
                }}
                prefetch={false}
              >
                Start free trial
              </Link>

              <div
                style={{
                  borderTop: "1px solid #DCE7E1",
                  paddingTop: 20,
                  marginTop: 6,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  fontSize: 14.5,
                }}
              >
                {bulletsToShow.map((b) => (
                  <div key={b} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#11795A"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      style={{ flex: "0 0 18px", marginTop: 2 }}
                    >
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                    <span style={{ color: "var(--ink)" }}>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
