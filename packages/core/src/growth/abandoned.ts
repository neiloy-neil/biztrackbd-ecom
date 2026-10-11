import { isDemoStore } from "../demo/guard";
import { randomBytes, randomUUID } from "node:crypto";
import { Prisma, getBasePrisma, withTenant, type TenantTx } from "@biztrackbd/db";
import { z } from "zod";
import { audit } from "../audit/service";
import { currentSmsSender, type SmsSender } from "../customers/auth";
import { NotFoundError, ValidationError } from "../errors";
import { getPlanLimits, monthStart } from "../limits/plan";
import { money } from "../orders/pricing";
import { assertCan, type StaffActor } from "../permissions";
import { normalizeBdPhone } from "../phone";

/**
 * Abandoned checkouts (docs/07 section 3). The moment a customer types a valid mobile number at checkout, the cart is kept
 * as a row on the store's call list. If they do not come back within 30 minutes they get one recovery SMS with a link that
 * restores their cart. Placing an order, from anywhere, closes the row.
 */

export type AbandonedTab = "to_call" | "called" | "recovered" | "lost" | "all";
export type CallOutcome = "WILL_ORDER" | "NO_ANSWER" | "NOT_INTERESTED" | "ORDER_CREATED";

export const RECOVERY_WAIT_MINUTES = 30;
/** One recovery SMS per number per store per day: the number is typed by a stranger and is not verified, so this also limits abuse. */
const SMS_PER_PHONE_PER_DAY = 1;
const OPEN = ["CAPTURED", "CALL_SCHEDULED", "CALL_CONNECTED"] as const;
const actorName = (a: StaffActor) => a.name ?? a.email;

export interface CartSnapshotLine {
  variantId: string;
  quantity: number;
  title: string;
  variantTitle: string | null;
  price: number;
}

export const CaptureInput = z.object({
  phone: z.string().min(1),
  name: z.string().trim().max(80).optional(),
  district: z.string().trim().max(60).optional(),
  items: z.array(z.object({ variantId: z.string().min(1).max(64), quantity: z.number().int().min(1).max(50) })).min(1).max(50),
});
export type CaptureInput = z.input<typeof CaptureInput>;

const asLines = (v: unknown): CartSnapshotLine[] => (Array.isArray(v) ? (v as CartSnapshotLine[]) : []);

/**
 * Keeps (or refreshes) the call-list row for this number. Prices come from the database, never from the browser.
 * Quiet by design: a bad number, a blocked number, an empty cart or an order just placed all return `captured: false`, not an error.
 */
export async function captureCheckout(tenantId: string, raw: unknown): Promise<{ captured: boolean }> {
  const parsed = CaptureInput.safeParse(raw);
  if (!parsed.success) return { captured: false };
  let phone: string;
  try {
    phone = normalizeBdPhone(parsed.data.phone);
  } catch {
    return { captured: false };
  }
  const input = parsed.data;

  const attempt = () =>
    withTenant(tenantId, async (tx) => {
      const [blocked, customer, justOrdered] = await Promise.all([
        tx.blockedContact.findFirst({ where: { phone }, select: { id: true } }),
        tx.customer.findFirst({ where: { phone }, select: { isBlacklisted: true } }),
        tx.order.findFirst({ where: { customerPhone: phone, status: { not: "CANCELLED" }, createdAt: { gt: new Date(Date.now() - RECOVERY_WAIT_MINUTES * 60_000) } }, select: { id: true } }),
      ]);
      if (blocked || customer?.isBlacklisted || justOrdered) return { captured: false };

      const merged = new Map<string, number>();
      for (const i of input.items) merged.set(i.variantId, Math.min(50, (merged.get(i.variantId) ?? 0) + i.quantity));
      const variants = await tx.productVariant.findMany({ where: { id: { in: [...merged.keys()] }, product: { status: "ACTIVE", deletedAt: null } }, include: { product: { select: { title: true } } } });
      const lines: CartSnapshotLine[] = variants.map((v) => ({ variantId: v.id, quantity: merged.get(v.id)!, title: v.product.title, variantTitle: v.title, price: Number(v.price) }));
      if (lines.length === 0 || (await isDemoStore(tx))) return { captured: false };
      const total = money(lines.reduce((s, l) => s + l.price * l.quantity, 0));

      const open = await tx.abandonedCheckout.findFirst({ where: { phone, status: { in: [...OPEN] } } });
      const data = { cartItems: lines as unknown as Prisma.InputJsonValue, cartTotal: total, lastEventAt: new Date(), ...(input.name ? { customerName: input.name } : {}), ...(input.district ? { district: input.district } : {}) };
      if (open) {
        await tx.abandonedCheckout.update({ where: { id: open.id }, data });
      } else {
        const token = randomBytes(24).toString("hex");
        await tx.abandonedCheckout.create({ data: { tenantId, phone, recoveryToken: token, recoveryUrl: `/checkout?recover=${token}`, ...data } });
      }
      return { captured: true };
    });

  try {
    return await attempt();
  } catch (e) {
    // Two requests created the first row at the same moment; the loser updates the winner's.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return attempt();
    throw e;
  }
}

