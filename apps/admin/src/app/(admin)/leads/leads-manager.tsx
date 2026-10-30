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
  { label: string; pillClass: string; dotClass: string }
> = {
  NEW: { label: "New", pillClass: "pill warn", dotClass: "lead-dot-unread" },
  CONTACTED: { label: "Contacted", pillClass: "pill info", dotClass: "" },
  QUALIFIED: { label: "Qualified", pillClass: "pill info", dotClass: "" },
  WON: { label: "Won / Confirmed", pillClass: "pill good", dotClass: "" },
  CLOSED: { label: "Closed", pillClass: "pill", dotClass: "" },
  SPAM: { label: "Spam", pillClass: "pill bad", dotClass: "" },
};

const TYPE_CONFIG: Record<SiteLeadType, { label: string }> = {
  CONTACT: { label: "Contact" },
  QUOTE: { label: "Quote" },
  RESERVATION: { label: "Reservation" },
  APPOINTMENT: { label: "Appointment" },
  MEDIA_BOOKING: { label: "Media / Session" },
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
    <div className="stack gap-md">
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
      <div className="tab-strip">
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
              className={`tab-item ${isActive ? "active" : ""}`}
            >
              <span>{tab.label}</span>
              <span className="tab-badge">
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Secondary Controls Bar: Type, Assignee, Search */}
      <div className="card-panel-muted flex-between flex-wrap gap-sm">
        <div className="flex-center-y flex-wrap gap-sm">
          {/* Type Filter */}
          <div className="flex-center-y gap-xs">
            <span className="text-xs text-muted text-bold">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input text-sm py-xs"
            >
              <option value="ALL">All Types</option>
              <option value="CONTACT">Contact Forms</option>
              <option value="QUOTE">Price Quotes</option>
              <option value="RESERVATION">Table / Reservations</option>
              <option value="APPOINTMENT">Appointments</option>
            </select>
          </div>

          {/* Assignee Filter */}
          <div className="flex-center-y gap-xs">
            <span className="text-xs text-muted text-bold">Assignee:</span>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="input text-sm py-xs"
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
              className="btn btn-secondary btn-xs"
            >
              ✕ Reset Filters
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="search-box-wrap">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, service, note..."
            className="search-box-input"
          />
          <span className="search-box-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
        </div>
      </div>

      {/* Main Split-Pane Workspace */}
      <div className="leads-split">
        {/* Left Column: Inquiry Master List */}
        <div className="leads-panel">
          <div className="flex-between py-xs px-sm border-bottom">
            <span className="text-xs text-bold text-muted uppercase tracking-wide">
              Inquiries ({filteredLeads.length})
            </span>
            <span className="text-xs text-muted">
              Sorted by newest
            </span>
          </div>

          <div className="leads-scroll">
            {filteredLeads.length === 0 ? (
              <div className="empty-state">
                <div className="text-muted mb-xs">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <div className="text-bold text-base mb-xs">No inquiries found</div>
                <div className="text-sm text-muted">Try adjusting your filters or search terms.</div>
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
                    className={`leads-item ${isSelected ? "active" : item.status === "NEW" ? "unread" : ""}`}
                  >
                    {/* Top Row: Badges & Relative Time */}
                    <div className="flex-between flex-center-y">
                      <div className="flex-center-y gap-xs">
                        {item.status === "NEW" && (
                          <span className="lead-dot-unread" />
                        )}
                        <span className="pill text-xs">
                          {typeCfg.label}
                        </span>
                        <span className={`${statusCfg.pillClass} text-xs`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <span className="text-xs text-muted">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>

                    {/* Customer Name & Phone */}
                    <div className="flex-between">
                      <span className="text-bold text-sm">
                        {item.name}
                      </span>
                      {item.phone && (
                        <span className="font-mono text-xs text-muted">
                          {item.phone}
                        </span>
                      )}
                    </div>

                    {/* Excerpt Summary */}
                    <p className="m-0 text-sm text-muted text-ellipsis">
                      {summaryText}
                    </p>

                    {/* Assigned staff footer */}
                    <div className="flex-between text-xs text-muted mt-xs">
                      <span>Ref: #LD-{item.id.slice(-6)}</span>
                      {assignedStaff ? (
                        <span className="text-brand text-bold">
                          {assignedStaff.name}
                        </span>
                      ) : (
                        <span>Unassigned</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Lead Operational Desk */}
        <div className="leads-desk">
          {selectedLead ? (
            <>
              {/* Detail Header & Desk Controls */}
              <div className="flex-between flex-wrap gap-md border-bottom pb-sm">
                <div>
                  <div className="flex-center-y flex-wrap gap-sm">
                    <span className="pill text-bold text-xs">
                      {selectedLead.type}
                    </span>
                    <h2 className="m-0 text-lg text-bold">
                      {selectedLead.name}
                    </h2>
                    <span className="font-mono text-xs text-muted">
                      #LD-{selectedLead.id.slice(-6)}
                    </span>
                  </div>

                  <div className="text-xs text-muted mt-xs">
                    Submitted on {formatDhakaDateTime(selectedLead.createdAt)}
                    {selectedLead.sourcePage && (
                      <span> • Source Page: <code>{selectedLead.sourcePage}</code></span>
                    )}
                  </div>
                </div>

                {/* Status & Assignment Quick Triage Pickers */}
                <div className="flex-center-y flex-wrap gap-sm">
                  {/* Status Dropdown */}
                  <div className="stack gap-xs">
                    <label className="text-xs text-bold text-muted uppercase">
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
                      className="input text-sm text-bold py-xs cursor-pointer"
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
                  <div className="stack gap-xs">
                    <label className="text-xs text-bold text-muted uppercase">
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
                      className="input text-sm py-xs cursor-pointer"
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
              <div className="desk-actions-bar">
                <span className="text-xs text-bold text-muted">
                  Quick Action:
                </span>

                {selectedLead.phone && (
                  <a
                    href={getCleanWaLink(selectedLead.phone, selectedLead.name, selectedLead.id) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      addLeadActivityNoteAction(
                        selectedLead.id,
                        "WhatsApp conversation initiated via 1-tap launcher",
                        "WHATSAPP_CLICKED"
                      );
                    }}
                    className="btn btn-whatsapp btn-sm"
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
                    className="btn btn-secondary btn-sm"
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
                    className="btn btn-primary btn-sm"
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
                    className="btn btn-secondary btn-sm"
                  >
                    Mark Contacted
                  </button>
                )}
              </div>

              {/* Booking Request Detail Box if applicable */}
              {selectedLead.bookingRequest && (
                <div className="booking-detail-card">
                  <div className="flex-between mb-sm">
                    <span className="text-bold text-sm text-brand">
                      Reservation & Appointment Details
                    </span>
                    <span className="pill info text-xs">
                      {selectedLead.bookingRequest.status}
                    </span>
                  </div>

                  <div className="grid grid-2 gap-sm text-sm">
                    {selectedLead.bookingRequest.serviceName && (
                      <div>
                        <span className="d-block text-xs text-muted">
                          Service / Item
                        </span>
                        <strong>{selectedLead.bookingRequest.serviceName}</strong>
                      </div>
                    )}
                    {selectedLead.bookingRequest.providerName && (
                      <div>
                        <span className="d-block text-xs text-muted">
                          Chamber / Specialist
                        </span>
                        <strong>{selectedLead.bookingRequest.providerName}</strong>
                      </div>
                    )}
                    {selectedLead.bookingRequest.requestedDate && (
                      <div>
                        <span className="d-block text-xs text-muted">
                          Requested Date
                        </span>
                        <strong>{new Date(selectedLead.bookingRequest.requestedDate).toLocaleDateString("en-GB")}</strong>
                      </div>
                    )}
                    {selectedLead.bookingRequest.requestedTime && (
                      <div>
                        <span className="d-block text-xs text-muted">
                          Preferred Time
                        </span>
                        <strong>{selectedLead.bookingRequest.requestedTime}</strong>
                      </div>
                    )}
                    {selectedLead.bookingRequest.partySize && (
                      <div>
                        <span className="d-block text-xs text-muted">
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
                <div className="card-panel-muted">
                  <span className="d-block text-xs text-bold text-muted mb-xs">
                    Customer Inquiry Note:
                  </span>
                  <div className="text-sm pre-wrap">
                    {selectedLead.message}
                  </div>
                </div>
              )}

              {/* Attribution & Marketing Origin Metadata */}
              {(selectedLead.utmSource || selectedLead.utmCampaign || selectedLead.referrer) && (
                <div className="attribution-card">
                  <span className="text-bold">Marketing Attribution:</span>
                  {selectedLead.utmSource && <span>Source: <strong>{selectedLead.utmSource}</strong></span>}
                  {selectedLead.utmMedium && <span>Medium: <strong>{selectedLead.utmMedium}</strong></span>}
                  {selectedLead.utmCampaign && <span>Campaign: <strong>{selectedLead.utmCampaign}</strong></span>}
                  {selectedLead.referrer && <span>Referrer: <code>{selectedLead.referrer}</code></span>}
                </div>
              )}

              {/* Chronological SiteLeadActivity Timeline */}
              <div className="stack gap-sm mt-xs">
                <div className="flex-between">
                  <h3 className="text-base text-bold m-0 flex-center-y gap-xs">
                    Activity & Audit Timeline
                  </h3>
                  {isLoadingActivities && (
                    <span className="text-xs text-muted">Loading history…</span>
                  )}
                </div>

                {/* Timeline List */}
                <div className="stack gap-sm border-left pl-md ml-xs">
                  {/* Origin event */}
                  <div className="flex-between text-xs text-muted">
                    <span>Lead captured from Web Form ({selectedLead.sourcePage || "/"})</span>
                    <span>{formatDhakaDateTime(selectedLead.createdAt)}</span>
                  </div>

                  {/* Render Activities */}
                  {(activitiesMap[selectedLead.id] || []).map((act) => {
                    const isNote = act.activityType === "NOTE_ADDED";
                    const isWa = act.activityType === "WHATSAPP_CLICKED";
                    const isCall = act.activityType === "CALL_LOGGED";

                    const badgeType = isNote ? "staff" : isWa ? "sms" : isCall ? "review" : "order";
                    const typeLabel = isNote ? "NOTE" : isWa ? "WA" : isCall ? "CALL" : "LOG";

                    return (
                      <div key={act.id} className="card-panel-muted">
                        <div className="flex-between mb-xs">
                          <span className="text-bold text-sm flex-center-y gap-xs">
                            <span className={`timeline-badge timeline-badge-${badgeType}`}>
                              {typeLabel}
                            </span>
                            {act.actorName || "Staff"}
                          </span>
                          <span className="text-xs text-muted">
                            {formatDhakaDateTime(act.createdAt)}
                          </span>
                        </div>
                        <div className="text-sm pre-wrap">
                          {act.note}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Internal Follow-up Note Box */}
                <form
                  onSubmit={handleAddActivityNote}
                  className="card-panel-muted stack gap-sm mt-xs"
                >
                  <div className="flex-between">
                    <span className="text-xs text-bold text-muted">
                      Log Interaction or Internal Note:
                    </span>
                    <select
                      value={newNoteType}
                      onChange={(e) => setNewNoteType(e.target.value as LeadActivityType)}
                      className="input text-xs py-xs"
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
                    className="textarea text-sm"
                  />

                  <div className="flex-end">
                    <button
                      type="submit"
                      disabled={isPending || !newNoteText.trim()}
                      className="btn btn-primary btn-sm"
                    >
                      {isPending ? "Posting…" : "Post to Timeline"}
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="desk-empty">
              <div className="text-muted mb-md">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 className="text-lg text-bold mb-xs">
                Select an inquiry
              </h3>
              <p className="text-sm m-0">
                Choose any inquiry or booking request from the left list to view customer contact details, reservation specifics, and the staff activity timeline.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
