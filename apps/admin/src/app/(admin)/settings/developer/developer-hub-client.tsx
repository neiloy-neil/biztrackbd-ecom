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
    <div className="mt-3">
      {/* 3-Tab Header Navigation */}
      <div className="tab-strip mb-4">
        <button
          type="button"
          className={`tab-btn ${activeTab === "keys" ? "active" : ""}`}
          onClick={() => setActiveTab("keys")}
        >
          API Keys &amp; Credentials ({keys.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "docs" ? "active" : ""}`}
          onClick={() => setActiveTab("docs")}
        >
          Interactive Docs &amp; Code Explorer
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "logs" ? "active" : ""}`}
          onClick={() => setActiveTab("logs")}
        >
          Traffic Audit Logs ({logs.length})
        </button>
      </div>

      {/* ======================================================== */}
      {/* ONE-TIME REVEAL DIALOG (Displayed only right after creation) */}
      {/* ======================================================== */}
      {createState.ok && createState.result && (
        <div className="key-reveal-box">
          <div className="row gap-3 mb-3 items-center">
            <div className="icon-box-lg">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 2l-2 2m-1.5 1.5L16 7m-1.5 1.5L13 10m-1.5 1.5L10 13m-2-2l-4 4a2 2 0 0 0 0 2.83l1.17 1.17a2 2 0 0 0 2.83 0l4-4m-2-2l3-3m0 0a4 4 0 1 0-5.66-5.66l5.66 5.66z"/>
              </svg>
            </div>
            <div>
              <h3 className="m-0 text-success">
                API Key Created: <strong>{createState.result.name}</strong>
              </h3>
              <p className="m-0 text-sm muted mt-1">
                <strong>CRITICAL:</strong> Make sure to copy your secret key now. For security, it is stored as an irreversible SHA-256 hash and cannot be recovered or displayed again.
              </p>
            </div>
          </div>

          <div className="row-between gap-2 code-block mb-3 items-center">
            <span className="flex-1 break-all text-sky-400 font-mono text-sm">{createState.result.token}</span>
            <CopyButton value={createState.result.token} label="API Secret Key" />
          </div>

          <div className="row-end">
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
          <div className="row-between items-center mb-3">
            <div>
              <h2 className="text-lg m-0 font-bold">Active API Keys</h2>
              <p className="muted text-sm mt-1">
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
            <div className="card text-center py-5">
              <p className="muted text-base mb-3">
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
            <div className="card p-0 overflow-hidden">
              <div className="table-wrap">
                <table className="table m-0">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Key Prefix</th>
                      <th>Environment</th>
                      <th>Scopes</th>
                      <th>Last Used</th>
                      <th>Status</th>
                      {canEdit && <th className="text-end">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((k) => (
                      <tr key={k.id}>
                        <td className="font-semibold">{k.name}</td>
                        <td className="font-mono text-xs">
                          <span className="me-2">{k.keyPrefix}</span>
                          <CopyButton value={k.keyPrefix} label="Key Prefix" />
                        </td>
                        <td>
                          <span className={k.environment === "TEST" ? "badge-amber" : "badge-green"}>
                            {k.environment}
                          </span>
                        </td>
                        <td>
                          <div className="row gap-1 flex-wrap">
                            {k.scopes.map((s) => (
                              <span key={s} className="pill grey font-mono text-xs">
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="text-xs muted">
                          {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}
                        </td>
                        <td>
                          {k.isActive ? (
                            <span className="badge-green">
                              <span className="status-dot-active" />
                              Active
                            </span>
                          ) : (
                            <span className="badge-red">
                              <span className="status-dot-error" />
                              Revoked
                            </span>
                          )}
                        </td>
                        {canEdit && (
                          <td className="text-end">
                            <div className="row-end gap-1">
                              {k.isActive && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm text-danger"
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
            </div>
          )}

          {/* CREATE KEY MODAL */}
          {showCreateModal && (
            <div className="modal-backdrop">
              <div className="modal-card modal-card-lg">
                <div className="modal-head">
                  <h2 className="m-0">Generate Scoped API Key</h2>
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
                  className="stack gap-3"
                >
                  <label className="field">
                    <span className="label">Key Label / Application Name</span>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="e.g. Tally ERP Sync, ManyChat Bot, Warehouse Scanner"
                      className="input"
                    />
                  </label>

                  <div>
                    <span className="label mb-2 block">Environment Mode</span>
                    <div className="row gap-4">
                      <label className="radio">
                        <input
                          type="radio"
                          name="env_radio"
                          value="LIVE"
                          checked={keyEnvironment === "LIVE"}
                          onChange={() => setKeyEnvironment("LIVE")}
                        />
                        <span><strong>Production Live</strong> (<code>bzk_live_...</code>)</span>
                      </label>
                      <label className="radio">
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
                  <div>
                    <span className="label mb-2 block">1-Click Role Presets</span>
                    <div className="grid-280">
                      {API_SCOPE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className="btn btn-secondary btn-sm text-start p-2 h-auto block"
                          onClick={() => handleApplyPreset(preset.scopes)}
                        >
                          <div className="font-semibold text-sm">{preset.label}</div>
                          <div className="muted text-xs mt-1">
                            {preset.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Granular Checkboxes */}
                  <div>
                    <span className="label mb-2 block">Granular Permission Scopes ({selectedScopes.length} selected)</span>
                    <div className="stack gap-2 card bg-subtle p-3 max-h-60 overflow-y-auto">
                      {API_SCOPES.map((scope) => (
                        <label
                          key={scope.id}
                          className="check items-start"
                        >
                          <input
                            type="checkbox"
                            checked={selectedScopes.includes(scope.id)}
                            onChange={() => handleToggleScope(scope.id)}
                          />
                          <div>
                            <div className="font-semibold text-sm">
                              <code>{scope.id}</code> — {scope.label}
                            </div>
                            <div className="muted text-xs">
                              {scope.description}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="row-end gap-2 mt-2">
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
        <div className="stack gap-4">
          {/* Active Key Selector & Language Switcher Bar */}
          <div className="card bg-subtle p-3 row-between items-center flex-wrap gap-3">
            <div className="row gap-2 items-center">
              <label htmlFor="key-select" className="text-sm font-semibold">
                Test with Key:
              </label>
              <select
                id="key-select"
                value={selectedDocKey}
                onChange={(e) => setSelectedDocKey(e.target.value)}
                className="input py-1 px-2 text-sm w-auto"
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

            <div className="pill-switcher">
              {(["curl", "javascript", "python"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  className={`pill-switcher-btn ${docLanguage === lang ? "active" : ""}`}
                  onClick={() => setDocLanguage(lang)}
                >
                  {lang === "curl" ? "cURL" : lang === "javascript" ? "JavaScript (Fetch)" : "Python"}
                </button>
              ))}
            </div>
          </div>

          {/* ENDPOINT 1: GET /api/v1/products */}
          <section className="card">
            <div className="row-between items-center mb-2">
              <div className="row gap-2 items-center">
                <span className="badge-blue">GET</span>
                <strong className="text-base font-mono">/api/v1/products</strong>
              </div>
              <span className="pill grey font-mono text-xs">
                Scope: products:read
              </span>
            </div>
            <p className="muted text-sm mb-3">
              List catalog products with pagination, category details, status filtering, and keyword search.
            </p>

            <CodeSnippetViewer
              language={docLanguage}
              endpoint={`${baseUrl}/api/v1/products?limit=10&page=1`}
              method="GET"
              keyPrefix={selectedDocKey}
            />
          </section>

          {/* ENDPOINT 2: GET /api/v1/products/:id */}
          <section className="card">
            <div className="row-between items-center mb-2">
              <div className="row gap-2 items-center">
                <span className="badge-blue">GET</span>
                <strong className="text-base font-mono">/api/v1/products/:id</strong>
              </div>
              <span className="pill grey font-mono text-xs">
                Scope: products:read
              </span>
            </div>
            <p className="muted text-sm mb-3">
              Retrieve full breakdown of a single product and all active SKU variants by product ID or URL slug.
            </p>

            <CodeSnippetViewer
              language={docLanguage}
              endpoint={`${baseUrl}/api/v1/products/cotton-panjabi-off-white`}
              method="GET"
              keyPrefix={selectedDocKey}
            />
          </section>

          {/* ENDPOINT 3: PATCH /api/v1/inventory/adjust */}
          <section className="card">
            <div className="row-between items-center mb-2">
              <div className="row gap-2 items-center">
                <span className="badge-amber">PATCH</span>
                <strong className="text-base font-mono">/api/v1/inventory/adjust</strong>
              </div>
              <span className="pill grey font-mono text-xs">
                Scope: inventory:update
              </span>
            </div>
            <p className="muted text-sm mb-3">
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
          </section>

          {/* ENDPOINT 4: GET /api/v1/orders */}
          <section className="card">
            <div className="row-between items-center mb-2">
              <div className="row gap-2 items-center">
                <span className="badge-blue">GET</span>
                <strong className="text-base font-mono">/api/v1/orders</strong>
              </div>
              <span className="pill grey font-mono text-xs">
                Scope: orders:read
              </span>
            </div>
            <p className="muted text-sm mb-3">
              Query store orders with pagination, status filters (<code>status=PENDING</code>), payment status, and customer phone lookups.
            </p>

            <CodeSnippetViewer
              language={docLanguage}
              endpoint={`${baseUrl}/api/v1/orders?limit=10&page=1`}
              method="GET"
              keyPrefix={selectedDocKey}
            />
          </section>

          {/* ENDPOINT 5: POST /api/v1/orders */}
          <section className="card">
            <div className="row-between items-center mb-2">
              <div className="row gap-2 items-center">
                <span className="badge-green">POST</span>
                <strong className="text-base font-mono">/api/v1/orders</strong>
              </div>
              <span className="pill grey font-mono text-xs">
                Scope: orders:write
              </span>
            </div>
            <p className="muted text-sm mb-3">
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
          </section>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: LIVE REQUEST TRAFFIC AUDIT LOGS */}
      {/* ======================================================== */}
      {activeTab === "logs" && (
        <div>
          <div className="row-between items-center mb-3">
            <div>
              <h2 className="text-lg m-0 font-bold">Recent API Traffic Logs</h2>
              <p className="muted text-sm mt-1">
                Inspecting last 50 requests across all active API keys. Bearer tokens are strictly masked in logs.
              </p>
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="card text-center py-5">
              <p className="muted text-base m-0">
                No API requests recorded yet. Make a request via cURL or Postman to inspect traffic here.
              </p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="table-wrap">
                <table className="table m-0">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Method</th>
                      <th>Endpoint</th>
                      <th>Status</th>
                      <th>Latency</th>
                      <th>Key Prefix</th>
                      <th>Client IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
                      const isRateLimit = log.statusCode === 429;
                      const isAuthError = log.statusCode === 401 || log.statusCode === 403;

                      return (
                        <tr key={log.id}>
                          <td className="text-xs">
                            {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </td>
                          <td>
                            <span
                              className={
                                log.method === "GET" ? "badge-blue" : log.method === "POST" ? "badge-green" : "badge-amber"
                              }
                            >
                              {log.method}
                            </span>
                          </td>
                          <td className="font-mono text-xs">{log.endpoint}</td>
                          <td>
                            <span
                              className={
                                isSuccess ? "badge-green" : isRateLimit ? "badge-purple" : isAuthError ? "badge-red" : "badge-amber"
                              }
                            >
                              {log.statusCode}
                            </span>
                          </td>
                          <td className="text-xs">{log.durationMs}ms</td>
                          <td className="font-mono text-xs muted">
                            {log.keyPrefix || "—"}
                          </td>
                          <td className="font-mono text-xs muted">
                            {log.ipAddress || "127.0.0.1"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
    <div className="relative">
      <pre className="code-block">
        <code>{code}</code>
      </pre>
      <div className="absolute top-2 right-2">
        <CopyButton value={code} label="Code Snippet" />
      </div>
    </div>
  );
}
