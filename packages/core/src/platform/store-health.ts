import { getPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { assertPlatformCan, type PlatformActor } from "./admin";
import { accessState, type AccessInput } from "./lifecycle";

/**
 * How each store is doing, for the platform team: who is thriving, who is drifting, who is about to leave. Every signal comes from
 * data we already hold (logins, orders, plan dates, SMS used), so nothing new is collected from the store.
 */

export type StoreHealth = "NEW" | "HEALTHY" | "AT_RISK" | "CHURNING";
export const STORE_HEALTHS: StoreHealth[] = ["CHURNING", "AT_RISK", "NEW", "HEALTHY"];

export interface HealthInput {
  createdAt: Date;
  status: string;
  isDemo: boolean;
  suspendedReason: string | null;
  trialEndsAt: Date;
  subscription: { amount: number; currentPeriodEnd: Date } | null;
  lastLoginAt: Date | null;
  orders30d: number;
  productCount: number;
  smsUsed: number;
  smsLimit: number | null;
}

export interface HealthResult {
  health: StoreHealth;
  /** Plain sentences the team can read at a glance. Worst first. */
  reasons: string[];
  paying: boolean;
  /** Days left in the trial or paid period; negative when it has run out. */
  daysLeft: number | null;
  daysSinceLogin: number | null;
}

const DAY = 24 * 60 * 60 * 1000;
const daysBetween = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / DAY);

/** The rules, with no database: the same input always gives the same answer. */
export function scoreStore(s: HealthInput, now: Date = new Date()): HealthResult {
  const sub = s.subscription;
  const paying = sub !== null && sub.amount > 0;
  const a = accessState({ status: s.status as AccessInput["status"], trialEndsAt: s.trialEndsAt, suspendedReason: s.suspendedReason, isDemo: s.isDemo, subscription: sub }, now);
  const age = daysBetween(now, s.createdAt);
  const sinceLogin = s.lastLoginAt ? daysBetween(now, s.lastLoginAt) : null;
  const paidThrough = sub ? sub.currentPeriodEnd : s.trialEndsAt;
  const daysLeft = a.daysLeft ?? (a.overdueDays !== null ? -a.overdueDays : null);

  const churning: string[] = [];
  const atRisk: string[] = [];

  if (a.state === "LOCKED") churning.push(paying ? "Locked: the plan has lapsed" : "Locked: the trial ended without a payment");
  else if (a.state === "READ_ONLY") churning.push(paying ? `Read-only: payment ${a.overdueDays} days late` : `Read-only: trial ended ${a.overdueDays} days ago`);
  else if (a.state === "GRACE") atRisk.push(paying ? `Payment is ${a.overdueDays} day${a.overdueDays === 1 ? "" : "s"} late` : `Trial ended ${a.overdueDays} day${a.overdueDays === 1 ? "" : "s"} ago, no payment yet`);

  if (a.state === "TRIAL" || a.state === "ACTIVE") {
    const left = Math.ceil((paidThrough.getTime() - now.getTime()) / DAY);
    if (left <= 3 && left >= 0) {
      if (a.state === "TRIAL") atRisk.push(left === 0 ? "Trial ends today" : `Trial ends in ${left} day${left === 1 ? "" : "s"}${s.orders30d === 0 ? " and no orders yet" : ""}`);
      else atRisk.push(left === 0 ? "Plan ends today" : `Plan ends in ${left} day${left === 1 ? "" : "s"}`);
    }
  }

  if (a.state !== "LOCKED" && !s.isDemo) {
    if (sinceLogin !== null && sinceLogin >= 30 && age >= 30) churning.push(`No login for ${sinceLogin} days`);
    else if (sinceLogin !== null && sinceLogin >= 14 && age >= 14) atRisk.push(`No login for ${sinceLogin} days`);
    else if (sinceLogin === null && age >= 3) atRisk.push(`Never logged in (signed up ${age} days ago)`);
    if (paying && s.orders30d === 0 && age >= 30) atRisk.push("Paying but no orders in 30 days");
    if (!paying && a.state === "TRIAL" && age >= 7 && s.orders30d === 0 && s.productCount <= 3) atRisk.push("A week in and no products or orders yet");
    if (s.smsLimit !== null && s.smsLimit > 0 && s.smsUsed >= s.smsLimit) atRisk.push("Out of free SMS this month");
  }

  const health: StoreHealth = churning.length > 0 ? "CHURNING" : atRisk.length > 0 ? "AT_RISK" : age < 7 ? "NEW" : "HEALTHY";
  return { health, reasons: [...churning, ...atRisk], paying, daysLeft, daysSinceLogin: sinceLogin };
}

// ---- The list --------------------------------------------------------------------------------------------------------------

export interface StoreHealthRow extends HealthResult {
  tenantId: string;
  name: string;
  subdomain: string;
  planTier: string;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  lastOrderAt: Date | null;
  orders30d: number;
  productCount: number;
  staff: number;
  smsUsed: number;
  smsLimit: number | null;
  hasPayment: boolean;
  hasCourier: boolean;
}

export interface StoreHealthView {
  rows: StoreHealthRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<StoreHealth, number> & { all: number; paying: number; trial: number };
}

export const STORE_HEALTH_PAGE_SIZE = 25;
const RANK: Record<StoreHealth, number> = { CHURNING: 0, AT_RISK: 1, NEW: 2, HEALTHY: 3 };

