import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  confirmWhatsAppPairing,
  processInboundWhatsAppMessage,
} from "@biztrackbd/core";

/** The gateway proves itself with WHATSAPP_GATEWAY_SECRET. In production the call is refused when no secret is configured. */
function gatewayAuthorised(req: Request): "ok" | "unauthorized" | "unconfigured" {
  const secret = process.env.WHATSAPP_GATEWAY_SECRET;
  if (!secret) return process.env.NODE_ENV === "production" ? "unconfigured" : "ok";
  const given = (req.headers.get("x-gateway-token") || req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "unauthorized";
}

export async function POST(req: Request) {
  try {
    const auth = gatewayAuthorised(req);
    if (auth === "unconfigured") {
      return NextResponse.json({ error: "WHATSAPP_GATEWAY_SECRET is not set" }, { status: 503 });
    }
    if (auth === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized gateway token" }, { status: 401 });
    }
    const body = await req.json();

    const { event, tenantId, status, phone, message } = body;

    if (!tenantId) {
      return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
    }

    // 1. Connection status update from Baileys socket
    if (event === "connection.update" && status === "CONNECTED" && phone) {
      await confirmWhatsAppPairing(tenantId, phone);
      return NextResponse.json({ success: true, updated: "CONNECTED", phone });
    }

    // 2. Inbound customer message
    if (event === "message.inbound" && phone && message) {
      const result = await processInboundWhatsAppMessage(tenantId, {
        from: phone,
        body: message,
      });
      return NextResponse.json({ success: true, action: result.action });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[whatsapp-webhook] processing failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Webhook processing error" }, { status: 500 });
  }
}
