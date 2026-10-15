import { NextResponse } from "next/server";
import {
  confirmWhatsAppPairing,
  processInboundWhatsAppMessage,
} from "@biztrackbd/core";

export async function POST(req: Request) {
  try {
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
    return NextResponse.json(
      { error: err.message || "Webhook processing error" },
      { status: 500 }
    );
  }
}
