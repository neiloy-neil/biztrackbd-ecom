"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import type {
  WebhookOverview,
  WebhookSubscriptionView,
  WebhookEventKey,
  WebhookAdapterType,
} from "@biztrackbd/core";
import {
  detectWebhookAdapter,
  getSampleEventData,
} from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import {
  saveWebhookAction,
  deleteWebhookEndpointAction,
  toggleWebhookEndpointAction,
  rotateWebhookSecretAction,
  sendTestWebhookPingAction,
  retryFailedWebhookDeliveriesAction,
  type WebhookFormState,
} from "./actions";

interface AutomationPreset {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  adapter: WebhookAdapterType;
  urlPlaceholder: string;
  recommendedEvents: string[];
  helperText: string;
  guideNote: string;
}

const AUTOMATION_PRESETS: AutomationPreset[] = [
  {
    id: "discord",
    name: "Discord Webhook",
    badge: "Discord",
    badgeColor: "#5865F2",
    adapter: "discord",
    urlPlaceholder: "https://discord.com/api/webhooks/123456789/abcdefgh",
    recommendedEvents: ["order.created", "order.delivered", "lead.created", "booking.created"],
    helperText: "Stream rich color-coded status embeds with Bangladesh ৳ pricing and direct admin links into your Discord channel.",
    guideNote: "Discord: Channel Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL.",
  },
  {
    id: "slack",
    name: "Slack Channel",
    badge: "Slack",
    badgeColor: "#4A154B",
    adapter: "slack",
    urlPlaceholder: "https://hooks.slack.com/services/T00/B00/X00",
    recommendedEvents: ["order.created", "order.delivered", "lead.created", "booking.created"],
    helperText: "Dispatch Slack Block Kit notifications with 2-column fields, formatted items list, and one-click order lookup.",
    guideNote: "Slack: App Directory → Incoming WebHooks → Add to Slack → Select Channel → Copy Webhook URL.",
  },
  {
    id: "telegram",
    name: "Telegram Bot Alert",
    badge: "Telegram",
    badgeColor: "#229ED9",
    adapter: "telegram",
    urlPlaceholder: "https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>",
    recommendedEvents: ["order.created", "order.delivered", "lead.created", "booking.created"],
    helperText: "Instant push alerts to your Telegram group or private channel with clean Markdown formatting.",
    guideNote: "Create bot via @BotFather, add bot to group/channel, get your chat_id via @userinfobot and append ?chat_id=<ID>.",
  },
  {
    id: "zapier",
    name: "Zapier Pipeline",
    badge: "Zapier",
    badgeColor: "#FF4A00",
    adapter: "generic",
    urlPlaceholder: "https://hooks.zapier.com/hooks/catch/1234567/abcdef/",
    recommendedEvents: ["order.created", "order.delivered", "lead.created", "booking.created", "customer.registered"],
    helperText: "Trigger Zapier workflows automatically. Sync checkouts to Google Sheets, CRM, email campaigns, and 5,000+ apps.",
    guideNote: "Create a 'Webhooks by Zapier' trigger with 'Catch Hook', paste the generated webhook URL, and send a test ping.",
  },
  {
    id: "make",
    name: "Make.com (Integromat)",
    badge: "Make",
    badgeColor: "#6D28D9",
    adapter: "generic",
    urlPlaceholder: "https://hook.eu1.make.com/abcdef1234567890",
    recommendedEvents: ["order.created", "order.delivered", "lead.created", "booking.created", "customer.registered"],
    helperText: "Execute complex multi-branch automation scenarios in Make.com with automated JSON parsing.",
    guideNote: "Add a 'Custom Webhook' module in Make, copy the address here, and trigger a Test Ping to auto-map data.",
  },
  {
    id: "custom",
    name: "Custom API Endpoint",
    badge: "API",
    badgeColor: "#64748B",
    adapter: "generic",
    urlPlaceholder: "https://your-domain.com/api/webhooks/biztrack",
    recommendedEvents: ["order.created", "order.delivered", "lead.created", "booking.created", "customer.registered"],
    helperText: "Send HMAC-SHA256 signed JSON payloads to your own backend server, Node.js, Python, or Go microservice.",
    guideNote: "Verify authenticity using the X-BizTrack-Signature header and your webhook signing secret.",
  },
];

