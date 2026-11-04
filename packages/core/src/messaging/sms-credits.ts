import { z } from "zod";
import { Prisma, getPlatformPrisma, withTenant, type PrismaClient } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { assertCan, type StaffActor } from "../permissions";
import { NotFoundError, ValidationError } from "../errors";
import { normalizeBdPhone } from "../phone";
import { assertNotInDemo } from "../demo/guard";
import { paymentTargets, type PayTo } from "../platform/billing";
import { assertPlatformCan, type PlatformActor } from "../platform/admin";
import { getPlanLimits, monthStart } from "../limits/plan";
import { TRIAL_CAPS, isOnTrial, withTrialCap } from "../platform/trial";

/**
 * SMS a store can send. Three sources, spent in this order:
 *  1. a free monthly allowance (10 on the free trial, 100 on Starter, 500 on Pro, set in the plan),
 *  2. SMS the store bought in a pack (50 paisa each, at least 100, so 100 SMS is 50 taka), which never run out,
 *  3. nothing: the message is not sent and the owner is told to buy more.
 * A store on its free trial has a hard cap and cannot buy packs until it pays for a plan.
 */

/** Price of one SMS in paisa, and the smallest pack (100 SMS = 50 taka). Packs go up in hundreds so the price is always whole taka. */
export const SMS_PRICE_PAISA = 50;
export const SMS_MIN_PACK = 100;
export const SMS_PACK_STEP = 100;
export const SMS_MAX_PACK = 100_000;

/** The prepaid balance is a counter row that is not tied to a month. */
export const SMS_PREPAID_METRIC = "sms_prepaid";
export const SMS_PREPAID_PERIOD = "1970-01-01";

/** Taka for a pack. */
export const smsPackPrice = (quantity: number): number => (quantity * SMS_PRICE_PAISA) / 100;

export function validatePackSize(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < SMS_MIN_PACK) throw new ValidationError(`The smallest pack is ${SMS_MIN_PACK} SMS.`, { field: "quantity" });
  if (quantity % SMS_PACK_STEP !== 0) throw new ValidationError(`SMS are sold in hundreds, for example ${SMS_MIN_PACK} or ${SMS_MIN_PACK * 2}.`, { field: "quantity" });
  if (quantity > SMS_MAX_PACK) throw new ValidationError("That is more than one pack can hold. Buy in smaller packs.", { field: "quantity" });
}

// ---- Store side ---------------------------------------------------------------------------------------------------------

export interface SmsBalanceView {
  /** The free monthly allowance, with the trial cap applied. null means no limit. */
  monthlyLimit: number | null;
  monthlyUsed: number;
  monthlyLeft: number | null;
  /** SMS the store bought and has not sent yet. */
  prepaid: number;
  /** Everything the store can send right now. null when the plan has no limit. */
  totalLeft: number | null;
  onTrial: boolean;
  /** A pack can be bought only after the store pays for a plan. */
  canBuy: boolean;
  pricePaisa: number;
  minPack: number;
  step: number;
  payTo: PayTo[];
  waiting: { quantity: number; amount: number } | null;
  lastRejection: string | null;
}

