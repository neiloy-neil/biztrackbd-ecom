import { NextResponse } from "next/server";
import {
  getPlatformSmsConfig,
  getPlatformUddoktaPayConfig,
  getPlatformAiConfig,
  getPlatformCourierConfig,
} from "@biztrackbd/core";
import { getPlatformMobileSession } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { session, error, status } = await getPlatformMobileSession(req);
  if (!session) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const [sms, uddoktapay, ai, courier] = await Promise.all([
      getPlatformSmsConfig().catch(() => null),
      getPlatformUddoktaPayConfig().catch(() => null),
      getPlatformAiConfig().catch(() => null),
      getPlatformCourierConfig().catch(() => null),
    ]);

    return NextResponse.json({
      adminUser: session.user,
      platform: {
        name: "BizTrack.bd Platform Control",
        environment: process.env.NODE_ENV || "production",
        version: "2.4.0",
      },
      integrations: {
        sms: {
          provider: sms?.provider ?? "smsnetbd",
          isConfigured: Boolean(sms?.hasApiKey),
          senderId: sms?.senderId ?? "BizTrack",
        },
        uddoktapay: {
          isConfigured: Boolean(uddoktapay?.hasApiKey),
          baseURL: uddoktapay?.baseUrl ?? "https://pay.biztrack.bd",
        },
        ai: {
          defaultModel: ai?.defaultModel ?? "gemini-2.5-flash",
          isConfigured: Boolean(ai?.hasKey),
        },
        courier: {
          steadfastConfigured: Boolean(courier?.steadfastApiKey),
          pathaoConfigured: Boolean(courier?.pathaoClientId),
        },
      },
    });
  } catch (err: any) {
    console.error("Platform mobile settings error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load platform settings." },
      { status: 500 }
    );
  }
}
