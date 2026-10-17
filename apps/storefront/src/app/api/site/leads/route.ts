import { NextResponse, type NextRequest } from "next/server";
import { createPublicLead } from "@biztrackbd/core";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const requestId = "req_lead_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  try {
    const store = await getStore();
    const body = await req.json().catch(() => ({}));

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;
    const fbp = body.fbp || req.cookies.get("_fbp")?.value || undefined;
    const fbc = body.fbc || req.cookies.get("_fbc")?.value || undefined;
    const idempotencyKey = req.headers.get("idempotency-key") || body.idempotencyKey || undefined;

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
      idempotencyKey,
      ip,
      userAgent,
      fbp,
      fbc,
      consentGiven: body.consentGiven !== false,
      consentTextVersion: body.consentTextVersion,
      hp: body.hp,
      elapsedMs: body.elapsedMs,
    });

    return NextResponse.json({ ok: true, data: result, requestId });
  } catch (err: any) {
    const status = err.statusCode || (err.code === "RATE_LIMITED" ? 429 : 400);
    const retryAfter = err.data?.retryAfterSeconds || 3600;

    return NextResponse.json(
      {
        ok: false,
        error: err.message || "Failed to submit inquiry.",
        code: err.code || (status === 429 ? "RATE_LIMITED" : "BAD_REQUEST"),
        field: err.data?.field,
        requestId,
      },
      {
        status,
        headers: status === 429 ? { "Retry-After": String(retryAfter) } : undefined,
      }
    );
  }
}
