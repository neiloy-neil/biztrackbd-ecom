import { NextResponse, type NextRequest } from "next/server";
import { checkUddoktaPayPlanInvoice, notifyPlatformSubscriptionPayment, platformOriginFor } from "@biztrackbd/core";
import { resolveAdminRequestOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

/**
 * Where the owner lands after paying for a premium theme with UddoktaPay. The invoice is checked with the gateway (nothing in the address is
 * trusted), the platform is asked to unlock the theme before the page loads, and the owner is sent back to the Themes page.
 */
export async function GET(req: NextRequest) {
  const origin = resolveAdminRequestOrigin(req, 3001);
  const invoiceId = req.nextUrl.searchParams.get("invoice_id");
  if (!invoiceId) return NextResponse.redirect(new URL("/themes?err=missing_invoice", origin));
  try {
    const checked = await checkUddoktaPayPlanInvoice(invoiceId);
    if (!checked.ok || !checked.themeId) return NextResponse.redirect(new URL("/themes?err=payment_not_completed", origin));
    await notifyPlatformSubscriptionPayment(invoiceId, platformOriginFor(process.env.NEXT_PUBLIC_ROOT_DOMAIN));
    return NextResponse.redirect(new URL(`/themes?bought=${encodeURIComponent(checked.themeId)}`, origin));
  } catch (err) {
    console.error("[theme-uddoktapay-callback] verification failed", err instanceof Error ? err.message : err);
    return NextResponse.redirect(new URL("/themes?err=verification_failed", origin));
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
