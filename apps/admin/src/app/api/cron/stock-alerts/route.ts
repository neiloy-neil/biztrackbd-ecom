import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sweepStockAlerts } from "@biztrackbd/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// 60 seconds is the longest Vercel Hobby allows. Every sweep is safe to run again, so a long one simply continues on the next call.
export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * The back-in-stock sweep: texts shoppers who asked to be told when something is back, for every store. Stock changes made in the
 * admin tell them straight away; this catches the rest (a parcel that came back, a change made another way).
 * Point a scheduler at this every 15 minutes with `Authorization: Bearer $CRON_SECRET`. Each request is sent once, so running it more often is harmless.
 */
async function run(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorised(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const summary = await sweepStockAlerts();
  return NextResponse.json({ ok: true, ...summary });
}

export const GET = run;
export const POST = run;
