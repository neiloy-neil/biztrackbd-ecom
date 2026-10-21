import { withTenant } from "@biztrackbd/db";
import { NotFoundError, ValidationError } from "../errors";
import { sendServerPurchase } from "../growth/tracking";
import { loadCredentials } from "../vault/integrations";

export const DEFAULT_SSLCOMMERZ_SANDBOX_URL = "https://sandbox.sslcommerz.com";
export const DEFAULT_SSLCOMMERZ_LIVE_URL = "https://securepay.sslcommerz.com";

let fetchImpl: typeof fetch = (...a) => fetch(...a);
export function setSslCommerzFetchForTests(f: typeof fetch | undefined): void {
  fetchImpl = f ?? ((...a) => fetch(...a));
}

export interface SslCommerzConfig {
  storeId: string;
  storePassword: string;
  isSandbox: boolean;
  isCustom: boolean;
}

export interface SslCommerzSessionInput {
  storeId?: string;
  storePassword?: string;
  isSandbox?: boolean;
  tenantId: string;
  orderId: string;
  orderNumber: number | string;
  totalAmount: number | string;
  currency?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  customerAddress: string;
  customerCity?: string;
  customerDistrict?: string;
  productName?: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
}

export interface SslCommerzSessionResponse {
  status: "SUCCESS" | "FAILED";
  failedReason?: string;
  sessionKey?: string;
  gatewayPageUrl: string;
}

export interface SslCommerzValidationResponse {
  status: "VALID" | "VALIDATED" | "FAILED" | "CANCELLED" | "INVALID_TRANSACTION";
  tranId: string;
  valId: string;
  amount: string;
  storeAmount?: string;
  currency: string;
  bankTranId?: string;
  cardType?: string;
  cardIssuer?: string;
  cardBrand?: string;
  tranDate?: string;
  tenantId?: string;
  orderId?: string;
  raw?: Record<string, unknown>;
}

/**
 * Loads merchant's SSLCommerz credentials from integration vault.
 */
export async function getStoreSslCommerzConfig(tenantId: string): Promise<SslCommerzConfig | null> {
  // Check LIVE mode first
  try {
    const live = await loadCredentials(tenantId, "SSLCOMMERZ", "LIVE");
    if (live && live.secrets?.storeId && live.secrets?.storePassword) {
      const isSandbox = String(live.config?.isSandbox || "").toLowerCase() === "true";
      return {
        storeId: live.secrets.storeId,
        storePassword: live.secrets.storePassword,
        isSandbox,
        isCustom: true,
      };
    }
  } catch {
    // not in live
  }

  // Check TEST mode
  try {
    const test = await loadCredentials(tenantId, "SSLCOMMERZ", "TEST");
    if (test && test.secrets?.storeId && test.secrets?.storePassword) {
      return {
        storeId: test.secrets.storeId,
        storePassword: test.secrets.storePassword,
        isSandbox: true,
        isCustom: true,
      };
    }
  } catch {
    // not in test
  }

  // Platform environment fallback (if configured globally for sandbox testing)
  if (process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD) {
    return {
      storeId: process.env.SSLCOMMERZ_STORE_ID,
      storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD,
      isSandbox: process.env.SSLCOMMERZ_IS_SANDBOX !== "false",
      isCustom: false,
    };
  }

  return null;
}

/**
 * Creates an SSLCommerz payment session.
 * POST {baseUrl}/gwprocess/v4/api.php
 */
