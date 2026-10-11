import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { randomUUID } from "node:crypto";
import { withTenant } from "@biztrackbd/db";
import { DomainError, ValidationError } from "../errors";
import { normalizeBdPhone } from "../phone";
import { smsSenderFromEnv } from "../growth/sms";

/**
 * Customer sign-in by one-time code (StrAccount). Customers are identified by their mobile number, which they prove
 * by receiving an SMS. No passwords.
 *
 * Abuse controls, because every code costs an SMS and an unlimited guesser could take over an account:
 *   - codes are 6 digits, valid 5 minutes, usable once, and only a keyed hash is stored
 *   - 5 wrong guesses kill the code
 *   - at most 3 codes per phone per 15 minutes, and 10 per IP per hour
 *   - the response never says whether a number has an account or is blocked
 */

export class RateLimitError extends DomainError {
  constructor(readonly retryAfterSeconds: number) {
    super("RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.", 429, { retryAfterSeconds });
  }
}

export interface SmsSender {
  send(tenantId: string, to: string, text: string): Promise<void>;
}

let smsSender: SmsSender = {
  async send(tenantId, to, text) {
    // The platform's shared SMS account, when its token is set. Otherwise development logs the message.
    // A test outbox (DEV_SMS_OUTBOX) always wins: tests must never send a real message.
    const real = process.env.DEV_SMS_OUTBOX ? null : smsSenderFromEnv();
    if (real) return real.send(tenantId, to, text);
    if (process.env.NODE_ENV === "production") throw new Error("No SMS provider is configured");
    // Development only: the code appears in the server log instead of a phone. End-to-end tests set DEV_SMS_OUTBOX
    // to a file path so they can read the code back.
    console.log(`[dev sms] to ${to}: ${text}`);
    if (process.env.DEV_SMS_OUTBOX) {
      const { appendFile } = await import("node:fs/promises");
      await appendFile(process.env.DEV_SMS_OUTBOX, `${JSON.stringify({ to, text })}
`);
    }
  },
};

/** Swap in a fake in tests. The default is the provider named by SMS_PROVIDER (sms.net.bd or Greenweb) when its key is set, a log line in development. */
export function setSmsSender(s: SmsSender): void {
  smsSender = s;
}

export function currentSmsSender(): SmsSender {
  return smsSender;
}

const CODE_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;
const PER_PHONE = { max: 3, windowMs: 15 * 60_000 };
const PER_IP = { max: 10, windowMs: 60 * 60_000 };
const BAD_CODE = "That code is not right or has expired. Request a new one.";

function secret(): string {
  const s = process.env.CUSTOMER_AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("CUSTOMER_AUTH_SECRET must be set to at least 32 characters");
  return s;
}

const hashCode = (tenantId: string, phone: string, code: string, key = secret()) =>
  createHmac("sha256", key).update(`otp|${tenantId}|${phone}|${code}`).digest("hex");

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export interface RequestOtpContext {
  ip?: string;
  /** Store name for the SMS text. */
  storeName?: string;
}

/** Sends a code. Always resolves the same way for valid numbers, so it cannot be used to find out who is a customer. */
export async function requestOtp(tenantId: string, rawPhone: string, ctx: RequestOtpContext = {}): Promise<{ sent: true; expiresInSeconds: number }> {
  const phone = normalizeBdPhone(rawPhone);
  const now = Date.now();

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const deliver = await withTenant(tenantId, async (tx) => {
    // One query at a time: a transaction owns a single connection, and overlapping queries on it are deprecated in pg.
    const byPhone = await tx.customerOtp.count({ where: { phone, createdAt: { gt: new Date(now - PER_PHONE.windowMs) } } });
    const byIp = ctx.ip ? await tx.customerOtp.count({ where: { ipAddress: ctx.ip, createdAt: { gt: new Date(now - PER_IP.windowMs) } } }) : 0;
    if (byPhone >= PER_PHONE.max) throw new RateLimitError(Math.ceil(PER_PHONE.windowMs / 1000));
    if (byIp >= PER_IP.max) throw new RateLimitError(Math.ceil(PER_IP.windowMs / 1000));

    // A new code replaces any earlier one still open.
    await tx.customerOtp.updateMany({ where: { phone, consumedAt: null }, data: { consumedAt: new Date() } });
    await tx.customerOtp.create({
      data: { tenantId, phone, codeHash: hashCode(tenantId, phone, code), expiresAt: new Date(now + CODE_TTL_MS), ipAddress: ctx.ip },
    });
    // Blocked contacts get the same response but no SMS.
    return !(await tx.blockedContact.findFirst({ where: { phone } }));
  });

  if (deliver) {
    await smsSender.send(tenantId, phone, `${code} is your ${ctx.storeName ?? "store"} sign-in code. It works for 5 minutes. Do not share it.`);
  }
  return { sent: true, expiresInSeconds: CODE_TTL_MS / 1000 };
}

