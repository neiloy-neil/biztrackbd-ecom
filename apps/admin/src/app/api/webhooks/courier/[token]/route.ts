import { NextResponse, type NextRequest } from "next/server";
import { handleCourierWebhook } from "@biztrackbd/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 64 * 1024;

/**
 * Courier callbacks (Steadfast, Pathao). No sign-in: the long random token in the address says which store it is for,
 * and the adapter checks the message. Anything unexpected is answered with a bare status and no detail.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return NextResponse.json({ ok: false }, { status: 413 });
  const raw = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  try {
    const r = await handleCourierWebhook(token, headers, raw);
    return NextResponse.json(r.body, { status: r.status });
  } catch (e) {
    console.error("courier webhook failed", e instanceof Error ? e.name : "unknown");
    // A 500 makes the courier try again later, which is safe because applying a message twice changes nothing.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
