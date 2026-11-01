"use client";

import { useState, useTransition, useId } from "react";
import type { TenantLeadStage } from "@biztrackbd/db";
import { recordCrmActivityAction, updateLeadStageAction } from "./crm-actions";

export interface OutreachTemplate {
  key: string;
  title: string;
  body: string;
  language: string;
}

export interface OutreachActionsProps {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  customDomain?: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  leadStage: TenantLeadStage;
  leadLastContactedAt?: Date | string | null;
  templates: OutreachTemplate[];
}

const STAGE_CONFIG: Record<TenantLeadStage, { label: string; bg: string; color: string; border: string }> = {
  NEW: { label: "New Lead", bg: "#EEF2FF", color: "#4338CA", border: "#C7D2FE" },
  CONTACTED: { label: "Contacted", bg: "#FEF3C7", color: "#B45309", border: "#FDE68A" },
  DEMO_IN_PROGRESS: { label: "Demo / Discussing", bg: "#F3E8FF", color: "#6D28D9", border: "#E9D5FF" },
  HOT_LEAD: { label: "Hot Lead 🔥", bg: "#FFEDD5", color: "#C2410C", border: "#FED7AA" },
  CONVERTED: { label: "Converted 🎉", bg: "#D1FAE5", color: "#047857", border: "#A7F3D0" },
  LOST: { label: "Lost / Closed", bg: "#F3F4F6", color: "#4B5563", border: "#E5E7EB" },
};

function normalizePhone(raw: string): { clean: string; international: string } | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits || digits.length < 10) return null;
  if (digits.startsWith("880")) return { clean: digits, international: digits };
  if (digits.startsWith("0")) return { clean: digits, international: "88" + digits };
  return { clean: digits, international: "880" + digits };
}

function resolveTokens(template: string, vars: { ownerName: string; storeName: string; subdomain: string; storeUrl: string }) {
  return template
    .replace(/\{ownerName\}/g, vars.ownerName)
    .replace(/\{storeName\}/g, vars.storeName)
    .replace(/\{subdomain\}/g, vars.subdomain)
    .replace(/\{storeUrl\}/g, vars.storeUrl);
}

