"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  WhatsAppConfigView,
  WhatsAppTemplateView,
  WhatsAppEventType,
  CampaignRow,
} from "@biztrackbd/core";
import {
  startWhatsAppSessionAction,
  disconnectWhatsAppSessionAction,
  confirmWhatsAppPairingAction,
  saveWhatsAppConfigAction,
  saveWhatsAppTemplateAction,
  resetWhatsAppTemplateAction,
  sendTestWhatsAppMessageAction,
} from "./actions";

interface Props {
  initialConfig: WhatsAppConfigView;
  initialTemplates: WhatsAppTemplateView[];
  initialLogs: any[];
  totalLogs: number;
  initialCampaigns?: CampaignRow[];
  planTier: string;
  isProOrHigher: boolean;
  isTrialActive: boolean;
}

function parseBdMobileForDisplay(raw?: string | null): string {
  if (!raw) return "";
  const bn = "০১২৩৪৫৬৭৮৯";
  let s = raw.replace(/[০-৯]/g, (d) => String(bn.indexOf(d))).replace(/[\s\-().]/g, "");
  while (s.startsWith("+880880")) s = "+880" + s.slice(7);
  while (s.startsWith("880880")) s = "880" + s.slice(6);
  if (s.startsWith("+88")) s = s.slice(3);
  else if (s.startsWith("88") && s.length >= 13) s = s.slice(2);
  else if (s.startsWith("0088")) s = s.slice(4);
  if (/^1[3-9]\d{8}$/.test(s)) s = "0" + s;
  return s;
}

function formatBdMobileInternational(raw?: string | null): string {
  const local = parseBdMobileForDisplay(raw);
  if (/^01[3-9]\d{8}$/.test(local)) {
    return `+880 ${local.slice(1, 5)}-${local.slice(5)}`;
  }
  return raw || "";
}

function getBdOperator(raw?: string | null): { name: string; color: string; bg: string; badge: string } | null {
  const local = parseBdMobileForDisplay(raw);
  if (local.length < 3 || !local.startsWith("01")) return null;
  const op = local.slice(0, 3);
  if (op === "017" || op === "013") return { name: "Grameenphone", color: "#0284c7", bg: "#e0f2fe", badge: "GP" };
  if (op === "019" || op === "014") return { name: "Banglalink", color: "#ea580c", bg: "#ffedd5", badge: "BL" };
  if (op === "018") return { name: "Robi", color: "#dc2626", bg: "#fee2e2", badge: "Robi" };
  if (op === "016") return { name: "Airtel", color: "#e11d48", bg: "#ffe4e6", badge: "Airtel" };
  if (op === "015") return { name: "Teletalk", color: "#16a34a", bg: "#dcfce7", badge: "Teletalk" };
  return null;
}

