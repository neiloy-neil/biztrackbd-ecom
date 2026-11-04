import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { purgeExpiredRateLimits } from "@biztrackbd/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

/** Removes shared rate limit counters whose window ended over an hour ago. Hourly, with `Authorization: Bearer $CRON_SECRET`. Safe to repeat. */
async function run(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorised(req)) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, removed: await purgeExpiredRateLimits() });
}

export const GET = run;
export const POST = run;
