"use client";

import { useState } from "react";
import Link from "next/link";
import type { WhatsAppConversationStatus } from "@biztrackbd/core";
import {
  sendStaffWhatsAppReplyAction,
  setWhatsAppConversationStatusAction,
  getWhatsAppConversationDetailAction,
} from "./actions";

interface CustomerOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: any;
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
  customer?: CustomerSummary | null;
}

interface Props {
  initialConversations: ConversationItem[];
  canEdit: boolean;
}

const QUICK_REPLIES = [
  "আসসালামু আলাইকুম! কীভাবে আপনাকে সাহায্য করতে পারি?",
  "আপনার অর্ডারটি সফলভাবে কনফার্ম করা হয়েছে। 🌸",
  "আপনার পার্সেল কুরিয়ারে পাঠানো হয়েছে। শীঘ্রই ডেলিভারি পাবেন। 🚚",
  "ডেলিভারির জন্য ক্যাশ অন ডেলিভারির মোট টাকা প্রস্তুত রাখুন।",
  "ধন্যবাদ আমাদের স্টোরে কেনাকাটা করার জন্য! ❤️",
];

export function WhatsAppDeskClient({ initialConversations, canEdit }: Props) {
  const [conversations, setConversations] = useState<ConversationItem[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversations[0]?.id || null);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Load conversation details when selection changes
  const handleSelectConversation = async (id: string) => {
    setSelectedId(id);
    setIsLoadingChat(true);
    try {
      const detail = await getWhatsAppConversationDetailAction(id);
      setActiveChat(detail);
      // Mark as read in local list
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
      );
    } catch (e: any) {
      console.error("Failed to load chat details:", e);
    } finally {
      setIsLoadingChat(false);
    }
  };

  // If initial load and none selected yet, load the first one
  useState(() => {
    if (initialConversations[0]?.id) {
      handleSelectConversation(initialConversations[0].id);
    }
  });

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (filterStatus !== "ALL" && c.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPhone = c.customerPhone.includes(q);
      const matchName = c.customerName?.toLowerCase().includes(q) ?? false;
      const matchMsg = c.lastMessageText?.toLowerCase().includes(q) ?? false;
      return matchPhone || matchName || matchMsg;
    }
    return true;
  });

  // Handle staff reply
  const handleSendReply = async () => {
    if (!selectedId || !replyText.trim()) return;
    const textToSend = replyText.trim();
    setIsSending(true);
    try {
      const res = await sendStaffWhatsAppReplyAction(selectedId, textToSend);
      if (res.success && res.message) {
        // Append to chat
        setActiveChat((prev: any) => ({
          ...prev,
          messages: [...(prev?.messages || []), res.message],
          status: "RESOLVED",
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

  // Handle status change
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

  const selectedConv = conversations.find((c) => c.id === selectedId);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "320px 1fr 300px",
        height: "calc(100vh - 210px)",
        minHeight: 580,
        background: "#FFF",
        border: "1px solid var(--line, #E2E8F0)",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
      }}
    >
      {/* LEFT PANE: THREAD LIST */}
      <div
        style={{
          borderRight: "1px solid var(--line, #E2E8F0)",
          display: "flex",
          flexDirection: "column",
          background: "#F8FAFC",
        }}
      >
        {/* Search & Filters */}
        <div style={{ padding: 12, borderBottom: "1px solid var(--line, #E2E8F0)" }}>
          <input
            type="text"
            className="input"
            placeholder="Search phone, name, or text…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ fontSize: 13, marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 4 }}>
            {(["ALL", "OPEN", "BOT_HANDLED", "RESOLVED"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: filterStatus === st ? "#1E293B" : "#E2E8F0",
                  color: filterStatus === st ? "#FFF" : "#475569",
                }}
              >
                {st === "ALL" ? "All" : st === "OPEN" ? "Needs Action" : st === "BOT_HANDLED" ? "Bot" : "Resolved"}
              </button>
            ))}
          </div>
        </div>

        {/* Thread List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredConversations.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center" }} className="muted">
              No conversations found.
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isSelected = c.id === selectedId;
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelectConversation(c.id)}
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #F1F5F9",
                    cursor: "pointer",
                    background: isSelected ? "#EFF6FF" : "#FFF",
                    transition: "background 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: "#0F172A" }}>
                      {c.customerName || c.customerPhone}
                    </div>
                    <span style={{ fontSize: 11, color: "#94A3B8" }}>
                      {new Date(c.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div
                      style={{
                        fontSize: 12.5,
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
                          fontSize: 10.5,
                          fontWeight: 700,
                        }}
                      >
                        {c.unreadCount}
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
                    <span
                      className={`pill ${
                        c.status === "OPEN" ? "warn" : c.status === "BOT_HANDLED" ? "info" : "ok"
                      }`}
                      style={{ fontSize: 10, padding: "1px 6px" }}
                    >
                      {c.status === "OPEN" ? "Open" : c.status === "BOT_HANDLED" ? "Bot" : "Resolved"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MIDDLE PANE: CHAT BUBBLE VIEW & REPLY INPUT */}
      <div style={{ display: "flex", flexDirection: "column", background: "#ECE5DD" }}>
        {selectedConv ? (
          <>
            {/* Chat Header */}
            <div
              style={{
                background: "#F0F2F5",
                padding: "10px 18px",
                borderBottom: "1px solid var(--line, #CBD5E1)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>
                  {selectedConv.customerName || selectedConv.customerPhone}
                </div>
                <div style={{ fontSize: 12, color: "#64748B" }}>
                  WhatsApp: <code>{selectedConv.customerPhone}</code>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select
                  value={activeChat?.status || selectedConv.status}
                  onChange={(e) => handleStatusChange(e.target.value as WhatsAppConversationStatus)}
                  className="input"
                  style={{ fontSize: 12, padding: "4px 8px", width: "auto" }}
                >
                  <option value="OPEN">⚠️ Open (Needs Attention)</option>
                  <option value="BOT_HANDLED">🤖 Bot Handled</option>
                  <option value="RESOLVED">✅ Resolved</option>
                </select>

                <a
                  href={`https://wa.me/${selectedConv.customerPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 12, background: "#25D366", color: "#FFF", borderColor: "#25D366" }}
                >
                  Open in WA ↗
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
                  Loading chat…
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
                        fontSize: 13.5,
                        lineHeight: 1.45,
                        color: "#0F172A",
                      }}
                    >
                      {!isCustomer && (
                        <div
                          style={{
                            fontSize: 10.5,
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
                          fontSize: 10,
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
            </div>

            {/* Quick Replies Bar */}
            <div
              style={{
                background: "#F0F2F5",
                padding: "6px 12px",
                borderTop: "1px solid #CBD5E1",
                display: "flex",
                gap: 6,
                overflowX: "auto",
                whiteSpace: "nowrap",
              }}
            >
              {QUICK_REPLIES.map((qr, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setReplyText(qr)}
                  style={{
                    background: "#FFF",
                    border: "1px solid #CBD5E1",
                    borderRadius: 14,
                    padding: "3px 10px",
                    fontSize: 11.5,
                    cursor: "pointer",
                    color: "#334155",
                  }}
                >
                  {qr.slice(0, 24)}…
                </button>
              ))}
            </div>

            {/* Reply Input Box */}
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
                className="textarea"
                rows={1}
                placeholder="Type a message to the customer (Enter to send)…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
                disabled={!canEdit || isSending}
                style={{
                  resize: "none",
                  borderRadius: 20,
                  padding: "8px 14px",
                  fontSize: 13.5,
                  flex: 1,
                }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSendReply}
                disabled={!canEdit || isSending || !replyText.trim()}
                style={{ borderRadius: 20, padding: "8px 18px", fontSize: 13 }}
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

      {/* RIGHT PANE: CUSTOMER ORDER CONTEXT SIDEBAR */}
      <div
        style={{
          borderLeft: "1px solid var(--line, #E2E8F0)",
          background: "#FFF",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          padding: 16,
        }}
      >
        <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
          Customer Context
        </h4>

        {selectedConv ? (
          <div>
            {/* Customer Profile Box */}
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {activeChat?.customer?.name || selectedConv.customerName || "Customer"}
              </div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                {selectedConv.customerPhone}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 12 }}>
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
                marginBottom: 16,
                fontWeight: 600,
              }}
            >
              ⚡ Create Quick Order
            </Link>

            {/* Past Orders History */}
            <h5 style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 700, color: "#64748B" }}>
              Recent Orders
            </h5>

            {activeChat?.customer?.orders?.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {activeChat.customer.orders.map((ord: CustomerOrderSummary) => (
                  <Link
                    key={ord.id}
                    href={`/orders/${ord.id}`}
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: 6,
                      padding: "8px 10px",
                      textDecoration: "none",
                      color: "inherit",
                      background: "#FAFAFA",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <b>{ord.orderNumber}</b>
                      <span className="pill info" style={{ fontSize: 10, padding: "1px 5px" }}>
                        {ord.status}
                      </span>
                    </div>
                    <div className="muted" style={{ marginTop: 2 }}>
                      ৳ {Number(ord.totalAmount).toLocaleString("en-IN")} ·{" "}
                      {new Date(ord.createdAt).toLocaleDateString()}
                    </div>
                    {ord.trackingCode && (
                      <div style={{ fontSize: 11, color: "#2563EB", marginTop: 2 }}>
                        📦 {ord.courierProvider}: {ord.trackingCode}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 12 }}>
                No recorded orders yet.
              </div>
            )}
          </div>
        ) : (
          <div className="muted" style={{ fontSize: 13 }}>
            No customer selected.
          </div>
        )}
      </div>
    </div>
  );
}
