"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/ui";
import { sendCampaignAction, estimateAudienceAction } from "./actions";
import type { CampaignChannel, CampaignSegment } from "@biztrackbd/core";

const SEGMENT_DESCRIPTIONS: Record<CampaignSegment, string> = {
  ALL: "All active customers with a valid phone number",
  ABANDONED_CART: "Leads with open carts / entered checkout in the last 24-72 hours",
  VIP: "VIP customers (spent ৳15,000+ or placed 5+ orders)",
  REPEAT: "Loyal repeat buyers (placed 2 or more orders)",
  DORMANT: "Past buyers who haven't placed an order in the last 60 days",
  DHAKA: "Customers whose shipping district is Dhaka",
  OUTSIDE_DHAKA: "Customers located outside Dhaka district across all 63 districts",
};

interface Props {
  isWhatsAppConnected?: boolean;
  whatsAppNumber?: string | null;
}

export function NewCampaignModal({ isWhatsAppConnected = false, whatsAppNumber }: Props) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<CampaignChannel>("WHATSAPP");
  const [segment, setSegment] = useState<CampaignSegment>("ALL");
  const [body, setBody] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");

  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [estimatedSeconds, setEstimatedSeconds] = useState<number>(0);
  const [isLoadingAudience, setIsLoadingAudience] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isNonAscii = /[^\u0000-\u007F]/.test(body);
  const limitPerPart = isNonAscii ? 70 : 160;
  const parts = body.length === 0 ? 0 : Math.ceil(body.length / limitPerPart);

  // Auto-fetch audience estimate on channel/segment change
  useEffect(() => {
    if (!open) return;
    let active = true;
    setIsLoadingAudience(true);
    estimateAudienceAction(channel, segment, body)
      .then((res) => {
        if (!active) return;
        setAudienceCount(res.count);
        setEstimatedSeconds(res.estimatedSeconds);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingAudience(false);
      });

    return () => {
      active = false;
    };
  }, [channel, segment, open]);

  const insertVariable = (varName: string) => {
    const textToInsert = `{{${varName}}}`;
    const textarea = textareaRef.current;
    if (!textarea) {
      setBody((prev) => prev + textToInsert);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newBody = body.substring(0, start) + textToInsert + body.substring(end);
    setBody(newBody);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 10);
  };

  const formatEstimatedTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.ceil(seconds / 60);
    if (mins < 60) return `~${mins} min${mins > 1 ? "s" : ""}`;
    const hours = (mins / 60).toFixed(1);
    return `~${hours} hours`;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-primary"
        data-testid="create-campaign-modal-btn"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
      >
        <span>⚡</span>
        <span>+ New Broadcast</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backdropFilter: "blur(5px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 640,
              maxHeight: "92vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              borderRadius: 14,
              padding: "24px 28px",
              background: "#fff",
              border: "1px solid var(--line, #E2E8F0)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Launch Broadcast Campaign</h2>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                  Engage customers with targeted promotional campaigns and anti-ban pacing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-secondary btn-sm"
                style={{ padding: "4px 8px", fontSize: 13 }}
              >
                ✕
              </button>
            </div>

            <form action={sendCampaignAction} className="stack" style={{ gap: 16 }}>
              {/* Channel Selector */}
              <div>
                <span className="label" style={{ marginBottom: 6, display: "block", fontWeight: 600 }}>Broadcast Channel *</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setChannel("WHATSAPP")}
                    className={`btn ${channel === "WHATSAPP" ? "btn-primary" : "btn-secondary"}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      padding: "10px 8px",
                      borderColor: channel === "WHATSAPP" ? "#10B981" : undefined,
                      background: channel === "WHATSAPP" ? "linear-gradient(135deg, #10B981, #059669)" : undefined,
                      color: channel === "WHATSAPP" ? "#fff" : undefined,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>📱</span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel("SMS")}
                    className={`btn ${channel === "SMS" ? "btn-primary" : "btn-secondary"}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      padding: "10px 8px",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>💬</span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>SMS Blast</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel("EMAIL")}
                    className={`btn ${channel === "EMAIL" ? "btn-primary" : "btn-secondary"}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      padding: "10px 8px",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>✉️</span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Email Blast</span>
                  </button>
                  <input type="hidden" name="channel" value={channel} />
                </div>
              </div>

              {/* WhatsApp Connection Status Indicator */}
              {channel === "WHATSAPP" && (
                <div
                  style={{
                    background: isWhatsAppConnected ? "rgba(16, 185, 129, 0.08)" : "rgba(245, 158, 11, 0.1)",
                    border: `1px solid ${isWhatsAppConnected ? "#10B981" : "#F59E0B"}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{isWhatsAppConnected ? "🟢" : "⚠️"}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: isWhatsAppConnected ? "#065F46" : "#92400E" }}>
                        {isWhatsAppConnected
                          ? `WhatsApp Web Connected (${whatsAppNumber || "Active Number"})`
                          : "WhatsApp Web Not Connected"}
                      </div>
                      <div style={{ fontSize: 11.5, color: isWhatsAppConnected ? "#047857" : "#B45309" }}>
                        {isWhatsAppConnected
                          ? "Ready for zero-Meta multi-message dispatch with smart human pacing."
                          : "You must connect your device via QR/Pairing code to send WhatsApp broadcasts."}
                      </div>
                    </div>
                  </div>
                  {!isWhatsAppConnected && (
                    <Link
                      href="/marketing/whatsapp"
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: 12, padding: "4px 8px", whiteSpace: "nowrap" }}
                    >
                      Connect Device →
                    </Link>
                  )}
                </div>
              )}

              {/* Campaign Name */}
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="label" style={{ fontWeight: 600 }}>Campaign Name * <span className="opt">(internal reference)</span></span>
                <input
                  name="name"
                  className="input"
                  required
                  placeholder="e.g. Eid Flash Sale 20% Off or Cart Recovery"
                  minLength={2}
                />
              </label>

              {/* Audience Segment */}
              <label className="field" style={{ marginBottom: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="label" style={{ fontWeight: 600 }}>Target Audience Segment *</span>
                  {audienceCount !== null && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--primary, #0284C7)" }}>
                      {isLoadingAudience ? "Estimating…" : `🎯 ${audienceCount.toLocaleString()} Recipients`}
                    </span>
                  )}
                </div>
                <select
                  name="targetSegment"
                  className="input"
                  value={segment}
                  onChange={(e) => setSegment(e.target.value as CampaignSegment)}
                >
                  <option value="ALL">👥 All Customers (with valid phone)</option>
                  <option value="ABANDONED_CART">🛒 Abandoned Checkouts (Leads with items in cart in last 24-72h)</option>
                  <option value="VIP">👑 VIP Customers (Spent ৳15,000+ or 5+ orders)</option>
                  <option value="REPEAT">🔁 Repeat Buyers (2+ orders)</option>
                  <option value="DORMANT">💤 Dormant Customers (No order in 60 days)</option>
                  <option value="DHAKA">📍 Inside Dhaka District</option>
                  <option value="OUTSIDE_DHAKA">🌏 Outside Dhaka District (63 Districts)</option>
                </select>
                <span className="muted" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
                  {SEGMENT_DESCRIPTIONS[segment]}
                </span>
              </label>

              {/* Email Subject if Email */}
              {channel === "EMAIL" && (
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label" style={{ fontWeight: 600 }}>Email Subject Line *</span>
                  <input
                    name="subject"
                    className="input"
                    required
                    placeholder="Exclusive offer just for you: 20% off this weekend!"
                  />
                </label>
              )}

              {/* Message Body & Variable Chips */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span className="label" style={{ fontWeight: 600 }}>Message Content *</span>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => insertVariable("customerName")}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: "2px 6px" }}
                      title="Insert Customer Name"
                    >
                      + Name
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable("storeName")}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: "2px 6px" }}
                      title="Insert Store Name"
                    >
                      + Store
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable("discountCode")}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: "2px 6px" }}
                      title="Insert Discount Coupon"
                    >
                      + Coupon
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable("cartUrl")}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 11, padding: "2px 6px" }}
                      title="Insert Recovery / Storefront URL"
                    >
                      + Link
                    </button>
                  </div>
                </div>
                <textarea
                  ref={textareaRef}
                  name="body"
                  className="textarea"
                  rows={4}
                  required
                  minLength={5}
                  placeholder={
                    channel === "WHATSAPP"
                      ? "Hi {{customerName}}! 🎉 Special Eid sale at {{storeName}}. Use coupon code {{discountCode}} to get 20% off. Shop now: {{cartUrl}}\n\nReply STOP to unsubscribe."
                      : channel === "SMS"
                      ? "Hi {{customerName}}, don't miss our flash sale! Get 20% off with code {{discountCode}}. Shop: {{cartUrl}}"
                      : "Write your email promotional message or newsletter update..."
                  }
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              {/* WhatsApp specific fields: Coupon & Media */}
              {channel === "WHATSAPP" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label className="field" style={{ marginBottom: 0 }}>
                    <span className="label" style={{ fontSize: 12 }}>Discount Coupon <span className="opt">(optional)</span></span>
                    <input
                      name="couponCode"
                      className="input"
                      placeholder="e.g. EID20"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    />
                  </label>
                  <label className="field" style={{ marginBottom: 0 }}>
                    <span className="label" style={{ fontSize: 12 }}>Flyer / Banner URL <span className="opt">(optional)</span></span>
                    <input
                      name="mediaUrl"
                      type="url"
                      className="input"
                      placeholder="https://.../banner.jpg"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                    />
                  </label>
                </div>
              )}

              {/* Anti-Ban & Pacing / SMS Details Info Box */}
              {channel === "WHATSAPP" && (
                <div
                  style={{
                    background: "rgba(16, 185, 129, 0.06)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 12.5,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, color: "#065F46" }}>🛡️ Smart Anti-Ban Pacing</span>
                    <span style={{ fontWeight: 600, color: "#047857" }}>
                      ETA: {formatEstimatedTime(estimatedSeconds)}
                    </span>
                  </div>
                  <div style={{ color: "#065F46", fontSize: 12 }}>
                    4-12s randomized human pacing delay between messages to safeguard your WhatsApp account from spam filters.
                  </div>
                </div>
              )}

              {channel === "SMS" && (
                <div style={{ background: "var(--bg-subtle, #F8FAFC)", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span>Characters: <b>{body.length}</b></span>
                    <span>
                      {parts} {parts === 1 ? "SMS part" : "SMS parts"} {isNonAscii ? "(Bangla/Unicode · 70 chars/part)" : "(Standard ASCII · 160 chars/part)"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted, #64748B)" }}>
                    Each recipient consumes {parts || 1} SMS credit. Opted-out numbers are automatically skipped.
                  </div>
                </div>
              )}

              {/* Scheduling Section */}
              <div style={{ background: "var(--bg-subtle, #F8FAFC)", border: "1px solid var(--line, #E2E8F0)", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      id="schedule-toggle"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                    <label htmlFor="schedule-toggle" style={{ fontWeight: 600, fontSize: 13, cursor: "pointer", margin: 0 }}>
                      Schedule for later (e.g. Evening peak at 8:30 PM)
                    </label>
                  </div>
                  {isScheduled && <span style={{ fontSize: 12, color: "#D97706", fontWeight: 600 }}>⏰ Scheduled</span>}
                </div>
                {isScheduled && (
                  <div style={{ marginTop: 10 }}>
                    <input
                      type="datetime-local"
                      name="scheduledFor"
                      className="input"
                      required={isScheduled}
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      style={{ fontSize: 13 }}
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <SubmitButton
                  className="btn btn-primary"
                  pending={isScheduled ? "Scheduling…" : "Dispatching…"}
                >
                  {isScheduled ? "⏰ Schedule Campaign" : "🚀 Launch Campaign Now"}
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
