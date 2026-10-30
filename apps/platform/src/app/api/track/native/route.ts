import { NextResponse } from "next/server";
import { recordVisitorSession, recordVisitorEvent, type VisitorSessionPayload, type VisitorEventPayload } from "@biztrackbd/core";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() || null : null;

    if (body.type === "session") {
      const payload: VisitorSessionPayload = {
        sessionId: String(body.sessionId || ""),
        landingPage: String(body.landingPage || "/"),
        referrer: body.referrer ? String(body.referrer) : null,
        fbclid: body.fbclid ? String(body.fbclid) : null,
        fbp: body.fbp ? String(body.fbp) : null,
        fbc: body.fbc ? String(body.fbc) : null,
        utmSource: body.utmSource ? String(body.utmSource) : null,
        utmMedium: body.utmMedium ? String(body.utmMedium) : null,
        utmCampaign: body.utmCampaign ? String(body.utmCampaign) : null,
        utmContent: body.utmContent ? String(body.utmContent) : null,
        utmTerm: body.utmTerm ? String(body.utmTerm) : null,
        device: body.device ? String(body.device) : "desktop",
        browser: body.browser ? String(body.browser) : null,
        os: body.os ? String(body.os) : null,
        ipAddress: ip,
      };
      if (!payload.sessionId) return NextResponse.json({ ok: false }, { status: 400 });
      await recordVisitorSession(payload);
    } else if (body.type === "event") {
      const payload: VisitorEventPayload = {
        sessionId: String(body.sessionId || ""),
        eventType: body.eventType || "PAGEVIEW",
        pagePath: String(body.pagePath || "/"),
        pageTitle: body.pageTitle ? String(body.pageTitle) : null,
        targetText: body.targetText ? String(body.targetText) : null,
        targetHref: body.targetHref ? String(body.targetHref) : null,
        metadata: body.metadata || {},
      };
      if (!payload.sessionId) return NextResponse.json({ ok: false }, { status: 400 });
      await recordVisitorEvent(payload);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
