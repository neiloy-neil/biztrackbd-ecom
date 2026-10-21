import { NextResponse, type NextRequest } from "next/server";
import { processUddoktaPaySubscriptionSuccess } from "@biztrackbd/core";
import { resolveAdminRequestOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = resolveAdminRequestOrigin(req, 3001);
  const invoiceId = req.nextUrl.searchParams.get("invoice_id");
  if (!invoiceId) {
    return NextResponse.redirect(new URL("/billing?err=missing_invoice", origin));
  }

  // Verify invoice with UddoktaPay gateway
  try {
    const verified = await processUddoktaPaySubscriptionSuccess(invoiceId, {
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: req.headers.get("user-agent"),
      // The marketing Pixel sets these on the root domain, so the admin subdomain receives them too.
      fbp: req.cookies.get("_fbp")?.value ?? null,
      fbc: req.cookies.get("_fbc")?.value ?? null,
    });
    if (verified.ok) {
      return NextResponse.redirect(
        new URL(`/billing?success=1&plan=${encodeURIComponent(verified.plan)}`, origin),
      );
    }
    return NextResponse.redirect(new URL("/billing?err=payment_not_completed", origin));
  } catch (err) {
    console.error("[billing-uddoktapay-callback] verification failed", err);
    return NextResponse.redirect(new URL("/billing?err=verification_failed", origin));
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
