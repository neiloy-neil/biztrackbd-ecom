"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { WhatsAppConversationStatus, SupportQuickReply } from "@biztrackbd/core";
import {
  sendStaffWhatsAppReplyAction,
  setWhatsAppConversationStatusAction,
  getWhatsAppConversationDetailAction,
  assignWhatsAppConversationAction,
  toggleWhatsAppBotPauseAction,
  saveSupportQuickReplyAction,
  deleteSupportQuickReplyAction,
  resetSupportQuickRepliesAction,
  quickConfirmOrderAction,
  sendOrderTrackingAction,
  sendOrderPaymentDetailsAction,
} from "./actions";

interface StaffUserItem {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface CustomerOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: any;
  advancePaidAmount?: any;
  balanceDue?: any;
  createdAt: string | Date;
  courierProvider: string | null;
  trackingCode: string | null;
}

interface CustomerSummary {
  id: string;
  name: string | null;
  phone: string;
  totalOrders: number;
  totalSpent: any;
  orders?: CustomerOrderSummary[];
}

interface ChatMessage {
  id: string;
  sender: string;
  body: string;
  createdAt: string | Date;
}

interface ConversationItem {
  id: string;
  customerPhone: string;
  customerName: string | null;
  status: WhatsAppConversationStatus;
  unreadCount: number;
  lastMessageText: string | null;
  lastMessageAt: string | Date;
  assignedUserId?: string | null;
  assignedUser?: { id: string; name: string; email: string } | null;
  botPausedUntil?: string | Date | null;
  customer?: CustomerSummary | null;
}

interface Props {
  initialConversations: ConversationItem[];
  initialQuickReplies: SupportQuickReply[];
  staffUsers: StaffUserItem[];
  currentUserId: string;
  canEdit: boolean;
}

