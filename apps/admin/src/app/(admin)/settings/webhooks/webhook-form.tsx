"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { WebhookOverview, WebhookEventKey } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import {
  saveWebhookAction,
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
  urlPlaceholder: string;
  recommendedEvents: string[];
  helperText: string;
  guideNote: string;
}

const AUTOMATION_PRESETS: AutomationPreset[] = [
  {
    id: "zapier",
    name: "Zapier Catch Hook",
    badge: "Zapier",
    badgeColor: "#ff4a00",
    urlPlaceholder: "https://hooks.zapier.com/hooks/catch/1234567/abcdef/",
    recommendedEvents: ["order.created", "order.delivered", "lead.created", "booking.created", "customer.registered"],
    helperText: "Trigger Zapier workflows automatically. Connects to Google Sheets, SMS, CRM, Slack, and 5,000+ apps.",
    guideNote: "Create a 'Webhooks by Zapier' trigger with 'Catch Hook', paste the generated webhook URL below, and send a test ping.",
  },
  {
    id: "make",
    name: "Make.com (Integromat)",
    badge: "Make",
    badgeColor: "#6d28d9",
    urlPlaceholder: "https://hook.eu1.make.com/abcdef1234567890",
    recommendedEvents: ["order.created", "order.delivered", "lead.created", "booking.created", "customer.registered"],
    helperText: "Execute complex multi-branch scenarios in Make.com with automated JSON parsing.",
    guideNote: "Add a 'Custom Webhook' module in Make, copy the address here, and trigger a Test Ping to auto-map data structures.",
  },
  {
    id: "discord",
    name: "Discord / Slack Channel",
    badge: "Chat Alert",
    badgeColor: "#5865f2",
    urlPlaceholder: "https://discord.com/api/webhooks/123456789/abcdefgh",
    recommendedEvents: ["order.created", "order.delivered", "lead.created"],
    helperText: "Stream sales alerts, parcel deliveries, and lead notifications straight into your team chat channel.",
    guideNote: "Create an Incoming Webhook in your Discord channel settings or Slack app integrations and paste the webhook URL.",
  },
  {
    id: "custom",
    name: "Custom Webhook Endpoint",
    badge: "API",
    badgeColor: "#64748b",
    urlPlaceholder: "https://your-domain.com/api/webhooks/biztrack",
    recommendedEvents: ["order.created", "order.delivered", "lead.created", "booking.created", "customer.registered"],
    helperText: "Send HMAC-SHA256 signed JSON payloads to your own backend server, Node.js, Python, or PHP service.",
    guideNote: "Verify signatures using the X-BizTrack-Signature header and your secret token.",
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

  const sub = overview.subscription;
  const [url, setUrl] = useState(sub?.targetUrl ?? "");
  const [isActive, setIsActive] = useState(sub?.isActive ?? true);
  const [selectedEvents, setSelectedEvents] = useState<string[]>(
    sub?.events ?? ["order.created", "order.delivered", "lead.created", "booking.created"]
  );

  const [secret, setSecret] = useState(sub?.secretToken ?? "");
  const [showSecret, setShowSecret] = useState(false);
  const [rotatePending, startRotate] = useTransition();
  const [rotateNotice, setRotateNotice] = useState<string | null>(null);

  const [pingPending, startPing] = useTransition();
  const [pingResult, setPingResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [retryPending, startRetry] = useTransition();
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  function applyPreset(preset: AutomationPreset) {
    setActivePreset(preset.id);
    setSelectedEvents(preset.recommendedEvents);
    if (!url || AUTOMATION_PRESETS.some((p) => url === p.urlPlaceholder)) {
      setUrl(preset.urlPlaceholder);
    }
  }

  function handleRetryFailed() {
    setRetryMessage(null);
    startRetry(async () => {
      const res = await retryFailedWebhookDeliveriesAction();
      if (res.ok) {
        setRetryMessage(res.message || "Failed delivery jobs re-queued.");
      } else {
        setRetryMessage(res.error || "Failed to retry delivery jobs.");
      }
    });
  }

  // Calculate consecutive failures for DLQ alert
  let consecutiveFailures = 0;
  for (const log of overview.recentLogs) {
    if (!log.isSuccess) consecutiveFailures++;
    else break;
  }
  const selectedPresetMeta = AUTOMATION_PRESETS.find((p) => p.id === activePreset);

  useEffect(() => {
    if (sub?.targetUrl) setUrl(sub.targetUrl);
    if (sub?.secretToken) setSecret(sub.secretToken);
    if (sub?.events) setSelectedEvents(sub.events);
    if (sub?.isActive !== undefined) setIsActive(sub.isActive);
  }, [sub]);

  function toggleEvent(key: string) {
    if (selectedEvents.includes(key)) {
      setSelectedEvents(selectedEvents.filter((k) => k !== key));
    } else {
      setSelectedEvents([...selectedEvents, key]);
    }
  }

  function handleRotate() {
    if (!confirm("Are you sure you want to rotate your webhook signing secret? Any services verifying old signatures will fail until updated.")) {
      return;
    }
    setRotateNotice(null);
    startRotate(async () => {
      const res = await rotateWebhookSecretAction();
      if (res.ok && res.secretToken) {
        setSecret(res.secretToken);
        setRotateNotice("Secret rotated successfully. Remember to update your verification endpoint.");
      } else {
        setRotateNotice(res.error || "Failed to rotate secret.");
      }
    });
  }

  function handleTestPing() {
    setPingResult(null);
    startPing(async () => {
      const res = await sendTestWebhookPingAction();
      setPingResult({
        ok: res.ok,
        message: res.message || (res.ok ? "Ping succeeded!" : "Ping failed."),
      });
    });
  }

  return (
    <div className="stack" style={{ gap: 24 }} data-testid="merchant-webhook-workspace">
      {/* Configuration Form */}
      <form action={formAction} className="stack" style={{ gap: 20 }}>
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

        {/* DLQ Failure Threshold Alert */}
        {consecutiveFailures >= 5 && (
          <div
            className="notice notice-danger"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}
            data-testid="dlq-consecutive-failure-alert"
          >
            <div>
              <strong>Webhook Delivery Alert:</strong> Your endpoint has failed {consecutiveFailures} consecutive deliveries. Your receiving service may be down, timing out, or returning 5xx server errors.
            </div>
            {canEdit && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleRetryFailed}
                disabled={retryPending}
                style={{ whiteSpace: "nowrap" }}
                data-testid="dlq-retry-btn"
              >
                {retryPending ? "Retrying..." : "Retry Failed Deliveries"}
              </button>
            )}
          </div>
        )}

        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, margin: 0 }}>Endpoint Destination</h2>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
                Target URL where real-time JSON event payloads will be sent via HTTP POST.
              </p>
            </div>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: canEdit ? "pointer" : "default", fontSize: 14 }}>
              <input
                type="checkbox"
                name="isActive"
                value="true"
                checked={isActive}
                disabled={!canEdit}
                onChange={(e) => setIsActive(e.target.checked)}
                data-testid="webhook-active-toggle"
              />
              <span style={{ fontWeight: 600 }}>{isActive ? "Active (Receiving Events)" : "Paused"}</span>
            </label>
          </div>

          {/* Quick Automation Presets Bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>
                Quick Automation Presets
              </label>
              <span className="muted" style={{ fontSize: 12 }}>
                Auto-configures recommended events & schema hints
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {AUTOMATION_PRESETS.map((p) => {
                const isSelected = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    disabled={!canEdit}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: canEdit ? "pointer" : "default",
                      border: isSelected ? "1.5px solid var(--accent, #0066cc)" : "1px solid var(--border, #cbd5e1)",
                      backgroundColor: isSelected ? "rgba(0, 102, 204, 0.08)" : "var(--card-bg, #ffffff)",
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
            {selectedPresetMeta && (
              <div
                style={{
                  marginTop: 10,
                  padding: "10px 14px",
                  borderRadius: 6,
                  backgroundColor: "var(--bg-muted, #f8fafc)",
                  border: "1px solid var(--border, #e2e8f0)",
                  fontSize: 12,
                  lineHeight: 1.45,
                }}
                data-testid="preset-helper-card"
              >
                <strong style={{ color: selectedPresetMeta.badgeColor }}>{selectedPresetMeta.badge}:</strong>{" "}
                {selectedPresetMeta.helperText}{" "}
                <span className="muted" style={{ display: "block", marginTop: 4 }}>
                  💡 {selectedPresetMeta.guideNote}
                </span>
              </div>
            )}
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label htmlFor="targetUrl" style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 6 }}>
              Webhook Target URL
            </label>
            <input
              id="targetUrl"
              name="targetUrl"
              type="url"
              className="input"
              placeholder="https://your-domain.com/api/webhooks/biztrack"
              value={url}
              disabled={!canEdit}
              onChange={(e) => setUrl(e.target.value)}
              required
              data-testid="webhook-target-url-input"
              style={{ width: "100%", fontFamily: "monospace", fontSize: 14 }}
            />
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Must start with <code>https://</code> (recommended) or <code>http://</code> for local staging.
            </p>
          </div>

          <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>Subscribed Events</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            Select the business events you want delivered to this endpoint.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
            {overview.availableEvents.map((evt) => {
              const checked = selectedEvents.includes(evt.key);
              return (
                <label
                  key={evt.key}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 14px",
                    border: checked ? "1px solid var(--accent, #0066cc)" : "1px solid var(--border, #e5e7eb)",
                    borderRadius: 8,
                    backgroundColor: checked ? "rgba(0, 102, 204, 0.04)" : "transparent",
                    cursor: canEdit ? "pointer" : "default",
                  }}
                  data-testid={`event-toggle-${evt.key}`}
                >
                  <input
                    type="checkbox"
                    name="events"
                    value={evt.key}
                    checked={checked}
                    disabled={!canEdit}
                    onChange={() => toggleEvent(evt.key)}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{evt.label}</span>
                      <code style={{ fontSize: 11, padding: "1px 4px", borderRadius: 4, background: "#f1f5f9" }}>
                        {evt.key}
                      </code>
                    </div>
                    <p className="muted" style={{ margin: "2px 0 0", fontSize: 12, lineHeight: 1.35 }}>
                      {evt.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          <input type="hidden" name="secretToken" value={secret} />

          {canEdit && (
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <SubmitButton
                className="btn btn-primary"
                pending="Saving configuration…"
                disabled={isSaving}
                data-testid="save-webhook-btn"
              >
                Save Webhook Settings
              </SubmitButton>
            </div>
          )}
        </section>
      </form>

      {/* Secret & Verification Card */}
      <section className="card">
        <h2 style={{ fontSize: 18, margin: "0 0 6px" }}>HMAC-SHA256 Signing Secret</h2>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 14px" }}>
          Outbound webhook requests include an <code>X-BizTrack-Signature: t=&lt;timestamp&gt;,v1=&lt;signature&gt;</code> header.
          Compute the HMAC-SHA256 of <code>&lt;timestamp&gt;.&lt;payload&gt;</code> using this secret to verify sender authenticity.
        </p>

        {rotateNotice && (
          <div className="notice notice-info" style={{ marginBottom: 12 }}>
            {rotateNotice}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div
            style={{
              flex: 1,
              minWidth: 260,
              padding: "8px 12px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              fontFamily: "monospace",
              fontSize: 13,
              letterSpacing: showSecret ? "normal" : "0.15em",
            }}
            data-testid="webhook-secret-display"
          >
            {secret ? (showSecret ? secret : "••••••••••••••••••••••••••••••••••••••••••••••••") : "(Will be generated upon save)"}
          </div>

          {secret && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowSecret(!showSecret)}
                data-testid="toggle-secret-visibility-btn"
              >
                {showSecret ? "Hide" : "Reveal"}
              </button>
              <CopyButton value={secret} label="Webhook Secret" />
            </>
          )}

          {canEdit && sub && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={rotatePending}
              onClick={handleRotate}
              data-testid="rotate-secret-btn"
              style={{ color: "var(--danger, #dc2626)" }}
            >
              {rotatePending ? "Rotating…" : "Rotate Secret"}
            </button>
          )}
        </div>
      </section>

      {/* Test Ping Dispatcher */}
      <section className="card" data-testid="test-ping-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, margin: 0 }}>Test Dispatch</h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
              Send a sample <code>ping</code> payload with a valid HMAC signature to verify your receiver endpoint.
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pingPending || !sub?.targetUrl}
              onClick={handleTestPing}
              data-testid="send-test-ping-btn"
            >
              {pingPending ? "Sending Test Ping…" : "Send Test Ping"}
            </button>
          )}
        </div>

        {!sub?.targetUrl && (
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Save your webhook URL above to enable test ping dispatch.
          </p>
        )}

        {pingResult && (
          <div
            className={`notice ${pingResult.ok ? "notice-success" : "notice-danger"}`}
            style={{ marginTop: 14 }}
            data-testid="test-ping-result-banner"
          >
            <b>{pingResult.ok ? "✓ Delivery Succeeded" : "✕ Delivery Failed"}</b>: {pingResult.message}
          </div>
        )}
      </section>

      {/* Delivery Logs & History */}
      <section className="card" data-testid="delivery-logs-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 18, margin: 0 }}>Recent Delivery Logs</h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
              Audit trail of recent outbound webhook attempts and response codes.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13 }}>
            <span>Total: <b>{overview.stats.totalDeliveries}</b></span>
            <span style={{ color: "var(--success, #16a34a)" }}>Success: <b>{overview.stats.successfulDeliveries}</b></span>
            {overview.stats.failedDeliveries > 0 && (
              <span style={{ color: "var(--danger, #dc2626)" }}>Failed: <b>{overview.stats.failedDeliveries}</b></span>
            )}
            {canEdit && overview.stats.failedDeliveries > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleRetryFailed}
                disabled={retryPending}
                style={{ marginLeft: 8 }}
                data-testid="retry-failed-deliveries-btn"
              >
                {retryPending ? "Retrying..." : "Retry Failed Deliveries"}
              </button>
            )}
          </div>
        </div>

        {retryMessage && (
          <div className="notice notice-info" style={{ marginBottom: 16 }} data-testid="retry-result-banner">
            {retryMessage}
          </div>
        )}

        {overview.recentLogs.length === 0 ? (
          <div className="empty" style={{ padding: "24px 0", textAlign: "center", color: "#64748b" }}>
            No webhook deliveries recorded yet. Send a test ping or wait for an order/lead event.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: 13 }} data-testid="delivery-logs-table">
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "8px 10px" }}>Status</th>
                  <th style={{ padding: "8px 10px" }}>Event</th>
                  <th style={{ padding: "8px 10px" }}>Timestamp</th>
                  <th style={{ padding: "8px 10px" }}>HTTP Code</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>Payload</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
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
                      <td style={{ padding: "8px 10px", color: "#64748b" }}>
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>
                        {log.responseStatus ? `HTTP ${log.responseStatus}` : "Timeout/Network"}
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
              maxHeight: 260,
              overflowY: "auto",
            }}
            data-testid="inspected-payload-box"
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#94a3b8" }}>
              <span>Log ID: {expandedLogId}</span>
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
