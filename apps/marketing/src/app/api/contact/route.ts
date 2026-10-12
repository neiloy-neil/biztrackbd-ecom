import { NextResponse } from "next/server";
import { submitPlatformInquiry } from "@biztrackbd/core";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor ? forwardedFor.split(",")[0]?.trim() : null;

    const result = await submitPlatformInquiry({
      name: json.name,
      phone: json.phone,
      email: json.email,
      topic: json.topic,
      message: json.message,
      ipAddress,
    });

    return NextResponse.json({ ok: true, id: result.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to submit message";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
