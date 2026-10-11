import { createHmac, randomBytes } from "node:crypto";
import { getBasePrisma, withTenant, type TenantTx } from "@biztrackbd/db";
import { currentSmsSender } from "../customers/auth";
import { consumeSmsCredit } from "../growth/abandoned";
import { isModuleOn } from "../modules/service";
import { money } from "../orders/pricing";

/**
 * Loyalty points, VIP tiers and referrals (docs/26). Everything here that touches an order runs inside the order's own
 * transaction, so points, discounts and the order commit together or not at all.
 *
 * The rules in one place:
 *  - Points are earned on delivered orders only. They are written as PENDING when the order is placed and unlocked when it is
 *    delivered; a cancelled order voids them. The amount is fixed when the order is placed (at the tier's multiplier then).
 *  - Redeeming takes points at once (atomically, so two orders cannot spend the same points) and gives them back if the order
 *    is cancelled. Redeeming and the tier discount need a signed-in customer: a phone number typed into a form is not proof.
 *  - A friend's first order gets a fixed discount; the referrer's reward arrives when that order is delivered, and is taken back
 *    if the parcel is returned.
 *  - The ledger rows never change amount, kind, account or order (a database trigger), and one earn, one redeem and one bonus
 *    can exist per order (a unique index), so a repeated delivery cannot credit twice.
 */

export type TierLevel = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
export interface Tier {
  level: TierLevel;
  label: string;
  /** Delivered spend over 12 months that earns this level. */
  min: number;
  multiplier: number;
  discountPercent: number;
  freeDelivery: boolean;
}

/** The four levels with the store's own thresholds and discounts (the multipliers and Platinum's free delivery are fixed). */
export function tiersOf(c: { silverMin: number; goldMin: number; platinumMin: number; goldDiscount: number; platinumDiscount: number } = DEFAULT_VIP): Tier[] {
  return [
    { level: "BRONZE", label: "Bronze", min: 0, multiplier: 1, discountPercent: 0, freeDelivery: false },
    { level: "SILVER", label: "Silver", min: c.silverMin, multiplier: 1.25, discountPercent: 0, freeDelivery: false },
    { level: "GOLD", label: "Gold", min: c.goldMin, multiplier: 1.5, discountPercent: c.goldDiscount, freeDelivery: false },
    { level: "PLATINUM", label: "Platinum", min: c.platinumMin, multiplier: 2, discountPercent: c.platinumDiscount, freeDelivery: true },
  ];
}
export const DEFAULT_VIP = { silverMin: 5000, goldMin: 15000, platinumMin: 35000, goldDiscount: 5, platinumDiscount: 10 };
/** The built-in levels, for screens that describe them before a store has changed anything. */
export const TIERS: Tier[] = tiersOf();

export const tierFor = (spend12m: number, tiers: Tier[] = TIERS): Tier => [...tiers].reverse().find((t) => spend12m >= t.min) ?? tiers[0]!;
export const tierOf = (level: string, tiers: Tier[] = TIERS): Tier => tiers.find((t) => t.level === level) ?? tiers[0]!;
export const nextTier = (level: string, tiers: Tier[] = TIERS): Tier | null => tiers[tiers.findIndex((t) => t.level === level) + 1] ?? null;
const rank = (level: string) => ["BRONZE", "SILVER", "GOLD", "PLATINUM"].indexOf(level);

export interface LoyaltySettings {
  enabled: boolean;
  spendPerPoint: number;
  pointsPerBlock: number;
  bdtPerBlock: number;
  maxCartPercent: number;
  referralEnabled: boolean;
  refereeDiscount: number;
  refereeMinCart: number;
  referrerReward: number;
  /** Points expire after this many months with no activity. 0 = never. */
  expiryMonths: number;
  vip: { silverMin: number; goldMin: number; platinumMin: number; goldDiscount: number; platinumDiscount: number };
  birthdayVoucher: number;
  /** The levels, with this store's thresholds. */
  tiers: Tier[];
}

