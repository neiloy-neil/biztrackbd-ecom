import { NextResponse, type NextRequest } from "next/server";
import { processUddoktaPaySubscriptionSuccess } from "@biztrackbd/core";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const invoiceId = req.nextUrl.searchParams.get("invoice_id");
  if (!invoiceId) {
    return NextResponse.redirect(new URL("/billing?err=missing_invoice", req.nextUrl.origin));
  }

  // Verify invoice with UddoktaPay gateway
  try {
    const verified = await processUddoktaPaySubscriptionSuccess(invoiceId);
    if (verified.ok) {
      return NextResponse.redirect(
        new URL(`/billing?success=1&plan=${encodeURIComponent(verified.plan)}`, req.nextUrl.origin),
      );
    }
    return NextResponse.redirect(new URL("/billing?err=payment_not_completed", req.nextUrl.origin));
  } catch (err) {
    console.error("[billing-uddoktapay-callback] verification failed", err);
    return NextResponse.redirect(new URL("/billing?err=verification_failed", req.nextUrl.origin));
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