export async function getSmsBalance(tenantId: string, actor: StaffActor, now: Date = new Date()): Promise<SmsBalanceView> {
  assertCan(actor, "billing", "view");
  const data = await withTenant(tenantId, async (tx) => {
    const plan = await getPlanLimits(tx);
    const row = await tx.plan.findUnique({ where: { tier: plan.tier as never } });
    const limits = (row?.limits ?? {}) as Record<string, unknown>;
    const trial = await isOnTrial(tx, now);
    const counters = await tx.usageCounter.findMany({ where: { metric: { in: ["sms", SMS_PREPAID_METRIC] } }, select: { metric: true, periodStart: true, value: true } });
    const month = monthStart(now, plan.timezone);
    const monthKey = String(month).slice(0, 10);
    const used = counters.find((c) => c.metric === "sms" && c.periodStart.toISOString().slice(0, 10) === monthKey);
    const prepaid = counters.find((c) => c.metric === SMS_PREPAID_METRIC);
    const purchases = await tx.smsPurchase.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { quantity: true, amount: true, status: true, rejectionReason: true } });
    return { planLimit: typeof limits.smsCredits === "number" ? limits.smsCredits : null, trial, used: Number(used?.value ?? 0), prepaid: Number(prepaid?.value ?? 0), purchases };
  });
  const monthlyLimit = withTrialCap(data.planLimit, data.trial, TRIAL_CAPS.smsCredits);
  const monthlyLeft = monthlyLimit === null ? null : Math.max(0, monthlyLimit - data.used);
  const waiting = data.purchases.find((p) => p.status === "PENDING");
  const rejected = data.purchases[0]?.status === "REJECTED" ? data.purchases[0] : undefined;
  return {
    monthlyLimit, monthlyUsed: data.used, monthlyLeft, prepaid: data.prepaid,
    totalLeft: monthlyLeft === null ? null : monthlyLeft + (data.trial ? 0 : data.prepaid),
    onTrial: data.trial, canBuy: !data.trial, pricePaisa: SMS_PRICE_PAISA, minPack: SMS_MIN_PACK, step: SMS_PACK_STEP,
    payTo: paymentTargets(), waiting: waiting ? { quantity: waiting.quantity, amount: Number(waiting.amount) } : null, lastRejection: rejected?.rejectionReason ?? null,
  };
}

const TRX = /^[A-Z0-9]{8,12}$/;
export const SmsPurchaseInput = z.object({
  quantity: z.coerce.number(),
  provider: z.enum(["BKASH", "NAGAD", "ROCKET", "UPAY"]),
  senderNumber: z.string().trim().min(1, "Enter the number you sent from"),
  trxId: z.string().trim().toUpperCase(),
});

/** The owner has sent the money for a pack and says so. The price is worked out here, never taken from the browser. One payment can wait at a time. */
export async function submitSmsPurchase(tenantId: string, actor: StaffActor, raw: unknown): Promise<void> {
  await assertNotInDemo(tenantId, "Buying SMS");
  assertCan(actor, "billing", "edit");
  const parsed = SmsPurchaseInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the form");
  const input = parsed.data;
  validatePackSize(input.quantity);
  if (!TRX.test(input.trxId)) throw new ValidationError("That transaction ID does not look right. It is 8 to 12 letters and numbers.", { field: "trxId" });
  let sender: string;
  try { sender = normalizeBdPhone(input.senderNumber); } catch { throw new ValidationError("Enter the mobile number you sent the money from, like 01712345678", { field: "senderNumber" }); }
  const amount = smsPackPrice(input.quantity);
  try {
    await withTenant(tenantId, async (tx) => {
      if (await isOnTrial(tx)) throw new ValidationError("SMS packs open once you pay for a plan. Your free trial includes a few SMS to try.");
      if (await tx.smsPurchase.findFirst({ where: { status: "PENDING" } })) throw new ValidationError("You already have an SMS payment waiting to be checked. We will confirm it soon.");
      if (await tx.paymentProof.findFirst({ where: { trxId: input.trxId } }) || await tx.themePurchase.findFirst({ where: { trxId: input.trxId } }) || await tx.modulePurchase.findFirst({ where: { trxId: input.trxId } })) throw new ValidationError("That transaction ID has already been used.", { field: "trxId" });
      await tx.smsPurchase.create({ data: { tenantId, quantity: input.quantity, amount, mfsProvider: input.provider, senderNumber: sender, trxId: input.trxId } });
      await audit(tx, tenantId, actor, "sms.purchase_submitted", { quantity: input.quantity, amount, provider: input.provider, trxId: input.trxId });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ValidationError("That transaction ID has already been used.", { field: "trxId" });
    throw e;
  }
}

// ---- Platform side -------------------------------------------------------------------------------------------------------

export interface PendingSmsPurchase {
  id: string;
  tenantId: string;
  storeName: string;
  subdomain: string;
  quantity: number;
  amount: number;
  provider: string;
  senderNumber: string;
  trxId: string;
  createdAt: Date;
}

export async function listPendingSmsPurchases(actor: PlatformActor, db: PrismaClient = getPlatformPrisma()): Promise<PendingSmsPurchase[]> {
  assertPlatformCan(actor, "payments", "view");
  const rows = await db.smsPurchase.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { tenant: { select: { name: true, subdomain: true } } } });
  return rows.map((r) => ({ id: r.id, tenantId: r.tenantId, storeName: r.tenant.name, subdomain: r.tenant.subdomain, quantity: r.quantity, amount: Number(r.amount), provider: r.mfsProvider, senderNumber: r.senderNumber, trxId: r.trxId, createdAt: r.createdAt }));
}

