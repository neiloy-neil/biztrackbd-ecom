import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sweepDomains } from "@biztrackbd/core";

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
 * The domain sweep: checks every domain that is still being connected (DNS record, then certificate) so it reaches Connected without anyone pressing a button.
 * Point a scheduler at this every 5 minutes (a domain is looked at most every 2 minutes) with `Authorization: Bearer $CRON_SECRET` (Vercel Cron does this by itself
 * when CRON_SECRET is set). Every step is safe to repeat.
 */
async function run(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorised(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const summary = await sweepDomains();
  return NextResponse.json({ ok: true, ...summary });
}

export const GET = run;
export const POST = run;