export async function loadLoyaltySettings(tx: TenantTx): Promise<LoyaltySettings> {
  const s = await tx.storeSettings.findFirst();
  const vip = { silverMin: s?.vipSilverMin ?? 5000, goldMin: s?.vipGoldMin ?? 15000, platinumMin: s?.vipPlatinumMin ?? 35000, goldDiscount: s?.vipGoldDiscount ?? 5, platinumDiscount: s?.vipPlatinumDiscount ?? 10 };
  return {
    // Switched on by the owner AND included in the plan (and not switched off in Apps).
    enabled: (s?.loyaltyEnabled ?? false) && (await isModuleOn(tx, "loyalty")), spendPerPoint: s?.loyaltySpendPerPoint ?? 100, pointsPerBlock: s?.loyaltyPointsPerBlock ?? 10, bdtPerBlock: s?.loyaltyBdtPerBlock ?? 10,
    maxCartPercent: s?.loyaltyMaxCartPercent ?? 30, referralEnabled: s?.referralEnabled ?? false, refereeDiscount: s?.refereeDiscountBdt ?? 50, refereeMinCart: s?.refereeMinCartBdt ?? 500,
    referrerReward: s?.referrerRewardPoints ?? 100, expiryMonths: s?.loyaltyExpiryMonths ?? 0, birthdayVoucher: s?.birthdayVoucherBdt ?? 100,
    vip, tiers: tiersOf(vip),
  };
}

