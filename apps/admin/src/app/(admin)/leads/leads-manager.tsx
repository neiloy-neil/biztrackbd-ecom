"use client";

import React, { useState, useTransition, useEffect, useMemo } from "react";
import { PageHeader } from "@biztrackbd/ui";
import {
  updateBookingStatusAction,
  updateLeadStatusAction,
  assignLeadAction,
  addLeadActivityNoteAction,
  getLeadActivitiesAction,
} from "./actions";
import type { BookingRequestStatus, SiteLeadStatus, SiteLeadType, LeadActivityType } from "@biztrackbd/db";

export interface LeadActivityItem {
  id: string;
  activityType: LeadActivityType;
  actorName: string | null;
  note: string | null;
  beforeStatus: SiteLeadStatus | null;
  afterStatus: SiteLeadStatus | null;
  metadata?: any;
  createdAt: Date | string;
}

export interface LeadItem {
  id: string;
  type: SiteLeadType;
  status: SiteLeadStatus;
  name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  sourcePage: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  assignedToUserId?: string | null;
  createdAt: Date | string;
  privateNotes?: string | null;
  bookingRequest?: {
    id: string;
    serviceName: string | null;
    providerName: string | null;
    requestedDate: Date | string | null;
    requestedTime: string | null;
    partySize: number | null;
    status: BookingRequestStatus;
    notes?: string | null;
  } | null;
  activities?: LeadActivityItem[];
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface LeadsManagerProps {
  initialLeads: LeadItem[];
  staffMembers: StaffMember[];
  initialTotal?: number;
  initialUnreadCount?: number;
}

const STATUS_CONFIG: Record<
  SiteLeadStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  NEW: { label: "New", bg: "#FEF3C7", text: "#92400E", border: "#FDE68A", dot: "#D97706" },
  CONTACTED: { label: "Contacted", bg: "#E0F2FE", text: "#0369A1", border: "#BAE6FD", dot: "#0284C7" },
  QUALIFIED: { label: "Qualified", bg: "#EEF2FF", text: "#4338CA", border: "#C7D2FE", dot: "#4F46E5" },
  WON: { label: "Won / Confirmed", bg: "#DCFCE7", text: "#15803D", border: "#BBF7D0", dot: "#16A34A" },
  CLOSED: { label: "Closed", bg: "#F1F5F9", text: "#475569", border: "#CBD5E1", dot: "#64748b" },
  SPAM: { label: "Spam", bg: "#FFE4E6", text: "#9F1239", border: "#FECDD3", dot: "#E11D48" },
};

const TYPE_CONFIG: Record<SiteLeadType, { label: string; badgeBg: string; badgeColor: string }> = {
  CONTACT: { label: "Contact", badgeBg: "#F1F5F9", badgeColor: "#334155" },
  QUOTE: { label: "Quote", badgeBg: "#FEF9C3", badgeColor: "#854D0E" },
  RESERVATION: { label: "Reservation", badgeBg: "#EDE9FE", badgeColor: "#6D28D9" },
  APPOINTMENT: { label: "Appointment", badgeBg: "#E0E7FF", badgeColor: "#3730A3" },
  MEDIA_BOOKING: { label: "Media / Session", badgeBg: "#FCE7F3", badgeColor: "#9D174D" },
};

