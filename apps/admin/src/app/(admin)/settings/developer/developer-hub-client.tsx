"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  API_SCOPES,
  API_SCOPE_PRESETS,
  type ApiKeyEnvironment,
  type ApiKeyScope,
} from "@biztrackbd/core/api-key-scopes";
import { CopyButton } from "@/components/copy-button";
import { SubmitButton } from "@/components/ui";
import {
  createApiKeyAction,
  revokeApiKeyAction,
  deleteApiKeyAction,
  type CreateKeyActionState,
} from "./actions";

interface SerializedApiKey {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  environment: ApiKeyEnvironment;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

interface SerializedRequestLog {
  id: string;
  tenantId: string;
  apiKeyId: string | null;
  keyPrefix: string | null;
  endpoint: string;
  method: string;
  statusCode: number;
  ipAddress: string | null;
  durationMs: number;
  createdAt: string;
}

interface DeveloperHubClientProps {
  keys: SerializedApiKey[];
  logs: SerializedRequestLog[];
  canEdit: boolean;
  tenantSubdomain: string;
}

export function DeveloperHubClient({
  keys,
  logs,
  canEdit,
  tenantSubdomain,
}: DeveloperHubClientProps) {
  const [activeTab, setActiveTab] = useState<"keys" | "docs" | "logs">("keys");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<string[]>(
    API_SCOPE_PRESETS[0]?.scopes || []
  );
  const [keyEnvironment, setKeyEnvironment] = useState<ApiKeyEnvironment>("LIVE");

  // Selected key for live documentation preview
  const activeKeys = useMemo(() => keys.filter((k) => k.isActive), [keys]);
  const [selectedDocKey, setSelectedDocKey] = useState<string>(
    activeKeys[0]?.keyPrefix || "bzk_live_9f8a...ef12"
  );
  const [docLanguage, setDocLanguage] = useState<"curl" | "javascript" | "python">("curl");

  // Server action for key creation
  const [createState, formAction] = useActionState(createApiKeyAction, { ok: false });
  const [isPending, startTransition] = useTransition();

  // Handle preset selection
  const handleApplyPreset = (presetScopes: ApiKeyScope[]) => {
    setSelectedScopes([...presetScopes]);
  };

  const handleToggleScope = (scopeId: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scopeId) ? prev.filter((s) => s !== scopeId) : [...prev, scopeId]
    );
  };

  const handleRevoke = (id: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke API key "${name}"? This cannot be undone and external clients using it will lose access immediately.`)) {
      return;
    }
    startTransition(async () => {
      await revokeApiKeyAction(id);
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Permanently delete API key record "${name}"?`)) {
      return;
    }
    startTransition(async () => {
      await deleteApiKeyAction(id);
    });
  };

  const baseUrl = `https://${tenantSubdomain || "mystore"}.biztrack.bd`;

  return (
    <div style={{ marginTop: 20 }}>
      {/* 3-Tab Header Navigation */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 24 }}>
        <button
          type="button"
          className={`btn ${activeTab === "keys" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("keys")}
        >
          API Keys &amp; Credentials ({keys.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "docs" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("docs")}
        >
          Interactive Docs &amp; Code Explorer
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "logs" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("logs")}
        >
          Traffic Audit Logs ({logs.length})
        </button>
      </div>

      {/* ======================================================== */}
      {/* ONE-TIME REVEAL DIALOG (Displayed only right after creation) */}
      {/* ======================================================== */}
      {createState.ok && createState.result && (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 95, 70, 0.05))",
            border: "2px solid #10b981",
            borderRadius: 8,
            padding: 20,
            marginBottom: 24,
            boxShadow: "0 4px 12px rgba(16, 185, 129, 0.15)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 24 }}>🎉</span>
            <div>
              <h3 style={{ margin: 0, color: "#065f46" }}>
                API Key Created: <strong>{createState.result.name}</strong>
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#047857" }}>
                <strong>CRITICAL:</strong> Make sure to copy your secret key now. For security, it is stored as an irreversible SHA-256 hash and cannot be recovered or displayed again.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#0f172a",
              color: "#38bdf8",
              fontFamily: "monospace",
              fontSize: 14,
              padding: "12px 16px",
              borderRadius: 6,
              overflowX: "auto",
              marginBottom: 16,
            }}
          >
            <span style={{ flex: 1, wordBreak: "break-all" }}>{createState.result.token}</span>
            <CopyButton value={createState.result.token} label="API Secret Key" />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                createState.result = undefined;
                createState.ok = false;
              }}
            >
              Done / I Have Saved My Key
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: API KEYS TABLE & CREATION */}
      {/* ======================================================== */}
      {activeTab === "keys" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, margin: 0 }}>Active API Keys</h2>
              <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
                Keys authenticate external systems via <code>Authorization: Bearer bzk_live_...</code>
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                + Generate New Key
              </button>
            )}
          </div>

          {keys.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: "center" }}>
              <p className="muted" style={{ fontSize: 15, margin: "0 0 16px" }}>
                No API keys generated yet. Create one to begin integrating external ERPs, POS systems, or custom apps.
              </p>
              {canEdit && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create Your First Key
                </button>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "var(--bg-subtle)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "12px 16px" }}>Name</th>
                    <th style={{ padding: "12px 16px" }}>Key Prefix</th>
                    <th style={{ padding: "12px 16px" }}>Environment</th>
                    <th style={{ padding: "12px 16px" }}>Scopes</th>
                    <th style={{ padding: "12px 16px" }}>Last Used</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    {canEdit && <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>{k.name}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 13 }}>
                        <span style={{ marginRight: 8 }}>{k.keyPrefix}</span>
                        <CopyButton value={k.keyPrefix} label="Key Prefix" />
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.5px",
                            background: k.environment === "TEST" ? "#fef3c7" : "#d1fae5",
                            color: k.environment === "TEST" ? "#92400e" : "#065f46",
                          }}
                        >
                          {k.environment}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {k.scopes.map((s) => (
                            <span
                              key={s}
                              style={{
                                padding: "2px 6px",
                                background: "var(--bg-subtle)",
                                border: "1px solid var(--border)",
                                borderRadius: 4,
                                fontSize: 11,
                                fontFamily: "monospace",
                              }}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13 }} className="muted">
                        {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {k.isActive ? (
                          <span style={{ color: "#10b981", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                            Active
                          </span>
                        ) : (
                          <span style={{ color: "#ef4444", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                            Revoked
                          </span>
                        )}
                      </td>
                      {canEdit && (
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                            {k.isActive && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ color: "#dc2626" }}
                                onClick={() => handleRevoke(k.id, k.name)}
                                disabled={isPending}
                              >
                                Revoke
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleDelete(k.id, k.name)}
                              disabled={isPending}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CREATE KEY MODAL */}
          {showCreateModal && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: 16,
              }}
            >
              <div
                className="card"
                style={{
                  maxWidth: 680,
                  width: "100%",
                  maxHeight: "90vh",
                  overflowY: "auto",
                  padding: 24,
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 18 }}>Generate Scoped API Key</h3>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowCreateModal(false)}
                  >
                    ✕
                  </button>
                </div>

                <form
                  action={async (formData) => {
                    formData.delete("scopes");
                    selectedScopes.forEach((s) => formData.append("scopes", s));
                    formData.set("environment", keyEnvironment);
                    await formAction(formData);
                    setShowCreateModal(false);
                  }}
                >
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                      Key Label / Application Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="e.g. Tally ERP Sync, ManyChat Bot, Warehouse Scanner"
                      className="form-control"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                    />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                      Environment Mode
                    </label>
                    <div style={{ display: "flex", gap: 12 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="env_radio"
                          value="LIVE"
                          checked={keyEnvironment === "LIVE"}
                          onChange={() => setKeyEnvironment("LIVE")}
                        />
                        <span><strong>Production Live</strong> (<code>bzk_live_...</code>)</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="env_radio"
                          value="TEST"
                          checked={keyEnvironment === "TEST"}
                          onChange={() => setKeyEnvironment("TEST")}
                        />
                        <span><strong>Sandbox Test</strong> (<code>bzk_test_...</code> - non-destructive)</span>
                      </label>
                    </div>
                  </div>

                  {/* 1-Click Role Presets */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                      1-Click Role Presets
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {API_SCOPE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ textAlign: "left", padding: 8, height: "auto" }}
                          onClick={() => handleApplyPreset(preset.scopes)}
                        >
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{preset.label}</div>
                          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                            {preset.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Granular Checkboxes */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                      Granular Permission Scopes ({selectedScopes.length} selected)
                    </label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "var(--bg-subtle)", padding: 12, borderRadius: 6 }}>
                      {API_SCOPES.map((scope) => (
                        <label
                          key={scope.id}
                          style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedScopes.includes(scope.id)}
                            onChange={() => handleToggleScope(scope.id)}
                            style={{ marginTop: 3 }}
                          />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                              <code>{scope.id}</code> — {scope.label}
                            </div>
                            <div className="muted" style={{ fontSize: 12 }}>
                              {scope.description}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowCreateModal(false)}
                    >
                      Cancel
                    </button>
                    <SubmitButton pending="Generating Key…">Generate Key</SubmitButton>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: INTERACTIVE DOCUMENTATION & CODE SNIPPET EXPLORER */}
      {/* ======================================================== */}
      {activeTab === "docs" && (
        <div>
          {/* Active Key Selector & Language Switcher Bar */}
          <div
            className="card"
            style={{
              padding: 16,
              marginBottom: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              background: "var(--bg-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label htmlFor="key-select" style={{ fontSize: 13, fontWeight: 600 }}>
                Test with Key:
              </label>
              <select
                id="key-select"
                value={selectedDocKey}
                onChange={(e) => setSelectedDocKey(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13 }}
              >
                {activeKeys.length > 0 ? (
                  activeKeys.map((k) => (
                    <option key={k.id} value={k.keyPrefix}>
                      {k.name} ({k.keyPrefix}) - {k.environment}
                    </option>
                  ))
                ) : (
                  <option value="bzk_live_your_secret_token_here">Default Preview Key</option>
                )}
              </select>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              {(["curl", "javascript", "python"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  className={`btn btn-sm ${docLanguage === lang ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setDocLanguage(lang)}
                >
                  {lang === "curl" ? "cURL" : lang === "javascript" ? "JavaScript (Fetch)" : "Python"}
                </button>
              ))}
            </div>
          </div>

          {/* ENDPOINT 1: GET /api/v1/products */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#3b82f6", color: "#fff", fontWeight: 700, padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>
                  GET
                </span>
                <strong style={{ fontSize: 15 }}>/api/v1/products</strong>
              </div>
              <span style={{ fontSize: 12, fontFamily: "monospace", padding: "2px 6px", background: "var(--bg-subtle)", borderRadius: 4 }}>
                Scope: products:read
              </span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              List catalog products with pagination, category details, status filtering, and keyword search.
            </p>

            <CodeSnippetViewer
              language={docLanguage}
              endpoint={`${baseUrl}/api/v1/products?limit=10&page=1`}
              method="GET"
              keyPrefix={selectedDocKey}
            />
          </div>

          {/* ENDPOINT 2: GET /api/v1/products/:id */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#3b82f6", color: "#fff", fontWeight: 700, padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>
                  GET
                </span>
                <strong style={{ fontSize: 15 }}>/api/v1/products/:id</strong>
              </div>
              <span style={{ fontSize: 12, fontFamily: "monospace", padding: "2px 6px", background: "var(--bg-subtle)", borderRadius: 4 }}>
                Scope: products:read
              </span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              Retrieve full breakdown of a single product and all active SKU variants by product ID or URL slug.
            </p>

            <CodeSnippetViewer
              language={docLanguage}
              endpoint={`${baseUrl}/api/v1/products/cotton-panjabi-off-white`}
              method="GET"
              keyPrefix={selectedDocKey}
            />
          </div>

          {/* ENDPOINT 3: PATCH /api/v1/inventory/adjust */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#f59e0b", color: "#fff", fontWeight: 700, padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>
                  PATCH
                </span>
                <strong style={{ fontSize: 15 }}>/api/v1/inventory/adjust</strong>
              </div>
              <span style={{ fontSize: 12, fontFamily: "monospace", padding: "2px 6px", background: "var(--bg-subtle)", borderRadius: 4 }}>
                Scope: inventory:update
              </span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              Batch sync warehouse stock levels across variants by SKU or variantId. Supports <code>X-Idempotency-Key</code> for network replay safety.
            </p>

            <CodeSnippetViewer
              language={docLanguage}
              endpoint={`${baseUrl}/api/v1/inventory/adjust`}
              method="PATCH"
              keyPrefix={selectedDocKey}
              hasIdempotency
              body={{
                adjustments: [
                  { sku: "KP-OW-L", newQuantity: 25, reason: "Warehouse Intake" },
                  { sku: "KP-OW-XL", newQuantity: 18, reason: "Warehouse Intake" },
                ],
              }}
            />
          </div>

          {/* ENDPOINT 4: GET /api/v1/orders */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#3b82f6", color: "#fff", fontWeight: 700, padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>
                  GET
                </span>
                <strong style={{ fontSize: 15 }}>/api/v1/orders</strong>
              </div>
              <span style={{ fontSize: 12, fontFamily: "monospace", padding: "2px 6px", background: "var(--bg-subtle)", borderRadius: 4 }}>
                Scope: orders:read
              </span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              Query store orders with pagination, status filters (<code>status=PENDING</code>), payment status, and customer phone lookups.
            </p>

            <CodeSnippetViewer
              language={docLanguage}
              endpoint={`${baseUrl}/api/v1/orders?limit=10&page=1`}
              method="GET"
              keyPrefix={selectedDocKey}
            />
          </div>

          {/* ENDPOINT 5: POST /api/v1/orders */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#10b981", color: "#fff", fontWeight: 700, padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>
                  POST
                </span>
                <strong style={{ fontSize: 15 }}>/api/v1/orders</strong>
              </div>
              <span style={{ fontSize: 12, fontFamily: "monospace", padding: "2px 6px", background: "var(--bg-subtle)", borderRadius: 4 }}>
                Scope: orders:write
              </span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              Place an order with customer details, items, delivery zone calculation, and coupon discount. Accepts <code>X-Idempotency-Key</code>.
            </p>

            <CodeSnippetViewer
              language={docLanguage}
              endpoint={`${baseUrl}/api/v1/orders`}
              method="POST"
              keyPrefix={selectedDocKey}
              hasIdempotency
              body={{
                customer: {
                  name: "Tanvir Hossain",
                  phone: "01712345678",
                  address: "House 14, Road 7, Sector 3, Uttara",
                  district: "Dhaka",
                  division: "Dhaka",
                },
                items: [{ variantId: "cuid_var_example", quantity: 1 }],
                paymentMethod: "COD",
                couponCode: "SUMMER10",
                notes: "Please call before arriving",
              }}
            />
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: LIVE REQUEST TRAFFIC AUDIT LOGS */}
      {/* ======================================================== */}
      {activeTab === "logs" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, margin: 0 }}>Recent API Traffic Logs</h2>
              <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
                Inspecting last 50 requests across all active API keys. Bearer tokens are strictly masked in logs.
              </p>
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: "center" }}>
              <p className="muted" style={{ fontSize: 15, margin: 0 }}>
                No API requests recorded yet. Make a request via cURL or Postman to inspect traffic here.
              </p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--bg-subtle)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "10px 14px" }}>Timestamp</th>
                    <th style={{ padding: "10px 14px" }}>Method</th>
                    <th style={{ padding: "10px 14px" }}>Endpoint</th>
                    <th style={{ padding: "10px 14px" }}>Status</th>
                    <th style={{ padding: "10px 14px" }}>Latency</th>
                    <th style={{ padding: "10px 14px" }}>Key Prefix</th>
                    <th style={{ padding: "10px 14px" }}>Client IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
                    const isRateLimit = log.statusCode === 429;
                    const isAuthError = log.statusCode === 401 || log.statusCode === 403;

                    return (
                      <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px 14px" }}>
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontWeight: 700,
                              fontSize: 11,
                              background:
                                log.method === "GET" ? "#dbeafe" : log.method === "POST" ? "#d1fae5" : "#fef3c7",
                              color:
                                log.method === "GET" ? "#1d4ed8" : log.method === "POST" ? "#065f46" : "#92400e",
                            }}
                          >
                            {log.method}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", fontFamily: "monospace" }}>{log.endpoint}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontWeight: 700,
                              fontSize: 11,
                              background: isSuccess ? "#d1fae5" : isRateLimit ? "#f3e8ff" : isAuthError ? "#fee2e2" : "#fef3c7",
                              color: isSuccess ? "#065f46" : isRateLimit ? "#6b21a8" : isAuthError ? "#991b1b" : "#92400e",
                            }}
                          >
                            {log.statusCode}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px" }}>{log.durationMs}ms</td>
                        <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 12 }}>
                          {log.keyPrefix || "—"}
                        </td>
                        <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 12 }}>
                          {log.ipAddress || "127.0.0.1"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Interactive Code Snippet component rendering formatted cURL, JS, or Python code.
 */
function CodeSnippetViewer({
  language,
  endpoint,
  method,
  keyPrefix,
  hasIdempotency,
  body,
}: {
  language: "curl" | "javascript" | "python";
  endpoint: string;
  method: string;
  keyPrefix: string;
  hasIdempotency?: boolean;
  body?: Record<string, unknown>;
}) {
  const jsonBody = body ? JSON.stringify(body, null, 2) : "";

  let code = "";

  if (language === "curl") {
    code = `curl -X ${method} "${endpoint}" \\
  -H "Authorization: Bearer ${keyPrefix}" \\
  -H "Accept: application/json"${
    hasIdempotency
      ? ' \\\n  -H "X-Idempotency-Key: 7b8c9d0e-1f2a-3b4c-5d6e-7f8a9b0c1d2e"'
      : ""
  }${
      body
        ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(body)}'`
        : ""
    }`;
  } else if (language === "javascript") {
    code = `const response = await fetch("${endpoint}", {
  method: "${method}",
  headers: {
    "Authorization": "Bearer ${keyPrefix}",
    "Accept": "application/json",${
      hasIdempotency
        ? '\n    "X-Idempotency-Key": "7b8c9d0e-1f2a-3b4c-5d6e-7f8a9b0c1d2e",'
        : ""
    }${
      body
        ? '\n    "Content-Type": "application/json",'
        : ""
    }
  },${
    body
      ? `\n  body: JSON.stringify(${jsonBody})`
      : ""
  }
});

const data = await response.json();
console.log(data);`;
  } else if (language === "python") {
    code = `import requests

url = "${endpoint}"
headers = {
    "Authorization": "Bearer ${keyPrefix}",
    "Accept": "application/json",${
      hasIdempotency
        ? '\n    "X-Idempotency-Key": "7b8c9d0e-1f2a-3b4c-5d6e-7f8a9b0c1d2e",'
        : ""
    }
}
${body ? `payload = ${jsonBody}\n` : ""}
response = requests.${method.toLowerCase()}(url, headers=headers${body ? ", json=payload" : ""})
print(response.status_code, response.json())`;
  }

  return (
    <div style={{ position: "relative" }}>
      <pre
        style={{
          background: "#0f172a",
          color: "#f8fafc",
          padding: 16,
          borderRadius: 6,
          overflowX: "auto",
          fontSize: 13,
          fontFamily: "monospace",
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        <code>{code}</code>
      </pre>
      <div style={{ position: "absolute", top: 10, right: 10 }}>
        <CopyButton value={code} label="Code Snippet" />
      </div>
    </div>
  );
}