/** An order was placed (any channel): the number's open checkout is recovered. Runs inside the order's own transaction. */
export async function markRecoveredByOrder(tx: TenantTx, phone: string, orderId: string): Promise<void> {
  await tx.abandonedCheckout.updateMany({ where: { phone, status: { in: [...OPEN] } }, data: { status: "RECOVERED", recoveredOrderId: orderId, outcome: "ORDER_CREATED" } });
}

/** What the storefront needs to rebuild a cart from the link in the SMS. Nothing else about the row leaves the server. */
export async function resolveRecovery(tenantId: string, token: string): Promise<{ items: { variantId: string; quantity: number }[]; name: string | null; phoneLocal: string } | null> {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  return withTenant(tenantId, async (tx) => {
    const row = await tx.abandonedCheckout.findFirst({ where: { recoveryToken: token, status: { in: [...OPEN] }, createdAt: { gt: new Date(Date.now() - 7 * 86_400_000) } } });
    if (!row) return null;
    return { items: asLines(row.cartItems).map((l) => ({ variantId: l.variantId, quantity: l.quantity })), name: row.customerName, phoneLocal: row.phone.slice(1) };
  });
}

// ---- The call list -------------------------------------------------------------------------------------------------

export interface AbandonedRow {
  id: string;
  phone: string;
  name: string | null;
  district: string | null;
  total: number;
  lines: CartSnapshotLine[];
  status: string;
  outcome: string | null;
  callAttempts: number;
  lastCallAt: Date | null;
  notes: string | null;
  smsStatus: string | null;
  smsSentAt: Date | null;
  createdAt: Date;
  lastEventAt: Date;
  recoveredOrderId: string | null;
}

const TAB_WHERE: Record<AbandonedTab, Prisma.AbandonedCheckoutWhereInput> = {
  to_call: { status: "CAPTURED" }, called: { status: { in: ["CALL_SCHEDULED", "CALL_CONNECTED"] } }, recovered: { status: "RECOVERED" }, lost: { status: "LOST" }, all: {},
};

const toRow = (r: Prisma.AbandonedCheckoutGetPayload<object>): AbandonedRow => ({
  id: r.id, phone: r.phone, name: r.customerName, district: r.district, total: Number(r.cartTotal), lines: asLines(r.cartItems), status: r.status, outcome: r.outcome, callAttempts: r.callAttempts,
  lastCallAt: r.lastCallAt, notes: r.callAgentNotes, smsStatus: r.smsStatus, smsSentAt: r.smsSentAt, createdAt: r.createdAt, lastEventAt: r.lastEventAt, recoveredOrderId: r.recoveredOrderId,
});

export async function listAbandoned(tenantId: string, actor: StaffActor, tab: AbandonedTab = "to_call"): Promise<AbandonedRow[]> {
  assertCan(actor, "customers", "view");
  const rows = await withTenant(tenantId, (tx) => tx.abandonedCheckout.findMany({ where: TAB_WHERE[tab], orderBy: [{ cartTotal: "desc" }, { createdAt: "desc" }], take: 200 }));
  return rows.map(toRow);
}

