"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { AdminCopilotMessage, AdminCopilotResponse, AdminCopilotActionLink } from "@biztrackbd/core";

export function AdminCopilotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<
    Array<{
      role: "user" | "model";
      text: string;
      actionLinks?: AdminCopilotActionLink[];
    }>
  >([
    {
      role: "model",
      text: "আসসালামু আলাইকুম! আমি আপনার বিজট্র্যাক এআই বিজনেস কো-পাইলট। আজকের সেলস, পেন্ডিং অর্ডার, বুকিং বা কাস্টমার মেসেজ ড্রাফটের বিষয়ে যেকোনো প্রশ্ন করতে পারেন।",
      actionLinks: [
        { label: "অর্ডার ম্যানেজমেন্ট", href: "/orders" },
        { label: "বুকিং ও লিডস", href: "/bookings" },
      ],
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const [isCustomKey, setIsCustomKey] = useState<boolean>(false);
  const [suggestedPills, setSuggestedPills] = useState<string[]>([
    "আজকের সেলস ও অর্ডার সামারি দিন",
    "পেন্ডিং বুকিং ও লিড চেক করুন",
    "লো-স্টক প্রোডাক্ট কোনগুলো?",
    "ডেলিভারি ডিলের জন্য কাস্টমার মেসেজ ড্রাফট করুন",
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg = { role: "user" as const, text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const history: AdminCopilotMessage[] = updatedMessages
        .filter((m) => m.role === "user" || m.role === "model")
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      const data: AdminCopilotResponse = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: data.reply,
          actionLinks: data.actionLinks,
        },
      ]);

      if (data.quotaRemaining !== undefined) setQuotaRemaining(data.quotaRemaining);
      if (data.isCustomKey !== undefined) setIsCustomKey(data.isCustomKey);
      if (data.suggestedQuestions && data.suggestedQuestions.length > 0) {
        setSuggestedPills(data.suggestedQuestions);
      }
    } catch (err) {
      console.error("[admin copilot widget] error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: "দুঃখিত, সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে সেটিংস থেকে আপনার এআই কি যাচাই করুন।",
          actionLinks: [{ label: "AI সেটিংস চেক করুন", href: "/settings/ai" }],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Launcher Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          bottom: "calc(24px + var(--float-lift, 0px))",
          right: "24px",
          zIndex: 990,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
          color: "#FFFFFF",
          padding: "12px 20px",
          borderRadius: "9999px",
          boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.45), 0 8px 10px -6px rgba(79, 70, 229, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          cursor: "pointer",
          fontWeight: 700,
          fontSize: "14px",
          transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        aria-label="Toggle AI Business Copilot"
      >
        <span style={{ fontSize: "16px" }}>✨</span>
        <span>{isOpen ? "কো-পাইলট বন্ধ করুন" : "AI কো-পাইলট"}</span>
        <span
          style={{
            width: "8px",
            height: "8px",
            background: "#4ADE80",
            borderRadius: "50%",
            boxShadow: "0 0 0 0 rgba(74, 222, 128, 0.7)",
          }}
        />
      </button>

      {/* Slide-up Drawer */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "calc(82px + var(--float-lift, 0px))",
            right: "24px",
            width: "430px",
            maxWidth: "calc(100vw - 32px)",
            height: "620px",
            maxHeight: "calc(100vh - 120px)",
            background: "#FFFFFF",
            borderRadius: "16px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08)",
            display: "flex",
            flexDirection: "column",
            zIndex: 991,
            overflow: "hidden",
            animation: "btSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)",
              color: "#FFFFFF",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "15px" }}>
                <span>✨</span>
                <span>BizTrack AI Copilot</span>
              </div>
              <div style={{ fontSize: "12px", opacity: 0.8, marginTop: "2px" }}>
                {isCustomKey
                  ? "Custom Key (Unlimited)"
                  : quotaRemaining !== null
                  ? `বাকি কোটা: ${quotaRemaining}`
                  : "লাইভ বিজনেস ইন্টেলিজেন্স"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                border: "none",
                color: "#FFFFFF",
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "14px",
              }}
            >
              ✕
            </button>
          </div>

          {/* Quota Exhaustion Alert Banner */}
          {quotaRemaining === 0 && !isCustomKey && (
            <div
              style={{
                padding: "8px 16px",
                background: "#FEF2F2",
                borderBottom: "1px solid #FECACA",
                color: "#991B1B",
                fontSize: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>মাসিক এআই কোটা শেষ।</span>
              <Link
                href="/settings/ai"
                onClick={() => setIsOpen(false)}
                style={{ fontWeight: 700, textDecoration: "underline", color: "#991B1B" }}
              >
                ফ্রি কী যোগ করুন →
              </Link>
            </div>
          )}

          {/* Message Thread */}
          <div
            style={{
              flex: 1,
              padding: "16px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              background: "#F8FAFC",
            }}
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "88%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: m.role === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                    background: m.role === "user" ? "#4F46E5" : "#FFFFFF",
                    color: m.role === "user" ? "#FFFFFF" : "#1E293B",
                    fontSize: "13.5px",
                    lineHeight: "1.55",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    boxShadow: m.role === "user" ? "none" : "0 1px 3px rgba(0, 0, 0, 0.06)",
                    border: m.role === "user" ? "none" : "1px solid #E2E8F0",
                  }}
                >
                  {m.text}
                </div>

                {/* 1-Click Action Links */}
                {m.actionLinks && m.actionLinks.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "2px" }}>
                    {m.actionLinks.map((action, aIdx) => (
                      <Link
                        key={aIdx}
                        href={action.href}
                        onClick={() => setIsOpen(false)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "12px",
                          fontWeight: 600,
                          padding: "4px 10px",
                          background: "#EEF2FF",
                          color: "#4338CA",
                          borderRadius: "6px",
                          border: "1px solid #C7D2FE",
                          textDecoration: "none",
                        }}
                      >
                        {action.label} ↗
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div
                style={{
                  alignSelf: "flex-start",
                  padding: "10px 14px",
                  borderRadius: "14px 14px 14px 2px",
                  background: "#FFFFFF",
                  color: "#64748B",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  border: "1px solid #E2E8F0",
                }}
              >
                <span style={{ animation: "pulse 1.5s infinite" }}>✨ এআই হিসাব করছে…</span>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          {/* Quick Suggestion Pills */}
          <div
            style={{
              padding: "8px 12px",
              background: "#FFFFFF",
              borderTop: "1px solid #E2E8F0",
              display: "flex",
              gap: "6px",
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
                  background: "#F1F5F9",
                  border: "1px solid #CBD5E1",
                  borderRadius: "9999px",
                  padding: "5px 12px",
                  fontSize: "12px",
                  color: "#334155",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                {pill}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: "12px 16px",
              background: "#FFFFFF",
              borderTop: "1px solid #E2E8F0",
              display: "flex",
              gap: "8px",
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="যেকোনো প্রশ্ন লিখুন (যেমন: আজকের সেলস কত?)..."
              disabled={loading}
              style={{
                flex: 1,
                padding: "10px 14px",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                fontSize: "13.5px",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                background: "#4F46E5",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "8px",
                padding: "0 16px",
                fontWeight: 700,
                fontSize: "13.5px",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                opacity: loading || !input.trim() ? 0.6 : 1,
              }}
            >
              পাঠান
            </button>
          </form>
        </div>
      )}
    </>
  );
}
