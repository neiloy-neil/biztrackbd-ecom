import { getPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { themeDefinition } from "../builder/theme";
import { MODULES } from "../modules/service";
import { notExpired } from "../modules/expiry";
import { assertPlatformCan, type PlatformActor } from "./admin";

/**
 * What the theme and add-on module sales have earned. Money is counted when the platform approved the payment (for a payment made online,
 * when the gateway confirmed it), so the numbers match the approvals list. Rejected and waiting payments are never in the totals; what is still
 * waiting is shown beside them. Months follow Bangladesh time, not UTC, so a sale late on the last night of a month lands in that month.
 */

export const REVENUE_RANGES = ["30d", "90d", "12m", "all"] as const;
export type RevenueRange = (typeof REVENUE_RANGES)[number];
export const isRevenueRange = (v: unknown): v is RevenueRange => (REVENUE_RANGES as readonly string[]).includes(String(v));

const DAY = 24 * 60 * 60 * 1000;
const BD_OFFSET_MS = 6 * 60 * 60 * 1000;

/** The first moment the range covers, or null for everything. */
export function rangeStart(range: RevenueRange, now: Date = new Date()): Date | null {
  if (range === "30d") return new Date(now.getTime() - 30 * DAY);
  if (range === "90d") return new Date(now.getTime() - 90 * DAY);
  if (range === "12m") return new Date(now.getTime() - 365 * DAY);
  return null;
}

/** "2026-11" for a moment, in Bangladesh time. */
export const monthKey = (d: Date): string => new Date(d.getTime() + BD_OFFSET_MS).toISOString().slice(0, 7);

/** The last `count` month keys ending with the month of `now`, oldest first. */
export function lastMonths(count: number, now: Date = new Date()): string[] {
  const [y, m] = monthKey(now).split("-").map(Number) as [number, number];
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const total = y * 12 + (m - 1) - i;
    out.push(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`);
  }
  return out;
}

export interface RevenueLine {
  id: string;
  name: string;
  orders: number;
  revenue: number;
  /** Different stores that paid in the range. */
  stores: number;
  lastSaleAt: Date | null;
}

export interface RevenueMonth { month: string; themes: number; modules: number; total: number }

export interface RecentSale { kind: "THEME" | "MODULE"; id: string; name: string; storeName: string; amount: number; at: Date }

export interface CatalogueRevenue {
  range: RevenueRange;
  totals: { themes: number; modules: number; total: number; orders: number };
  /** Payments sent and not decided yet. */
  pending: { count: number; amount: number };
  /** Right now: monthly themes and modules that are paid up. */
  active: { monthlyThemes: number; monthlyModules: number };
  byTheme: RevenueLine[];
  byModule: RevenueLine[];
  /** The last 12 months, whatever the range, so the chart always has the same shape. */
  byMonth: RevenueMonth[];
  recent: RecentSale[];
}

interface Sale { key: string; tenantId: string; storeName: string; amount: number; at: Date; /** Rows of one bundle payment share it, so the payment is counted once. */ group?: string | null }

function lines(sales: Sale[], nameOf: (id: string) => string): RevenueLine[] {
  const by = new Map<string, { revenue: number; orders: number; stores: Set<string>; last: Date }>();
  for (const s of sales) {
    const e = by.get(s.key) ?? { revenue: 0, orders: 0, stores: new Set<string>(), last: s.at };
    e.revenue += s.amount; e.orders += 1; e.stores.add(s.tenantId);
    if (s.at > e.last) e.last = s.at;
    by.set(s.key, e);
  }
  return [...by.entries()]
    .map(([id, e]) => ({ id, name: nameOf(id), orders: e.orders, revenue: e.revenue, stores: e.stores.size, lastSaleAt: e.last }))
    .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));
}

const moduleName = (key: string) => MODULES.find((m) => m.key === key)?.label ?? key;

export async function getCatalogueRevenue(actor: PlatformActor, range: RevenueRange = "30d", db: PrismaClient = getPlatformPrisma(), now: Date = new Date()): Promise<CatalogueRevenue> {
  assertPlatformCan(actor, "payments", "view");
  const [themeRows, moduleRows, themeWaiting, moduleWaiting, themeNames, monthlyThemes, monthlyModules] = await Promise.all([
    db.themePurchase.findMany({ where: { status: "APPROVED", approvedAt: { not: null } }, select: { themeId: true, tenantId: true, amount: true, approvedAt: true, groupId: true, tenant: { select: { name: true } } } }),
    db.modulePurchase.findMany({ where: { status: "APPROVED", approvedAt: { not: null } }, select: { moduleKey: true, tenantId: true, amount: true, approvedAt: true, tenant: { select: { name: true } } } }),
    db.themePurchase.aggregate({ where: { status: "PENDING" }, _count: { _all: true }, _sum: { amount: true } }),
    db.modulePurchase.aggregate({ where: { status: "PENDING" }, _count: { _all: true }, _sum: { amount: true } }),
    db.theme.findMany({ select: { id: true, name: true } }),
    db.themePurchase.findMany({ where: { status: "APPROVED", expiresAt: { gt: now } }, select: { tenantId: true, themeId: true } }),
    db.tenantModule.count({ where: { source: "PURCHASE", isEnabled: true, expiresAt: { not: null }, ...notExpired(now) } }),
  ]);
  const names = new Map(themeNames.map((t) => [t.id, t.name]));
  const themeName = (id: string) => names.get(id) ?? themeDefinition(id).name;

  const toTheme = (r: (typeof themeRows)[number]): Sale => ({ key: r.themeId, tenantId: r.tenantId, storeName: r.tenant.name, amount: Number(r.amount), at: r.approvedAt!, group: r.groupId });
  const toModule = (r: (typeof moduleRows)[number]): Sale => ({ key: r.moduleKey, tenantId: r.tenantId, storeName: r.tenant.name, amount: Number(r.amount), at: r.approvedAt! });
  const allThemes = themeRows.map(toTheme);
  const allModules = moduleRows.map(toModule);

  const from = rangeStart(range, now);
  const inRange = (s: Sale) => !from || s.at >= from;
  const themes = allThemes.filter(inRange);
  const modules = allModules.filter(inRange);
  const sum = (xs: Sale[]) => xs.reduce((n, s) => n + s.amount, 0);

  const months = lastMonths(12, now);
  const byMonth: RevenueMonth[] = months.map((month) => ({ month, themes: 0, modules: 0, total: 0 }));
  const slot = new Map(byMonth.map((m) => [m.month, m]));
  for (const s of allThemes) { const m = slot.get(monthKey(s.at)); if (m) { m.themes += s.amount; m.total += s.amount; } }
  for (const s of allModules) { const m = slot.get(monthKey(s.at)); if (m) { m.modules += s.amount; m.total += s.amount; } }

  const recent: RecentSale[] = [
    ...themes.map((s): RecentSale => ({ kind: "THEME", id: s.key, name: themeName(s.key), storeName: s.storeName, amount: s.amount, at: s.at })),
    ...modules.map((s): RecentSale => ({ kind: "MODULE", id: s.key, name: moduleName(s.key), storeName: s.storeName, amount: s.amount, at: s.at })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 20);

  return {
    range,
    totals: { themes: sum(themes), modules: sum(modules), total: sum(themes) + sum(modules), orders: new Set(themes.map((s, i) => s.group ?? `row${i}`)).size + modules.length },
    pending: { count: themeWaiting._count._all + moduleWaiting._count._all, amount: Number(themeWaiting._sum.amount ?? 0) + Number(moduleWaiting._sum.amount ?? 0) },
    active: { monthlyThemes: new Set(monthlyThemes.map((p) => `${p.tenantId}:${p.themeId}`)).size, monthlyModules },
    byTheme: lines(themes, themeName),
    byModule: lines(modules, moduleName),
    byMonth,
    recent,
  };
}
