import { NextResponse, type NextRequest } from "next/server";
import { processUddoktaPayOrderSuccess, signOrderAccess } from "@biztrackbd/core";
import { findStore } from "@/lib/tenant";
import { resolveStorefrontRequestOrigin } from "@/lib/origin";
import { purchaseContext } from "@/lib/purchase-context";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = resolveStorefrontRequestOrigin(req, 3000);
  const store = await findStore();
  const tenantId = req.nextUrl.searchParams.get("tenantId") || store?.id;
  if (!tenantId) {
    return NextResponse.redirect(new URL("/checkout?err=store_not_found", origin));
  }

  const invoiceId = req.nextUrl.searchParams.get("invoice_id");
  if (!invoiceId) {
    return NextResponse.redirect(new URL("/checkout?err=missing_invoice", origin));
  }

  try {
    const res = await processUddoktaPayOrderSuccess(tenantId, invoiceId, purchaseContext(req));
    if (res.ok && res.orderId) {
      const token = signOrderAccess(tenantId, res.orderId);
      return NextResponse.redirect(
        new URL(`/order/${res.orderId}?token=${encodeURIComponent(token)}&paid=1`, origin),
      );
    }
    return NextResponse.redirect(
      new URL(`/checkout?err=${encodeURIComponent(`Payment was not completed (${res.status})`)}`, origin),
    );
  } catch (err) {
    console.error("[uddoktapay-callback] verification failed", err);
    return NextResponse.redirect(
      new URL(`/checkout?err=${encodeURIComponent("Could not verify payment. Please contact store support.")}`, origin),
    );
  }
}

export async function POST(req: NextRequest) {
  // If return_type was POST
  return GET(req);
}
