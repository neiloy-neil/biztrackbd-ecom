"use client";

import { useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n-core";

export function VisitorCounterSection({
  headline = "people are viewing this right now",
  headlineBn = "",
  minViewers = 8,
  maxViewers = 28,
  showCartCount = true,
  cartText = "people have this in their cart",
  cartTextBn = "",
  pulseIntervalSec = 6,
  icon = "fire",
  badgeStyle = "pill",
  lang = "en",
  editMarks,
}: {
  headline?: string;
  headlineBn?: string;
  minViewers?: number;
  maxViewers?: number;
  showCartCount?: boolean;
  cartText?: string;
  cartTextBn?: string;
  pulseIntervalSec?: number;
  icon?: string;
  badgeStyle?: "pill" | "card" | "minimal";
  lang?: Lang;
  editMarks?: Record<string, any>;
}) {
  const isBn = lang === "bn";
  const displayHeadline = isBn && headlineBn ? headlineBn : headline;
  const displayCartText = isBn && cartTextBn ? cartTextBn : cartText;

  const min = Math.max(1, minViewers);
  const max = Math.max(min + 1, maxViewers);

  // Initialize random count within range
  const [viewers, setViewers] = useState(() => Math.floor(min + (max - min) * 0.45));
  const [cartCount, setCartCount] = useState(() => Math.max(1, Math.floor(viewers * 0.28)));

  useEffect(() => {
    const interval = Math.max(3000, pulseIntervalSec * 1000);
    const timer = setInterval(() => {
      setViewers((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
        const next = Math.max(min, Math.min(max, prev + delta));
        setCartCount(Math.max(1, Math.floor(next * 0.28)));
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [min, max, pulseIntervalSec]);

  const iconGlyph = icon === "eye" ? "👁️" : icon === "users" ? "👥" : icon === "sparkles" ? "✨" : "🔥";

  if (badgeStyle === "minimal") {
    return (
      <div className="bt-visitor-sec" data-testid="visitor-counter-sec">
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2, #334155)" }}>
          <span className="bt-visitor-live-dot" aria-hidden="true" />
          <span aria-hidden="true">{iconGlyph}</span>
          <span>
            <strong className="bt-visitor-count">{viewers}</strong>{" "}
            <span {...editMarks?.headline}>{displayHeadline}</span>
          </span>
          {showCartCount && (
            <span className="bt-visitor-cart-badge">
              • <strong>{cartCount}</strong> <span {...editMarks?.cartText}>{displayCartText}</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  if (badgeStyle === "card") {
    return (
      <div className="bt-visitor-sec" data-testid="visitor-counter-sec">
        <div className="bt-visitor-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="bt-visitor-live-dot" aria-hidden="true" />
              <span style={{ fontSize: 16 }} aria-hidden="true">{iconGlyph}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                <span className="bt-visitor-count">{viewers}</span> {isBn ? "জন ক্রেতা সক্রিয়" : "Live Shoppers"}
              </span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#10b981", background: "rgba(16, 185, 129, 0.1)", padding: "2px 8px", borderRadius: 9999 }}>
              LIVE
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
            <span {...editMarks?.headline}>{displayHeadline}</span>
          </p>
          {showCartCount && (
            <div style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4, borderTop: "1px solid #f1f5f9", paddingTop: 6, marginTop: 2 }}>
              <span>🛒</span>
              <span>
                <strong>{cartCount}</strong> <span {...editMarks?.cartText}>{displayCartText}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default: pill style
  return (
    <div className="bt-visitor-sec" data-testid="visitor-counter-sec">
      <div className="bt-visitor-pill">
        <span className="bt-visitor-live-dot" aria-hidden="true" />
        <span style={{ fontSize: 15 }} aria-hidden="true">{iconGlyph}</span>
        <span>
          <strong className="bt-visitor-count">{viewers}</strong>{" "}
          <span {...editMarks?.headline}>{displayHeadline}</span>
        </span>
        {showCartCount && (
          <span className="bt-visitor-cart-badge">
            • <strong>{cartCount}</strong> <span {...editMarks?.cartText}>{displayCartText}</span>
          </span>
        )}
      </div>
    </div>
  );
}
