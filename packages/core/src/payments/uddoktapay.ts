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
 * A customer paying a store: `origin` is the store's own address (the store is found from the host).
 */
export function uddoktaPayUrls(kind: "store", origin: string): { webhook: string; returnUrl: string } {
  const base = origin.trim().replace(/\/+$/, "");
  void kind;
  return { webhook: `${base}/api/payments/uddoktapay/webhook`, returnUrl: `${base}/api/payments/uddoktapay/callback` };
}

/**
 * A store paying BizTrackBD for its plan. The webhook is on the PLATFORM app: only it connects with the role that may write
 * subscriptions (the store apps' role cannot). The customer comes back to the ADMIN app, which only shows the result.
 */
export function uddoktaPayPlanUrls(adminOrigin: string, platformOrigin: string): { webhook: string; returnUrl: string } {
  const trim = (o: string) => o.trim().replace(/\/+$/, "");
  return { webhook: `${trim(platformOrigin)}/api/webhooks/uddoktapay`, returnUrl: `${trim(adminOrigin)}/api/billing/uddoktapay/callback` };
}

/** platform.<root domain> in production, localhost:3003 in development. */
export function platformOriginFor(rootDomain: string | undefined): string {
  const root = (rootDomain || (process.env.NODE_ENV === "production" ? "biztrack.bd" : "localhost:3000")).trim();
  return root.startsWith("localhost") ? "http://localhost:3003" : `https://platform.${root}`;
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

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const data = (raw.data && typeof raw.data === "object" ? raw.data : raw) as Record<string, unknown>;

  let metadata = data.metadata as Record<string, string> | undefined;
  if (typeof metadata === "string") {
    try {
      metadata = JSON.parse(metadata) as Record<string, string>;
    } catch {
      metadata = undefined;
    }
  }

  const statusRaw = String(data.status ?? raw.status ?? "");
  const status: "COMPLETED" | "PENDING" | "ERROR" =
    statusRaw.toUpperCase() === "COMPLETED"
      ? "COMPLETED"
      : statusRaw.toUpperCase() === "ERROR"
        ? "ERROR"
        : res.ok
          ? "PENDING"
          : "ERROR";

  return {
    status,
    fullName: data.full_name as string | undefined,
    email: data.email as string | undefined,
    amount: data.amount ? String(data.amount) : undefined,
    fee: data.fee ? String(data.fee) : undefined,
    chargedAmount: data.charged_amount ? String(data.charged_amount) : undefined,
    invoiceId: (data.invoice_id ?? raw.invoice_id) as string | undefined,
    metadata,
    paymentMethod: data.payment_method as string | undefined,
    senderNumber: data.sender_number as string | undefined,
    transactionId: data.transaction_id as string | undefined,
    date: data.date as string | undefined,
    message: (data.message ?? raw.message) as string | undefined,
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
  // A store that has not saved its own UddoktaPay keys has no online payment. Never fall back to BizTrackBD's own key here: customers'
  // money would land in BizTrackBD's account instead of the store's.
  return {
    apiKey: "",
    baseUrl: DEFAULT_UDDOKTAPAY_BASE_URL,
    isCustom: false,
  };
}

/**
 * BizTrackBD's own UddoktaPay account, used only for plan payments (never for a store's customers). Saved in Platform Admin ->
 * Settings -> Payment Gateway; the UDDOKTAPAY_* environment variables are the fallback. Null when neither is set.
 */
export async function getPlatformUddoktaPayCredentials(): Promise<{ apiKey: string; baseUrl: string } | null> {
  let rows: { key: string; value: string }[] = [];
  try {
    rows = await getPlatformPrisma().platformConfig.findMany({ where: { key: { in: ["uddoktapay_api_key", "uddoktapay_base_url"] } }, select: { key: true, value: true } });
  } catch {
    // The database being unreachable falls through to the environment.
  }
  const saved = new Map(rows.map((r) => [r.key, r.value.trim()]));
  const apiKey = saved.get("uddoktapay_api_key") || DEFAULT_UDDOKTAPAY_API_KEY;
  if (!apiKey) return null;
  return { apiKey, baseUrl: saved.get("uddoktapay_base_url") || DEFAULT_UDDOKTAPAY_BASE_URL };
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
  if (!cfg.isCustom) throw new ValidationError("Online payment is not set up for this store");
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
 * Looks the plan payment up at the gateway and reports what it says. Writes nothing: the admin app uses it on the page the payer
 * returns to, and the platform webhook does the activation.
 */
export async function checkUddoktaPayPlanInvoice(invoiceId: string): Promise<{ ok: boolean; status: string; tenantId: string; plan: string }> {
  const platform = await getPlatformUddoktaPayCredentials();
  if (!platform) throw new ValidationError("Online payment is not set up");
  const verified = await verifyUddoktaPayPayment({ apiKey: platform.apiKey, baseUrl: platform.baseUrl, invoiceId });
  return { ok: verified.status === "COMPLETED", status: verified.status, tenantId: verified.metadata?.tenantId || "", plan: verified.metadata?.plan || "" };
}

/**
 * Processes a completed store subscription payment for platform billing. Runs in the PLATFORM app (it writes subscriptions).
 */
export async function processUddoktaPaySubscriptionSuccess(
  invoiceId: string,
  ctx: { ip?: string | null; userAgent?: string | null; fbp?: string | null; fbc?: string | null } = {},
): Promise<{ ok: boolean; tenantId: string; plan: string }> {
  const platform = await getPlatformUddoktaPayCredentials();
  if (!platform) throw new ValidationError("Online payment is not set up");
  const verified = await verifyUddoktaPayPayment({
    apiKey: platform.apiKey,
    baseUrl: platform.baseUrl,
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

      // Update tenant status and sync active plan tier
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          status: "ACTIVE",
          planTier: planTier as "STARTER" | "PRO" | "BUSINESS",
        },
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
        // The browser's details were attached to the charge when the payer started it; the webhook itself has no browser.
        user: {
          ip: ctx.ip ?? verified.metadata?.ip ?? null,
          userAgent: ctx.userAgent ?? verified.metadata?.ua ?? null,
          fbp: ctx.fbp ?? verified.metadata?.fbp ?? null,
          fbc: ctx.fbc ?? verified.metadata?.fbc ?? null,
        },
      }),
      metadata: { tenantId, invoiceId },
      immediateDispatch: true,
    }).catch((err) => {
      console.warn("[uddoktapay] Meta Purchase dispatch warning:", err instanceof Error ? err.message : err);
    });
  }

  return { ok: true, tenantId, plan: planTier };
}

/**
 * Dispatches a server-to-server webhook request to the platform app so that the subscription
 * is activated with the platform database role before the merchant's browser reaches the billing page.
 */
export async function notifyPlatformSubscriptionPayment(invoiceId: string, platformOrigin: string): Promise<boolean> {
  try {
    const target = `${platformOrigin.trim().replace(/\/+$/, "")}/api/webhooks/uddoktapay`;
    const res = await fetchImpl(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ invoice_id: invoiceId }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      console.warn(`[notifyPlatformSubscriptionPayment] platform answered status ${res.status}`);
      return false;
    }
    const data = (await res.json().catch(() => ({}))) as { status?: boolean };
    return Boolean(data.status);
  } catch (err) {
    console.error("[notifyPlatformSubscriptionPayment] failed to contact platform webhook:", err instanceof Error ? err.message : err);
    return false;
  }
}