/** Checks a code. On success returns the customer (created on first sign-in). Every failure gives the same message. */
export async function verifyOtp(tenantId: string, rawPhone: string, rawCode: string): Promise<{ customerId: string; phone: string; name: string }> {
  let phone: string;
  try {
    phone = normalizeBdPhone(rawPhone);
  } catch {
    throw new ValidationError(BAD_CODE);
  }
  const code = rawCode.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) throw new ValidationError(BAD_CODE);

  // Failures are returned, not thrown, from inside the transaction. Throwing would roll it back, and with it the
  // wrong-guess counter, which would let someone guess forever.
  const outcome = await withTenant(tenantId, async (tx) => {
    const otp = await tx.customerOtp.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: "desc" },
    });
    if (!otp) return null;

    if (!safeEqual(otp.codeHash, hashCode(tenantId, phone, code))) {
      // Counted atomically so parallel guesses cannot beat the limit.
      await tx.$executeRaw`UPDATE "CustomerOtp" SET "attempts" = "attempts" + 1 WHERE "id" = ${otp.id}`;
      return null;
    }
    // One-time: only the request that flips consumedAt wins.
    const claimed = await tx.customerOtp.updateMany({ where: { id: otp.id, consumedAt: null, attempts: { lt: MAX_ATTEMPTS } }, data: { consumedAt: new Date() } });
    if (claimed.count === 0) return null;

    const [customer] = await tx.$queryRaw<{ id: string; name: string }[]>`
      INSERT INTO "Customer" ("id", "tenantId", "name", "phone", "updatedAt")
      VALUES (${randomUUID()}, ${tenantId}, '', ${phone}, now())
      ON CONFLICT ("tenantId", "phone") DO UPDATE SET "updatedAt" = now()
      RETURNING "id", "name"`;
    if (!customer) throw new Error("Customer upsert returned nothing");
    return { customerId: customer.id, phone, name: customer.name };
  });
  if (!outcome) throw new ValidationError(BAD_CODE);
  return outcome;
}

// ---- Session cookie: base64url(payload) "." base64url(HMAC). Stateless, 30 days.

export interface CustomerSession {
  tenantId: string;
  customerId: string;
  /** Expiry, seconds since epoch */
  exp: number;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
export const SESSION_TTL_SECONDS = 30 * 24 * 3600;

export function signCustomerSession(s: Omit<CustomerSession, "exp">, nowMs = Date.now(), key = secret()): string {
  const payload = b64(JSON.stringify({ ...s, exp: Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS }));
  return `${payload}.${b64(createHmac("sha256", key).update(`session|${payload}`).digest())}`;
}

/**
 * Returns the session only if the signature is valid, it has not expired, and it was issued for THIS store.
 * The tenant check stops a cookie from one store being replayed on another.
 */
export function readCustomerSession(token: string | undefined | null, expectedTenantId: string, nowMs = Date.now(), key = secret()): CustomerSession | null {
  if (!token || token.length > 2000) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = b64(createHmac("sha256", key).update(`session|${payload}`).digest());
  if (!safeEqual(sig, expected)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as CustomerSession;
    if (typeof s.tenantId !== "string" || typeof s.customerId !== "string" || typeof s.exp !== "number") return null;
    if (s.tenantId !== expectedTenantId || s.exp * 1000 < nowMs) return null;
    return s;
  } catch {
    return null;
  }
}

// ---- Order links. A cuid is partly time-based and not safe to rely on as a secret, and the order page shows a name,
// phone and delivery area. So the link carries a keyed token, and the page also opens for the signed-in owner of the order.

/** Token for /order/<id>?k=<token>. Bound to the store and the order, so it works for nothing else. */
export function signOrderAccess(tenantId: string, orderId: string, key = secret()): string {
  return createHmac("sha256", key).update(`order|${tenantId}|${orderId}`).digest("base64url").slice(0, 27);
}

export function verifyOrderAccess(tenantId: string, orderId: string, token: string | undefined | null, key = secret()): boolean {
  if (!token || token.length > 64) return false;
  return safeEqual(token, signOrderAccess(tenantId, orderId, key));
}

// ---- Account data

export interface AccountOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalAmount: number;
  itemCount: number;
  createdAt: Date;
  firstItemTitle: string | null;
}

export async function getAccount(tenantId: string, customerId: string) {
  return withTenant(tenantId, async (tx) => {
    const c = await tx.customer.findFirst({ where: { id: customerId } });
    if (!c) return null;
    const orders = await tx.order.findMany({
      relationLoadStrategy: "join",
      where: { customerId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 50,
      include: { items: { select: { quantity: true, productTitle: true }, take: 20 } },
    });
    return {
      customer: { id: c.id, name: c.name, phone: c.phone },
      orders: orders.map<AccountOrder>((o) => ({
        id: o.id, orderNumber: o.orderNumber, status: o.status, paymentStatus: o.paymentStatus, paymentMethod: o.paymentMethod,
        totalAmount: Number(o.totalAmount), itemCount: o.items.reduce((n, i) => n + i.quantity, 0), createdAt: o.createdAt,
        firstItemTitle: o.items[0]?.productTitle ?? null,
      })),
    };
  });
}