/** Points an amount earns: whole points, rounded down, at the tier's multiplier. */
export const pointsFor = (netBdt: number, s: LoyaltySettings, multiplier: number): number => Math.max(0, Math.floor((netBdt / s.spendPerPoint) * multiplier + 1e-9));
/** What a number of points is worth in taka. Redeeming works in whole blocks. */
export const pointsValue = (points: number, s: LoyaltySettings): number => Math.floor(Math.max(0, points) / s.pointsPerBlock) * s.bdtPerBlock;

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newReferralCode(name: string): string {
  const base = name.normalize("NFKD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 6) || "FRIEND";
  const tail = Array.from(randomBytes(3), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
  return `REF-${base}-${tail}`;
}
export const REFERRAL_CODE = /^REF-[A-Z]{1,6}-[A-Z2-9]{3}$/;

export async function ensureAccount(tx: TenantTx, tenantId: string, customerId: string, name: string) {
  const found = await tx.customerLoyaltyAccount.findFirst({ where: { customerId } });
  if (found) return found;
  for (let i = 0; i < 5; i++) {
    const code = newReferralCode(name);
    // The unique index on customerId and on the code is the arbiter if two orders race.
    const rows = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO "CustomerLoyaltyAccount" ("id", "tenantId", "customerId", "referralCode", "updatedAt")
      VALUES (${randomBytes(12).toString("hex")}, ${tenantId}, ${customerId}, ${code}, now())
      ON CONFLICT DO NOTHING RETURNING "id"`;
    if (rows.length) return tx.customerLoyaltyAccount.findFirstOrThrow({ where: { id: rows[0]!.id } });
    const again = await tx.customerLoyaltyAccount.findFirst({ where: { customerId } });
    if (again) return again;
  }
  throw new Error("Could not make a referral code");
}

// ---- Pricing: what an order's loyalty parts come to ----------------------------------------------------------------------

export interface LoyaltyPricing {
  enabled: boolean;
  tier: TierLevel | null;
  tierDiscount: number;
  freeDelivery: boolean;
  referralDiscount: number;
  referralError: string | null;
  referral: { accountId: string; customerId: string; referrerName: string; code: string } | null;
  pointsUsed: number;
  pointsDiscount: number;
  pointsError: string | null;
  /** For the checkout: what a signed-in customer has and could use on this cart. */
  available: number | null;
  maxRedeemable: number;
}

export const NO_LOYALTY: LoyaltyPricing = { enabled: false, tier: null, tierDiscount: 0, freeDelivery: false, referralDiscount: 0, referralError: null, referral: null, pointsUsed: 0, pointsDiscount: 0, pointsError: null, available: null, maxRedeemable: 0 };

export interface PriceLoyaltyInput {
  phone: string | null;
  /** Set only by a server that has verified the customer's sign-in. Never from the browser. */
  verifiedCustomerId?: string | null;
  subtotal: number;
  couponDiscount: number;
  redeemPoints?: number;
  referralCode?: string | null;
}

export async function priceLoyalty(tx: TenantTx, i: PriceLoyaltyInput): Promise<LoyaltyPricing> {
  const s = await loadLoyaltySettings(tx);
  const out: LoyaltyPricing = { ...NO_LOYALTY, enabled: s.enabled };
  const base = money(i.subtotal - i.couponDiscount);

  // Perks that belong to a signed-in customer.
  let account = null as Awaited<ReturnType<typeof ensureAccountRead>> | null;
  if (s.enabled && i.verifiedCustomerId) {
    const customer = await tx.customer.findFirst({ where: { id: i.verifiedCustomerId } });
    if (customer && i.phone && customer.phone === i.phone) {
      account = await ensureAccountRead(tx, customer.id);
    } else if (customer && (i.redeemPoints ?? 0) > 0) {
      out.pointsError = "Sign in with the number you are ordering with to use your points.";
    }
  }
  if ((i.redeemPoints ?? 0) > 0 && !out.pointsError) {
    if (!s.enabled) out.pointsError = "Reward points are not available at this store.";
    else if (!account) out.pointsError = "Sign in to use your reward points.";
  }
  if (account) {
    const tier = tierOf(account.currentTier, s.tiers);
    out.tier = tier.level;
    out.tierDiscount = money((base * tier.discountPercent) / 100);
    out.freeDelivery = tier.freeDelivery;
    out.available = account.availablePoints;
  }

  // A friend's first-order discount.
  const code = i.referralCode?.trim().toUpperCase();
  if (code && s.referralEnabled) {
    const err = (m: string) => { out.referralError = m; };
    if (!REFERRAL_CODE.test(code)) err("That referral code does not look right.");
    else {
      const ref = await tx.customerLoyaltyAccount.findFirst({ where: { referralCode: code }, include: { customer: true } });
      if (!ref) err("That referral code was not found.");
      else if (!i.phone) err("Enter your mobile number to use the referral offer.");
      else if (ref.customer.phone === i.phone) err("You cannot use your own referral code.");
      else if (await tx.customerReferral.findFirst({ where: { refereePhone: i.phone } })) err("The referral offer is for a first order only.");
      else if (await tx.order.findFirst({ where: { customerPhone: i.phone, status: { not: "CANCELLED" } }, select: { id: true } })) err("The referral offer is for a first order only.");
      else if (base < s.refereeMinCart) err(`The referral offer needs an order of at least ৳${s.refereeMinCart}.`);
      else { out.referral = { accountId: ref.id, customerId: ref.customerId, referrerName: firstName(ref.customer.name), code }; out.referralDiscount = Math.min(s.refereeDiscount, base); }
    }
  }

  // Points: whole blocks, no more than the customer has, and no more than the share of the cart the store allows.
  const afterOthers = money(base - out.tierDiscount - out.referralDiscount);
  if (account && s.enabled) {
    const cap = Math.floor((money(i.subtotal) * s.maxCartPercent) / 100);
    const byCart = Math.min(cap, afterOthers);
    const maxBlocks = Math.min(Math.floor(account.availablePoints / s.pointsPerBlock), Math.floor(byCart / s.bdtPerBlock));
    out.maxRedeemable = Math.max(0, maxBlocks) * s.pointsPerBlock;
    const want = Math.max(0, Math.floor(i.redeemPoints ?? 0));
    if (want > 0) {
      if (want % s.pointsPerBlock !== 0) out.pointsError = `Points are used in blocks of ${s.pointsPerBlock}.`;
      else if (want > account.availablePoints) out.pointsError = "You do not have that many points.";
      else if (want > out.maxRedeemable) out.pointsError = `You can use up to ${out.maxRedeemable} points on this order.`;
      else { out.pointsUsed = want; out.pointsDiscount = pointsValue(want, s); }
    }
  }
  return out;
}

const ensureAccountRead = (tx: TenantTx, customerId: string) => tx.customerLoyaltyAccount.findFirst({ where: { customerId } });
const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;

/** The same person ordering for themselves under a new number: a delivery address the referrer has used is not a friend's. */
export async function referralAddressClash(tx: TenantTx, referrerCustomerId: string, address: string, district: string): Promise<boolean> {
  const norm = (a: string) => a.toLowerCase().replace(/[^a-z0-9ঀ-৿]/g, "");
  const mine = norm(address);
  if (mine.length < 6) return false;
  const theirs = await tx.order.findMany({ where: { customerId: referrerCustomerId, shippingDistrict: district }, select: { shippingAddress: true }, take: 50, orderBy: { createdAt: "desc" } });
  return theirs.some((o) => norm(o.shippingAddress) === mine);
}

// ---- At the order -------------------------------------------------------------------------------------------------------

export interface AppliedLoyalty {
  pointsUsed: number;
  pointsDiscount: number;
  tierDiscount: number;
  referralDiscount: number;
  referralCode: string | null;
  freeDelivery: boolean;
}

/**
 * Called by createOrder after it has priced the order and created the customer. Takes the redeemed points, writes the pending
 * earn, and records the referral. Throws a plain Error message-bearing ValidationError-like via the caller if the points were
 * spent by someone else in the meantime (the caller maps it).
 */
export async function recordAtOrder(
  tx: TenantTx,
  a: { tenantId: string; orderId: string; orderNumber: string; customerId: string; customerName: string; phone: string; address: string; district: string; subtotal: number; couponDiscount: number; pricing: LoyaltyPricing },
): Promise<{ pointsSpentConflict: boolean; tier: TierLevel | null }> {
  const s = await loadLoyaltySettings(tx);
  if (!s.enabled) return { pointsSpentConflict: false, tier: null };
  const p = a.pricing;
  const account = await ensureAccount(tx, a.tenantId, a.customerId, a.customerName);

  if (p.pointsUsed > 0) {
    // Compare-and-take: if the points were spent by another order a moment ago the order is refused, not overdrawn.
    const n = await tx.$executeRaw`UPDATE "CustomerLoyaltyAccount" SET "availablePoints" = "availablePoints" - ${p.pointsUsed}, "updatedAt" = now() WHERE "id" = ${account.id} AND "availablePoints" >= ${p.pointsUsed}`;
    if (n === 0) return { pointsSpentConflict: true, tier: null };
    await tx.loyaltyTransaction.create({ data: { tenantId: a.tenantId, accountId: account.id, orderId: a.orderId, points: -p.pointsUsed, amountBdt: p.pointsDiscount, type: "REDEEM_PURCHASE", status: "CONFIRMED", description: `Used on order ${a.orderNumber}` } });
  }

  // The earn: on what the customer actually pays for the goods, at the multiplier of the tier they hold right now.
  const net = money(a.subtotal - a.couponDiscount - p.tierDiscount - p.referralDiscount - p.pointsDiscount);
  const pts = pointsFor(net, s, tierOf(account.currentTier, s.tiers).multiplier);
  if (pts > 0) {
    await tx.loyaltyTransaction.create({ data: { tenantId: a.tenantId, accountId: account.id, orderId: a.orderId, points: pts, amountBdt: net, type: "EARN_PURCHASE", status: "PENDING", description: `Earned on order ${a.orderNumber}, unlocks when it is delivered` } });
    await tx.$executeRaw`UPDATE "CustomerLoyaltyAccount" SET "pendingPoints" = "pendingPoints" + ${pts}, "updatedAt" = now() WHERE "id" = ${account.id}`;
  }

  if (p.referral && p.referralDiscount > 0) {
    await tx.customerReferral.create({ data: { tenantId: a.tenantId, referrerId: p.referral.accountId, refereePhone: a.phone, firstOrderId: a.orderId, bonusPoints: s.referrerReward } });
  }
  return { pointsSpentConflict: false, tier: account.currentTier as TierLevel };
}

// ---- When the order moves ------------------------------------------------------------------------------------------------

export interface Notice {
  phone: string;
  text: string;
}

const isBn = (locale: string) => locale.startsWith("bn");

/** Delivered: unlock the earn, re-rate the tier, and credit the referrer if this was a friend's first order. */
export async function onDelivered(tx: TenantTx, tenantId: string, orderId: string, now = new Date()): Promise<Notice[]> {
  const notices: Notice[] = [];
  const order = await tx.order.findFirst({ where: { id: orderId } });
  if (!order?.customerId) return notices;
  const s = await loadLoyaltySettings(tx);
  const store = await tx.storeSettings.findFirst({ select: { storeName: true } });
  const locale = (await tx.tenant.findFirstOrThrow({ select: { locale: true } })).locale;

  const account = await tx.customerLoyaltyAccount.findFirst({ where: { customerId: order.customerId } });
  if (account) {
    // Unlock this order's earn exactly once: the conditional update on the status is the guard.
    const earn = await tx.loyaltyTransaction.findFirst({ where: { accountId: account.id, orderId, type: "EARN_PURCHASE", status: "PENDING" } });
    if (earn) {
      const claimed = await tx.loyaltyTransaction.updateMany({ where: { id: earn.id, status: "PENDING" }, data: { status: "CONFIRMED", description: `Earned on order ${order.orderNumber}` } });
      if (claimed.count === 1) {
        await tx.$executeRaw`UPDATE "CustomerLoyaltyAccount" SET "pendingPoints" = GREATEST("pendingPoints" - ${earn.points}, 0), "availablePoints" = "availablePoints" + ${earn.points}, "lifetimePoints" = "lifetimePoints" + ${earn.points}, "updatedAt" = now() WHERE "id" = ${account.id}`;
      }
    }
    const before = account.currentTier;
    const after = await rerateTier(tx, account.id, order.customerId, now);
    if (after.level !== before && rank(after.level) > rank(before)) {
      const perk = after.discountPercent ? (isBn(locale) ? ` পরবর্তী সব অর্ডারে পাবেন ${after.discountPercent}% ডিসকাউন্ট ও ${after.multiplier}x রিওয়ার্ড পয়েন্ট!` : ` You now get ${after.discountPercent}% off every order and ${after.multiplier}x reward points!`) : (isBn(locale) ? ` এখন পাবেন ${after.multiplier}x রিওয়ার্ড পয়েন্ট!` : ` You now earn ${after.multiplier}x reward points!`);
      const name = order.customerName.trim().split(/\s+/)[0];
      notices.push({ phone: order.customerPhone, text: isBn(locale) ? `অভিনন্দন ${name}! আপনি এখন ${store?.storeName ?? ""}-এর ${after.label} VIP মেম্বার।${perk}` : `Congratulations ${name}! You are now a ${after.label} VIP at ${store?.storeName ?? "our store"}.${perk}` });
    }
  }

  // The friend's first order was delivered: the referrer's reward.
  if (s.referralEnabled) {
    const ref = await tx.customerReferral.findFirst({ where: { firstOrderId: orderId, isDelivered: false }, include: { referrerAccount: { include: { customer: true } } } });
    if (ref) {
      const claimed = await tx.customerReferral.updateMany({ where: { id: ref.id, isDelivered: false }, data: { isDelivered: true, rewardClaimedAt: now } });
      if (claimed.count === 1 && ref.bonusPoints > 0) {
        await tx.loyaltyTransaction.create({ data: { tenantId, accountId: ref.referrerId, orderId, points: ref.bonusPoints, type: "REFERRAL_BONUS", status: "CONFIRMED", description: `A friend's first order was delivered (${order.orderNumber})` } });
        await tx.$executeRaw`UPDATE "CustomerLoyaltyAccount" SET "availablePoints" = "availablePoints" + ${ref.bonusPoints}, "lifetimePoints" = "lifetimePoints" + ${ref.bonusPoints}, "updatedAt" = now() WHERE "id" = ${ref.referrerId}`;
        const who = order.customerName.trim().split(/\s+/)[0];
        notices.push({ phone: ref.referrerAccount.customer.phone, text: isBn(locale) ? `${who} আপনার রেফারেলে অর্ডার করেছেন! আপনি পেলেন ${ref.bonusPoints} রিওয়ার্ড পয়েন্ট।` : `${who} ordered with your referral! You earned ${ref.bonusPoints} reward points.` });
      }
    }
  }
  return notices;
}

