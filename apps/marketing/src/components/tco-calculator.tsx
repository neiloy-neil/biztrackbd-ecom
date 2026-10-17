"use client";

import React, { useState } from "react";
import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";

export type CompetitorId = "shopify" | "woocommerce" | "pathao";

interface TcoCalculatorProps {
  initialCompetitor?: CompetitorId;
  hideSelector?: boolean;
}

const COMPETITOR_CONFIG: Record<
  CompetitorId,
  {
    name: string;
    logoTag: string;
    description: string;
    badge: string;
    calculate: (orders: number, aov: number) => {
      baseFee: number;
      appsAndHosting: number;
      transactionFees: number;
      hiddenInefficiencies: number;
      total: number;
      lineItems: Array<{ label: string; amount: number; note: string }>;
    };
  }
> = {
  shopify: {
    name: "Shopify Basic",
    logoTag: "USD Billed · Foreign Gateway",
    description: "Requires dual-currency credit card with passport endorsement + 15% foreign payment tax.",
    badge: "$39/mo + 2% cut + apps",
    calculate: (orders: number, aov: number) => {
      // 1 USD = ~125 BDT + 15% card tax = ~143.75 BDT
      const usdToBdt = 143.75;
      const baseFee = Math.round(39 * usdToBdt); // ~৳ 5,606
      // Third-party BD apps: COD OTP app ($14), Courier Bridge ($19), Twilio SMS ($12)
      const appsAndHosting = Math.round(45 * usdToBdt); // ~৳ 6,468
      // 2.0% transaction fee because Shopify Payments is unavailable in Bangladesh
      const transactionFees = Math.round(orders * aov * 0.02);
      // Extra courier losses due to western address fields missing Upazila/Thana (~1.5% lost/delayed parcels)
      const hiddenInefficiencies = Math.round(orders * 0.015 * 135);

      const total = baseFee + appsAndHosting + transactionFees + hiddenInefficiencies;
      return {
        baseFee,
        appsAndHosting,
        transactionFees,
        hiddenInefficiencies,
        total,
        lineItems: [
          { label: "Shopify Base ($39 + 15% Card Tax)", amount: baseFee, note: "Paid in USD with dual-currency credit card" },
          { label: "Mandatory BD Apps Stack", amount: appsAndHosting, note: "COD verification ($14), Courier bridge ($19), SMS ($12)" },
          { label: "2.0% 3rd-Party Gateway Fee", amount: transactionFees, note: "Shopify takes 2% cut on non-Shopify Payments GMV" },
          { label: "Address Misroute Return Waste", amount: hiddenInefficiencies, note: "Missing Upazila/Thana fields cause undelivered courier returns" },
        ],
      };
    },
  },
  woocommerce: {
    name: "WooCommerce / WP",
    logoTag: "Self-Hosted · PHP Stack",
    description: "Requires cloud VPS, premium plugin annual renewals, developer maintenance, and manual courier wiring.",
    badge: "Hosting + Plugins + Dev Time",
    calculate: (orders: number) => {
      // Cloud hosting capable of handling flash sales without 502 Bad Gateway
      const baseFee = 3200; // VPS + Object Storage + CDN
      // Paid plugins: Premium bKash/Nagad (৳800/mo) + Steadfast/Pathao bridge (৳1000/mo) + Security/Backup (৳1000/mo)
      const appsAndHosting = 2800;
      const transactionFees = 0; // Direct wallet
      // Uncaught fake COD orders (no national pooled blacklist): ~3% extra returns * ৳135 return courier cost
      const hiddenInefficiencies = Math.round(orders * 0.03 * 135 + 2500); // ৳2500 dev maintenance

      const total = baseFee + appsAndHosting + transactionFees + hiddenInefficiencies;
      return {
        baseFee,
        appsAndHosting,
        transactionFees,
        hiddenInefficiencies,
        total,
        lineItems: [
          { label: "High-Traffic Cloud Hosting (VPS)", amount: baseFee, note: "Needed to prevent crashes during Eid flash sales" },
          { label: "Plugin Licenses & SMS Gateway", amount: appsAndHosting, note: "bKash plugin, courier bridge, and backup subscriptions" },
          { label: "Uncaught COD Return Parcel Losses", amount: Math.round(orders * 0.03 * 135), note: "No cross-merchant phone fraud database" },
          { label: "Ongoing Dev & Security Maintenance", amount: 2500, note: "PHP updates, plugin conflict debugging, database pruning" },
        ],
      };
    },
  },
  pathao: {
    name: "Pathao Commerce",
    logoTag: "Single Courier Ecosystem",
    description: "Ties your business exclusively to Pathao logistics with no multi-carrier competition or standalone domain.",
    badge: "Zero Platform Fee · High Parcel Lock-in",
    calculate: (orders: number) => {
      const baseFee = 500;
      const appsAndHosting = 0;
      const transactionFees = 0;
      // Single courier lock-in: Pathao outside Dhaka is ৳150 vs Steadfast ৳130. 65% of orders outside Dhaka.
      // Surcharge = orders * 0.65 * ৳20 = ৳13/order
      const courierDifferential = Math.round(orders * 0.65 * 20);
      // Extra returns due to no multi-courier backup when one area has poor Pathao rider coverage (~2% extra returns)
      const returnPenalty = Math.round(orders * 0.02 * 135);
      const hiddenInefficiencies = courierDifferential + returnPenalty;

      const total = baseFee + appsAndHosting + transactionFees + hiddenInefficiencies;
      return {
        baseFee,
        appsAndHosting,
        transactionFees,
        hiddenInefficiencies,
        total,
        lineItems: [
          { label: "Storefront Subscription", amount: baseFee, note: "Basic portal features" },
          { label: "Outside-Dhaka Courier Inefficiency", amount: courierDifferential, note: "Paying ৳150 vs Steadfast ৳130 on outside-Dhaka parcels" },
          { label: "Single-Carrier Undelivered Losses", amount: returnPenalty, note: "Inability to switch to Steadfast or RedX in weak zones" },
        ],
      };
    },
  },
};

