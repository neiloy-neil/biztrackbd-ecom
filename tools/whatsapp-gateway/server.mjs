import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";

const PORT = parseInt(process.env.PORT || process.env.WHATSAPP_GATEWAY_PORT || "5055", 10);
const AUTH_BASE_DIR = path.resolve(process.cwd(), ".baileys_auth");
const WEBHOOK_URL = process.env.BIZTRACK_WEBHOOK_URL || "http://localhost:3000/api/webhooks/whatsapp";

const logger = pino({ level: process.env.LOG_LEVEL || "warn" });

// Active sessions map: tenantId -> session object
const sessions = new Map();

/**
 * Format any phone number into clean digits with country code
 * e.g. "01886675596" -> "8801886675596"
 */
function cleanPhoneDigits(raw) {
  if (!raw) return "";
  let digits = String(raw).replace(/\D/g, "");
  while (digits.startsWith("880880")) digits = digits.slice(3);
  while (digits.startsWith("8888")) digits = digits.slice(2);
  if (digits.startsWith("88001") && digits.length === 14) return `88${digits.slice(3)}`;
  if (digits.startsWith("880") && digits.length === 13) return digits;
  if (digits.startsWith("01") && digits.length === 11) return `88${digits}`;
  if (digits.startsWith("1") && digits.length === 10) return `880${digits}`;
  return digits;
}

/**
 * Creates or gets an active Baileys WhatsApp connection for a tenant
 */
async function getOrCreateSession(tenantId = "default", phone = null, forceRestart = false) {
  const existing = sessions.get(tenantId);
  if (!forceRestart && existing && existing.sock && existing.status === "CONNECTED") {
    return existing;
  }

  if (forceRestart && existing) {
    if (existing.sock) {
      try {
        await existing.sock.end();
      } catch {}
    }
    sessions.delete(tenantId);
  }

  const authDir = path.join(AUTH_BASE_DIR, tenantId);
  await fs.mkdir(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({
    version: [2, 3000, 1015901307],
    isLatest: true,
  }));

  const sessionObj = {
    tenantId,
    sock: null,
    status: "CONNECTING",
    qr: null,
    qrSvg: null,
    pairingCode: null,
    phoneNumber: phone ? cleanPhoneDigits(phone) : null,
  };

  sessions.set(tenantId, sessionObj);

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    browser: ["BizTrack Commerce", "Chrome", "1.0.0"],
    syncFullHistory: false,
    generateHighQualityLinkPreview: true,
  });

  sessionObj.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      sessionObj.qr = qr;
      sessionObj.status = "SCAN_QR";
      try {
        sessionObj.qrSvg = await QRCode.toString(qr, {
          type: "svg",
          margin: 1,
          width: 240,
          color: { dark: "#0F172A", light: "#FFFFFF" },
        });
      } catch (err) {
        logger.error({ err }, "Failed to render QR SVG");
      }
      logger.info({ tenantId }, "New WhatsApp QR Code generated");
    }

    if (connection === "open") {
      sessionObj.status = "CONNECTED";
      sessionObj.qr = null;
      sessionObj.qrSvg = null;
      sessionObj.pairingCode = null;
      if (sock.user && sock.user.id) {
        sessionObj.phoneNumber = sock.user.id.split(":")[0];
      }
      logger.info({ tenantId, phone: sessionObj.phoneNumber }, "WhatsApp successfully CONNECTED");

      // Notify BizTrack of successful connection
      try {
        await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "connection.update",
            tenantId,
            status: "CONNECTED",
            phone: sessionObj.phoneNumber,
          }),
          signal: AbortSignal.timeout(5_000),
        });
      } catch {}
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn({ tenantId, statusCode, shouldReconnect }, "WhatsApp connection closed");

      if (shouldReconnect) {
        sessionObj.status = "CONNECTING";
        setTimeout(() => getOrCreateSession(tenantId, sessionObj.phoneNumber), 3000);
      } else {
        sessionObj.status = "DISCONNECTED";
        sessionObj.sock = null;
        try {
          await fs.rm(authDir, { recursive: true, force: true });
        } catch {}
      }
    }
  });

  // Handle incoming customer messages & replies
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      const fromJid = msg.key.remoteJid;
      if (!fromJid || fromJid.endsWith("@g.us")) continue; // Skip groups for order 1-to-1

      const fromPhone = fromJid.replace(/@.*$/, "");
      const body =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        "";

      if (!body.trim()) continue;

      logger.info({ fromPhone, body }, "Received inbound WhatsApp message");

      // Notify BizTrack Webhook
      try {
        await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "message.inbound",
            tenantId,
            phone: fromPhone,
            message: body,
            timestamp: msg.messageTimestamp,
          }),
          signal: AbortSignal.timeout(5_000),
        });
      } catch {}
    }
  });

  // If pairing code requested during setup
  if (phone && !sock.authState.creds.registered) {
    const cleanNumber = cleanPhoneDigits(phone);
    if (cleanNumber.length >= 10) {
      setTimeout(async () => {
        try {
          const rawCode = await sock.requestPairingCode(cleanNumber);
          const formatted = rawCode.length === 8 ? `${rawCode.slice(0, 4)}-${rawCode.slice(4).toUpperCase()}` : rawCode;
          sessionObj.pairingCode = formatted;
          logger.info({ cleanNumber, code: formatted }, "Pairing code generated successfully");
        } catch (err) {
          logger.error({ err }, "Failed to generate pairing code");
        }
      }, 1500);
    }
  }

  return sessionObj;
}

