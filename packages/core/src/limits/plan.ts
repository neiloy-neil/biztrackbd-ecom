import { randomUUID } from "node:crypto";
import type { TenantTx } from "@biztrackbd/db";
import { withTenant } from "@biztrackbd/db";
import { PlanLimitError } from "../errors";

/** Plan.limits as stored. null means unlimited. Prices and limits live in the Plan table, never in code. */
export interface PlanLimits {
  products: number | null;
  ordersPerMonth: number | null;
  staff: number | null;
  /** Photo storage in gigabytes. */
  storageGb: number | null;
}

/** Orders keep flowing past the plan, with warnings. Percent of the monthly order limit. */
export const ORDER_THRESHOLDS = [80, 100, 110] as const;
export type OrderThreshold = (typeof ORDER_THRESHOLDS)[number];

export type UsageState = "ok" | "warning" | "at_limit" | "over" | "exceeded" | "unlimited";

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function getPlanLimits(tx: TenantTx): Promise<PlanLimits & { timezone: string; tier: string }> {
  const tenant = await tx.tenant.findFirstOrThrow({ select: { planTier: true, timezone: true } });
  const plan = await tx.plan.findUnique({ where: { tier: tenant.planTier } });
  const limits = (plan?.limits ?? {}) as Record<string, unknown>;

  const adjustments = await tx.tenantQuotaAdjustment.findMany({
    where: { type: "PRODUCT_LIMIT" },
    select: { amount: true },
  }).catch(() => []);
  const extraProducts = adjustments.reduce((acc, a) => acc + a.amount, 0);

  const baseProducts = num(limits.products);
  const products = baseProducts !== null ? baseProducts + extraProducts : null;

  return { products, ordersPerMonth: num(limits.ordersPerMonth), staff: num(limits.staff), storageGb: num(limits.storageGb), timezone: tenant.timezone, tier: tenant.planTier };
}

/** First day of the current month in the store's own timezone, as YYYY-MM-01. A store in Dhaka rolls over at Dhaka midnight. */
export function monthStart(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit" }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}-01`;
}

/**
 * Claims one product slot. Atomic: the check and the increment are one statement, so two creates racing for the last
 * slot cannot both win. Call inside the same transaction that inserts the product so a failed insert gives the slot back.
 */
export async function claimProductSlot(tx: TenantTx, tenantId: string, count = 1): Promise<void> {
  const { products: limit } = await getPlanLimits(tx);
  const rows = await tx.$queryRaw<{ productCount: number }[]>`
    UPDATE "Tenant" SET "productCount" = "productCount" + ${count}
    WHERE "id" = ${tenantId} AND (${limit}::int IS NULL OR "productCount" + ${count} <= ${limit}::int)
    RETURNING "productCount"`;
  if (rows.length === 0) {
    const t = await tx.tenant.findFirstOrThrow({ select: { productCount: true } });
    throw new PlanLimitError("products", limit ?? 0, t.productCount);
  }
}

export async function releaseProductSlot(tx: TenantTx, tenantId: string, count = 1): Promise<void> {
  await tx.$executeRaw`UPDATE "Tenant" SET "productCount" = GREATEST("productCount" - ${count}, 0) WHERE "id" = ${tenantId}`;
}

/** Repairs drift (for example after a bulk import or a manual edit) by counting the real, non-deleted products. */
export async function reconcileProductCount(tx: TenantTx, tenantId: string): Promise<number> {
  const n = await tx.product.count({ where: { deletedAt: null } });
  await tx.tenant.update({ where: { id: tenantId }, data: { productCount: n } });
  return n;
}

/**
 * Counts one order against this month. Never blocks. Returns the thresholds this very order crossed. Because the
 * counter moves one step at a time and the increment is atomic, "value equals the threshold" happens exactly once.
 */
