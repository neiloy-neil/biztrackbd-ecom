"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { WebhookOverview, WebhookEventKey } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import {
  saveWebhookAction,
  rotateWebhookSecretAction,
  sendTestWebhookPingAction,
  type WebhookFormState,
} from "./actions";

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

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

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
          <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
            <span>Total: <b>{overview.stats.totalDeliveries}</b></span>
            <span style={{ color: "var(--success, #16a34a)" }}>Success: <b>{overview.stats.successfulDeliveries}</b></span>
            {overview.stats.failedDeliveries > 0 && (
              <span style={{ color: "var(--danger, #dc2626)" }}>Failed: <b>{overview.stats.failedDeliveries}</b></span>
            )}
          </div>
        </div>

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
