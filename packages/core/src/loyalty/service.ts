import { withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { NotFoundError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { REFERRAL_CODE, ensureAccount, loadLoyaltySettings, nextTier, pointsValue, tierOf, type LoyaltySettings, type Tier } from "./engine";

/** Settings, reports and the customer's own view for the loyalty program (docs/26 sections 6 and 7). */

const int = (v: unknown, label: string, min: number, max: number): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, "").trim());
  if (!Number.isInteger(n) || n < min || n > max) throw new ValidationError(`${label} must be a whole number from ${min} to ${max}`);
  return n;
};

export async function getLoyaltySettings(tenantId: string, actor: StaffActor): Promise<LoyaltySettings> {
  assertCan(actor, "marketing", "view");
  return withTenant(tenantId, (tx) => loadLoyaltySettings(tx));
}

export async function saveLoyaltySettings(tenantId: string, actor: StaffActor, input: Record<string, unknown>): Promise<void> {
  assertCan(actor, "marketing", "edit");
  const data = {
    loyaltyEnabled: input.enabled === true || input.enabled === "on",
    referralEnabled: input.referralEnabled === true || input.referralEnabled === "on",
    loyaltySpendPerPoint: int(input.spendPerPoint, "Spend per point", 1, 100000),
    loyaltyPointsPerBlock: int(input.pointsPerBlock, "Points per block", 1, 100000),
    loyaltyBdtPerBlock: int(input.bdtPerBlock, "Taka per block", 1, 100000),
    loyaltyMaxCartPercent: int(input.maxCartPercent, "Most of the cart points can pay", 1, 100),
    refereeDiscountBdt: int(input.refereeDiscount, "The friend's discount", 0, 100000),
    refereeMinCartBdt: int(input.refereeMinCart, "The smallest cart for the friend's discount", 0, 1000000),
    referrerRewardPoints: int(input.referrerReward, "The referrer's reward", 0, 1000000),
    loyaltyExpiryMonths: int(input.expiryMonths ?? 0, "Months before unused points expire", 0, 60),
    vipSilverMin: int(input.vipSilverMin ?? 5000, "Silver level", 1, 100000000),
    vipGoldMin: int(input.vipGoldMin ?? 15000, "Gold level", 1, 100000000),
    vipPlatinumMin: int(input.vipPlatinumMin ?? 35000, "Platinum level", 1, 100000000),
    vipGoldDiscount: int(input.vipGoldDiscount ?? 5, "Gold discount", 0, 50),
    vipPlatinumDiscount: int(input.vipPlatinumDiscount ?? 10, "Platinum discount", 0, 50),
    birthdayVoucherBdt: int(input.birthdayVoucher ?? 100, "Birthday voucher", 0, 100000),
  };
  if (!(data.vipSilverMin < data.vipGoldMin && data.vipGoldMin < data.vipPlatinumMin)) throw new ValidationError("The levels must go up: Silver, then Gold, then Platinum", { field: "vipGoldMin" });
  if (data.vipPlatinumDiscount < data.vipGoldDiscount) throw new ValidationError("Platinum should give at least as much off as Gold", { field: "vipPlatinumDiscount" });
  await withTenant(tenantId, async (tx) => {
    const before = await loadLoyaltySettings(tx);
    await tx.storeSettings.updateMany({ data });
    await tx.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey: "loyalty" } },
      create: { tenantId, moduleKey: "loyalty", isEnabled: data.loyaltyEnabled },
      update: { isEnabled: data.loyaltyEnabled },
    }).catch(() => {});
    await audit(tx, tenantId, actor, "loyalty.settings_changed", { from: before, to: data });
  });
}

export interface LoyaltyOverview {
  accounts: number;
  pointsOutstanding: number;
  pointsPending: number;
  /** Taka the store owes in discounts if every available point were spent. */
  liabilityBdt: number;
  tiers: { level: string; label: string; customers: number }[];
  referrals: { total: number; rewarded: number };
  leaderboard: { customerId: string; name: string; phone: string; tier: string; spend12m: number; points: number }[];
}

