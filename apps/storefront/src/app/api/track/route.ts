import { NextResponse, type NextRequest } from "next/server";
import { consumeRateLimit, trackBrowserEvent } from "@biztrackbd/core";
import { getStore } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Shared across serverless instances (Postgres), per visitor address; fails open, logged, if the database is down.
const MAX_PER_MINUTE = 120;
const MAX_BYTES = 4096;

/**
 * Pixel events from the visitor's browser. A plain request (not a server action) so it can be sent with `keepalive` and still
 * arrive when the visitor taps "Buy now" and the page navigates away a moment later. Always answers 204: the page never waits on it.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "?";
  const tooMany = !(await consumeRateLimit({ scope: "storefront-track", subject: ip, limit: MAX_PER_MINUTE, windowMs: 60_000 })).allowed;
  if (tooMany || Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return new NextResponse(null, { status: 204 });
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const store = await getStore();
    await trackBrowserEvent(store.id, body, {
      ip, userAgent: req.headers.get("user-agent"),
      fbp: typeof body.fbp === "string" ? body.fbp : undefined, fbc: typeof body.fbc === "string" ? body.fbc : undefined,
    });
  } catch (e) {
    console.error("track failed", e instanceof Error ? e.name : "unknown");
  }
  return new NextResponse(null, { status: 204 });
}
