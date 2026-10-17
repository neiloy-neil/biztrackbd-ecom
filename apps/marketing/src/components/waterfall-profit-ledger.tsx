"use client";

import { useState } from "react";
import { demoAdminUrl } from "@/lib/demo-admin";

export function WaterfallProfitLedger() {
  const [salePrice, setSalePrice] = useState<number>(2450);
  const [productCost, setProductCost] = useState<number>(1200);
  const [courierFee, setCourierFee] = useState<number>(70);
  const [adSpend, setAdSpend] = useState<number>(200);
  const [packagingCost, setPackagingCost] = useState<number>(30);

  const totalCosts = productCost + courierFee + adSpend + packagingCost;
  const netProfit = salePrice - totalCosts;
  const marginPercent = salePrice > 0 ? ((netProfit / salePrice) * 100).toFixed(1) : "0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* 1. Waterfall Ledger */}
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
            <span className="status-stamp stamp-paid">TRUE PROFIT WATERFALL</span>
            <h3 style={{ margin: "6px 0 0", fontSize: 22, color: "var(--ink-ledger)" }}>
              Topline revenue means nothing without true net accounting
            </h3>
          </div>
          <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
            Ledger formulas updated in real time
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 28 }}>
          {/* Left: Interactive Cost Sliders */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <label style={{ fontWeight: 700, color: "var(--ink)" }}>Order Sale Price:</label>
                <strong style={{ color: "var(--brand)" }}>৳ {salePrice}</strong>
              </div>
              <input
                type="range"
                min="500"
                max="10000"
                step="50"
                value={salePrice}
                onChange={(e) => setSalePrice(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--brand)", cursor: "pointer" }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <label style={{ fontWeight: 700, color: "var(--ink)" }}>Wholesale Product Cost:</label>
                <strong style={{ color: "#B91C1C" }}>-৳ {productCost}</strong>
              </div>
              <input
                type="range"
                min="100"
                max="5000"
                step="50"
                value={productCost}
                onChange={(e) => setProductCost(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#B91C1C", cursor: "pointer" }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <label style={{ fontWeight: 700, color: "var(--ink)" }}>Delivery &amp; Courier Fee:</label>
                <strong style={{ color: "#B91C1C" }}>-৳ {courierFee}</strong>
              </div>
              <input
                type="range"
                min="50"
                max="250"
                step="5"
                value={courierFee}
                onChange={(e) => setCourierFee(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#B91C1C", cursor: "pointer" }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <label style={{ fontWeight: 700, color: "var(--ink)" }}>Facebook Ad Spend per Order:</label>
                <strong style={{ color: "#B91C1C" }}>-৳ {adSpend}</strong>
              </div>
              <input
                type="range"
                min="0"
                max="600"
                step="10"
                value={adSpend}
                onChange={(e) => setAdSpend(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#B91C1C", cursor: "pointer" }}
              />
            </div>
          </div>

          {/* Right: Tabular Ledger Card */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1.5px solid var(--line-strong)",
              borderRadius: 12,
              padding: "20px 22px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 12 }}>
                Itemized Profit Ledger
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Gross Order Value:</span>
                  <strong style={{ color: "var(--ink-ledger)" }}>+ ৳ {salePrice}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#B91C1C" }}>
                  <span>Wholesale Inventory Cost:</span>
                  <span>- ৳ {productCost}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#B91C1C" }}>
                  <span>Courier Delivery Fee:</span>
                  <span>- ৳ {courierFee}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#B91C1C" }}>
                  <span>Marketing Ad Cost:</span>
                  <span>- ৳ {adSpend}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#B91C1C" }}>
                  <span>Polybag &amp; Packaging:</span>
                  <span>- ৳ {packagingCost}</span>
                </div>
              </div>
            </div>

            <div style={{ borderTop: "2px solid #0F172A", paddingTop: 14, marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--ink-ledger)" }}>True Net Profit:</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: netProfit >= 0 ? "#15803D" : "#B91C1C" }}>
                  ৳ {netProfit.toLocaleString("en-IN")}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2, textAlign: "right" }}>
                Net Margin: <strong style={{ color: "#15803D" }}>{marginPercent}%</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Courier Settlement Tracker */}
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
            <span className="status-stamp stamp-courier">SETTLEMENT RECONCILIATION</span>
            <h3 style={{ margin: "6px 0 0", fontSize: 22, color: "var(--ink-ledger)" }}>
              Know exactly how much money couriers owe your business
            </h3>
          </div>
          <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
            Automatically matched against Steadfast and Pathao invoice statements
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            background: "#F8FAFC",
            borderRadius: 12,
            padding: "20px 22px",
            border: "1px solid var(--line)",
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>Total COD Collected by Couriers</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink-ledger)", marginTop: 4 }}>
              ৳ 385,000
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Across 157 delivered parcels</div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>Deducted Courier Fees (1%)</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#B91C1C", marginTop: 4 }}>
              - ৳ 22,400
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Outbound &amp; return charges</div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>Bank Account Settled</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#15803D", marginTop: 4 }}>
              ৳ 362,600
            </div>
            <div style={{ fontSize: 11, color: "#166534" }}>Deposited into BRAC Bank</div>
          </div>

          <div style={{ background: "#F0FDF4", padding: "10px 14px", borderRadius: 8, border: "1px solid #86EFAC" }}>
            <div style={{ fontSize: 11.5, color: "#166534", fontWeight: 700, textTransform: "uppercase" }}>
              Pending Balance:
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#15803D", marginTop: 2 }}>
              ৳ 0.00
            </div>
            <div style={{ fontSize: 11, color: "#166534" }}>100% Fully Reconciled</div>
          </div>
        </div>

        <div style={{ marginTop: 16, textAlign: "right" }}>
          <a
            href={demoAdminUrl("gadgetstudio")}
            style={{ fontSize: 12.5, fontWeight: 700, color: "var(--brand)" }}
          >
            Inspect Profit &amp; Payout Records in Live Demo &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
