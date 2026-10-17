import { NextResponse } from "next/server";
import { submitPlatformInquiry } from "@biztrackbd/core";

// Simple in-memory sliding window rate limiter: 5 requests per 10 minutes per IP
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    rateLimitMap.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return true;
}

const ALLOWED_TOPICS = new Set([
  "setup",
  "courier",
  "bkash",
  "shopify",
  "billing",
  "enterprise",
  "business",
  "general",
]);

export async function POST(req: Request) {
  try {
    // 1. Content-Type Policy
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json(
        { ok: false, error: "Invalid Content-Type header. Expected application/json." },
        { status: 415 }
      );
    }

    // 2. Request Body Size Limit (16 KB)
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 16384) {
      return NextResponse.json(
        { ok: false, error: "Payload too large. Maximum size is 16KB." },
        { status: 413 }
      );
    }

    const rawText = await req.text();
    if (rawText.length > 16384) {
      return NextResponse.json(
        { ok: false, error: "Payload too large. Maximum size is 16KB." },
        { status: 413 }
      );
    }

    let json: Record<string, unknown>;
    try {
      json = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Malformed JSON payload." },
        { status: 400 }
      );
    }

    // 3. Client IP Extraction
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor ? forwardedFor.split(",")[0]?.trim() : "127.0.0.1";

    // 4. Rate Limiting Check
    if (ipAddress && !checkRateLimit(ipAddress)) {
      return NextResponse.json(
        { ok: false, error: "Too many messages sent. Please wait a few minutes before trying again or reach us via WhatsApp." },
        { status: 429 }
      );
    }

    // 5. Invisible Bot Shield — Honeypot & Minimum Completion Duration
    const hp = typeof json.hp === "string" ? json.hp.trim() : "";
    if (hp.length > 0) {
      // Silently accept bot submissions
      return NextResponse.json({ ok: true, id: "inq_shielded" });
    }

    const elapsedMs = typeof json.elapsedMs === "number" ? json.elapsedMs : null;
    if (elapsedMs !== null && elapsedMs > 0 && elapsedMs < 1500) {
      // Form submitted suspiciously fast (< 1.5 seconds)
      return NextResponse.json({ ok: true, id: "inq_shielded" });
    }

    // 6. Explicit Affirmative Consent Check
    if (json.consentGiven !== true) {
      return NextResponse.json(
        { ok: false, error: "Please acknowledge the consent checkbox to send your message." },
        { status: 400 }
      );
    }

    // 7. Schema Field Validation
    const name = typeof json.name === "string" ? json.name.trim() : "";
    if (!name || name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid name (2 to 80 characters)." },
        { status: 400 }
      );
    }

    const phone = typeof json.phone === "string" ? json.phone.trim() : "";
    if (!phone || phone.length < 6 || phone.length > 30) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid phone number (at least 6 digits)." },
        { status: 400 }
      );
    }

    const email = typeof json.email === "string" ? json.email.trim().toLowerCase() : "";
    if (!email || email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const topic = typeof json.topic === "string" && ALLOWED_TOPICS.has(json.topic.trim())
      ? json.topic.trim()
      : "setup";

    const message = typeof json.message === "string" ? json.message.trim() : "";
    if (!message || message.length < 5 || message.length > 1500) {
      return NextResponse.json(
        { ok: false, error: "Please enter a message between 5 and 1500 characters." },
        { status: 400 }
      );
    }

    // 8. Core Submission Ingestion
    const result = await submitPlatformInquiry({
      name,
      phone,
      email,
      topic,
      message,
      ipAddress,
    });

    return NextResponse.json({ ok: true, id: result.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to submit message";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
