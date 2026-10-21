import { withTenant, getPlatformPrisma, type OrderStatus, type Prisma } from "@biztrackbd/db";
import { NotFoundError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { sendServerPurchase } from "../growth/tracking";
import { loadCredentials } from "../vault/integrations";
import { enqueueNotificationJob } from "../messaging/queue";

// The shared sandbox address and its public test key exist for development only. In production a store without its own keys must not be
// offered online payment, or shoppers would be sent to a sandbox where any made-up transaction id marks the order paid.
const IS_PRODUCTION = process.env.NODE_ENV === "production";

export const DEFAULT_UDDOKTAPAY_BASE_URL =
  process.env.UDDOKTAPAY_BASE_URL || (IS_PRODUCTION ? "https://pay.uddoktapay.com" : "https://sandbox.uddoktapay.com");

export const DEFAULT_UDDOKTAPAY_API_KEY =
  process.env.UDDOKTAPAY_API_KEY || (IS_PRODUCTION ? "" : "982d381360a69d419689740d9f2e26ce36fb7a50");

let fetchImpl: typeof fetch = (...a) => fetch(...a);
export function setUddoktaPayFetchForTests(f: typeof fetch | undefined): void {
  fetchImpl = f ?? ((...a) => fetch(...a));
}

export interface UddoktaPayChargeRequest {
  apiKey?: string;
  baseUrl?: string;
  fullName: string;
  email: string;
  amount: number | string;
  metadata: Record<string, string>;
  redirectUrl: string;
  cancelUrl: string;
  webhookUrl?: string;
  returnType?: "GET" | "POST";
}

export interface UddoktaPayChargeResponse {
  status: boolean;
  message?: string;
  paymentUrl: string;
}

export interface UddoktaPayVerifyResponse {
  status: "COMPLETED" | "PENDING" | "ERROR";
  fullName?: string;
  email?: string;
  amount?: string;
  fee?: string;
  chargedAmount?: string;
  invoiceId?: string;
  metadata?: Record<string, string>;
  paymentMethod?: string;
  senderNumber?: string;
  transactionId?: string;
  date?: string;
  message?: string;
}

/**
 * Accepts what people actually paste into settings: "biztrack.paymently.io", "https://x.io/", "https://x.io/api".
 * Returns the origin-style base the endpoints are appended to ("https://x.io"), or throws if it is not a URL.
 */
export function normalizeUddoktaPayBaseUrl(raw: string): string {
  let v = raw.trim();
  if (!v) throw new ValidationError("UddoktaPay base URL is empty");
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  // People paste the panel's "Base URL" (.../api) or even a full endpoint (.../api/checkout-v2). The code adds the endpoint itself.
  v = v.replace(/\/+$/, "").replace(/\/api(?:\/(?:checkout(?:-v2)?|verify-payment|refund-payment))?$/i, "");
  try {
    const u = new URL(v);
    if (!u.hostname.includes(".") && u.hostname !== "localhost") throw new Error("host");
  } catch {
    throw new ValidationError("UddoktaPay base URL is not a valid address, e.g. https://pay.example.com");
  }
  return v;
}

/**
 * The two addresses UddoktaPay uses after a payment: where it sends the customer back, and where it reports the result without the
 * customer's browser. Both are sent with every charge, so nothing has to be set in the UddoktaPay panel; they are shown to owners only
 * as a reference, or to paste as the panel's default.
 *  - "plan": a store paying BizTrackBD for its plan. `origin` is the admin address.
 *  - "store": a customer paying a store. `origin` is the store's own address (the store is found from the host).
 */
export function uddoktaPayUrls(kind: "plan" | "store", origin: string): { webhook: string; returnUrl: string } {
  const base = origin.trim().replace(/\/+$/, "");
  return kind === "plan"
    ? { webhook: `${base}/api/webhooks/uddoktapay`, returnUrl: `${base}/api/billing/uddoktapay/callback` }
    : { webhook: `${base}/api/payments/uddoktapay/webhook`, returnUrl: `${base}/api/payments/uddoktapay/callback` };
}

/**
 * Creates an UddoktaPay automated checkout charge.
 * POST {base_URL}/api/checkout-v2
 */
export async function createUddoktaPayCharge(
  req: UddoktaPayChargeRequest,
): Promise<UddoktaPayChargeResponse> {
  const baseUrl = normalizeUddoktaPayBaseUrl(req.baseUrl || DEFAULT_UDDOKTAPAY_BASE_URL);
  const apiKey = req.apiKey || DEFAULT_UDDOKTAPAY_API_KEY;
  if (!apiKey) throw new ValidationError("Online payment is not set up for this store");

  const body = {
    full_name: req.fullName || "Customer",
    email: req.email || "support@biztrack.bd",
    amount: String(req.amount),
    metadata: req.metadata,
    redirect_url: req.redirectUrl,
    cancel_url: req.cancelUrl,
    return_type: req.returnType || "GET",
    ...(req.webhookUrl ? { webhook_url: req.webhookUrl } : {}),
  };

  const res = await fetchImpl(`${baseUrl}/api/checkout-v2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "RT-UDDOKTAPAY-API-KEY": apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  const data = (await res.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    payment_url?: string;
  };

  if (!res.ok || !data.payment_url) {
    throw new ValidationError(
      data.message || `UddoktaPay charge creation failed (${res.status})`,
    );
  }

  return {
    status: Boolean(data.status),
    message: data.message,
    paymentUrl: data.payment_url,
  };
}

/**
 * Verifies an UddoktaPay payment invoice.
 * POST {base_URL}/api/verify-payment
 */
export async function verifyUddoktaPayPayment(opts: {
  apiKey?: string;
  baseUrl?: string;
  invoiceId: string;
}): Promise<UddoktaPayVerifyResponse> {
  const baseUrl = normalizeUddoktaPayBaseUrl(opts.baseUrl || DEFAULT_UDDOKTAPAY_BASE_URL);
  const apiKey = opts.apiKey || DEFAULT_UDDOKTAPAY_API_KEY;
  if (!apiKey) throw new ValidationError("Online payment is not set up for this store");

  const res = await fetchImpl(`${baseUrl}/api/verify-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "RT-UDDOKTAPAY-API-KEY": apiKey,
    },
    body: JSON.stringify({ invoice_id: opts.invoiceId }),
    signal: AbortSignal.timeout(10000),
  });

  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    full_name?: string;
    email?: string;
    amount?: string;
    fee?: string;
    charged_amount?: string;
    invoice_id?: string;
    metadata?: Record<string, string>;
    payment_method?: string;
    sender_number?: string;
    transaction_id?: string;
    date?: string;
    message?: string;
  };

  return {
    status: (data.status as "COMPLETED" | "PENDING" | "ERROR") || (res.ok ? "PENDING" : "ERROR"),
    fullName: data.full_name,
    email: data.email,
    amount: data.amount,
    fee: data.fee,
    chargedAmount: data.charged_amount,
    invoiceId: data.invoice_id,
    metadata: data.metadata,
    paymentMethod: data.payment_method,
    senderNumber: data.sender_number,
    transactionId: data.transaction_id,
    date: data.date,
    message: data.message,
  };
}