/** Twelve months of delivered spend decides the tier. Recomputed from the orders, never incremented, so it cannot drift. */
export async function rerateTier(tx: TenantTx, accountId: string, customerId: string, now = new Date()): Promise<Tier> {
  const since = new Date(now.getTime() - 365 * 86_400_000);
  const agg = await tx.order.aggregate({ where: { customerId, status: "DELIVERED", deliveredAt: { gte: since } }, _sum: { totalAmount: true } });
  const spend = money(Number(agg._sum.totalAmount ?? 0));
  const tier = tierFor(spend, (await loadLoyaltySettings(tx)).tiers);
  await tx.customerLoyaltyAccount.update({ where: { id: accountId }, data: { rollingSpend12m: spend, currentTier: tier.level } });
  return tier;
}

/** Cancelled before delivery: give back spent points, void the pending earn, and free the friend's offer. */
export async function onCancelled(tx: TenantTx, orderId: string): Promise<void> {
  const rows = await tx.loyaltyTransaction.findMany({ where: { orderId, status: { in: ["PENDING", "CONFIRMED"] }, type: { in: ["EARN_PURCHASE", "REDEEM_PURCHASE"] } } });
  for (const r of rows) {
    const claimed = await tx.loyaltyTransaction.updateMany({ where: { id: r.id, status: r.status }, data: { status: "VOIDED", description: `Order cancelled` } });
    if (claimed.count !== 1) continue;
    if (r.type === "REDEEM_PURCHASE") await tx.$executeRaw`UPDATE "CustomerLoyaltyAccount" SET "availablePoints" = "availablePoints" + ${-r.points}, "updatedAt" = now() WHERE "id" = ${r.accountId}`;
    else if (r.status === "PENDING") await tx.$executeRaw`UPDATE "CustomerLoyaltyAccount" SET "pendingPoints" = GREATEST("pendingPoints" - ${r.points}, 0), "updatedAt" = now() WHERE "id" = ${r.accountId}`;
  }
  // A friend whose first order was cancelled has not had a first order: the offer is theirs again.
  await tx.customerReferral.deleteMany({ where: { firstOrderId: orderId, isDelivered: false } });
}

