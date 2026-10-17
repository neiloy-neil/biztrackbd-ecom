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
  domainName?: string | null;
  isDomainVerified?: boolean;
  whatsappNumber?: string | null;
  storeName?: string | null;
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
  REAL_ESTATE: "Real Estate & Properties",
  CONSULTING: "Consulting & Advisory",
  EVENT_PRODUCTION: "Event Production & Media",
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
  domainName,
  isDomainVerified,
  whatsappNumber,
  storeName,
  storeOrigin,
  userName,
}: Props) {
  const verticalTitle = vertical ? VERTICAL_LABELS[vertical] || vertical : "Business Website";

  // Calculate activation checklist progress
  const hasProfileAndWhatsApp = Boolean(whatsappNumber);
  const hasContent = totalContentItems > 0;
  const hasDomain = Boolean(domainName && isDomainVerified);
  const hasInquiries = totalLeads > 0 || totalBookings > 0;

  const checklistItems = [
    { label: "Vertical Template & Section Manifest Selected", done: true, href: "/design" },
    { label: "Configure WhatsApp Desk & Business Phone", done: hasProfileAndWhatsApp, href: "/settings/store" },
    { label: "Add Services, Menu, or Staff Profiles", done: hasContent, href: vertical === "RESTAURANT" ? "/menu" : "/services" },
    { label: "Connect Custom Domain & SSL", done: hasDomain, href: "/settings/domains" },
    { label: "Test Live Inquiry or Booking Submission", done: hasInquiries, href: "/leads" },
  ];

  const completedCount = checklistItems.filter((i) => i.done).length;
  const percentComplete = Math.round((completedCount / checklistItems.length) * 100);

  return (
    <div className="portfolio-command-center" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Quick Launch & Hero Strip */}
      <div
        className="card"
        style={{
          padding: "20px 24px",
          background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)",
          color: "#ffffff",
          borderRadius: 12,
          boxShadow: "0 10px 15px -3px rgba(30, 27, 75, 0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  background: "rgba(99, 102, 241, 0.35)",
                  border: "1px solid rgba(165, 180, 252, 0.4)",
                  padding: "3px 10px",
                  borderRadius: 12,
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#E0E7FF",
                }}
              >
                {verticalTitle}
              </span>
              <span style={{ fontSize: "0.85rem", color: "#C7D2FE", fontWeight: 500 }}>
                {siteMode === "HYBRID" ? "Hybrid Store & Services Hub" : "BizTrack Business Command Center"}
              </span>
            </div>
            <h2 style={{ margin: "8px 0 0", fontSize: "1.45rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
              {storeName || "Your Business"} Operations Desk
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.9rem", color: "#E0E7FF", opacity: 0.9 }}>
              Live on <strong style={{ color: "#ffffff" }}>{domainName || storeOrigin.replace(/^https?:\/\//, "")}</strong> • Dhaka Edge CDN &lt;85ms
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link
              href={vertical === "RESTAURANT" ? "/menu" : "/services"}
              className="btn btn-sm"
              style={{ background: "#ffffff", color: "#1E1B4B", fontWeight: 700, padding: "8px 14px", borderRadius: 8 }}
              prefetch={false}
            >
              + {vertical === "RESTAURANT" ? "Menu Items" : "Services"}
            </Link>
            <Link
              href="/team"
              className="btn btn-sm"
              style={{ background: "rgba(255, 255, 255, 0.15)", color: "#ffffff", fontWeight: 600, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.25)" }}
              prefetch={false}
            >
              + Team Profiles
            </Link>
            <Link
              href="/downloads"
              className="btn btn-sm"
              style={{ background: "rgba(255, 255, 255, 0.15)", color: "#ffffff", fontWeight: 600, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.25)" }}
              prefetch={false}
            >
              + Downloads
            </Link>
            <a
              href={storeOrigin}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm"
              style={{ background: "#6366F1", color: "#ffffff", fontWeight: 700, padding: "8px 14px", borderRadius: 8 }}
            >
              View Live Website ↗
            </a>
          </div>
        </div>
      </div>

      {/* Activation Checklist Banner */}
      <div
        className="card"
        style={{
          padding: "16px 20px",
          background: "var(--card, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.1rem" }}>🚀</span>
            <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--ink, #0f172a)" }}>
              Activation Checklist ({completedCount} of {checklistItems.length} Complete)
            </span>
          </div>
          <span style={{ fontWeight: 800, fontSize: "0.9rem", color: percentComplete === 100 ? "#16a34a" : "#4f46e5" }}>
            {percentComplete}%
          </span>
        </div>

        {/* Progress Bar */}
        <div style={{ width: "100%", height: 6, background: "#e2e8f0", borderRadius: 9999, overflow: "hidden", marginBottom: 14 }}>
          <div
            style={{
              width: `${percentComplete}%`,
              height: "100%",
              background: percentComplete === 100 ? "#16a34a" : "linear-gradient(90deg, #4f46e5, #7c3aed)",
              transition: "width 0.4s ease",
            }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {checklistItems.map((item, idx) => (
            <Link
              key={idx}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 6,
                background: item.done ? "#f0fdf4" : "#f8fafc",
                border: item.done ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                textDecoration: "none",
                fontSize: "0.82rem",
                color: item.done ? "#166534" : "#475569",
                fontWeight: item.done ? 600 : 500,
              }}
            >
              <span style={{ color: item.done ? "#16a34a" : "#94a3b8", fontWeight: 700 }}>
                {item.done ? "✓" : "○"}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Operational Telemetry KPI Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
        <div className="card" style={{ padding: "16px 18px", border: "1px solid var(--border, #e2e8f0)", borderRadius: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="muted" style={{ fontSize: "0.78rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
              Total Inquiries
            </span>
            <span style={{ fontSize: "1.2rem" }}>📬</span>
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, marginTop: 6, color: "var(--ink, #0f172a)" }}>
            {totalLeads}
          </div>
          <div style={{ fontSize: "0.8rem", color: unreadLeads > 0 ? "#dc2626" : "#16a34a", marginTop: 4, fontWeight: 600 }}>
            {unreadLeads > 0 ? `● ${unreadLeads} new unread waiting` : "✓ All inquiries reviewed"}
          </div>
        </div>

        <div className="card" style={{ padding: "16px 18px", border: "1px solid var(--border, #e2e8f0)", borderRadius: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="muted" style={{ fontSize: "0.78rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
              Appointments / Bookings
            </span>
            <span style={{ fontSize: "1.2rem" }}>📅</span>
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, marginTop: 6, color: "#2563eb" }}>
            {totalBookings}
          </div>
          <div style={{ fontSize: "0.8rem", color: pendingBookings > 0 ? "#ea580c" : "#64748b", marginTop: 4, fontWeight: 600 }}>
            {pendingBookings > 0 ? `● ${pendingBookings} awaiting confirmation` : "Zero pending requests"}
          </div>
        </div>

        <div className="card" style={{ padding: "16px 18px", border: "1px solid var(--border, #e2e8f0)", borderRadius: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="muted" style={{ fontSize: "0.78rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
              Downloads Delivered
            </span>
            <span style={{ fontSize: "1.2rem" }}>📥</span>
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, marginTop: 6, color: "#16a34a" }}>
            {totalDownloads}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4, fontWeight: 500 }}>
            Lead magnet & brochure cards
          </div>
        </div>

        <div className="card" style={{ padding: "16px 18px", border: "1px solid var(--border, #e2e8f0)", borderRadius: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="muted" style={{ fontSize: "0.78rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
              Content Entities
            </span>
            <span style={{ fontSize: "1.2rem" }}>⚡</span>
          </div>
          <div style={{ fontSize: "1.85rem", fontWeight: 800, marginTop: 6, color: "#7c3aed" }}>
            {totalContentItems}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4, fontWeight: 500 }}>
            Services, portfolio, and profiles
          </div>
        </div>
      </div>

      {/* Main Grid: Unattended Inquiries Queue + System & Integration Health */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Unattended Inquiries & Reservations Queue */}
        <div className="card" style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: 10, overflow: "hidden" }}>
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border, #e2e8f0)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "var(--bg-muted, #f8fafc)",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--ink, #0f172a)" }}>
                Unattended Inquiries & Reservations
              </h3>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>
                Direct customer form submissions with instant 1-tap WhatsApp follow-up links
              </p>
            </div>
            <Link href="/leads" className="btn btn-secondary btn-sm" style={{ fontWeight: 600 }} prefetch={false}>
              View All ({totalLeads})
            </Link>
          </div>

          {leads.length === 0 ? (
            <div style={{ padding: 42, textAlign: "center", color: "#64748b" }}>
              <div style={{ fontSize: "2.2rem", marginBottom: 10 }}>📭</div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--ink, #0f172a)" }}>Zero pending inquiries</div>
              <p style={{ margin: "4px 0 16px", fontSize: "0.85rem", maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
                Share your website URL or WhatsApp consultation link on social media to start acquiring customer leads.
              </p>
              <a
                href={storeOrigin}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
                style={{ fontWeight: 600 }}
              >
                Test Storefront Contact Form ↗
              </a>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border, #f1f5f9)", background: "#fafafa" }}>
                    <th style={{ padding: "10px 14px", fontWeight: 700, color: "#64748b", fontSize: "0.78rem" }}>CUSTOMER</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, color: "#64748b", fontSize: "0.78rem" }}>TYPE / DETAILS</th>
                    <th style={{ padding: "10px 14px", width: 90, fontWeight: 700, color: "#64748b", fontSize: "0.78rem" }}>STATUS</th>
                    <th style={{ padding: "10px 14px", width: 110, textAlign: "right", fontWeight: 700, color: "#64748b", fontSize: "0.78rem" }}>WHATSAPP</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => {
                    const phone = l.phone?.replace(/[^0-9]/g, "");
                    const waNumber = phone ? (phone.startsWith("88") ? phone : phone.startsWith("0") ? `88${phone}` : `880${phone}`) : null;
                    const waGreeting = `Hello ${l.name}, thank you for reaching out to ${storeName || "us"}! We received your inquiry regarding ${l.type}.`;
                    const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(waGreeting)}` : null;

                    return (
                      <tr key={l.id} style={{ borderBottom: "1px solid var(--border, #f1f5f9)" }}>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 700, color: "var(--ink, #1e293b)" }}>{l.name}</div>
                          <div className="muted" style={{ fontSize: "0.78rem", fontFamily: "monospace" }}>
                            {l.phone || l.email || "No contact"}
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span
                            className="badge"
                            style={{
                              background: "#e0e7ff",
                              color: "#3730a3",
                              padding: "2px 7px",
                              borderRadius: 4,
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              marginRight: 6,
                            }}
                          >
                            {l.type}
                          </span>
                          <span style={{ color: "#475569" }}>
                            {l.message ? l.message.slice(0, 55) + (l.message.length > 55 ? "..." : "") : "Inquiry submitted"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span
                            className="badge"
                            style={{
                              padding: "3px 8px",
                              borderRadius: 12,
                              fontSize: "0.72rem",
                              fontWeight: 700,
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
                                padding: "4px 9px",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                borderRadius: 6,
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <span>💬</span> WhatsApp
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

        {/* System & Integration Health Widget */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card" style={{ padding: 18, border: "1px solid var(--border, #e2e8f0)", borderRadius: 10 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <span>🩺</span> System &amp; Integration Health
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }}>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--ink, #0f172a)" }}>Custom Domain &amp; SSL</div>
                  <div className="muted" style={{ fontSize: "0.75rem" }}>
                    {domainName ? domainName : "Subdomain on biztrackbd.com"}
                  </div>
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: hasDomain ? "#16a34a" : "#ca8a04", padding: "2px 8px", background: hasDomain ? "#dcfce7" : "#fef9c3", borderRadius: 10 }}>
                  {hasDomain ? "Active (SSL ✓)" : "Default Edge"}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }}>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--ink, #0f172a)" }}>Meta CAPI &amp; Pixel</div>
                  <div className="muted" style={{ fontSize: "0.75rem" }}>Edge server-event proxy</div>
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#16a34a", padding: "2px 8px", background: "#dcfce7", borderRadius: 10 }}>
                  99.8% Match Rate
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }}>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--ink, #0f172a)" }}>Anti-Spam Bot Shield</div>
                  <div className="muted" style={{ fontSize: "0.75rem" }}>Honeypot + velocity throttle</div>
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#16a34a", padding: "2px 8px", background: "#dcfce7", borderRadius: 10 }}>
                  Active ✓
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--ink, #0f172a)" }}>Edge TTFB Latency</div>
                  <div className="muted" style={{ fontSize: "0.75rem" }}>Dhaka &amp; Singapore POPs</div>
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#16a34a", padding: "2px 8px", background: "#dcfce7", borderRadius: 10 }}>
                  &lt; 85ms Edge
                </span>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="card" style={{ padding: 18, border: "1px solid var(--border, #e2e8f0)", borderRadius: 10 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: "0.95rem", fontWeight: 700 }}>
              ⚡ Operational Shortcuts
            </h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: 8 }}>
              <li>
                <Link href={vertical === "RESTAURANT" ? "/menu" : "/services"} className="link" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>➕</span> Add {vertical === "RESTAURANT" ? "Menu Items" : "Services & Pricing"}
                </Link>
              </li>
              <li>
                <Link href="/leads" className="link" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>📋</span> Open Leads Operational Desk
                </Link>
              </li>
              <li>
                <Link href="/builder" className="link" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🎨</span> Edit Website Layout &amp; Theme
                </Link>
              </li>
              <li>
                <Link href="/settings/import" className="link" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🪄</span> Smart Content Import Assistant
                </Link>
              </li>
              <li>
                <Link href="/settings/domains" className="link" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🌐</span> Domain &amp; DNS Settings
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