export function TenantOutreachActions({
  tenantId,
  tenantName,
  subdomain,
  customDomain,
  ownerName,
  ownerPhone,
  leadStage: initialStage,
  templates,
}: OutreachActionsProps) {
  const [currentStage, setCurrentStage] = useState<TenantLeadStage>(initialStage);
  const [isPending, startTransition] = useTransition();

  const [showWaModal, setShowWaModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showStageMenu, setShowStageMenu] = useState(false);

  const phoneInfo = ownerPhone ? normalizePhone(ownerPhone) : null;
  const storeUrl = customDomain ? `https://${customDomain}` : `https://${subdomain}.biztrack.bd`;
  const nameForTokens = ownerName?.trim() || "Owner";

  const defaultTmpl = templates.find((t) => t.key === "welcome_bn") || templates[0] || {
    key: "default",
    title: "Welcome Greeting",
    body: "Hello {ownerName}, welcome to BizTrack BD!",
    language: "en",
  };

  const [selectedKey, setSelectedKey] = useState(defaultTmpl.key);
  const [customText, setCustomText] = useState(
    resolveTokens(defaultTmpl.body, { ownerName: nameForTokens, storeName: tenantName, subdomain, storeUrl })
  );

  const handleSelectTemplate = (tmpl: OutreachTemplate) => {
    setSelectedKey(tmpl.key);
    setCustomText(resolveTokens(tmpl.body, { ownerName: nameForTokens, storeName: tenantName, subdomain, storeUrl }));
  };

  const handleLaunchWhatsApp = () => {
    if (!phoneInfo) return;
    const waUrl = `https://wa.me/${phoneInfo.international}?text=${encodeURIComponent(customText)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");

    startTransition(async () => {
      await recordCrmActivityAction(tenantId, {
        type: "WHATSAPP",
        templateKey: selectedKey,
        notes: `Sent ${templates.find((t) => t.key === selectedKey)?.title ?? "greeting"} via WhatsApp`,
        autoAdvanceStage: true,
      });
      if (currentStage === "NEW") {
        setCurrentStage("CONTACTED");
      }
    });

    setShowWaModal(false);
  };

  const handleCallClick = () => {
    if (!phoneInfo) return;
    window.location.href = `tel:+${phoneInfo.international}`;
    setShowCallModal(true);
  };

  const handleRecordCallOutcome = (outcome: string) => {
    startTransition(async () => {
      await recordCrmActivityAction(tenantId, {
        type: "PHONE_CALL",
        outcome,
        notes: `Call outcome: ${outcome}`,
        autoAdvanceStage: currentStage === "NEW",
      });
      if (currentStage === "NEW") {
        setCurrentStage("CONTACTED");
      }
    });
    setShowCallModal(false);
  };

  const handleStageSelect = (stage: TenantLeadStage) => {
    if (stage === currentStage) {
      setShowStageMenu(false);
      return;
    }
    setCurrentStage(stage);
    setShowStageMenu(false);

    startTransition(async () => {
      await updateLeadStageAction(tenantId, stage);
    });
  };

  const stageStyle = STAGE_CONFIG[currentStage] ?? STAGE_CONFIG.NEW;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, position: "relative" }}>
      {/* WhatsApp Button */}
      {phoneInfo ? (
        <button
          type="button"
          onClick={() => setShowWaModal(true)}
          title={`Message ${ownerName || "Merchant"} on WhatsApp (${phoneInfo.clean})`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "#25D366",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            flexShrink: 0,
            transition: "transform 0.1s, opacity 0.1s",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.697c.983.54 1.766.82 2.806.82 3.182 0 5.768-2.587 5.768-5.766.001-3.187-2.575-5.77-5.768-5.772zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.075-1.921-.453-1.579-.646-2.616-2.222-2.696-2.329-.079-.107-.639-.851-.639-1.624 0-.773.405-1.154.549-1.309.144-.155.313-.193.418-.193.104 0 .208.002.299.006.096.004.224-.036.35.267.129.312.44 1.074.479 1.153.039.079.065.171.013.275-.052.104-.078.169-.156.26-.079.091-.165.203-.235.273-.078.078-.16.162-.069.318.092.156.408.673.874 1.089.6.535 1.106.701 1.262.779.156.078.247.065.338-.039.092-.104.391-.455.495-.611.104-.156.208-.13.351-.078.144.052.911.43 1.067.508.156.078.26.117.299.182.039.065.039.377-.105.782zM12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.662 1.435 5.178L2.05 22l4.978-1.305A9.946 9.946 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
          </svg>
        </button>
      ) : (
        <span
          title="No phone number recorded"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "#F3F4F6",
            color: "#9CA3AF",
            flexShrink: 0,
            cursor: "not-allowed",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.662 1.435 5.178L2.05 22l4.978-1.305A9.946 9.946 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
          </svg>
        </span>
      )}

      {/* Phone Call Button */}
      {phoneInfo ? (
        <button
          type="button"
          onClick={handleCallClick}
          title={`Call ${ownerName || "Merchant"} (+${phoneInfo.international})`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "#EFF6FF",
            border: "1px solid #BFDBFE",
            color: "#2563EB",
            cursor: "pointer",
            flexShrink: 0,
            transition: "transform 0.1s",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </button>
      ) : (
        <span
          title="No phone number recorded"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "#F3F4F6",
            border: "1px solid #E5E7EB",
            color: "#9CA3AF",
            flexShrink: 0,
            cursor: "not-allowed",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </span>
      )}

      {/* 1-Click Lead Stage Dropdown Badge */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setShowStageMenu((prev) => !prev)}
          disabled={isPending}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 8px",
            borderRadius: 6,
            background: stageStyle.bg,
            color: stageStyle.color,
            border: `1px solid ${stageStyle.border}`,
            fontSize: 11.5,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <span>{stageStyle.label}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {showStageMenu && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: 4,
              zIndex: 50,
              background: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
              padding: "4px",
              minWidth: 150,
            }}
          >
            {(Object.keys(STAGE_CONFIG) as TenantLeadStage[]).map((stg) => {
              const cfg = STAGE_CONFIG[stg];
              const isSelected = stg === currentStage;
              return (
                <button
                  key={stg}
                  type="button"
                  onClick={() => handleStageSelect(stg)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 5,
                    border: "none",
                    background: isSelected ? cfg.bg : "transparent",
                    color: isSelected ? cfg.color : "#374151",
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "#F9FAFB";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span>{cfg.label}</span>
                  {isSelected && <span>✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* WhatsApp Outreach Popover Modal */}
      {showWaModal && phoneInfo && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowWaModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              width: 520,
              maxWidth: "100%",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
              border: "1px solid #E2E8F0",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #F1F5F9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#F8FAFC",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: "#25D366",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.697c.983.54 1.766.82 2.806.82 3.182 0 5.768-2.587 5.768-5.766.001-3.187-2.575-5.77-5.768-5.772zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.075-1.921-.453-1.579-.646-2.616-2.222-2.696-2.329-.079-.107-.639-.851-.639-1.624 0-.773.405-1.154.549-1.309.144-.155.313-.193.418-.193.104 0 .208.002.299.006.096.004.224-.036.35.267.129.312.44 1.074.479 1.153.039.079.065.171.013.275-.052.104-.078.169-.156.26-.079.091-.165.203-.235.273-.078.078-.16.162-.069.318.092.156.408.673.874 1.089.6.535 1.106.701 1.262.779.156.078.247.065.338-.039.092-.104.391-.455.495-.611.104-.156.208-.13.351-.078.144.052.911.43 1.067.508.156.078.26.117.299.182.039.065.039.377-.105.782zM12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.662 1.435 5.178L2.05 22l4.978-1.305A9.946 9.946 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                  </svg>
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                    WhatsApp {tenantName}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748B" }}>
                    To: {ownerName || "Merchant"} ({phoneInfo.clean})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWaModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 18,
                  color: "#64748B",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Template Selector Pills */}
            <div style={{ padding: "12px 18px", borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#64748B", marginBottom: 8 }}>
                SELECT OUTREACH TEMPLATE:
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {templates.map((tmpl) => {
                  const isSelected = tmpl.key === selectedKey;
                  return (
                    <button
                      key={tmpl.key}
                      type="button"
                      onClick={() => handleSelectTemplate(tmpl)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: isSelected ? "1.5px solid #25D366" : "1px solid #E2E8F0",
                        background: isSelected ? "#F0FDF4" : "#fff",
                        color: isSelected ? "#15803D" : "#334155",
                        fontSize: 12,
                        fontWeight: isSelected ? 700 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {tmpl.title}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message Preview Textarea */}
            <div style={{ padding: "14px 18px" }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#64748B", marginBottom: 6 }}>
                MESSAGE PREVIEW (EDITABLE):
              </div>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                rows={5}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  borderRadius: 8,
                  border: "1px solid #CBD5E1",
                  padding: "10px 12px",
                  fontSize: 13,
                  lineHeight: 1.5,
                  fontFamily: "inherit",
                  resize: "vertical",
                  color: "#1E293B",
                }}
              />
            </div>

            {/* Actions */}
            <div
              style={{
                padding: "12px 18px",
                background: "#F8FAFC",
                borderTop: "1px solid #F1F5F9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ fontSize: 11.5, color: "#64748B" }}>
                Auto-advances to <strong>Contacted</strong>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowWaModal(false)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 6,
                    border: "1px solid #CBD5E1",
                    background: "#fff",
                    color: "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLaunchWhatsApp}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 16px",
                    borderRadius: 6,
                    border: "none",
                    background: "#25D366",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.697c.983.54 1.766.82 2.806.82 3.182 0 5.768-2.587 5.768-5.766.001-3.187-2.575-5.77-5.768-5.772zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.075-1.921-.453-1.579-.646-2.616-2.222-2.696-2.329-.079-.107-.639-.851-.639-1.624 0-.773.405-1.154.549-1.309.144-.155.313-.193.418-.193.104 0 .208.002.299.006.096.004.224-.036.35.267.129.312.44 1.074.479 1.153.039.079.065.171.013.275-.052.104-.078.169-.156.26-.079.091-.165.203-.235.273-.078.078-.16.162-.069.318.092.156.408.673.874 1.089.6.535 1.106.701 1.262.779.156.078.247.065.338-.039.092-.104.391-.455.495-.611.104-.156.208-.13.351-.078.144.052.911.43 1.067.508.156.078.26.117.299.182.039.065.039.377-.105.782zM12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.662 1.435 5.178L2.05 22l4.978-1.305A9.946 9.946 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                  </svg>
                  <span>Open in WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phone Call Outcome Logger Modal */}
      {showCallModal && phoneInfo && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowCallModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              width: 420,
              maxWidth: "100%",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
              border: "1px solid #E2E8F0",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #F1F5F9",
                background: "#F8FAFC",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
                  Call Logged: {tenantName}
                </div>
                <div style={{ fontSize: 11.5, color: "#64748B" }}>
                  Dialed: +{phoneInfo.international} ({ownerName || "Merchant"})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCallModal(false)}
                style={{ background: "transparent", border: "none", fontSize: 18, color: "#64748B", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "16px 18px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
                HOW DID THE CALL GO?
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { outcome: "ANSWERED_INTERESTED", label: "📞 Answered & Interested", desc: "Engaged in conversation, demo/setup discussed" },
                  { outcome: "BUSY_CALLBACK", label: "⏳ Busy / Callback Requested", desc: "Customer asked to call back later" },
                  { outcome: "NO_ANSWER", label: "📵 No Answer / Switched Off", desc: "Ringing but didn't pick up" },
                  { outcome: "NOT_INTERESTED", label: "❌ Not Interested / Wrong Number", desc: "Decided not to proceed" },
                ].map((item) => (
                  <button
                    key={item.outcome}
                    type="button"
                    onClick={() => handleRecordCallOutcome(item.outcome)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #E2E8F0",
                      background: "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.1s, border-color 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#F8FAFC";
                      e.currentTarget.style.borderColor = "#94A3B8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#fff";
                      e.currentTarget.style.borderColor = "#E2E8F0";
                    }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>{item.label}</span>
                    <span style={{ fontSize: 11, color: "#64748B" }}>{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: "10px 18px", background: "#F8FAFC", borderTop: "1px solid #F1F5F9", textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setShowCallModal(false)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "1px solid #CBD5E1",
                  background: "#fff",
                  color: "#475569",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Skip Logging
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