export function TcoCalculator({
  initialCompetitor = "shopify",
  hideSelector = false,
}: TcoCalculatorProps) {
  const [competitor, setCompetitor] = useState<CompetitorId>(initialCompetitor);
  const [orders, setOrders] = useState<number>(400);
  const [aov, setAov] = useState<number>(1650);

  // BizTrackBD Plan calculation aligned with PLAN-001 canonical registry
  let biztrackPlanName = "Starter";
  let biztrackMonthly = 399;
  if (orders > 600) {
    biztrackPlanName = "Scale";
    biztrackMonthly = 1499;
  } else if (orders > 150) {
    biztrackPlanName = "Growth";
    biztrackMonthly = 799;
  }

  const selectedComp = COMPETITOR_CONFIG[competitor];
  const compResult = selectedComp.calculate(orders, aov);
  const monthlySavings = Math.max(0, compResult.total - biztrackMonthly);
  const annualSavings = monthlySavings * 12;

  return (
    <div className="tco-calculator-card">
      {/* Header */}
      <div className="tco-calc-header">
        <div className="tco-header-info">
          <div className="tco-meta-badge-row">
            <span className="tco-badge-paid">TCO BENCHMARK</span>
            <span className="tco-meta-date">Verified Bangladesh Cost Model · 2026</span>
          </div>
          <h3 className="tco-title">
            Realistic Bangladesh eCommerce Cost Calculator
          </h3>
          <p className="tco-subtitle">
            Compare true monthly operational expenses including foreign taxes, required apps, and delivery friction.
          </p>
        </div>

        {!hideSelector && (
          <div className="tco-selector-tabs">
            {(["shopify", "woocommerce", "pathao"] as CompetitorId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setCompetitor(id)}
                className={`tco-tab-btn${competitor === id ? " is-active" : ""}`}
              >
                {id === "shopify" ? "Shopify" : id === "woocommerce" ? "WooCommerce" : "Pathao Commerce"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sliders Grid */}
      <div className="tco-sliders-grid">
        <div className="tco-slider-box">
          <div className="tco-slider-top">
            <span className="tco-slider-label">Monthly Orders</span>
            <span className="tco-slider-stat">
              {orders.toLocaleString()} orders/mo
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={3000}
            step={25}
            value={orders}
            onChange={(e) => setOrders(Number(e.target.value))}
            className="tco-range-input"
            aria-label="Monthly Orders"
          />
          <div className="tco-slider-ticks">
            <span>50 orders</span>
            <span>1,000 orders</span>
            <span>3,000+ orders</span>
          </div>
        </div>

        <div className="tco-slider-box">
          <div className="tco-slider-top">
            <span className="tco-slider-label">Average Order Value (AOV)</span>
            <span className="tco-slider-stat tco-slider-stat-dark">
              ৳ {aov.toLocaleString()}
            </span>
          </div>
          <input
            type="range"
            min={500}
            max={6000}
            step={50}
            value={aov}
            onChange={(e) => setAov(Number(e.target.value))}
            className="tco-range-input"
            aria-label="Average Order Value"
          />
          <div className="tco-slider-ticks">
            <span>৳ 500</span>
            <span>৳ 3,000</span>
            <span>৳ 6,000</span>
          </div>
        </div>
      </div>

      {/* Cost Comparison Ledger */}
      <div className="tco-cards-grid">
        {/* Competitor Ledger Card */}
        <div className="tco-calc-pane tco-pane-competitor">
          <div>
            <div className="tco-pane-header">
              <div>
                <span className="tco-pane-eyebrow">CURRENT STACK</span>
                <h4 className="tco-pane-name">{selectedComp.name}</h4>
              </div>
              <span className="tco-badge-risk">{selectedComp.badge}</span>
            </div>

            <p className="tco-pane-desc">{selectedComp.description}</p>

            <div className="tco-line-items">
              {compResult.lineItems.map((item, idx) => (
                <div key={idx} className="tco-line-item">
                  <div>
                    <div className="tco-line-label">{item.label}</div>
                    <div className="tco-line-note">{item.note}</div>
                  </div>
                  <div className="tco-line-amount">
                    ৳ {item.amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="tco-total-box">
            <span className="tco-total-label">Estimated Monthly Cost:</span>
            <span className="tco-total-val-red">
              ৳ {compResult.total.toLocaleString()}
              <span className="tco-total-per-mo">/ mo</span>
            </span>
          </div>
        </div>

        {/* BizTrackBD Ledger Card */}
        <div className="tco-calc-pane tco-pane-biztrack">
          <div>
            <div className="tco-pane-header">
              <div>
                <span className="tco-pane-eyebrow">BIZTRACKBD ALL-IN-ONE</span>
                <h4 className="tco-pane-name">
                  BizTrackBD ({biztrackPlanName} Plan)
                </h4>
              </div>
              <span className="tco-badge-brand">FLAT TAKA BILLING</span>
            </div>

            <p className="tco-pane-desc">
              Zero sales commission. Native bKash &amp; Nagad checkout, multi-carrier Steadfast &amp; Pathao dispatch, and COD fraud protection included.
            </p>

            <div className="tco-line-items">
              <div className="tco-line-item">
                <div>
                  <div className="tco-line-label">Flat Platform Subscription</div>
                  <div className="tco-line-note">Payable via personal or merchant bKash/Nagad</div>
                </div>
                <div className="tco-line-amount">
                  ৳ {biztrackMonthly.toLocaleString()}
                </div>
              </div>
              <div className="tco-line-item">
                <div>
                  <div className="tco-line-label">Sales Commission &amp; Transaction Cuts</div>
                  <div className="tco-line-note">0% commission — you retain 100% of revenue</div>
                </div>
                <div className="tco-line-amount is-free">
                  ৳ 0 (Included)
                </div>
              </div>
              <div className="tco-line-item">
                <div>
                  <div className="tco-line-label">Multi-Courier Booking (Steadfast, Pathao, RedX)</div>
                  <div className="tco-line-note">Rate-shopping &amp; bulk thermal barcode labels</div>
                </div>
                <div className="tco-line-amount is-free">
                  ৳ 0 (Included)
                </div>
              </div>
              <div className="tco-line-item">
                <div>
                  <div className="tco-line-label">National COD Return Fraud Checker</div>
                  <div className="tco-line-note">Pooled courier delivery track record checks</div>
                </div>
                <div className="tco-line-amount is-free">
                  ৳ 0 (Included)
                </div>
              </div>
            </div>
          </div>

          <div className="tco-total-box">
            <span className="tco-total-label">BizTrackBD Monthly Cost:</span>
            <span className="tco-total-val-blue">
              ৳ {biztrackMonthly.toLocaleString()}
              <span className="tco-total-per-mo">/ mo</span>
            </span>
          </div>
        </div>
      </div>

      {/* Savings Callout Banner */}
      <div className="tco-banner-savings">
        <div>
          <div className="tco-savings-eyebrow">
            ESTIMATED MERCHANT SAVINGS
          </div>
          <div className="tco-savings-text">
            You save approximately{" "}
            <strong className="tco-savings-amount">
              ৳ {monthlySavings.toLocaleString()} / month
            </strong>{" "}
            (≈ ৳ {annualSavings.toLocaleString()} / year) in software, app fees, and misdirected parcel losses.
          </div>
        </div>

        <div className="tco-savings-ctas">
          <Link
            href="/start"
            className="btn-savings-white"
          >
            Start 14-Day Free Trial →
          </Link>
          <a
            href={demoAdminUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-savings-ghost"
          >
            Test Live Demo Desk ↗
          </a>
        </div>
      </div>
    </div>
  );
}
