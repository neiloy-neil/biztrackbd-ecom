import { NextResponse, type NextRequest } from "next/server";
import { subscribeDropWaitlist } from "@biztrackbd/core";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const store = await getStore();
    const body = await req.json();

    const { dropId, phone, name } = body;
    if (!dropId || !phone) {
      return NextResponse.json(
        { ok: false, error: "Drop ID and phone number are required." },
        { status: 400 }
      );
    }

    const res = await subscribeDropWaitlist(store.id, {
      dropId: String(dropId),
      phone: String(phone),
      name: name ? String(name).slice(0, 100) : undefined,
    });

    return NextResponse.json({ ok: true, data: res });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "Failed to subscribe to waitlist." },
      { status: 400 }
    );
  }
}
