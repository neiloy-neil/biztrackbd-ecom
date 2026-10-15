import { NextResponse, type NextRequest } from "next/server";
import { createPublicLead } from "@biztrackbd/core";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const store = await getStore();
    const body = await req.json().catch(() => ({}));

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
