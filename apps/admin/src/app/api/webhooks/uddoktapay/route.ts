import { NextResponse, type NextRequest } from "next/server";
import { processUddoktaPaySubscriptionSuccess } from "@biztrackbd/core";

export const dynamic = "force-dynamic";

/**
 * UddoktaPay calls this when a plan payment completes, so the subscription is activated even if the customer closes the payment page
 * before it sends them back to us. Nothing in the request is trusted: the invoice is looked up at the gateway, and only a COMPLETED
 * answer from there activates anything. The same payment arriving here and on the return page is applied once.
 *
 * Set this URL as the webhook in the UddoktaPay panel: https://admin.biztrack.bd/api/webhooks/uddoktapay
 * (public path: the admin sign-in proxy skips /api/webhooks/).
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 8192) return NextResponse.json({ status: false, error: "Payload too large" }, { status: 413 });

  let body: Record<string, unknown> = {};
  try {
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    // Some panels post a form instead of JSON.
    body = Object.fromEntries(new URLSearchParams(raw));
  }
  const invoiceId = String(body.invoice_id ?? body.invoiceId ?? "").trim();
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(invoiceId)) {
    return NextResponse.json({ status: false, error: "Missing or invalid invoice_id" }, { status: 400 });
  }

  try {
    const res = await processUddoktaPaySubscriptionSuccess(invoiceId);
    return NextResponse.json({ status: res.ok });
  } catch (err) {
    console.error("[uddoktapay-plan-webhook] processing failed", err instanceof Error ? err.message : err);
    // 500 so the gateway retries.
    return NextResponse.json({ status: false, error: "Processing error" }, { status: 500 });
  }
}