export async function getLoyaltyOverview(tenantId: string, actor: StaffActor): Promise<LoyaltyOverview> {
  assertCan(actor, "marketing", "view");
  return withTenant(tenantId, async (tx) => {
    const s = await loadLoyaltySettings(tx);
    const sums = await tx.customerLoyaltyAccount.aggregate({ _count: true, _sum: { availablePoints: true, pendingPoints: true } });
    const byTier = await tx.customerLoyaltyAccount.groupBy({ by: ["currentTier"], _count: true });
    const top = await tx.customerLoyaltyAccount.findMany({ orderBy: [{ rollingSpend12m: "desc" }, { lifetimePoints: "desc" }], take: 50, include: { customer: { select: { id: true, name: true, phone: true } } } });
    const total = await tx.customerReferral.count();
    const rewarded = await tx.customerReferral.count({ where: { isDelivered: true } });
    return {
      accounts: sums._count, pointsOutstanding: sums._sum.availablePoints ?? 0, pointsPending: sums._sum.pendingPoints ?? 0, liabilityBdt: pointsValue(sums._sum.availablePoints ?? 0, s),
      tiers: s.tiers.map((t) => ({ level: t.level, label: t.label, customers: byTier.find((b) => b.currentTier === t.level)?._count ?? 0 })),
      referrals: { total, rewarded },
      leaderboard: top.filter((a) => Number(a.rollingSpend12m) > 0 || a.lifetimePoints > 0).map((a) => ({ customerId: a.customer.id, name: a.customer.name, phone: a.customer.phone, tier: a.currentTier, spend12m: Number(a.rollingSpend12m), points: a.availablePoints })),
    };
  });
}

/** Staff correct a balance (a goodwill gift, a mistake). Never below zero, always with a reason, always in the audit log. */
export async function adjustPoints(tenantId: string, actor: StaffActor, customerId: string, points: number, reason: string): Promise<void> {
  assertCan(actor, "marketing", "edit");
  const why = reason.trim();
  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 100000) throw new ValidationError("Enter a whole number of points, not zero", { field: "points" });
  if (why.length < 3 || why.length > 200) throw new ValidationError("Write the reason, 3 to 200 characters", { field: "reason" });
  await withTenant(tenantId, async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: customerId } });
    if (!customer) throw new NotFoundError("Customer");
    const account = await ensureAccount(tx, tenantId, customerId, customer.name);
    if (points < 0) {
      const n = await tx.$executeRaw`UPDATE "CustomerLoyaltyAccount" SET "availablePoints" = "availablePoints" + ${points}, "updatedAt" = now() WHERE "id" = ${account.id} AND "availablePoints" >= ${-points}`;
      if (n === 0) throw new ValidationError(`This customer has only ${account.availablePoints} points`, { field: "points" });
    } else {
      await tx.$executeRaw`UPDATE "CustomerLoyaltyAccount" SET "availablePoints" = "availablePoints" + ${points}, "lifetimePoints" = "lifetimePoints" + ${points}, "updatedAt" = now() WHERE "id" = ${account.id}`;
    }
    await tx.loyaltyTransaction.create({ data: { tenantId, accountId: account.id, points, type: "MANUAL_ADJUSTMENT", status: "CONFIRMED", description: `${why} (by ${actor.name ?? actor.email})` } });
    await audit(tx, tenantId, actor, "loyalty.points_adjusted", { customerId, points, reason: why });
  });
}

// ---- The customer's own view ---------------------------------------------------------------------------------------------

export interface AccountView {
  enabled: boolean;
  referralEnabled: boolean;
  available: number;
  pending: number;
  worthBdt: number;
  tier: Tier;
  next: { tier: Tier; remainingBdt: number; progressPercent: number } | null;
  spend12m: number;
  referralCode: string;
  referralOffer: { discount: number; reward: number; minCart: number };
  /** Points expire after this many months with no activity (0 = never). */
  expiryMonths: number;
  birth: { month: number; day: number } | null;
  birthdayVoucher: number;
  referrals: { total: number; rewarded: number };
  ledger: { id: string; points: number; type: string; status: string; description: string; createdAt: Date }[];
}