export function WebhookForm({
  overview,
  canEdit,
}: {
  overview: WebhookOverview;
  canEdit: boolean;
}) {
  const [formState, formAction, isSaving] = useActionState<WebhookFormState, FormData>(
    saveWebhookAction,
    {}
  );

  // Endpoint Modal & Edit State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<WebhookSubscriptionView | null>(null);

  // Modal Form Inputs
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [adapterOverride, setAdapterOverride] = useState<WebhookAdapterType | "auto">("auto");
  const [isActive, setIsActive] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    "order.created",
    "order.delivered",
    "lead.created",
    "booking.created",
  ]);
  const [secret, setSecret] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Live Message Preview State
  const [previewEvent, setPreviewEvent] = useState<WebhookEventKey | "ping">("order.created");

  // Global Actions State
  const [rotatePending, startRotate] = useTransition();
  const [rotateNotice, setRotateNotice] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});

  const [pingPending, startPing] = useTransition();
  const [pingResult, setPingResult] = useState<{
    ok: boolean;
    message: string;
    endpointId?: string;
  } | null>(null);

  const [togglePending, startToggle] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [retryPending, startRetry] = useTransition();
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Calculate DLQ consecutive failures
  const consecutiveFailures = useMemo(() => {
    let count = 0;
    for (const log of overview.recentLogs) {
      if (!log.isSuccess) count++;
      else break;
    }
    return count;
  }, [overview.recentLogs]);

  // Detected or overridden adapter
  const effectiveAdapter: WebhookAdapterType = useMemo(() => {
    if (adapterOverride !== "auto") return adapterOverride;
    return detectWebhookAdapter(url);
  }, [adapterOverride, url]);

  // Open modal for editing or creating
  function openAddModal(preset?: AutomationPreset) {
    setEditingSub(null);
    setName(preset?.name || "");
    setUrl(preset?.urlPlaceholder || "");
    setAdapterOverride(preset?.adapter || "auto");
    setIsActive(true);
    setSelectedEvents(
      preset?.recommendedEvents || ["order.created", "order.delivered", "lead.created", "booking.created"]
    );
    setSecret("");
    setActivePreset(preset?.id || null);
    setIsModalOpen(true);
  }

  function openEditModal(sub: WebhookSubscriptionView) {
    setEditingSub(sub);
    setName(sub.name || "");
    setUrl(sub.targetUrl.split("#")[0]!);
    setAdapterOverride(sub.adapter || "auto");
    setIsActive(sub.isActive);
    setSelectedEvents(sub.events);
    setSecret(sub.secretToken);
    setActivePreset(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingSub(null);
  }

  function applyPreset(preset: AutomationPreset) {
    setActivePreset(preset.id);
    setAdapterOverride(preset.adapter);
    setSelectedEvents(preset.recommendedEvents);
    if (!name || AUTOMATION_PRESETS.some((p) => name === p.name)) {
      setName(preset.name);
    }
    if (!url || AUTOMATION_PRESETS.some((p) => url === p.urlPlaceholder)) {
      setUrl(preset.urlPlaceholder);
    }
  }

  function toggleEvent(key: string) {
    if (selectedEvents.includes(key)) {
      setSelectedEvents(selectedEvents.filter((k) => k !== key));
    } else {
      setSelectedEvents([...selectedEvents, key]);
    }
  }

  function selectAllEvents() {
    setSelectedEvents(overview.availableEvents.map((e) => e.key));
  }

  function deselectAllEvents() {
    setSelectedEvents([]);
  }

  function handleQuickToggle(subId: string, currentActive: boolean) {
    startToggle(async () => {
      await toggleWebhookEndpointAction(subId, !currentActive);
    });
  }

  function handleDeleteEndpoint(subId: string, endpointName?: string) {
    if (
      !confirm(
        `Are you sure you want to delete the endpoint "${endpointName || "Webhook"}"? All delivery history will be removed.`
      )
    ) {
      return;
    }
    startDelete(async () => {
      await deleteWebhookEndpointAction(subId);
    });
  }

  function handleRotate(subId?: string) {
    if (
      !confirm(
        "Are you sure you want to rotate this webhook signing secret? Any services verifying old signatures will fail until updated."
      )
    ) {
      return;
    }
    setRotateNotice(null);
    startRotate(async () => {
      const res = await rotateWebhookSecretAction(subId);
      if (res.ok && res.secretToken) {
        if (editingSub && editingSub.id === subId) {
          setSecret(res.secretToken);
        }
        setRotateNotice("Secret rotated successfully. Remember to update your verification endpoint.");
      } else {
        setRotateNotice(res.error || "Failed to rotate secret.");
      }
    });
  }

  function handleTestPing(subscriptionId?: string, event: WebhookEventKey | "ping" = "ping") {
    setPingResult(null);
    startPing(async () => {
      const res = await sendTestWebhookPingAction({ subscriptionId, event });
      setPingResult({
        ok: res.ok,
        message: res.message || (res.ok ? "Ping succeeded!" : "Ping failed."),
        endpointId: subscriptionId,
      });
    });
  }

  function handleRetryFailed(subscriptionId?: string) {
    setRetryMessage(null);
    startRetry(async () => {
      const res = await retryFailedWebhookDeliveriesAction(subscriptionId);
      if (res.ok) {
        setRetryMessage(res.message || "Failed delivery jobs re-queued.");
      } else {
        setRetryMessage(res.error || "Failed to retry delivery jobs.");
      }
    });
  }

  // Close modal when form succeeds
  useEffect(() => {
    if (formState.ok) {
      closeModal();
    }
  }, [formState]);

  // Sample data for live preview
  const sampleData = useMemo(() => getSampleEventData(previewEvent), [previewEvent]);

  // Primary active subscription (fallback for single endpoint cards)
  const subscriptions = overview.subscriptions || (overview.subscription ? [overview.subscription] : []);

  return (
    <div className="stack" style={{ gap: 24 }} data-testid="merchant-webhook-workspace">
      {/* Top Banner Notifications */}
      {formState.message && (
        <div className="notice notice-success" data-testid="save-success-banner">
          {formState.message}
        </div>
      )}
      {formState.error && (
        <div className="notice notice-danger" data-testid="save-error-banner">
          {formState.error}
        </div>
      )}

      {/* DLQ Consecutive Failure Alert */}
      {consecutiveFailures >= 5 && (
        <div
          className="notice notice-danger"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            boxShadow: "0 4px 12px rgba(220, 38, 38, 0.15)",
          }}
          data-testid="dlq-consecutive-failure-alert"
        >
          <div>
            <strong>⚠️ Webhook Delivery Alert:</strong> Endpoints have encountered {consecutiveFailures}{" "}
            consecutive delivery failures. Your external chat webhook or HTTP receiver may be down, timing
            out, or rejecting payloads.
          </div>
          {canEdit && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleRetryFailed()}
              disabled={retryPending}
              style={{ whiteSpace: "nowrap" }}
              data-testid="dlq-retry-btn"
            >
              {retryPending ? "Retrying..." : "Batch Re-queue Jobs"}
            </button>
          )}
        </div>
      )}

      {/* Header Bar with Add Button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, margin: 0, fontWeight: 700 }}>Configured Alert Endpoints</h2>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Manage chat platforms (Discord, Slack, Telegram) and automated webhooks (Zapier, Make, Custom API).
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openAddModal()}
            data-testid="add-endpoint-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span>+ Add Webhook Endpoint</span>
          </button>
        )}
      </div>

      {/* Endpoints Grid */}
      {subscriptions.length === 0 ? (
        <section
          className="card"
          style={{
            padding: "36px 24px",
            textAlign: "center",
            background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
            border: "2px dashed #cbd5e1",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>🚀</div>
          <h3 style={{ fontSize: 18, margin: "0 0 8px", fontWeight: 600 }}>No Endpoints Configured Yet</h3>
          <p className="muted" style={{ maxWidth: 540, margin: "0 auto 24px", fontSize: 14 }}>
            Connect Discord channels, Telegram groups, Slack rooms, or Zapier to receive instant order,
            delivery, lead, and booking notifications.
          </p>
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10 }}>
            {AUTOMATION_PRESETS.slice(0, 3).map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="btn btn-secondary"
                onClick={() => openAddModal(preset)}
                data-testid={`preset-btn-${preset.id}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: preset.badgeColor,
                  }}
                />
                <span>Add {preset.name}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gap: 16,
          }}
        >
          {subscriptions.map((subItem) => {
            const adapter = subItem.adapter || detectWebhookAdapter(subItem.targetUrl);
            const isRevealed = revealedSecrets[subItem.id] || false;
            const cleanUrl = subItem.targetUrl.split("#")[0]!;

            // Platform branding color
            const platformColor =
              adapter === "discord"
                ? "#5865F2"
                : adapter === "slack"
                ? "#4A154B"
                : adapter === "telegram"
                ? "#229ED9"
                : cleanUrl.includes("zapier.com")
                ? "#FF4A00"
                : cleanUrl.includes("make.com")
                ? "#6D28D9"
                : "#64748B";

            const platformLabel =
              adapter === "discord"
                ? "Discord Embed"
                : adapter === "slack"
                ? "Slack Block Kit"
                : adapter === "telegram"
                ? "Telegram Bot"
                : cleanUrl.includes("zapier.com")
                ? "Zapier Catch Hook"
                : cleanUrl.includes("make.com")
                ? "Make.com"
                : "Generic JSON";

            return (
              <div
                key={subItem.id}
                className="card"
                data-testid={`endpoint-card-${subItem.id}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  borderLeft: `4px solid ${platformColor}`,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                  opacity: subItem.isActive ? 1 : 0.7,
                }}
              >
                <div>
                  {/* Card Header: Platform Tag + Name + Active Switch */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.03em",
                            backgroundColor: `${platformColor}15`,
                            color: platformColor,
                            border: `1px solid ${platformColor}30`,
                            textTransform: "uppercase",
                          }}
                        >
                          {platformLabel}
                        </span>
                        {!subItem.isActive && (
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              background: "#fee2e2",
                              color: "#991b1b",
                            }}
                          >
                            PAUSED
                          </span>
                        )}
                      </div>
                      <h3 style={{ fontSize: 16, margin: 0, fontWeight: 700 }}>
                        {subItem.name || (adapter === "discord" ? "Discord Channel" : adapter === "slack" ? "Slack Alert" : adapter === "telegram" ? "Telegram Alert" : "Webhook Endpoint")}
                      </h3>
                    </div>

                    {/* Active toggle */}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleQuickToggle(subItem.id, subItem.isActive)}
                        disabled={togglePending}
                        data-testid={`toggle-active-btn-${subItem.id}`}
                        style={{
                          background: subItem.isActive ? "#dcfce7" : "#f1f5f9",
                          color: subItem.isActive ? "#166534" : "#64748b",
                          border: `1px solid ${subItem.isActive ? "#bbf7d0" : "#cbd5e1"}`,
                          borderRadius: 16,
                          padding: "3px 10px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {subItem.isActive ? "Active" : "Pause"}
                      </button>
                    )}
                  </div>

                  {/* Target URL with Copy Button */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#f8fafc",
                      padding: "6px 10px",
                      borderRadius: 6,
                      marginBottom: 12,
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "#334155",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={cleanUrl}
                    >
                      {cleanUrl}
                    </span>
                    <CopyButton value={cleanUrl} label="URL" />
                  </div>

                  {/* Subscribed Events Badges */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>
                      SUBSCRIBED EVENTS ({subItem.events.length})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {subItem.events.map((evtKey) => (
                        <span
                          key={evtKey}
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "#f1f5f9",
                            color: "#334155",
                            fontFamily: "monospace",
                          }}
                        >
                          {evtKey}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Signing Secret */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      fontSize: 12,
                      padding: "6px 8px",
                      background: "#fafafa",
                      borderRadius: 6,
                      border: "1px solid #f1f5f9",
                      marginBottom: 14,
                    }}
                  >
                    <span style={{ color: "#64748b" }}>Secret:</span>
                    <span
                      style={{
                        fontFamily: "monospace",
                        letterSpacing: isRevealed ? "normal" : "0.1em",
                        color: "#475569",
                      }}
                    >
                      {isRevealed ? subItem.secretToken : "••••••••••••••••"}
                    </span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedSecrets({
                            ...revealedSecrets,
                            [subItem.id]: !isRevealed,
                          })
                        }
                        style={{
                          background: "transparent",
                          border: 0,
                          cursor: "pointer",
                          fontSize: 11,
                          color: "#0284c7",
                        }}
                      >
                        {isRevealed ? "Hide" : "Show"}
                      </button>
                      <CopyButton value={subItem.secretToken} label="Secret" />
                    </div>
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderTop: "1px solid #f1f5f9",
                    paddingTop: 12,
                    marginTop: 6,
                  }}
                >
                  {/* Event test ping selector */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <select
                      id={`ping-event-${subItem.id}`}
                      defaultValue="ping"
                      style={{
                        fontSize: 12,
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                      }}
                      data-testid={`test-ping-event-select-${subItem.id}`}
                    >
                      <option value="ping">Ping Event</option>
                      <option value="order.created">Order Created</option>
                      <option value="order.delivered">Order Delivered</option>
                      <option value="lead.created">Lead Captured</option>
                      <option value="booking.created">Booking Created</option>
                    </select>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={pingPending}
                      onClick={() => {
                        const sel = document.getElementById(
                          `ping-event-${subItem.id}`
                        ) as HTMLSelectElement | null;
                        const evt = (sel?.value || "ping") as WebhookEventKey | "ping";
                        handleTestPing(subItem.id, evt);
                      }}
                      data-testid={`send-test-ping-btn-${subItem.id}`}
                    >
                      {pingPending ? "Testing..." : "Test"}
                    </button>
                  </div>

                  {/* Edit / Delete Buttons */}
                  {canEdit && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(subItem)}
                        data-testid={`edit-endpoint-btn-${subItem.id}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDeleteEndpoint(subItem.id, subItem.name)}
                        disabled={deletePending}
                        data-testid={`delete-endpoint-btn-${subItem.id}`}
                        style={{ color: "var(--danger, #dc2626)" }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Global Ping Result Banner */}
      {pingResult && (
        <div
          className={`notice ${pingResult.ok ? "notice-success" : "notice-danger"}`}
          data-testid="test-ping-result-banner"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div>
            <b>{pingResult.ok ? "✓ Test Ping Succeeded" : "✕ Test Ping Failed"}</b>: {pingResult.message}
          </div>
          <button
            type="button"
            onClick={() => setPingResult(null)}
            style={{ background: "transparent", border: 0, cursor: "pointer", color: "inherit" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Global Secret Rotation Notice */}
      {rotateNotice && (
        <div className="notice notice-info" style={{ marginBottom: 12 }}>
          {rotateNotice}
        </div>
      )}

      {/* Add / Edit Endpoint Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 820,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.25)",
              borderRadius: 12,
              padding: 24,
              backgroundColor: "#ffffff",
            }}
            data-testid="endpoint-modal"
          >
            {/* Modal Title Bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: 14,
              }}
            >
              <div>
                <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>
                  {editingSub ? "Edit Webhook Endpoint" : "Add Webhook Endpoint"}
                </h2>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                  Configure notification destination and customize native chat alerts.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  background: "transparent",
                  border: 0,
                  fontSize: 20,
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                ✕
              </button>
            </div>

            {/* Presets Selector (when creating new) */}
            {!editingSub && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 8 }}>
                  Quick Platform Presets
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {AUTOMATION_PRESETS.map((p) => {
                    const isSelected = activePreset === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyPreset(p)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 12px",
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "pointer",
                          border: isSelected
                            ? "1.5px solid var(--accent, #0066cc)"
                            : "1px solid var(--border, #cbd5e1)",
                          backgroundColor: isSelected ? "rgba(0, 102, 204, 0.08)" : "#ffffff",
                          color: isSelected ? "var(--accent, #0066cc)" : "inherit",
                        }}
                        data-testid={`preset-btn-${p.id}`}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            backgroundColor: p.badgeColor,
                          }}
                        />
                        <span>{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <form action={formAction} className="stack" style={{ gap: 16 }}>
              {editingSub?.id && <input type="hidden" name="id" value={editingSub.id} />}
              <input type="hidden" name="secretToken" value={secret} />

              {/* Endpoint Name & Adapter Type */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field">
                  <label htmlFor="endpointName" style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 4 }}>
                    Endpoint Name
                  </label>
                  <input
                    id="endpointName"
                    name="name"
                    type="text"
                    className="input"
                    placeholder="e.g. Discord #sales or Telegram Warehouse"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="endpoint-name-input"
                    style={{ width: "100%", fontSize: 13 }}
                  />
                </div>

                <div className="field">
                  <label htmlFor="adapterSelect" style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 4 }}>
                    Chat Alert Format
                  </label>
                  <select
                    id="adapterSelect"
                    name="adapter"
                    className="input"
                    value={adapterOverride}
                    onChange={(e) => setAdapterOverride(e.target.value as WebhookAdapterType | "auto")}
                    data-testid="adapter-select"
                    style={{ width: "100%", fontSize: 13 }}
                  >
                    <option value="auto">Auto-Detect from URL (Recommended)</option>
                    <option value="discord">Discord (Rich Embeds & Color Strips)</option>
                    <option value="slack">Slack (Block Kit Headers & Fields)</option>
                    <option value="telegram">Telegram (Formatted Markdown Push)</option>
                    <option value="generic">Generic JSON (Zapier / Make / API)</option>
                  </select>
                </div>
              </div>

              {/* Target URL */}
              <div className="field">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label htmlFor="targetUrl" style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>
                    Target Webhook URL
                  </label>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    Detected Adapter: <strong style={{ color: "#0f172a" }}>{effectiveAdapter.toUpperCase()}</strong>
                  </span>
                </div>
                <input
                  id="targetUrl"
                  name="targetUrl"
                  type="url"
                  className="input"
                  placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  data-testid="webhook-target-url-input"
                  style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
                />
                {effectiveAdapter === "telegram" && (
                  <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    💡 Telegram Format: <code>https://api.telegram.org/bot&lt;TOKEN&gt;/sendMessage?chat_id=&lt;CHAT_ID&gt;</code>
                  </p>
                )}
              </div>

              {/* Subscribed Events Selection */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>
                    Subscribed Events ({selectedEvents.length}/{overview.availableEvents.length})
                  </label>
                  <div style={{ fontSize: 12 }}>
                    <button
                      type="button"
                      onClick={selectAllEvents}
                      style={{ background: "transparent", border: 0, color: "#0284c7", cursor: "pointer", marginRight: 8 }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllEvents}
                      style={{ background: "transparent", border: 0, color: "#64748b", cursor: "pointer" }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                  {overview.availableEvents.map((evt) => {
                    const checked = selectedEvents.includes(evt.key);
                    return (
                      <label
                        key={evt.key}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          padding: "8px 10px",
                          border: checked ? "1px solid var(--accent, #0066cc)" : "1px solid #e2e8f0",
                          borderRadius: 6,
                          backgroundColor: checked ? "rgba(0, 102, 204, 0.04)" : "#ffffff",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                        data-testid={`event-toggle-${evt.key}`}
                      >
                        <input
                          type="checkbox"
                          name="events"
                          value={evt.key}
                          checked={checked}
                          onChange={() => toggleEvent(evt.key)}
                          style={{ marginTop: 2 }}
                        />
                        <div>
                          <div style={{ fontWeight: 600 }}>{evt.label}</div>
                          <code style={{ fontSize: 10, color: "#64748b" }}>{evt.key}</code>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Active Toggle Switch */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  value="true"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  data-testid="webhook-active-toggle"
                />
                <label htmlFor="isActive" style={{ fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  Active (Immediately deliver matching events to this endpoint)
                </label>
              </div>

              {/* LIVE INTERACTIVE MESSAGE PREVIEW CARD */}
              <div
                style={{
                  marginTop: 10,
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  overflow: "hidden",
                  backgroundColor: "#f8fafc",
                }}
                data-testid="live-chat-preview"
              >
                {/* Preview Header & Event Switcher */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 14px",
                    background: "#0f172a",
                    color: "#ffffff",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600 }}>
                    <span>👁️ Live Chat Alert Preview</span>
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: 10,
                        fontSize: 10,
                        background: "rgba(255,255,255,0.2)",
                        textTransform: "uppercase",
                      }}
                    >
                      {effectiveAdapter}
                    </span>
                  </div>

                  {/* Event sample switcher */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span style={{ color: "#94a3b8" }}>Event:</span>
                    <select
                      value={previewEvent}
                      onChange={(e) => setPreviewEvent(e.target.value as WebhookEventKey | "ping")}
                      style={{
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "#1e293b",
                        color: "#f8fafc",
                        border: "1px solid #334155",
                      }}
                      data-testid="preview-event-select"
                    >
                      <option value="order.created">Order Created</option>
                      <option value="order.delivered">Parcel Delivered</option>
                      <option value="lead.created">Lead Captured</option>
                      <option value="booking.created">Booking Scheduled</option>
                      <option value="customer.registered">Customer Registered</option>
                      <option value="ping">Ping Test</option>
                    </select>
                  </div>
                </div>

                {/* Rendered Preview Screen */}
                <div style={{ padding: 14 }}>
                  {/* DISCORD PREVIEW */}
                  {effectiveAdapter === "discord" && (
                    <div
                      style={{
                        backgroundColor: "#313338",
                        borderRadius: 8,
                        padding: 14,
                        color: "#dbdee1",
                        fontFamily: "system-ui, -apple-system, sans-serif",
                        fontSize: 13,
                        lineHeight: 1.4,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: "#5865F2",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          BT
                        </div>
                        <span style={{ fontWeight: 600, color: "#f2f3f5" }}>BizTrack Alerts</span>
                        <span
                          style={{
                            backgroundColor: "#5865F2",
                            color: "#fff",
                            borderRadius: 4,
                            padding: "0 4px",
                            fontSize: 9,
                            fontWeight: 700,
                          }}
                        >
                          APP
                        </span>
                        <span style={{ fontSize: 11, color: "#949ba4" }}>Today at 20:30</span>
                      </div>

                      <div style={{ color: "#f2f3f5", fontWeight: 600, marginBottom: 6 }}>
                        {previewEvent === "order.created"
                          ? `🛍️ New Order Placed: #${String(sampleData.orderNumber || "BT-10482")}`
                          : previewEvent === "order.delivered"
                          ? `🚚 Parcel Delivered: #${String(sampleData.orderNumber || "BT-10482")}`
                          : previewEvent === "lead.created"
                          ? `📩 New Lead Captured: ${String(sampleData.leadType || "Inquiry")}`
                          : previewEvent === "booking.created"
                          ? `📅 New Appointment Booked: ${String(sampleData.serviceTitle || "Consultation")}`
                          : `🔔 BizTrack Webhook Connection Test`}
                      </div>

                      {/* Discord Embed Box */}
                      <div
                        style={{
                          backgroundColor: "#2b2d31",
                          borderLeft: `4px solid ${
                            previewEvent === "order.created"
                              ? "#2ecc71"
                              : previewEvent === "order.delivered"
                              ? "#3498db"
                              : previewEvent === "lead.created"
                              ? "#9b59b6"
                              : previewEvent === "booking.created"
                              ? "#f39c12"
                              : "#5865f2"
                          }`,
                          borderRadius: 4,
                          padding: 12,
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "#00a8fc", marginBottom: 8 }}>
                          {previewEvent === "order.created"
                            ? `Order #${String(sampleData.orderNumber || "BT-10482")} — ৳${Number(sampleData.total || 2500).toLocaleString("en-BD")}`
                            : previewEvent === "order.delivered"
                            ? `Delivery Confirmed — ${String(sampleData.courier || "Steadfast")}`
                            : previewEvent === "lead.created"
                            ? `Inquiry from ${String(sampleData.name || "Sadia Islam")}`
                            : previewEvent === "booking.created"
                            ? `${String(sampleData.serviceTitle || "Consultation")} — ${String(sampleData.patientName || "Client")}`
                            : "Test Ping Succeeded! 🚀"}
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                            fontSize: 12,
                            marginBottom: 8,
                          }}
                        >
                          <div>
                            <div style={{ color: "#949ba4", fontSize: 11, fontWeight: 600 }}>CUSTOMER / CLIENT</div>
                            <div style={{ color: "#f2f3f5" }}>
                              {String(sampleData.customerName || sampleData.name || sampleData.patientName || "Customer")}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: "#949ba4", fontSize: 11, fontWeight: 600 }}>PHONE NUMBER</div>
                            <div style={{ color: "#00a8fc", fontFamily: "monospace" }}>
                              {String(sampleData.phone || "01712345678")}
                            </div>
                          </div>
                        </div>

                        <div style={{ fontSize: 11, color: "#949ba4", borderTop: "1px solid #35373c", paddingTop: 6 }}>
                          BizTrack Outbound Webhook • Today at 20:30
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SLACK PREVIEW */}
                  {effectiveAdapter === "slack" && (
                    <div
                      style={{
                        backgroundColor: "#ffffff",
                        borderRadius: 8,
                        padding: 14,
                        border: "1px solid #e2e8f0",
                        fontSize: 13,
                        lineHeight: 1.45,
                        color: "#1d1c1d",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 4,
                            background: "#4A154B",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: 11,
                          }}
                        >
                          BT
                        </div>
                        <span style={{ fontWeight: 800 }}>BizTrack BD</span>
                        <span
                          style={{
                            background: "#e8e8e8",
                            padding: "1px 4px",
                            borderRadius: 3,
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        >
                          APP
                        </span>
                        <span style={{ fontSize: 11, color: "#616061" }}>20:30</span>
                      </div>

                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
                        {previewEvent === "order.created"
                          ? `🛍️ New Order #${String(sampleData.orderNumber || "BT-10482")} Placed!`
                          : previewEvent === "order.delivered"
                          ? `🚚 Parcel Delivered: #${String(sampleData.orderNumber || "BT-10482")}`
                          : previewEvent === "lead.created"
                          ? `📩 New Lead Captured: ${String(sampleData.leadType || "Inquiry")}`
                          : previewEvent === "booking.created"
                          ? `📅 New Booking Scheduled: ${String(sampleData.serviceTitle || "Consultation")}`
                          : `🔔 BizTrack Webhook Connection Test`}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                          background: "#f8fafc",
                          padding: "10px 12px",
                          borderRadius: 6,
                          marginBottom: 8,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 11 }}>Customer:</div>
                          <div>{String(sampleData.customerName || sampleData.name || "Customer")}</div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 11 }}>Total / Method:</div>
                          <div>৳{Number(sampleData.total || 2500).toLocaleString("en-BD")} (COD)</div>
                        </div>
                      </div>

                      <div style={{ fontSize: 11, color: "#616061" }}>
                        ⚡ <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "#1264a3" }}>Open Order in BizTrack Admin</a> • Just now
                      </div>
                    </div>
                  )}

                  {/* TELEGRAM PREVIEW */}
                  {effectiveAdapter === "telegram" && (
                    <div
                      style={{
                        backgroundColor: "#8c9ca9",
                        backgroundImage: "radial-gradient(#9cb0c0 1px, transparent 1px)",
                        backgroundSize: "16px 16px",
                        borderRadius: 8,
                        padding: 14,
                        display: "flex",
                        justifyContent: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          backgroundColor: "#ffffff",
                          borderRadius: "12px 12px 12px 2px",
                          padding: "10px 14px",
                          maxWidth: "85%",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                          fontSize: 13,
                          lineHeight: 1.4,
                          color: "#111827",
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "#0284c7", marginBottom: 4 }}>
                          {previewEvent === "order.created"
                            ? `🛍️ New Order #${String(sampleData.orderNumber || "BT-10482")} Placed!`
                            : previewEvent === "order.delivered"
                            ? `🚚 Parcel Delivered: #${String(sampleData.orderNumber || "BT-10482")}`
                            : previewEvent === "lead.created"
                            ? `📩 New Lead Captured: ${String(sampleData.leadType || "Inquiry")}`
                            : previewEvent === "booking.created"
                            ? `📅 New Booking: ${String(sampleData.serviceTitle || "Consultation")}`
                            : `🔔 BizTrack Webhook Connection Test`}
                        </div>

                        <div style={{ margin: "6px 0", fontSize: 12 }}>
                          <div><b>Total:</b> ৳{Number(sampleData.total || 2500).toLocaleString("en-BD")} (COD)</div>
                          <div><b>Customer:</b> {String(sampleData.customerName || sampleData.name || "Customer")} (Dhaka)</div>
                          <div><b>Phone:</b> <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>{String(sampleData.phone || "01712345678")}</code></div>
                        </div>

                        <div style={{ marginTop: 8, fontSize: 12 }}>
                          <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "#0284c7", textDecoration: "none", fontWeight: 600 }}>
                            👉 Open Order in Admin
                          </a>
                        </div>

                        <div style={{ textAlign: "right", fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
                          20:30 ✓✓
                        </div>
                      </div>
                    </div>
                  )}

                  {/* GENERIC JSON PREVIEW */}
                  {effectiveAdapter === "generic" && (
                    <pre
                      style={{
                        margin: 0,
                        padding: 12,
                        background: "#0f172a",
                        color: "#38bdf8",
                        borderRadius: 6,
                        fontFamily: "monospace",
                        fontSize: 12,
                        maxHeight: 180,
                        overflowY: "auto",
                      }}
                    >
                      {JSON.stringify(
                        {
                          event: previewEvent,
                          id: `evt_sample_${Date.now()}`,
                          timestamp: Date.now(),
                          tenantId: "tenant_current",
                          data: sampleData,
                        },
                        null,
                        2
                      )}
                    </pre>
                  )}
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <SubmitButton
                  className="btn btn-primary"
                  pending="Saving endpoint…"
                  disabled={isSaving}
                  data-testid="save-webhook-btn"
                >
                  {editingSub ? "Save Changes" : "Create Endpoint"}
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELIVERY AUDIT LOGS & PAYLOAD INSPECTOR */}
      <section className="card" data-testid="delivery-logs-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div>
            <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Recent Delivery Logs</h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
              Audit trail of recent outbound webhook attempts, response codes, and payload payloads.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13 }}>
            <span>
              Total: <b>{overview.stats.totalDeliveries}</b>
            </span>
            <span style={{ color: "var(--success, #16a34a)" }}>
              Success: <b>{overview.stats.successfulDeliveries}</b>
            </span>
            {overview.stats.failedDeliveries > 0 && (
              <span style={{ color: "var(--danger, #dc2626)" }}>
                Failed: <b>{overview.stats.failedDeliveries}</b>
              </span>
            )}
            {canEdit && overview.stats.failedDeliveries > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleRetryFailed()}
                disabled={retryPending}
                style={{ marginLeft: 6 }}
                data-testid="retry-failed-deliveries-btn"
              >
                {retryPending ? "Retrying..." : "Retry Failed"}
              </button>
            )}
          </div>
        </div>

        {retryMessage && (
          <div className="notice notice-info" style={{ marginBottom: 14 }} data-testid="retry-result-banner">
            {retryMessage}
          </div>
        )}

        {overview.recentLogs.length === 0 ? (
          <div className="empty" style={{ padding: "28px 0", textAlign: "center", color: "#64748b" }}>
            No webhook deliveries recorded yet. Send a test ping or trigger an order/lead event.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: 13 }} data-testid="delivery-logs-table">
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "8px 10px" }}>Status</th>
                  <th style={{ padding: "8px 10px" }}>Event</th>
                  <th style={{ padding: "8px 10px" }}>Endpoint</th>
                  <th style={{ padding: "8px 10px" }}>Time</th>
                  <th style={{ padding: "8px 10px" }}>Response</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>Payload</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const logSub = subscriptions.find((s) => s.id === log.subscriptionId);
                  const cleanLogUrl = log.targetUrl.split("#")[0]!;

                  return (
                    <tr key={log.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 10px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: log.isSuccess ? "#dcfce7" : "#fee2e2",
                            color: log.isSuccess ? "#166534" : "#991b1b",
                          }}
                        >
                          {log.isSuccess ? "DELIVERED" : "FAILED"}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <code style={{ fontSize: 12, background: "#f8fafc", padding: "2px 6px", borderRadius: 4 }}>
                          {log.eventType}
                        </code>
                      </td>
                      <td style={{ padding: "8px 10px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span title={cleanLogUrl}>
                          {logSub?.name || cleanLogUrl.replace(/^https?:\/\//, "").slice(0, 24)}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", color: "#64748b" }}>
                        {new Date(log.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 12 }}>
                        {log.responseStatus ? `HTTP ${log.responseStatus}` : "Timeout/Err"}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          data-testid={`toggle-payload-${log.id}`}
                        >
                          {isExpanded ? "Close" : "Inspect"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Payload Inspector Drawer */}
        {expandedLogId && (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              background: "#0f172a",
              color: "#f8fafc",
              borderRadius: 8,
              fontFamily: "monospace",
              fontSize: 12,
              maxHeight: 280,
              overflowY: "auto",
            }}
            data-testid="inspected-payload-box"
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
                color: "#94a3b8",
              }}
            >
              <span>Payload Detail (Log: {expandedLogId})</span>
              <button
                type="button"
                onClick={() => setExpandedLogId(null)}
                style={{ background: "transparent", border: 0, color: "#94a3b8", cursor: "pointer" }}
              >
                ✕ Close
              </button>
            </div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {JSON.stringify(
                overview.recentLogs.find((l) => l.id === expandedLogId)?.payload ?? {},
                null,
                2
              )}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}