/**
 * Loads merchant's UddoktaPay credentials if custom ones are saved in vault or store settings.
 */
export async function getStoreUddoktaPayConfig(tenantId: string): Promise<{
  apiKey: string;
  baseUrl: string;
  isCustom: boolean;
}> {
  try {
    const live = await loadCredentials(tenantId, "UDDOKTAPAY", "LIVE");
    if (live && live.secrets?.apiKey) {
      return {
        apiKey: live.secrets.apiKey,
        baseUrl: String(live.config?.baseUrl || "https://pay.uddoktapay.com"),
        isCustom: true,
      };
    }
  } catch {
    // not configured in live mode
  }
  try {
    const test = await loadCredentials(tenantId, "UDDOKTAPAY", "TEST");
    if (test && test.secrets?.apiKey) {
      return {
        apiKey: test.secrets.apiKey,
        baseUrl: String(test.config?.baseUrl || DEFAULT_UDDOKTAPAY_BASE_URL),
        isCustom: true,
      };
    }
  } catch {
    // not configured in test mode
  }
  return {
    apiKey: DEFAULT_UDDOKTAPAY_API_KEY,
    baseUrl: DEFAULT_UDDOKTAPAY_BASE_URL,
    isCustom: false,
  };
}

/**
 * Processes a completed shopper payment for a storefront order.
 */
export async function processUddoktaPayOrderSuccess(
  tenantId: string,
  invoiceId: string,
  ctx: { ip?: string | null; userAgent?: string | null; fbp?: string | null; fbc?: string | null; url?: string | null } = {},
): Promise<{ ok: boolean; orderId: string; status: string }> {
  const cfg = await getStoreUddoktaPayConfig(tenantId);
  const verified = await verifyUddoktaPayPayment({
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl,
    invoiceId,
  });

  if (verified.status !== "COMPLETED") {
    return {
      ok: false,
      orderId: verified.metadata?.orderId || verified.metadata?.order_id || "",
      status: verified.status,
    };
  }

  const orderId = verified.metadata?.orderId || verified.metadata?.order_id;
  if (!orderId) {
    throw new ValidationError("Missing orderId in payment metadata");
  }

  await withTenant(tenantId, async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId } });
    if (!order) throw new NotFoundError("Order");

    if (order.paymentStatus !== "PAID") {
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: "PAID",
          paymentMethod: "GATEWAY_UDDOKTAPAY",
          mfsTrxId: verified.transactionId || invoiceId,
          mfsSenderNumber: verified.senderNumber || null,
          mfsVerifiedAt: new Date(),
          mfsVerifiedBy: "uddoktapay",
        },
      });

      await tx.orderStateLog.create({
        data: {
          tenantId,
          orderId,
          fromStatus: order.status,
          toStatus: order.status,
          actorType: "SYSTEM",
          actorId: "uddoktapay",
          reason: `Automated UddoktaPay payment (${verified.paymentMethod || "online"} - Trx: ${verified.transactionId})`,
        },
      });
    }
  });

  // Report the server purchase event for accurate tracking
  sendServerPurchase(tenantId, orderId, ctx).catch(() => undefined);

  return { ok: true, orderId, status: "COMPLETED" };
}