/** Approves a payment and adds the pack to the store's prepaid balance. */
export async function approveSmsPurchase(actor: PlatformActor, id: string, db: PrismaClient = getPlatformPrisma()): Promise<{ tenantId: string; quantity: number; balance: number }> {
  assertPlatformCan(actor, "payments", "edit");
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "SmsPurchase" WHERE id = ${id} FOR UPDATE`;
    if (locked.length === 0) throw new NotFoundError("Payment");
    const row = await tx.smsPurchase.findUniqueOrThrow({ where: { id } });
    if (row.status !== "PENDING") throw new ValidationError(row.status === "APPROVED" ? "This payment was already approved." : "This payment was already rejected.");
    await tx.smsPurchase.update({ where: { id }, data: { status: "APPROVED", approvedBy: actor.id, approvedAt: new Date() } });
    const rows = await tx.$queryRaw<{ v: number }[]>`
      INSERT INTO "UsageCounter" ("id", "tenantId", "metric", "periodStart", "value", "updatedAt")
      VALUES (${`sms-prepaid-${row.tenantId}`}, ${row.tenantId}, ${SMS_PREPAID_METRIC}, ${SMS_PREPAID_PERIOD}::date, ${row.quantity}, now())
      ON CONFLICT ("tenantId", "metric", "periodStart") DO UPDATE SET "value" = "UsageCounter"."value" + ${row.quantity}, "updatedAt" = now()
      RETURNING "value"::int AS v`;
    await tx.platformAuditLog.create({ data: { actorId: actor.id, action: "sms.purchase_approved", tenantId: row.tenantId, details: { id, quantity: row.quantity, trxId: row.trxId, amount: Number(row.amount) }, ipAddress: actor.ip ?? null } });
    return { tenantId: row.tenantId, quantity: row.quantity, balance: rows[0]?.v ?? row.quantity };
  });
}

export async function rejectSmsPurchase(actor: PlatformActor, id: string, reason: string, db: PrismaClient = getPlatformPrisma()): Promise<void> {
  assertPlatformCan(actor, "payments", "edit");
  const why = reason.trim().slice(0, 200);
  if (why.length < 3) throw new ValidationError("Tell the store why, for example: TrxID not found in our bKash");
  await db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "SmsPurchase" WHERE id = ${id} FOR UPDATE`;
    if (locked.length === 0) throw new NotFoundError("Payment");
    const row = await tx.smsPurchase.findUniqueOrThrow({ where: { id } });
    if (row.status !== "PENDING") throw new ValidationError("This payment was already decided.");
    await tx.smsPurchase.update({ where: { id }, data: { status: "REJECTED", rejectionReason: why, approvedBy: actor.id, approvedAt: new Date() } });
    await tx.platformAuditLog.create({ data: { actorId: actor.id, action: "sms.purchase_rejected", tenantId: row.tenantId, details: { id, quantity: row.quantity, trxId: row.trxId, reason: why }, ipAddress: actor.ip ?? null } });
  });
}
