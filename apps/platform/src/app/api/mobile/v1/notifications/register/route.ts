import { NextResponse } from "next/server";
import { getPlatformMobileSession } from "@/lib/mobile-auth";
import { registerDeviceToken, unregisterDeviceToken } from "@biztrackbd/core";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { session, error, status } = await getPlatformMobileSession(req);

  if (!session) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const body = await req.json();
    const { pushToken, platform = "android", deviceModel } = body;

    if (!pushToken || typeof pushToken !== "string") {
      return NextResponse.json({ error: "pushToken is required" }, { status: 400 });
    }

    await registerDeviceToken({
      appType: "PLATFORM_ADMIN",
      tenantId: null,
      userId: session.user.id,
      pushToken: pushToken.trim(),
      platform,
      deviceModel,
    });

    return NextResponse.json({ success: true, registered: true });
  } catch (err: any) {
    console.error("[Register Platform Device Error]", err);
    return NextResponse.json(
      { error: err?.message || "Failed to register platform device token." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("pushToken");

    if (token) {
      await unregisterDeviceToken(token.trim());
    }

    return NextResponse.json({ success: true, unregistered: true });
  } catch (err: any) {
    console.error("[Unregister Platform Device Error]", err);
    return NextResponse.json(
      { error: err?.message || "Failed to unregister platform device token." },
      { status: 500 }
    );
  }
}
