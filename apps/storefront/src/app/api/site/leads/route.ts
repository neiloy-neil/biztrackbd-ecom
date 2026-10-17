import { NextResponse, type NextRequest } from "next/server";
import { createPublicLead } from "@biztrackbd/core";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const store = await getStore();
    const body = await req.json().catch(() => ({}));

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;
    const fbp = body.fbp || req.cookies.get("_fbp")?.value || undefined;
    const fbc = body.fbc || req.cookies.get("_fbc")?.value || undefined;

    const result = await createPublicLead(store.id, {
      name: body.name,
      phone: body.phone,
      email: body.email,
      message: body.message,
      type: body.type,
      sourcePage: body.sourcePage,
      utmSource: body.utmSource,
      utmMedium: body.utmMedium,
      utmCampaign: body.utmCampaign,
      referrer: req.headers.get("referer") || body.referrer,
      locale: body.locale,
      metadata: body.metadata,
      eventId: body.eventId || undefined,
      ip,
      userAgent,
      fbp,
      fbc,
      consentGiven: body.consentGiven !== false,
      consentTextVersion: body.consentTextVersion,
      hp: body.hp,
      elapsedMs: body.elapsedMs,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "Failed to submit inquiry." },
      { status: err.statusCode || 400 }
    );
  }
}