/** For a signed-in customer. Creates the account the first time it is looked at, so there is a referral code to share. */
export async function getAccountView(tenantId: string, customerId: string): Promise<AccountView | null> {
  return withTenant(tenantId, async (tx) => {
    const s = await loadLoyaltySettings(tx);
    if (!s.enabled && !s.referralEnabled) return null;
    const customer = await tx.customer.findFirst({ where: { id: customerId } });
    if (!customer) return null;
    const a = await ensureAccount(tx, tenantId, customerId, customer.name);
    const tier = tierOf(a.currentTier, s.tiers);
    const nx = nextTier(a.currentTier, s.tiers);
    const spend = Number(a.rollingSpend12m);
    const ledger = await tx.loyaltyTransaction.findMany({ where: { accountId: a.id }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, points: true, type: true, status: true, description: true, createdAt: true } });
    const total = await tx.customerReferral.count({ where: { referrerId: a.id } });
    const rewarded = await tx.customerReferral.count({ where: { referrerId: a.id, isDelivered: true } });
    return {
      enabled: s.enabled, referralEnabled: s.referralEnabled, available: a.availablePoints, pending: a.pendingPoints, worthBdt: pointsValue(a.availablePoints, s), tier,
      next: nx ? { tier: nx, remainingBdt: Math.max(0, Math.ceil(nx.min - spend)), progressPercent: Math.min(100, Math.round(((spend - tier.min) / (nx.min - tier.min)) * 100)) } : null,
      spend12m: spend, referralCode: a.referralCode, referralOffer: { discount: s.refereeDiscount, reward: s.referrerReward, minCart: s.refereeMinCart },
      expiryMonths: s.expiryMonths, birthdayVoucher: s.birthdayVoucher, birth: customer.birthMonth && customer.birthDay ? { month: customer.birthMonth, day: customer.birthDay } : null,
      referrals: { total, rewarded }, ledger,
    };
  });
}

/** What the friend sees before ordering: who invited them and what it is worth. Public, so it reveals a first name and nothing else. */
export async function getReferralOffer(tenantId: string, rawCode: string): Promise<{ code: string; referrerName: string; discount: number; minCart: number } | null> {
  const code = rawCode.trim().toUpperCase();
  if (!REFERRAL_CODE.test(code)) return null;
  return withTenant(tenantId, async (tx) => {
    const s = await loadLoyaltySettings(tx);
    if (!s.referralEnabled || s.refereeDiscount <= 0) return null;
    const a = await tx.customerLoyaltyAccount.findFirst({ where: { referralCode: code }, include: { customer: { select: { name: true } } } });
    if (!a) return null;
    return { code, referrerName: a.customer.name.trim().split(/\s+/)[0] ?? a.customer.name, discount: s.refereeDiscount, minCart: s.refereeMinCart };
  });
}

/** For the header pill: read-only, never creates anything. Null when the program is off or the customer has no account yet. */
export async function getPointsSummary(tenantId: string, customerId: string): Promise<{ available: number; worthBdt: number } | null> {
  return withTenant(tenantId, async (tx) => {
    const s = await loadLoyaltySettings(tx);
    if (!s.enabled) return null;
    const a = await tx.customerLoyaltyAccount.findFirst({ where: { customerId }, select: { availablePoints: true } });
    return a ? { available: a.availablePoints, worthBdt: pointsValue(a.availablePoints, s) } : null;
  });
}

/** What the storefront may know without a sign-in: which parts of the program are switched on. */
export async function getLoyaltyPublic(tenantId: string): Promise<{ enabled: boolean; referralEnabled: boolean }> {
  return withTenant(tenantId, async (tx) => {
    const s = await loadLoyaltySettings(tx);
    return { enabled: s.enabled, referralEnabled: s.referralEnabled };
  });
}

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * The customer tells us their birthday (month and day only, no year), once. It earns a voucher each year at Silver and above.
 * It cannot be changed afterwards by the customer, so it cannot be moved around to collect vouchers; the store can clear it.
 */
export async function setBirthday(tenantId: string, customerId: string, month: number, day: number): Promise<void> {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > DAYS_IN_MONTH[month - 1]!) throw new ValidationError("Choose a real date", { field: "birthday" });
  await withTenant(tenantId, async (tx) => {
    const c = await tx.customer.findFirst({ where: { id: customerId }, select: { birthMonth: true, birthDay: true } });
    if (!c) throw new NotFoundError("Customer");
    if (c.birthMonth != null) throw new ValidationError("Your birthday is already saved. Ask the store if it needs to change.", { field: "birthday" });
    await tx.customer.update({ where: { id: customerId }, data: { birthMonth: month, birthDay: day } });
  });
}

/** Staff can clear a customer's birthday if it was entered wrongly. */
export async function clearBirthday(tenantId: string, actor: StaffActor, customerId: string): Promise<void> {
  assertCan(actor, "customers", "edit");
  await withTenant(tenantId, async (tx) => {
    const n = await tx.customer.updateMany({ where: { id: customerId }, data: { birthMonth: null, birthDay: null } });
    if (n.count === 0) throw new NotFoundError("Customer");
    await audit(tx, tenantId, actor, "customer.birthday_cleared", { customerId });
  });
}