/**
 * Processes a completed store subscription payment for platform billing.
 */
export async function processUddoktaPaySubscriptionSuccess(
  invoiceId: string,
  ctx: { ip?: string | null; userAgent?: string | null; fbp?: string | null; fbc?: string | null } = {},
): Promise<{ ok: boolean; tenantId: string; plan: string }> {
  const verified = await verifyUddoktaPayPayment({
    apiKey: DEFAULT_UDDOKTAPAY_API_KEY,
    baseUrl: DEFAULT_UDDOKTAPAY_BASE_URL,
    invoiceId,
  });

  if (verified.status !== "COMPLETED") {
    return {
      ok: false,
      tenantId: verified.metadata?.tenantId || "",
      plan: verified.metadata?.plan || "",
    };
  }

  const tenantId = verified.metadata?.tenantId;
  const planTier = verified.metadata?.plan || "PRO";
  const interval = verified.metadata?.interval === "YEARLY" ? "YEARLY" : "MONTHLY";

  if (!tenantId) throw new ValidationError("Missing tenantId in subscription metadata");

  const db = getPlatformPrisma();
  let firstTimeSeen = false;
  let owner: { email: string | null; phone: string | null; name: string | null } = { email: null, phone: null, name: null };
  try {
    await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) throw new NotFoundError("Tenant");
      owner = { email: tenant.ownerEmail, phone: tenant.ownerPhone, name: tenant.ownerName };

      // The return page, the gateway's webhook and a replay can all report the same payment. Apply it once: a repeat must not push the
      // paid-until date out again.
      const trxId = verified.transactionId || invoiceId;
      const existingProof = await tx.paymentProof.findUnique({ where: { trxId } });
      if (existingProof) return;
      firstTimeSeen = true;

      const now = new Date();
      const periodEnd = new Date(now);
      if (interval === "YEARLY") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      // Upsert subscription
      await tx.subscription.upsert({
        where: { tenantId },
        create: {
          tenantId,
          planTier: planTier as "STARTER" | "PRO" | "BUSINESS",
          interval,
          status: "ACTIVE",
          amount: Number(verified.amount || "1990"),
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          gateway: "UDDOKTAPAY",
          cancelAtPeriodEnd: false,
        },
        update: {
          planTier: planTier as "STARTER" | "PRO" | "BUSINESS",
          interval,
          status: "ACTIVE",
          amount: Number(verified.amount || "1990"),
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          gateway: "UDDOKTAPAY",
          cancelAtPeriodEnd: false,
        },
      });

      // Create payment proof record marked APPROVED
      const rawMethod = (verified.paymentMethod || "").toUpperCase();
      const mfsProvider: "BKASH" | "NAGAD" | "ROCKET" | "UPAY" =
        rawMethod.includes("NAGAD") ? "NAGAD"
        : rawMethod.includes("ROCKET") ? "ROCKET"
        : rawMethod.includes("UPAY") ? "UPAY"
        : "BKASH";
      const senderNumber =
        verified.senderNumber && verified.senderNumber.length >= 11
          ? verified.senderNumber
          : "01700000000";

      await tx.paymentProof.create({
        data: {
          tenantId,
          planTier: planTier as "STARTER" | "PRO" | "BUSINESS",
          billingPeriod: interval,
          amount: Number(verified.amount || "1990"),
          mfsProvider,
          senderNumber,
          trxId,
          status: "APPROVED",
          note: `UddoktaPay automated checkout (${verified.paymentMethod || "online"} - Invoice: ${invoiceId})`,
          approvedAt: now,
          appliedTo: periodEnd,
        },
      });

      // Update tenant status if trial/past due
      await tx.tenant.update({
        where: { id: tenantId },
        data: { status: "ACTIVE" },
      });
    });
  } catch (err) {
    // Two requests for the same payment at the same instant: the other one applied it (the proof's transaction id is unique).
    if ((err as { code?: string }).code !== "P2002") throw err;
    firstTimeSeen = false;
  }

  // Tell Meta once per payment (a refreshed callback page finds the proof already stored). Never blocks the customer.
  if (firstTimeSeen) {
    enqueueNotificationJob({
      tenantId: "platform",
      recipient: "META_CAPI",
      channel: "META_CAPI",
      event: "Purchase",
      body: JSON.stringify({
        tenantId,
        invoiceId,
        plan: planTier,
        interval,
        value: Number(verified.amount || 0),
        paymentMethod: verified.paymentMethod || null,
        ownerEmail: owner.email,
        ownerPhone: owner.phone,
        ownerName: owner.name,
        user: { ip: ctx.ip, userAgent: ctx.userAgent, fbp: ctx.fbp, fbc: ctx.fbc },
      }),
      metadata: { tenantId, invoiceId },
      immediateDispatch: true,
    }).catch((err) => {
      console.warn("[uddoktapay] Meta Purchase dispatch warning:", err instanceof Error ? err.message : err);
    });
  }

  return { ok: true, tenantId, plan: planTier };
}