/** First day of this month in Dhaka, as the date the usage counters are keyed by. */
const dhakaMonth = (now: Date) => new Date(`${new Date(now.getTime() + 6 * 3600_000).toISOString().slice(0, 7)}-01T00:00:00.000Z`);

export async function listStoreHealth(
  actor: PlatformActor,
  opts: { health?: StoreHealth | "all"; plan?: string; q?: string; page?: number; pageSize?: number } = {},
  db: PrismaClient = getPlatformPrisma(),
  now: Date = new Date(),
): Promise<StoreHealthView> {
  assertPlatformCan(actor, "tenants", "view");
  const since30 = new Date(now.getTime() - 30 * DAY);
  const [tenants, plans, orders, lastOrders, logins, staff, sms, settings, couriers] = await Promise.all([
    db.tenant.findMany({
      where: { isDemo: false, status: { not: "CANCELLED" } },
      select: { id: true, name: true, subdomain: true, planTier: true, status: true, createdAt: true, trialEndsAt: true, suspendedReason: true, isDemo: true, productCount: true, subscription: { select: { amount: true, currentPeriodEnd: true } } },
    }),
    db.plan.findMany({ select: { tier: true, limits: true } }),
    db.order.groupBy({ by: ["tenantId"], where: { createdAt: { gte: since30 }, deletedAt: null }, _count: { _all: true } }),
    db.order.groupBy({ by: ["tenantId"], where: { deletedAt: null }, _max: { createdAt: true } }),
    db.tenantUser.groupBy({ by: ["tenantId"], _max: { lastLoginAt: true } }),
    db.tenantUser.groupBy({ by: ["tenantId"], where: { isActive: true }, _count: { _all: true } }),
    db.usageCounter.findMany({ where: { metric: "sms", periodStart: dhakaMonth(now) }, select: { tenantId: true, value: true } }),
    db.storeSettings.findMany({ select: { tenantId: true, codEnabled: true, bkashNumber: true, nagadNumber: true } }),
    db.tenantIntegration.groupBy({ by: ["tenantId"], where: { provider: { in: ["STEADFAST", "PATHAO", "REDX"] } }, _count: { _all: true } }),
  ]);

  const smsLimitOf = new Map(plans.map((p) => [p.tier as string, typeof (p.limits as Record<string, unknown> | null)?.smsCredits === "number" ? ((p.limits as Record<string, number>).smsCredits as number) : null]));
  const by = <T extends { tenantId: string }, V>(rows: T[], pick: (r: T) => V) => new Map(rows.map((r) => [r.tenantId, pick(r)]));
  const orders30 = by(orders, (r) => r._count._all);
  const lastOrder = by(lastOrders, (r) => r._max.createdAt);
  const lastLogin = by(logins, (r) => r._max.lastLoginAt);
  const staffOf = by(staff, (r) => r._count._all);
  const smsOf = by(sms, (r) => Number(r.value));
  const payOf = by(settings, (r) => Boolean(r.codEnabled || r.bkashNumber || r.nagadNumber));
  const courierOf = by(couriers, (r) => r._count._all > 0);

  const all: StoreHealthRow[] = tenants.map((t) => {
    const smsUsed = smsOf.get(t.id) ?? 0;
    const smsLimit = smsLimitOf.get(t.planTier) ?? null;
    const input: HealthInput = {
      createdAt: t.createdAt, status: t.status, isDemo: t.isDemo, suspendedReason: t.suspendedReason, trialEndsAt: t.trialEndsAt,
      subscription: t.subscription ? { amount: Number(t.subscription.amount), currentPeriodEnd: t.subscription.currentPeriodEnd } : null,
      lastLoginAt: lastLogin.get(t.id) ?? null, orders30d: orders30.get(t.id) ?? 0, productCount: t.productCount, smsUsed, smsLimit,
    };
    return {
      ...scoreStore(input, now), tenantId: t.id, name: t.name, subdomain: t.subdomain, planTier: t.planTier, status: t.status, createdAt: t.createdAt,
      lastLoginAt: input.lastLoginAt, lastOrderAt: lastOrder.get(t.id) ?? null, orders30d: input.orders30d, productCount: t.productCount,
      staff: staffOf.get(t.id) ?? 0, smsUsed, smsLimit, hasPayment: payOf.get(t.id) ?? false, hasCourier: courierOf.get(t.id) ?? false,
    };
  });

  const counts = { all: all.length, paying: all.filter((r) => r.paying).length, trial: all.filter((r) => !r.paying).length, CHURNING: 0, AT_RISK: 0, NEW: 0, HEALTHY: 0 };
  for (const r of all) counts[r.health]++;

  const q = opts.q?.trim().toLowerCase();
  const filtered = all
    .filter((r) => !opts.health || opts.health === "all" || r.health === opts.health)
    .filter((r) => !opts.plan || opts.plan === "all" || r.planTier === opts.plan)
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.subdomain.toLowerCase().includes(q))
    .sort((a, b) => RANK[a.health] - RANK[b.health] || b.reasons.length - a.reasons.length || b.createdAt.getTime() - a.createdAt.getTime());

  const pageSize = opts.pageSize ?? STORE_HEALTH_PAGE_SIZE;
  const page = Math.max(1, Math.min(opts.page ?? 1, Math.max(1, Math.ceil(filtered.length / pageSize))));
  return { rows: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize, counts };
}