export async function recordOrderUsage(tx: TenantTx, tenantId: string): Promise<{ used: number; limit: number | null; crossed: OrderThreshold[] }> {
  const plan = await getPlanLimits(tx);
  const period = monthStart(new Date(), plan.timezone);
  const [row] = await tx.$queryRaw<{ v: number }[]>`
    INSERT INTO "UsageCounter" ("id", "tenantId", "metric", "periodStart", "value", "updatedAt")
    VALUES (${randomUUID()}, ${tenantId}, 'orders', ${period}::date, 1, now())
    ON CONFLICT ("tenantId", "metric", "periodStart") DO UPDATE SET "value" = "UsageCounter"."value" + 1, "updatedAt" = now()
    RETURNING "value"::int AS v`;
  const used = row?.v ?? 0;
  const limit = plan.ordersPerMonth;
  const crossed = limit == null ? [] : ORDER_THRESHOLDS.filter((p) => used === Math.ceil((limit * p) / 100));
  return { used, limit, crossed };
}

export interface MeterUsage {
  used: number;
  limit: number | null;
  /** Percent of the limit, rounded down. null when unlimited. */
  percent: number | null;
  state: UsageState;
  /** Orders only: the last order count that still counts as grace. */
  graceLimit?: number;
}

export interface UsageSummary {
  tier: string;
  products: MeterUsage;
  orders: MeterUsage;
}

export function productState(used: number, limit: number | null): UsageState {
  if (limit == null) return "unlimited";
  if (used >= limit) return "at_limit";
  return used >= limit * 0.8 ? "warning" : "ok";
}

export function orderState(used: number, limit: number | null): UsageState {
  if (limit == null) return "unlimited";
  const grace = Math.floor(limit * 1.1);
  if (used > grace) return "exceeded";
  if (used >= limit) return "over";
  return used >= limit * 0.8 ? "warning" : "ok";
}

/** What the billing screen and the limit banners show. */
export async function readUsage(tx: TenantTx, now = new Date()): Promise<UsageSummary> {
  const plan = await getPlanLimits(tx);
  const tenant = await tx.tenant.findFirstOrThrow({ select: { productCount: true } });
  const counter = await tx.usageCounter.findFirst({ where: { metric: "orders", periodStart: new Date(`${monthStart(now, plan.timezone)}T00:00:00.000Z`) } });
  const ordersUsed = Number(counter?.value ?? 0);
  const pct = (u: number, l: number | null) => (l ? Math.floor((u / l) * 100) : null);
  return {
    tier: plan.tier,
    products: { used: tenant.productCount, limit: plan.products, percent: pct(tenant.productCount, plan.products), state: productState(tenant.productCount, plan.products) },
    orders: {
      used: ordersUsed, limit: plan.ordersPerMonth, percent: pct(ordersUsed, plan.ordersPerMonth),
      state: orderState(ordersUsed, plan.ordersPerMonth), graceLimit: plan.ordersPerMonth == null ? undefined : Math.floor(plan.ordersPerMonth * 1.1),
    },
  };
}

/**
 * Claims room for an upload. One conditional UPDATE, so simultaneous uploads cannot together pass the limit.
 * Photos removed from products are not given back yet (a clean-up job will); the counter only grows.
 */
export async function claimStorage(tenantId: string, bytes: number): Promise<void> {
  await withTenant(tenantId, async (tx) => {
    const { storageGb } = await getPlanLimits(tx);
    const limitBytes = storageGb == null ? null : Math.round(storageGb * 1024 ** 3);
    const rows = await tx.$queryRaw<{ used: bigint }[]>`
      UPDATE "Tenant" SET "storageBytesUsed" = "storageBytesUsed" + ${bytes}
      WHERE "id" = ${tenantId} AND (${limitBytes}::bigint IS NULL OR "storageBytesUsed" + ${bytes} <= ${limitBytes}::bigint)
      RETURNING "storageBytesUsed" AS used`;
    if (rows.length === 0) {
      const t = await tx.tenant.findFirstOrThrow({ select: { storageBytesUsed: true } });
      throw new PlanLimitError("storage", storageGb ?? 0, Math.round(Number(t.storageBytesUsed) / 1024 ** 3));
    }
  });
}

/** Gives storage back when photos are deleted. Never goes below zero. */
export async function releaseStorage(tenantId: string, bytes: number): Promise<void> {
  if (!Number.isFinite(bytes) || bytes <= 0) return;
  await withTenant(tenantId, (tx) => tx.$executeRaw`UPDATE "Tenant" SET "storageBytesUsed" = GREATEST("storageBytesUsed" - ${Math.floor(bytes)}, 0) WHERE "id" = ${tenantId}`);
}
