import { NextResponse, type NextRequest } from "next/server";
import { processUddoktaPaySubscriptionSuccess } from "@biztrackbd/core";

export const dynamic = "force-dynamic";

/**
 * UddoktaPay calls this when a plan payment completes, so the subscription is activated even if the customer closes the payment page
 * before it sends them back to us. Nothing in the request is trusted: the invoice is looked up at the gateway, and only a COMPLETED
 * answer from there activates anything. The same payment arriving here and on the return page is applied once.
 *
 * It lives on the PLATFORM app because only that app connects with the database role that may write subscriptions. Plan charges send
 * this address to UddoktaPay themselves, so nothing has to be set in the UddoktaPay panel.
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
  const invoiceId = String(body.invoice_id ?? body.invoiceId ?? req.nextUrl.searchParams.get("invoice_id") ?? "").trim();
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(invoiceId)) {
    return NextResponse.json({ status: false, error: "Missing or invalid invoice_id" }, { status: 400 });
  }

  try {
    const res = await processUddoktaPaySubscriptionSuccess(invoiceId);
    return NextResponse.json({ status: res.ok, plan: res.plan, tenantId: res.tenantId });
  } catch (err) {
    console.error("[uddoktapay-plan-webhook] processing failed", err instanceof Error ? err.message : err);
    // 500 so the gateway retries.
    return NextResponse.json({ status: false, error: "Processing error" }, { status: 500 });
  }
}
