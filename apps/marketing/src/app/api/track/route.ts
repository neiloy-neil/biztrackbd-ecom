import { NextResponse } from "next/server";
import { PLATFORM_BROWSER_EVENTS, trackPlatformBrowserEventCapi, type PlatformBrowserEvent } from "@biztrackbd/core";

// Mirrors consented browser funnel events to Meta CAPI. Same shape of guards as /api/contact.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 60;
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const stamps = (rateLimitMap.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (stamps.length >= MAX_REQUESTS_PER_WINDOW) {
    rateLimitMap.set(ip, stamps);
    return false;
  }
  stamps.push(now);
  rateLimitMap.set(ip, stamps);
  return true;
}

const ALLOWED_DATA_KEYS = new Set(["page_path", "content_name", "content_category", "cta_target", "cta_text", "site_mode"]);
const EVENT_ID = /^[A-Za-z0-9_-]{6,64}$/;
const siteUrl =
  process.env.NEXT_PUBLIC_MARKETING_URL ??
  (process.env.NODE_ENV === "production" ? "https://biztrack.bd" : "http://localhost:3002");

export async function POST(req: Request) {
  if (!(req.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return NextResponse.json({ ok: false }, { status: 415 });
  }
  const text = await req.text();
  if (text.length > 4096) return NextResponse.json({ ok: false }, { status: 413 });

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() || "unknown" : "unknown";
  if (!checkRateLimit(ip)) return NextResponse.json({ ok: false }, { status: 429 });

  if (json.consentGiven !== true) return NextResponse.json({ ok: false, error: "consent" }, { status: 400 });
  const name = json.name as PlatformBrowserEvent;
  if (!PLATFORM_BROWSER_EVENTS.includes(name)) return NextResponse.json({ ok: false, error: "event" }, { status: 400 });
  const eventId = typeof json.eventId === "string" ? json.eventId : "";
  if (!EVENT_ID.test(eventId)) return NextResponse.json({ ok: false, error: "eventId" }, { status: 400 });

  // Only our own pages: a forged URL would pollute Meta's source-URL reports.
  let url: string | null = null;
  try {
    const u = new URL(String(json.url));
    if (u.origin === new URL(siteUrl).origin) url = u.origin + u.pathname;
  } catch {
    /* ignore */
  }
  if (!url) return NextResponse.json({ ok: false, error: "url" }, { status: 400 });

  const customData: Record<string, string> = {};
  if (json.data && typeof json.data === "object") {
    for (const [k, v] of Object.entries(json.data as Record<string, unknown>)) {
      if (ALLOWED_DATA_KEYS.has(k) && typeof v === "string") customData[k] = v.slice(0, 120);
    }
  }

  const result = await trackPlatformBrowserEventCapi({
    name,
    eventId,
    url,
    customData,
    consentGiven: true,
    user: {
      ip: ip === "unknown" ? null : ip,
      userAgent: req.headers.get("user-agent"),
      fbp: typeof json.fbp === "string" ? json.fbp : null,
      fbc: typeof json.fbc === "string" ? json.fbc : null,
    },
  });
  // The visitor never needs to know whether Meta answered.
  if (!result.ok && result.detail !== "Platform Meta Pixel or CAPI token is not configured") {
    console.warn("[track] CAPI:", result.detail);
  }
  return NextResponse.json({ ok: true });
}
