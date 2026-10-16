"use client";

import React from "react";
import Link from "next/link";
import type { SiteMode, BusinessVertical } from "@biztrackbd/core";

interface Props {
  siteMode: SiteMode;
  vertical: BusinessVertical | null;
  leads: any[];
  totalLeads: number;
  unreadLeads: number;
  totalBookings: number;
  pendingBookings: number;
  totalDownloads: number;
  totalContentItems: number;
  storeOrigin: string;
  userName: string;
}

const VERTICAL_LABELS: Record<string, string> = {
  RESTAURANT: "Restaurant & Dining",
  DOCTOR_CLINIC: "Doctor, Specialist & Clinic",
  PUBLIC_FIGURE: "Public Figure & Creator",
  BUSINESS_COMPANY: "Corporate & Agency",
  SERVICE_PROVIDER: "Professional Services",
  PERSONAL_PORTFOLIO: "Portfolio & Resume",
};

export function PortfolioCommandCenter({
  siteMode,
  vertical,
  leads,
  totalLeads,
  unreadLeads,
  totalBookings,
  pendingBookings,
  totalDownloads,
  totalContentItems,
  storeOrigin,
  userName,
}: Props) {
  const verticalTitle = vertical ? VERTICAL_LABELS[vertical] || vertical : "Business Website";

  return (
    <div className="portfolio-command-center" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Quick Launch Strip */}
      <div
        className="card"
        style={{
          padding: "16px 20px",
          background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
          color: "#ffffff",
          borderRadius: 10,
          boxShadow: "0 4px 6px -1px rgba(79, 70, 229, 0.2)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  padding: "2px 8px",
                  borderRadius: 12,
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {verticalTitle}
              </span>
              <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>Website Command Center</span>
            </div>
            <h2 style={{ margin: "6px 0 0", fontSize: "1.35rem", fontWeight: 700 }}>
              Lead & Visitor Headquarters
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.9rem", opacity: 0.9 }}>
              Track visitor inquiries, booking requests, and digital asset downloads in real time.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href="/services"
              className="btn btn-sm"
              style={{ background: "#ffffff", color: "#4f46e5", fontWeight: 600 }}
              prefetch={false}
            >
              + Services
            </Link>
            <Link
              href="/team"
              className="btn btn-sm"
              style={{ background: "#ffffff", color: "#4f46e5", fontWeight: 600 }}
              prefetch={false}
            >
              + Team
            </Link>
            <Link
              href="/downloads"
              className="btn btn-sm"
              style={{ background: "rgba(255,255,255,0.2)", color: "#ffffff", fontWeight: 600 }}
              prefetch={false}
            >
              + Downloads
            </Link>
            <a
              href={storeOrigin}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm"
              style={{ background: "rgba(255,255,255,0.2)", color: "#ffffff", fontWeight: 600 }}
            >
              View Live Website ↗
            </a>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
        <div className="card" style={{ padding: "16px 18px", border: "1px solid var(--border, #e2e8f0)", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600 }}>Total Leads</span>
            <span style={{ fontSize: "1.2rem" }}>📬</span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: 6, color: "var(--ink, #0f172a)" }}>
            {totalLeads}
          </div>
          <div style={{ fontSize: "0.8rem", color: unreadLeads > 0 ? "#dc2626" : "#16a34a", marginTop: 4, fontWeight: 500 }}>
            {unreadLeads > 0 ? `● ${unreadLeads} new unread inquiries` : "✓ All caught up"}
          </div>
        </div>

        <div className="card" style={{ padding: "16px 18px", border: "1px solid var(--border, #e2e8f0)", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600 }}>Bookings / Appointments</span>
            <span style={{ fontSize: "1.2rem" }}>📅</span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: 6, color: "#2563eb" }}>
            {totalBookings}
          </div>
          <div style={{ fontSize: "0.8rem", color: pendingBookings > 0 ? "#ea580c" : "#64748b", marginTop: 4, fontWeight: 500 }}>
            {pendingBookings > 0 ? `● ${pendingBookings} pending confirmation` : "No pending bookings"}
          </div>
        </div>

        <div className="card" style={{ padding: "16px 18px", border: "1px solid var(--border, #e2e8f0)", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600 }}>Downloads Delivered</span>
            <span style={{ fontSize: "1.2rem" }}>📥</span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: 6, color: "#16a34a" }}>
            {totalDownloads}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4 }}>
            Direct & lead magnet assets
          </div>
        </div>

        <div className="card" style={{ padding: "16px 18px", border: "1px solid var(--border, #e2e8f0)", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600 }}>Structured Items</span>
            <span style={{ fontSize: "1.2rem" }}>⚡</span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: 6, color: "#7c3aed" }}>
            {totalContentItems}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4 }}>
            Services, portfolio, and profiles
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Inquiries + Vertical Setup Checklist */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Recent Inquiries List */}
        <div className="card" style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: 8, overflow: "hidden" }}>
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid var(--border, #e2e8f0)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "var(--bg-muted, #f8fafc)",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Recent Visitor Inquiries & Leads</h3>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>
                Latest form submissions with instant WhatsApp follow-up links
              </p>
            </div>
            <Link href="/leads" className="btn btn-secondary btn-sm" prefetch={false}>
              View All ({totalLeads})
            </Link>
          </div>

          {leads.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: "#64748b" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>📭</div>
              <div style={{ fontWeight: 600 }}>No inquiries received yet</div>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
                Share your website URL or WhatsApp link with clients to start receiving leads.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border, #f1f5f9)" }}>
                    <th style={{ padding: "10px 14px" }}>Contact</th>
                    <th style={{ padding: "10px 14px" }}>Type / Message</th>
                    <th style={{ padding: "10px 14px", width: 90 }}>Status</th>
                    <th style={{ padding: "10px 14px", width: 110, textAlign: "right" }}>WhatsApp</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => {
                    const phone = l.phone?.replace(/[^0-9]/g, "");
                    const waNumber = phone ? (phone.startsWith("88") ? phone : phone.startsWith("0") ? `88${phone}` : `880${phone}`) : null;
                    const waUrl = waNumber ? `https://wa.me/${waNumber}?text=Hello%20${encodeURIComponent(l.name)},%20thank%20you%20for%20reaching%20out!` : null;

                    return (
                      <tr key={l.id} style={{ borderBottom: "1px solid var(--border, #f1f5f9)" }}>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 600, color: "var(--text, #1e293b)" }}>{l.name}</div>
                          <div className="muted" style={{ fontSize: "0.78rem" }}>
                            {l.phone || l.email || "No direct phone"}
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span
                            className="badge"
                            style={{
                              background: "#f1f5f9",
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              marginRight: 6,
                            }}
                          >
                            {l.type}
                          </span>
                          <span style={{ color: "#475569" }}>
                            {l.message ? l.message.slice(0, 60) + (l.message.length > 60 ? "..." : "") : "No message note"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span
                            className="badge"
                            style={{
                              padding: "2px 6px",
                              borderRadius: 10,
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              backgroundColor: l.status === "NEW" ? "#fef3c7" : l.status === "WON" ? "#dcfce7" : "#f1f5f9",
                              color: l.status === "NEW" ? "#b45309" : l.status === "WON" ? "#15803d" : "#475569",
                            }}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          {waUrl ? (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm"
                              style={{
                                background: "#25D366",
                                color: "#ffffff",
                                padding: "4px 8px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                borderRadius: 6,
                                textDecoration: "none",
                              }}
                            >
                              Chat 💬
                            </a>
                          ) : (
                            <span className="muted" style={{ fontSize: "0.75rem" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Launch & Checklist Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card" style={{ padding: 18, border: "1px solid var(--border, #e2e8f0)", borderRadius: 8 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: "0.95rem", fontWeight: 700 }}>
              Website Optimization Checklist
            </h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: 10 }}>
              <li style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#16a34a" }}>✓</span>
                <Link href="/settings/store" className="link" style={{ textDecoration: "none" }}>
                  Business Profile & WhatsApp
                </Link>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: totalContentItems > 0 ? "#16a34a" : "#94a3b8" }}>
                  {totalContentItems > 0 ? "✓" : "○"}
                </span>
                <Link href="/services" className="link" style={{ textDecoration: "none" }}>
                  Add Services & Pricing
                </Link>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: totalDownloads > 0 ? "#16a34a" : "#94a3b8" }}>
                  {totalDownloads > 0 ? "✓" : "○"}
                </span>
                <Link href="/downloads" className="link" style={{ textDecoration: "none" }}>
                  Upload Downloadable Brochure / CV
                </Link>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#94a3b8" }}>○</span>
                <Link href="/settings/domains" className="link" style={{ textDecoration: "none" }}>
                  Connect Custom Domain
                </Link>
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#94a3b8" }}>○</span>
                <Link href="/settings/import" className="link" style={{ textDecoration: "none" }}>
                  Smart Content Import Assistant
                </Link>
              </li>
            </ul>
          </div>

          <div
            className="card"
            style={{
              padding: 16,
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 8,
              fontSize: "0.85rem",
            }}
          >
            <div style={{ fontWeight: 600, color: "#166534", marginBottom: 4 }}>
              💡 Merchant Tip
            </div>
            <p style={{ margin: 0, color: "#15803d", fontSize: "0.82rem" }}>
              Add your website link to your Facebook page Bio and WhatsApp Business profile to direct potential clients straight into your inquiry funnel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
