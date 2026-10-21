"use server";

import { cookies, headers } from "next/headers";
import { resolveStorefrontOrigin } from "@/lib/origin";
import {
  DomainError,
  createOrder,
  createUddoktaPayCharge,
  getStoreUddoktaPayConfig,
  createSslCommerzSession,
  getStoreSslCommerzConfig,
  createBkashPayment,
  getStoreBkashConfig,
  verifyOrderAccess,
  hashClient,
  isValidAddress,
  normalizeBdPhone,
  parseCustomerDetailsWithAi,
  sendServerPurchase,
  signOrderAccess,
} from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { clientIp } from "@/lib/ip";
import { getCustomerSession } from "@/lib/session";
import { getStore } from "@/lib/tenant";

export interface PlaceOrderPayload {
  idempotencyKey: string;
  items: { variantId: string; quantity: number; bundleId?: string; isBump?: boolean }[];
  customer: { name: string; phone: string; email?: string };
  shipping: { division: string; district: string; upazila: string; address: string; note?: string };
  paymentMethod: "COD" | "MANUAL_BKASH" | "MANUAL_NAGAD" | "GATEWAY_UDDOKTAPAY" | "GATEWAY_SSLCOMMERZ" | "GATEWAY_BKASH" | "BANK_TRANSFER";
  mfs?: { senderNumber: string; trxId: string };
  couponCode?: string;
  redeemPoints?: number;
  referralCode?: string;
  affiliateRef?: string;
  bundleId?: string;
  bumpIds?: string[];
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
    const cookieStore = await cookies();
    const affiliateRef = p.affiliateRef?.trim() || cookieStore.get("bt_aff_ref")?.value?.trim() || undefined;

    // Refuse before an order exists: a store with no UddoktaPay keys of its own must not take this payment.
    if (p.paymentMethod === "GATEWAY_UDDOKTAPAY" && !(await getStoreUddoktaPayConfig(store.id)).isCustom) {
      return { ok: false, error: "Online payment is not available for this store right now. Please choose another way to pay." };
    }

    const isAutomatedGateway =
      p.paymentMethod === "COD" ||
      p.paymentMethod === "GATEWAY_UDDOKTAPAY" ||
      p.paymentMethod === "GATEWAY_SSLCOMMERZ" ||
      p.paymentMethod === "GATEWAY_BKASH";

    const placed = await createOrder(store.id, {
      idempotencyKey: p.idempotencyKey,
      customer: { name: p.customer.name, phone: p.customer.phone, email: p.customer.email?.trim() || undefined },
      shipping: { address: p.shipping.address, city: p.shipping.upazila, district: p.shipping.district, division: p.shipping.division },
      items: p.items,
      bundleId: p.bundleId,
      bumpIds: p.bumpIds,
      paymentMethod: p.paymentMethod,
      mfs: isAutomatedGateway ? undefined : p.mfs,
      couponCode: p.couponCode?.trim() || undefined,
      redeemPoints: p.redeemPoints && p.redeemPoints > 0 ? p.redeemPoints : undefined,
      referralCode: p.referralCode?.trim() || undefined,
      verifiedCustomerId: (await getCustomerSession(store.id))?.customerId,
      notes: p.shipping.note?.trim() || undefined,
      channel: "STOREFRONT",
      clientHash: hashClient(await clientIp()),
      affiliateRef,
    });

    let paymentUrl: string | undefined;

    const origin = resolveStorefrontOrigin(await headers(), 3000);

    if (p.paymentMethod === "GATEWAY_UDDOKTAPAY") {
      const cfg = await getStoreUddoktaPayConfig(store.id);
      if (!cfg.isCustom) return { ok: false, error: "Online payment is not available for this store right now. Please choose another way to pay." };
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
    } else if (p.paymentMethod === "GATEWAY_SSLCOMMERZ") {
      const cfg = await getStoreSslCommerzConfig(store.id);
      if (!cfg) throw new Error("SSLCommerz is not configured for this store");

      const session = await createSslCommerzSession({
        storeId: cfg.storeId,
        storePassword: cfg.storePassword,
        isSandbox: cfg.isSandbox,
        tenantId: store.id,
        orderId: placed.orderId,
        orderNumber: placed.orderNumber,
        totalAmount: placed.totalAmount,
        customerName: p.customer.name,
        customerEmail: p.customer.email,
        customerPhone: p.customer.phone,
        customerAddress: p.shipping.address,
        customerCity: p.shipping.upazila || p.shipping.district,
        customerDistrict: p.shipping.district,
        successUrl: `${origin}/api/payments/sslcommerz/callback?tenantId=${encodeURIComponent(store.id)}&orderId=${encodeURIComponent(placed.orderId)}`,
        failUrl: `${origin}/api/payments/sslcommerz/callback?tenantId=${encodeURIComponent(store.id)}&orderId=${encodeURIComponent(placed.orderId)}&status=failed`,
        cancelUrl: `${origin}/api/payments/sslcommerz/callback?tenantId=${encodeURIComponent(store.id)}&orderId=${encodeURIComponent(placed.orderId)}&status=cancelled`,
        ipnUrl: `${origin}/api/payments/sslcommerz/ipn?tenantId=${encodeURIComponent(store.id)}`,
      });
      paymentUrl = session.gatewayPageUrl;
    } else if (p.paymentMethod === "GATEWAY_BKASH") {
      const cfg = await getStoreBkashConfig(store.id);
      if (!cfg) throw new Error("Direct bKash is not configured for this store");

      const session = await createBkashPayment(cfg, {
        tenantId: store.id,
        orderId: placed.orderId,
        orderNumber: placed.orderNumber,
        amount: placed.totalAmount,
        customerPhone: p.customer.phone,
        callbackUrl: `${origin}/api/payments/bkash/callback?tenantId=${encodeURIComponent(store.id)}&orderId=${encodeURIComponent(placed.orderId)}`,
      });
      paymentUrl = session.bkashUrl;
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
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong. Your order was not placed. Please try again." };
  }
}

/**
 * 1-Click Fallback to Cash on Delivery (COD) for incomplete or cancelled online payments.
 */
export async function switchToCodAction(orderId: string, token: string): Promise<{ ok: boolean; error?: string }> {
  const store = await getStore();
  if (!verifyOrderAccess(store.id, orderId, token)) {
    return { ok: false, error: "Unauthorized access to order." };
  }

  try {
    await withTenant(store.id, async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId } });
      if (!order) throw new Error("Order not found");
      if (order.paymentStatus === "PAID") throw new Error("Order is already paid");

      const settings = await tx.storeSettings.findFirst();
      const codFee = settings?.codFee ? Number(settings.codFee) : 0;
      const currentCodFee = Number(order.codFee || 0);
      const diffCod = codFee - currentCodFee;

      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentMethod: "COD",
          paymentStatus: "UNPAID",
          codFee,
          totalAmount: Number(order.totalAmount) + diffCod,
        },
      });

      await tx.orderStateLog.create({
        data: {
          tenantId: store.id,
          orderId,
          fromStatus: order.status,
          toStatus: order.status,
          actorType: "CUSTOMER",
          reason: "Switched to Cash on Delivery (COD) after online checkout attempt",
        },
      });
    });

    sendServerPurchase(store.id, orderId).catch(() => undefined);
    return { ok: true };
  } catch (err) {
    console.error("switchToCodAction error", err);
    return { ok: false, error: err instanceof Error ? err.message : "Could not switch to COD." };
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
