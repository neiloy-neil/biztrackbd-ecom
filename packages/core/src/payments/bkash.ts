import { withTenant } from "@biztrackbd/db";
import { NotFoundError, ValidationError } from "../errors";
import { sendServerPurchase } from "../growth/tracking";
import { loadCredentials } from "../vault/integrations";

export const DEFAULT_BKASH_SANDBOX_URL = "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
export const DEFAULT_BKASH_LIVE_URL = "https://tokenized.pay.bka.sh/v1.2.0-beta";

let fetchImpl: typeof fetch = (...a) => fetch(...a);
export function setBkashFetchForTests(f: typeof fetch | undefined): void {
  fetchImpl = f ?? ((...a) => fetch(...a));
}

export interface BkashConfig {
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
  isSandbox: boolean;
  isCustom: boolean;
}

export interface BkashCreatePaymentInput {
  tenantId: string;
  orderId: string;
  orderNumber: number | string;
  amount: number | string;
  customerPhone: string;
  callbackUrl: string;
}

export interface BkashCreatePaymentResponse {
  status: "SUCCESS" | "FAILED";
  paymentId: string;
  bkashUrl: string;
  message?: string;
}

export interface BkashExecuteResponse {
  statusCode: string;
  statusMessage: string;
  paymentId: string;
  trxId?: string;
  amount?: string;
  currency?: string;
  customerMsisdn?: string;
  transactionStatus?: string;
  merchantInvoiceNumber?: string;
  raw?: Record<string, unknown>;
}

// In-memory token cache keyed by `appKey:mode`
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Loads merchant's Direct bKash credentials from vault.
 */
export async function getStoreBkashConfig(tenantId: string): Promise<BkashConfig | null> {
  // Check LIVE mode
  try {
    const live = await loadCredentials(tenantId, "BKASH_DIRECT", "LIVE");
    if (
      live &&
      live.secrets?.appKey &&
      live.secrets?.appSecret &&
      live.secrets?.username &&
      live.secrets?.password
    ) {
      const isSandbox = String(live.config?.isSandbox || "").toLowerCase() === "true";
      return {
        appKey: live.secrets.appKey,
        appSecret: live.secrets.appSecret,
        username: live.secrets.username,
        password: live.secrets.password,
        isSandbox,
        isCustom: true,
      };
    }
  } catch {
    // not in live
  }

  // Check TEST mode
  try {
    const test = await loadCredentials(tenantId, "BKASH_DIRECT", "TEST");
    if (
      test &&
      test.secrets?.appKey &&
      test.secrets?.appSecret &&
      test.secrets?.username &&
      test.secrets?.password
    ) {
      return {
        appKey: test.secrets.appKey,
        appSecret: test.secrets.appSecret,
        username: test.secrets.username,
        password: test.secrets.password,
        isSandbox: true,
        isCustom: true,
      };
    }
  } catch {
    // not in test
  }

  // Platform fallback (for platform sandbox test environment)
  if (
    process.env.BKASH_APP_KEY &&
    process.env.BKASH_APP_SECRET &&
    process.env.BKASH_USERNAME &&
    process.env.BKASH_PASSWORD
  ) {
    return {
      appKey: process.env.BKASH_APP_KEY,
      appSecret: process.env.BKASH_APP_SECRET,
      username: process.env.BKASH_USERNAME,
      password: process.env.BKASH_PASSWORD,
      isSandbox: process.env.BKASH_IS_SANDBOX !== "false",
      isCustom: false,
    };
  }

  return null;
}

/**
 * Grants an ID token from bKash, reusing active cached tokens where possible.
 */
