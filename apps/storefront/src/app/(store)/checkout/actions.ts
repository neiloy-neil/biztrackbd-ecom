"use server";

import { headers } from "next/headers";
import { DomainError, createOrder, createUddoktaPayCharge, getStoreUddoktaPayConfig, hashClient, isValidAddress, normalizeBdPhone, parseCustomerDetailsWithAi, sendServerPurchase, signOrderAccess } from "@biztrackbd/core";
import { clientIp } from "@/lib/ip";
import { getCustomerSession } from "@/lib/session";
import { getStore } from "@/lib/tenant";

export interface PlaceOrderPayload {
  idempotencyKey: string;
  items: { variantId: string; quantity: number }[];
  customer: { name: string; phone: string; email?: string };
  shipping: { division: string; district: string; upazila: string; address: string; note?: string };
  paymentMethod: "COD" | "MANUAL_BKASH" | "MANUAL_NAGAD" | "GATEWAY_UDDOKTAPAY";
  mfs?: { senderNumber: string; trxId: string };
  couponCode?: string;
  redeemPoints?: number;
  referralCode?: string;
  /** Browser cookies and address, so the server-side Purchase can be matched to the visitor. */
  tracking?: { fbp?: string; fbc?: string; url?: string };
}

export type PlaceOrderResult =
  | { ok: true; orderId: string; token: string; paymentUrl?: string }
  | { ok: false; error: string; field?: string };

/**
 * Places the order. The browser sends only ids and quantities: prices, delivery and discounts are recalculated here
 * from the database (core createOrder), so tampering with the form cannot change what is charged.
 */
export async function placeOrderAction(p: PlaceOrderPayload): Promise<PlaceOrderResult> {
  const store = await getStore();
  try {
    // Fail early with a field error rather than letting a made-up district reach the order.
    if (!isValidAddress(p.shipping.division, p.shipping.district, p.shipping.upazila)) {
      return { ok: false, error: "Choose your division, district and upazila from the lists.", field: "district" };
    }
    normalizeBdPhone(p.customer.phone);
    const placed = await createOrder(store.id, {
      idempotencyKey: p.idempotencyKey,
      customer: { name: p.customer.name, phone: p.customer.phone, email: p.customer.email?.trim() || undefined },
      shipping: { address: p.shipping.address, city: p.shipping.upazila, district: p.shipping.district, division: p.shipping.division },
      items: p.items,
      paymentMethod: p.paymentMethod,
      mfs: p.paymentMethod === "COD" || p.paymentMethod === "GATEWAY_UDDOKTAPAY" ? undefined : p.mfs,
      couponCode: p.couponCode?.trim() || undefined,
      redeemPoints: p.redeemPoints && p.redeemPoints > 0 ? p.redeemPoints : undefined,
      referralCode: p.referralCode?.trim() || undefined,
      verifiedCustomerId: (await getCustomerSession(store.id))?.customerId,
      notes: p.shipping.note?.trim() || undefined,
      channel: "STOREFRONT",
      clientHash: hashClient(await clientIp()),
    });

    let paymentUrl: string | undefined;
    if (p.paymentMethod === "GATEWAY_UDDOKTAPAY") {
      const h = await headers();
      const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      const origin = `${proto}://${host}`;
      const cfg = await getStoreUddoktaPayConfig(store.id);

      const charge = await createUddoktaPayCharge({
        apiKey: cfg.apiKey,
        baseUrl: cfg.baseUrl,
        fullName: p.customer.name,
        email: p.customer.email || `${p.customer.phone}@biztrackbd.test`,
        amount: placed.totalAmount,
        metadata: {
          tenantId: store.id,
          orderId: placed.orderId,
          orderNumber: placed.orderNumber,
        },
        redirectUrl: `${origin}/api/payments/uddoktapay/callback?tenantId=${encodeURIComponent(store.id)}`,
        cancelUrl: `${origin}/order/${placed.orderId}?cancelled=1`,
        webhookUrl: `${origin}/api/payments/uddoktapay/webhook?tenantId=${encodeURIComponent(store.id)}`,
        returnType: "GET",
      });
      paymentUrl = charge.paymentUrl;
    } else {
      // For COD and Manual MFS, report the Purchase from server immediately
      if (!placed.replayed) {
        const ua = (await headers()).get("user-agent");
        await Promise.race([
          sendServerPurchase(store.id, placed.orderId, { ip: await clientIp(), userAgent: ua, fbp: p.tracking?.fbp, fbc: p.tracking?.fbc, url: p.tracking?.url }),
          new Promise((resolve) => setTimeout(resolve, 2500)),
        ]);
      }
    }
    return { ok: true, orderId: placed.orderId, token: signOrderAccess(store.id, placed.orderId), paymentUrl };
  } catch (e) {
    if (e instanceof DomainError) {
      const field = typeof e.details?.field === "string" ? e.details.field : e.code === "COUPON_INVALID" ? "coupon" : undefined;
      return { ok: false, error: e.message, field };
    }
    console.error("placeOrderAction failed", e instanceof Error ? e.name : "unknown", await clientIp());
    return { ok: false, error: "Something went wrong. Your order was not placed. Please try again." };
  }
}

export async function parseAddressTextAction(text: string) {
  const store = await getStore();
  try {
    const result = await parseCustomerDetailsWithAi(store.id, text.slice(0, 1500));
    return { ok: true, result };
  } catch (err) {
    console.error("parseAddressTextAction failed:", err);
    return { ok: false, error: "Failed to parse address" };
  }
}