export async function getAbandoned(tenantId: string, actor: StaffActor, id: string): Promise<AbandonedRow> {
  assertCan(actor, "customers", "view");
  const r = await withTenant(tenantId, (tx) => tx.abandonedCheckout.findFirst({ where: { id } }));
  if (!r) throw new NotFoundError("Checkout");
  return toRow(r);
}

export async function abandonedTabCounts(tenantId: string, actor: StaffActor): Promise<Record<AbandonedTab, number>> {
  assertCan(actor, "customers", "view");
  const g = await withTenant(tenantId, (tx) => tx.abandonedCheckout.groupBy({ by: ["status"], _count: { _all: true } }));
  const n = (...s: string[]) => g.filter((x) => s.includes(x.status)).reduce((a, x) => a + x._count._all, 0);
  return { to_call: n("CAPTURED"), called: n("CALL_SCHEDULED", "CALL_CONNECTED"), recovered: n("RECOVERED"), lost: n("LOST"), all: g.reduce((a, x) => a + x._count._all, 0) };
}

export interface AbandonedMetrics {
  dropped7d: number;
  valueLeftBehind: number;
  recoveryRatePercent: number | null;
  recoveredRevenue: number;
}

export async function getAbandonedMetrics(tenantId: string, actor: StaffActor, now: Date = new Date()): Promise<AbandonedMetrics> {
  assertCan(actor, "customers", "view");
  const since = new Date(now.getTime() - 7 * 86_400_000);
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.abandonedCheckout.findMany({ where: { createdAt: { gt: since } }, select: { status: true, cartTotal: true, recoveredOrderId: true } });
    const recovered = rows.filter((r) => r.status === "RECOVERED");
    const orders = recovered.length ? await tx.order.aggregate({ where: { id: { in: recovered.map((r) => r.recoveredOrderId!).filter(Boolean) } }, _sum: { totalAmount: true } }) : null;
    return {
      dropped7d: rows.length,
      valueLeftBehind: money(rows.filter((r) => r.status !== "RECOVERED").reduce((s, r) => s + Number(r.cartTotal), 0)),
      recoveryRatePercent: rows.length ? Math.round((recovered.length / rows.length) * 1000) / 10 : null,
      recoveredRevenue: Number(orders?._sum.totalAmount ?? 0),
    };
  });
}

/** After a call: what the customer said. "Not interested" closes the row; "Order created" is set automatically when the order is placed. */
export async function logCallOutcome(tenantId: string, actor: StaffActor, id: string, outcome: Exclude<CallOutcome, "ORDER_CREATED">, note?: string): Promise<void> {
  assertCan(actor, "customers", "edit");
  if (!["WILL_ORDER", "NO_ANSWER", "NOT_INTERESTED"].includes(outcome)) throw new ValidationError("Choose what happened on the call");
  const text = note?.trim().slice(0, 300);
  await withTenant(tenantId, async (tx) => {
    const r = await tx.abandonedCheckout.findFirst({ where: { id } });
    if (!r) throw new NotFoundError("Checkout");
    if (!(OPEN as readonly string[]).includes(r.status)) throw new ValidationError("This checkout is already closed");
    const stamp = `${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date())} ${actorName(actor)}: ${outcome.replace(/_/g, " ").toLowerCase()}${text ? `, ${text}` : ""}`;
    await tx.abandonedCheckout.update({
      where: { id },
      data: {
        outcome, callAttempts: { increment: 1 }, lastCallAt: new Date(), status: outcome === "NOT_INTERESTED" ? "LOST" : outcome === "WILL_ORDER" ? "CALL_CONNECTED" : "CALL_SCHEDULED",
        callAgentNotes: [r.callAgentNotes, stamp].filter(Boolean).join("\n").slice(-2000),
      },
    });
    await audit(tx, tenantId, actor, "abandoned.call_logged", { phone: r.phone, outcome });
  });
}

