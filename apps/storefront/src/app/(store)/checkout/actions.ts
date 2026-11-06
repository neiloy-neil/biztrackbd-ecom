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
import { ATTR_FIRST_COOKIE, ATTR_LAST_COOKIE, parseAttributionCookie } from "@biztrackbd/core/attribution";
import { clientIp } from "@/lib/ip";
import { getCustomerSession } from "@/lib/session";
import { getStore } from "@/lib/tenant";

export interface PlaceOrderPayload {
  idempotencyKey: string;
  items: { variantId: string; quantity: number; bundleId?: string; isBump?: boolean; customValues?: Record<string, string> }[];
  isDigital?: boolean;
  customer: { name: string; phone: string; email?: string };
  shipping: { division: string; district: string; upazila: string; address: string; note?: string };
  paymentMethod: "COD" | "MANUAL_BKASH" | "MANUAL_NAGAD" | "GATEWAY_UDDOKTAPAY" | "GATEWAY_SSLCOMMERZ" | "GATEWAY_BKASH" | "BANK_TRANSFER";
  mfs?: { senderNumber: string; trxId: string };
  /** The advance the store rule asks for on a cash-on-delivery order, and how the customer pays it. */
  advance?: { method: "MANUAL_BKASH" | "MANUAL_NAGAD" | "GATEWAY_UDDOKTAPAY"; mfs?: { senderNumber: string; trxId: string } };
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
    const isDigitalOrder = Boolean(p.isDigital) || p.shipping.division === "Digital" || p.shipping.district === "Digital";
    if (isDigitalOrder) {
      if (!p.customer.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.customer.email.trim())) {
        return { ok: false, error: "A valid email address is mandatory for digital delivery.", field: "email" };
      }
      if (p.paymentMethod === "COD") {
        return { ok: false, error: "Cash on delivery is not available for digital products. Please choose an online payment method.", field: "paymentMethod" };
      }
    }
    // Fail early with a field error rather than letting a made-up district reach the order.
    if (!isDigitalOrder && !isValidAddress(p.shipping.division, p.shipping.district, p.shipping.upazila)) {
      return { ok: false, error: "Choose your division, district and upazila from the lists.", field: "district" };
    }
    normalizeBdPhone(p.customer.phone);
    const cookieStore = await cookies();
    const affiliateRef = p.affiliateRef?.trim() || cookieStore.get("bt_aff_ref")?.value?.trim() || undefined;

    // Dual-touch marketing attribution extraction
    const lastAttrRaw = cookieStore.get(ATTR_LAST_COOKIE)?.value;
    const firstAttrRaw = cookieStore.get(ATTR_FIRST_COOKIE)?.value;
    const lastAttr = parseAttributionCookie(lastAttrRaw);
    const firstAttr = parseAttributionCookie(firstAttrRaw);
    const utmSource = lastAttr?.utmSource || firstAttr?.utmSource || undefined;
    const utmCampaign = lastAttr?.utmCampaign || firstAttr?.utmCampaign || undefined;
    const utmMedium = lastAttr?.utmMedium || firstAttr?.utmMedium || undefined;
    const fbp = p.tracking?.fbp || cookieStore.get("_fbp")?.value || lastAttr?.fbp || firstAttr?.fbp || undefined;
    const fbc = p.tracking?.fbc || cookieStore.get("_fbc")?.value || lastAttr?.fbc || firstAttr?.fbc || undefined;

    // Refuse before an order exists: a store with no UddoktaPay keys of its own must not take this payment.
    if (p.paymentMethod === "GATEWAY_UDDOKTAPAY" && !(await getStoreUddoktaPayConfig(store.id)).isCustom) {
      return { ok: false, error: "Online payment is not available for this store right now. Please choose another way to pay." };
    }

    // An advance paid online needs the store's own gateway keys, checked before an order exists, like a full online payment.
    if (p.paymentMethod === "COD" && p.advance?.method === "GATEWAY_UDDOKTAPAY" && !(await getStoreUddoktaPayConfig(store.id)).isCustom) {
      return { ok: false, error: "Online payment is not available for this store right now. Please choose another way to pay the advance.", field: "advance" };
    }

    const isAutomatedGateway =
      p.paymentMethod === "COD" ||
      p.paymentMethod === "GATEWAY_UDDOKTAPAY" ||
      p.paymentMethod === "GATEWAY_SSLCOMMERZ" ||
      p.paymentMethod === "GATEWAY_BKASH";

    const placed = await createOrder(store.id, {
      idempotencyKey: p.idempotencyKey,
      customer: { name: p.customer.name, phone: p.customer.phone, email: p.customer.email?.trim() || undefined },
      shipping: isDigitalOrder
        ? { address: "Digital Delivery", city: "Digital", district: "Digital", division: "Digital" }
        : { address: p.shipping.address, city: p.shipping.upazila, district: p.shipping.district, division: p.shipping.division },
      items: p.items,
      isDigital: isDigitalOrder,
      bundleId: p.bundleId,
      bumpIds: p.bumpIds,
      paymentMethod: p.paymentMethod,
      mfs: isAutomatedGateway ? undefined : p.mfs,
      advance: p.paymentMethod === "COD" ? p.advance : undefined,
      couponCode: p.couponCode?.trim() || undefined,
      redeemPoints: p.redeemPoints && p.redeemPoints > 0 ? p.redeemPoints : undefined,
      referralCode: p.referralCode?.trim() || undefined,
      verifiedCustomerId: (await getCustomerSession(store.id))?.customerId,
      notes: p.shipping.note?.trim() || undefined,
      channel: "STOREFRONT",
      clientHash: hashClient(await clientIp()),
      affiliateRef,
      utmSource,
      utmCampaign,
      utmMedium,
    });

    let paymentUrl: string | undefined;

    const origin = resolveStorefrontOrigin(await headers(), 3000);

    if (p.paymentMethod === "GATEWAY_UDDOKTAPAY" || (p.paymentMethod === "COD" && placed.advanceMethod === "GATEWAY_UDDOKTAPAY" && placed.advanceRequired)) {
      const cfg = await getStoreUddoktaPayConfig(store.id);
      if (!cfg.isCustom) return { ok: false, error: "Online payment is not available for this store right now. Please choose another way to pay." };
      const charge = await createUddoktaPayCharge({
        apiKey: cfg.apiKey,
        baseUrl: cfg.baseUrl,
        fullName: p.customer.name,
        email: p.customer.email || `${p.customer.phone}@biztrackbd.test`,
        // Cash on delivery with an online advance: the charge is the advance only; the courier collects the rest.
        amount: p.paymentMethod === "COD" ? placed.advanceRequired! : placed.totalAmount,
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
          sendServerPurchase(store.id, placed.orderId, { ip: await clientIp(), userAgent: ua, fbp, fbc, url: p.tracking?.url || origin }),
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
 * A new payment page for the advance of a cash-on-delivery order whose first online payment was closed or failed.
 * Only while the order is still waiting for its advance and the deadline has not passed.
 */
export async function retryAdvancePaymentAction(orderId: string, token?: string): Promise<{ ok: true; paymentUrl: string } | { ok: false; error: string }> {
  const store = await getStore();
  // Open to whoever holds the signed order link, or the signed-in customer who placed the order.
  const viaLink = Boolean(token) && verifyOrderAccess(store.id, orderId, token!);
  const session = viaLink ? null : await getCustomerSession(store.id);
  if (!viaLink && !session) return { ok: false, error: "Unauthorized access to order." };
  try {
    const order = await withTenant(store.id, (tx) =>
      tx.order.findFirst({
        where: { id: orderId },
        select: { customerId: true, orderNumber: true, status: true, paymentStatus: true, customerName: true, customerPhone: true, customerEmail: true, advanceRequiredAmount: true, advancePaidAmount: true, advanceDueAt: true, advanceMethod: true },
      }),
    );
    if (!order) return { ok: false, error: "Order not found." };
    if (!viaLink && order.customerId !== session!.customerId) return { ok: false, error: "Unauthorized access to order." };
    const left = Number(order.advanceRequiredAmount) - Number(order.advancePaidAmount);
    if (order.status !== "PENDING" || order.paymentStatus !== "UNPAID" || left <= 0 || order.advanceMethod !== "GATEWAY_UDDOKTAPAY") {
      return { ok: false, error: "This order is not waiting for an online advance." };
    }
    if (order.advanceDueAt && order.advanceDueAt.getTime() < Date.now()) return { ok: false, error: "The time to pay the advance has passed. Please place the order again." };
    const cfg = await getStoreUddoktaPayConfig(store.id);
    if (!cfg.isCustom) return { ok: false, error: "Online payment is not available for this store right now. Please contact the store." };
    const origin = resolveStorefrontOrigin(await headers(), 3000);
    const charge = await createUddoktaPayCharge({
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl,
      fullName: order.customerName,
      email: order.customerEmail || `${order.customerPhone}@biztrackbd.test`,
      amount: left,
      metadata: { tenantId: store.id, orderId, orderNumber: order.orderNumber },
      redirectUrl: `${origin}/api/payments/uddoktapay/callback?tenantId=${encodeURIComponent(store.id)}`,
      cancelUrl: `${origin}/order/${orderId}?cancelled=1${token ? `&k=${encodeURIComponent(token)}` : ""}`,
      webhookUrl: `${origin}/api/payments/uddoktapay/webhook?tenantId=${encodeURIComponent(store.id)}`,
      returnType: "GET",
    });
    return { ok: true, paymentUrl: charge.paymentUrl };
  } catch (err) {
    console.error("retryAdvancePaymentAction error", err instanceof Error ? err.name : "unknown");
    return { ok: false, error: err instanceof Error ? err.message : "Could not start the payment. Please try again." };
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
      // An order that owes its advance cannot skip it by switching to cash on delivery.
      if (Number(order.advanceRequiredAmount) > 0) throw new Error("This order needs its advance payment first.");

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
