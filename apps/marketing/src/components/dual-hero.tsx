"use client";

import { useState } from "react";
import Link from "next/link";
import { demoAdminUrl } from "@/lib/demo-admin";
import { handleTabListKeyDown } from "@/lib/a11y";

export type HeroMode = "commerce" | "business";
const HERO_MODES: readonly HeroMode[] = ["commerce", "business"];

interface DualHeroProps {
  initialMode?: HeroMode;
  fromPriceCommerce?: string;
  fromPriceBusiness?: string;
}

export function DualHero({
  initialMode = "commerce",
  fromPriceCommerce = "৳ 399",
  fromPriceBusiness = "৳ 399",
}: DualHeroProps) {
  const [mode, setMode] = useState<HeroMode>(initialMode);

  // Commerce rail state
  const [commercePayment, setCommercePayment] = useState<"cod" | "bkash">("cod");
  const [commerceStep, setCommerceStep] = useState<number>(2); // Default on "Risk Review" to show BizTrack's biggest differentiator

  // Business rail state
  const [businessAction, setBusinessAction] = useState<"whatsapp" | "quote" | "booking">("quote");
  const [businessStep, setBusinessStep] = useState<number>(3); // Default on "Instant Enquiry"

  return (
    <section className="hero hero-center" style={{ background: mode === "commerce" ? "var(--cream)" : "var(--mint)", borderBottom: "1px solid var(--line)" }}>
      <div className="wrap">
        {/* Goal Switcher Selector */}
        <div style={{ marginBottom: 20 }}>
          <div
            className="goal-switcher-wrap"
            role="tablist"
            aria-label="Select your business goal"
            onKeyDown={(e) => handleTabListKeyDown(e, HERO_MODES, mode, setMode)}
          >
            <button
              id="goal-tab-commerce"
              type="button"
              role="tab"
              aria-selected={mode === "commerce"}
              aria-controls="hero-panel-commerce"
              tabIndex={mode === "commerce" ? 0 : -1}
              onClick={() => setMode("commerce")}
              className={`goal-btn ${mode === "commerce" ? "active-commerce" : ""}`}
              data-testid="goal-commerce-btn"
            >
              <span aria-hidden="true">🛍️</span>
              <span>Sell Products (Commerce)</span>
            </button>
            <button
              id="goal-tab-business"
              type="button"
              role="tab"
              aria-selected={mode === "business"}
              aria-controls="hero-panel-business"
              tabIndex={mode === "business" ? 0 : -1}
              onClick={() => setMode("business")}
              className={`goal-btn ${mode === "business" ? "active-business" : ""}`}
              data-testid="goal-business-btn"
            >
              <span aria-hidden="true">💼</span>
              <span>Win Enquiries &amp; Clients (Business)</span>
            </button>
          </div>
        </div>

        {/* Dynamic Panel Container */}
        <div
          role="tabpanel"
          id={mode === "commerce" ? "hero-panel-commerce" : "hero-panel-business"}
          aria-labelledby={mode === "commerce" ? "goal-tab-commerce" : "goal-tab-business"}
          tabIndex={0}
          style={{ outline: "none" }}
        >

        {/* Dynamic Eyebrow */}
        <span
          className="eyebrow"
          style={{
            color: mode === "commerce" ? "var(--brand)" : "var(--gold-dark)",
            background: mode === "commerce" ? "var(--tint)" : "var(--marigold-tint)",
            borderColor: mode === "commerce" ? "var(--tint-border)" : "#F6DE9A",
            borderWidth: 1,
            borderStyle: "solid",
            padding: "4px 14px",
            borderRadius: 20,
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            display: "inline-block",
            marginBottom: 14,
          }}
        >
          {mode === "commerce"
            ? "The Commerce Control Room for Bangladesh"
            : "Professional Business, Service & Portfolio Websites"}
        </span>

        {/* Dynamic H1 Headline */}
        {mode === "commerce" ? (
          <h1 style={{ color: "var(--ink-ledger)", fontSize: "clamp(34px, 5.5vw, 54px)", lineHeight: 1.12, letterSpacing: "-1.5px" }}>
            Every order. Every courier. <br className="hidden-mobile" />
            Every taka. <span style={{ color: "var(--brand)" }}>Under control.</span>
          </h1>
        ) : (
          <h1 style={{ color: "var(--ink-ledger)", fontSize: "clamp(34px, 5.5vw, 54px)", lineHeight: 1.12, letterSpacing: "-1.5px" }}>
            Turn searches, visits and shares <br className="hidden-mobile" />
            into <span style={{ color: "var(--gold-dark)" }}>real customer enquiries.</span>
          </h1>
        )}

        {/* Dynamic Lead Text */}
        <p className="lead" style={{ maxWidth: 740, margin: "18px auto 0", color: "var(--ink-2)", fontSize: "clamp(16px, 2vw, 19px)", lineHeight: 1.6 }}>
          {mode === "commerce" ? (
            <>
              Ecommerce software for Bangladesh bringing your online store, direct bKash/Nagad payment checks, COD return fraud shield, and 1-click Pathao &amp; Steadfast dispatches into one calm operating desk.
            </>
          ) : (
            <>
              Build a fast Bangla-and-English business website, connect your own domain, manage every page from your phone, and keep calls, WhatsApp chats, quote requests and bookings organized in one central lead inbox.
            </>
          )}
        </p>

        {mode === "commerce" && (
          <p className="brand-tagline">
            <span className="brand-tagline-arrow" aria-hidden="true" />
            <span className="bn" lang="bn">অর্ডার থেকে টাকা হাতে</span>
            <span aria-hidden="true">·</span>
            <span>Your store, your money</span>
          </p>
        )}

        {/* Action CTAs */}
        <div className="cta" style={{ marginTop: 28, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          {mode === "commerce" ? (
            <>
              <Link
                href="/start?mode=ecommerce"
                className="btn btn-primary btn-lg"
                style={{ background: "var(--brand)", borderColor: "var(--brand-dark)" }}
                prefetch={false}
                data-testid="hero-cta-commerce"
              >
                Start 14-day free trial
              </Link>
              <a
                href={demoAdminUrl("gadgetstudio")}
                className="btn btn-secondary btn-lg"
                data-testid="hero-demo-commerce"
                style={{ background: "#FFFFFF", color: "var(--ink-ledger)", border: "1.5px solid var(--line-strong)" }}
              >
                Try store admin desk (no signup) ↗
              </a>
            </>
          ) : (
            <>
              <Link
                href="/start?mode=business"
                className="btn btn-primary btn-lg"
                style={{ background: "var(--business)", borderColor: "var(--business-dark)" }}
                prefetch={false}
                data-testid="hero-cta-business"
              >
                Build my business website
              </Link>
              <a
                href={demoAdminUrl("modern-clinic")}
                className="btn btn-secondary btn-lg"
                data-testid="hero-demo-business"
                style={{ background: "#FFFFFF", color: "var(--ink-ledger)", border: "1.5px solid var(--line-strong)" }}
              >
                Try clinic &amp; business demo ↗
              </a>
            </>
          )}
        </div>

        {/* Value Trust Proof Line */}
        <p className="fine" style={{ marginTop: 14, fontSize: 13.5, color: "var(--ink-3)" }}>
          {mode === "commerce" ? (
            <>
              14 days free · No card needed · Plans from {fromPriceCommerce}/mo · <strong>0% commission on sales</strong>
            </>
          ) : (
            <>
              14 days free · Custom domain on every paid plan · Plans from {fromPriceBusiness}/mo · <strong>No developer needed</strong>
            </>
          )}
        </p>

        {/* ==========================================================================
            Lightweight Progressive Interactive Rail (Hero Signature Device)
            ========================================================================== */}
        <div style={{ marginTop: 38, textAlign: "left" }}>
          <div
            className="ledger-border"
            style={{
              maxWidth: 1040,
              margin: "0 auto",
              padding: "24px 22px",
              boxShadow: "0 10px 30px rgba(11, 77, 59, 0.07)",
              background: "#FFFFFF",
              border: `1.5px solid ${mode === "commerce" ? "#C6DFD3" : "#E3F1EA"}`,
            }}
          >
            {/* Top Rail Header & Controls */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 16,
                borderBottom: "1px solid var(--line)",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    color: mode === "commerce" ? "var(--brand)" : "var(--business)",
                  }}
                >
                  {mode === "commerce" ? "Interactive Order Journey" : "Interactive Lead Journey"}
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: "var(--ink-ledger)" }}>
                  {mode === "commerce"
                    ? "See how BizTrackBD automates an order from click to payout"
                    : "See how a prospective client becomes a verified booking or quote"}
                </h3>
              </div>

              {/* In-rail Toggles */}
              {mode === "commerce" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, background: "#FBF7EC", padding: 3, borderRadius: 20 }}>
                  <span style={{ padding: "0 8px", color: "var(--ink-3)", fontWeight: 600 }}>Payment method:</span>
                  <button
                    type="button"
                    onClick={() => setCommercePayment("cod")}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 16,
                      border: "none",
                      background: commercePayment === "cod" ? "#FFFFFF" : "transparent",
                      color: commercePayment === "cod" ? "var(--ink-ledger)" : "var(--ink-3)",
                      fontWeight: commercePayment === "cod" ? 700 : 500,
                      cursor: "pointer",
                      boxShadow: commercePayment === "cod" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    Cash on Delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommercePayment("bkash")}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 16,
                      border: "none",
                      background: commercePayment === "bkash" ? "#FFFFFF" : "transparent",
                      color: commercePayment === "bkash" ? "var(--brand)" : "var(--ink-3)",
                      fontWeight: commercePayment === "bkash" ? 700 : 500,
                      cursor: "pointer",
                      boxShadow: commercePayment === "bkash" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    bKash TrxID
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, background: "#FBF7EC", padding: 3, borderRadius: 20 }}>
                  <span style={{ padding: "0 8px", color: "var(--ink-3)", fontWeight: 600 }}>Inquiry action:</span>
                  <button
                    type="button"
                    onClick={() => setBusinessAction("quote")}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 16,
                      border: "none",
                      background: businessAction === "quote" ? "#FFFFFF" : "transparent",
                      color: businessAction === "quote" ? "var(--business)" : "var(--ink-3)",
                      fontWeight: businessAction === "quote" ? 700 : 500,
                      cursor: "pointer",
                      boxShadow: businessAction === "quote" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    Free Quote
                  </button>
                  <button
                    type="button"
                    onClick={() => setBusinessAction("booking")}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 16,
                      border: "none",
                      background: businessAction === "booking" ? "#FFFFFF" : "transparent",
                      color: businessAction === "booking" ? "var(--business)" : "var(--ink-3)",
                      fontWeight: businessAction === "booking" ? 700 : 500,
                      cursor: "pointer",
                      boxShadow: businessAction === "booking" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    Chamber Booking
                  </button>
                  <button
                    type="button"
                    onClick={() => setBusinessAction("whatsapp")}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 16,
                      border: "none",
                      background: businessAction === "whatsapp" ? "#FFFFFF" : "transparent",
                      color: businessAction === "whatsapp" ? "#11795A" : "var(--ink-3)",
                      fontWeight: businessAction === "whatsapp" ? 700 : 500,
                      cursor: "pointer",
                      boxShadow: businessAction === "whatsapp" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    WhatsApp Chat
                  </button>
                </div>
              )}
            </div>

            {/* Stepper Navigation Pills */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 8,
                margin: "18px 0",
              }}
            >
              {mode === "commerce" ? (
                <>
                  {[
                    { step: 1, label: "01. Storefront Order", desc: "Customer buys online" },
                    { step: 2, label: "02. Payment Check", desc: commercePayment === "cod" ? "COD flagged" : "TrxID verified" },
                    { step: 3, label: "03. COD Fraud Shield", desc: "Steadfast & Pathao risk" },
                    { step: 4, label: "04. 1-Click Courier", desc: "Print label & ship" },
                    { step: 5, label: "05. True Profit", desc: "Delivery & taka payout" },
                  ].map((s) => (
                    <button
                      key={s.step}
                      type="button"
                      onClick={() => setCommerceStep(s.step)}
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        borderRadius: 10,
                        border: commerceStep === s.step ? "2px solid var(--brand)" : "1px solid var(--line)",
                        background: commerceStep === s.step ? "var(--tint)" : "#FBF7EC",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: commerceStep === s.step ? "var(--brand)" : "var(--ink)" }}>
                        {s.label}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{s.desc}</div>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {[
                    { step: 1, label: "01. Discovery", desc: "Google or social visit" },
                    { step: 2, label: "02. Structured Work", desc: "Bilingual services & portfolio" },
                    { step: 3, label: "03. Instant Enquiry", desc: businessAction === "booking" ? "Chamber slot selected" : "WhatsApp or brief" },
                    { step: 4, label: "04. Lead Inbox", desc: "Team dispatch & alerts" },
                    { step: 5, label: "05. Conversion", desc: "Confirmed booking / client" },
                  ].map((s) => (
                    <button
                      key={s.step}
                      type="button"
                      onClick={() => setBusinessStep(s.step)}
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        borderRadius: 10,
                        border: businessStep === s.step ? "2px solid var(--business)" : "1px solid var(--line)",
                        background: businessStep === s.step ? "var(--business-tint)" : "#FBF7EC",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: businessStep === s.step ? "var(--business)" : "var(--ink)" }}>
                        {s.label}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{s.desc}</div>
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Active Step Content Simulation Window */}
            <div
              style={{
                background: "#FBF7EC",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "20px 22px",
                minHeight: 160,
              }}
            >
              {mode === "commerce" ? (
                <div>
                  {commerceStep === 1 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span className="status-stamp stamp-paid">NEW ORDER #BD-4820</span>
                          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Placed 2 mins ago via Storefront</span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: 17, color: "var(--ink-ledger)" }}>
                          Premium Wireless Earbuds (Matte Black) × 1
                        </h4>
                        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-2)" }}>
                          Customer: <strong>Tanzimul Haque</strong> (01712-345678) · House 14, Road 7, Sector 4, Uttara, Dhaka
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink-ledger)" }}>৳ 2,450</div>
                        <span className="status-stamp stamp-review">
                          {commercePayment === "cod" ? "COD: ৳2,450 DUE" : "bKash TrxID PENDING"}
                        </span>
                      </div>
                    </div>
                  )}

                  {commerceStep === 2 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span className="status-stamp stamp-paid">PAYMENT VERIFIED</span>
                          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Direct Wallet Settlement</span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: 17, color: "var(--ink-ledger)" }}>
                          {commercePayment === "cod"
                            ? "Cash on Delivery Order — Advance Delivery Fee Verified"
                            : "bKash TrxID #9LK7129A Verified Direct to Merchant Wallet"}
                        </h4>
                        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-2)" }}>
                          {commercePayment === "cod"
                            ? "Customer paid ৳120 courier booking charge in advance to confirm intent. Zero escrow, zero middleman delay."
                            : "Payment of ৳ 2,450 deposited straight into merchant wallet 01700-000000 with 0% platform sales cut."}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span className="status-stamp stamp-paid" style={{ fontSize: 13, padding: "5px 10px" }}>
                          ✓ ZERO COMMISSION DEDUCTED
                        </span>
                      </div>
                    </div>
                  )}

                  {commerceStep === 3 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span className="status-stamp stamp-paid">SAFE TO SHIP (96% DELIVERY RATE)</span>
                          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Cross-Courier History Check</span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: 17, color: "var(--ink-ledger)" }}>
                          Phone 01712-345678 checked across Steadfast &amp; Pathao logs
                        </h4>
                        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-2)" }}>
                          Customer has completed <strong>24 of 25 deliveries</strong> in the past 6 months. Low return risk. No fake address flags.
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => setCommerceStep(4)}
                          className="btn btn-primary btn-sm"
                          style={{ background: "var(--brand)" }}
                        >
                          Proceed to Courier Dispatch →
                        </button>
                      </div>
                    </div>
                  )}

                  {commerceStep === 4 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span className="status-stamp stamp-courier">STEADFAST BOOKED · CONSIGNMENT #ST-99821</span>
                          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>1-Click Automated API Dispatch</span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: 17, color: "var(--ink-ledger)" }}>
                          Shipping label generated with barcode &amp; Bangla SMS dispatched
                        </h4>
                        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-2)" }}>
                          Pickup requested at Dhanmondi Hub for tomorrow 11:00 AM. Tracking link sent to customer via SMS.
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ display: "inline-block", background: "#FFFFFF", padding: "6px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 12.5, fontWeight: 700 }}>
                          📄 Print Thermal Label
                        </span>
                      </div>
                    </div>
                  )}

                  {commerceStep === 5 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span className="status-stamp stamp-paid">PARCEL DELIVERED · PAYOUT RECONCILED</span>
                          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Bank Account Settled</span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: 17, color: "var(--ink-ledger)" }}>
                          Sale: ৳ 2,450 · Courier Fee: ৳ 70 · Product Cost: ৳ 1,400
                        </h4>
                        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-2)" }}>
                          Steadfast deposited <strong>৳ 2,380</strong> into your BRAC Bank account. True net profit: <strong style={{ color: "#11795A" }}>+৳ 980</strong>.
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#11795A" }}>+ ৳ 980 Net</div>
                        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Tabular Ledger Record</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {businessStep === 1 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span className="status-stamp stamp-lead">ORGANIC DISCOVERY</span>
                          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Search Intent: banani clinic doctor</span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: 17, color: "var(--ink-ledger)" }}>
                          Local patient finds your custom domain (modernclinic.com.bd)
                        </h4>
                        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-2)" }}>
                          Fast mobile performance on 4G networks. Clean Bangla and English navigation with chamber hours &amp; verified BMDC registration visible immediately.
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span className="status-stamp stamp-lead">BILINGUAL SEO ACTIVE</span>
                      </div>
                    </div>
                  )}

                  {businessStep === 2 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span className="status-stamp stamp-lead">SERVICES &amp; CREDENTIALS</span>
                          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Structured Page Content</span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: 17, color: "var(--ink-ledger)" }}>
                          Visitor reviews consultations, medical credentials, and chamber schedules
                        </h4>
                        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-2)" }}>
                          Includes interactive map directions to Popular Diagnostic Banani, consultation fees, and emergency helpline.
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--business)" }}>Banani &amp; Dhanmondi Chambers</span>
                      </div>
                    </div>
                  )}

                  {businessStep === 3 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span className="status-stamp stamp-lead">
                            {businessAction === "booking" ? "APPOINTMENT SLOT CHOSEN" : businessAction === "whatsapp" ? "WHATSAPP CHAT INITIATED" : "QUOTE FORM SUBMITTED"}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Direct Customer Action</span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: 17, color: "var(--ink-ledger)" }}>
                          {businessAction === "booking"
                            ? "Patient requested Saturday 6:30 PM slot for Diabetes Follow-up"
                            : businessAction === "whatsapp"
                            ? "Customer tapped WhatsApp button with pre-filled service inquiry"
                            : "Client submitted corporate project requirements via quote form"}
                        </h4>
                        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-2)" }}>
                          No lost inquiries across personal phones. Contact details and requirements securely captured.
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => setBusinessStep(4)}
                          className="btn btn-primary btn-sm"
                          style={{ background: "var(--business)" }}
                        >
                          View in Lead Inbox →
                        </button>
                      </div>
                    </div>
                  )}

                  {businessStep === 4 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span className="status-stamp stamp-lead">ORGANIZED LEAD INBOX</span>
                          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Staff Dispatch &amp; Notes</span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: 17, color: "var(--ink-ledger)" }}>
                          Clinic assistant reviews inquiry from smartphone and assigns to Chamber Secretary
                        </h4>
                        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-2)" }}>
                          Internal notes, status flags (Pending → Confirmed), and customer contact history in one structured panel.
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span className="status-stamp stamp-paid">STAFF ASSIGNED</span>
                      </div>
                    </div>
                  )}

                  {businessStep === 5 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span className="status-stamp stamp-paid">CONVERSION COMPLETE</span>
                          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Appointment Confirmed</span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: 17, color: "var(--ink-ledger)" }}>
                          Automated confirmation SMS sent to patient with serial number #14
                        </h4>
                        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-2)" }}>
                          Turned a casual search into a confirmed consulting appointment without paying third-party lead generation fees.
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--business)" }}>Serial #14</div>
                        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Confirmed Patient</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}
