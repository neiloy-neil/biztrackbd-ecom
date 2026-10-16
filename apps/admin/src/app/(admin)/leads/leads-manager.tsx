"use client";

import React, { useState, useTransition } from "react";
import { updateBookingStatusAction, updateLeadStatusAction } from "./actions";
import type { BookingRequestStatus, SiteLeadStatus, SiteLeadType } from "@biztrackbd/db";

interface LeadItem {
  id: string;
  type: SiteLeadType;
  status: SiteLeadStatus;
  name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  sourcePage: string | null;
  createdAt: Date | string;
  bookingRequest?: {
    id: string;
    serviceName: string | null;
    providerName: string | null;
    requestedDate: Date | string | null;
    requestedTime: string | null;
    partySize: number | null;
    status: BookingRequestStatus;
  } | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  NEW: { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  REQUESTED: { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  CONTACTED: { bg: "#E0F2FE", text: "#0369A1", border: "#BAE6FD" },
  QUALIFIED: { bg: "#EEF2FF", text: "#4338CA", border: "#C7D2FE" },
  CONFIRMED: { bg: "#DCFCE7", text: "#15803D", border: "#BBF7D0" },
  WON: { bg: "#DCFCE7", text: "#15803D", border: "#BBF7D0" },
  DECLINED: { bg: "#FEE2E2", text: "#B91C1C", border: "#FECACA" },
  CANCELLED: { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" },
  CLOSED: { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" },
  SPAM: { bg: "#FFE4E6", text: "#9F1239", border: "#FECDD3" },
};

export function LeadsManager({ initialLeads }: { initialLeads: LeadItem[] }) {
  const [leads, setLeads] = useState<LeadItem[]>(initialLeads);
  const [filterTab, setFilterTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = leads.filter((item) => {
    if (filterTab === "new" && item.status !== "NEW") return false;
    if (filterTab === "bookings" && !item.bookingRequest) return false;
    if (filterTab === "quotes" && item.type !== "QUOTE") return false;
    if (filterTab === "contact" && item.type !== "CONTACT") return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.phone && item.phone.includes(q)) ||
      (item.email && item.email.toLowerCase().includes(q)) ||
      (item.message && item.message.toLowerCase().includes(q)) ||
      (item.bookingRequest?.serviceName && item.bookingRequest.serviceName.toLowerCase().includes(q))
    );
  });

  const handleStatusChange = (leadId: string, newStatus: SiteLeadStatus, bookingId?: string) => {
    startTransition(async () => {
      // Optimistic update
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
      );
      await updateLeadStatusAction(leadId, newStatus);
      if (bookingId) {
        const bStatus: BookingRequestStatus =
          newStatus === "QUALIFIED" || (newStatus as string) === "WON" || (newStatus as string) === "CONFIRMED" ? "CONFIRMED"
          : newStatus === "CONTACTED" ? "CONTACTED"
          : newStatus === "CLOSED" ? "DECLINED"
          : "REQUESTED";
        await updateBookingStatusAction(bookingId, bStatus);
      }
    });
  };

  const getCleanWaLink = (phone: string | null, name: string, leadId: string) => {
    if (!phone) return null;
    const clean = phone.replace(/[^0-9]/g, "");
    const formatted = clean.startsWith("88") ? clean : clean.startsWith("0") ? `88${clean}` : `880${clean}`;
    const text = `Hello ${name}, thank you for contacting us via our website (Ref: #${leadId.slice(-6)}). How can we assist you today?`;
    return `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Search and Tabs Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "16px",
          background: "var(--bg-card, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {[
            { id: "all", label: "All Inquiries" },
            { id: "new", label: `Unread (${leads.filter((l) => l.status === "NEW").length})` },
            { id: "bookings", label: "Appointments & Reservations" },
            { id: "quotes", label: "Quotes" },
            { id: "contact", label: "Contact Form" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid",
                borderColor: filterTab === tab.id ? "var(--accent, #0f172a)" : "transparent",
                background: filterTab === tab.id ? "var(--accent, #0f172a)" : "var(--bg-subtle, #f8fafc)",
                color: filterTab === tab.id ? "#ffffff" : "var(--text, #1e293b)",
                fontSize: "0.88rem",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ width: 260 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, message..."
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border, #cbd5e1)",
              fontSize: "0.88rem",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Leads List */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: "center",
            background: "var(--bg-card, #ffffff)",
            borderRadius: 12,
            border: "1px solid var(--border, #e2e8f0)",
            color: "var(--muted, #64748b)",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📬</div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 6px", color: "var(--text, #0f172a)" }}>
            No inquiries found
          </h3>
          <p style={{ fontSize: "0.9rem", margin: 0 }}>
            {search ? "No leads matched your search criteria." : "New contact form submissions and booking requests will appear here."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((item) => {
            const stColor = STATUS_COLORS[item.status] ?? STATUS_COLORS.NEW ?? { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" };
            const waLink = getCleanWaLink(item.phone, item.name, item.id);
            const booking = item.bookingRequest;

            return (
              <div
                key={item.id}
                style={{
                  background: "var(--bg-card, #ffffff)",
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: 12,
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  boxShadow: item.status === "NEW" ? "0 2px 10px rgba(245, 158, 11, 0.12)" : "none",
                  borderLeft: item.status === "NEW" ? "4px solid #f59e0b" : "1px solid var(--border, #e2e8f0)",
                }}
              >
                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        borderRadius: 6,
                        background: item.type === "RESERVATION" || item.type === "APPOINTMENT" ? "#ede9fe" : "#f1f5f9",
                        color: item.type === "RESERVATION" || item.type === "APPOINTMENT" ? "#6d28d9" : "#334155",
                      }}
                    >
                      {item.type}
                    </span>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--text, #0f172a)" }}>
                      {item.name}
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "var(--muted, #64748b)" }}>
                      Ref: #{item.id.slice(-6)}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 9999,
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        background: stColor.bg,
                        color: stColor.text,
                        border: `1px solid ${stColor.border}`,
                      }}
                    >
                      {item.status}
                    </span>

                    <select
                      value={item.status}
                      disabled={isPending}
                      onChange={(e) => handleStatusChange(item.id, e.target.value as SiteLeadStatus, booking?.id)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid var(--border, #cbd5e1)",
                        fontSize: "0.8rem",
                        background: "var(--bg, #ffffff)",
                        cursor: "pointer",
                      }}
                    >
                      <option value="NEW">Mark New</option>
                      <option value="CONTACTED">Mark Contacted</option>
                      <option value="QUALIFIED">Mark Qualified</option>
                      <option value="WON">Mark Won / Confirmed</option>
                      <option value="CLOSED">Mark Closed</option>
                      <option value="SPAM">Mark Spam</option>
                    </select>
                  </div>
                </div>

                {/* Booking details box if present */}
                {booking && (
                  <div
                    style={{
                      background: "var(--bg-subtle, #f8fafc)",
                      border: "1px solid var(--border, #e2e8f0)",
                      borderRadius: 8,
                      padding: "12px 16px",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 20,
                      fontSize: "0.88rem",
                    }}
                  >
                    {booking.serviceName && (
                      <div>
                        <span style={{ color: "var(--muted, #64748b)", display: "block", fontSize: "0.75rem" }}>Service / Specialty</span>
                        <strong>{booking.serviceName}</strong>
                      </div>
                    )}
                    {booking.providerName && (
                      <div>
                        <span style={{ color: "var(--muted, #64748b)", display: "block", fontSize: "0.75rem" }}>Chamber / Provider</span>
                        <strong>{booking.providerName}</strong>
                      </div>
                    )}
                    {booking.requestedDate && (
                      <div>
                        <span style={{ color: "var(--muted, #64748b)", display: "block", fontSize: "0.75rem" }}>Requested Date</span>
                        <strong>{new Date(booking.requestedDate).toLocaleDateString()}</strong>
                      </div>
                    )}
                    {booking.requestedTime && (
                      <div>
                        <span style={{ color: "var(--muted, #64748b)", display: "block", fontSize: "0.75rem" }}>Time / Session</span>
                        <strong>{booking.requestedTime}</strong>
                      </div>
                    )}
                    {booking.partySize && (
                      <div>
                        <span style={{ color: "var(--muted, #64748b)", display: "block", fontSize: "0.75rem" }}>Guests</span>
                        <strong>{booking.partySize} Person(s)</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* Message body */}
                {item.message && (
                  <div style={{ fontSize: "0.92rem", color: "var(--text, #334155)", lineHeight: 1.5, background: "#fafafa", padding: "10px 14px", borderRadius: 8 }}>
                    <span style={{ fontWeight: 600, display: "block", fontSize: "0.78rem", color: "var(--muted, #64748b)", marginBottom: 4 }}>Customer Note / Message:</span>
                    {item.message}
                  </div>
                )}

                {/* Footer contact actions */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                    paddingTop: 10,
                    borderTop: "1px solid var(--border, #f1f5f9)",
                  }}
                >
                  <div style={{ display: "flex", gap: 14, fontSize: "0.84rem", color: "var(--muted, #64748b)" }}>
                    {item.phone && <span>📞 {item.phone}</span>}
                    {item.email && <span>✉️ {item.email}</span>}
                    {item.sourcePage && <span>🔗 from {item.sourcePage}</span>}
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    {item.phone && (
                      <a
                        href={`tel:${item.phone}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 12px",
                          borderRadius: 6,
                          border: "1px solid var(--border, #cbd5e1)",
                          background: "#ffffff",
                          color: "var(--text, #0f172a)",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        📞 Call Customer
                      </a>
                    )}

                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 14px",
                          borderRadius: 6,
                          background: "#25D366",
                          color: "#ffffff",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          textDecoration: "none",
                          boxShadow: "0 2px 6px rgba(37, 211, 102, 0.25)",
                        }}
                      >
                        💬 Chat on WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
