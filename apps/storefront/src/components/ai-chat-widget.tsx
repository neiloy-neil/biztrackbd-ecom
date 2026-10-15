"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ChatMessage, ChatResponse } from "@biztrackbd/core";

interface Props {
  enabled?: boolean;
  botName?: string | null;
  welcomeMessage?: string | null;
  escalatePhone?: string | null;
  storeName?: string;
}

export function AiChatWidget({
  enabled = true,
  botName,
  welcomeMessage,
  escalatePhone,
  storeName = "আমাদের শপ",
}: Props) {
  if (!enabled) return null;

  const displayName = botName?.trim() || "AI শপিং অ্যাসিস্ট্যান্ট";
  const defaultWelcome =
    welcomeMessage?.trim() ||
    `আসসালামু আলাইকুম! ${storeName}-এ স্বাগতম। আমি আপনার AI অ্যাসিস্ট্যান্ট। পণ্য জানতে বা অর্ডার ট্র্যাক করতে যে কোনো প্রশ্ন করতে পারেন।`;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{
    role: "user" | "model";
    text: string;
    orderTracking?: ChatResponse["orderTracking"];
    suggestedProducts?: ChatResponse["suggestedProducts"];
    whatsappUrl?: string | null;
  }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestedPills, setSuggestedPills] = useState<string[]>([
    "আমার অর্ডার ট্র্যাক করুন",
    "ডেলিভারি চার্জ কত?",
    "সেরা অফার কী কী আছে?",
    "সরাসরি কথা বলুন",
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: "model",
          text: defaultWelcome,
        },
      ]);
    }
  }, [defaultWelcome, messages.length]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  async function handleSend(textToSend?: string) {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg = { role: "user" as const, text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const history: ChatMessage[] = updatedMessages
        .filter((m) => m.role === "user" || m.role === "model")
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");
      const data: ChatResponse = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: data.reply,
          orderTracking: data.orderTracking,
          suggestedProducts: data.suggestedProducts,
          whatsappUrl: data.whatsappUrl,
        },
      ]);

      if (data.suggestedQuestions && data.suggestedQuestions.length > 0) {
        setSuggestedPills(data.suggestedQuestions);
      }
    } catch (err) {
      console.error("AI Chatbot error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: "দুঃখিত, সংযোগে সাময়িক সমস্যা হচ্ছে। আপনি কি আমাদের সাথে সরাসরি কথা বলতে চান?",
          whatsappUrl: escalatePhone ? `https://wa.me/880${escalatePhone.replace(/\D/g, "").slice(-10)}` : null,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        .bt-ai-chat-bubble {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 998;
          display: flex;
          align-items: center;
          gap: 9px;
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          color: #ffffff;
          padding: 12px 18px;
          border-radius: 9999px;
          box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.45), 0 8px 10px -6px rgba(79, 70, 229, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .bt-ai-chat-bubble:hover {
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 14px 28px -4px rgba(79, 70, 229, 0.55);
        }
        .bt-ai-pulse {
          width: 8px;
          height: 8px;
          background: #4ade80;
          border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7);
          animation: btPulse 2s infinite;
        }
        @keyframes btPulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(74, 222, 128, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
        }
        .bt-chat-window {
          position: fixed;
          bottom: 88px;
          right: 24px;
          width: 380px;
          max-width: calc(100vw - 32px);
          height: 540px;
          max-height: calc(100vh - 120px);
          background: var(--bg-card, #ffffff);
          color: var(--ink-1, #111827);
          border-radius: 20px;
          box-shadow: 0 20px 40px -8px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.08);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: btSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes btSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (max-width: 640px) {
          .bt-ai-chat-bubble {
            bottom: 80px;
            right: 16px;
            padding: 10px 14px;
            font-size: 13px;
          }
          .bt-chat-window {
            bottom: 16px;
            right: 16px;
            left: 16px;
            width: auto;
            height: calc(100vh - 100px);
          }
        }
      `}</style>

      {/* Floating Trigger Bubble */}
      <button
        type="button"
        className="bt-ai-chat-bubble"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open Store Assistant"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>{displayName}</span>
        <span className="bt-ai-pulse" />
      </button>

      {/* Chat Window Drawer */}
      {isOpen && (
        <div className="bt-chat-window" role="dialog" aria-modal="true" aria-label={displayName}>
          {/* Header */}
          <div
            style={{
              padding: "14px 18px",
              background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.2 }}>{displayName}</div>
                <div style={{ fontSize: 11.5, opacity: 0.9, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80" }} />
                  <span>Store Assistant</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                border: "none",
                color: "#ffffff",
                width: 28,
                height: 28,
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
              }}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              background: "#f9fafb",
            }}
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: m.role === "user" ? "flex-end" : "flex-start",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    maxWidth: "84%",
                    padding: "10px 14px",
                    borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    background: m.role === "user" ? "#4f46e5" : "#ffffff",
                    color: m.role === "user" ? "#ffffff" : "#1f2937",
                    fontSize: 13.5,
                    lineHeight: 1.45,
                    boxShadow: m.role === "user" ? "0 2px 4px rgba(79, 70, 229, 0.2)" : "0 1px 3px rgba(0, 0, 0, 0.08)",
                    border: m.role === "user" ? "none" : "1px solid #e5e7eb",
                    whiteSpace: "pre-line",
                  }}
                >
                  {m.text}
                </div>

                {/* Order Tracking Card (if available) */}
                {m.orderTracking && (
                  <div
                    style={{
                      width: "90%",
                      padding: "12px",
                      borderRadius: 12,
                      background: "#ffffff",
                      border: "1px solid #e0e7ff",
                      boxShadow: "0 2px 8px rgba(99, 102, 241, 0.1)",
                      fontSize: 12.5,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: "#374151" }}>অর্ডার #{m.orderTracking.orderNumber}</span>
                      <span
                        style={{
                          background: "#e0e7ff",
                          color: "#4338ca",
                          padding: "2px 8px",
                          borderRadius: 9999,
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      >
                        {m.orderTracking.status}
                      </span>
                    </div>
                    <div style={{ color: "#6b7280", marginBottom: 6 }}>
                      মোট টাকা: <strong style={{ color: "#111827" }}>৳{m.orderTracking.total.toLocaleString("en-BD")}</strong>
                    </div>
                    {m.orderTracking.courierName && (
                      <div style={{ color: "#6b7280", fontSize: 11.5, marginBottom: 6 }}>
                        কুরিয়ার: {m.orderTracking.courierName}
                      </div>
                    )}
                    {m.orderTracking.trackingUrl && (
                      <a
                        href={m.orderTracking.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-block",
                          marginTop: 4,
                          color: "#4f46e5",
                          fontWeight: 600,
                          textDecoration: "underline",
                        }}
                      >
                        লাইভ পার্সেল ট্র্যাক করুন →
                      </a>
                    )}
                  </div>
                )}

                {/* Product Recommendations */}
                {m.suggestedProducts && m.suggestedProducts.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "90%" }}>
                    {m.suggestedProducts.map((p, pIdx) => (
                      <Link
                        key={pIdx}
                        href={`/p/${p.slug}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          background: "#ffffff",
                          borderRadius: 10,
                          border: "1px solid #e5e7eb",
                          textDecoration: "none",
                          fontSize: 12.5,
                          transition: "border-color 0.15s",
                        }}
                      >
                        <span style={{ color: "#1f2937", fontWeight: 500 }}>{p.title}</span>
                        <span style={{ color: "#4f46e5", fontWeight: 700 }}>৳{p.price.toLocaleString("en-BD")}</span>
                      </Link>
                    ))}
                  </div>
                )}

                {/* WhatsApp Escalation Button */}
                {m.whatsappUrl && (
                  <a
                    href={m.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#25D366",
                      color: "#05290f",
                      padding: "6px 12px",
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: "none",
                      boxShadow: "0 2px 6px rgba(37, 211, 102, 0.3)",
                    }}
                  >
                    <span>সরাসরি হোয়াটসঅ্যাপে কথা বলুন</span>
                  </a>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#6b7280", fontSize: 12.5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4f46e5", animation: "btPulse 1s infinite" }} />
                <span>উত্তর তৈরি হচ্ছে...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Quick Question Pills */}
          <div
            style={{
              padding: "8px 12px",
              background: "#ffffff",
              borderTop: "1px solid #f3f4f6",
              display: "flex",
              gap: 6,
              overflowX: "auto",
              whiteSpace: "nowrap",
            }}
          >
            {suggestedPills.map((pill, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() => handleSend(pill)}
                disabled={loading}
                style={{
                  background: "#f3f4f6",
                  border: "1px solid #e5e7eb",
                  borderRadius: 9999,
                  padding: "4px 10px",
                  fontSize: 11.5,
                  color: "#374151",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {pill}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: "10px 14px",
              background: "#ffffff",
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="আপনার প্রশ্ন লিখুন (বা ফোন নম্বর দিন)..."
              disabled={loading}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 20,
                border: "1px solid #d1d5db",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                background: "#4f46e5",
                color: "#ffffff",
                border: "none",
                borderRadius: "50%",
                width: 34,
                height: 34,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                opacity: loading || !input.trim() ? 0.6 : 1,
              }}
              aria-label="Send message"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
