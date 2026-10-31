import { NextResponse, type NextRequest } from "next/server";
import { checkUddoktaPayPlanInvoice, notifyPlatformSubscriptionPayment, platformOriginFor } from "@biztrackbd/core";
import { resolveAdminRequestOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

/**
 * Where the payer lands after UddoktaPay. It verifies the payment invoice with the gateway,
 * triggers synchronous activation via the platform service role, and redirects back to the
 * billing dashboard with the activated plan.
 */
export async function GET(req: NextRequest) {
  const origin = resolveAdminRequestOrigin(req, 3001);
  const invoiceId = req.nextUrl.searchParams.get("invoice_id");
  if (!invoiceId) {
    return NextResponse.redirect(new URL("/billing?err=missing_invoice", origin));
  }

  try {
    const checked = await checkUddoktaPayPlanInvoice(invoiceId);
    if (!checked.ok) {
      return NextResponse.redirect(new URL("/billing?err=payment_not_completed", origin));
    }

    // Instantly notify platform service to activate subscription in Postgres before redirecting
    const platformOrigin = platformOriginFor(process.env.NEXT_PUBLIC_ROOT_DOMAIN);
    await notifyPlatformSubscriptionPayment(invoiceId, platformOrigin);

    return NextResponse.redirect(new URL(`/billing?success=1&plan=${encodeURIComponent(checked.plan)}`, origin));
  } catch (err) {
    console.error("[billing-uddoktapay-callback] verification failed", err instanceof Error ? err.message : err);
    return NextResponse.redirect(new URL("/billing?err=verification_failed", origin));
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
