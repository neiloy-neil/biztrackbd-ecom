"use client";

import { useState } from "react";
import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";

const TEST_PROFILES = [
  {
    id: "safe",
    label: "Customer A (Safe Intent)",
    phone: "01712-345678",
    name: "Tanzimul Haque",
    address: "House 14, Road 7, Sector 4, Uttara, Dhaka",
    history: "24 of 25 completed (96% Delivery Success)",
    statusText: "SAFE TO SHIP · 96% SUCCESS",
    stampClass: "stamp-paid",
    merchantAction: "Auto-Approve and dispatch via Steadfast/Pathao with 1-click barcode generation.",
    lossAvoided: "Zero return risk observed. Customer routinely accepts parcels.",
  },
  {
    id: "moderate",
    label: "Customer B (Moderate Refusals)",
    phone: "01911-987654",
    name: "Kamrul Islam",
    address: "GEC Circle, Nasirabad, Chittagong",
    history: "7 of 11 completed (64% Delivery Success, 4 Returns)",
    statusText: "MODERATE RISK · 4 PARCELS RETURNED",
    stampClass: "stamp-review",
    merchantAction: "Hold order. Send automated Bangla SMS requesting ৳ 120 advance delivery fee via bKash.",
    lossAvoided: "Saves ৳ 135 return courier round-trip penalty if customer refuses parcel.",
  },
  {
    id: "high",
    label: "Customer C (Serial Refusal)",
    phone: "01833-112233",
    name: "Buyer (Unverified)",
    address: "Boardbazar, Gazipur",
    history: "2 of 9 completed (22% Delivery Success, 7 Refusals)",
    statusText: "HIGH REFUSAL RISK · 7 REJECTIONS",
    stampClass: "stamp-risk",
    merchantAction: "Flagged automatically. Require phone confirmation or full advance payment before packing.",
    lossAvoided: "Protects inventory from being held in courier transit for 10-14 days.",
  },
];

export function CodCalculatorSimulator() {
  const [monthlyOrders, setMonthlyOrders] = useState<number>(300);
  const [returnRate, setReturnRate] = useState<number>(15);
  const [selectedProfile, setSelectedProfile] = useState<number>(1); // Default to moderate risk

  const profile = TEST_PROFILES[selectedProfile] ?? TEST_PROFILES[0]!;

  // Calculations
  const rejectedParcels = Math.round(monthlyOrders * (returnRate / 100));
  const avgReturnCourierFee = 135; // Standard ৳135 round-trip fee in BD
  const monthlyLost = rejectedParcels * avgReturnCourierFee;
  const annualLost = monthlyLost * 12;
  const estimatedSavings = Math.round(monthlyLost * 0.7);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* 1. Lost Profit Calculator */}
      <div
        className="card ledger-border"
        style={{
          padding: "32px 28px",
          background: "#FFFFFF",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div>
            <span className="status-stamp stamp-risk">ROI &amp; LOSS CALCULATOR</span>
            <h3 style={{ margin: "6px 0 0", fontSize: 22, color: "var(--ink-ledger)" }}>
              How much money are refused COD parcels costing your business?
            </h3>
          </div>
          <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
            Based on average Bangladesh courier round-trip fees (৳ 135)
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginBottom: 24 }}>
          {/* Slider 1: Monthly Shipments */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
                Monthly COD Shipments:
              </label>
              <strong style={{ fontSize: 16, color: "var(--brand)" }}>
                {monthlyOrders} orders/mo
              </strong>
            </div>
            <input
              type="range"
              min="50"
              max="2000"
              step="25"
              value={monthlyOrders}
              onChange={(e) => setMonthlyOrders(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--brand)", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
              <span>50</span>
              <span>500</span>
              <span>1,000</span>
              <span>2,000+</span>
            </div>
          </div>

          {/* Slider 2: Return Rate */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
                Current Parcel Return Rate:
              </label>
              <strong style={{ fontSize: 16, color: "#B91C1C" }}>
                {returnRate}% return rate
              </strong>
            </div>
            <input
              type="range"
              min="5"
              max="35"
              step="1"
              value={returnRate}
              onChange={(e) => setReturnRate(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#B91C1C", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
              <span>5% (Low)</span>
              <span>15% (Typical BD Ecommerce)</span>
              <span>35% (High Risk)</span>
            </div>
          </div>
        </div>

        {/* Calculation Result Dashboard */}
        <div
          style={{
            background: "#FFFDFD",
            borderRadius: 12,
            padding: "20px 24px",
            border: "1.5px solid #FECACA",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>Rejected Parcels / Month</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#B91C1C", marginTop: 4 }}>
              {rejectedParcels} parcels
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>Monthly Courier Fees Lost</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#B91C1C", marginTop: 4 }}>
              ৳ {monthlyLost.toLocaleString("en-IN")}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>Annual Loss on Refusals</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink-ledger)", marginTop: 4 }}>
              ৳ {annualLost.toLocaleString("en-IN")}
            </div>
          </div>
          <div style={{ background: "#F0FDF4", padding: "10px 14px", borderRadius: 8, border: "1px solid #86EFAC" }}>
            <div style={{ fontSize: 11.5, color: "#166534", fontWeight: 700, textTransform: "uppercase" }}>
              Recoverable Margin:
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#15803D", marginTop: 2 }}>
              ~৳ {estimatedSavings.toLocaleString("en-IN")} / mo
            </div>
            <div style={{ fontSize: 11, color: "#166534" }}>Saved by verifying high-risk orders</div>
          </div>
        </div>
      </div>

      {/* 2. Live Order Risk Simulator */}
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
            <span className="status-stamp stamp-review">LIVE RISK SIMULATOR</span>
            <h3 style={{ margin: "6px 0 0", fontSize: 22, color: "var(--ink-ledger)" }}>
              How the BizTrackBD COD Shield scores an order before shipping
            </h3>
          </div>
          <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
            Cross-checks Steadfast and Pathao delivery logs
          </span>
        </div>

        {/* Profile Selector Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {TEST_PROFILES.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedProfile(idx)}
              style={{
                padding: "8px 16px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: selectedProfile === idx ? 700 : 500,
                border: selectedProfile === idx ? "2px solid var(--brand)" : "1px solid var(--line)",
                background: selectedProfile === idx ? "var(--tint)" : "#FAFAFC",
                color: selectedProfile === idx ? "var(--brand)" : "var(--ink-2)",
                cursor: "pointer",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Profile Inspection Window */}
        <div
          style={{
            background: "#F8FAFC",
            borderRadius: 12,
            padding: "20px 24px",
            border: "1px solid var(--line)",
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 20,
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className={`status-stamp ${profile.stampClass}`}>
                {profile.statusText}
              </span>
              <span style={{ fontSize: 13, color: "var(--ink-3)", fontWeight: 600 }}>
                Phone: {profile.phone}
              </span>
            </div>

            <h4 style={{ margin: 0, fontSize: 18, color: "var(--ink-ledger)" }}>
              {profile.name} · {profile.address}
            </h4>

            <div style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--ink-2)" }}>
              <strong>Courier Delivery Record:</strong> {profile.history}
            </div>

            <div style={{ marginTop: 12, fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5 }}>
              <strong>Recommended Merchant Action:</strong> {profile.merchantAction}
            </div>

            <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--ink-3)" }}>
              🛡️ {profile.lossAvoided}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <a
              href={demoAdminUrl("gadgetstudio")}
              className="btn btn-secondary btn-sm"
              style={{ background: "#FFFFFF" }}
            >
              Test in Admin Demo ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
