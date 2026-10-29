"use client";

import Link from "next/link";
import { useState } from "react";
import { handleTabListKeyDown } from "@/lib/a11y";

export type ModeTab = "portfolio" | "hybrid" | "commerce";
const MODE_TABS: readonly ModeTab[] = ["portfolio", "hybrid", "commerce"];

interface MatrixItem {
  dimension: string;
  portfolio: string;
  hybrid: string;
  commerce: string;
}

const MATRIX_ROWS: MatrixItem[] = [
  {
    dimension: "Primary Business Goal",
    portfolio: "High-trust professional showcase, doctor consultation bookings, restaurant QR menu, and lead generation.",
    hybrid: "Dual Engine: Retain full service booking desk while selling branded merchandise, test kits, or takeaway dishes.",
    commerce: "High-velocity retail store operations, product catalogs, shopping cart, and rapid courier delivery.",
  },
  {
    dimension: "Active Public Routes",
    portfolio: "Showcase, Services, Doctor Chambers, Table Menu, Contact, and Lead Magnets (/appointment, /menu, /services).",
    hybrid: "Dual Routes Unlocked: All Portfolio booking routes PLUS Product Catalog, Cart, and Checkout (/products, /cart).",
    commerce: "Full Retail Storefront: Categorized Catalog, Product Variants, Cart, Single-Page Checkout, Customer Account.",
  },
  {
    dimension: "Checkout & Payments",
    portfolio: "Zero checkout friction. Inbound inquiry and appointment forms with WhatsApp alert.",
    hybrid: "Full bKash, Nagad, Card, and COD checkout enabled alongside consultation booking forms.",
    commerce: "Native bKash & Nagad with instant TrxID verification, stock reservation, and coupon engine.",
  },
  {
    dimension: "Logistics & Delivery",
    portfolio: "Not needed (in-person clinic visit, restaurant dining, or remote consulting).",
    hybrid: "1-Click automated courier booking for Steadfast, Pathao, and RedX with bulk shipping label printing.",
    commerce: "Multi-carrier rate shopping, national coverage (all 64 districts & 495+ upazilas), barcode scanning.",
  },
  {
    dimension: "Abuse Defense & Privacy",
    portfolio: "Bot honey-pot, IP/phone sliding window rate limiter, and cryptographic consent logging.",
    hybrid: "Full dual-layer defense: Public inquiry shield PLUS national COD return fraud score and duplicate order filter.",
    commerce: "Cross-store COD return fraud checker (85%+ delivery track record detection) and bot order throttling.",
  },
  {
    dimension: "Merchant Operating Desks",
    portfolio: "Split-pane Lead Workspace, 1-tap WhatsApp responder, immutable timeline follow-up notes, booking calendar.",
    hybrid: "Unified Lead Workspace PLUS Full Order Management System, Inventory Matrix, and Courier Tracking.",
    commerce: "Order Processing, Courier Reconciliation, Customer CRM, Stock Alerts, and Daily Financial Ledger.",
  },
  {
    dimension: "Transition Guarantee",
    portfolio: "Zero-Risk Start: Upgrade to Hybrid or Commerce anytime in 1 click without losing a single lead.",
    hybrid: "Guaranteed Zero Data Loss: Historical consultation inquiries and activity logs remain 100% intact.",
    commerce: "Switch to Hybrid anytime if your retail brand adds showroom appointments or custom tailoring services.",
  },
];

