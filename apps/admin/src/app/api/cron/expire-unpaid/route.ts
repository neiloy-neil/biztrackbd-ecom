import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { expireUnpaidGatewayOrders } from "@biztrackbd/core";

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
 * Cancels online-payment orders that were never paid (default: after 60 minutes) so abandoned payment pages do not hold stock.
 * Point a scheduler at this every 10 minutes with `Authorization: Bearer $CRON_SECRET`.
 */
async function run(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorised(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const summary = await expireUnpaidGatewayOrders();
  return NextResponse.json({ ok: true, ...summary });
}

export const GET = run;
export const POST = run;
