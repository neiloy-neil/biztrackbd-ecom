import { NextResponse, type NextRequest } from "next/server";
import { processSslCommerzOrderSuccess, signOrderAccess } from "@biztrackbd/core";
import { findStore } from "@/lib/tenant";
import { resolveStorefrontRequestOrigin } from "@/lib/origin";
import { purchaseContext } from "@/lib/purchase-context";

export const dynamic = "force-dynamic";

async function handleSslCommerzCallback(req: NextRequest) {
  const origin = resolveStorefrontRequestOrigin(req, 3000);
  const store = await findStore();
  let valId: string | null = null;
  let tenantId: string | null = null;
  let orderId: string | null = null;
  let status: string | null = null;

  if (req.method === "POST") {
    try {
      const formData = await req.formData();
      valId = (formData.get("val_id") as string) || null;
      tenantId = (formData.get("value_a") as string) || null;
      orderId = (formData.get("value_b") as string) || (formData.get("tran_id") as string) || null;
      status = (formData.get("status") as string) || null;
    } catch {
      // not formdata, try json
      try {
        const json = await req.json();
        valId = json.val_id || null;
        tenantId = json.value_a || null;
        orderId = json.value_b || json.tran_id || null;
        status = json.status || null;
      } catch {
        // no body
      }
    }
  }

  // Fallback to URL searchParams
  valId = valId || req.nextUrl.searchParams.get("val_id");
  tenantId = tenantId || req.nextUrl.searchParams.get("tenantId") || store?.id || null;
  orderId = orderId || req.nextUrl.searchParams.get("orderId");
  status = status || req.nextUrl.searchParams.get("status");

  if (!tenantId) {
    return NextResponse.redirect(new URL("/checkout?err=store_not_found", origin));
  }

  // If status is failed or cancelled by user
  if (status && (status.toUpperCase() === "FAILED" || status.toUpperCase() === "CANCELLED")) {
    if (orderId) {
      const token = signOrderAccess(tenantId, orderId);
      return NextResponse.redirect(
        new URL(
          `/order/${orderId}?k=${encodeURIComponent(token)}&paymentStatus=${status.toLowerCase()}`,
          origin,
        ),
      );
    }
    return NextResponse.redirect(
      new URL(`/checkout?err=Payment+was+${status.toLowerCase()}`, origin),
    );
  }

  if (!valId) {
    if (orderId) {
      const token = signOrderAccess(tenantId, orderId);
      return NextResponse.redirect(
        new URL(`/order/${orderId}?k=${encodeURIComponent(token)}&paymentStatus=failed`, origin),
      );
    }
    return NextResponse.redirect(new URL("/checkout?err=missing_validation_id", origin));
  }

  try {
    const res = await processSslCommerzOrderSuccess(tenantId, valId, purchaseContext(req));
    const resolvedOrderId = res.orderId || orderId;
    if (res.ok && resolvedOrderId) {
      const token = signOrderAccess(tenantId, resolvedOrderId);
      return NextResponse.redirect(
        new URL(
          `/order/${resolvedOrderId}?k=${encodeURIComponent(token)}&paid=1`,
          origin,
        ),
      );
    }

    if (resolvedOrderId) {
      const token = signOrderAccess(tenantId, resolvedOrderId);
      return NextResponse.redirect(
        new URL(
          `/order/${resolvedOrderId}?k=${encodeURIComponent(token)}&paymentStatus=failed`,
          origin,
        ),
      );
    }

    return NextResponse.redirect(
      new URL(`/checkout?err=${encodeURIComponent(`Payment was not validated (${res.status})`)}`, origin),
    );
  } catch (err) {
    console.error("[sslcommerz-callback] processing failed", err);
    if (orderId) {
      const token = signOrderAccess(tenantId, orderId);
      return NextResponse.redirect(
        new URL(`/order/${orderId}?k=${encodeURIComponent(token)}&paymentStatus=failed`, origin),
      );
    }
    return NextResponse.redirect(
      new URL(
        `/checkout?err=${encodeURIComponent("Could not verify SSLCommerz payment. Please contact support.")}`,
        origin,
      ),
    );
  }
}

export async function GET(req: NextRequest) {
  return handleSslCommerzCallback(req);
}

export async function POST(req: NextRequest) {
  return handleSslCommerzCallback(req);
}
