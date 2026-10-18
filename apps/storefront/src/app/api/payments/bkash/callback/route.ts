import { NextResponse, type NextRequest } from "next/server";
import { processBkashOrderSuccess, signOrderAccess } from "@biztrackbd/core";
import { findStore } from "@/lib/tenant";
import { resolveStorefrontRequestOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

/**
 * Handles the redirect callback from bKash after the customer enters their PIN/OTP.
 * URL: /api/payments/bkash/callback?paymentID=...&status=success&tenantId=...&orderId=...
 */
export async function GET(req: NextRequest) {
  const origin = resolveStorefrontRequestOrigin(req, 3000);
  const store = await findStore();
  const searchParams = req.nextUrl.searchParams;

  const paymentId = searchParams.get("paymentID");
  const status = (searchParams.get("status") || "").toLowerCase();
  const tenantId = searchParams.get("tenantId") || store?.id;
  const orderId = searchParams.get("orderId");

  if (!tenantId) {
    return NextResponse.redirect(new URL("/checkout?err=store_not_found", origin));
  }

  if (!orderId) {
    return NextResponse.redirect(new URL("/checkout?err=order_not_found", origin));
  }

  const token = signOrderAccess(tenantId, orderId);

  // If customer cancelled or payment failed at bKash popup
  if (status === "cancel" || status === "failure") {
    return NextResponse.redirect(
      new URL(
        `/order/${orderId}?k=${encodeURIComponent(token)}&paymentStatus=${status}`,
        origin,
      ),
    );
  }

  if (status !== "success" || !paymentId) {
    return NextResponse.redirect(
      new URL(
        `/order/${orderId}?k=${encodeURIComponent(token)}&paymentStatus=failed`,
        origin,
      ),
    );
  }

  try {
    const res = await processBkashOrderSuccess(tenantId, paymentId, orderId);
    if (res.ok) {
      return NextResponse.redirect(
        new URL(`/order/${orderId}?k=${encodeURIComponent(token)}&paid=1`, origin),
      );
    }

    return NextResponse.redirect(
      new URL(
        `/order/${orderId}?k=${encodeURIComponent(token)}&paymentStatus=failed`,
        origin,
      ),
    );
  } catch (err) {
    console.error("[bkash-callback] execution failed", err);
    return NextResponse.redirect(
      new URL(
        `/order/${orderId}?k=${encodeURIComponent(token)}&paymentStatus=failed`,
        origin,
      ),
    );
  }
}
