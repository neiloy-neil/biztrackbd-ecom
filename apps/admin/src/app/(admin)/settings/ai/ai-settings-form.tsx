"use client";

import React, { useState, useTransition, useActionState } from "react";
import { SubmitButton } from "@/components/ui";
import { saveAiSettingsAction, testGeminiKeyAction, type AiActionState } from "./actions";
import type { AiSettingsView } from "@biztrackbd/core";

export function AiSettingsForm({ initial }: { initial: AiSettingsView }) {
  const [state, formAction] = useActionState(saveAiSettingsAction, {} as AiActionState);
  const [customKey, setCustomKey] = useState(initial.maskedKey ?? "");
  const [testResult, setTestResult] = useState<{ valid?: boolean; error?: string } | null>(null);
  const [isTesting, startTestTransition] = useTransition();

  const handleTestKey = () => {
    if (!customKey.trim() || customKey.includes("••••")) {
      setTestResult({ error: "Please enter a new complete Gemini API key to test." });
      return;
    }
    setTestResult(null);
    startTestTransition(async () => {
      const res = await testGeminiKeyAction(customKey);
      setTestResult(res);
    });
  };

  const percentUsed = initial.hasCustomKey
    ? 0
    : Math.min(100, Math.round((initial.usedThisMonth / Math.max(1, initial.monthlyQuota)) * 100));

  return (
    <form action={formAction} className="stack" style={{ gap: "20px" }}>
      {state.error && <div className="notice bad" role="alert">{state.error}</div>}
      {state.success && <div className="notice good" role="status">{state.success}</div>}

      {/* Quota & Engine Status Card */}
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Quota &amp; Generation Status</h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
              Provider: <strong>Standard Content Generator</strong>
            </p>
          </div>
          <span className={`pill ${initial.hasCustomKey ? "ok" : percentUsed >= 90 ? "bad" : "warn"}`}>
            {initial.hasCustomKey ? "Custom Key (Unlimited)" : `Plan Quota (${initial.planTier})`}
          </span>
        </div>

        {!initial.hasCustomKey ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span>Monthly Generations Used: <strong>{initial.usedThisMonth}</strong> / {initial.monthlyQuota}</span>
              <span className="muted">{initial.remainingThisMonth} remaining</span>
            </div>
            <div style={{ width: "100%", height: 8, background: "#E2E8F0", borderRadius: 4, overflow: "hidden" }}>
              <div
                style={{
                  width: `${percentUsed}%`,
                  height: "100%",
                  background: percentUsed >= 90 ? "#DC2626" : percentUsed >= 70 ? "#F59E0B" : "#2563EB",
                }}
              />
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
              Need more generations? Add your own API key below to enable unlimited generations.
            </p>
          </div>
        ) : (
          <div style={{ padding: "12px 14px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, fontSize: 13.5, color: "#166534" }}>
            Your custom API Key is active. All description generation and chat requests run directly through your key with no monthly limits.
          </div>
        )}
      </section>

      {/* Bring Your Own Key Section */}
      <section className="card">
        <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>Custom API Key (Optional)</h2>
        <p className="muted" style={{ fontSize: 13.5, margin: "0 0 14px" }}>
          You can provide your own API key from Google AI Studio. Adding your own key unlocks unlimited description generation and customer assistant requests.
        </p>

        <label className="field">
          <span className="label">Google Gemini API Key</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              name="customGeminiApiKey"
              className="input"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              placeholder="AIzaSy..."
              style={{ fontFamily: "monospace" }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTestKey}
              disabled={isTesting || !customKey}
              style={{ whiteSpace: "nowrap" }}
            >
              {isTesting ? "Testing…" : "Test Key"}
            </button>
            {initial.hasCustomKey && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setCustomKey("")}
                title="Remove custom key and revert to platform quota"
              >
                Clear
              </button>
            )}
          </div>
          <span className="help">
            Get your free API key at{" "}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="link">
              aistudio.google.com ↗
            </a>
            . Leave blank to use your store plan's shared quota.
          </span>
        </label>

        {testResult && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              background: testResult.valid ? "#ECFDF5" : "#FEF2F2",
              border: `1px solid ${testResult.valid ? "#A7F3D0" : "#FECACA"}`,
              color: testResult.valid ? "#065F46" : "#991B1B",
            }}
          >
            {testResult.valid ? "Connection successful. API key is valid." : `Error: ${testResult.error}`}
          </div>
        )}
      </section>

      {/* Storefront Shopping Assistant Settings */}
      <section className="card">
        <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>Storefront Shopping Assistant</h2>
        <p className="muted" style={{ fontSize: 13.5, margin: "0 0 16px" }}>
          A chat assistant on your website answering product inquiries, checking order status by phone number, and explaining delivery policies.
        </p>

        <label className="checkbox-row" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <input
            type="checkbox"
            name="aiChatbotEnabled"
            defaultChecked={initial.chatbotEnabled}
            style={{ width: 18, height: 18, cursor: "pointer" }}
          />
          <span style={{ fontWeight: 600 }}>Enable Storefront Shopping Assistant</span>
        </label>

        <div className="row-2">
          <label className="field">
            <span className="label">Assistant Name</span>
            <input
              type="text"
              name="aiChatbotName"
              className="input"
              defaultValue={initial.chatbotName}
              placeholder="শপ অ্যাসিস্ট্যান্ট"
              maxLength={50}
            />
            <span className="help">Shown in the chat widget header (e.g. শপ অ্যাসিস্ট্যান্ট, Shopping Assistant).</span>
          </label>

          <label className="field">
            <span className="label">Human Handover WhatsApp / Mobile</span>
            <input
              type="tel"
              name="aiChatbotEscalatePhone"
              className="input"
              defaultValue={initial.chatbotEscalatePhone ?? ""}
              placeholder="01712345678"
            />
            <span className="help">If customer requests human support, this WhatsApp button is provided.</span>
          </label>
        </div>

        <label className="field">
          <span className="label">Custom Welcome Message (Optional)</span>
          <textarea
            name="aiChatbotWelcome"
            className="input"
            rows={2}
            defaultValue={initial.chatbotWelcome ?? ""}
            placeholder="আসসালামু আলাইকুম! কোনো পণ্য বা অর্ডারের বিষয়ে কিছু জানতে চান? আমি সাহায্য করতে পারি।"
            maxLength={300}
          />
          <span className="help">Leave blank to use the default greeting.</span>
        </label>

        <label className="field" style={{ marginTop: 12 }}>
          <span className="label">Custom Business Instructions &amp; FAQs (AI Grounding)</span>
          <textarea
            name="aiChatbotInstructions"
            className="input"
            rows={4}
            defaultValue={initial.chatbotInstructions ?? ""}
            placeholder="উদাহরণ: আমাদের দোকান প্রতি শুক্রবার বন্ধ থাকে। ডেলিভারির সময় ২-৩ দিন। ডাক্তার রহমান প্রতি শনি ও সোম সন্ধ্যা ৬টা থেকে রাত ৯টা পর্যন্ত চেম্বারে থাকেন। বিশেষ যেকোনো নীতি বা নিয়ম এখানে লিখে দিন..."
            maxLength={3000}
          />
          <span className="help">
            Custom rules, doctor chamber timings, service policies, or promotions. Both the storefront assistant and Admin Copilot will automatically follow these instructions.
          </span>
        </label>
      </section>

      <div>
        <SubmitButton className="btn btn-primary" pending="Saving preferences…">
          Save Preferences
        </SubmitButton>
      </div>
    </form>
  );
}
