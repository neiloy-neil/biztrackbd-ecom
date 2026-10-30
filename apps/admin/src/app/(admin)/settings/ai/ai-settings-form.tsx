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
    <form action={formAction} className="stack gap-4">
      {state.error && <div className="notice bad" role="alert">{state.error}</div>}
      {state.success && <div className="notice good" role="status">{state.success}</div>}

      {/* Quota & Engine Status Card */}
      <section className="card">
        <div className="row-between items-center mb-3">
          <div>
            <h2 className="m-0 text-lg">Quota &amp; Generation Status</h2>
            <p className="muted text-sm mt-1">
              Provider: <strong>Standard Content Generator</strong>
            </p>
          </div>
          <span className={initial.hasCustomKey ? "badge-green" : percentUsed >= 90 ? "badge-red" : "badge-amber"}>
            {initial.hasCustomKey ? "Custom Key (Unlimited)" : `Plan Quota (${initial.planTier})`}
          </span>
        </div>

        {!initial.hasCustomKey ? (
          <div>
            <div className="row-between text-sm mb-2">
              <span>Monthly Generations Used: <strong>{initial.usedThisMonth}</strong> / {initial.monthlyQuota}</span>
              <span className="muted">{initial.remainingThisMonth} remaining</span>
            </div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${percentUsed}%`,
                  background: percentUsed >= 90 ? "#DC2626" : percentUsed >= 70 ? "#F59E0B" : "#2563EB",
                }}
              />
            </div>
            <p className="muted text-xs mt-2">
              Need more generations? Add your own API key below to enable unlimited generations.
            </p>
          </div>
        ) : (
          <div className="notice good">
            Your custom API Key is active. All description generation and chat requests run directly through your key with no monthly limits.
          </div>
        )}
      </section>

      {/* Bring Your Own Key Section */}
      <section className="card">
        <h2 className="text-lg m-0 mb-1">Custom API Key (Optional)</h2>
        <p className="muted text-sm mb-3">
          You can provide your own API key from Google AI Studio. Adding your own key unlocks unlimited description generation and customer assistant requests.
        </p>

        <label className="field">
          <span className="label">Google Gemini API Key</span>
          <div className="row gap-2">
            <input
              type="text"
              name="customGeminiApiKey"
              className="input input-mono"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              placeholder="AIzaSy..."
            />
            <button
              type="button"
              className="btn btn-secondary whitespace-nowrap"
              onClick={handleTestKey}
              disabled={isTesting || !customKey}
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
          <div className={`notice ${testResult.valid ? "good" : "bad"} mt-3`}>
            {testResult.valid ? "Connection successful. API key is valid." : `Error: ${testResult.error}`}
          </div>
        )}
      </section>

      {/* Storefront Shopping Assistant Settings */}
      <section className="card">
        <h2 className="text-lg m-0 mb-1">Storefront Shopping Assistant</h2>
        <p className="muted text-sm mb-3">
          A chat assistant on your website answering product inquiries, checking order status by phone number, and explaining delivery policies.
        </p>

        <label className="check mb-3">
          <input
            type="checkbox"
            name="aiChatbotEnabled"
            defaultChecked={initial.chatbotEnabled}
          />
          <span><strong>Enable Storefront Shopping Assistant</strong></span>
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

        <label className="field mt-3">
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
