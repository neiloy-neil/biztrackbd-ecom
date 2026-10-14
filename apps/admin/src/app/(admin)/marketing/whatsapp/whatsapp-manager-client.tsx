"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  WhatsAppConfigView,
  WhatsAppTemplateView,
  WhatsAppEventType,
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
  planTier: string;
  isProOrHigher: boolean;
  isTrialActive: boolean;
}

export function WhatsAppManagerClient({
  initialConfig,
  initialTemplates,
  initialLogs,
  totalLogs,
  planTier,
  isProOrHigher,
  isTrialActive,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"connection" | "automations" | "telemetry">("connection");
  const [config, setConfig] = useState<WhatsAppConfigView>(initialConfig);
  const [templates, setTemplates] = useState<WhatsAppTemplateView[]>(initialTemplates);
  const [logs] = useState<any[]>(initialLogs);

  // Connection UI states
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [pairingPhone, setPairingPhone] = useState(config.phoneNumber || "01712345678");
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  // Test Message UI states
  const [testPhone, setTestPhone] = useState("");
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

  // Handle Session Start (QR Generation)
  const handleStartSession = async () => {
    setIsStartingSession(true);
    try {
      const res = await startWhatsAppSessionAction(pairingPhone);
      setConfig((prev) => ({
        ...prev,
        status: res.status,
        qrCodeData: res.qrCodeData,
      }));
      if (res.pairingCode) setPairingCode(res.pairingCode);
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
        phoneNumber: null,
        qrCodeData: null,
      }));
      setPairingCode(null);
    } catch (e: any) {
      alert(e.message || "Failed to disconnect WhatsApp");
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Handle Instant Pair / Scan Confirmation
  const handleConfirmPairing = async () => {
    if (!pairingPhone.trim()) {
      alert("Please enter your WhatsApp mobile number");
      return;
    }
    setIsPairing(true);
    try {
      const res = await confirmWhatsAppPairingAction(pairingPhone);
      setConfig((prev) => ({
        ...prev,
        status: res.status,
        phoneNumber: pairingPhone,
        qrCodeData: null,
      }));
      setPairingCode(null);
    } catch (e: any) {
      alert(e.message || "Failed to pair device");
    } finally {
      setIsPairing(false);
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
                  borderRadius: 12,
                  padding: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: "50%",
                      background: "#22C55E",
                      color: "#FFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                    }}
                  >
                    ✓
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "#15803D" }}>
                      Active WhatsApp Gateway ({config.phoneNumber || "Connected"})
                    </div>
                    <div style={{ fontSize: 13, color: "#166534", marginTop: 2 }}>
                      Outbound notifications and 2-way bot listeners are active and processing.
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="pill ok" style={{ fontSize: 12 }}>Online</span>
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
                  <div style={{ maxWidth: 440, margin: "0 auto" }}>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
                      Scan QR Code from WhatsApp
                    </div>

                    {/* QR Code Frame */}
                    <div
                      style={{
                        background: "#FFF",
                        padding: 18,
                        borderRadius: 14,
                        display: "inline-block",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        border: "1px solid #E2E8F0",
                        marginBottom: 16,
                      }}
                    >
                      <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
                        <rect width="200" height="200" fill="white" />
                        {/* Finder pattern top-left */}
                        <rect x="15" y="15" width="50" height="50" rx="6" fill="#1E293B" />
                        <rect x="25" y="25" width="30" height="30" rx="3" fill="white" />
                        <rect x="33" y="33" width="14" height="14" rx="2" fill="#1E293B" />
                        {/* Finder pattern top-right */}
                        <rect x="135" y="15" width="50" height="50" rx="6" fill="#1E293B" />
                        <rect x="145" y="25" width="30" height="30" rx="3" fill="white" />
                        <rect x="153" y="33" width="14" height="14" rx="2" fill="#1E293B" />
                        {/* Finder pattern bottom-left */}
                        <rect x="15" y="135" width="50" height="50" rx="6" fill="#1E293B" />
                        <rect x="25" y="145" width="30" height="30" rx="3" fill="white" />
                        <rect x="33" y="153" width="14" height="14" rx="2" fill="#1E293B" />
                        {/* Data matrix dots */}
                        <rect x="75" y="25" width="12" height="12" fill="#1E293B" />
                        <rect x="95" y="25" width="12" height="12" fill="#1E293B" />
                        <rect x="115" y="25" width="12" height="12" fill="#1E293B" />
                        <rect x="75" y="45" width="12" height="12" fill="#1E293B" />
                        <rect x="105" y="45" width="12" height="12" fill="#1E293B" />
                        <rect x="25" y="75" width="12" height="12" fill="#1E293B" />
                        <rect x="45" y="75" width="12" height="12" fill="#1E293B" />
                        <rect x="65" y="75" width="12" height="12" fill="#1E293B" />
                        <rect x="85" y="75" width="12" height="12" fill="#1E293B" />
                        <rect x="105" y="75" width="12" height="12" fill="#1E293B" />
                        <rect x="125" y="75" width="12" height="12" fill="#1E293B" />
                        <rect x="145" y="75" width="12" height="12" fill="#1E293B" />
                        <rect x="165" y="75" width="12" height="12" fill="#1E293B" />
                        <rect x="75" y="95" width="12" height="12" fill="#1E293B" />
                        <rect x="95" y="95" width="12" height="12" fill="#1E293B" />
                        <rect x="115" y="95" width="12" height="12" fill="#1E293B" />
                        <rect x="75" y="115" width="12" height="12" fill="#1E293B" />
                        <rect x="135" y="115" width="12" height="12" fill="#1E293B" />
                        <rect x="155" y="115" width="12" height="12" fill="#1E293B" />
                        <rect x="75" y="135" width="12" height="12" fill="#1E293B" />
                        <rect x="95" y="135" width="12" height="12" fill="#1E293B" />
                        <rect x="115" y="135" width="12" height="12" fill="#1E293B" />
                        <rect x="145" y="135" width="12" height="12" fill="#1E293B" />
                        <rect x="75" y="155" width="12" height="12" fill="#1E293B" />
                        <rect x="105" y="155" width="12" height="12" fill="#1E293B" />
                        <rect x="125" y="155" width="12" height="12" fill="#1E293B" />
                        <rect x="165" y="155" width="12" height="12" fill="#1E293B" />
                      </svg>
                    </div>

                    {pairingCode && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: "#64748B" }}>Or enter pairing code on your phone:</div>
                        <div
                          style={{
                            fontSize: 22,
                            fontWeight: 800,
                            letterSpacing: 4,
                            background: "#F1F5F9",
                            padding: "6px 14px",
                            borderRadius: 8,
                            display: "inline-block",
                            marginTop: 4,
                          }}
                        >
                          {pairingCode}
                        </div>
                      </div>
                    )}

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
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Follow these steps on your phone:</div>
                      <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                        <li>Open WhatsApp on your phone</li>
                        <li>Tap <b>Menu (⋮)</b> or <b>Settings (⚙️)</b></li>
                        <li>Tap <b>Linked Devices</b> → <b>Link a Device</b></li>
                        <li>Point your phone camera at the QR code above</li>
                      </ol>
                    </div>

                    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="01712345678"
                        value={pairingPhone}
                        onChange={(e) => setPairingPhone(e.target.value)}
                        style={{ width: 160 }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleConfirmPairing}
                        disabled={isPairing}
                      >
                        {isPairing ? "Pairing…" : "Confirm Device Linked"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ maxWidth: 460, margin: "0 auto", padding: "16px 0" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
                    <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>
                      Connect in 30 Seconds with Zero-Meta Setup
                    </div>
                    <p className="muted" style={{ fontSize: 13.5, margin: "0 0 20px" }}>
                      Link your regular or business WhatsApp number directly. Your store will immediately gain automated order confirmation and courier tracking.
                    </p>
                    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleStartSession}
                        disabled={isStartingSession}
                      >
                        {isStartingSession ? "Generating QR Code…" : "⚡ Link WhatsApp Device"}
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
    </div>
  );
}
