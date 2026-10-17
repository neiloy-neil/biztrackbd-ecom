import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processPendingNotificationJobs } from "@biztrackbd/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    // In development allow local trigger without CRON_SECRET
    return process.env.NODE_ENV !== "production";
  }
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * Asynchronous Event Outbox & Webhook Worker Sweep:
 * Sweeps due pending jobs (SMS, Meta CAPI, Webhooks) where nextRetryAt <= now()
 * and executes retries with exponential backoff.
 */
async function run(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 503 });
  }
  if (!authorised(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await processPendingNotificationJobs({ limit: 50 });
  return NextResponse.json({ ok: true, ...result });
}

export const GET = run;
export const POST = run;
