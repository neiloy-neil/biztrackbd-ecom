"use client";

import { useState } from "react";
import type {
  PlatformAiConfigView,
  PlatformSmsConfigView,
  PlatformCourierConfigView,
  PlatformUddoktaPayConfigView,
  PlatformMailConfigView,
  PlatformFraudConfigView,
} from "@biztrackbd/core";
import { FraudCheckerSettings } from "./fraud-checker-settings";
import {
  savePlatformAiConfigAction,
  testPlatformAiConnectionAction,
  savePlatformSmsConfigAction,
  testPlatformSmsAction,
  savePlatformCourierConfigAction,
  testPlatformCouriersAction,
  savePlatformUddoktaPayConfigAction,
  testPlatformUddoktaPayAction,
  savePlatformMailConfigAction,
} from "./actions";

interface Props {
  initialAiConfig: PlatformAiConfigView;
  initialSmsConfig: PlatformSmsConfigView;
  initialCourierConfig: PlatformCourierConfigView;
  initialUddoktaConfig: PlatformUddoktaPayConfigView;
  initialMailConfig: PlatformMailConfigView;
  initialFraudConfig: PlatformFraudConfigView;
}

type TabType = "ai" | "sms" | "couriers" | "payments" | "mail" | "fraud";

export function PlatformSettingsClient({
  initialAiConfig,
  initialSmsConfig,
  initialCourierConfig,
  initialUddoktaConfig,
  initialMailConfig,
  initialFraudConfig,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("ai");

  // AI State
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState(initialAiConfig.defaultModel);
  const [aiMasked, setAiMasked] = useState(initialAiConfig.maskedKey);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; latencyMs: number; model?: string; error?: string } | null>(null);

  // SMS State
  const [smsProvider, setSmsProvider] = useState<"smsnetbd" | "greenweb" | "bulksmsbd">(initialSmsConfig.provider);
  const [smsApiKey, setSmsApiKey] = useState("");
  const [smsSenderId, setSmsSenderId] = useState(initialSmsConfig.senderId || "");
  const [smsMasked, setSmsMasked] = useState(initialSmsConfig.maskedApiKey);
  const [smsTestPhone, setSmsTestPhone] = useState("");
  const [smsTesting, setSmsTesting] = useState(false);
  const [smsTestResult, setSmsTestResult] = useState<{ ok: boolean; latencyMs: number; message: string } | null>(null);

  // Courier State
  const [sfApiKey, setSfApiKey] = useState("");
  const [sfSecretKey, setSfSecretKey] = useState("");
  const [pathaoClientId, setPathaoClientId] = useState("");
  const [pathaoClientSecret, setPathaoClientSecret] = useState("");
  const [pathaoUsername, setPathaoUsername] = useState(initialCourierConfig.pathaoUsername || "");
  const [redxKey, setRedxKey] = useState("");
  const [carrybeeKey, setCarrybeeKey] = useState("");
  const [paperflyKey, setPaperflyKey] = useState("");
  const [couriersTesting, setCouriersTesting] = useState(false);
  const [courierTestResult, setCourierTestResult] = useState<{
    ok: boolean;
    overallLatencyMs: number;
    providers: Record<string, { status: "UP" | "DOWN" | "NOT_CONFIGURED"; latencyMs: number; error?: string }>;
  } | null>(null);

  // UddoktaPay State
  const [uddoktaBaseUrl, setUddoktaBaseUrl] = useState(initialUddoktaConfig.baseUrl);
  const [uddoktaApiKey, setUddoktaApiKey] = useState("");
  const [uddoktaSecret, setUddoktaSecret] = useState("");
  const [uddoktaMasked, setUddoktaMasked] = useState(initialUddoktaConfig.maskedApiKey);
  const [uddoktaTesting, setUddoktaTesting] = useState(false);
  const [uddoktaTestResult, setUddoktaTestResult] = useState<{ ok: boolean; latencyMs: number; message: string } | null>(null);

  // Mail State
  const [fromEmail, setFromEmail] = useState(initialMailConfig.fromEmail);
  const [fromName, setFromName] = useState(initialMailConfig.fromName);
  const [resendKey, setResendKey] = useState("");
  const [smtpHost, setSmtpHost] = useState(initialMailConfig.smtpHost || "");
  const [smtpPort, setSmtpPort] = useState(String(initialMailConfig.smtpPort || 587));
  const [smtpUser, setSmtpUser] = useState(initialMailConfig.smtpUser || "");
  const [smtpPass, setSmtpPass] = useState("");

  // Shared UI Feedback
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ good?: string; bad?: string } | null>(null);

  // Handlers
  async function handleSaveAi(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    const res = await savePlatformAiConfigAction({
      apiKey: aiApiKey.trim() || undefined,
      defaultModel: aiModel,
    });
    setSaving(false);
    if (res.ok) {
      if (aiApiKey.trim()) {
        const k = aiApiKey.trim();
        setAiMasked(k.length > 8 ? `${k.slice(0, 4)}••••••••${k.slice(-4)}` : "••••••••");
        setAiApiKey("");
      }
      setNotice({ good: "AI configuration saved successfully." });
    } else {
      setNotice({ bad: res.error });
    }
  }

  async function handleTestAi() {
    setAiTesting(true);
    setAiTestResult(null);
    const res = await testPlatformAiConnectionAction(aiApiKey.trim() || undefined, aiModel);
    setAiTesting(false);
    setAiTestResult(res);
  }

  async function handleSaveSms(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    const res = await savePlatformSmsConfigAction({
      provider: smsProvider,
      apiKey: smsApiKey.trim() || undefined,
      senderId: smsSenderId.trim() || undefined,
    });
    setSaving(false);
    if (res.ok) {
      if (smsApiKey.trim()) {
        const k = smsApiKey.trim();
        setSmsMasked(k.length > 8 ? `${k.slice(0, 4)}••••••••${k.slice(-4)}` : "••••••••");
        setSmsApiKey("");
      }
      setNotice({ good: "SMS Gateway configuration saved successfully." });
    } else {
      setNotice({ bad: res.error });
    }
  }

  async function handleTestSms() {
    if (!smsTestPhone.trim()) {
      setNotice({ bad: "Enter a test mobile number first." });
      return;
    }
    setSmsTesting(true);
    setSmsTestResult(null);
    const res = await testPlatformSmsAction(smsTestPhone.trim());
    setSmsTesting(false);
    setSmsTestResult(res);
  }

  async function handleSaveCouriers(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    const res = await savePlatformCourierConfigAction({
      steadfastApiKey: sfApiKey.trim() || undefined,
      steadfastSecretKey: sfSecretKey.trim() || undefined,
      pathaoClientId: pathaoClientId.trim() || undefined,
      pathaoClientSecret: pathaoClientSecret.trim() || undefined,
      pathaoUsername: pathaoUsername.trim() || undefined,
      redxApiKey: redxKey.trim() || undefined,
      carrybeeApiKey: carrybeeKey.trim() || undefined,
      paperflyApiKey: paperflyKey.trim() || undefined,
    });
    setSaving(false);
    if (res.ok) {
      setSfApiKey("");
      setSfSecretKey("");
      setPathaoClientId("");
      setPathaoClientSecret("");
      setRedxKey("");
      setCarrybeeKey("");
      setPaperflyKey("");
      setNotice({ good: "Master Courier API credentials saved successfully." });
    } else {
      setNotice({ bad: res.error });
    }
  }

  async function handleTestCouriers() {
    setCouriersTesting(true);
    setCourierTestResult(null);
    const res = await testPlatformCouriersAction();
    setCouriersTesting(false);
    setCourierTestResult(res);
  }

  async function handleSaveUddoktaPay(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    const res = await savePlatformUddoktaPayConfigAction({
      baseUrl: uddoktaBaseUrl.trim() || undefined,
      apiKey: uddoktaApiKey.trim() || undefined,
      webhookSecret: uddoktaSecret.trim() || undefined,
    });
    setSaving(false);
    if (res.ok) {
      if (uddoktaApiKey.trim()) {
        const k = uddoktaApiKey.trim();
        setUddoktaMasked(k.length > 8 ? `${k.slice(0, 4)}••••••••${k.slice(-4)}` : "••••••••");
        setUddoktaApiKey("");
      }
      setUddoktaSecret("");
      setNotice({ good: "UddoktaPay configuration saved successfully." });
    } else {
      setNotice({ bad: res.error });
    }
  }

  async function handleTestUddoktaPay() {
    setUddoktaTesting(true);
    setUddoktaTestResult(null);
    const res = await testPlatformUddoktaPayAction();
    setUddoktaTesting(false);
    setUddoktaTestResult(res);
  }

  async function handleSaveMail(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    const res = await savePlatformMailConfigAction({
      fromEmail: fromEmail.trim() || undefined,
      fromName: fromName.trim() || undefined,
      resendApiKey: resendKey.trim() || undefined,
      smtpHost: smtpHost.trim() || undefined,
      smtpPort: smtpPort ? parseInt(smtpPort, 10) : undefined,
      smtpUser: smtpUser.trim() || undefined,
      smtpPass: smtpPass.trim() || undefined,
    });
    setSaving(false);
    if (res.ok) {
      setResendKey("");
      setSmtpPass("");
      setNotice({ good: "Platform Mail settings saved successfully." });
    } else {
      setNotice({ bad: res.error });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Platform Settings & Gateways</h1>
        <p style={{ color: "#4B4B73", margin: "6px 0 0 0", fontSize: 13.5 }}>
          Centralized configuration for platform AI engines, SMS providers, master courier networks, and payment gateways.
        </p>
      </div>

      {notice?.good && (
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#E8F6EE", color: "#15803D", fontSize: 13.5, fontWeight: 600 }}>
          {notice.good}
        </div>
      )}
      {notice?.bad && (
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "#FCEBEB", color: "#DC2626", fontSize: 13.5, fontWeight: 600 }}>
          {notice.bad}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #E7E7F0", paddingBottom: 2 }}>
        <button
          type="button"
          onClick={() => { setActiveTab("ai"); setNotice(null); }}
          style={{
            padding: "8px 16px",
            border: "none",
            borderBottom: activeTab === "ai" ? "3px solid #5B4FE8" : "3px solid transparent",
            background: "none",
            color: activeTab === "ai" ? "#5B4FE8" : "#4B4B73",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          🤖 AI Suite (Gemini)
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("sms"); setNotice(null); }}
          style={{
            padding: "8px 16px",
            border: "none",
            borderBottom: activeTab === "sms" ? "3px solid #5B4FE8" : "3px solid transparent",
            background: "none",
            color: activeTab === "sms" ? "#5B4FE8" : "#4B4B73",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          📱 SMS Gateways
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("couriers"); setNotice(null); }}
          style={{
            padding: "8px 16px",
            border: "none",
            borderBottom: activeTab === "couriers" ? "3px solid #5B4FE8" : "3px solid transparent",
            background: "none",
            color: activeTab === "couriers" ? "#5B4FE8" : "#4B4B73",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          🚚 Couriers & Logistics
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("payments"); setNotice(null); }}
          style={{
            padding: "8px 16px",
            border: "none",
            borderBottom: activeTab === "payments" ? "3px solid #5B4FE8" : "3px solid transparent",
            background: "none",
            color: activeTab === "payments" ? "#5B4FE8" : "#4B4B73",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          💳 UddoktaPay
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("mail"); setNotice(null); }}
          style={{
            padding: "8px 16px",
            border: "none",
            borderBottom: activeTab === "mail" ? "3px solid #5B4FE8" : "3px solid transparent",
            background: "none",
            color: activeTab === "mail" ? "#5B4FE8" : "#4B4B73",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          ✉️ Mail & Branding
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("fraud"); setNotice(null); }}
          data-testid="tab-fraud"
          style={{
            padding: "8px 16px",
            border: "none",
            borderBottom: activeTab === "fraud" ? "3px solid #5B4FE8" : "3px solid transparent",
            background: "none",
            color: activeTab === "fraud" ? "#5B4FE8" : "#4B4B73",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          🛡️ Fraud checker
        </button>
      </div>

      {activeTab === "fraud" && <FraudCheckerSettings initial={initialFraudConfig} />}

      {/* 1. AI SUITE TAB */}
      {activeTab === "ai" && (
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: 24 }}>
          <form onSubmit={handleSaveAi} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Google Gemini System Key</div>
              <div style={{ fontSize: 13, color: "#6B6B8D", marginTop: 4 }}>
                Platform default used for merchant copy generation, order address parser, and storefront copilot.
              </div>
            </div>

            {aiMasked && (
              <div style={{ padding: "8px 12px", background: "#F4F3FF", borderRadius: 8, fontSize: 13, color: "#5B4FE8", fontWeight: 600 }}>
                Active Key: <code>{aiMasked}</code> (Source: {initialAiConfig.source})
              </div>
            )}

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
                {aiMasked ? "Update Gemini API Key" : "Enter Google Gemini API Key"}
              </label>
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder="AIzaSy..."
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Default Gemini Model</label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 14 }}
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Ultra Fast & Recommended)</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Highest Accuracy)</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: "10px 20px", background: "#5B4FE8", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
              >
                {saving ? "Saving…" : "Save AI Configuration"}
              </button>
              <button
                type="button"
                onClick={handleTestAi}
                disabled={aiTesting}
                style={{ padding: "10px 18px", background: "#F4F3FF", color: "#5B4FE8", border: "1px solid #5B4FE8", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
              >
                {aiTesting ? "Testing…" : "⚡ Test Latency & Ping"}
              </button>
            </div>

            {aiTestResult && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  background: aiTestResult.ok ? "#E8F6EE" : "#FCEBEB",
                  color: aiTestResult.ok ? "#15803D" : "#DC2626",
                }}
              >
                {aiTestResult.ok
                  ? `✓ Connection successful: latency ${aiTestResult.latencyMs}ms (${aiTestResult.model})`
                  : `✗ Connection failed: ${aiTestResult.error}`}
              </div>
            )}
          </form>
        </div>
      )}

      {/* 2. SMS GATEWAY TAB */}
      {activeTab === "sms" && (
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: 24 }}>
          <form onSubmit={handleSaveSms} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Platform SMS Aggregator Gateway</div>
              <div style={{ fontSize: 13, color: "#6B6B8D", marginTop: 4 }}>
                Shared platform gateway used for order notifications, OTP authentication, and courier tracking updates.
              </div>
            </div>

            {smsMasked && (
              <div style={{ padding: "8px 12px", background: "#F4F3FF", borderRadius: 8, fontSize: 13, color: "#5B4FE8", fontWeight: 600 }}>
                Active Key: <code>{smsMasked}</code> (Provider: {initialSmsConfig.provider})
              </div>
            )}

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>SMS Provider</label>
              <select
                value={smsProvider}
                onChange={(e) => setSmsProvider(e.target.value as "smsnetbd" | "greenweb" | "bulksmsbd")}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 14 }}
              >
                <option value="smsnetbd">Alpha SMS (sms.net.bd) - Primary</option>
                <option value="greenweb">Greenweb BD</option>
                <option value="bulksmsbd">BulkSMSBD</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>API Key / Token</label>
              <input
                type="password"
                value={smsApiKey}
                onChange={(e) => setSmsApiKey(e.target.value)}
                placeholder="Enter new SMS API key / token..."
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Sender ID (Masking Header)</label>
              <input
                type="text"
                value={smsSenderId}
                onChange={(e) => setSmsSenderId(e.target.value)}
                placeholder="e.g. 8809612..."
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: "10px 20px", background: "#5B4FE8", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
              >
                {saving ? "Saving…" : "Save SMS Gateway"}
              </button>
            </div>

            {/* Test SMS Block */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #E7E7F0" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Send Diagnostic SMS</div>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  value={smsTestPhone}
                  onChange={(e) => setSmsTestPhone(e.target.value)}
                  placeholder="017xxxxxxxx"
                  style={{ flex: 1, padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 14 }}
                />
                <button
                  type="button"
                  onClick={handleTestSms}
                  disabled={smsTesting}
                  style={{ padding: "10px 18px", background: "#F4F3FF", color: "#5B4FE8", border: "1px solid #5B4FE8", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
                >
                  {smsTesting ? "Sending…" : "Test SMS"}
                </button>
              </div>
              {smsTestResult && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    background: smsTestResult.ok ? "#E8F6EE" : "#FCEBEB",
                    color: smsTestResult.ok ? "#15803D" : "#DC2626",
                  }}
                >
                  {smsTestResult.message} ({smsTestResult.latencyMs}ms)
                </div>
              )}
            </div>
          </form>
        </div>
      )}

      {/* 3. COURIERS TAB */}
      {activeTab === "couriers" && (
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: 24 }}>
          <form onSubmit={handleSaveCouriers} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 680 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Free Courier Fraud Shield Master Keys</div>
              <div style={{ fontSize: 13, color: "#6B6B8D", marginTop: 4 }}>
                Master API credentials powering the platform-wide Free Courier Fraud Lead Magnet REST API (Steadfast, Pathao, RedX, CarryBee, Paperfly).
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>Steadfast API Key</label>
                <input
                  type="password"
                  value={sfApiKey}
                  onChange={(e) => setSfApiKey(e.target.value)}
                  placeholder={initialCourierConfig.steadfastApiKey || "Enter key..."}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #D5D5E4", borderRadius: 6, fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>Steadfast Secret Key</label>
                <input
                  type="password"
                  value={sfSecretKey}
                  onChange={(e) => setSfSecretKey(e.target.value)}
                  placeholder={initialCourierConfig.steadfastSecretKey || "Enter secret..."}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #D5D5E4", borderRadius: 6, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>Pathao Client ID</label>
                <input
                  type="password"
                  value={pathaoClientId}
                  onChange={(e) => setPathaoClientId(e.target.value)}
                  placeholder={initialCourierConfig.pathaoClientId || "Enter client id..."}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #D5D5E4", borderRadius: 6, fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>Pathao Client Secret</label>
                <input
                  type="password"
                  value={pathaoClientSecret}
                  onChange={(e) => setPathaoClientSecret(e.target.value)}
                  placeholder={initialCourierConfig.pathaoClientSecret || "Enter secret..."}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #D5D5E4", borderRadius: 6, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>RedX API Key</label>
                <input
                  type="password"
                  value={redxKey}
                  onChange={(e) => setRedxKey(e.target.value)}
                  placeholder={initialCourierConfig.redxApiKey || "Enter key..."}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #D5D5E4", borderRadius: 6, fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4 }}>CarryBee API Key</label>
                <input
                  type="password"
                  value={carrybeeKey}
                  onChange={(e) => setCarrybeeKey(e.target.value)}
                  placeholder={initialCourierConfig.carrybeeApiKey || "Enter key..."}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #D5D5E4", borderRadius: 6, fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: "10px 20px", background: "#5B4FE8", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
              >
                {saving ? "Saving…" : "Save Courier Credentials"}
              </button>
              <button
                type="button"
                onClick={handleTestCouriers}
                disabled={couriersTesting}
                style={{ padding: "10px 18px", background: "#F4F3FF", color: "#5B4FE8", border: "1px solid #5B4FE8", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
              >
                {couriersTesting ? "Pinging…" : "⚡ Ping Courier Networks"}
              </button>
            </div>

            {courierTestResult && (
              <div style={{ marginTop: 12, padding: 14, background: "#FAFAFC", borderRadius: 8, border: "1px solid #E7E7F0" }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Courier Networks Status:</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                  {Object.entries(courierTestResult.providers).map(([k, v]) => (
                    <div key={k} style={{ padding: "6px 10px", borderRadius: 6, background: "#fff", border: "1px solid #E7E7F0", fontSize: 12 }}>
                      <div style={{ fontWeight: 600, textTransform: "capitalize" }}>{k}</div>
                      <div style={{ color: v.status === "UP" ? "#15803D" : v.status === "DOWN" ? "#DC2626" : "#6B6B8D", fontWeight: 700, marginTop: 2 }}>
                        {v.status} {v.latencyMs > 0 && `(${v.latencyMs}ms)`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* 4. UDDOKTAPAY TAB */}
      {activeTab === "payments" && (
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: 24 }}>
          <form onSubmit={handleSaveUddoktaPay} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>UddoktaPay Platform Account</div>
              <div style={{ fontSize: 13, color: "#6B6B8D", marginTop: 4 }}>
                Automates merchant subscription renewals, recurring plan charges, and instant invoice settlements.
              </div>
            </div>

            {uddoktaMasked && (
              <div style={{ padding: "8px 12px", background: "#F4F3FF", borderRadius: 8, fontSize: 13, color: "#5B4FE8", fontWeight: 600 }}>
                Active API Key: <code>{uddoktaMasked}</code>
              </div>
            )}

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>UddoktaPay Base URL</label>
              <input
                type="text"
                value={uddoktaBaseUrl}
                onChange={(e) => setUddoktaBaseUrl(e.target.value)}
                placeholder="https://pay.biztrack.bd"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>API Key</label>
              <input
                type="password"
                value={uddoktaApiKey}
                onChange={(e) => setUddoktaApiKey(e.target.value)}
                placeholder="Enter API key..."
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Webhook Signature Secret</label>
              <input
                type="password"
                value={uddoktaSecret}
                onChange={(e) => setUddoktaSecret(e.target.value)}
                placeholder="Enter webhook secret..."
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: "10px 20px", background: "#5B4FE8", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
              >
                {saving ? "Saving…" : "Save UddoktaPay Settings"}
              </button>
              <button
                type="button"
                onClick={handleTestUddoktaPay}
                disabled={uddoktaTesting}
                style={{ padding: "10px 18px", background: "#F4F3FF", color: "#5B4FE8", border: "1px solid #5B4FE8", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
              >
                {uddoktaTesting ? "Testing…" : "⚡ Ping Gateway"}
              </button>
            </div>

            {uddoktaTestResult && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  background: uddoktaTestResult.ok ? "#E8F6EE" : "#FCEBEB",
                  color: uddoktaTestResult.ok ? "#15803D" : "#DC2626",
                }}
              >
                {uddoktaTestResult.message}
              </div>
            )}
          </form>
        </div>
      )}

      {/* 5. MAIL TAB */}
      {activeTab === "mail" && (
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: 24 }}>
          <form onSubmit={handleSaveMail} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Platform Mail & Sender Identity</div>
              <div style={{ fontSize: 13, color: "#6B6B8D", marginTop: 4 }}>
                Emails sent for staff invites, platform announcements, and payment verification receipts.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>From Email</label>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="support@biztrack.bd"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Sender Display Name</label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="BizTrackBD Platform"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 14 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Resend API Key</label>
              <input
                type="password"
                value={resendKey}
                onChange={(e) => setResendKey(e.target.value)}
                placeholder={initialMailConfig.maskedResendKey || "re_..."}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Custom SMTP Host (Optional)</label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.resend.com"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Port</label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 14 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: "10px 20px", background: "#5B4FE8", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
              >
                {saving ? "Saving…" : "Save Mail Settings"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
