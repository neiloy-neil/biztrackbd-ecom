"use client";

import { useState } from "react";
import { demoAdminUrl } from "@/lib/demo-admin";

export function PaymentWalletMatcher() {
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [walletType, setWalletType] = useState<"bkash" | "nagad">("bkash");

  const sampleTrxId = walletType === "bkash" ? "9LK7129A" : "NG88219B";
  const walletColor = walletType === "bkash" ? "#E2136E" : "#F6921E";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* 1. Direct-to-Wallet vs Escrow Gateways Contrast */}
      <div
        className="card ledger-border"
        style={{
          padding: "32px 28px",
          background: "#FFFFFF",
          boxShadow: "0 10px 30px rgba(11, 77, 59, 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div>
            <span className="status-stamp stamp-paid">0% COMMISSION &middot; ZERO ESCROW</span>
            <h3 style={{ margin: "6px 0 0", fontSize: 22, color: "var(--ink-ledger)" }}>
              Where your customer&apos;s money actually goes
            </h3>
          </div>
          <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
            Personal wallet or merchant account friendly
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* The Gateway Escrow Way */}
          <div style={{ background: "#FDF1EA", padding: "20px 22px", borderRadius: 10, border: "1.5px solid #F2C9B3" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span className="status-stamp stamp-risk">TRADITIONAL PAYMENT GATEWAYS</span>
            </div>
            <h4 style={{ margin: "0 0 10px", fontSize: 17, color: "#9A3412" }}>
              Funds held in escrow with 2.5% cuts
            </h4>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.7 }}>
              <li>Customer payment goes into third-party bank escrow</li>
              <li>Platform deducts 2.0% to 3.5% transaction commission</li>
              <li>Withdrawal delayed by 3 to 7 business days</li>
              <li>Rejection or dispute freezes all your operating funds</li>
            </ul>
          </div>

          {/* The BizTrackBD Direct Way */}
          <div style={{ background: "#E3F1EA", padding: "20px 22px", borderRadius: 10, border: "1.5px solid #8FD3B8" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span className="status-stamp stamp-paid">THE BIZTRACKBD DIRECT WALLET</span>
            </div>
            <h4 style={{ margin: "0 0 10px", fontSize: 17, color: "#0B4D3B" }}>
              100% direct to your personal or merchant bKash
            </h4>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "var(--ink)", lineHeight: 1.7 }}>
              <li>Customer sends money straight to your mobile wallet number</li>
              <li>BizTrackBD charges <strong>0% sales commission</strong></li>
              <li>Instant cash liquidity on your phone to buy fabrics/stock</li>
              <li>Zero payout delays — money is already in your pocket</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 2. Interactive 1-Tap TrxID Matcher */}
      <div
        className="card ledger-border"
        style={{
          padding: "32px 28px",
          background: "#FFFFFF",
          boxShadow: "0 10px 30px rgba(11, 77, 59, 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div>
            <span className="status-stamp stamp-review">INTERACTIVE DESK SIMULATOR</span>
            <h3 style={{ margin: "6px 0 0", fontSize: 22, color: "var(--ink-ledger)" }}>
              How 1-tap TrxID verification works from your phone
            </h3>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => { setWalletType("bkash"); setIsVerified(false); }}
              style={{
                padding: "6px 14px",
                borderRadius: 16,
                fontSize: 12.5,
                fontWeight: 700,
                border: walletType === "bkash" ? "2px solid #E2136E" : "1px solid var(--line)",
                background: walletType === "bkash" ? "#FDF2F8" : "#FFFFFF",
                color: walletType === "bkash" ? "#E2136E" : "var(--ink-2)",
                cursor: "pointer",
              }}
            >
              bKash TrxID
            </button>
            <button
              type="button"
              onClick={() => { setWalletType("nagad"); setIsVerified(false); }}
              style={{
                padding: "6px 14px",
                borderRadius: 16,
                fontSize: 12.5,
                fontWeight: 700,
                border: walletType === "nagad" ? "2px solid #C2410C" : "1px solid var(--line)",
                background: walletType === "nagad" ? "#FDF1EA" : "#FFFFFF",
                color: walletType === "nagad" ? "#C2410C" : "var(--ink-2)",
                cursor: "pointer",
              }}
            >
              Nagad TrxID
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            background: "#FBF7EC",
            borderRadius: 12,
            padding: "22px 24px",
            border: "1px solid var(--line)",
            alignItems: "center",
          }}
        >
          {/* Customer View */}
          <div style={{ background: "#FFFFFF", padding: "18px 20px", borderRadius: 10, border: "1px solid var(--line)" }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", marginBottom: 6 }}>
              Step 1: Shopper Checkout View
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
              Send <strong>৳ 2,450</strong> to merchant number <strong>01700-000000</strong>
            </div>
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#FBF7EC", borderRadius: 6, fontFamily: "monospace", fontSize: 13 }}>
              Customer entered TrxID: <strong style={{ color: walletColor }}>{sampleTrxId}</strong>
            </div>
          </div>

          {/* Merchant Desk View */}
          <div style={{ background: "#FFFFFF", padding: "18px 20px", borderRadius: 10, border: isVerified ? "2px solid #11795A" : "1.5px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase" }}>
                Step 2: Merchant Admin Desk
              </span>
              <span className={`status-stamp ${isVerified ? "stamp-paid" : "stamp-review"}`}>
                {isVerified ? "VERIFIED & PAID" : "PENDING MATCH"}
              </span>
            </div>

            <div style={{ fontSize: 13.5, color: "var(--ink-ledger)" }}>
              Order #BD-4820 &middot; ৳ 2,450 &middot; Tanzimul Haque
            </div>

            <div style={{ marginTop: 14 }}>
              {isVerified ? (
                <div style={{ color: "#11795A", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  ✓ Payment confirmed. Order marked &ldquo;Processing&rdquo; and sent to courier queue.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsVerified(true)}
                  className="btn btn-primary btn-sm"
                  style={{ background: walletColor, width: "100%", justifyContent: "center" }}
                >
                  Confirm TrxID #{sampleTrxId} (1 Tap) →
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, textAlign: "right" }}>
          <a
            href={demoAdminUrl("gadgetstudio")}
            style={{ fontSize: 12.5, fontWeight: 700, color: "var(--brand)" }}
          >
            Test TrxID Verification in Live Demo Admin &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
