import QRCode from "qrcode";
import { withTenant } from "@biztrackbd/db";
import { normalizeBdPhone } from "../phone";
import { formatWhatsAppPhone } from "./deep-links";
import type { WhatsAppConfigView, WhatsAppSessionStatus } from "./types";

/**
 * Resolves the active WhatsApp gateway URL.
 * Defaults to the local Baileys gateway service on port 5055.
 */
export function resolveWhatsAppGatewayUrl(configUrl?: string | null, customUrl?: string): string {
  return customUrl || configUrl || process.env.WHATSAPP_GATEWAY_URL || "http://localhost:5055";
}

/**
 * Generates a clean, scannable SVG QR code string.
 */
export async function generateWhatsAppQrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    width: 240,
    color: {
      dark: "#0F172A",
      light: "#FFFFFF",
    },
  });
}

/**
 * Initiates a WhatsApp Linked Device session.
 * Connects to the Baileys gateway to obtain an authentic WhatsApp multi-device pairing QR code and pairing code.
 */
export async function startWhatsAppSession(
  tenantId: string,
  options?: { customGatewayUrl?: string; phoneNumber?: string }
): Promise<{
  status: WhatsAppSessionStatus;
  qrCodeData: string | null;
  qrSvg: string | null;
  pairingCode?: string;
  directLink?: string;
  gatewayActive: boolean;
}> {
  return withTenant(tenantId, async (tx) => {
    const existing = await tx.whatsAppConfig.findUnique({
      where: { tenantId },
      select: { gatewayUrl: true },
    });

    const gatewayUrl = resolveWhatsAppGatewayUrl(existing?.gatewayUrl, options?.customGatewayUrl);

    let qrCodeData = "";
    let qrSvg: string | null = null;
    let pairingCode: string | undefined;
    let gatewayActive = false;

    // Clean and normalize the phone number
    let localPhone: string | null = null;
    let formattedPhone: string | null = null;
    if (options?.phoneNumber) {
      try {
        localPhone = normalizeBdPhone(options.phoneNumber);
        formattedPhone = `+880${localPhone.slice(1)}`;
      } catch {
        const digits = options.phoneNumber.replace(/\D/g, "");
        if (digits.length >= 10) {
          localPhone = digits.slice(-11).startsWith("0") ? digits.slice(-11) : "0" + digits.slice(-10);
          formattedPhone = `+880${localPhone.slice(1)}`;
        }
      }
    }

    if (gatewayUrl) {
      try {
        const res = await fetch(`${gatewayUrl}/session/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, phone: formattedPhone, forceRestart: true }),
          signal: AbortSignal.timeout(6_000),
        });
        if (res.ok) {
          const json = (await res.json()) as {
            qr?: string;
            qrSvg?: string;
            pairingCode?: string;
            status?: string;
          };
          gatewayActive = true;
          if (json.qr) qrCodeData = json.qr;
          if (json.qrSvg) qrSvg = json.qrSvg;
          if (json.pairingCode) pairingCode = json.pairingCode;
        }
      } catch {
        gatewayActive = false;
      }
    }

    const phoneForLink = localPhone ? `88${localPhone}` : "8801700000000";
    const directLink = `https://wa.me/${phoneForLink}?text=${encodeURIComponent(
      "Hello! BizTrack WhatsApp connection verification."
    )}`;

    if (!qrCodeData) {
      // Fallback direct wa.me link when gateway is not active
      qrCodeData = directLink;
    }

    if (!qrSvg && qrCodeData) {
      try {
        qrSvg = await generateWhatsAppQrSvg(qrCodeData);
      } catch (e) {
        console.error("Failed to generate QR SVG", e);
      }
    }

    const config = await tx.whatsAppConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        providerMode: "QR_SESSION",
        status: "SCAN_QR",
        qrCodeData,
        phoneNumber: formattedPhone,
        gatewayUrl: gatewayUrl !== "http://localhost:5055" ? gatewayUrl : null,
      },
      update: {
        status: "SCAN_QR",
        qrCodeData,
        phoneNumber: formattedPhone ?? undefined,
        gatewayUrl: gatewayUrl !== "http://localhost:5055" ? gatewayUrl : undefined,
      },
    });

    // Auto-sync with StoreSettings if phone provided
    if (localPhone) {
      await tx.storeSettings.updateMany({
        where: { tenantId },
        data: { whatsappNumber: localPhone },
      });
    }

    return {
      status: config.status,
      qrCodeData: config.qrCodeData,
      qrSvg,
      pairingCode,
      directLink,
      gatewayActive,
    };
  });
}

/**
 * Requests an authentic 8-character Baileys WhatsApp pairing code
 * for "Link with phone number instead" in WhatsApp Linked Devices.
 */
export async function requestWhatsAppPairingCode(
  tenantId: string,
  phoneNumber: string,
  customGatewayUrl?: string
): Promise<{ success: boolean; pairingCode?: string; error?: string; gatewayActive: boolean }> {
  let localPhone: string;
  try {
    localPhone = normalizeBdPhone(phoneNumber);
  } catch {
    const digits = phoneNumber.replace(/\D/g, "");
    localPhone = digits.slice(-11).startsWith("0") ? digits.slice(-11) : "0" + digits.slice(-10);
  }
  const cleanNumber = `880${localPhone.slice(1)}`;

  return withTenant(tenantId, async (tx) => {
    const existing = await tx.whatsAppConfig.findUnique({
      where: { tenantId },
      select: { gatewayUrl: true },
    });
    const gatewayUrl = resolveWhatsAppGatewayUrl(existing?.gatewayUrl, customGatewayUrl);

    try {
      const res = await fetch(`${gatewayUrl}/session/pairing-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, phone: cleanNumber }),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        const json = (await res.json()) as { pairingCode?: string; status?: string };
        return {
          success: true,
          pairingCode: json.pairingCode,
          gatewayActive: true,
        };
      } else {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        return {
          success: false,
          error: errJson.error || `Gateway returned ${res.status}`,
          gatewayActive: true,
        };
      }
    } catch {
      return {
        success: false,
        error: "Baileys WhatsApp Gateway is offline. Please start it using 'pnpm whatsapp:gateway'.",
        gatewayActive: false,
      };
    }
  });
}

