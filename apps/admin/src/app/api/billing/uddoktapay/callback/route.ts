import { NextResponse, type NextRequest } from "next/server";
import { checkUddoktaPayPlanInvoice } from "@biztrackbd/core";
import { resolveAdminRequestOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

/**
 * Where the payer lands after UddoktaPay. It only asks the gateway whether the payment went through and shows the result. It does not
 * activate the plan: the store apps' database role may not write subscriptions. The platform app's webhook does that, usually before
 * the payer is back here.
 */
export async function GET(req: NextRequest) {
  const origin = resolveAdminRequestOrigin(req, 3001);
  const invoiceId = req.nextUrl.searchParams.get("invoice_id");
  if (!invoiceId) {
    return NextResponse.redirect(new URL("/billing?err=missing_invoice", origin));
  }

  try {
    const checked = await checkUddoktaPayPlanInvoice(invoiceId);
    if (checked.ok) {
      return NextResponse.redirect(new URL(`/billing?success=1&plan=${encodeURIComponent(checked.plan)}`, origin));
    }
    return NextResponse.redirect(new URL("/billing?err=payment_not_completed", origin));
  } catch (err) {
    console.error("[billing-uddoktapay-callback] verification failed", err instanceof Error ? err.message : err);
    return NextResponse.redirect(new URL("/billing?err=verification_failed", origin));
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
