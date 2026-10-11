import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sweepRecoveryMessages } from "@biztrackbd/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// 60 seconds is the longest Vercel Hobby allows. Every sweep is safe to run again, so a long one simply continues on the next call. Raise on a paid plan if needed.
export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * The abandoned-checkout sweep: sends the 30-minute recovery SMS to customers who left a cart, for every store.
 * Point a scheduler at this every 5 minutes with `Authorization: Bearer $CRON_SECRET` (Vercel Cron does this by itself
 * when CRON_SECRET is set). Each customer is texted once, so running it more often only makes the 30 minutes more exact.
 */
async function run(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorised(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const summary = await sweepRecoveryMessages();
  return NextResponse.json({ ok: true, ...summary });
}

export const GET = run;
export const POST = run;