function formatRelativeTime(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatDhakaDateTime(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function LeadsManager({
  initialLeads,
  staffMembers,
}: LeadsManagerProps) {
  const [leads, setLeads] = useState<LeadItem[]>(initialLeads);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(
    initialLeads.length > 0 && initialLeads[0] ? initialLeads[0].id : null
  );

  // Filters
  const [statusTab, setStatusTab] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  // Timeline / Note draft
  const [newNoteText, setNewNoteText] = useState<string>("");
  const [newNoteType, setNewNoteType] = useState<LeadActivityType>("NOTE_ADDED");
  const [activitiesMap, setActivitiesMap] = useState<Record<string, LeadActivityItem[]>>({});
  const [isLoadingActivities, setIsLoadingActivities] = useState<boolean>(false);

  const [isPending, startTransition] = useTransition();

  // Find currently selected lead
  const selectedLead = useMemo(() => {
    return leads.find((l) => l.id === selectedLeadId) || null;
  }, [leads, selectedLeadId]);

  // Load full activity timeline when selected lead changes
  useEffect(() => {
    if (!selectedLeadId) return;

    // Use initial activities if available, then fetch latest
    const lead = leads.find((l) => l.id === selectedLeadId);
    if (lead?.activities && lead.activities.length > 0) {
      setActivitiesMap((prev) => ({
        ...prev,
        [selectedLeadId]: [...lead.activities!].reverse(),
      }));
    }

    setIsLoadingActivities(true);
    getLeadActivitiesAction(selectedLeadId)
      .then((res) => {
        if (res.ok && res.data) {
          setActivitiesMap((prev) => ({
            ...prev,
            [selectedLeadId]: res.data as LeadActivityItem[],
          }));
        }
      })
      .catch((err) => {
        console.error("Failed to load lead activities:", err);
      })
      .finally(() => {
        setIsLoadingActivities(false);
      });
  }, [selectedLeadId]);

  // Status counts for tabs
  const counts = useMemo(() => {
    return {
      ALL: leads.length,
      NEW: leads.filter((l) => l.status === "NEW").length,
      CONTACTED: leads.filter((l) => l.status === "CONTACTED").length,
      QUALIFIED: leads.filter((l) => l.status === "QUALIFIED").length,
      WON: leads.filter((l) => l.status === "WON").length,
      CLOSED: leads.filter((l) => l.status === "CLOSED").length,
      SPAM: leads.filter((l) => l.status === "SPAM").length,
    };
  }, [leads]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Status filter
      if (statusTab !== "ALL" && lead.status !== statusTab) return false;

      // Type filter
      if (typeFilter !== "ALL" && lead.type !== typeFilter) return false;

      // Assignee filter
      if (assigneeFilter === "UNASSIGNED" && lead.assignedToUserId) return false;
      if (assigneeFilter !== "ALL" && assigneeFilter !== "UNASSIGNED" && lead.assignedToUserId !== assigneeFilter) return false;

      // Search term
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = lead.name.toLowerCase().includes(q);
        const matchesPhone = lead.phone ? lead.phone.includes(q) : false;
        const matchesEmail = lead.email ? lead.email.toLowerCase().includes(q) : false;
        const matchesMessage = lead.message ? lead.message.toLowerCase().includes(q) : false;
        const matchesService = lead.bookingRequest?.serviceName
          ? lead.bookingRequest.serviceName.toLowerCase().includes(q)
          : false;
        const matchesProvider = lead.bookingRequest?.providerName
          ? lead.bookingRequest.providerName.toLowerCase().includes(q)
          : false;
        const matchesNotes = lead.privateNotes ? lead.privateNotes.toLowerCase().includes(q) : false;

        if (!matchesName && !matchesPhone && !matchesEmail && !matchesMessage && !matchesService && !matchesProvider && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [leads, statusTab, typeFilter, assigneeFilter, search]);

  // Keep selection synchronized if current selection is filtered out
  useEffect(() => {
    if (filteredLeads.length > 0) {
      if (!selectedLeadId || !filteredLeads.some((l) => l.id === selectedLeadId)) {
        setSelectedLeadId(filteredLeads[0]?.id ?? null);
      }
    } else {
      setSelectedLeadId(null);
    }
  }, [filteredLeads, selectedLeadId]);

  // Actions
  const handleStatusChange = (leadId: string, newStatus: SiteLeadStatus, bookingId?: string) => {
    startTransition(async () => {
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
      );

      // Add optimistic activity
      const staffActorName = "You (Admin)";
      const optimisticActivity: LeadActivityItem = {
        id: `opt_${Date.now()}`,
        activityType: "STATUS_CHANGED",
        actorName: staffActorName,
        note: `Status updated to ${newStatus}`,
        beforeStatus: selectedLead?.status || null,
        afterStatus: newStatus,
        createdAt: new Date().toISOString(),
      };
      setActivitiesMap((prev) => ({
        ...prev,
        [leadId]: [...(prev[leadId] || []), optimisticActivity],
      }));

      await updateLeadStatusAction(leadId, newStatus);

      if (bookingId) {
        const bStatus: BookingRequestStatus =
          newStatus === "QUALIFIED" || (newStatus as string) === "WON"
            ? "CONFIRMED"
            : newStatus === "CONTACTED"
            ? "CONTACTED"
            : newStatus === "CLOSED"
            ? "DECLINED"
            : "REQUESTED";
        await updateBookingStatusAction(bookingId, bStatus);
      }
    });
  };

  const handleAssignChange = (leadId: string, userId: string | null) => {
    const staff = staffMembers.find((s) => s.id === userId);
    const staffName = staff ? staff.name : null;

    startTransition(async () => {
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, assignedToUserId: userId } : l))
      );

      const optimisticActivity: LeadActivityItem = {
        id: `opt_${Date.now()}`,
        activityType: "ASSIGNED",
        actorName: "You (Admin)",
        note: userId ? `Assigned to ${staffName}` : "Unassigned lead",
        beforeStatus: null,
        afterStatus: null,
        createdAt: new Date().toISOString(),
      };
      setActivitiesMap((prev) => ({
        ...prev,
        [leadId]: [...(prev[leadId] || []), optimisticActivity],
      }));

      await assignLeadAction(leadId, userId, staffName);
    });
  };

  const handleAddActivityNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !newNoteText.trim()) return;

    const note = newNoteText.trim();
    const actType = newNoteType;
    setNewNoteText("");

    startTransition(async () => {
      const optimisticActivity: LeadActivityItem = {
        id: `opt_${Date.now()}`,
        activityType: actType,
        actorName: "You (Staff)",
        note,
        beforeStatus: null,
        afterStatus: null,
        createdAt: new Date().toISOString(),
      };

      setActivitiesMap((prev) => ({
        ...prev,
        [selectedLeadId]: [...(prev[selectedLeadId] || []), optimisticActivity],
      }));

      setLeads((prev) =>
        prev.map((l) => (l.id === selectedLeadId ? { ...l, privateNotes: note } : l))
      );

      await addLeadActivityNoteAction(selectedLeadId, note, actType);
    });
  };

  // WhatsApp Link Helper
  const getCleanWaLink = (phone: string | null, name: string, leadId: string) => {
    if (!phone) return null;
    const clean = phone.replace(/[^0-9]/g, "");
    const formatted = clean.startsWith("88") ? clean : clean.startsWith("0") ? `88${clean}` : `880${clean}`;
    const text = `Hello ${name}, thank you for reaching out to us (Ref: #LD-${leadId.slice(-6)}). We received your inquiry and would love to help you!`;
    return `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
  };

  // CSV Export Helper
  const handleExportCSV = () => {
    if (filteredLeads.length === 0) {
      alert("No leads available to export with current filters.");
      return;
    }

    const headers = [
      "Inquiry Ref",
      "Type",
      "Status",
      "Customer Name",
      "Phone",
      "Email",
      "Service/Specialty",
      "Requested Date",
      "Requested Time",
      "Party Size",
      "Source Page",
      "UTM Source",
      "UTM Campaign",
      "Assigned Staff",
      "Customer Message",
      "Latest Notes",
      "Submitted At",
    ];

    const rows = filteredLeads.map((item) => {
      const staff = staffMembers.find((s) => s.id === item.assignedToUserId);
      const booking = item.bookingRequest;
      return [
        `LD-${item.id.slice(-6)}`,
        item.type,
        item.status,
        `"${(item.name || "").replace(/"/g, '""')}"`,
        `"${item.phone || ""}"`,
        `"${item.email || ""}"`,
        `"${(booking?.serviceName || "").replace(/"/g, '""')}"`,
        booking?.requestedDate ? new Date(booking.requestedDate).toISOString().split("T")[0] : "",
        `"${booking?.requestedTime || ""}"`,
        booking?.partySize ? String(booking.partySize) : "",
        `"${item.sourcePage || ""}"`,
        `"${item.utmSource || ""}"`,
        `"${item.utmCampaign || ""}"`,
        `"${staff ? staff.name : "Unassigned"}"`,
        `"${(item.message || "").replace(/"/g, '""')}"`,
        `"${(item.privateNotes || "").replace(/"/g, '""')}"`,
        new Date(item.createdAt).toISOString(),
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `biztrack_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        title="Leads & Inquiries"
        crumbs={[{ label: "Home", href: "/" }, { label: "Leads" }]}
        badge={counts.NEW > 0 ? <span className="pill warn">{counts.NEW} Unread</span> : undefined}
        sub="Real-time multi-channel inquiry triage, customer follow-up desk, and staff assignment timeline."
        actions={
          <button
            type="button"
            onClick={handleExportCSV}
            className="btn btn-secondary btn-sm"
          >
            Export CSV ({filteredLeads.length})
          </button>
        }
      />

      {/* Status Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 4,
          borderBottom: "1px solid var(--border, #e2e8f0)",
        }}
      >
        {[
          { key: "ALL", label: "All Inquiries", count: counts.ALL },
          { key: "NEW", label: "New / Unread", count: counts.NEW },
          { key: "CONTACTED", label: "Contacted", count: counts.CONTACTED },
          { key: "QUALIFIED", label: "Qualified", count: counts.QUALIFIED },
          { key: "WON", label: "Won / Confirmed", count: counts.WON },
          { key: "CLOSED", label: "Closed", count: counts.CLOSED },
          { key: "SPAM", label: "Spam", count: counts.SPAM },
        ].map((tab) => {
          const isActive = statusTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusTab(tab.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                border: "none",
                borderBottom: isActive ? "2px solid #0f172a" : "2px solid transparent",
                background: "transparent",
                color: isActive ? "#0f172a" : "#64748b",
                fontWeight: isActive ? 700 : 500,
                fontSize: "0.88rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "1px 7px",
                  borderRadius: 9999,
                  background: isActive ? "#0f172a" : "#f1f5f9",
                  color: isActive ? "#ffffff" : "#475569",
                  fontWeight: 600,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Secondary Controls Bar: Type, Assignee, Search */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 16px",
          background: "var(--bg-card, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: 10,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          {/* Type Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.82rem", color: "#64748b", fontWeight: 600 }}>Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--border, #cbd5e1)",
                fontSize: "0.84rem",
                background: "#ffffff",
                cursor: "pointer",
              }}
            >
              <option value="ALL">All Types</option>
              <option value="CONTACT">Contact Forms</option>
              <option value="QUOTE">Price Quotes</option>
              <option value="RESERVATION">Table / Reservations</option>
              <option value="APPOINTMENT">Appointments</option>
            </select>
          </div>

          {/* Assignee Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.82rem", color: "#64748b", fontWeight: 600 }}>Assignee:</span>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--border, #cbd5e1)",
                fontSize: "0.84rem",
                background: "#ffffff",
                cursor: "pointer",
              }}
            >
              <option value="ALL">All Staff</option>
              <option value="UNASSIGNED">Unassigned</option>
              {staffMembers.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name} ({staff.role.replace("STORE_", "").toLowerCase()})
                </option>
              ))}
            </select>
          </div>

          {(typeFilter !== "ALL" || assigneeFilter !== "ALL" || search) && (
            <button
              type="button"
              onClick={() => {
                setTypeFilter("ALL");
                setAssigneeFilter("ALL");
                setSearch("");
              }}
              style={{
                padding: "5px 10px",
                background: "#f1f5f9",
                border: "none",
                borderRadius: 6,
                fontSize: "0.78rem",
                color: "#475569",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              ✕ Reset Filters
            </button>
          )}
        </div>

        {/* Search Input */}
        <div style={{ position: "relative", minWidth: 260 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, service, note..."
            style={{
              width: "100%",
              padding: "7px 12px 7px 32px",
              borderRadius: 6,
              border: "1px solid var(--border, #cbd5e1)",
              fontSize: "0.84rem",
              boxSizing: "border-box",
            }}
          />
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "0.85rem",
              color: "#94a3b8",
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
        </div>
      </div>

      {/* Main Split-Pane Workspace */}
      <div
        className="leads-split"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(340px, 420px) 1fr",
          gap: 18,
          alignItems: "start",
          minHeight: 640,
        }}
      >
        {/* Left Column: Inquiry Master List */}
        <div
          style={{
            background: "var(--bg-card, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border, #f1f5f9)",
              background: "#fafbfc",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Inquiries ({filteredLeads.length})
            </span>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
              Sorted by newest
            </span>
          </div>

          <div
            style={{
              maxHeight: "calc(100vh - 280px)",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {filteredLeads.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748b" }}>
                <div style={{ fontSize: "1.2rem", marginBottom: 8, color: "var(--ink-3)" }}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div>
                <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>No inquiries found</div>
                <div style={{ fontSize: "0.84rem" }}>Try adjusting your filters or search terms.</div>
              </div>
            ) : (
              filteredLeads.map((item) => {
                const isSelected = item.id === selectedLeadId;
                const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.NEW;
                const typeCfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.CONTACT;
                const assignedStaff = staffMembers.find((s) => s.id === item.assignedToUserId);

                let summaryText = item.message || "No message provided";
                if (item.bookingRequest) {
                  const b = item.bookingRequest;
                  summaryText = `${b.serviceName || "Booking"} ${b.partySize ? `(${b.partySize} guests)` : ""} ${b.requestedTime ? `• ${b.requestedTime}` : ""}`;
                }

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedLeadId(item.id)}
                    style={{
                      padding: "14px 16px",
                      borderBottom: "1px solid var(--border, #f1f5f9)",
                      borderLeft: isSelected
                        ? "4px solid #0f172a"
                        : item.status === "NEW"
                        ? "4px solid #F59E0B"
                        : "4px solid transparent",
                      background: isSelected ? "#F8FAFC" : "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      transition: "background 0.15s ease",
                    }}
                  >
                    {/* Top Row: Badges & Relative Time */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {item.status === "NEW" && (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "#F59E0B",
                              display: "inline-block",
                            }}
                          />
                        )}
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: typeCfg.badgeBg,
                            color: typeCfg.badgeColor,
                          }}
                        >
                          {typeCfg.label}
                        </span>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: statusCfg.bg,
                            color: statusCfg.text,
                          }}
                        >
                          {statusCfg.label}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>

                    {/* Customer Name & Phone */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.94rem", color: isSelected ? "#0f172a" : "#1e293b" }}>
                        {item.name}
                      </span>
                      {item.phone && (
                        <span style={{ fontSize: "0.8rem", color: "#64748b", fontFamily: "monospace" }}>
                          {item.phone}
                        </span>
                      )}
                    </div>

                    {/* Excerpt Summary */}
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.82rem",
                        color: "#475569",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {summaryText}
                    </p>

                    {/* Assigned staff footer */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "#94a3b8", marginTop: 2 }}>
                      <span>Ref: #LD-{item.id.slice(-6)}</span>
                      {assignedStaff ? (
                        <span style={{ color: "#0369a1", fontWeight: 600 }}>
                          {assignedStaff.name}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>Unassigned</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Lead Operational Desk */}
        <div
          style={{
            background: "var(--bg-card, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: 12,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          {selectedLead ? (
            <>
              {/* Detail Header & Desk Controls */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 16,
                  paddingBottom: 16,
                  borderBottom: "1px solid var(--border, #e2e8f0)",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: TYPE_CONFIG[selectedLead.type]?.badgeBg || "#F1F5F9",
                        color: TYPE_CONFIG[selectedLead.type]?.badgeColor || "#334155",
                      }}
                    >
                      {selectedLead.type}
                    </span>
                    <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                      {selectedLead.name}
                    </h2>
                    <span style={{ fontSize: "0.82rem", color: "#64748b", fontFamily: "monospace" }}>
                      #LD-{selectedLead.id.slice(-6)}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: 4 }}>
                    Submitted on {formatDhakaDateTime(selectedLead.createdAt)}
                    {selectedLead.sourcePage && (
                      <span> • Source Page: <code>{selectedLead.sourcePage}</code></span>
                    )}
                  </div>
                </div>

                {/* Status & Assignment Quick Triage Pickers */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {/* Status Dropdown */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Status
                    </label>
                    <select
                      value={selectedLead.status}
                      disabled={isPending}
                      onChange={(e) =>
                        handleStatusChange(
                          selectedLead.id,
                          e.target.value as SiteLeadStatus,
                          selectedLead.bookingRequest?.id
                        )
                      }
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: `1px solid ${STATUS_CONFIG[selectedLead.status]?.border || "#cbd5e1"}`,
                        background: STATUS_CONFIG[selectedLead.status]?.bg || "#ffffff",
                        color: STATUS_CONFIG[selectedLead.status]?.text || "#0f172a",
                        fontWeight: 700,
                        fontSize: "0.84rem",
                        cursor: "pointer",
                      }}
                    >
                      <option value="NEW">New</option>
                      <option value="CONTACTED">Contacted</option>
                      <option value="QUALIFIED">Qualified</option>
                      <option value="WON">Won / Confirmed</option>
                      <option value="CLOSED">Closed</option>
                      <option value="SPAM">Mark as Spam</option>
                    </select>
                  </div>

                  {/* Staff Assignee Dropdown */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      Assigned Staff
                    </label>
                    <select
                      value={selectedLead.assignedToUserId || ""}
                      disabled={isPending}
                      onChange={(e) =>
                        handleAssignChange(
                          selectedLead.id,
                          e.target.value ? e.target.value : null
                        )
                      }
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border, #cbd5e1)",
                        fontSize: "0.84rem",
                        background: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      <option value="">Unassigned</option>
                      {staffMembers.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Desk Launchers: WhatsApp, Call, Quick Confirm */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  padding: "12px 16px",
                  background: "#F8FAFC",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                }}
              >
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginRight: 4 }}>
                  Quick Action:
                </span>

                {selectedLead.phone && (
                  <a
                    href={getCleanWaLink(selectedLead.phone, selectedLead.name, selectedLead.id) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      // Log WhatsApp launch interaction
                      addLeadActivityNoteAction(
                        selectedLead.id,
                        "WhatsApp conversation initiated via 1-tap launcher",
                        "WHATSAPP_CLICKED"
                      );
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 6,
                      background: "#25D366",
                      color: "#FFFFFF",
                      fontSize: "0.84rem",
                      fontWeight: 700,
                      textDecoration: "none",
                      boxShadow: "0 2px 4px rgba(37, 211, 102, 0.2)",
                    }}
                  >
                    Open WhatsApp Chat
                  </a>
                )}

                {selectedLead.phone && (
                  <a
                    href={`tel:${selectedLead.phone}`}
                    onClick={() => {
                      addLeadActivityNoteAction(
                        selectedLead.id,
                        "Outbound call placed to customer",
                        "CALL_LOGGED"
                      );
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 6,
                      background: "#FFFFFF",
                      border: "1px solid #CBD5E1",
                      color: "#0F172A",
                      fontSize: "0.84rem",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Call ({selectedLead.phone})
                  </a>
                )}

                {selectedLead.bookingRequest && (
                  <button
                    type="button"
                    disabled={isPending || selectedLead.status === "WON"}
                    onClick={() =>
                      handleStatusChange(
                        selectedLead.id,
                        "WON",
                        selectedLead.bookingRequest?.id
                      )
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 6,
                      background: "#16A34A",
                      color: "#FFFFFF",
                      border: "none",
                      fontSize: "0.84rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <span>✓</span> Confirm Reservation
                  </button>
                )}

                {selectedLead.status !== "CONTACTED" && selectedLead.status !== "WON" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      handleStatusChange(
                        selectedLead.id,
                        "CONTACTED",
                        selectedLead.bookingRequest?.id
                      )
                    }
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      background: "#FFFFFF",
                      border: "1px solid #BAE6FD",
                      color: "#0369A1",
                      fontSize: "0.84rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Mark Contacted
                  </button>
                )}
              </div>

              {/* Booking Request Detail Box if applicable */}
              {selectedLead.bookingRequest && (
                <div
                  style={{
                    background: "#F5F3FF",
                    border: "1px solid #DDD6FE",
                    borderRadius: 10,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#5B21B6", display: "flex", alignItems: "center", gap: 6 }}>
                      Reservation & Appointment Details
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 9999,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background:
                          selectedLead.bookingRequest.status === "CONFIRMED"
                            ? "#DCFCE7"
                            : selectedLead.bookingRequest.status === "DECLINED"
                            ? "#FEE2E2"
                            : "#FEF3C7",
                        color:
                          selectedLead.bookingRequest.status === "CONFIRMED"
                            ? "#15803D"
                            : selectedLead.bookingRequest.status === "DECLINED"
                            ? "#B91C1C"
                            : "#92400E",
                      }}
                    >
                      {selectedLead.bookingRequest.status}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: 12,
                      fontSize: "0.85rem",
                    }}
                  >
                    {selectedLead.bookingRequest.serviceName && (
                      <div>
                        <span style={{ color: "#6D28D9", display: "block", fontSize: "0.75rem", fontWeight: 600 }}>
                          Service / Item
                        </span>
                        <strong>{selectedLead.bookingRequest.serviceName}</strong>
                      </div>
                    )}
                    {selectedLead.bookingRequest.providerName && (
                      <div>
                        <span style={{ color: "#6D28D9", display: "block", fontSize: "0.75rem", fontWeight: 600 }}>
                          Chamber / Specialist
                        </span>
                        <strong>{selectedLead.bookingRequest.providerName}</strong>
                      </div>
                    )}
                    {selectedLead.bookingRequest.requestedDate && (
                      <div>
                        <span style={{ color: "#6D28D9", display: "block", fontSize: "0.75rem", fontWeight: 600 }}>
                          Requested Date
                        </span>
                        <strong>{new Date(selectedLead.bookingRequest.requestedDate).toLocaleDateString("en-GB")}</strong>
                      </div>
                    )}
                    {selectedLead.bookingRequest.requestedTime && (
                      <div>
                        <span style={{ color: "#6D28D9", display: "block", fontSize: "0.75rem", fontWeight: 600 }}>
                          Preferred Time
                        </span>
                        <strong>{selectedLead.bookingRequest.requestedTime}</strong>
                      </div>
                    )}
                    {selectedLead.bookingRequest.partySize && (
                      <div>
                        <span style={{ color: "#6D28D9", display: "block", fontSize: "0.75rem", fontWeight: 600 }}>
                          Party / Guests
                        </span>
                        <strong>{selectedLead.bookingRequest.partySize} Persons</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Customer Message & Context */}
              {selectedLead.message && (
                <div
                  style={{
                    background: "#FAFAFA",
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                    padding: "12px 16px",
                  }}
                >
                  <span style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#6B7280", marginBottom: 6 }}>
                    Customer Inquiry Note:
                  </span>
                  <div style={{ fontSize: "0.92rem", color: "#1F2937", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {selectedLead.message}
                  </div>
                </div>
              )}

              {/* Attribution & Marketing Origin Metadata */}
              {(selectedLead.utmSource || selectedLead.utmCampaign || selectedLead.referrer) && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    fontSize: "0.78rem",
                    color: "#64748B",
                    padding: "10px 14px",
                    background: "#F8FAFC",
                    borderRadius: 6,
                    border: "1px dashed #CBD5E1",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "#475569" }}>Marketing Attribution:</span>
                  {selectedLead.utmSource && <span>Source: <strong>{selectedLead.utmSource}</strong></span>}
                  {selectedLead.utmMedium && <span>Medium: <strong>{selectedLead.utmMedium}</strong></span>}
                  {selectedLead.utmCampaign && <span>Campaign: <strong>{selectedLead.utmCampaign}</strong></span>}
                  {selectedLead.referrer && <span>Referrer: <code>{selectedLead.referrer}</code></span>}
                </div>
              )}

              {/* Chronological SiteLeadActivity Timeline */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>📜</span> Activity & Audit Timeline
                  </h3>
                  {isLoadingActivities && (
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Loading history…</span>
                  )}
                </div>

                {/* Timeline List */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    paddingLeft: 12,
                    borderLeft: "2px solid #E2E8F0",
                    marginLeft: 6,
                  }}
                >
                  {/* Origin event */}
                  <div style={{ position: "relative", fontSize: "0.82rem" }}>
                    <div
                      style={{
                        position: "absolute",
                        left: -19,
                        top: 2,
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "#0F172A",
                        border: "2px solid #FFFFFF",
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B" }}>
                      <span>Lead captured from Web Form ({selectedLead.sourcePage || "/"})</span>
                      <span>{formatDhakaDateTime(selectedLead.createdAt)}</span>
                    </div>
                  </div>

                  {/* Render Activities */}
                  {(activitiesMap[selectedLead.id] || []).map((act) => {
                    const isNote = act.activityType === "NOTE_ADDED";
                    const isWa = act.activityType === "WHATSAPP_CLICKED";
                    const isCall = act.activityType === "CALL_LOGGED";
                    const isAssign = act.activityType === "ASSIGNED";

                    let icon = "📝";
                    let dotColor = "#3B82F6";
                    if (isWa) {
                      icon = "💬";
                      dotColor = "#25D366";
                    } else if (isCall) {
                      icon = "📞";
                      dotColor = "#F59E0B";
                    } else if (isAssign) {
                      icon = "👤";
                      dotColor = "#8B5CF6";
                    }

                    return (
                      <div key={act.id} style={{ position: "relative", fontSize: "0.84rem" }}>
                        <div
                          style={{
                            position: "absolute",
                            left: -19,
                            top: 4,
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: dotColor,
                            border: "2px solid #FFFFFF",
                          }}
                        />
                        <div
                          style={{
                            background: isNote ? "#FFFBEB" : "#F8FAFC",
                            border: `1px solid ${isNote ? "#FDE68A" : "#E2E8F0"}`,
                            borderRadius: 6,
                            padding: "8px 12px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, color: isNote ? "#92400E" : "#334155", display: "flex", alignItems: "center", gap: 6 }}>
                              <span>{icon}</span> {act.actorName || "Staff"}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                              {formatDhakaDateTime(act.createdAt)}
                            </span>
                          </div>
                          <div style={{ color: "#1E293B", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                            {act.note}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Internal Follow-up Note Box */}
                <form
                  onSubmit={handleAddActivityNote}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    background: "#FAFAFA",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    padding: 12,
                    marginTop: 6,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#475569" }}>
                      ✍️ Log Interaction or Internal Note:
                    </span>
                    <select
                      value={newNoteType}
                      onChange={(e) => setNewNoteType(e.target.value as LeadActivityType)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid #CBD5E1",
                        fontSize: "0.78rem",
                        background: "#FFFFFF",
                      }}
                    >
                      <option value="NOTE_ADDED">Internal Note</option>
                      <option value="CALL_LOGGED">Phone Call Note</option>
                      <option value="WHATSAPP_CLICKED">WhatsApp Follow-up</option>
                    </select>
                  </div>

                  <textarea
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="E.g. Called customer at 3:15 PM, confirmed party of 4 at window table, sent banquet menu..."
                    rows={2}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid #CBD5E1",
                      fontSize: "0.85rem",
                      resize: "vertical",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  />

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="submit"
                      disabled={isPending || !newNoteText.trim()}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        background: "#0F172A",
                        color: "#FFFFFF",
                        border: "none",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        cursor: newNoteText.trim() ? "pointer" : "not-allowed",
                        opacity: newNoteText.trim() ? 1 : 0.6,
                      }}
                    >
                      {isPending ? "Posting…" : "Post to Timeline"}
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div style={{ padding: 64, textAlign: "center", color: "#64748B" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>👉</div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 6px", color: "#0F172A" }}>
                Select an inquiry
              </h3>
              <p style={{ fontSize: "0.9rem", margin: 0 }}>
                Choose any inquiry or booking request from the left list to view customer contact details, reservation specifics, and the staff activity timeline.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
