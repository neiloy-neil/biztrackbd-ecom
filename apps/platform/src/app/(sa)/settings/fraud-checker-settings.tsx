"use client";

import { useState } from "react";
import type { PlatformFraudConfigView } from "@biztrackbd/core";
import { savePlatformFraudConfigAction, testPlatformFraudCheckerAction } from "./actions";

const input = { width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 14 } as const;

/** The courier fraud screening service key and address. Used by the free fraud checker on the marketing site and by the fraud check on every store's orders. */
export function FraudCheckerSettings({ initial }: { initial: PlatformFraudConfigView }) {
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState(initial.endpoint);
  const [masked, setMasked] = useState(initial.maskedKey);
  const [source, setSource] = useState(initial.source);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<{ good?: string; bad?: string } | null>(null);
  const [test, setTest] = useState<{ ok: boolean; latencyMs: number; message: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setNotice(null);
    const r = await savePlatformFraudConfigAction({ apiKey: apiKey.trim() ? apiKey : undefined, endpoint });
    setSaving(false);
    if (!r.ok) { setNotice({ bad: r.error }); return; }
    if (apiKey.trim()) { setMasked(`${apiKey.trim().slice(0, 4)}••••••••${apiKey.trim().slice(-4)}`); setSource("DATABASE"); }
    setApiKey("");
    setNotice({ good: "Saved. Stores pick up the new key within a minute." });
  }

  async function remove() {
    if (!window.confirm("Remove the saved key? The fraud checker will use the server's FRAUD_CHECKER_API_KEY if there is one, and otherwise stop returning results.")) return;
    setSaving(true); setNotice(null);
    const r = await savePlatformFraudConfigAction({ apiKey: "" });
    setSaving(false);
    if (!r.ok) { setNotice({ bad: r.error }); return; }
    setMasked(null); setSource("NONE");
    setNotice({ good: "Key removed." });
  }

  async function runTest() {
    setTesting(true); setTest(null);
    setTest(await testPlatformFraudCheckerAction(apiKey.trim() || undefined));
    setTesting(false);
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: 24 }} data-testid="fraud-settings">
      <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Courier fraud screening service</div>
          <div style={{ fontSize: 13, color: "#6B6B8D", marginTop: 4 }}>
            The key for the 5-courier fraud check (Steadfast, Pathao, RedX, CarryBee, Paperfly). It powers the free fraud checker on the marketing site and the delivery trust check on every store&apos;s orders. Without a key, both show no result.
          </div>
        </div>

        {notice?.good && <div role="status" style={{ padding: "8px 12px", background: "#ECFDF3", borderRadius: 8, fontSize: 13, color: "#067647", fontWeight: 600 }}>{notice.good}</div>}
        {notice?.bad && <div role="alert" style={{ padding: "8px 12px", background: "#FEF3F2", borderRadius: 8, fontSize: 13, color: "#B42318", fontWeight: 600 }}>{notice.bad}</div>}

        <div style={{ padding: "8px 12px", background: "#F4F3FF", borderRadius: 8, fontSize: 13, color: "#5B4FE8", fontWeight: 600 }} data-testid="fraud-active">
          {masked ? <>Active key: <code>{masked}</code> ({source === "DATABASE" ? "saved here" : "from the server environment"})</> : "No key is set. The fraud checker is switched off."}
        </div>

        <div>
          <label htmlFor="fraud-key" style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>API key</label>
          <input id="fraud-key" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={masked ? "Enter a new key to replace the saved one" : "Paste the API key"} style={input} data-testid="fraud-key-input" />
          <div style={{ fontSize: 12, color: "#6B6B8D", marginTop: 4 }}>Stored on the platform, never shown again in full, and never written to the audit log.</div>
        </div>

        <div>
          <label htmlFor="fraud-url" style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Service address</label>
          <input id="fraud-url" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} style={input} data-testid="fraud-url-input" />
        </div>

        {test && (
          <div role="status" style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: test.ok ? "#ECFDF3" : "#FEF3F2", color: test.ok ? "#067647" : "#B42318" }} data-testid="fraud-test-result">
            {test.message} {test.latencyMs ? `(${test.latencyMs} ms)` : ""}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
          <button type="submit" disabled={saving} style={{ padding: "10px 20px", background: "#5B4FE8", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }} data-testid="fraud-save">
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={runTest} disabled={testing} style={{ padding: "10px 20px", background: "#fff", color: "#5B4FE8", border: "1px solid #5B4FE8", borderRadius: 8, fontWeight: 700, cursor: "pointer" }} data-testid="fraud-test">
            {testing ? "Testing…" : "Test the key"}
          </button>
          {source === "DATABASE" && (
            <button type="button" onClick={remove} disabled={saving} style={{ padding: "10px 20px", background: "#fff", color: "#B42318", border: "1px solid #D5D5E4", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
              Remove saved key
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