/** Returned after delivery: the earn and any referral reward it triggered are taken back (never below zero), the tier is re-rated. */
export async function onReturned(tx: TenantTx, orderId: string, now = new Date()): Promise<void> {
  const order = await tx.order.findFirst({ where: { id: orderId } });
  const rows = await tx.loyaltyTransaction.findMany({ where: { orderId, status: "CONFIRMED", type: { in: ["EARN_PURCHASE", "REFERRAL_BONUS", "REDEEM_PURCHASE"] } } });
  for (const r of rows) {
    const claimed = await tx.loyaltyTransaction.updateMany({ where: { id: r.id, status: "CONFIRMED" }, data: { status: "VOIDED", description: r.type === "REDEEM_PURCHASE" ? "Order returned: points given back" : "Order returned" } });
    if (claimed.count !== 1) continue;
    // Points the customer spent on goods that came back go back to them; points the order earned are taken away.
    if (r.type === "REDEEM_PURCHASE") await tx.$executeRaw`UPDATE "CustomerLoyaltyAccount" SET "availablePoints" = "availablePoints" + ${-r.points}, "updatedAt" = now() WHERE "id" = ${r.accountId}`;
    else await tx.$executeRaw`UPDATE "CustomerLoyaltyAccount" SET "availablePoints" = GREATEST("availablePoints" - ${r.points}, 0), "lifetimePoints" = GREATEST("lifetimePoints" - ${r.points}, 0), "updatedAt" = now() WHERE "id" = ${r.accountId}`;
  }
  if (order?.customerId) {
    const account = await tx.customerLoyaltyAccount.findFirst({ where: { customerId: order.customerId } });
    if (account) await rerateTier(tx, account.id, order.customerId, now);
  }
}