export async function grantBkashToken(cfg: BkashConfig): Promise<string> {
  const cacheKey = `${cfg.appKey}:${cfg.isSandbox ? "sandbox" : "live"}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const baseUrl = cfg.isSandbox ? DEFAULT_BKASH_SANDBOX_URL : DEFAULT_BKASH_LIVE_URL;
  const res = await fetchImpl(`${baseUrl}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: cfg.username,
      password: cfg.password,
    },
    body: JSON.stringify({
      app_key: cfg.appKey,
      app_secret: cfg.appSecret,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const data = (await res.json().catch(() => ({}))) as {
    statusCode?: string;
    statusMessage?: string;
    id_token?: string;
    expires_in?: number;
  };

  if (!res.ok || data.statusCode !== "0000" || !data.id_token) {
    throw new ValidationError(
      data.statusMessage || `bKash token grant failed (${res.status} ${data.statusCode || ""})`,
    );
  }

  // Cache token with a 2-minute safety buffer
  const expiresInSec = data.expires_in || 3600;
  tokenCache.set(cacheKey, {
    token: data.id_token,
    expiresAt: Date.now() + Math.max(60, expiresInSec - 120) * 1000,
  });

  return data.id_token;
}

/**
 * Creates a bKash checkout session and returns the payment URL.
 */
export async function createBkashPayment(
  cfg: BkashConfig,
  req: BkashCreatePaymentInput,
): Promise<BkashCreatePaymentResponse> {
  const idToken = await grantBkashToken(cfg);
  const baseUrl = cfg.isSandbox ? DEFAULT_BKASH_SANDBOX_URL : DEFAULT_BKASH_LIVE_URL;

  const body = {
    mode: "0011",
    payerReference: req.customerPhone || "01700000000",
    callbackURL: req.callbackUrl,
    amount: String(Number(req.amount).toFixed(2)),
    currency: "BDT",
    intent: "sale",
    merchantInvoiceNumber: String(req.orderNumber || req.orderId),
  };

  const res = await fetchImpl(`${baseUrl}/tokenized/checkout/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: idToken,
      "X-APP-Key": cfg.appKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  const data = (await res.json().catch(() => ({}))) as {
    statusCode?: string;
    statusMessage?: string;
    paymentID?: string;
    bkashURL?: string;
  };

  if (!res.ok || data.statusCode !== "0000" || !data.bkashURL || !data.paymentID) {
    throw new ValidationError(
      data.statusMessage || `bKash payment creation failed (${res.status} ${data.statusCode || ""})`,
    );
  }

  return {
    status: "SUCCESS",
    paymentId: data.paymentID,
    bkashUrl: data.bkashURL,
  };
}

/**
 * Executes a bKash payment after the customer has entered their PIN/OTP.
 */
export async function executeBkashPayment(
  cfg: BkashConfig,
  paymentId: string,
): Promise<BkashExecuteResponse> {
  const idToken = await grantBkashToken(cfg);
  const baseUrl = cfg.isSandbox ? DEFAULT_BKASH_SANDBOX_URL : DEFAULT_BKASH_LIVE_URL;

  const res = await fetchImpl(`${baseUrl}/tokenized/checkout/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: idToken,
      "X-APP-Key": cfg.appKey,
    },
    body: JSON.stringify({ paymentID: paymentId }),
    signal: AbortSignal.timeout(18000),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, any>;

  return {
    statusCode: String(data.statusCode || (res.ok ? "0000" : "ERROR")),
    statusMessage: String(data.statusMessage || ""),
    paymentId: String(data.paymentID || paymentId),
    trxId: data.trxID ? String(data.trxID) : undefined,
    amount: data.amount ? String(data.amount) : undefined,
    currency: data.currency ? String(data.currency) : undefined,
    customerMsisdn: data.customerMsisdn ? String(data.customerMsisdn) : undefined,
    transactionStatus: data.transactionStatus ? String(data.transactionStatus) : undefined,
    merchantInvoiceNumber: data.merchantInvoiceNumber ? String(data.merchantInvoiceNumber) : undefined,
    raw: data,
  };
}

/**
 * Queries a bKash payment by paymentID to verify status.
 */
export async function queryBkashPayment(
  cfg: BkashConfig,
  paymentId: string,
): Promise<BkashExecuteResponse> {
  const idToken = await grantBkashToken(cfg);
  const baseUrl = cfg.isSandbox ? DEFAULT_BKASH_SANDBOX_URL : DEFAULT_BKASH_LIVE_URL;

  const res = await fetchImpl(`${baseUrl}/tokenized/checkout/payment/search/${paymentId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: idToken,
      "X-APP-Key": cfg.appKey,
    },
    signal: AbortSignal.timeout(12000),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, any>;

  return {
    statusCode: String(data.statusCode || (res.ok ? "0000" : "ERROR")),
    statusMessage: String(data.statusMessage || ""),
    paymentId: String(data.paymentID || paymentId),
    trxId: data.trxID ? String(data.trxID) : undefined,
    amount: data.amount ? String(data.amount) : undefined,
    currency: data.currency ? String(data.currency) : undefined,
    customerMsisdn: data.customerMsisdn ? String(data.customerMsisdn) : undefined,
    transactionStatus: data.transactionStatus ? String(data.transactionStatus) : undefined,
    merchantInvoiceNumber: data.merchantInvoiceNumber ? String(data.merchantInvoiceNumber) : undefined,
    raw: data,
  };
}

/**
 * Completes an order payment when bKash redirects with paymentID.
 */
export async function processBkashOrderSuccess(
  tenantId: string,
  paymentId: string,
  orderId: string,
  ctx: { ip?: string | null; userAgent?: string | null; fbp?: string | null; fbc?: string | null; url?: string | null } = {},
): Promise<{ ok: boolean; orderId: string; orderNumber: string; trxId?: string; status: string }> {
  const cfg = await getStoreBkashConfig(tenantId);
  if (!cfg) {
    throw new ValidationError("Direct bKash is not configured for this store");
  }

  // Execute payment with bKash
  let execResult = await executeBkashPayment(cfg, paymentId);

  // If already executed or status is 2062/0000, verify via query
  if (execResult.statusCode !== "0000") {
    const queried = await queryBkashPayment(cfg, paymentId).catch(() => null);
    if (queried && queried.statusCode === "0000" && queried.trxId) {
      execResult = queried;
    } else {
      return {
        ok: false,
        orderId,
        orderNumber: "",
        status: execResult.statusMessage || "FAILED",
      };
    }
  }

  let orderNumber = "";

  await withTenant(tenantId, async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId } });
    if (!order) throw new NotFoundError("Order");

    orderNumber = order.orderNumber;

    if (order.paymentStatus !== "PAID") {
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: "PAID",
          status: "CONFIRMED", // Auto-confirm order as resolved in /grill-me
          paymentMethod: "GATEWAY_BKASH",
          mfsTrxId: execResult.trxId || paymentId,
          mfsSenderNumber: execResult.customerMsisdn || null,
          mfsVerifiedAt: new Date(),
          mfsVerifiedBy: "bkash_direct",
        },
      });

      await tx.orderStateLog.create({
        data: {
          tenantId,
          orderId,
          fromStatus: order.status,
          toStatus: "CONFIRMED",
          actorType: "SYSTEM",
          actorId: "bkash_direct",
          reason: `bKash Direct tokenized payment confirmed (TrxID: ${execResult.trxId || paymentId})`,
        },
      });
    }
  });

  // Report conversion tracking
  sendServerPurchase(tenantId, orderId, ctx).catch(() => undefined);

  return {
    ok: true,
    orderId,
    orderNumber,
    trxId: execResult.trxId,
    status: "CONFIRMED",
  };
}
