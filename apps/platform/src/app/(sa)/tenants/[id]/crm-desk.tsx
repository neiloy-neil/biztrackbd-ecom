"use client";

import { useState, useTransition } from "react";
import type { TenantLeadStage, TenantCrmActivityType } from "@biztrackbd/db";
import type { TenantCrmActivityRow } from "@biztrackbd/core";
import {
  recordCrmActivityAction,
  updateLeadStageAction,
  scheduleFollowUpAction,
} from "../crm-actions";
import { TenantOutreachActions, type OutreachTemplate } from "../outreach-actions";

export interface CrmDeskProps {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  customDomain?: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  leadStage: TenantLeadStage;
  leadLastContactedAt?: Date | string | null;
  leadNextFollowUpAt?: Date | string | null;
  crmActivities: TenantCrmActivityRow[];
  templates: OutreachTemplate[];
}

const STAGE_LABELS: Record<TenantLeadStage, string> = {
  NEW: "New Lead",
  CONTACTED: "Contacted",
  DEMO_IN_PROGRESS: "Demo / Discussing",
  HOT_LEAD: "Hot Lead 🔥",
  CONVERTED: "Converted 🎉",
  LOST: "Lost / Closed",
};

export function TenantCrmDesk({
  tenantId,
  tenantName,
  subdomain,
  customDomain,
  ownerName,
  ownerPhone,
  leadStage,
  leadLastContactedAt,
  leadNextFollowUpAt,
  crmActivities: initialActivities,
  templates,
}: CrmDeskProps) {
  const [activities, setActivities] = useState<TenantCrmActivityRow[]>(initialActivities);
  const [followUpDate, setFollowUpDate] = useState<string>(
    leadNextFollowUpAt ? new Date(leadNextFollowUpAt).toISOString().slice(0, 16) : ""
  );
  const [manualNote, setManualNote] = useState("");
  const [manualType, setManualType] = useState<TenantCrmActivityType>("PHONE_CALL");
  const [manualOutcome, setManualOutcome] = useState("ANSWERED");
  const [isPending, startTransition] = useTransition();

  const handleSaveFollowUp = () => {
    startTransition(async () => {
      await scheduleFollowUpAction(tenantId, followUpDate || null);
    });
  };

  const handleAddManualLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualNote.trim()) return;

    startTransition(async () => {
      const res = await recordCrmActivityAction(tenantId, {
        type: manualType,
        outcome: manualOutcome,
        notes: manualNote.trim(),
      });
      if (res.success && res.activity) {
        setActivities((prev) => [res.activity as TenantCrmActivityRow, ...prev]);
        setManualNote("");
      }
    });
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: "20px 24px",
      }}
      data-testid="crm-desk-card"
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
          paddingBottom: 14,
          borderBottom: "1px solid var(--chip)",
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
            <span>Merchant Outreach & CRM Desk</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 6,
                background: "var(--brand-light)",
                color: "var(--brand-hover)",
              }}
            >
              BD Sales Hub
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>
            Instant WhatsApp greetings, phone logs, and lead pipeline progression.
          </div>
        </div>

        {/* Quick Outreach Buttons */}
        <div>
          <TenantOutreachActions
            tenantId={tenantId}
            tenantName={tenantName}
            subdomain={subdomain}
            customDomain={customDomain}
            ownerName={ownerName}
            ownerPhone={ownerPhone}
            leadStage={leadStage}
            leadLastContactedAt={leadLastContactedAt}
            templates={templates}
          />
        </div>
      </div>

      {/* Follow-up Scheduler Row */}
      <div
        style={{
          background: "var(--bg)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>⏰</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)" }}>
              Next Follow-up Reminder:
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
              {leadNextFollowUpAt
                ? `Scheduled for: ${new Date(leadNextFollowUpAt).toLocaleString("en-GB")}`
                : "No follow-up scheduled yet"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="datetime-local"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            style={{
              padding: "5px 8px",
              borderRadius: 6,
              border: "1px solid var(--line-2)",
              fontSize: 12,
              color: "var(--ink-2)",
            }}
          />
          <button
            type="button"
            onClick={handleSaveFollowUp}
            disabled={isPending}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              background: "var(--brand)",
              color: "#fff",
              border: "none",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {isPending ? "Saving…" : "Set Follow-up"}
          </button>
          {followUpDate && (
            <button
              type="button"
              onClick={() => {
                setFollowUpDate("");
                startTransition(async () => {
                  await scheduleFollowUpAction(tenantId, null);
                });
              }}
              style={{
                padding: "5px 8px",
                borderRadius: 6,
                background: "transparent",
                color: "var(--ink-3)",
                border: "1px solid var(--line-2)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Activity Timeline */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
          Outreach & Communication History ({activities.length})
        </div>

        {activities.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              background: "var(--bg)",
              border: "1px dashed var(--line)",
              borderRadius: 8,
              fontSize: 13,
              color: "var(--ink-3)",
            }}
          >
            No outreach logged yet. Click the green WhatsApp button above to send a greeting or log a call.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto" }}>
            {activities.map((act) => {
              const isWa = act.type === "WHATSAPP";
              const isCall = act.type === "PHONE_CALL";
              const isStage = act.type === "STAGE_CHANGE";
              const isFollowUp = act.type === "FOLLOW_UP_SCHEDULED";

              const icon = isWa ? "💬" : isCall ? "📞" : isStage ? "🏷️" : isFollowUp ? "⏰" : "📝";
              const badgeBg = isWa ? "#F0FDF4" : isCall ? "#EFF6FF" : isStage ? "#FEF3C7" : "var(--bg)";
              const badgeBorder = isWa ? "#DCFCE7" : isCall ? "#DBEAFE" : isStage ? "#FDE68A" : "var(--line)";

              return (
                <div
                  key={act.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: badgeBg,
                    border: `1px solid ${badgeBorder}`,
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontWeight: 700, color: "#1E293B" }}>
                        {isWa ? "WhatsApp Message Sent" : isCall ? "Phone Call" : isStage ? "Pipeline Stage Updated" : isFollowUp ? "Follow-up Scheduled" : "CRM Note"}
                        {act.outcome && (
                          <span style={{ marginLeft: 6, fontWeight: 600, color: "var(--ink-2)", fontSize: 12 }}>
                            ({act.outcome})
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                        {new Date(act.createdAt).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {act.notes && (
                      <div style={{ color: "var(--ink-2)", marginTop: 4, lineHeight: 1.4 }}>
                        {act.notes}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>
                      By: {act.actorName || "Staff"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Log Entry Form */}
      <form
        onSubmit={handleAddManualLog}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)" }}>
          Log an Interaction or Call Note:
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
            value={manualType}
            onChange={(e) => setManualType(e.target.value as TenantCrmActivityType)}
            style={{
              padding: "5px 8px",
              borderRadius: 6,
              border: "1px solid var(--line-2)",
              fontSize: 12,
              background: "#fff",
            }}
          >
            <option value="PHONE_CALL">Phone Call</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="NOTE">General Note</option>
          </select>

          <select
            value={manualOutcome}
            onChange={(e) => setManualOutcome(e.target.value)}
            style={{
              padding: "5px 8px",
              borderRadius: 6,
              border: "1px solid var(--line-2)",
              fontSize: 12,
              background: "#fff",
            }}
          >
            <option value="ANSWERED">Answered & Discussed</option>
            <option value="BUSY">Busy / Asked for Callback</option>
            <option value="NO_ANSWER">No Answer</option>
            <option value="DEMO_GIVEN">Demo Given</option>
            <option value="PAYMENT_PROMISED">Payment Promised</option>
          </select>
        </div>

        <textarea
          value={manualNote}
          onChange={(e) => setManualNote(e.target.value)}
          required
          rows={2}
          placeholder="Details of the conversation, merchant requests, or next action items…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--line-2)",
            fontSize: 12.5,
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />

        <div style={{ alignSelf: "flex-end" }}>
          <button
            type="submit"
            disabled={isPending || !manualNote.trim()}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              background: "#1E293B",
              color: "#fff",
              border: "none",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {isPending ? "Logging…" : "Log Interaction"}
          </button>
        </div>
      </form>
    </div>
  );
}