// ---- Telling the customer ----------------------------------------------------------------------------------------------------

/** After the order's transaction has committed. A failed or refused message never affects the order. */
export async function sendNotices(tenantId: string, notices: Notice[]): Promise<void> {
  for (const n of notices) {
    try {
      const ok = await withTenant(tenantId, async (tx) => {
        if (await tx.smsOptOut.findFirst({ where: { phone: n.phone } })) return false;
        return consumeSmsCredit(tx, tenantId);
      });
      if (ok) await currentSmsSender().send(tenantId, n.phone, n.text);
    } catch (e) {
      console.error("[loyalty] message failed", e instanceof Error ? e.name : "unknown");
    }
  }
}

// ---- Daily jobs: points that expire, and birthday vouchers -----------------------------------------------------------------

export interface LoyaltySweepSummary {
  expired: number;
  pointsExpired: number;
  vouchers: number;
}

const dhakaParts = (d: Date) => {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d);
  const n = (t: string) => Number(f.find((p) => p.type === t)!.value);
  return { year: n("year"), month: n("month"), day: n("day") };
};

/**
 * Use it or lose it: when a store sets an expiry, a member whose points have sat unused and who has not earned or spent anything
 * for that many months loses what is left (one EXPIRED row, so it stays in the history). Anything the customer does with their
 * points, or any new order delivered, starts the clock again. A customer is told 14 days before.
 */
