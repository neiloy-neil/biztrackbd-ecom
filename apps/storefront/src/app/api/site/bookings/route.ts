import { NextResponse, type NextRequest } from "next/server";
import { createPublicBooking } from "@biztrackbd/core";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const store = await getStore();
    const body = await req.json().catch(() => ({}));

    const result = await createPublicBooking(store.id, {
      name: body.name,
      phone: body.phone,
      email: body.email,
      serviceName: body.serviceName,
      providerName: body.providerName,
      requestedDate: body.requestedDate,
      requestedTime: body.requestedTime,
      partySize: body.partySize ? Number(body.partySize) : undefined,
      message: body.message,
      type: body.type,
      sourcePage: body.sourcePage,
      locale: body.locale,
      hp: body.hp,
      elapsedMs: body.elapsedMs,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "Failed to submit booking request." },
      { status: err.statusCode || 400 }
    );
  }
}
