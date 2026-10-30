import { NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobile-auth";
import { registerDeviceToken, unregisterDeviceToken } from "@biztrackbd/core";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { session, error, status } = await getMobileSession(req);

  if (!session) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status });
  }

  try {
    const body = await req.json();
    const { pushToken, platform = "android", deviceModel } = body;

    if (!pushToken || typeof pushToken !== "string") {
      return NextResponse.json({ error: "pushToken is required" }, { status: 400 });
    }

    await registerDeviceToken({
      appType: "STORE_MANAGER",
      tenantId: session.tenantId,
      userId: session.user.id,
      pushToken: pushToken.trim(),
      platform,
      deviceModel,
    });

    return NextResponse.json({ success: true, registered: true });
  } catch (err: any) {
    console.error("[Register Device Error]", err);
    return NextResponse.json(
      { error: err?.message || "Failed to register device token." },
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
    console.error("[Unregister Device Error]", err);
    return NextResponse.json(
      { error: err?.message || "Failed to unregister device token." },
      { status: 500 }
    );
  }
}
