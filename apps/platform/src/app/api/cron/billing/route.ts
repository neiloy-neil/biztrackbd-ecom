import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runBillingLifecycle } from "@biztrackbd/core";

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
 * The daily billing sweep (docs/12 section 4): trials and plans that ran out move through grace, read-only and locked, and
 * reminders are published. Schedule it at least once a day with `Authorization: Bearer $CRON_SECRET`.
 */
async function run(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorised(req)) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await runBillingLifecycle()) });
}

export const GET = run;
export const POST = run;
