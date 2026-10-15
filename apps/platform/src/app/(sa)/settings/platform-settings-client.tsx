"use client";

import { useState } from "react";
import type {
  PlatformAiConfigView,
  PlatformSmsConfigView,
  PlatformCourierConfigView,
  PlatformUddoktaPayConfigView,
  PlatformMailConfigView,
  PlatformFraudConfigView,
  PlatformGoogleConfigView,
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
  savePlatformGoogleConfigAction,
  testPlatformGoogleConnectionAction,
} from "./actions";

interface Props {
  initialAiConfig: PlatformAiConfigView;
  initialSmsConfig: PlatformSmsConfigView;
  initialCourierConfig: PlatformCourierConfigView;
  initialUddoktaConfig: PlatformUddoktaPayConfigView;
  initialMailConfig: PlatformMailConfigView;
  initialFraudConfig: PlatformFraudConfigView;
  initialGoogleConfig: PlatformGoogleConfigView;
}

type TabType = "ai" | "sms" | "couriers" | "payments" | "mail" | "fraud" | "google";

export function PlatformSettingsClient({
  initialAiConfig,
  initialSmsConfig,
  initialCourierConfig,
  initialUddoktaConfig,
  initialMailConfig,
  initialFraudConfig,
  initialGoogleConfig,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("ai");

  // Google Cloud Suite State
  const [googleOauthClientId, setGoogleOauthClientId] = useState(initialGoogleConfig.oauthClientId || "");
  const [googleOauthClientSecret, setGoogleOauthClientSecret] = useState("");
  const [googleOauthMaskedSecret, setGoogleOauthMaskedSecret] = useState(initialGoogleConfig.maskedOAuthSecret || "");
  const [googleOauthEnabled, setGoogleOauthEnabled] = useState(initialGoogleConfig.oauthEnabled);
  const [googleGcsBucket, setGoogleGcsBucket] = useState(initialGoogleConfig.gcsBucketName || "");
  const [googleGcsProject, setGoogleGcsProject] = useState(initialGoogleConfig.gcsProjectId || "");
  const [googleGcsKey, setGoogleGcsKey] = useState("");
  const [googleGcsMaskedKey, setGoogleGcsMaskedKey] = useState(initialGoogleConfig.maskedServiceAccountKey || "");
  const [googleGcsEnabled, setGoogleGcsEnabled] = useState(initialGoogleConfig.gcsEnabled);
  const [googleMerchantId, setGoogleMerchantId] = useState(initialGoogleConfig.merchantCenterId || "");
  const [googleSiteVerification, setGoogleSiteVerification] = useState(initialGoogleConfig.siteVerificationCode || "");
  const [googleTesting, setGoogleTesting] = useState(false);
  const [googleTestResult, setGoogleTestResult] = useState<{
    ok: boolean;
    latencyMs: number;
    message: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  function copyToClipboard(text: string, fieldName: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2500);
    }
  }

  async function handleSaveGoogle(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    const res = await savePlatformGoogleConfigAction({
      oauthClientId: googleOauthClientId.trim() || undefined,
      oauthClientSecret: googleOauthClientSecret.trim() || undefined,
      oauthEnabled: googleOauthEnabled,
      gcsBucketName: googleGcsBucket.trim() || undefined,
      gcsProjectId: googleGcsProject.trim() || undefined,
      gcsServiceAccountKey: googleGcsKey.trim() || undefined,
      gcsEnabled: googleGcsEnabled,
      merchantCenterId: googleMerchantId.trim() || undefined,
      siteVerificationCode: googleSiteVerification.trim() || undefined,
    });
    setSaving(false);
    if (res.ok) {
      if (googleOauthClientSecret.trim()) {
        const s = googleOauthClientSecret.trim();
        setGoogleOauthMaskedSecret(s.length > 8 ? `${s.slice(0, 4)}••••••••${s.slice(-4)}` : "••••••••");
        setGoogleOauthClientSecret("");
      }
      if (googleGcsKey.trim()) {
        setGoogleGcsMaskedKey("•••••••• (Service Account Key Saved)");
        setGoogleGcsKey("");
      }
      setNotice({ good: "Google Cloud Platform settings saved successfully." });
    } else {
      setNotice({ bad: res.error });
    }
  }

  async function handleTestGoogle() {
    setGoogleTesting(true);
    setGoogleTestResult(null);
    const res = await testPlatformGoogleConnectionAction();
    setGoogleTesting(false);
    setGoogleTestResult(res);
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
          Content AI Studio
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
          SMS Gateways
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
          Couriers & Logistics
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
          Payment Gateway
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
          Mail & Branding
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
          Fraud Shield
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("google"); setNotice(null); }}
          data-testid="tab-google"
          style={{
            padding: "8px 16px",
            border: "none",
            borderBottom: activeTab === "google" ? "3px solid #5B4FE8" : "3px solid transparent",
            background: "none",
            color: activeTab === "google" ? "#5B4FE8" : "#4B4B73",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Google Cloud Suite
        </button>
      </div>

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
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
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
                {aiTesting ? "Testing…" : "Test Latency & Ping"}
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
                {couriersTesting ? "Pinging…" : "Ping Courier Networks"}
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
                {uddoktaTesting ? "Testing…" : "Ping Gateway"}
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

      {activeTab === "fraud" && (
        <FraudCheckerSettings initial={initialFraudConfig} />
      )}

      {/* 7. GOOGLE CLOUD SUITE TAB */}
      {activeTab === "google" && (
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: 24 }}>
          <form onSubmit={handleSaveGoogle} style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 760 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1F1F38" }}>Google Cloud Platform & Console Suite</div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 12, background: "#E8F0FE", color: "#1A73E8" }}>
                  GCP Enterprise
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#6B6B8D", marginTop: 4 }}>
                Centralized Google Cloud infrastructure: OAuth 2.0 Customer & Staff Login, Google Cloud Storage (GCS) assets, Search Console site verification, and Merchant Center Shopping catalog.
              </div>
            </div>

            {/* Service Status Badges */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              <div style={{ padding: "10px 14px", background: "#F8F8FD", border: "1px solid #E7E7F0", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6B8D", textTransform: "uppercase" }}>OAuth 2.0 SSO</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: googleOauthEnabled && (googleOauthClientId || googleOauthMaskedSecret) ? "#15803D" : "#6B6B8D" }}>
                  {googleOauthEnabled && (googleOauthClientId || googleOauthMaskedSecret) ? "● Active" : "○ Inactive"}
                </div>
              </div>
              <div style={{ padding: "10px 14px", background: "#F8F8FD", border: "1px solid #E7E7F0", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6B8D", textTransform: "uppercase" }}>GCS Storage</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: googleGcsEnabled && (googleGcsBucket || googleGcsMaskedKey) ? "#15803D" : "#6B6B8D" }}>
                  {googleGcsEnabled && (googleGcsBucket || googleGcsMaskedKey) ? "● Active" : "○ Inactive"}
                </div>
              </div>
              <div style={{ padding: "10px 14px", background: "#F8F8FD", border: "1px solid #E7E7F0", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6B8D", textTransform: "uppercase" }}>Search Console</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: googleSiteVerification ? "#15803D" : "#6B6B8D" }}>
                  {googleSiteVerification ? "● Verified" : "○ Not Set"}
                </div>
              </div>
              <div style={{ padding: "10px 14px", background: "#F8F8FD", border: "1px solid #E7E7F0", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6B8D", textTransform: "uppercase" }}>Merchant Center</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: googleMerchantId ? "#15803D" : "#6B6B8D" }}>
                  {googleMerchantId ? "● Linked" : "○ Not Set"}
                </div>
              </div>
            </div>

            {/* 1. Google OAuth 2.0 Section */}
            <div style={{ border: "1px solid #E7E7F0", borderRadius: 10, padding: 18, background: "#FAFAFD" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1F1F38" }}>1. Google OAuth 2.0 (Customer & Staff SSO)</div>
                  <div style={{ fontSize: 12.5, color: "#6B6B8D" }}>
                    Enables "Continue with Google" one-tap sign-in on platform super admin and tenant storefronts.
                  </div>
                </div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={googleOauthEnabled}
                    onChange={(e) => setGoogleOauthEnabled(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  Enable SSO
                </label>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 5 }}>Google Client ID</label>
                  <input
                    type="text"
                    value={googleOauthClientId}
                    onChange={(e) => setGoogleOauthClientId(e.target.value)}
                    placeholder="e.g. 1092837465-xxx.apps.googleusercontent.com"
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 13.5 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 5 }}>
                    Google Client Secret {googleOauthMaskedSecret && <span style={{ color: "#15803D", fontWeight: 400 }}>({googleOauthMaskedSecret})</span>}
                  </label>
                  <input
                    type="password"
                    value={googleOauthClientSecret}
                    onChange={(e) => setGoogleOauthClientSecret(e.target.value)}
                    placeholder={googleOauthMaskedSecret ? "Leave blank to keep existing secret, or enter new..." : "GOCSPX-xxxxxxxxxxxxxxxx"}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 13.5 }}
                  />
                </div>

                {/* Authorized Redirect URIs Helper */}
                <div style={{ marginTop: 6, padding: "12px 14px", background: "#fff", border: "1px dashed #D5D5E4", borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#4B4B73", marginBottom: 6 }}>
                    Required in Google Cloud Console &rarr; Credentials &rarr; Authorized redirect URIs:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      "https://platform.biztrack.bd/api/auth/callback/google",
                      "https://admin.biztrack.bd/api/auth/callback/google",
                      "https://biztrack.bd/api/auth/callback/google",
                    ].map((uri) => (
                      <div key={uri} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F4F3FF", padding: "6px 10px", borderRadius: 6 }}>
                        <code style={{ fontSize: 12, color: "#5B4FE8" }}>{uri}</code>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(uri, uri)}
                          style={{ fontSize: 11, padding: "3px 8px", background: "#fff", border: "1px solid #C4C0F8", borderRadius: 4, cursor: "pointer", fontWeight: 600, color: "#5B4FE8" }}
                        >
                          {copiedField === uri ? "Copied!" : "Copy URI"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Google Cloud Storage (GCS) */}
            <div style={{ border: "1px solid #E7E7F0", borderRadius: 10, padding: 18, background: "#FAFAFD" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1F1F38" }}>2. Google Cloud Storage (GCS Bucket)</div>
                  <div style={{ fontSize: 12.5, color: "#6B6B8D" }}>
                    Store merchant media, invoices, product images, and automated platform backups on Google Cloud.
                  </div>
                </div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={googleGcsEnabled}
                    onChange={(e) => setGoogleGcsEnabled(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  Enable GCS
                </label>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 5 }}>GCP Project ID</label>
                    <input
                      type="text"
                      value={googleGcsProject}
                      onChange={(e) => setGoogleGcsProject(e.target.value)}
                      placeholder="e.g. biztrackbd-production"
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 13.5 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 5 }}>GCS Bucket Name</label>
                    <input
                      type="text"
                      value={googleGcsBucket}
                      onChange={(e) => setGoogleGcsBucket(e.target.value)}
                      placeholder="e.g. biztrackbd-media"
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 13.5 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 5 }}>
                    Service Account Key JSON {googleGcsMaskedKey && <span style={{ color: "#15803D", fontWeight: 400 }}>({googleGcsMaskedKey})</span>}
                  </label>
                  <textarea
                    rows={4}
                    value={googleGcsKey}
                    onChange={(e) => setGoogleGcsKey(e.target.value)}
                    placeholder={googleGcsMaskedKey ? "Leave blank to retain active Service Account Key JSON, or paste replacement JSON..." : '{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key": "..."\n}'}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 12, fontFamily: "monospace" }}
                  />
                  <div style={{ fontSize: 11.5, color: "#6B6B8D", marginTop: 4 }}>
                    Requires role: <code style={{ background: "#F0F0F8", padding: "2px 4px", borderRadius: 4 }}>Storage Object Admin (roles/storage.objectAdmin)</code>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Search Console & Merchant Center */}
            <div style={{ border: "1px solid #E7E7F0", borderRadius: 10, padding: 18, background: "#FAFAFD" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1F1F38", marginBottom: 4 }}>
                3. Search Console & Merchant Center Catalog Feed
              </div>
              <div style={{ fontSize: 12.5, color: "#6B6B8D", marginBottom: 14 }}>
                Master domain verification tag and Google Merchant Center product catalog feed.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 5 }}>
                    Google Search Console Site Verification Token / Meta Tag
                  </label>
                  <input
                    type="text"
                    value={googleSiteVerification}
                    onChange={(e) => setGoogleSiteVerification(e.target.value)}
                    placeholder='e.g. google-site-verification=abc123xyz or <meta name="google-site-verification" content="..." />'
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 13.5 }}
                  />
                  <div style={{ fontSize: 11.5, color: "#6B6B8D", marginTop: 4 }}>
                    Automatically parsed and injected into HTML &lt;head&gt; across platform portals.
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 5 }}>
                      Merchant Center ID
                    </label>
                    <input
                      type="text"
                      value={googleMerchantId}
                      onChange={(e) => setGoogleMerchantId(e.target.value)}
                      placeholder="e.g. 539120384"
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 13.5 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 5 }}>
                      Public Google Shopping XML Feed
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        type="text"
                        readOnly
                        value="https://biztrack.bd/api/feed/google.xml"
                        style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 12, background: "#F5F5F9" }}
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard("https://biztrack.bd/api/feed/google.xml", "feed-url")}
                        style={{ padding: "8px 12px", background: "#F4F3FF", color: "#5B4FE8", border: "1px solid #5B4FE8", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        {copiedField === "feed-url" ? "Copied!" : "Copy Feed URL"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Connection Output */}
            {googleTestResult && (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 8,
                  fontSize: 13.5,
                  fontWeight: 600,
                  background: googleTestResult.ok ? "#E8F6EE" : "#FCEBEB",
                  color: googleTestResult.ok ? "#15803D" : "#DC2626",
                  border: `1px solid ${googleTestResult.ok ? "#A3E635" : "#F87171"}`,
                }}
              >
                <div>{googleTestResult.message}</div>
                <div style={{ fontSize: 12, fontWeight: 400, marginTop: 4, display: "flex", gap: 14 }}>
                  <span>Latency: {googleTestResult.latencyMs}ms</span>
                  <span>OAuth: {googleOauthClientId || googleOauthMaskedSecret ? "Configured" : "Not Set"}</span>
                  <span>GCS Storage: {googleGcsBucket || googleGcsMaskedKey ? "Configured" : "Not Set"}</span>
                </div>
              </div>
            )}

            {/* Submit & Test Buttons */}
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "11px 24px",
                  background: "#5B4FE8",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {saving ? "Saving…" : "Save Google Cloud Settings"}
              </button>
              <button
                type="button"
                onClick={handleTestGoogle}
                disabled={googleTesting}
                style={{
                  padding: "11px 20px",
                  background: "#F4F3FF",
                  color: "#5B4FE8",
                  border: "1px solid #5B4FE8",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {googleTesting ? "Testing Connection…" : "Ping Google Services"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