export async function expireInactivePoints(tenantId: string, now = new Date()): Promise<{ expired: number; points: number; warned: number }> {
  const notices: Notice[] = [];
  const result = await withTenant(tenantId, async (tx) => {
    const s = await loadLoyaltySettings(tx);
    if (!s.enabled || s.expiryMonths <= 0) return { expired: 0, points: 0, warned: 0 };
    const cutoff = new Date(now.getTime() - s.expiryMonths * 30.4375 * 86_400_000);
    const warnFrom = new Date(cutoff.getTime() + 14 * 86_400_000);
    const locale = (await tx.tenant.findFirstOrThrow({ select: { locale: true } })).locale;
    const store = await tx.storeSettings.findFirst({ select: { storeName: true } });
    const accounts = await tx.customerLoyaltyAccount.findMany({ where: { availablePoints: { gt: 0 } }, include: { customer: { select: { phone: true, name: true } } }, take: 2000 });
    let expired = 0, points = 0, warned = 0;
    for (const a of accounts) {
      const last = await tx.loyaltyTransaction.findFirst({ where: { accountId: a.id, type: { not: "EXPIRED" }, status: { in: ["CONFIRMED", "PENDING"] } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
      const lastAt = last?.createdAt ?? a.createdAt;
      if (lastAt < cutoff) {
        const n = await tx.$executeRaw`UPDATE "CustomerLoyaltyAccount" SET "availablePoints" = 0, "updatedAt" = now() WHERE "id" = ${a.id} AND "availablePoints" = ${a.availablePoints}`;
        if (n === 1) {
          await tx.loyaltyTransaction.create({ data: { tenantId, accountId: a.id, points: -a.availablePoints, type: "EXPIRED", status: "CONFIRMED", description: `Expired after ${s.expiryMonths} months without activity` } });
          expired++;
          points += a.availablePoints;
        }
      } else if (lastAt < warnFrom) {
        // One warning per stretch of inactivity: a row records that it was sent.
        const sent = await tx.loyaltyTransaction.findFirst({ where: { accountId: a.id, type: "MANUAL_ADJUSTMENT", points: 0, createdAt: { gt: lastAt } }, select: { id: true } });
        if (!sent) {
          await tx.loyaltyTransaction.create({ data: { tenantId, accountId: a.id, points: 0, type: "MANUAL_ADJUSTMENT", status: "CONFIRMED", description: "Expiry reminder sent" } });
          const name = a.customer.name.trim().split(/\s+/)[0];
          notices.push({ phone: a.customer.phone, text: isBn(locale) ? `${name}, আপনার ${a.availablePoints} রিওয়ার্ড পয়েন্ট শীঘ্রই মেয়াদ শেষ হবে। ${store?.storeName ?? ""}-এ কিনলে বা ব্যবহার করলে থাকবে।` : `${name}, your ${a.availablePoints} reward points at ${store?.storeName ?? "our store"} will expire soon. Order or use them to keep them.` });
          warned++;
        }
      }
    }
    return { expired, points, warned };
  });
  await sendNotices(tenantId, notices);
  return result;
}

const VOUCHER_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** A voucher on the birthday of every member at Silver or above who gave their birthday, once a year. */
export async function sendBirthdayVouchers(tenantId: string, now = new Date()): Promise<number> {
  const notices: Notice[] = [];
  const sent = await withTenant(tenantId, async (tx) => {
    const s = await loadLoyaltySettings(tx);
    if (!s.enabled || s.birthdayVoucher <= 0) return 0;
    const t = dhakaParts(now);
    // A 29 February birthday is celebrated on the 28th in a year that has no 29th.
    const days = t.month === 2 && t.day === 28 && !isLeap(t.year) ? [28, 29] : [t.day];
    const locale = (await tx.tenant.findFirstOrThrow({ select: { locale: true } })).locale;
    const store = await tx.storeSettings.findFirst({ select: { storeName: true } });
    const accounts = await tx.customerLoyaltyAccount.findMany({
      where: { currentTier: { in: ["SILVER", "GOLD", "PLATINUM"] }, OR: [{ birthdayVoucherYear: null }, { birthdayVoucherYear: { not: t.year } }], customer: { birthMonth: t.month, birthDay: { in: days }, isBlacklisted: false } },
      include: { customer: { select: { phone: true, name: true } } }, take: 500,
    });
    let n = 0;
    for (const a of accounts) {
      // Claimed with a conditional update: two runs of the job cannot both send it.
      const claimed = await tx.$executeRaw`UPDATE "CustomerLoyaltyAccount" SET "birthdayVoucherYear" = ${t.year}, "updatedAt" = now() WHERE "id" = ${a.id} AND ("birthdayVoucherYear" IS NULL OR "birthdayVoucherYear" <> ${t.year})`;
      if (claimed !== 1) continue;
      const code = `BDAY-${Array.from(randomBytes(6), (b) => VOUCHER_CHARS[b % VOUCHER_CHARS.length]).join("")}`;
      await tx.coupon.create({ data: { tenantId, code, type: "FIXED_AMOUNT", value: s.birthdayVoucher, usageLimit: 1, perCustomerLimit: 1, isActive: true, startsAt: now, expiresAt: new Date(now.getTime() + 14 * 86_400_000) } });
      const name = a.customer.name.trim().split(/\s+/)[0];
      notices.push({ phone: a.customer.phone, text: isBn(locale) ? `শুভ জন্মদিন ${name}! ${store?.storeName ?? ""} থেকে উপহার: ৳${s.birthdayVoucher} ছাড়ের কোড ${code}, ১৪ দিন চলবে।` : `Happy birthday ${name}! A gift from ${store?.storeName ?? "us"}: ৳${s.birthdayVoucher} off with code ${code}, valid for 14 days.` });
      n++;
    }
    return n;
  });
  await sendNotices(tenantId, notices);
  return sent;
}

/** The daily job for every store that has one to do. One store failing does not stop the rest. */
export async function sweepLoyalty(now = new Date()): Promise<LoyaltySweepSummary & { stores: number; failed: number }> {
  const rows = await getBasePrisma().$queryRaw<{ tenantId: string }[]>`SELECT "tenantId" FROM tenants_with_loyalty_sweeps()`;
  const out = { stores: rows.length, expired: 0, pointsExpired: 0, vouchers: 0, failed: 0 };
  for (const r of rows) {
    try {
      const e = await expireInactivePoints(r.tenantId, now);
      out.expired += e.expired;
      out.pointsExpired += e.points;
      out.vouchers += await sendBirthdayVouchers(r.tenantId, now);
    } catch (e) {
      out.failed++;
      console.error("[loyalty] sweep failed", e instanceof Error ? e.name : "unknown");
    }
  }
  return out;
}

/** A keyed hash of a visitor's network address, so two orders from one connection can be told apart without storing the address. */
export function hashClient(ip: string | null | undefined): string | undefined {
  if (!ip) return undefined;
  const salt = process.env.PHONE_TRUST_SALT ?? process.env.CUSTOMER_AUTH_SECRET ?? "dev-client-salt";
  return createHmac("sha256", salt).update(`client:${ip.trim()}`).digest("hex").slice(0, 32);
}