export function WhatsAppDeskClient({
  initialConversations,
  initialQuickReplies,
  staffUsers,
  currentUserId,
  canEdit,
}: Props) {
  const [conversations, setConversations] = useState<ConversationItem[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversations[0]?.id || null);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Filters
  const [assignmentTab, setAssignmentTab] = useState<"ALL" | "MINE" | "UNASSIGNED">("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Quick Replies & Slash Command
  const [quickReplies, setQuickReplies] = useState<SupportQuickReply[]>(initialQuickReplies);
  const [isManagingSnippets, setIsManagingSnippets] = useState(false);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);

  // Snippet Modal Form
  const [editingSnippet, setEditingSnippet] = useState<Partial<SupportQuickReply> | null>(null);
  const [isSavingSnippet, setIsSavingSnippet] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat when new message arrives
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages]);

  // Load conversation details
  const handleSelectConversation = async (id: string) => {
    setSelectedId(id);
    setIsLoadingChat(true);
    setActionFeedback(null);
    try {
      const detail = await getWhatsAppConversationDetailAction(id);
      setActiveChat(detail);
      // Mark read locally
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
      );
    } catch (e: any) {
      console.error("Failed to load chat details:", e);
    } finally {
      setIsLoadingChat(false);
    }
  };

  // Select initial conversation on mount
  useEffect(() => {
    if (initialConversations[0]?.id && !activeChat) {
      handleSelectConversation(initialConversations[0].id);
    }
  }, []);

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    // Assignment filter
    if (assignmentTab === "MINE" && c.assignedUserId !== currentUserId) return false;
    if (assignmentTab === "UNASSIGNED" && c.assignedUserId) return false;

    // Status filter
    if (statusFilter !== "ALL" && c.status !== statusFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPhone = c.customerPhone.includes(q);
      const matchName = c.customerName?.toLowerCase().includes(q) ?? false;
      const matchMsg = c.lastMessageText?.toLowerCase().includes(q) ?? false;
      const matchAssignee = c.assignedUser?.name?.toLowerCase().includes(q) ?? false;
      return matchPhone || matchName || matchMsg || matchAssignee;
    }
    return true;
  });

  // Check if bot is paused on active conversation
  const selectedConv = conversations.find((c) => c.id === selectedId);
  const activePausedDate = activeChat?.botPausedUntil || selectedConv?.botPausedUntil;
  const isBotPaused = activePausedDate ? new Date(activePausedDate) > new Date() : false;

  // Handle staff reply
  const handleSendReply = async () => {
    if (!selectedId || !replyText.trim()) return;
    const textToSend = replyText.trim();
    setIsSending(true);
    setSlashQuery(null);
    try {
      const res = await sendStaffWhatsAppReplyAction(selectedId, textToSend);
      if (res.success && res.message) {
        // Append to chat
        setActiveChat((prev: any) => ({
          ...prev,
          messages: [...(prev?.messages || []), res.message],
          status: "RESOLVED",
          botPausedUntil: new Date(Date.now() + 24 * 3600 * 1000),
          assignedUserId: prev?.assignedUserId || currentUserId,
        }));
        // Update list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedId
              ? {
                  ...c,
                  lastMessageText: textToSend,
                  lastMessageAt: new Date(),
                  status: "RESOLVED" as WhatsAppConversationStatus,
                  botPausedUntil: new Date(Date.now() + 24 * 3600 * 1000),
                  assignedUserId: c.assignedUserId || currentUserId,
                }
              : c
          )
        );
        setReplyText("");
      }
    } catch (e: any) {
      alert(e.message || "Failed to send WhatsApp message");
    } finally {
      setIsSending(false);
    }
  };

  // Staff Assignment
  const handleAssignStaff = async (staffUserId: string | null) => {
    if (!selectedId) return;
    try {
      await assignWhatsAppConversationAction(selectedId, staffUserId);
      const assignedUser = staffUsers.find((u) => u.id === staffUserId) || null;
      setActiveChat((prev: any) => ({
        ...prev,
        assignedUserId: staffUserId,
        assignedUser,
        status: staffUserId ? "OPEN" : prev?.status,
        botPausedUntil: staffUserId ? new Date(Date.now() + 24 * 3600 * 1000) : prev?.botPausedUntil,
      }));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                assignedUserId: staffUserId,
                assignedUser,
                status: staffUserId ? "OPEN" : c.status,
                botPausedUntil: staffUserId ? new Date(Date.now() + 24 * 3600 * 1000) : c.botPausedUntil,
              }
            : c
        )
      );
      setActionFeedback(staffUserId ? `Assigned to ${assignedUser?.name || "staff"}` : "Unassigned ticket");
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (e: any) {
      alert(e.message || "Failed to assign staff");
    }
  };

  // Bot Pause/Resume Toggle
  const handleToggleBotPause = async () => {
    if (!selectedId) return;
    const nextPaused = !isBotPaused;
    try {
      await toggleWhatsAppBotPauseAction(selectedId, nextPaused);
      const newPausedDate = nextPaused ? new Date(Date.now() + 24 * 3600 * 1000) : null;
      setActiveChat((prev: any) => ({
        ...prev,
        botPausedUntil: newPausedDate,
        status: nextPaused ? "OPEN" : "BOT_HANDLED",
      }));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                botPausedUntil: newPausedDate,
                status: nextPaused ? "OPEN" : "BOT_HANDLED",
              }
            : c
        )
      );
      setActionFeedback(nextPaused ? "⏸️ Bot paused for 24h" : "🤖 Bot resumed");
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (e: any) {
      alert(e.message || "Failed to toggle bot");
    }
  };

  // Status Change
  const handleStatusChange = async (newStatus: WhatsAppConversationStatus) => {
    if (!selectedId) return;
    try {
      await setWhatsAppConversationStatusAction(selectedId, newStatus);
      setActiveChat((prev: any) => ({ ...prev, status: newStatus }));
      setConversations((prev) =>
        prev.map((c) => (c.id === selectedId ? { ...c, status: newStatus } : c))
      );
    } catch (e: any) {
      alert(e.message || "Failed to update status");
    }
  };

  // 1-Click Order Confirmation
  const handleQuickConfirmOrder = async (orderId: string) => {
    if (!selectedId) return;
    if (!confirm("Confirm this order and notify the customer on WhatsApp?")) return;
    try {
      const res = await quickConfirmOrderAction(selectedId, orderId);
      if (res.message) {
        setActiveChat((prev: any) => ({
          ...prev,
          messages: [...(prev?.messages || []), res.message],
          status: "RESOLVED",
        }));
      }
      setActionFeedback("⚡ Order confirmed & notification dispatched!");
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (e: any) {
      alert(e.message || "Failed to confirm order");
    }
  };

  // 1-Click Send Tracking
  const handleSendOrderTracking = async (orderId: string) => {
    if (!selectedId) return;
    try {
      const res = await sendOrderTrackingAction(selectedId, orderId);
      if (res.message) {
        setActiveChat((prev: any) => ({
          ...prev,
          messages: [...(prev?.messages || []), res.message],
        }));
      }
      setActionFeedback("🚚 Tracking info sent to customer!");
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (e: any) {
      alert(e.message || "Failed to send tracking");
    }
  };

  // 1-Click Send Payment
  const handleSendOrderPayment = async (orderId: string) => {
    if (!selectedId) return;
    try {
      const res = await sendOrderPaymentDetailsAction(selectedId, orderId);
      if (res.message) {
        setActiveChat((prev: any) => ({
          ...prev,
          messages: [...(prev?.messages || []), res.message],
        }));
      }
      setActionFeedback("💳 Payment instructions sent to customer!");
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (e: any) {
      alert(e.message || "Failed to send payment info");
    }
  };

  // Slash Command Autocomplete Logic
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setReplyText(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const slashMatch = textBeforeCursor.match(/\/([a-zA-Z0-9_-]*)$/);

    if (slashMatch && slashMatch[1] !== undefined) {
      setSlashQuery(slashMatch[1].toLowerCase());
      setSelectedSlashIndex(0);
    } else {
      setSlashQuery(null);
    }
  };

  const matchingQuickReplies =
    slashQuery !== null
      ? quickReplies.filter(
          (qr) =>
            qr.shortcut.toLowerCase().includes(slashQuery) ||
            qr.title.toLowerCase().includes(slashQuery) ||
            qr.category.toLowerCase().includes(slashQuery)
        )
      : [];

  const insertQuickReply = (body: string) => {
    if (slashQuery !== null) {
      const regex = new RegExp(`\\/${slashQuery}$`);
      setReplyText((prev) => prev.replace(regex, body));
    } else {
      setReplyText((prev) => (prev ? `${prev} ${body}` : body));
    }
    setSlashQuery(null);
    textareaRef.current?.focus();
  };

  // Snippet Management Handlers
  const handleSaveSnippet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSnippet?.shortcut || !editingSnippet?.title || !editingSnippet?.body) {
      alert("Shortcut, Title, and Message Body are required");
      return;
    }
    setIsSavingSnippet(true);
    try {
      const res = await saveSupportQuickReplyAction(editingSnippet.id || null, {
        shortcut: editingSnippet.shortcut,
        title: editingSnippet.title,
        body: editingSnippet.body,
        category: editingSnippet.category || "General",
        sortOrder: editingSnippet.sortOrder ?? 0,
      });
      if (res.item) {
        setQuickReplies((prev) => {
          const idx = prev.findIndex((q) => q.id === res.item.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = res.item;
            return next;
          }
          return [...prev, res.item];
        });
        setEditingSnippet(null);
      }
    } catch (e: any) {
      alert(e.message || "Failed to save snippet");
    } finally {
      setIsSavingSnippet(false);
    }
  };

  const handleDeleteSnippet = async (id: string) => {
    if (!confirm("Are you sure you want to delete this snippet?")) return;
    try {
      await deleteSupportQuickReplyAction(id);
      setQuickReplies((prev) => prev.filter((q) => q.id !== id));
      if (editingSnippet?.id === id) setEditingSnippet(null);
    } catch (e: any) {
      alert(e.message || "Failed to delete snippet");
    }
  };

  const handleResetSnippets = async () => {
    if (!confirm("Reset all canned quick replies to default presets?")) return;
    try {
      const res = await resetSupportQuickRepliesAction();
      if (res.list) setQuickReplies(res.list);
    } catch (e: any) {
      alert(e.message || "Failed to reset snippets");
    }
  };

  return (
    <>
      {actionFeedback && (
        <div
          className="notice good"
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
            boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
            padding: "10px 18px",
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          {actionFeedback}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "330px 1fr 310px",
          height: "calc(100vh - 210px)",
          minHeight: 620,
          background: "#FFF",
          border: "1px solid var(--line, #CBD5E1)",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
        }}
      >
        {/* ========================================================= */}
        {/* LEFT PANE: TRIAGE & THREAD LIST                           */}
        {/* ========================================================= */}
        <div
          style={{
            borderRight: "1px solid var(--line, #E2E8F0)",
            display: "flex",
            flexDirection: "column",
            background: "#F8FAFC",
          }}
        >
          {/* Assignment Filter Tabs */}
          <div
            style={{
              padding: "10px 12px 6px",
              borderBottom: "1px solid #E2E8F0",
              background: "#FFF",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                background: "#F1F5F9",
                padding: 3,
                borderRadius: 8,
                marginBottom: 8,
              }}
            >
              {(["ALL", "MINE", "UNASSIGNED"] as const).map((tab) => {
                const isActive = assignmentTab === tab;
                const label = tab === "ALL" ? "All" : tab === "MINE" ? "Mine" : "Unassigned";
                const count = conversations.filter((c) => {
                  if (tab === "MINE") return c.assignedUserId === currentUserId;
                  if (tab === "UNASSIGNED") return !c.assignedUserId;
                  return true;
                }).length;

                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setAssignmentTab(tab)}
                    style={{
                      border: "none",
                      padding: "6px 4px",
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: isActive ? 700 : 500,
                      background: isActive ? "#FFF" : "transparent",
                      color: isActive ? "#0F172A" : "#64748B",
                      cursor: "pointer",
                      boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <input
              type="text"
              className="input"
              placeholder="Search phone, name, or message…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: 12.5, padding: "6px 10px", marginBottom: 8 }}
            />

            {/* Secondary Status Filters */}
            <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
              {(["ALL", "OPEN", "BOT_HANDLED", "RESOLVED"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    background: statusFilter === st ? "#0F172A" : "#E2E8F0",
                    color: statusFilter === st ? "#FFF" : "#475569",
                  }}
                >
                  {st === "ALL"
                    ? "All"
                    : st === "OPEN"
                    ? "Needs Action"
                    : st === "BOT_HANDLED"
                    ? "Bot"
                    : "Resolved"}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Cards List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filteredConversations.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center" }} className="muted">
                No matching conversations.
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = c.id === selectedId;
                const isAssignedToMe = c.assignedUserId === currentUserId;
                const assignedName = c.assignedUser?.name || (c.assignedUserId ? "Staff" : null);

                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectConversation(c.id)}
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid #F1F5F9",
                      cursor: "pointer",
                      background: isSelected ? "#EFF6FF" : "#FFF",
                      borderLeft: isSelected ? "3px solid #2563EB" : "3px solid transparent",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 3,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: "#0F172A" }}>
                        {c.customerName || c.customerPhone}
                      </div>
                      <span style={{ fontSize: 10.5, color: "#94A3B8" }}>
                        {new Date(c.lastMessageAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: "#475569",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 220,
                        }}
                      >
                        {c.lastMessageText || "No message"}
                      </div>
                      {c.unreadCount > 0 && (
                        <span
                          style={{
                            background: "#22C55E",
                            color: "#FFF",
                            borderRadius: 10,
                            padding: "1px 6px",
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {c.unreadCount}
                        </span>
                      )}
                    </div>

                    {/* Metadata Badges */}
                    <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
                      <span
                        className={`pill ${
                          c.status === "OPEN" ? "warn" : c.status === "BOT_HANDLED" ? "info" : "ok"
                        }`}
                        style={{ fontSize: 9.5, padding: "1px 5px" }}
                      >
                        {c.status === "OPEN" ? "Needs Action" : c.status === "BOT_HANDLED" ? "Bot" : "Resolved"}
                      </span>

                      {assignedName ? (
                        <span
                          style={{
                            fontSize: 10,
                            background: isAssignedToMe ? "#DCFCE7" : "#F1F5F9",
                            color: isAssignedToMe ? "#15803D" : "#475569",
                            padding: "1px 6px",
                            borderRadius: 4,
                            fontWeight: isAssignedToMe ? 700 : 500,
                          }}
                        >
                          👤 {assignedName}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 10,
                            background: "#FEF3C7",
                            color: "#B45309",
                            padding: "1px 6px",
                            borderRadius: 4,
                            fontWeight: 600,
                          }}
                        >
                          ⚠️ Unassigned
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* MIDDLE PANE: CHAT TRANSCRIPT & INTERACTIVE COMPOSER       */}
        {/* ========================================================= */}
        <div style={{ display: "flex", flexDirection: "column", background: "#ECE5DD", position: "relative" }}>
          {selectedConv ? (
            <>
              {/* Chat Header */}
              <div
                style={{
                  background: "#F0F2F5",
                  padding: "10px 16px",
                  borderBottom: "1px solid #CBD5E1",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: "#111827" }}>
                    {activeChat?.customer?.name || selectedConv.customerName || selectedConv.customerPhone}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748B" }}>
                    WhatsApp: <code>{selectedConv.customerPhone}</code>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Assignee Control */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {activeChat?.assignedUserId !== currentUserId && (
                      <button
                        type="button"
                        onClick={() => handleAssignStaff(currentUserId)}
                        disabled={!canEdit}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: "3px 8px" }}
                        title="Assign this conversation to yourself"
                      >
                        ✋ Claim
                      </button>
                    )}

                    <select
                      value={activeChat?.assignedUserId || ""}
                      onChange={(e) => handleAssignStaff(e.target.value ? e.target.value : null)}
                      disabled={!canEdit}
                      className="input"
                      style={{ fontSize: 11.5, padding: "3px 8px", width: "auto" }}
                    >
                      <option value="">(Unassigned)</option>
                      {staffUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          👤 {u.name} {u.id === currentUserId ? "(You)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bot Pause/Resume Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleBotPause}
                    disabled={!canEdit}
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: 11.5,
                      padding: "3px 8px",
                      background: isBotPaused ? "#FEF3C7" : "#EFF6FF",
                      borderColor: isBotPaused ? "#F59E0B" : "#3B82F6",
                      color: isBotPaused ? "#92400E" : "#1D4ED8",
                      fontWeight: 600,
                    }}
                    title={isBotPaused ? "Bot is paused on this thread. Click to resume." : "Bot is active. Click to pause."}
                  >
                    {isBotPaused ? "⏸️ Bot Paused" : "🤖 Bot Active"}
                  </button>

                  {/* Status Dropdown */}
                  <select
                    value={activeChat?.status || selectedConv.status}
                    onChange={(e) => handleStatusChange(e.target.value as WhatsAppConversationStatus)}
                    disabled={!canEdit}
                    className="input"
                    style={{ fontSize: 11.5, padding: "3px 8px", width: "auto" }}
                  >
                    <option value="OPEN">⚠️ Open (Staff Action)</option>
                    <option value="BOT_HANDLED">🤖 Bot Handled</option>
                    <option value="RESOLVED">✅ Resolved</option>
                  </select>

                  <a
                    href={`https://wa.me/${selectedConv.customerPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11.5, background: "#25D366", color: "#FFF", borderColor: "#25D366" }}
                  >
                    WA ↗
                  </a>
                </div>
              </div>

              {/* Chat Messages Body */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {isLoadingChat ? (
                  <div style={{ textAlign: "center", margin: "auto", color: "#64748B" }}>
                    Loading conversation…
                  </div>
                ) : activeChat?.messages?.length === 0 ? (
                  <div style={{ textAlign: "center", margin: "auto", color: "#64748B" }}>
                    No messages yet.
                  </div>
                ) : (
                  activeChat?.messages?.map((msg: ChatMessage) => {
                    const isCustomer = msg.sender === "CUSTOMER";
                    const isBot = msg.sender === "BOT";
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isCustomer ? "flex-start" : "flex-end",
                          maxWidth: "75%",
                          background: isCustomer ? "#FFFFFF" : isBot ? "#EFF6FF" : "#D9FDD3",
                          padding: "8px 12px",
                          borderRadius: isCustomer ? "8px 8px 8px 0px" : "8px 8px 0px 8px",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
                          fontSize: 13,
                          lineHeight: 1.45,
                          color: "#0F172A",
                        }}
                      >
                        {!isCustomer && (
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: isBot ? "#2563EB" : "#15803D",
                              marginBottom: 2,
                            }}
                          >
                            {isBot ? "🤖 WhatsApp Bot" : "👤 Staff Reply"}
                          </div>
                        )}
                        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {msg.body}
                        </div>
                        <div
                          style={{
                            fontSize: 9.5,
                            color: "#94A3B8",
                            textAlign: "right",
                            marginTop: 3,
                          }}
                        >
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Slash Command Autocomplete Popover */}
              {slashQuery !== null && matchingQuickReplies.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 110,
                    left: 14,
                    right: 14,
                    maxHeight: 220,
                    overflowY: "auto",
                    background: "#FFF",
                    border: "1px solid #CBD5E1",
                    borderRadius: 8,
                    boxShadow: "0 -4px 16px rgba(0,0,0,0.12)",
                    zIndex: 20,
                  }}
                >
                  <div
                    style={{
                      padding: "6px 12px",
                      background: "#F8FAFC",
                      borderBottom: "1px solid #E2E8F0",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#64748B",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>CANNED REPLIES (matching "/{slashQuery}")</span>
                    <span>Press Tab or Click to Insert</span>
                  </div>
                  {matchingQuickReplies.map((qr, idx) => (
                    <div
                      key={qr.id}
                      onClick={() => insertQuickReply(qr.body)}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderBottom: "1px solid #F1F5F9",
                        background: idx === selectedSlashIndex ? "#EFF6FF" : "#FFF",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 700, color: "#2563EB", fontSize: 12 }}>
                          /{qr.shortcut}
                        </span>{" "}
                        <span style={{ fontWeight: 600, color: "#1E293B", fontSize: 12 }}>
                          {qr.title}
                        </span>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: "#64748B",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: 420,
                          }}
                        >
                          {qr.body}
                        </div>
                      </div>
                      <span className="pill info" style={{ fontSize: 9.5 }}>
                        {qr.category}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Replies Bar */}
              <div
                style={{
                  background: "#F0F2F5",
                  padding: "6px 12px",
                  borderTop: "1px solid #CBD5E1",
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  overflowX: "auto",
                  whiteSpace: "nowrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsManagingSnippets(true)}
                  style={{
                    background: "#0F172A",
                    color: "#FFF",
                    border: "none",
                    borderRadius: 14,
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  ⚙️ Snippets
                </button>

                {quickReplies.slice(0, 7).map((qr) => (
                  <button
                    key={qr.id}
                    type="button"
                    onClick={() => insertQuickReply(qr.body)}
                    style={{
                      background: "#FFF",
                      border: "1px solid #CBD5E1",
                      borderRadius: 14,
                      padding: "3px 10px",
                      fontSize: 11.5,
                      cursor: "pointer",
                      color: "#334155",
                    }}
                    title={qr.body}
                  >
                    /{qr.shortcut} · {qr.title}
                  </button>
                ))}
              </div>

              {/* Composer Input Box */}
              <div
                style={{
                  background: "#F0F2F5",
                  padding: "10px 14px",
                  borderTop: "1px solid #CBD5E1",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <textarea
                  ref={textareaRef}
                  className="textarea"
                  rows={2}
                  placeholder="Type a message or '/' for quick replies (Enter to send)…"
                  value={replyText}
                  onChange={handleTextareaChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      if (slashQuery !== null && matchingQuickReplies[selectedSlashIndex]) {
                        e.preventDefault();
                        insertQuickReply(matchingQuickReplies[selectedSlashIndex].body);
                        return;
                      }
                      e.preventDefault();
                      handleSendReply();
                    } else if (e.key === "Escape") {
                      setSlashQuery(null);
                    }
                  }}
                  disabled={!canEdit || isSending}
                  style={{
                    borderRadius: 12,
                    padding: "8px 12px",
                    fontSize: 13,
                    flex: 1,
                  }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSendReply}
                  disabled={!canEdit || isSending || !replyText.trim()}
                  style={{ borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 700 }}
                >
                  {isSending ? "…" : "Send"}
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", margin: "auto", color: "#64748B" }}>
              Select a conversation on the left to start chatting.
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* RIGHT PANE: CUSTOMER PROFILE & ORDER ACTION HUB           */}
        {/* ========================================================= */}
        <div
          style={{
            borderLeft: "1px solid var(--line, #E2E8F0)",
            background: "#FFF",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            padding: 14,
          }}
        >
          <h4 style={{ margin: "0 0 10px", fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>
            Customer Context
          </h4>

          {selectedConv ? (
            <div>
              {/* Profile Card */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 12,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                  {activeChat?.customer?.name || selectedConv.customerName || "Customer"}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {selectedConv.customerPhone}
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11.5 }}>
                  <div>
                    <span className="muted">Orders:</span>{" "}
                    <b>{activeChat?.customer?.totalOrders ?? 0}</b>
                  </div>
                  <div>
                    <span className="muted">Spent:</span>{" "}
                    <b>৳ {Number(activeChat?.customer?.totalSpent ?? 0).toLocaleString("en-IN")}</b>
                  </div>
                </div>
              </div>

              {/* 1-Click Quick Order CTA */}
              <Link
                href={`/orders/new?phone=${selectedConv.customerPhone}&name=${encodeURIComponent(
                  activeChat?.customer?.name || selectedConv.customerName || ""
                )}`}
                className="btn btn-primary btn-sm"
                style={{
                  width: "100%",
                  textAlign: "center",
                  display: "block",
                  marginBottom: 14,
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                ➕ Create New Order
              </Link>

              {/* Recent Orders Action Cards */}
              <h5 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#64748B" }}>
                Recent Orders ({activeChat?.customer?.orders?.length ?? 0})
              </h5>

              {activeChat?.customer?.orders?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeChat.customer.orders.map((ord: CustomerOrderSummary) => (
                    <div
                      key={ord.id}
                      style={{
                        border: "1px solid #E2E8F0",
                        borderRadius: 8,
                        padding: 10,
                        background: "#FAFAFA",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Link
                          href={`/orders/${ord.id}`}
                          style={{ fontWeight: 700, fontSize: 12.5, color: "#2563EB", textDecoration: "none" }}
                        >
                          #{ord.orderNumber}
                        </Link>
                        <span
                          className={`pill ${ord.status === "CONFIRMED" ? "ok" : ord.status === "PENDING" ? "warn" : "info"}`}
                          style={{ fontSize: 9.5, padding: "1px 5px" }}
                        >
                          {ord.status}
                        </span>
                      </div>

                      <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
                        ৳ {Number(ord.totalAmount).toLocaleString("en-IN")} ·{" "}
                        {new Date(ord.createdAt).toLocaleDateString()}
                      </div>

                      {ord.trackingCode && (
                        <div style={{ fontSize: 10.5, color: "#1E40AF", marginTop: 3 }}>
                          📦 {ord.courierProvider}: <code>{ord.trackingCode}</code>
                        </div>
                      )}

                      {/* 1-Click Action Buttons for this order */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 4,
                          marginTop: 8,
                          paddingTop: 6,
                          borderTop: "1px solid #E2E8F0",
                        }}
                      >
                        {ord.status === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => handleQuickConfirmOrder(ord.id)}
                            disabled={!canEdit}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 10.5, padding: "2px 4px", fontWeight: 600 }}
                            title="Confirm order & notify customer"
                          >
                            ⚡ Confirm
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleSendOrderTracking(ord.id)}
                          disabled={!canEdit}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 10.5, padding: "2px 4px" }}
                          title="Send courier tracking details"
                        >
                          🚚 Tracking
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendOrderPayment(ord.id)}
                          disabled={!canEdit}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 10.5, padding: "2px 4px" }}
                          title="Send bKash/Nagad payment info"
                        >
                          💳 Payment
                        </button>

                        <Link
                          href={`/orders/${ord.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 10.5, padding: "2px 4px", textAlign: "center" }}
                        >
                          🔍 View
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 12 }}>
                  No recorded orders yet.
                </div>
              )}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12 }}>
              No conversation selected.
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MANAGE QUICK REPLIES MODAL                                */}
      {/* ========================================================= */}
      {isManagingSnippets && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#FFF",
              borderRadius: 12,
              width: "100%",
              maxWidth: 640,
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Manage Canned Quick Replies</h3>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
                  Configure shortcuts (type "/" in chat to trigger).
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setIsManagingSnippets(false);
                  setEditingSnippet(null);
                }}
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
              {/* Snippet Form */}
              {editingSnippet ? (
                <form onSubmit={handleSaveSnippet} className="stack" style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {editingSnippet.id ? "Edit Snippet" : "Create New Snippet"}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <label className="field" style={{ marginBottom: 0 }}>
                      <span className="label">Shortcut (e.g. "confirm", "bkash")</span>
                      <input
                        type="text"
                        className="input"
                        placeholder="shortcut"
                        value={editingSnippet.shortcut || ""}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
                          setEditingSnippet((prev: Partial<SupportQuickReply> | null) => ({
                            ...(prev || {}),
                            shortcut: val,
                          }));
                        }}
                        required
                      />
                    </label>

                    <label className="field" style={{ marginBottom: 0 }}>
                      <span className="label">Category</span>
                      <select
                        className="input"
                        value={editingSnippet.category || "General"}
                        onChange={(e) => {
                          const cat = e.target.value;
                          setEditingSnippet((prev: Partial<SupportQuickReply> | null) => ({
                            ...(prev || {}),
                            category: cat,
                          }));
                        }}
                      >
                        <option value="General">General</option>
                        <option value="Orders">Orders</option>
                        <option value="Payments">Payments</option>
                        <option value="Delivery">Delivery</option>
                      </select>
                    </label>
                  </div>

                  <label className="field">
                    <span className="label">Title / Label</span>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Order Confirmation"
                      value={editingSnippet.title || ""}
                      onChange={(e) => {
                        const ttl = e.target.value;
                        setEditingSnippet((prev: Partial<SupportQuickReply> | null) => ({
                          ...(prev || {}),
                          title: ttl,
                        }));
                      }}
                      required
                    />
                  </label>

                  <label className="field">
                    <span className="label">Message Body</span>
                    <textarea
                      className="textarea"
                      rows={3}
                      placeholder="Type the response message that will be pasted into WhatsApp…"
                      value={editingSnippet.body || ""}
                      onChange={(e) => {
                        const bdy = e.target.value;
                        setEditingSnippet((prev: Partial<SupportQuickReply> | null) => ({
                          ...(prev || {}),
                          body: bdy,
                        }));
                      }}
                      required
                    />
                  </label>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="submit"
                      disabled={isSavingSnippet}
                      className="btn btn-primary btn-sm"
                    >
                      {isSavingSnippet ? "Saving…" : "Save Snippet"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditingSnippet(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      setEditingSnippet({
                        shortcut: "",
                        title: "",
                        body: "",
                        category: "General",
                        sortOrder: quickReplies.length + 1,
                      })
                    }
                  >
                    ➕ New Snippet
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleResetSnippets}
                  >
                    🔄 Reset to Bengali Presets
                  </button>
                </div>
              )}

              {/* Snippets List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {quickReplies.map((qr) => (
                  <div
                    key={qr.id}
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: 8,
                      padding: "10px 14px",
                      background: "#FAFAFA",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: 10 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: "#2563EB", fontSize: 13 }}>
                          /{qr.shortcut}
                        </span>
                        <span style={{ fontWeight: 600, color: "#0F172A", fontSize: 13 }}>
                          {qr.title}
                        </span>
                        <span className="pill info" style={{ fontSize: 9.5 }}>
                          {qr.category}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#475569",
                          marginTop: 4,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {qr.body}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: "2px 8px" }}
                        onClick={() => setEditingSnippet(qr)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: "2px 8px", color: "#DC2626" }}
                        onClick={() => handleDeleteSnippet(qr.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