// HTTP API Server
const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  // JSON helper
  const sendJson = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };

  // Parse JSON body helper
  const parseBody = () =>
    new Promise((resolve) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch {
          resolve({});
        }
      });
    });

  try {
    // Health Check
    if (pathname === "/health" || pathname === "/") {
      return sendJson(200, {
        status: "ok",
        service: "BizTrack Baileys WhatsApp Gateway",
        uptimeSeconds: Math.floor(process.uptime()),
        activeSessions: sessions.size,
      });
    }

    // Start / Connect Session
    if (pathname === "/session/start" && req.method === "POST") {
      const body = await parseBody();
      const tenantId = body.tenantId || "default";
      const phone = body.phone || null;
      const forceRestart = Boolean(body.forceRestart);

      const session = await getOrCreateSession(tenantId, phone, forceRestart);

      // Give event loop up to 1.8s to receive first QR or pairing code if fresh
      if (!session.qr && session.status !== "CONNECTED") {
        await new Promise((r) => setTimeout(r, 1800));
      }

      return sendJson(200, {
        success: true,
        status: session.status,
        qr: session.qr,
        qrSvg: session.qrSvg,
        pairingCode: session.pairingCode,
        phoneNumber: session.phoneNumber,
      });
    }

    // Request Pairing Code (8-character code for phone number link)
    if (pathname === "/session/pairing-code" && req.method === "POST") {
      const body = await parseBody();
      const tenantId = body.tenantId || "default";
      const cleanNumber = cleanPhoneDigits(body.phone || body.phoneNumber);

      if (!cleanNumber || cleanNumber.length < 10) {
        return sendJson(400, { error: "Please enter a valid phone number for pairing" });
      }

      let session = sessions.get(tenantId);
      if (!session || !session.sock || session.status === "DISCONNECTED") {
        session = await getOrCreateSession(tenantId, cleanNumber, false);
      }

      if (session.status === "CONNECTED") {
        return sendJson(200, {
          success: true,
          status: "CONNECTED",
          message: "Device is already connected",
          phoneNumber: session.phoneNumber,
        });
      }

      // Wait a moment if socket is still establishing handshake
      await new Promise((r) => setTimeout(r, 1500));

      try {
        const rawCode = await session.sock.requestPairingCode(cleanNumber);
        const formatted = rawCode.length === 8 ? `${rawCode.slice(0, 4)}-${rawCode.slice(4).toUpperCase()}` : rawCode;
        session.pairingCode = formatted;
        session.phoneNumber = cleanNumber;

        return sendJson(200, {
          success: true,
          status: session.status,
          pairingCode: formatted,
          rawCode,
          phoneNumber: cleanNumber,
        });
      } catch (err) {
        logger.error({ err, cleanNumber }, "Failed to generate pairing code");
        return sendJson(500, {
          error: err.message || "Failed to generate pairing code from WhatsApp servers",
        });
      }
    }

    // Session Status Check
    if (pathname === "/session/status" && req.method === "GET") {
      const tenantId = url.searchParams.get("tenantId") || "default";
      const session = sessions.get(tenantId);

      if (!session) {
        return sendJson(200, { status: "DISCONNECTED" });
      }

      return sendJson(200, {
        status: session.status,
        phoneNumber: session.phoneNumber,
        qr: session.qr,
        qrSvg: session.qrSvg,
        pairingCode: session.pairingCode,
      });
    }

    // Disconnect / Logout
    if (pathname === "/session/disconnect" && req.method === "POST") {
      const body = await parseBody();
      const tenantId = body.tenantId || "default";
      const session = sessions.get(tenantId);

      if (session && session.sock) {
        try {
          await session.sock.logout();
        } catch {}
      }

      sessions.delete(tenantId);
      const authDir = path.join(AUTH_BASE_DIR, tenantId);
      try {
        await fs.rm(authDir, { recursive: true, force: true });
      } catch {}

      return sendJson(200, { success: true, status: "DISCONNECTED" });
    }

    // Send Message
    if (pathname === "/message/send" && req.method === "POST") {
      const body = await parseBody();
      const tenantId = body.tenantId || "default";
      const to = cleanPhoneDigits(body.to || body.phone);
      const text = body.text || body.message || "";

      if (!to || !text.trim()) {
        return sendJson(400, { error: "Missing 'to' or 'text' in message body" });
      }

      const session = sessions.get(tenantId);
      if (!session || !session.sock || session.status !== "CONNECTED") {
        return sendJson(400, {
          error: "WhatsApp session is not CONNECTED. Please scan the QR code to link device.",
          status: session?.status || "DISCONNECTED",
        });
      }

      const jid = `${to}@s.whatsapp.net`;
      const result = await session.sock.sendMessage(jid, { text });

      return sendJson(200, {
        success: true,
        messageId: result?.key?.id,
        to,
        status: "SENT",
      });
    }

    return sendJson(404, { error: "Route not found" });
  } catch (err) {
    logger.error({ err }, "API error");
    return sendJson(500, { error: err.message || "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🟢 BizTrack Baileys WhatsApp Gateway Running!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📱 Endpoints:`);
  console.log(`   - POST /session/start        (Real Baileys QR & Auto Code)`);
  console.log(`   - POST /session/pairing-code (Direct 8-Digit Pairing Code)`);
  console.log(`   - GET  /session/status       (Real Connection Status)`);
  console.log(`   - POST /message/send         (Automated Background Dispatch)`);
  console.log(`======================================================\n`);
});
