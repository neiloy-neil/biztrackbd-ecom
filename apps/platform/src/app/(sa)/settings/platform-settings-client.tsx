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
  PlatformSeoConfigView,
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
  savePlatformSeoConfigAction,
} from "./actions";

interface Props {
  initialAiConfig: PlatformAiConfigView;
  initialSmsConfig: PlatformSmsConfigView;
  initialCourierConfig: PlatformCourierConfigView;
  initialUddoktaConfig: PlatformUddoktaPayConfigView;
  initialMailConfig: PlatformMailConfigView;
  initialFraudConfig: PlatformFraudConfigView;
  initialGoogleConfig: PlatformGoogleConfigView;
  initialSeoConfig: PlatformSeoConfigView;
}

type TabType = "ai" | "sms" | "couriers" | "payments" | "mail" | "fraud" | "google" | "seo";

export function PlatformSettingsClient({
  initialAiConfig,
  initialSmsConfig,
  initialCourierConfig,
  initialUddoktaConfig,
  initialMailConfig,
  initialFraudConfig,
  initialGoogleConfig,
  initialSeoConfig,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("ai");

  // Platform SEO & Sitemaps State (biztrack.bd)
  const [seoTitle, setSeoTitle] = useState(initialSeoConfig.title || "");
  const [seoDescription, setSeoDescription] = useState(initialSeoConfig.description || "");
  const [seoKeywords, setSeoKeywords] = useState(initialSeoConfig.keywords || "");
  const [seoOgImage, setSeoOgImage] = useState(initialSeoConfig.ogImageUrl || "");
  const [seoSitemapUrl] = useState(initialSeoConfig.sitemapUrl);
  const [seoRobotsUrl] = useState(initialSeoConfig.robotsUrl);
  const [seoSiteVerification, setSeoSiteVerification] = useState(initialSeoConfig.siteVerificationCode || "");

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
  const normalizedInitialModel =
    !initialAiConfig.defaultModel ||
    initialAiConfig.defaultModel === "gemini-2.0-flash" ||
    initialAiConfig.defaultModel === "gemini-1.5-flash" ||
    initialAiConfig.defaultModel === "gemini-1.5-pro"
      ? "gemini-2.5-flash"
      : initialAiConfig.defaultModel;
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModel, setAiModel] = useState(normalizedInitialModel);
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
      gcsBucketName: googleGcsBucket.trim() || undefined,
      gcsProjectId: googleGcsProject.trim() || undefined,
      gcsServiceAccountKey: googleGcsKey.trim() || undefined,
      gcsEnabled: googleGcsEnabled,
      merchantCenterId: googleMerchantId.trim() || undefined,
      siteVerificationCode: googleSiteVerification.trim() || undefined,
    });
    setSaving(false);
    if (res.ok) {
      if (googleGcsKey.trim()) {
        setGoogleGcsMaskedKey("•••••••• (Service Account Key Saved)");
        setGoogleGcsKey("");
      }
      setNotice({ good: "Google Platform settings saved successfully." });
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

  async function handleSaveSeo(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    const res = await savePlatformSeoConfigAction({
      title: seoTitle.trim() || undefined,
      description: seoDescription.trim() || undefined,
      keywords: seoKeywords.trim() || undefined,
      ogImageUrl: seoOgImage.trim() || undefined,
      siteVerificationCode: seoSiteVerification.trim(),
    });
    setSaving(false);
    if (res.ok) {
      setNotice({ good: "biztrack.bd SEO and sitemap configuration saved successfully." });
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
        <button
          type="button"
          onClick={() => { setActiveTab("seo"); setNotice(null); }}
          data-testid="tab-seo"
          style={{
            padding: "8px 16px",
            border: "none",
            borderBottom: activeTab === "seo" ? "3px solid #5B4FE8" : "3px solid transparent",
            background: "none",
            color: activeTab === "seo" ? "#5B4FE8" : "#4B4B73",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Platform SEO & Sitemaps
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
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Fastest)</option>
                <option value="gemini-flash-latest">Gemini Flash Latest</option>
                <option value="gemini-3.8-flash">Gemini 3.8 Flash (Next-Gen Preview)</option>
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
                Google Cloud infrastructure: Google Search Console site verification, Merchant Center Shopping catalog feed, and Google Cloud Storage (GCS) assets.
              </div>
            </div>

            {/* Service Status Badges */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
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
              <div style={{ padding: "10px 14px", background: "#F8F8FD", border: "1px solid #E7E7F0", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6B8D", textTransform: "uppercase" }}>GCS Storage</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: googleGcsEnabled && (googleGcsBucket || googleGcsMaskedKey) ? "#15803D" : "#6B6B8D" }}>
                  {googleGcsEnabled && (googleGcsBucket || googleGcsMaskedKey) ? "● Active" : "○ Inactive"}
                </div>
              </div>
            </div>

            {/* 1. Google Cloud Storage (GCS) */}
            <div style={{ border: "1px solid #E7E7F0", borderRadius: 10, padding: 18, background: "#FAFAFD" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1F1F38" }}>1. Google Cloud Storage (GCS Bucket)</div>
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

            {/* 2. Search Console & Merchant Center */}
            <div style={{ border: "1px solid #E7E7F0", borderRadius: 10, padding: 18, background: "#FAFAFD" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1F1F38", marginBottom: 4 }}>
                2. Search Console &amp; Merchant Center Catalog Feed
              </div>
              <div style={{ fontSize: 12.5, color: "#6B6B8D", marginBottom: 14 }}>
                Master domain verification tag and Google Merchant Center product catalog feed.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 5 }}>
                    Google Search Console Site Verification (biztrack.bd website only)
                  </label>
                  <input
                    type="text"
                    value={googleSiteVerification}
                    onChange={(e) => {
                      const val = e.target.value;
                      const match = val.match(/content=["']([^"']+)["']/i);
                      if (match?.[1]) {
                        setGoogleSiteVerification(match[1].trim());
                      } else if (val.toLowerCase().startsWith("google-site-verification=")) {
                        setGoogleSiteVerification(val.slice("google-site-verification=".length).trim());
                      } else if (val.toLowerCase().startsWith("google-site-verification:")) {
                        setGoogleSiteVerification(val.slice("google-site-verification:".length).trim());
                      } else {
                        setGoogleSiteVerification(val);
                      }
                    }}
                    placeholder='e.g. abc123xyz or <meta name="google-site-verification" content="..." />'
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #D5D5E4", borderRadius: 8, fontSize: 13.5 }}
                  />
                  {googleSiteVerification && (
                    <div style={{ marginTop: 8, padding: "8px 12px", background: "#E8F6EE", borderRadius: 6, fontSize: 12, color: "#15803D" }}>
                      ✓ Generated Meta Tag: <code style={{ color: "#15803D" }}>&lt;meta name="google-site-verification" content="{googleSiteVerification}" /&gt;</code>
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, color: "#6B6B8D", marginTop: 4 }}>
                    Injected into the HTML &lt;head&gt; of the main biztrack.bd website. Merchants verify their individual store domains separately in their merchant admin panel.
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

      {/* TAB 8: Platform SEO & Sitemaps (biztrack.bd) */}
      {activeTab === "seo" && (
        <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  Platform SEO & Dynamic Sitemaps (biztrack.bd)
                </h2>
                <span style={{ fontSize: 11, fontWeight: 700, background: "#EEF2FF", color: "#4F46E5", padding: "3px 8px", borderRadius: 6, textTransform: "uppercase" }}>
                  Apex Website
                </span>
              </div>
              <p style={{ color: "#4B4B73", margin: "4px 0 0 0", fontSize: 13.5 }}>
                Configure global search engine optimization, meta tags, OpenGraph social cards, search console verification, and live XML sitemaps for the <strong>biztrack.bd</strong> root landing website.
              </p>
            </div>
            {initialSeoConfig.updatedAt && (
              <span style={{ fontSize: 12, color: "#64748B", background: "#F1F5F9", padding: "4px 8px", borderRadius: 6 }}>
                Last updated {new Date(initialSeoConfig.updatedAt).toLocaleDateString()} {initialSeoConfig.updatedBy ? `by ${initialSeoConfig.updatedBy}` : ""}
              </span>
            )}
          </div>

          {/* Quick-Access Live Sitemaps & Robots */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 24 }}>
            <div style={{ padding: 14, borderRadius: 8, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Live XML Sitemap
                </span>
                <a
                  href={seoSitemapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: "#5B4FE8", textDecoration: "none", fontWeight: 600 }}
                >
                  Inspect XML ↗
                </a>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  readOnly
                  value={seoSitemapUrl}
                  style={{ flex: 1, padding: "8px 10px", fontSize: 12.5, fontFamily: "monospace", background: "#fff", border: "1px solid #CBD5E1", borderRadius: 6 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(seoSitemapUrl);
                    setCopiedField("sitemap");
                    setTimeout(() => setCopiedField(null), 2500);
                  }}
                  style={{ padding: "8px 14px", fontSize: 12.5, fontWeight: 600, background: "#fff", border: "1px solid #CBD5E1", borderRadius: 6, cursor: "pointer" }}
                >
                  {copiedField === "sitemap" ? "Copied! ✓" : "Copy"}
                </button>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#64748B" }}>
                Submit this URL to Google Search Console to index all biztrack.bd landing pages, tools, and blog.
              </p>
            </div>

            <div style={{ padding: 14, borderRadius: 8, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Robots.txt Crawler Directives
                </span>
                <a
                  href={seoRobotsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: "#5B4FE8", textDecoration: "none", fontWeight: 600 }}
                >
                  View Robots.txt ↗
                </a>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  readOnly
                  value={seoRobotsUrl}
                  style={{ flex: 1, padding: "8px 10px", fontSize: 12.5, fontFamily: "monospace", background: "#fff", border: "1px solid #CBD5E1", borderRadius: 6 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(seoRobotsUrl);
                    setCopiedField("robots");
                    setTimeout(() => setCopiedField(null), 2500);
                  }}
                  style={{ padding: "8px 14px", fontSize: 12.5, fontWeight: 600, background: "#fff", border: "1px solid #CBD5E1", borderRadius: 6, cursor: "pointer" }}
                >
                  {copiedField === "robots" ? "Copied! ✓" : "Copy"}
                </button>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#64748B" }}>
                Contains crawler allow/disallow instructions and points Googlebot directly to the sitemap index.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSaveSeo} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Meta Title */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#1F1F38" }}>
                  Root Meta Title (Homepage Title)
                </label>
                <span style={{ fontSize: 12, color: seoTitle.length > 60 ? "#DC2626" : "#64748B" }}>
                  {seoTitle.length} / 60 characters (Recommended: 50-60)
                </span>
              </div>
              <input
                type="text"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="BizTrackBD: Online Store Software for Bangladesh"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #D6D6E7", borderRadius: 8, fontSize: 14 }}
              />
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748B" }}>
                The clickable headline displayed on Google search results for biztrack.bd.
              </p>
            </div>

            {/* Meta Description */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#1F1F38" }}>
                  Root Meta Description
                </label>
                <span style={{ fontSize: 12, color: seoDescription.length > 160 ? "#DC2626" : "#64748B" }}>
                  {seoDescription.length} / 160 characters (Recommended: 140-160)
                </span>
              </div>
              <textarea
                rows={3}
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                placeholder="Launch your online store in a day. Sell with bKash, Nagad, and Cash on Delivery..."
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #D6D6E7", borderRadius: 8, fontSize: 13.5, resize: "vertical" }}
              />
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748B" }}>
                A compelling summary shown under your title in Google search results and shared social links.
              </p>
            </div>

            {/* Meta Keywords */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1F1F38", marginBottom: 6 }}>
                Meta Keywords (Comma-separated)
              </label>
              <input
                type="text"
                value={seoKeywords}
                onChange={(e) => setSeoKeywords(e.target.value)}
                placeholder="online store bangladesh, ecommerce website builder bangladesh, bkash payment gateway, steadfast courier integration"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #D6D6E7", borderRadius: 8, fontSize: 14 }}
              />
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748B" }}>
                Search indexing terms prioritized by search engines for regional ecommerce queries in Bangladesh.
              </p>
            </div>

            {/* OpenGraph Social Image URL */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1F1F38", marginBottom: 6 }}>
                Social Share Image (OpenGraph / Twitter Card Banner)
              </label>
              <input
                type="url"
                value={seoOgImage}
                onChange={(e) => setSeoOgImage(e.target.value)}
                placeholder="https://biztrack.bd/opengraph-image"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #D6D6E7", borderRadius: 8, fontSize: 14 }}
              />
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748B" }}>
                Preview image generated when biztrack.bd is shared on Facebook, WhatsApp, LinkedIn, or Twitter (1200x630px).
              </p>
              {seoOgImage && (
                <div style={{ marginTop: 8, padding: 8, background: "#F8FAFC", borderRadius: 8, display: "inline-block", border: "1px solid #E2E8F0" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 4 }}>Banner Preview:</span>
                  <img
                    src={seoOgImage}
                    alt="OpenGraph Banner Preview"
                    style={{ maxHeight: 120, maxWidth: "100%", borderRadius: 4, objectFit: "cover" }}
                    onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                  />
                </div>
              )}
            </div>

            {/* Google Search Console Verification */}
            <div style={{ borderTop: "1px solid #E7E7F0", paddingTop: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1F1F38", marginBottom: 6 }}>
                Google Search Console Verification (biztrack.bd)
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={seoSiteVerification}
                  onChange={(e) => setSeoSiteVerification(e.target.value)}
                  placeholder='google0668054f248577b1 or <meta name="google-site-verification" content="..." />'
                  style={{ flex: 1, padding: "10px 12px", border: "1px solid #D6D6E7", borderRadius: 8, fontSize: 13.5, fontFamily: "monospace" }}
                />
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748B" }}>
                Paste either the raw token or the full HTML verification meta tag provided by Google Search Console. It will be injected dynamically into the <code>&lt;head&gt;</code> of biztrack.bd.
              </p>
            </div>

            {/* Save Button */}
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
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
                {saving ? "Saving…" : "Save Platform SEO Configuration"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