export async function createSslCommerzSession(
  req: SslCommerzSessionInput,
): Promise<SslCommerzSessionResponse> {
  const isSandbox = req.isSandbox ?? true;
  const baseUrl = isSandbox ? DEFAULT_SSLCOMMERZ_SANDBOX_URL : DEFAULT_SSLCOMMERZ_LIVE_URL;

  if (!req.storeId || !req.storePassword) {
    throw new ValidationError("SSLCommerz credentials missing (storeId / storePassword)");
  }

  const params = new URLSearchParams();
  params.set("store_id", req.storeId);
  params.set("store_passwd", req.storePassword);
  params.set("total_amount", String(Number(req.totalAmount).toFixed(2)));
  params.set("currency", req.currency || "BDT");
  params.set("tran_id", req.orderId);
  params.set("success_url", req.successUrl);
  params.set("fail_url", req.failUrl);
  params.set("cancel_url", req.cancelUrl);
  params.set("ipn_url", req.ipnUrl);

  // Customer profile
  params.set("cus_name", req.customerName || "Customer");
  params.set("cus_email", req.customerEmail || `${req.customerPhone}@biztrackbd.test`);
  params.set("cus_add1", req.customerAddress || "Dhaka, Bangladesh");
  params.set("cus_city", req.customerCity || req.customerDistrict || "Dhaka");
  params.set("cus_postcode", "1000");
  params.set("cus_country", "Bangladesh");
  params.set("cus_phone", req.customerPhone);

  // Shipping
  params.set("shipping_method", "NO");
  params.set("num_of_item", "1");

  // Product info
  params.set("product_name", req.productName || `Order #${req.orderNumber}`);
  params.set("product_category", "E-commerce");
  params.set("product_profile", "general");

  // Custom metadata values
  params.set("value_a", req.tenantId);
  params.set("value_b", req.orderId);
  params.set("value_c", String(req.orderNumber));

  const res = await fetchImpl(`${baseUrl}/gwprocess/v4/api.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
    signal: AbortSignal.timeout(15000),
  });

  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    failedreason?: string;
    sessionkey?: string;
    GatewayPageURL?: string;
    redirectGatewayURL?: string;
  };

  const gatewayPageUrl = data.GatewayPageURL || data.redirectGatewayURL;

  if (!res.ok || data.status !== "SUCCESS" || !gatewayPageUrl) {
    throw new ValidationError(
      data.failedreason || `SSLCommerz session initialization failed (${res.status})`,
    );
  }

  return {
    status: "SUCCESS",
    sessionKey: data.sessionkey,
    gatewayPageUrl,
  };
}

/**
 * Validates an SSLCommerz transaction using the Validation API.
 * GET {baseUrl}/validator/api/validationserverAPI.php
 */
export async function verifySslCommerzPayment(opts: {
  storeId: string;
  storePassword: string;
  isSandbox: boolean;
  valId: string;
}): Promise<SslCommerzValidationResponse> {
  const baseUrl = opts.isSandbox ? DEFAULT_SSLCOMMERZ_SANDBOX_URL : DEFAULT_SSLCOMMERZ_LIVE_URL;
  const url = `${baseUrl}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(
    opts.valId,
  )}&store_id=${encodeURIComponent(opts.storeId)}&store_passwd=${encodeURIComponent(
    opts.storePassword,
  )}&v=1&format=json`;

  const res = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, any>;

  const status = (String(data.status || "").toUpperCase() as SslCommerzValidationResponse["status"]) || "FAILED";

  return {
    status,
    tranId: String(data.tran_id || ""),
    valId: String(data.val_id || opts.valId),
    amount: String(data.amount || "0"),
    storeAmount: data.store_amount ? String(data.store_amount) : undefined,
    currency: String(data.currency || "BDT"),
    bankTranId: data.bank_tran_id ? String(data.bank_tran_id) : undefined,
    cardType: data.card_type ? String(data.card_type) : undefined,
    cardIssuer: data.card_issuer ? String(data.card_issuer) : undefined,
    cardBrand: data.card_brand ? String(data.card_brand) : undefined,
    tranDate: data.tran_date ? String(data.tran_date) : undefined,
    tenantId: data.value_a ? String(data.value_a) : undefined,
    orderId: data.value_b ? String(data.value_b) : String(data.tran_id || ""),
    raw: data,
  };
}

/**
 * Processes an SSLCommerz payment callback or IPN.
 * Idempotently updates the order to PAID, CONFIRMED, and logs the timeline.
 */
export async function processSslCommerzOrderSuccess(
  tenantId: string,
  valId: string,
  ctx: { ip?: string | null; userAgent?: string | null; fbp?: string | null; fbc?: string | null; url?: string | null } = {},
): Promise<{ ok: boolean; orderId: string; orderNumber: string; status: string }> {
  const cfg = await getStoreSslCommerzConfig(tenantId);
  if (!cfg) {
    throw new ValidationError("SSLCommerz is not configured for this store");
  }

  const verified = await verifySslCommerzPayment({
    storeId: cfg.storeId,
    storePassword: cfg.storePassword,
    isSandbox: cfg.isSandbox,
    valId,
  });

  if (verified.status !== "VALID" && verified.status !== "VALIDATED") {
    return {
      ok: false,
      orderId: verified.orderId || verified.tranId,
      orderNumber: "",
      status: verified.status,
    };
  }

  const orderId = verified.orderId || verified.tranId;
  if (!orderId) {
    throw new ValidationError("Missing orderId in SSLCommerz verification response");
  }

  let orderNumber = "";

  await withTenant(tenantId, async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId } });
    if (!order) throw new NotFoundError("Order");

    orderNumber = order.orderNumber;

    // Safety check amount
    const orderTotal = Number(order.totalAmount);
    const paidAmount = Number(verified.amount);
    if (Math.abs(orderTotal - paidAmount) > 1.0) {
      console.warn(
        `SSLCommerz amount mismatch for order ${orderId}: expected ${orderTotal}, received ${paidAmount}`,
      );
    }

    if (order.paymentStatus !== "PAID") {
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: "PAID",
          status: "CONFIRMED", // Auto-confirm order as resolved in /grill-me
          paymentMethod: "GATEWAY_SSLCOMMERZ",
          mfsTrxId: verified.bankTranId || verified.valId,
          mfsSenderNumber: verified.cardBrand || verified.cardType || null,
          mfsVerifiedAt: new Date(),
          mfsVerifiedBy: "sslcommerz",
        },
      });

      await tx.orderStateLog.create({
        data: {
          tenantId,
          orderId,
          fromStatus: order.status,
          toStatus: "CONFIRMED",
          actorType: "SYSTEM",
          actorId: "sslcommerz",
          reason: `SSLCommerz payment confirmed (${verified.cardType || "Online"} - Bank Trx: ${
            verified.bankTranId || verified.valId
          })`,
        },
      });
    }
  });

  // Report the server purchase event for accurate conversion tracking
  sendServerPurchase(tenantId, orderId, ctx).catch(() => undefined);

  return { ok: true, orderId, orderNumber, status: "CONFIRMED" };
}