/**
 * Fetches current session status and syncs real-time Baileys state if available.
 */
export async function getWhatsAppSessionStatus(tenantId: string): Promise<WhatsAppConfigView | null> {
  return withTenant(tenantId, async (tx) => {
    const config = await tx.whatsAppConfig.findUnique({
      where: { tenantId },
    });
    if (!config) return null;

    const gatewayUrl = resolveWhatsAppGatewayUrl(config.gatewayUrl);
    let gatewayActive = false;
    let qrSvg: string | null = null;
    let pairingCode: string | null = null;
    let liveStatus = config.status;
    let livePhone = config.phoneNumber;

    // Check with live gateway if available
    try {
      const res = await fetch(`${gatewayUrl}/session/status?tenantId=${tenantId}`, {
        signal: AbortSignal.timeout(2_500),
      });
      if (res.ok) {
        gatewayActive = true;
        const live = (await res.json()) as {
          status: WhatsAppSessionStatus;
          phoneNumber?: string;
          qr?: string;
          qrSvg?: string;
          pairingCode?: string;
        };

        if (live.status === "CONNECTED" && config.status !== "CONNECTED") {
          // Device linked via Baileys
          liveStatus = "CONNECTED";
          if (live.phoneNumber) {
            livePhone = live.phoneNumber.startsWith("+") ? live.phoneNumber : `+${live.phoneNumber}`;
          }
          await tx.whatsAppConfig.update({
            where: { tenantId },
            data: {
              status: "CONNECTED",
              phoneNumber: livePhone,
              qrCodeData: null,
              lastConnectedAt: new Date(),
            },
          });
        } else if (live.status === "SCAN_QR") {
          if (live.qrSvg) qrSvg = live.qrSvg;
          if (live.pairingCode) pairingCode = live.pairingCode;
        }
      }
    } catch {
      gatewayActive = false;
    }

    if (!qrSvg && liveStatus === "SCAN_QR" && config.qrCodeData) {
      try {
        qrSvg = await generateWhatsAppQrSvg(config.qrCodeData);
      } catch {}
    }

    return {
      providerMode: config.providerMode,
      status: liveStatus,
      phoneNumber: livePhone,
      qrCodeData: config.qrCodeData,
      qrSvg,
      pairingCode,
      gatewayUrl: config.gatewayUrl,
      gatewayActive,
      autoConfirmCod: config.autoConfirmCod,
      shippingUpdatesEnabled: config.shippingUpdatesEnabled,
      abandonedRecoveryEnabled: config.abandonedRecoveryEnabled,
      botEnabled: config.botEnabled,
      smsFallbackEnabled: config.smsFallbackEnabled,
      followUpReminderHours: config.followUpReminderHours,
      lastConnectedAt: config.lastConnectedAt,
    };
  });
}

/**
 * Disconnects the active WhatsApp session.
 */
export async function disconnectWhatsAppSession(tenantId: string): Promise<void> {
  return withTenant(tenantId, async (tx) => {
    const existing = await tx.whatsAppConfig.findUnique({
      where: { tenantId },
      select: { gatewayUrl: true },
    });
    const gatewayUrl = resolveWhatsAppGatewayUrl(existing?.gatewayUrl);

    // Notify gateway to logout and clean storage
    try {
      await fetch(`${gatewayUrl}/session/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
        signal: AbortSignal.timeout(3_000),
      });
    } catch {}

    await tx.whatsAppConfig.updateMany({
      where: { tenantId },
      data: {
        status: "DISCONNECTED",
        sessionData: null,
        qrCodeData: null,
      },
    });
  });
}

/**
 * Confirms a successful device link and updates status to CONNECTED.
 * Also synchronizes the phone number to the storefront floating widget.
 */
export async function confirmWhatsAppPairing(
  tenantId: string,
  connectedPhone: string
): Promise<WhatsAppSessionStatus> {
  let localPhone: string;
  try {
    localPhone = normalizeBdPhone(connectedPhone);
  } catch {
    const digits = connectedPhone.replace(/\D/g, "");
    localPhone = digits.slice(-11).startsWith("0") ? digits.slice(-11) : "0" + digits.slice(-10);
  }
  const formattedPhone = `+880${localPhone.slice(1)}`;

  return withTenant(tenantId, async (tx) => {
    const updated = await tx.whatsAppConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        providerMode: "QR_SESSION",
        status: "CONNECTED",
        phoneNumber: formattedPhone,
        sessionData: JSON.stringify({ linkedAt: new Date().toISOString(), phone: formattedPhone }),
        lastConnectedAt: new Date(),
      },
      update: {
        status: "CONNECTED",
        phoneNumber: formattedPhone,
        qrCodeData: null,
        sessionData: JSON.stringify({ linkedAt: new Date().toISOString(), phone: formattedPhone }),
        lastConnectedAt: new Date(),
      },
    });

    await tx.storeSettings.updateMany({
      where: { tenantId },
      data: { whatsappNumber: localPhone },
    });

    return updated.status;
  });
}