export function ModeArchitectureMatrix() {
  const [activeHighlight, setActiveHighlight] = useState<ModeTab>("hybrid");

  return (
    <div style={{ marginTop: 64, marginBottom: 40 }}>
      {/* Header */}
      <div style={{ textAlign: "center", maxWidth: 780, margin: "0 auto 36px" }}>
        <div style={{ display: "inline-flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <span
            className="status-stamp stamp-lead"
            style={{
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.5px",
            }}
          >
            ARCHITECTURE REVEALED
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--brand, #11795A)",
              background: "#E3F1EA",
              padding: "4px 10px",
              borderRadius: 16,
            }}
          >
            Zero Data Loss Guarantee
          </span>
        </div>
        <h2
          style={{
            fontSize: "clamp(26px, 4.5vw, 38px)",
            letterSpacing: "-1.1px",
            lineHeight: 1.18,
            fontWeight: 800,
            color: "var(--ink-ledger, #08382B)",
            margin: 0,
          }}
        >
          One platform. Three operating modes. Complete freedom to evolve.
        </h2>
        <p
          style={{
            fontSize: 16.5,
            color: "var(--ink-2, #3D5A52)",
            lineHeight: 1.6,
            margin: "14px auto 0",
          }}
        >
          Never get locked into a single-purpose website. Start as a consultation portfolio, clinic chamber, or restaurant menu. Expand to physical delivery whenever you are ready with an atomic, non-destructive mode transition.
        </p>
      </div>

      {/* Mode Comparison Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
          gap: 20,
          maxWidth: 1140,
          margin: "0 auto 48px",
        }}
      >
        {/* Card 1: Portfolio */}
        <div
          className="card ledger-border"
          style={{
            padding: "26px 22px",
            background: activeHighlight === "portfolio" ? "#FBF7EC" : "#FFFFFF",
            border: activeHighlight === "portfolio" ? "2px solid #11795A" : "1px solid var(--line, #DCE7E1)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transition: "all 0.2s ease",
            cursor: "pointer",
          }}
          onClick={() => setActiveHighlight("portfolio")}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="status-stamp stamp-lead" style={{ fontSize: 11 }}>PORTFOLIO MODE</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-3, #6F8F83)" }}>From ৳399/mo</span>
            </div>
            <h3 style={{ margin: "14px 0 6px", fontSize: 20, color: "var(--ink-ledger, #08382B)" }}>
              Lead &amp; Booking Engine
            </h3>
            <p style={{ fontSize: 13.5, color: "var(--ink-2, #3D5A52)", lineHeight: 1.5, margin: "0 0 16px" }}>
              Tailored for doctors, clinics, restaurants, law firms, and consultants who need client inquiries without ecommerce checkout.
            </p>

            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5 }}>
              <li style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#11795A" }}>✓</span>
                <span><strong>BMDC verified doctor credentials</strong> &amp; chamber schedule routing</span>
              </li>
              <li style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#11795A" }}>✓</span>
                <span><strong>Contactless digital QR menu</strong> with dish trays for dining</span>
              </li>
              <li style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#11795A" }}>✓</span>
                <span><strong>Anti-bot shielded lead capture</strong> with instant WhatsApp alert</span>
              </li>
              <li style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#11795A" }}>✓</span>
                <span><strong>Split-pane Lead Workspace</strong> with private follow-up notes</span>
              </li>
              <li style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#11795A" }}>⚡</span>
                <span><strong>1-Click Upgrade to Hybrid</strong> whenever physical items are added</span>
              </li>
            </ul>
          </div>

          <div style={{ marginTop: 24 }}>
            <Link
              href="/start?mode=portfolio&plan=starter"
              className="btn btn-secondary"
              style={{ width: "100%", justifyContent: "center", textAlign: "center", padding: "10px 0", fontSize: 14 }}
            >
              Start Portfolio Storefront
            </Link>
          </div>
        </div>

        {/* Card 2: Hybrid (Featured) */}
        <div
          className="card ledger-border"
          style={{
            padding: "26px 22px",
            background: "#FBF7EC",
            border: "2px solid #11795A",
            boxShadow: "0 8px 24px rgba(17, 121, 90, 0.12)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
            cursor: "pointer",
          }}
          onClick={() => setActiveHighlight("hybrid")}
        >
          <div
            style={{
              position: "absolute",
              top: -12,
              right: 18,
              background: "#11795A",
              color: "#FFFFFF",
              fontSize: 10.5,
              fontWeight: 800,
              padding: "3px 10px",
              borderRadius: 12,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}
          >
            DUAL-ENGINE ARCHITECTURE
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="status-stamp stamp-paid" style={{ fontSize: 11, background: "#E3F1EA", color: "#0B4D3B", borderColor: "#C6DFD3" }}>
                HYBRID MODE
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#11795A" }}>From ৳1,499/mo (Pro)</span>
            </div>
            <h3 style={{ margin: "14px 0 6px", fontSize: 20, color: "var(--ink-ledger, #08382B)" }}>
              Inquiries + Full Commerce
            </h3>
            <p style={{ fontSize: 13.5, color: "var(--ink-2, #3D5A52)", lineHeight: 1.5, margin: "0 0 16px" }}>
              Run both engines under one single brand domain: take appointment consultation bookings AND deliver physical merchandise.
            </p>

            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5 }}>
              <li style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#11795A" }}>✓</span>
                <span><strong>Dual Route Engine:</strong> /appointment and /products run side-by-side</span>
              </li>
              <li style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#11795A" }}>✓</span>
                <span><strong>Full Cart &amp; Checkout:</strong> bKash, Nagad, Cards, and Cash on Delivery</span>
              </li>
              <li style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#11795A" }}>✓</span>
                <span><strong>Courier Dispatch:</strong> 1-click booking for Pathao, Steadfast, and RedX</span>
              </li>
              <li style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#11795A" }}>✓</span>
                <span><strong>Zero Data Loss Guarantee:</strong> Historical leads are never deleted</span>
              </li>
              <li style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#11795A" }}>✓</span>
                <span><strong>Unified Admin Command:</strong> Lead Inbox + Order Fulfillment desks</span>
              </li>
            </ul>
          </div>

          <div style={{ marginTop: 24 }}>
            <Link
              href="/start?mode=business&plan=pro"
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", textAlign: "center", padding: "10px 0", fontSize: 14 }}
            >
              Choose Hybrid (Most Versatile)
            </Link>
          </div>
        </div>

        {/* Card 3: Commerce */}
        <div
          className="card ledger-border"
          style={{
            padding: "26px 22px",
            background: activeHighlight === "commerce" ? "#FBF7EC" : "#FFFFFF",
            border: activeHighlight === "commerce" ? "2px solid #11795A" : "1px solid var(--line, #DCE7E1)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            transition: "all 0.2s ease",
            cursor: "pointer",
          }}
          onClick={() => setActiveHighlight("commerce")}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="status-stamp stamp-pending" style={{ fontSize: 11 }}>COMMERCE MODE</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-3, #6F8F83)" }}>From ৳699/mo</span>
            </div>
            <h3 style={{ margin: "14px 0 6px", fontSize: 20, color: "var(--ink-ledger, #08382B)" }}>
              Pure Retail e-Commerce
            </h3>
            <p style={{ fontSize: 13.5, color: "var(--ink-2, #3D5A52)", lineHeight: 1.5, margin: "0 0 16px" }}>
              Built for high-volume retail merchants selling fashion, electronics, gadgets, and consumer goods nationwide.
            </p>

            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5 }}>
              <li style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#11795A" }}>✓</span>
                <span><strong>High-converting single-page checkout</strong> with fast OTP login</span>
              </li>
              <li style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#11795A" }}>✓</span>
                <span><strong>National COD Return Fraud Checker</strong> with cross-merchant scores</span>
              </li>
              <li style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#11795A" }}>✓</span>
                <span><strong>Multi-Carrier Courier Rate Shopping</strong> (Steadfast, Pathao, RedX)</span>
              </li>
              <li style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#11795A" }}>✓</span>
                <span><strong>Automated Invoices &amp; Barcodes</strong> with pos thermal print support</span>
              </li>
              <li style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#11795A" }}>⚡</span>
                <span><strong>Seamless transition to Hybrid</strong> if appointment services are added</span>
              </li>
            </ul>
          </div>

          <div style={{ marginTop: 24 }}>
            <Link
              href="/start?mode=ecommerce&plan=pro"
              className="btn btn-secondary"
              style={{ width: "100%", justifyContent: "center", textAlign: "center", padding: "10px 0", fontSize: 14 }}
            >
              Start Online Store
            </Link>
          </div>
        </div>
      </div>

      {/* Zero Data Loss Guarantee Protocol Callout */}
      <div
        className="card ledger-border"
        style={{
          maxWidth: 1140,
          margin: "0 auto 48px",
          padding: "24px 28px",
          background: "#FBF7EC",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div style={{ flex: "1 1 340px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>🛡️</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#0B4D3B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Guaranteed Zero Data Loss Protocol
            </span>
          </div>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "var(--ink-ledger, #08382B)" }}>
            What happens when you switch from Portfolio to Hybrid?
          </h3>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2, #3D5A52)", lineHeight: 1.6 }}>
            Unlike Shopify or WordPress—where switching between service templates and ecommerce themes can wipe customization and lead forms—BizTrackBD executes an <strong>atomic, non-destructive mode transition</strong>. Every historical consultation inquiry, patient booking, customer phone record, and timeline note is immutably preserved in PostgreSQL.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <div style={{ background: "#FFFFFF", padding: "12px 18px", borderRadius: 8, border: "1px solid var(--line, #DCE7E1)", minWidth: 160 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3, #6F8F83)" }}>PRE-FLIGHT DRY RUN</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-ledger, #08382B)", marginTop: 2 }}>Audited Impact Report</div>
          </div>
          <div style={{ background: "#FFFFFF", padding: "12px 18px", borderRadius: 8, border: "1px solid var(--line, #DCE7E1)", minWidth: 160 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3, #6F8F83)" }}>HISTORICAL DATA</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0B4D3B", marginTop: 2 }}>100% Leads Retained</div>
          </div>
          <div style={{ background: "#FFFFFF", padding: "12px 18px", borderRadius: 8, border: "1px solid var(--line, #DCE7E1)", minWidth: 160 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3, #6F8F83)" }}>OPERATOR CONSENT</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#11795A", marginTop: 2 }}>Full Audit Trail</div>
          </div>
        </div>
      </div>

      {/* Detailed Technical Feature Matrix by Mode */}
      <div style={{ maxWidth: 1140, margin: "0 auto" }}>
        <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 12, color: "var(--ink-ledger, #08382B)" }}>
          Detailed Operating Capabilities by Mode
        </h3>
        <div className="mobile-scroll-cue" style={{ display: "none", fontSize: 12.5, color: "var(--ink-3)", marginBottom: 8, fontStyle: "italic" }}>
          &larr; Swipe horizontally to compare all operating modes &rarr;
        </div>
        <div className="table-wrap" data-testid="mode-matrix-table" tabIndex={0} role="region" aria-label="Mode architecture comparison">
          <table className="compare">
            <thead>
              <tr>
                <th scope="col" style={{ width: "25%" }}>Operating Dimension</th>
                <th scope="col">
                  Portfolio Mode
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", marginTop: 2 }}>
                    Leads &amp; Bookings
                  </div>
                </th>
                <th scope="col" className="best" style={{ background: "#E3F1EA" }}>
                  Hybrid Mode
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand)", marginTop: 2 }}>
                    DUAL ENGINE
                  </div>
                </th>
                <th scope="col">
                  Commerce Mode
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", marginTop: 2 }}>
                    Retail e-Commerce
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {MATRIX_ROWS.map((row) => (
                <tr key={row.dimension}>
                  <th scope="row" style={{ fontWeight: 700, color: "var(--ink-ledger)" }}>{row.dimension}</th>
                  <td>{row.portfolio}</td>
                  <td className="best" style={{ background: "#FBF7EC", fontWeight: 600, color: "var(--ink-ledger)" }}>
                    {row.hybrid}
                  </td>
                  <td>{row.commerce}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
