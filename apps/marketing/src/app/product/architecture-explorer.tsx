"use client";

import Link from "next/link";
import { useState } from "react";
import { demoAdminUrl } from "@/lib/demo-admin";
import { handleTabListKeyDown } from "@/lib/a11y";

export type ArchitectureMode = "commerce" | "business" | "hybrid";
const ARCH_MODES: readonly ArchitectureMode[] = ["commerce", "business", "hybrid"];

export function ArchitectureExplorer() {
  const [activeMode, setActiveMode] = useState<ArchitectureMode>("commerce");

  return (
    <div style={{ marginTop: 40 }}>
      {/* Interactive Architecture Mode Selector */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 24,
          maxWidth: "100%",
          padding: "0 8px",
        }}
      >
        <div
          role="tablist"
          aria-label="Platform Architecture Mode"
          onKeyDown={(e) => handleTabListKeyDown(e, ARCH_MODES, activeMode, setActiveMode)}
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
            id="arch-tab-commerce"
            type="button"
            role="tab"
            aria-selected={activeMode === "commerce"}
            aria-controls="arch-panel-commerce"
            tabIndex={activeMode === "commerce" ? 0 : -1}
            onClick={() => setActiveMode("commerce")}
            style={{
              padding: "9px clamp(14px, 3.5vw, 24px)",
              borderRadius: "28px",
              background: activeMode === "commerce" ? "#FFFFFF" : "transparent",
              color: activeMode === "commerce" ? "#065F46" : "#667085",
              fontWeight: 700,
              fontSize: "clamp(13px, 2.5vw, 15px)",
              border: "none",
              cursor: "pointer",
              boxShadow: activeMode === "commerce" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.15s ease",
            }}
          >
            <span aria-hidden="true">🛍️</span> Commerce Engine
          </button>

          <button
            id="arch-tab-business"
            type="button"
            role="tab"
            aria-selected={activeMode === "business"}
            aria-controls="arch-panel-business"
            tabIndex={activeMode === "business" ? 0 : -1}
            onClick={() => setActiveMode("business")}
            style={{
              padding: "9px clamp(14px, 3.5vw, 24px)",
              borderRadius: "28px",
              background: activeMode === "business" ? "#FFFFFF" : "transparent",
              color: activeMode === "business" ? "var(--accent, #3B5BFD)" : "#667085",
              fontWeight: 700,
              fontSize: "clamp(13px, 2.5vw, 15px)",
              border: "none",
              cursor: "pointer",
              boxShadow: activeMode === "business" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.15s ease",
            }}
          >
            <span aria-hidden="true">🩺</span> Business Engine
          </button>

          <button
            id="arch-tab-hybrid"
            type="button"
            role="tab"
            aria-selected={activeMode === "hybrid"}
            aria-controls="arch-panel-hybrid"
            tabIndex={activeMode === "hybrid" ? 0 : -1}
            onClick={() => setActiveMode("hybrid")}
            style={{
              padding: "9px clamp(14px, 3.5vw, 24px)",
              borderRadius: "28px",
              background: activeMode === "hybrid" ? "#FFFFFF" : "transparent",
              color: activeMode === "hybrid" ? "#7C3AED" : "#667085",
              fontWeight: 700,
              fontSize: "clamp(13px, 2.5vw, 15px)",
              border: "none",
              cursor: "pointer",
              boxShadow: activeMode === "hybrid" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.15s ease",
            }}
          >
            <span aria-hidden="true">⚡</span> Unified Hybrid
          </button>
        </div>
      </div>

      {/* Simulated Live Architecture Console */}
      <div
        role="tabpanel"
        id={`arch-panel-${activeMode}`}
        aria-labelledby={`arch-tab-${activeMode}`}
        tabIndex={0}
        className="comparison-preview-stage"
        style={{ outline: "none" }}
      >
        <div className="comparison-window-header">
          <div className="window-dots">
            <span className="dot-red" />
            <span className="dot-yellow" />
            <span className="dot-green" />
          </div>
          <div>
            biztrackbd.sys · mode://
            <span style={{ color: activeMode === "commerce" ? "#059669" : activeMode === "business" ? "#3B5BFD" : "#7C3AED", fontWeight: 700 }}>
              {activeMode}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "#10B981" }}>● Live Dhaka Edge</span>
            <span style={{ fontSize: 11, background: "#E2E8F0", padding: "1px 6px", borderRadius: 4 }}>
              SSL Active
            </span>
          </div>
        </div>

        <div style={{ padding: "28px 24px", background: "#FFFFFF" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            {/* Layer 1: Edge & Ingestion */}
            <div
              style={{
                borderRadius: 12,
                border: "1px solid #E2E8F0",
                padding: "20px 18px",
                background: "#F8FAFC",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748B" }}>
                  01. Edge &amp; Delivery
                </span>
                <span className="spec-chip-positive" style={{ fontSize: 11 }}>
                  &lt; 85ms TTFB
                </span>
              </div>
              <h4 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px", color: "#0F172A" }}>
                Next.js Edge Proxy
              </h4>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Dhaka &amp; Singapore edge caching with automated SSL certificate provisioning on custom domains (.com, .com.bd).
              </p>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #E2E8F0", fontSize: 12, color: "#334155" }}>
                <div>✓ Brotli &amp; AVIF Asset Compression</div>
                <div>✓ Zero-Delay Mobile Render</div>
              </div>
            </div>

            {/* Layer 2: Core Domain Logic */}
            <div
              style={{
                borderRadius: 12,
                border: activeMode === "commerce" ? "2px solid #10B981" : activeMode === "business" ? "2px solid #3B5BFD" : "2px solid #8B5CF6",
                padding: "20px 18px",
                background: activeMode === "commerce" ? "#F0FDF4" : activeMode === "business" ? "#EFF6FF" : "#F5F3FF",
                boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: activeMode === "commerce" ? "#047857" : activeMode === "business" ? "#1D4ED8" : "#6D28D9" }}>
                  02. Active Engine Modules
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: "#FFFFFF",
                    color: activeMode === "commerce" ? "#047857" : activeMode === "business" ? "#1D4ED8" : "#6D28D9",
                    border: "1px solid rgba(0,0,0,0.1)",
                  }}
                >
                  {activeMode === "commerce" ? "Retail Pipeline" : activeMode === "business" ? "Service Pipeline" : "Dual Dual-Stack"}
                </span>
              </div>

              {activeMode === "commerce" && (
                <>
                  <h4 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px", color: "#065F46" }}>
                    Commerce Engine Active
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: "#047857", lineHeight: 1.6 }}>
                    <li>bKash &amp; Nagad TrxID Checkout</li>
                    <li>Steadfast &amp; Pathao 1-Click Pickups</li>
                    <li>COD Return Risk Shield Scoring</li>
                    <li>Inventory Decrement &amp; SKU Matrix</li>
                  </ul>
                </>
              )}

              {activeMode === "business" && (
                <>
                  <h4 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px", color: "#1E40AF" }}>
                    Business Engine Active
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: "#1D4ED8", lineHeight: 1.6 }}>
                    <li>BMDC Doctor Multi-Chamber Appointments</li>
                    <li>Table QR Menus &amp; Live Order Trays</li>
                    <li>Centralized Lead Inbox &amp; Staff Notes</li>
                    <li>Affirmative Consent Ingestion</li>
                  </ul>
                </>
              )}

              {activeMode === "hybrid" && (
                <>
                  <h4 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px", color: "#5B21B6" }}>
                    Unified Hybrid Pipeline Active
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: "#6D28D9", lineHeight: 1.6 }}>
                    <li>Retail checkout alongside appointment booking</li>
                    <li>Single customer record across parcels &amp; leads</li>
                    <li>Unified merchant desk with role permissions</li>
                    <li>Single BDT flat monthly subscription</li>
                  </ul>
                </>
              )}
            </div>

            {/* Layer 3: Security & Storage */}
            <div
              style={{
                borderRadius: 12,
                border: "1px solid #E2E8F0",
                padding: "20px 18px",
                background: "#F8FAFC",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748B" }}>
                  03. Trust &amp; Ledger
                </span>
                <span className="spec-chip-positive" style={{ fontSize: 11 }}>
                  AES-256 Vault
                </span>
              </div>
              <h4 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px", color: "#0F172A" }}>
                Multi-Tenant Vault
              </h4>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Isolated PostgreSQL database partitions with normalized SHA-256 Meta CAPI server telemetry and role-based staff access controls.
              </p>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #E2E8F0", fontSize: 12, color: "#334155" }}>
                <div>✓ Zero Raw PII Leaks</div>
                <div>✓ 0% Platform Sales Commission</div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontSize: 13.5, color: "#475467" }}>
              Selected deployment:{" "}
              <strong style={{ color: "#0F172A" }}>
                {activeMode === "commerce"
                  ? "BizTrackBD Commerce (Online Retail)"
                  : activeMode === "business"
                  ? "BizTrackBD Business (Services, Dining, Health)"
                  : "BizTrackBD Hybrid (Retail + Service Dual Mode)"}
              </strong>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <Link
                href={activeMode === "commerce" ? "/templates" : activeMode === "business" ? "/business/templates" : "/start?mode=hybrid"}
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  background: activeMode === "commerce" ? "#059669" : activeMode === "business" ? "#3B5BFD" : "#7C3AED",
                  padding: "7px 16px",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                Browse Matching Templates →
              </Link>
              <a
                href={demoAdminUrl()}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#0F172A",
                  background: "#F1F5F9",
                  padding: "7px 14px",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                Try Live Admin
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
