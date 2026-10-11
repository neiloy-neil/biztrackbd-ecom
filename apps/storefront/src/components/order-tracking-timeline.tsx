"use client";

import { useState } from "react";
import type { OrderTrackingTimeline } from "@biztrackbd/core";

export function OrderTrackingTimelineComponent({
  timeline,
  lang,
}: {
  timeline: OrderTrackingTimeline;
  lang: "en" | "bn";
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const t = {
    deliveryTracking: lang === "bn" ? "ডেলিভারি ট্র্যাকিং" : "Delivery Tracking",
    courierDelivery: lang === "bn" ? "কুরিয়ার পার্টনার" : "Courier Partner",
    trackingId: lang === "bn" ? "ট্র্যাকিং আইডি" : "Tracking Code",
    consignmentId: lang === "bn" ? "কনসাইনমেন্ট নং" : "Consignment ID",
    trackOnCourier: lang === "bn" ? "কুরিয়ার ওয়েবসাইটে ট্র্যাক করুন" : "Track with Courier",
    copy: lang === "bn" ? "কপি" : "Copy",
    copied: lang === "bn" ? "কপি হয়েছে!" : "Copied!",
    checkpoints: lang === "bn" ? "বিস্তারিত ট্র্যাকিং হিস্টোরি" : "Detailed Courier Checkpoints",
    noCheckpoints: lang === "bn" ? "কোনো বিস্তারিত আপডেট এখনও নেই" : "No granular checkpoints logged yet",
    cancelledNotice: lang === "bn" ? "অর্ডারটি বাতিল করা হয়েছে" : "This order has been cancelled",
    returnedNotice: lang === "bn" ? "পার্সেলটি ফেরত পাঠানো হয়েছে" : "This parcel was returned",
  };

  const fmtTime = (d: Date | string | null | undefined) => {
    if (!d) return "";
    const date = typeof d === "string" ? new Date(d) : d;
    return new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Dhaka",
    }).format(date);
  };

  const copyCode = (code: string) => {
    void navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const courierCode = timeline.courier?.trackingCode || timeline.courier?.consignmentId;

  return (
    <div className="card" style={{ padding: 20 }} data-testid="order-tracking-timeline">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t.deliveryTracking}</h2>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {lang === "bn" ? "অর্ডার #" : "Order #"}{timeline.orderNumber}
          </span>
        </div>
        {timeline.isCancelled ? (
          <span className="pill bad">{t.cancelledNotice}</span>
        ) : timeline.isReturned ? (
          <span className="pill warn">{t.returnedNotice}</span>
        ) : (
          <span className={`pill ${timeline.isDelivered ? "ok" : "warn"}`}>
            {lang === "bn"
              ? timeline.stages[timeline.currentStageIndex]?.labelBn
              : timeline.stages[timeline.currentStageIndex]?.label}
          </span>
        )}
      </div>

      {/* 5-Stage Stepper Bar */}
      <div style={{ position: "relative", margin: "16px 0 24px" }} aria-label="Order stages">
        <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
          {/* Background Track Line */}
          <div
            style={{
              position: "absolute",
              top: 13,
              left: "10%",
              right: "10%",
              height: 3,
              background: "var(--line)",
              zIndex: 1,
            }}
          />
          {/* Active Fill Track */}
          <div
            style={{
              position: "absolute",
              top: 13,
              left: "10%",
              width: `${Math.min(100, Math.max(0, (timeline.currentStageIndex / (timeline.stages.length - 1)) * 80))}%`,
              height: 3,
              background: "var(--accent)",
              zIndex: 2,
              transition: "width 0.4s ease",
            }}
          />

          {timeline.stages.map((st, idx) => {
            const isDone = st.completed;
            const isCurrent = st.current;
            return (
              <div
                key={st.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flex: 1,
                  position: "relative",
                  zIndex: 3,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    background: isDone
                      ? "var(--accent)"
                      : isCurrent
                      ? "var(--surface)"
                      : "var(--surface)",
                    border: isDone
                      ? "2px solid var(--accent)"
                      : isCurrent
                      ? "3px solid var(--accent)"
                      : "2px solid var(--field)",
                    color: isDone ? "#fff" : "var(--ink)",
                    boxShadow: isCurrent ? "0 0 0 4px rgba(140, 90, 60, 0.18)" : "none",
                    transition: "all 0.2s ease",
                  }}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isDone ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <div style={{ marginTop: 8, maxWidth: 64 }}>
                  <div style={{ fontSize: 11, fontWeight: isCurrent ? 700 : isDone ? 600 : 500, color: isCurrent ? "var(--accent-strong)" : isDone ? "var(--ink)" : "var(--faint)", lineHeight: 1.2 }}>
                    {lang === "bn" ? st.labelBn : st.label}
                  </div>
                  {st.date && (
                    <div className="muted" style={{ fontSize: 9.5, marginTop: 2 }}>
                      {fmtTime(st.date).split(",")[0]}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Courier Info Card */}
      {timeline.courier && (
        <div
          style={{
            background: "var(--tint-1)",
            borderRadius: 10,
            padding: "14px 16px",
            border: "1px solid var(--line)",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    background: "var(--accent)",
                    color: "#fff",
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 6,
                    letterSpacing: 0.5,
                  }}
                >
                  {timeline.courier.provider ?? "COURIER"}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{t.courierDelivery}</span>
              </div>
              {courierCode && (
                <div style={{ marginTop: 6, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="muted">{t.trackingId}:</span>
                  <code style={{ background: "var(--surface)", padding: "2px 6px", borderRadius: 4, fontWeight: 700, fontSize: 13 }}>
                    {courierCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyCode(courierCode)}
                    style={{
                      border: "none",
                      background: "none",
                      color: copied ? "var(--success)" : "var(--accent)",
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {copied ? t.copied : t.copy}
                  </button>
                </div>
              )}
            </div>

            {timeline.courier.trackingUrl && (
              <a
                href={timeline.courier.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ fontSize: 13, padding: "8px 14px", height: "auto" }}
                data-testid="courier-external-track"
              >
                {t.trackOnCourier} ↗
              </a>
            )}
          </div>
        </div>
      )}

      {/* Granular Checkpoints Accordion */}
      {timeline.checkpoints.length > 0 && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none",
              border: "none",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 0",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13.5,
              color: "var(--ink)",
            }}
            data-testid="toggle-checkpoints"
          >
            <span>{t.checkpoints} ({timeline.checkpoints.length})</span>
            <span style={{ fontSize: 16, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}>
              ▾
            </span>
          </button>

          {expanded && (
            <div style={{ marginTop: 14, paddingLeft: 10, borderLeft: "2px solid var(--line)", display: "flex", flexDirection: "column", gap: 14 }}>
              {timeline.checkpoints.map((cp) => (
                <div key={cp.id} style={{ position: "relative" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: -15,
                      top: 4,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: cp.source === "COURIER" ? "var(--accent)" : "var(--field)",
                    }}
                  />
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {lang === "bn" ? cp.titleBn : cp.title}
                  </div>
                  {cp.note && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {cp.note}
                    </div>
                  )}
                  <div className="faint" style={{ fontSize: 11.5, marginTop: 3 }}>
                    {fmtTime(cp.time)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