// ---- Recovery SMS --------------------------------------------------------------------------------------------------

export function recoveryText(locale: string, p: { name: string | null; storeName: string; total: number; link: string }): string {
  const who = p.name?.trim().split(/\s+/)[0] ?? "";
  return locale.startsWith("bn")
    ? `আসসালামু আলাইকুম${who ? ` ${who}` : ""}, আপনার ${p.storeName} কার্টে ৳${p.total} এর পণ্য রয়ে গেছে। অর্ডার সম্পন্ন করুন: ${p.link}`
    : `Hi${who ? ` ${who}` : ""}, you left items worth ৳${p.total} in your ${p.storeName} cart. Finish your order: ${p.link}`;
}

function storeOrigin(subdomain: string, primaryDomain: string | null): string {
  if (primaryDomain) return `https://${primaryDomain}`;
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  return `${root.startsWith("localhost") ? "http" : "https"}://${subdomain}.${root}`;
}

/** Takes one SMS credit from this month's allowance. False when the plan's allowance is used up. Atomic, so two sweeps cannot overspend. */
export async function consumeSmsCredit(tx: TenantTx, tenantId: string, now: Date = new Date()): Promise<boolean> {
  const plan = await getPlanLimits(tx);
  const limits = (await tx.plan.findUnique({ where: { tier: plan.tier as never } }))?.limits as Record<string, unknown> | undefined;
  const limit = typeof limits?.smsCredits === "number" ? limits.smsCredits : null;
  const period = monthStart(now, plan.timezone);
  const rows = await tx.$queryRaw<{ v: number }[]>`
    INSERT INTO "UsageCounter" ("id", "tenantId", "metric", "periodStart", "value", "updatedAt")
    SELECT ${randomUUID()}, ${tenantId}, 'sms', ${period}::date, 1, now() WHERE ${limit}::int IS NULL OR ${limit}::int >= 1
    ON CONFLICT ("tenantId", "metric", "periodStart") DO UPDATE SET "value" = "UsageCounter"."value" + 1, "updatedAt" = now()
      WHERE ${limit}::int IS NULL OR "UsageCounter"."value" < ${limit}::int
    RETURNING "value"::int AS v`;
  return rows.length > 0;
}