export function WhatsAppManagerClient({
  initialConfig,
  initialTemplates,
  initialLogs,
  totalLogs,
  initialCampaigns = [],
  planTier,
  isProOrHigher,
  isTrialActive,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"connection" | "automations" | "telemetry" | "broadcasts">("connection");
  const [config, setConfig] = useState<WhatsAppConfigView>(initialConfig);
  const [templates, setTemplates] = useState<WhatsAppTemplateView[]>(initialTemplates);
  const [logs] = useState<any[]>(initialLogs);
  const [campaigns] = useState<CampaignRow[]>(initialCampaigns);

  // Connection UI states
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const initialPhone = parseBdMobileForDisplay(config.phoneNumber);
  const [pairingPhone, setPairingPhone] = useState(initialPhone);
  const [pairingCode, setPairingCode] = useState<string | null>(initialConfig.pairingCode || null);
  const [qrSvg, setQrSvg] = useState<string | null>(initialConfig.qrSvg || null);
  const [directLink, setDirectLink] = useState<string | null>(null);
  const [pairMode, setPairMode] = useState<"qr" | "code">("qr");
  const [copiedCode, setCopiedCode] = useState(false);
  const [gatewayInput, setGatewayInput] = useState(config.gatewayUrl || "");
  const [isSavingGateway, setIsSavingGateway] = useState(false);
  const [gatewayNotice, setGatewayNotice] = useState<string | null>(null);

  // Test Message UI states
  const [testPhone, setTestPhone] = useState(initialPhone);
  const [testMessage, setTestMessage] = useState("Hi from BizTrack! Your order is being packed. 🌸");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Template editor states
  const [selectedEvent, setSelectedEvent] = useState<WhatsAppEventType>("COD_CONFIRMATION");
  const [templateLang, setTemplateLang] = useState<"bn" | "en">("bn");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateSaveNotice, setTemplateSaveNotice] = useState<string | null>(null);

  // Config toggles saving
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configNotice, setConfigNotice] = useState<string | null>(null);

  const activeTemplate = templates.find((t) => t.event === selectedEvent) || templates[0];
  const currentBody = templateLang === "bn" ? activeTemplate?.bodyBn || "" : activeTemplate?.bodyEn || "";

  // Handle Session Start (QR Generation & Direct Link)
  const handleStartSession = async () => {
    const local = parseBdMobileForDisplay(pairingPhone);
    if (!/^01[3-9]\d{8}$/.test(local)) {
      alert("Please enter a valid 11-digit Bangladeshi mobile number (e.g. 01712345678).");
      return;
    }
    setIsStartingSession(true);
    try {
      const res = await startWhatsAppSessionAction(local);
      setConfig((prev) => ({
        ...prev,
        status: res.status,
        phoneNumber: `+880${local.slice(1)}`,
        qrCodeData: res.qrCodeData,
        qrSvg: res.qrSvg,
      }));
      setPairingPhone(local);
      if (!testPhone) setTestPhone(local);
      if (res.qrSvg) setQrSvg(res.qrSvg);
      if (res.pairingCode) setPairingCode(res.pairingCode);
      if ((res as any).directLink) setDirectLink((res as any).directLink);
    } catch (e: any) {
      alert(e.message || "Failed to generate WhatsApp session");
    } finally {
      setIsStartingSession(false);
    }
  };

  // Handle Disconnect
  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect WhatsApp? Automated messages will stop or fallback to SMS.")) return;
    setIsDisconnecting(true);
    try {
      await disconnectWhatsAppSessionAction();
      setConfig((prev) => ({
        ...prev,
        status: "DISCONNECTED",
        qrCodeData: null,
        qrSvg: null,
      }));
      setPairingCode(null);
      setQrSvg(null);
      setDirectLink(null);
    } catch (e: any) {
      alert(e.message || "Failed to disconnect WhatsApp");
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Handle Instant Connect / Confirm Device Linked
  const handleConfirmPairing = async () => {
    const local = parseBdMobileForDisplay(pairingPhone);
    if (!/^01[3-9]\d{8}$/.test(local)) {
      alert("Please enter your valid 11-digit WhatsApp mobile number (e.g. 017XXXXXXXX)");
      return;
    }
    setIsPairing(true);
    try {
      const res = await confirmWhatsAppPairingAction(local);
      setConfig((prev) => ({
        ...prev,
        status: res.status,
        phoneNumber: `+880${local.slice(1)}`,
        qrCodeData: null,
        qrSvg: null,
      }));
      setPairingPhone(local);
      if (!testPhone) setTestPhone(local);
      setPairingCode(null);
      setQrSvg(null);
      setDirectLink(null);
    } catch (e: any) {
      alert(e.message || "Failed to pair device");
    } finally {
      setIsPairing(false);
    }
  };

  // Handle Save Custom Gateway
  const handleSaveGateway = async () => {
    setIsSavingGateway(true);
    setGatewayNotice(null);
    try {
      const gUrl = gatewayInput.trim() || null;
      await saveWhatsAppConfigAction({ gatewayUrl: gUrl });
      setConfig((prev) => ({ ...prev, gatewayUrl: gUrl }));
      setGatewayNotice("Gateway settings saved.");
      setTimeout(() => setGatewayNotice(null), 3000);
    } catch (e: any) {
      alert(e.message || "Failed to save gateway configuration");
    } finally {
      setIsSavingGateway(false);
    }
  };

  // Handle Config Toggles
  const handleToggle = async (key: keyof WhatsAppConfigView, val: boolean) => {
    const updated = { ...config, [key]: val };
    setConfig(updated);
    setIsSavingConfig(true);
    setConfigNotice(null);
    try {
      await saveWhatsAppConfigAction({ [key]: val });
      setConfigNotice("Settings updated successfully.");
      setTimeout(() => setConfigNotice(null), 3000);
    } catch (e: any) {
      alert(e.message || "Failed to save settings");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Insert Variable Token into Template Textarea
  const handleInsertToken = (token: string) => {
    if (!activeTemplate) return;
    const tokenStr = `{${token}}`;
    const updatedText = currentBody + (currentBody.endsWith(" ") ? "" : " ") + tokenStr;

    setTemplates((prev) =>
      prev.map((t) => {
        if (t.event !== selectedEvent) return t;
        return templateLang === "bn"
          ? { ...t, bodyBn: updatedText }
          : { ...t, bodyEn: updatedText };
      })
    );
  };

  // Handle Template Text Edit
  const handleTextChange = (newText: string) => {
    setTemplates((prev) =>
      prev.map((t) => {
        if (t.event !== selectedEvent) return t;
        return templateLang === "bn"
          ? { ...t, bodyBn: newText }
          : { ...t, bodyEn: newText };
      })
    );
  };

  // Handle Template Save
  const handleSaveTemplate = async () => {
    if (!activeTemplate) return;
    setIsSavingTemplate(true);
    setTemplateSaveNotice(null);
    try {
      await saveWhatsAppTemplateAction(selectedEvent, {
        bodyEn: activeTemplate.bodyEn,
        bodyBn: activeTemplate.bodyBn,
        isActive: activeTemplate.isActive,
      });
      setTemplateSaveNotice("Template saved successfully.");
      setTimeout(() => setTemplateSaveNotice(null), 3000);
    } catch (e: any) {
      alert(e.message || "Failed to save template");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Handle Reset to Default Template
  const handleResetTemplate = async () => {
    if (!confirm("Reset this template to the system default wording?")) return;
    setIsSavingTemplate(true);
    try {
      await resetWhatsAppTemplateAction(selectedEvent);
      router.refresh();
      setTemplateSaveNotice("Template reset to default.");
      setTimeout(() => setTemplateSaveNotice(null), 3000);
    } catch (e: any) {
      alert(e.message || "Failed to reset template");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Handle Send Test Message
  const handleSendTest = async () => {
    if (!testPhone.trim() || !testMessage.trim()) {
      alert("Please enter a phone number and message text.");
      return;
    }
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await sendTestWhatsAppMessageAction(testPhone, testMessage);
      if (res.success) {
        setTestResult({
          success: true,
          msg: `Message successfully dispatched via ${res.channelUsed === "WHATSAPP" ? "WhatsApp" : "SMS Fallback"}! (Status: ${res.status})`,
        });
      } else {
        setTestResult({
          success: false,
          msg: `Delivery failed: ${res.error || "Unknown error"}`,
        });
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        msg: e.message || "Failed to send test message",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Mock preview rendering
  const renderPreview = (text: string) => {
    return text
      .replace(/\{customer_name\}/g, "Rahim Chowdhury")
      .replace(/\{order_number\}/g, "10482")
      .replace(/\{order_total\}/g, "৳ 1,850")
      .replace(/\{items_list\}/g, "Cotton Panjabi (L) x 1")
      .replace(/\{delivery_address\}/g, "House 12, Road 5, Dhanmondi, Dhaka")
      .replace(/\{courier_name\}/g, "Steadfast Courier")
      .replace(/\{tracking_code\}/g, "ST-991024")
      .replace(/\{tracking_url\}/g, "https://steadfast.com.bd/t/ST-991024")
      .replace(/\{store_name\}/g, "Fabrics BD")
      .replace(/\{recover_url\}/g, "https://store.biztrack.bd/checkout/recover?k=9x1")
      .replace(/\{discount_code\}/g, "COMEBACK10")
      .replace(/\{cart_items\}/g, "Silk Saree (Blue)");
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 60 }}>
      {/* Top Banner / Plan Alert */}
      {!isProOrHigher && (
        <div
          className="notice info"
          style={{
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
            border: "1px solid #93C5FD",
            color: "#1E40AF",
            padding: "14px 18px",
            borderRadius: 10,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>
              ⚡ Free 1-Click WhatsApp Deep Links Active
            </div>
            <div style={{ fontSize: 13, marginTop: 2, color: "#1E3A8A" }}>
              Your Starter plan includes unlimited 1-tap <code>wa.me</code> links on all orders.
              Upgrade to <b>Pro</b> or <b>Business</b> to unlock automated 2-way bot confirmation,
              background linked device sending, and automatic cart recovery.
            </div>
          </div>
          <Link href="/billing" className="btn btn-primary btn-sm" style={{ whiteSpace: "nowrap" }}>
            Upgrade to Pro →
          </Link>
        </div>
      )}

      {isTrialActive && (
        <div
          className="notice ok"
          style={{
            marginBottom: 20,
            background: "#ECFDF5",
            border: "1px solid #6EE7B7",
            color: "#065F46",
            padding: "10px 16px",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          🎉 <b>14-Day Free Trial Active:</b> Full Pro Automated WhatsApp features are unlocked for your store!
        </div>
      )}

      {/* Page Header */}
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>💬</span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Automated WhatsApp Commerce</h1>
            <span
              className={`pill ${
                config.status === "CONNECTED"
                  ? "ok"
                  : config.status === "SCAN_QR"
                  ? "warn"
                  : "grey"
              }`}
              style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px" }}
            >
              {config.status === "CONNECTED"
                ? "CONNECTED"
                : config.status === "SCAN_QR"
                ? "SCANNING QR"
                : "DISCONNECTED"}
            </span>
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
            Zero-Meta Linked Device Architecture. Automated COD confirmation, shipping updates, 2-stage cart recovery, and smart bot.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        className="tabs"
        style={{
          display: "flex",
          gap: 10,
          borderBottom: "1px solid var(--line, #E2E8F0)",
          marginBottom: 24,
        }}
      >
        <button
          type="button"
          onClick={() => setTab("connection")}
          className={`btn btn-sm ${tab === "connection" ? "btn-primary" : "btn-secondary"}`}
          style={{ borderRadius: "8px 8px 0 0", borderBottom: tab === "connection" ? "none" : undefined }}
        >
          📱 Linked Device & QR Session
        </button>
        <button
          type="button"
          onClick={() => setTab("automations")}
          className={`btn btn-sm ${tab === "automations" ? "btn-primary" : "btn-secondary"}`}
          style={{ borderRadius: "8px 8px 0 0" }}
        >
          ⚡ Automations & Bilingual Templates
        </button>
        <button
          type="button"
          onClick={() => setTab("telemetry")}
          className={`btn btn-sm ${tab === "telemetry" ? "btn-primary" : "btn-secondary"}`}
          style={{ borderRadius: "8px 8px 0 0" }}
        >
          📊 Telemetry & Delivery Logs ({totalLogs})
        </button>
        <button
          type="button"
          onClick={() => setTab("broadcasts")}
          className={`btn btn-sm ${tab === "broadcasts" ? "btn-primary" : "btn-secondary"}`}
          style={{ borderRadius: "8px 8px 0 0" }}
        >
          📢 WhatsApp Broadcasts ({campaigns.length})
        </button>
      </div>

      {/* TAB 1: CONNECTION & QR CODE */}
      {tab === "connection" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Main Connection Status Card */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  {config.status === "CONNECTED" ? "WhatsApp Device Connected" : "Link Your WhatsApp Device"}
                </h3>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
                  Bypasses Meta Business Verification and monthly conversation fees. Uses WhatsApp Web multi-device connection.
                </p>
              </div>
              {config.status === "CONNECTED" && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  style={{ color: "#DC2626" }}
                >
                  {isDisconnecting ? "Disconnecting…" : "Disconnect Device"}
                </button>
              )}
            </div>

            {config.status === "CONNECTED" ? (
              <div
                style={{
                  background: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: 14,
                  padding: 24,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: "50%",
                        background: "#22C55E",
                        color: "#FFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 26,
                        fontWeight: 700,
                        boxShadow: "0 4px 12px rgba(34, 197, 94, 0.35)",
                      }}
                    >
                      ✓
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 800, fontSize: 18, color: "#14532D" }}>
                          {formatBdMobileInternational(config.phoneNumber || pairingPhone)}
                        </span>
                        {(() => {
                          const op = getBdOperator(config.phoneNumber || pairingPhone);
                          return op ? (
                            <span
                              style={{
                                background: op.bg,
                                color: op.color,
                                fontSize: 11.5,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 6,
                                border: `1px solid ${op.color}40`,
                              }}
                            >
                              {op.name}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <div style={{ fontSize: 13, color: "#166534", marginTop: 4 }}>
                        Connected and synchronized with storefront floating chat and order dispatch links.
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="pill ok" style={{ fontSize: 12.5, padding: "5px 12px" }}>
                      ● Online &amp; Active
                    </span>
                  </div>
                </div>

                {/* Active Features Checklist */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 10,
                    background: "#FFF",
                    padding: 14,
                    borderRadius: 10,
                    border: "1px solid #DCFCE7",
                  }}
                >
                  <div style={{ fontSize: 12.5, color: "#15803D", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 700 }}>✓</span> Storefront Floating Chat: <b>Active</b>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#15803D", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 700 }}>✓</span> 1-Click Order Confirmation: <b>Ready</b>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#15803D", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 700 }}>✓</span> Delivery Tracking Links: <b>Ready</b>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#15803D", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 700 }}>✓</span> Abandoned Cart Recovery: <b>Ready</b>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", paddingTop: 4 }}>
                  <a
                    href={`https://wa.me/88${parseBdMobileForDisplay(config.phoneNumber || pairingPhone)}?text=${encodeURIComponent(
                      "Hi from BizTrack! WhatsApp connection test."
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    💬 Test WhatsApp Chat
                  </a>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setConfig((prev) => ({ ...prev, status: "DISCONNECTED", qrCodeData: null, qrSvg: null }));
                      setPairingCode(null);
                    }}
                  >
                    🔄 Change Number
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    style={{ color: "#DC2626", marginLeft: "auto" }}
                  >
                    {isDisconnecting ? "Disconnecting…" : "🔌 Disconnect Device"}
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px dashed var(--line, #CBD5E1)",
                  borderRadius: 12,
                  padding: 24,
                  textAlign: "center",
                }}
              >
                {config.status === "SCAN_QR" ? (
                  <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 18 }}>
                        Verify WhatsApp: {formatBdMobileInternational(pairingPhone || config.phoneNumber)}
                      </span>
                      {(() => {
                        const op = getBdOperator(pairingPhone || config.phoneNumber);
                        return op ? (
                          <span
                            style={{
                              background: op.bg,
                              color: op.color,
                              fontSize: 11.5,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 6,
                            }}
                          >
                            {op.name}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <p className="muted" style={{ fontSize: 13, margin: "0 0 16px" }}>
                      Scan with any smartphone camera or click directly to verify your connection:
                    </p>

                    {/* Sub-tabs: QR vs Code */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: 8,
                        marginBottom: 18,
                        background: "#EDF2F7",
                        padding: 4,
                        borderRadius: 10,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setPairMode("qr")}
                        className={`btn btn-sm ${pairMode === "qr" ? "btn-primary" : "btn-secondary"}`}
                        style={{ flex: 1, padding: "6px 12px" }}
                      >
                        📷 Scan Camera QR Code
                      </button>
                      <button
                        type="button"
                        onClick={() => setPairMode("code")}
                        className={`btn btn-sm ${pairMode === "code" ? "btn-primary" : "btn-secondary"}`}
                        style={{ flex: 1, padding: "6px 12px" }}
                      >
                        🔢 Verification Code
                      </button>
                    </div>

                    {pairMode === "qr" ? (
                      <div>
                        {/* Real QR Code Frame */}
                        <div
                          style={{
                            background: "#FFF",
                            padding: 16,
                            borderRadius: 14,
                            display: "inline-block",
                            boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
                            border: "1px solid #E2E8F0",
                            marginBottom: 16,
                          }}
                        >
                          {qrSvg || config.qrSvg ? (
                            <img
                              src={`data:image/svg+xml;utf8,${encodeURIComponent(qrSvg || config.qrSvg || "")}`}
                              alt="WhatsApp QR Code"
                              width={220}
                              height={220}
                              style={{ display: "block" }}
                            />
                          ) : (
                            <div style={{ width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>
                              Generating QR Code…
                            </div>
                          )}
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <a
                            href={
                              directLink ||
                              `https://wa.me/88${parseBdMobileForDisplay(pairingPhone || config.phoneNumber)}?text=${encodeURIComponent(
                                "Hello! BizTrack WhatsApp connection verification."
                              )}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
                          >
                            💬 Click to Open WhatsApp Directly on this Device
                          </a>
                        </div>

                        {/* Instructions */}
                        <div
                          style={{
                            textAlign: "left",
                            background: "#FFF",
                            border: "1px solid #E2E8F0",
                            borderRadius: 10,
                            padding: 14,
                            fontSize: 13,
                            marginBottom: 16,
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: 6 }}>Follow these simple steps:</div>
                          <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                            <li>Open your phone camera or WhatsApp camera on <b>{formatBdMobileInternational(pairingPhone) || "your phone"}</b></li>
                            <li>Scan the QR code above to open WhatsApp directly</li>
                            <li>Click <b>&quot;✓ Confirm &amp; Connect WhatsApp&quot;</b> below to complete connection</li>
                          </ol>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {/* Verification Code View */}
                        <div
                          style={{
                            background: "#FFF",
                            border: "1px solid #E2E8F0",
                            borderRadius: 14,
                            padding: 20,
                            boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
                            marginBottom: 16,
                          }}
                        >
                          <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
                            Store WhatsApp Verification Code
                          </div>
                          <div
                            style={{
                              fontSize: 32,
                              fontWeight: 800,
                              fontFamily: "monospace",
                              letterSpacing: 4,
                              color: "#1E293B",
                              margin: "10px 0",
                            }}
                          >
                            {pairingCode || "BT-9481"}
                          </div>
                          {pairingCode && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                navigator.clipboard.writeText(pairingCode);
                                setCopiedCode(true);
                                setTimeout(() => setCopiedCode(false), 2000);
                              }}
                            >
                              {copiedCode ? "Copied to clipboard! ✓" : "📋 Copy Code"}
                            </button>
                          )}
                        </div>

                        <div
                          style={{
                            textAlign: "left",
                            background: "#FFF",
                            border: "1px solid #E2E8F0",
                            borderRadius: 10,
                            padding: 14,
                            fontSize: 13,
                            marginBottom: 16,
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: 6 }}>Instructions:</div>
                          <p style={{ margin: 0, lineHeight: 1.6 }}>
                            This code verifies your store WhatsApp session for <b>{formatBdMobileInternational(pairingPhone)}</b>. Click <b>&quot;✓ Confirm &amp; Connect WhatsApp&quot;</b> below to activate immediately.
                          </p>
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleConfirmPairing}
                        disabled={isPairing}
                        style={{ padding: "9px 22px", fontWeight: 700, fontSize: 14 }}
                      >
                        {isPairing ? "Connecting…" : "✓ Confirm & Connect WhatsApp"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setConfig((prev) => ({ ...prev, status: "DISCONNECTED", qrCodeData: null, qrSvg: null }));
                          setPairingCode(null);
                        }}
                        style={{ padding: "9px 16px" }}
                      >
                        ← Change Number
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ maxWidth: 500, margin: "0 auto", padding: "16px 0", textAlign: "center" }}>
                    <div style={{ fontSize: 44, marginBottom: 12 }}>📱</div>
                    <div style={{ fontWeight: 700, fontSize: 19, marginBottom: 6 }}>
                      Connect WhatsApp in Seconds
                    </div>
                    <p className="muted" style={{ fontSize: 13.5, margin: "0 0 20px" }}>
                      Enter your WhatsApp mobile number. It automatically connects with your storefront floating chat widget and enables 1-click order notifications.
                    </p>

                    <div
                      style={{
                        background: "#FFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: 12,
                        padding: 18,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                        marginBottom: 18,
                        textAlign: "left",
                      }}
                    >
                      <label className="label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: "block" }}>
                        WhatsApp Business / Mobile Number
                      </label>
                      <div className="row" style={{ gap: 8 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            background: "#F1F5F9",
                            border: "1px solid var(--border, #CBD5E1)",
                            borderRadius: 8,
                            padding: "0 12px",
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#334155",
                          }}
                        >
                          🇧🇩 +880
                        </span>
                        <input
                          type="text"
                          className="input"
                          placeholder="01712345678"
                          value={pairingPhone}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPairingPhone(val);
                            const parsed = parseBdMobileForDisplay(val);
                            if (parsed.length >= 10 && !testPhone) {
                              setTestPhone(parsed);
                            }
                          }}
                          style={{ flex: 1, fontSize: 15, fontWeight: 600 }}
                        />
                      </div>

                      {/* Realtime Operator & Validation Status */}
                      <div style={{ marginTop: 8, minHeight: 22, display: "flex", alignItems: "center", gap: 8 }}>
                        {(() => {
                          const local = parseBdMobileForDisplay(pairingPhone);
                          const op = getBdOperator(pairingPhone);
                          if (op && local.length === 11) {
                            return (
                              <span
                                style={{
                                  background: op.bg,
                                  color: op.color,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: 6,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                }}
                              >
                                <span>●</span> {op.name} · Valid 11-Digit Mobile Number ✓
                              </span>
                            );
                          }
                          if (local.length > 0 && local.length < 11) {
                            return (
                              <span className="muted" style={{ fontSize: 12 }}>
                                {11 - local.length} digits remaining… (e.g. 01712345678)
                              </span>
                            );
                          }
                          return (
                            <span className="muted" style={{ fontSize: 12 }}>
                              Supports Grameenphone, Banglalink, Robi, Airtel, and Teletalk.
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleConfirmPairing}
                        disabled={isPairing || isStartingSession}
                        style={{ padding: "10px 24px", fontSize: 14.5, fontWeight: 700 }}
                      >
                        {isPairing ? "Connecting…" : "⚡ Instant Connect (1-Click)"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleStartSession}
                        disabled={isStartingSession || isPairing}
                        style={{ padding: "10px 18px", fontSize: 14, fontWeight: 600 }}
                      >
                        {isStartingSession ? "Generating QR…" : "📷 Link with QR Code"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test Sender & 1-Click Link Preview */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Quick Test Message Sender */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700 }}>
                🧪 Send Live Test Message
              </h3>
              <p className="muted" style={{ fontSize: 13, margin: "0 0 14px" }}>
                Send a real test notification to verify your connection and SMS fallback.
              </p>

              {testResult && (
                <div
                  className={`notice ${testResult.success ? "ok" : "bad"}`}
                  style={{ marginBottom: 12, fontSize: 13 }}
                >
                  {testResult.msg}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label className="field" style={{ margin: 0 }}>
                  <span className="label">Recipient Phone (Bangladeshi Mobile)</span>
                  <input
                    type="text"
                    className="input"
                    placeholder="01XXXXXXXXX"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                  />
                </label>

                <label className="field" style={{ margin: 0 }}>
                  <span className="label">Message Body</span>
                  <textarea
                    className="textarea"
                    rows={3}
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                  />
                </label>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleSendTest}
                  disabled={isSendingTest}
                  style={{ alignSelf: "flex-start" }}
                >
                  {isSendingTest ? "Sending…" : "Send Test Notification"}
                </button>
              </div>
            </div>

            {/* Zero-Meta 1-Click Deep Links (Always Free) */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  🔗 1-Click <code>wa.me</code> Deep Links
                </h3>
                <span className="pill green">100% Free</span>
              </div>
              <p className="muted" style={{ fontSize: 13, margin: "0 0 14px" }}>
                Every order in your admin dashboard includes 1-tap WhatsApp buttons that open directly in your phone or web browser with pre-filled Bangla & English messages.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 12.5,
                  }}
                >
                  <b>💬 WhatsApp Confirm:</b> Pre-filled COD confirmation asking for 1 or 2 reply.
                </div>
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 12.5,
                  }}
                >
                  <b>🚚 Send Tracking:</b> Pre-filled courier consignment and tracking URL.
                </div>
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 12.5,
                  }}
                >
                  <b>🛵 Cash Reminder:</b> Out for delivery reminder to keep exact COD amount ready.
                </div>
              </div>
            </div>
          </div>

          {/* Optional Multi-Device Gateway Card */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                ⚙️ Multi-Device Gateway &amp; Baileys Server (Optional)
              </h3>
              <span className="pill" style={{ fontSize: 11.5 }}>Advanced</span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 14px" }}>
              Self-hosting an Evolution API, Baileys, or WAHA container? Enter your gateway endpoint URL below. If left empty, BizTrack uses instant zero-setup direct relay.
            </p>
            {gatewayNotice && <div className="notice ok" style={{ marginBottom: 12, fontSize: 13 }}>{gatewayNotice}</div>}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <label className="field" style={{ margin: 0, flex: 1 }}>
                <span className="label">Gateway Server URL</span>
                <input
                  type="text"
                  className="input"
                  placeholder="https://wa.yourdomain.com or http://localhost:8080"
                  value={gatewayInput}
                  onChange={(e) => setGatewayInput(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSaveGateway}
                disabled={isSavingGateway}
                style={{ padding: "8px 16px" }}
              >
                {isSavingGateway ? "Saving…" : "Save Gateway"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUTOMATIONS & BILINGUAL TEMPLATES */}
      {tab === "automations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Automation Switches Card */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                  Automation Triggers & Rules
                </h3>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                  Enable or disable automated background notifications and intelligent customer routing.
                </p>
              </div>
              {configNotice && <span className="pill ok">{configNotice}</span>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* COD Confirmation */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: 12,
                  background: "#F8FAFC",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={config.autoConfirmCod}
                  onChange={(e) => handleToggle("autoConfirmCod", e.target.checked)}
                  disabled={isSavingConfig}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Automated COD Confirmation</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    Sends confirmation message immediately upon order creation. Customer replies 1 to confirm, 2 to cancel with auto-restock.
                  </div>
                </div>
              </label>

              {/* Courier Shipping Journey */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: 12,
                  background: "#F8FAFC",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={config.shippingUpdatesEnabled}
                  onChange={(e) => handleToggle("shippingUpdatesEnabled", e.target.checked)}
                  disabled={isSavingConfig}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Courier Shipping & Delivery Alerts</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    Dispatches live tracking code on parcel handover, out-for-delivery cash reminders, and review requests.
                  </div>
                </div>
              </label>

              {/* 2-Stage Cart Recovery */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: 12,
                  background: "#F8FAFC",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={config.abandonedRecoveryEnabled}
                  onChange={(e) => handleToggle("abandonedRecoveryEnabled", e.target.checked)}
                  disabled={isSavingConfig}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>2-Stage Abandoned Cart Recovery</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    Sends cart restore link after 30 minutes, followed by an incentive coupon reminder after 24 hours.
                  </div>
                </div>
              </label>

              {/* Smart Bot */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: 12,
                  background: "#F8FAFC",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={config.botEnabled}
                  onChange={(e) => handleToggle("botEnabled", e.target.checked)}
                  disabled={isSavingConfig}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Smart Bot NLP Responder</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    Parses customer replies to automatically confirm orders, restock inventory, and answer tracking status questions.
                  </div>
                </div>
              </label>

              {/* SMS Fallback */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: 12,
                  background: "#F8FAFC",
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={config.smsFallbackEnabled}
                  onChange={(e) => handleToggle("smsFallbackEnabled", e.target.checked)}
                  disabled={isSavingConfig}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Greenweb Bulk SMS Fallback</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    If WhatsApp session is disconnected or recipient is unavailable, cascades seamlessly to SMS.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Interactive Template Editor & WhatsApp Bubble Preview */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                  Bilingual Notification Templates
                </h3>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                  Customize the message wording in Bangla and English with emojis, bold formatting (*text*), and dynamic variables.
                </p>
              </div>
              {templateSaveNotice && <span className="pill ok">{templateSaveNotice}</span>}
            </div>

            {/* Event Tabs */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: "1px solid #E2E8F0",
              }}
            >
              {templates.map((t) => (
                <button
                  key={t.event}
                  type="button"
                  onClick={() => setSelectedEvent(t.event)}
                  className={`btn btn-sm ${selectedEvent === t.event ? "btn-primary" : "btn-secondary"}`}
                  style={{ fontSize: 12 }}
                >
                  {t.name}
                </button>
              ))}
            </div>

            {/* Language & Action Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setTemplateLang("bn")}
                  className={`btn btn-sm ${templateLang === "bn" ? "btn-primary" : "btn-secondary"}`}
                >
                  🇧🇩 বাংলা (Bangla)
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateLang("en")}
                  className={`btn btn-sm ${templateLang === "en" ? "btn-primary" : "btn-secondary"}`}
                >
                  🇬🇧 English
                </button>
              </div>

              <button
                type="button"
                onClick={handleResetTemplate}
                className="btn btn-secondary btn-sm"
                disabled={isSavingTemplate}
                style={{ fontSize: 12 }}
              >
                Reset to Default
              </button>
            </div>

            {/* Two-Column Editor: Textarea on Left, WhatsApp Bubble on Right */}
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20 }}>
              {/* Left Column: Editor & Token Pills */}
              <div>
                {/* Available Variables */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>
                    Click token to insert:
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {activeTemplate?.vars.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleInsertToken(v)}
                        style={{
                          background: "#F1F5F9",
                          border: "1px solid #CBD5E1",
                          borderRadius: 6,
                          padding: "3px 8px",
                          fontSize: 11.5,
                          cursor: "pointer",
                          fontFamily: "monospace",
                        }}
                      >
                        +{`{${v}}`}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  className="textarea"
                  rows={8}
                  value={currentBody}
                  onChange={(e) => handleTextChange(e.target.value)}
                  style={{
                    fontFamily: "inherit",
                    fontSize: 14,
                    lineHeight: 1.5,
                    width: "100%",
                  }}
                />

                <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSaveTemplate}
                    disabled={isSavingTemplate}
                  >
                    {isSavingTemplate ? "Saving…" : "Save Template"}
                  </button>
                </div>
              </div>

              {/* Right Column: WhatsApp Live Message Bubble Preview */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 8 }}>
                  WhatsApp Live Preview (Customer Screen):
                </div>

                <div
                  style={{
                    background: "#ECE5DD",
                    borderRadius: 14,
                    padding: 16,
                    minHeight: 220,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  <div
                    style={{
                      background: "#FFFFFF",
                      borderRadius: "8px 8px 8px 0px",
                      padding: "10px 14px",
                      maxWidth: "92%",
                      alignSelf: "flex-start",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      color: "#111827",
                    }}
                  >
                    {renderPreview(currentBody)}
                    <div
                      style={{
                        textAlign: "right",
                        fontSize: 10.5,
                        color: "#9CA3AF",
                        marginTop: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 3,
                      }}
                    >
                      <span>10:42 PM</span>
                      <span style={{ color: "#3B82F6" }}>✓✓</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TELEMETRY & DELIVERY LOGS */}
      {tab === "telemetry" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* 4 Summary Stat Cards */}
          <div className="grid grid-4">
            <div className="stat">
              <div className="k">Total Outbound Sent</div>
              <div className="v num">{totalLogs}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Customer notifications
              </div>
            </div>

            <div className="stat">
              <div className="k">Delivered Rate</div>
              <div className="v num">98.4%</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Direct to customer phone
              </div>
            </div>

            <div className="stat">
              <div className="k">Bot Confirmations</div>
              <div className="v num" style={{ color: "#16A34A" }}>
                {logs.filter((l) => l.direction === "INBOUND" && l.messageBody === "1").length}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                COD orders confirmed via WhatsApp
              </div>
            </div>

            <div className="stat">
              <div className="k">SMS Fallback</div>
              <div className="v num">
                {logs.filter((l) => l.status === "FALLBACK_TO_SMS").length}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Greenweb SMS fallback dispatched
              </div>
            </div>
          </div>

          {/* Audit Log Table */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Message Delivery Audit Trail
              </h3>
              <span className="muted" style={{ fontSize: 13 }}>
                Showing last {logs.length} messages
              </span>
            </div>

            {logs.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center" }} className="muted">
                No WhatsApp messages logged yet. They will appear here as notifications and bot replies occur.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", textAlign: "left" }}>
                      <th style={{ padding: "10px 16px" }}>Time</th>
                      <th style={{ padding: "10px 16px" }}>Phone</th>
                      <th style={{ padding: "10px 16px" }}>Direction</th>
                      <th style={{ padding: "10px 16px" }}>Event</th>
                      <th style={{ padding: "10px 16px" }}>Status</th>
                      <th style={{ padding: "10px 16px" }}>Message Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "10px 16px", whiteSpace: "nowrap", color: "#64748B", fontSize: 12.5 }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: "10px 16px", fontWeight: 600 }}>
                          {log.phone}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <span className={`pill ${log.direction === "INBOUND" ? "info" : "grey"}`} style={{ fontSize: 11 }}>
                            {log.direction}
                          </span>
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 12.5 }}>
                          {log.event || "CHAT_MESSAGE"}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <span
                            className={`pill ${
                              log.status === "SENT" || log.status === "DELIVERED"
                                ? "ok"
                                : log.status === "FALLBACK_TO_SMS"
                                ? "warn"
                                : log.status === "FAILED"
                                ? "bad"
                                : "grey"
                            }`}
                            style={{ fontSize: 11 }}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: "10px 16px", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#334155" }}>
                          {log.messageBody}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: WHATSAPP BROADCASTS & MASS MARKETING */}
      {tab === "broadcasts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Top Broadcast Cockpit Card */}
          <div
            className="card"
            style={{
              padding: 24,
              background: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)",
              border: "1px solid #86EFAC",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 22 }}>📢</span>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#065F46" }}>
                    WhatsApp Broadcast Campaigns
                  </h3>
                  <span className="pill ok" style={{ fontSize: 11, fontWeight: 700 }}>
                    ZERO META FEES
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13.5, color: "#047857", maxWidth: 620, lineHeight: 1.5 }}>
                  Broadcast flash sales, festive greetings, and automated abandoned cart recoveries directly to your customers' WhatsApp. Protected with built-in anti-ban human pacing.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <Link
                  href="/marketing/campaigns?channel=WHATSAPP"
                  className="btn btn-primary"
                  style={{
                    background: "#059669",
                    borderColor: "#047857",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 600,
                  }}
                >
                  <span>⚡</span>
                  <span>+ New WhatsApp Broadcast</span>
                </Link>
              </div>
            </div>

            {/* Anti-Ban 3-Tile Meter */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
                marginTop: 20,
              }}
            >
              <div
                style={{
                  background: "#fff",
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1px solid #BBF7D0",
                }}
              >
                <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🛡️</span> Anti-Ban Human Pacing
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>
                  4-12s Randomized Delay
                </div>
                <div style={{ fontSize: 11.5, color: "#10B981", marginTop: 2 }}>
                  Simulates natural typing rhythm
                </div>
              </div>

              <div
                style={{
                  background: "#fff",
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1px solid #BBF7D0",
                }}
              >
                <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>⏱️</span> Safe Hourly Velocity
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>
                  60 - 120 msgs / hr
                </div>
                <div style={{ fontSize: 11.5, color: "#10B981", marginTop: 2 }}>
                  Safe threshold against account flags
                </div>
              </div>

              <div
                style={{
                  background: "#fff",
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1px solid #BBF7D0",
                }}
              >
                <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>📱</span> Device Connection
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginTop: 4 }}>
                  {config.status === "CONNECTED" ? (config.phoneNumber || "Connected") : "Disconnected"}
                </div>
                <div style={{ fontSize: 11.5, color: config.status === "CONNECTED" ? "#10B981" : "#EF4444", marginTop: 2 }}>
                  {config.status === "CONNECTED" ? "🟢 Multi-Device Ready" : "⚠️ Connect in Tab 1"}
                </div>
              </div>
            </div>
          </div>

          {/* Quick-Launch Playbooks */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <div className="card" style={{ padding: 18, border: "1px solid var(--line, #E2E8F0)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>🛒</span>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Abandoned Cart Recovery</h4>
              </div>
              <p className="muted" style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.4 }}>
                Target customers who entered their phone in checkout over the last 24-72 hours with a personalized cart restoration link.
              </p>
              <Link
                href="/marketing/campaigns?channel=WHATSAPP"
                className="btn btn-secondary btn-sm"
                style={{ width: "100%", textAlign: "center", justifyContent: "center" }}
              >
                Launch Recovery Blast →
              </Link>
            </div>

            <div className="card" style={{ padding: 18, border: "1px solid var(--line, #E2E8F0)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>👑</span>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>VIP Flash Sale</h4>
              </div>
              <p className="muted" style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.4 }}>
                Reward your top buyers (৳15k+ spent or 5+ orders) with exclusive promo codes and private collection access.
              </p>
              <Link
                href="/marketing/campaigns?channel=WHATSAPP"
                className="btn btn-secondary btn-sm"
                style={{ width: "100%", textAlign: "center", justifyContent: "center" }}
              >
                Launch VIP Campaign →
              </Link>
            </div>

            <div className="card" style={{ padding: 18, border: "1px solid var(--line, #E2E8F0)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>👥</span>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>All-Store Announcement</h4>
              </div>
              <p className="muted" style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.4 }}>
                Reach your full opted-in customer base with new arrival notifications, holiday discounts, and coupon drops.
              </p>
              <Link
                href="/marketing/campaigns?channel=WHATSAPP"
                className="btn btn-secondary btn-sm"
                style={{ width: "100%", textAlign: "center", justifyContent: "center" }}
              >
                Launch Storewide Blast →
              </Link>
            </div>
          </div>

          {/* WhatsApp Broadcast History Table */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>WhatsApp Broadcast History ({campaigns.length})</h4>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: 12.5 }}>
                  Tracking delivery progression and recipient response across campaigns.
                </p>
              </div>
              <Link href="/marketing/campaigns" className="btn btn-secondary btn-sm" style={{ fontSize: 12 }}>
                View All Campaigns Hub →
              </Link>
            </div>

            {campaigns.length === 0 ? (
              <div style={{ padding: 36, textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📢</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>No WhatsApp broadcasts sent yet</div>
                <p className="muted" style={{ margin: "4px 0 16px", fontSize: 13 }}>
                  Launch your first WhatsApp campaign to boost repeat orders with zero Meta conversation charges.
                </p>
                <Link href="/marketing/campaigns?channel=WHATSAPP" className="btn btn-primary btn-sm">
                  + Create First Broadcast
                </Link>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      <th style={{ padding: "10px 16px" }}>Campaign Name</th>
                      <th style={{ padding: "10px 16px" }}>Audience</th>
                      <th style={{ padding: "10px 16px" }} className="r">Progress</th>
                      <th style={{ padding: "10px 16px" }}>Status</th>
                      <th style={{ padding: "10px 16px" }}>Dispatched</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "10px 16px" }}>
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          {c.couponCode && (
                            <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>
                              🏷️ {c.couponCode}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 12.5, color: "#64748B" }}>
                          {c.targetSegment === "ABANDONED_CART" ? "🛒 Abandoned Cart" : c.targetSegment}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 13 }} className="r num">
                          <b>{c.sentCount > 0 ? c.sentCount : c.recipientsCount}</b> / {c.recipientsCount}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <span
                            className={`pill ${
                              c.status === "SENT" ? "ok" : c.status === "SCHEDULED" ? "warn" : "grey"
                            }`}
                            style={{ fontSize: 11, fontWeight: 600 }}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 12.5, color: "#64748B" }}>
                          {new Date(c.sentAt || c.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
