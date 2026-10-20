"use client";

import { useState } from "react";
import { demoAdminUrl } from "@/lib/demo-admin";

export function MetaCapiSimulator() {
  const [browserCondition, setBrowserCondition] = useState<"adblock" | "normal">("adblock");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* 1. Deduplication & Ad-Block Simulator */}
      <div
        className="card ledger-border"
        style={{
          padding: "32px 28px",
          background: "#FFFFFF",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div>
            <span className="status-stamp stamp-paid">EVENT DEDUPLICATION SIMULATOR</span>
            <h3 style={{ margin: "6px 0 0", fontSize: 22, color: "var(--ink-ledger)" }}>
              How server CAPI rescues blocked browser purchases
            </h3>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => setBrowserCondition("adblock")}
              style={{
                padding: "6px 14px",
                borderRadius: 16,
                fontSize: 12.5,
                fontWeight: 700,
                border: browserCondition === "adblock" ? "2px solid #B91C1C" : "1px solid var(--line)",
                background: browserCondition === "adblock" ? "#FEE2E2" : "#FFFFFF",
                color: browserCondition === "adblock" ? "#B91C1C" : "var(--ink-2)",
                cursor: "pointer",
              }}
            >
              iOS / Ad-Blocker (30% in BD)
            </button>
            <button
              type="button"
              onClick={() => setBrowserCondition("normal")}
              style={{
                padding: "6px 14px",
                borderRadius: 16,
                fontSize: 12.5,
                fontWeight: 700,
                border: browserCondition === "normal" ? "2px solid #1D4ED8" : "1px solid var(--line)",
                background: browserCondition === "normal" ? "#EFF6FF" : "#FFFFFF",
                color: browserCondition === "normal" ? "#1D4ED8" : "var(--ink-2)",
                cursor: "pointer",
              }}
            >
              Standard Browser
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            background: "#F8FAFC",
            borderRadius: 12,
            padding: "22px 24px",
            border: "1px solid var(--line)",
          }}
        >
          {/* Channel A: Browser Pixel */}
          <div style={{ background: "#FFFFFF", padding: "18px 20px", borderRadius: 10, border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase" }}>
                1. Client Browser Pixel
              </span>
              <span className={`status-stamp ${browserCondition === "adblock" ? "stamp-risk" : "stamp-paid"}`}>
                {browserCondition === "adblock" ? "BLOCKED BY BROWSER" : "SENT (EVENT_ID: ORD-4820)"}
              </span>
            </div>
            <div style={{ fontSize: 13.5, color: "var(--ink-ledger)" }}>
              {browserCondition === "adblock"
                ? "Safari ITP, Brave, or uBlock Origin stopped the tracking JavaScript before checkout completed."
                : "Standard client JavaScript sent Purchase event with event_id: ord_4820."}
            </div>
          </div>

          {/* Channel B: Server CAPI */}
          <div style={{ background: "#FFFFFF", padding: "18px 20px", borderRadius: 10, border: "1.5px solid #86EFAC" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>
                2. Server-Side CAPI (BizTrackBD)
              </span>
              <span className="status-stamp stamp-paid">
                100% DELIVERED TO META
              </span>
            </div>
            <div style={{ fontSize: 13.5, color: "var(--ink-ledger)" }}>
              Direct server-to-server call via Meta Graph API with exact purchase value <strong>৳ 2,450</strong> and matching <code>event_id: ord_4820</code>.
            </div>
          </div>
        </div>

        {/* Deduplication Resolution Outcome */}
        <div
          style={{
            marginTop: 18,
            background: "#F0FDF4",
            padding: "14px 18px",
            borderRadius: 10,
            border: "1px solid #86EFAC",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>
              Meta Events Manager Outcome:
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink-ledger)", marginTop: 2 }}>
              {browserCondition === "adblock"
                ? "✓ 100% Attributed: Server CAPI rescued the lost conversion. Your ROAS calculation stays accurate."
                : "✓ Deduplicated: Meta recognized identical event_id 'ord_4820' and recorded 1 clean purchase. Zero double-counting."}
            </div>
          </div>
          <span className="status-stamp stamp-paid">EVENT MATCH QUALITY: 9.4/10</span>
        </div>
      </div>

      {/* 2. Privacy & Data Hashing Guarantee */}
      <div
        className="card ledger-border"
        style={{
          padding: "28px 26px",
          background: "#F8FAFC",
          border: "1.5px solid var(--line-strong)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span className="status-stamp stamp-paid">SHA-256 HASHING GUARANTEE</span>
          <span style={{ fontSize: 13, color: "var(--ink-3)", fontWeight: 600 }}>Ethical Tracking Compliance</span>
        </div>
        <h4 style={{ margin: 0, fontSize: 18, color: "var(--ink-ledger)" }}>
          What BizTrackBD sends — and what is permanently protected
        </h4>
        <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6 }}>
          Customer phone numbers and emails are normalized and irreversibly hashed using SHA-256 before transmission to Meta to assist with consented ad matching. We <strong>never</strong> send private customer chat messages, payment TrxIDs, courier risk results, internal staff notes, or bank account credentials.
        </p>
      </div>
    </div>
  );
}
