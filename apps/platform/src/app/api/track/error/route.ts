import { NextResponse } from "next/server";
import { recordClientError, type ClientErrorPayload } from "@biztrackbd/core";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.message || !body.pageUrl) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const payload: ClientErrorPayload = {
      sessionId: body.sessionId ? String(body.sessionId) : null,
      pageUrl: String(body.pageUrl).slice(0, 500),
      message: String(body.message).slice(0, 1000),
      stack: body.stack ? String(body.stack).slice(0, 4000) : null,
      component: body.component ? String(body.component).slice(0, 150) : null,
      browser: body.browser ? String(body.browser) : null,
      os: body.os ? String(body.os) : null,
      device: body.device ? String(body.device) : null,
      metadata: body.metadata || {},
    };

    await recordClientError(payload);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