export interface RecoverySummary {
  checked: number;
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Sends the 30-minute recovery SMS for one store. Each row is claimed with a conditional update first, so two sweeps (or a
 * retry) can never send the same customer two messages. Opted-out numbers, numbers already texted today, and stores out of SMS
 * credits are skipped and recorded as such.
 */
export async function sendRecoveryMessages(tenantId: string, opts: { now?: Date; sender?: SmsSender } = {}): Promise<RecoverySummary> {
  const now = opts.now ?? new Date();
  const sender = opts.sender ?? currentSmsSender();
  const sum: RecoverySummary = { checked: 0, sent: 0, skipped: 0, failed: 0 };
  const waiting = await withTenant(tenantId, async (tx) => {
    const settings = await tx.storeSettings.findFirst({ select: { storeName: true, abandonedSmsEnabled: true } });
    if (!settings?.abandonedSmsEnabled) return null;
    const t = await tx.tenant.findFirstOrThrow({ select: { subdomain: true, locale: true, status: true } });
    // A store that is offline or locked is not texting its customers.
    if (!["TRIAL", "ACTIVE", "PAST_DUE"].includes(t.status)) return null;
    const primary = await tx.domain.findFirst({ where: { isPrimary: true, verified: true }, select: { domain: true } });
    const rows = await tx.abandonedCheckout.findMany({
      where: { status: "CAPTURED", smsClaimedAt: null, lastEventAt: { lt: new Date(now.getTime() - RECOVERY_WAIT_MINUTES * 60_000), gt: new Date(now.getTime() - 3 * 86_400_000) } },
      orderBy: { lastEventAt: "asc" }, take: 100,
    });
    const templates = await tx.messageTemplate.findMany({ where: { event: "ABANDONED_RECOVERY", channel: "SMS" } });
    return { settings, t, origin: storeOrigin(t.subdomain, primary?.domain ?? null), rows, templates };
  });
  if (!waiting) return sum;

  for (const row of waiting.rows) {
    sum.checked++;
    const claim = await withTenant(tenantId, async (tx): Promise<"send" | "skip"> => {
      const n = await tx.abandonedCheckout.updateMany({ where: { id: row.id, status: "CAPTURED", smsClaimedAt: null }, data: { smsClaimedAt: now } });
      if (n.count === 0) return "skip"; // someone else has it, or the customer ordered meanwhile
      const mark = (smsStatus: string) => tx.abandonedCheckout.update({ where: { id: row.id }, data: { smsStatus } });
      if (await tx.smsOptOut.findFirst({ where: { phone: row.phone } })) return (await mark("SKIPPED_OPTOUT"), "skip");
      const sentToday = await tx.abandonedCheckout.count({ where: { phone: row.phone, smsStatus: "SENT", smsSentAt: { gt: new Date(now.getTime() - 86_400_000) } } });
      if (sentToday >= SMS_PER_PHONE_PER_DAY) return (await mark("SKIPPED_LIMIT"), "skip");
      if (!(await consumeSmsCredit(tx, tenantId, now))) return (await mark("SKIPPED_NO_CREDITS"), "skip");
      return "send";
    });
    if (claim === "skip") { sum.skipped++; continue; }

    const locale = waiting.t.locale;
    const custom = waiting.templates.find((x) => x.isEnabled && x.locale === (locale.startsWith("bn") ? "bn" : "en"));
    const link = `${waiting.origin}${row.recoveryUrl}`;
    const vars = { name: row.customerName, storeName: waiting.settings.storeName, total: Number(row.cartTotal), link };
    const text = custom
      ? custom.body.replace(/\{customer_name\}/g, row.customerName ?? "").replace(/\{store_name\}/g, vars.storeName).replace(/\{tracking_link\}|\{link\}/g, link).replace(/\{total\}/g, String(vars.total))
      : recoveryText(locale, vars);
    try {
      await sender.send(tenantId, row.phone, text);
      await withTenant(tenantId, (tx) => tx.abandonedCheckout.update({ where: { id: row.id }, data: { smsStatus: "SENT", smsSentAt: new Date() } }));
      sum.sent++;
    } catch (e) {
      console.error("[abandoned] recovery sms failed", e instanceof Error ? e.name : "unknown");
      // Give the credit back and note the failure. The row stays claimed, so a broken provider cannot cause a retry storm.
      await withTenant(tenantId, async (tx) => {
        await tx.abandonedCheckout.update({ where: { id: row.id }, data: { smsStatus: "FAILED" } });
        await tx.$executeRaw`UPDATE "UsageCounter" SET "value" = GREATEST("value" - 1, 0) WHERE "tenantId" = ${tenantId} AND metric = 'sms' AND "periodStart" = ${monthStart(now, "Asia/Dhaka")}::date`;
      });
      sum.failed++;
    }
  }
  return sum;
}

/** For the scheduled job: every store with a checkout waiting. One store failing does not stop the rest. */
export async function sweepRecoveryMessages(opts: { now?: Date; sender?: SmsSender } = {}): Promise<RecoverySummary & { stores: number }> {
  const rows = await getBasePrisma().$queryRaw<{ tenantId: string }[]>`SELECT "tenantId" FROM tenants_with_pending_recovery()`;
  const total = { stores: rows.length, checked: 0, sent: 0, skipped: 0, failed: 0 };
  for (const r of rows) {
    try {
      const s = await sendRecoveryMessages(r.tenantId, opts);
      total.checked += s.checked; total.sent += s.sent; total.skipped += s.skipped; total.failed += s.failed;
    } catch (e) {
      total.failed++;
      console.error("[abandoned] store failed", r.tenantId, e instanceof Error ? e.name : "unknown");
    }
  }
  return total;
}
