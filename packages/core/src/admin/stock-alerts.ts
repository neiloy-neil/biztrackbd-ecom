import { Prisma, getBasePrisma, withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { currentSmsSender } from "../customers/auth";
import { ValidationError } from "../errors";
import { consumeSmsCredit } from "../growth/abandoned";
import { assertCan, type StaffActor } from "../permissions";
import { normalizeBdPhone } from "../phone";
import { storeOriginFor } from "../storefront/origin";

/** "Tell me when it is back". A shopper leaves a mobile number on a sold-out item; when it is in stock again they get one SMS. */

const PENDING_PER_PHONE = 10;
/** Messages go to the longest-waiting first, and no more than this many per unit in stock (people who wait often do not buy), so a handful of units is not announced to hundreds. */
const MESSAGES_PER_UNIT = 3;
const MIN_MESSAGES = 5;

export async function requestStockAlert(tenantId: string, input: { variantId: string; phone: string; name?: string }): Promise<{ alreadyWaiting: boolean }> {
  let phone: string;
  try { phone = normalizeBdPhone(input.phone); } catch { throw new ValidationError("Enter a valid mobile number, like 01712345678", { field: "phone" }); }
  const name = input.name?.replace(/\s+/g, " ").trim().slice(0, 80) || null;
  return withTenant(tenantId, async (tx) => {
    const v = await tx.productVariant.findFirst({ where: { id: input.variantId }, include: { product: { select: { status: true, deletedAt: true } } } });
    if (!v || v.product.status !== "ACTIVE" || v.product.deletedAt) throw new ValidationError("This item is not on sale");
    if (v.stockQuantity > 0) throw new ValidationError("Good news, it is in stock now. You can order it.", { field: "stock" });
    const existing = await tx.stockAlert.findFirst({ where: { variantId: v.id, phone } });
    if (existing && !existing.notifiedAt) return { alreadyWaiting: true };
    if ((await tx.stockAlert.count({ where: { phone, notifiedAt: null } })) >= PENDING_PER_PHONE) throw new ValidationError("You are already waiting for several items. We will message you as they arrive.");
    if (existing) await tx.stockAlert.update({ where: { id: existing.id }, data: { notifiedAt: null, skipReason: null, name: name ?? existing.name, createdAt: new Date() } });
    else await tx.stockAlert.create({ data: { tenantId, variantId: v.id, phone, name } });
    return { alreadyWaiting: false };
  });
}

export interface StockAlertRow {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  waiting: number;
  stock: number;
  oldest: Date;
}

/** What shoppers are waiting for, most wanted first. */
export async function listStockAlerts(tenantId: string, actor: StaffActor): Promise<{ rows: StockAlertRow[]; sentThisMonth: number }> {
  assertCan(actor, "products", "view");
  return withTenant(tenantId, async (tx) => {
    const g = await tx.stockAlert.groupBy({ by: ["variantId"], where: { notifiedAt: null }, _count: { _all: true }, _min: { createdAt: true } });
    const variants = await tx.productVariant.findMany({ where: { id: { in: g.map((x) => x.variantId) } }, include: { product: { select: { title: true } } } });
    const rows = g.map((x) => {
      const v = variants.find((y) => y.id === x.variantId)!;
      return { variantId: x.variantId, productTitle: v.product.title, variantTitle: v.title, waiting: x._count._all, stock: v.stockQuantity, oldest: x._min.createdAt! };
    }).sort((a, b) => b.waiting - a.waiting || a.productTitle.localeCompare(b.productTitle));
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    return { rows, sentThisMonth: await tx.stockAlert.count({ where: { notifiedAt: { gte: start }, skipReason: null } }) };
  });
}

const MESSAGE = {
  en: (p: string, s: string, link: string) => `Good news! ${p} is back in stock at ${s}. Order here: ${link}`,
  bn: (p: string, s: string, link: string) => `সুখবর! ${s}-এ ${p} আবার স্টকে এসেছে। অর্ডার করুন: ${link}`,
};

export interface RestockSummary { checked: number; sent: number; skipped: number; waiting: number }

/**
 * Sends the "it is back" SMS for every waiting request whose item now has stock. Safe to run any time and as often as you like:
 * each request is claimed before it is sent, so nobody is messaged twice. Never throws for one bad request.
 */
export async function notifyRestocked(tenantId: string, opts: { variantIds?: string[] } = {}): Promise<RestockSummary> {
  const sum: RestockSummary = { checked: 0, sent: 0, skipped: 0, waiting: 0 };
  const ready = await withTenant(tenantId, async (tx) => {
    const alerts = await tx.stockAlert.findMany({
      where: { notifiedAt: null, ...(opts.variantIds ? { variantId: { in: opts.variantIds } } : {}), variant: { stockQuantity: { gt: 0 }, product: { status: "ACTIVE", deletedAt: null } } },
      include: { variant: { include: { product: { select: { title: true, titleBn: true, slug: true } } } } }, orderBy: { createdAt: "asc" },
    });
    if (alerts.length === 0) return null;
    const t = await tx.tenant.findFirstOrThrow({ select: { name: true, locale: true } });
    const s = await tx.storeSettings.findFirst({ select: { storeName: true } });
    return { alerts, locale: t.locale.startsWith("bn") ? ("bn" as const) : ("en" as const), store: s?.storeName ?? t.name };
  });
  if (!ready) return sum;
  const origin = await storeOriginFor(tenantId);
  // How many may be told per item: the longest-waiting first.
  const budget = new Map<string, number>();
  for (const a of ready.alerts) if (!budget.has(a.variantId)) budget.set(a.variantId, Math.max(a.variant.stockQuantity * MESSAGES_PER_UNIT, MIN_MESSAGES));
  for (const a of ready.alerts) {
    sum.checked++;
    if ((budget.get(a.variantId) ?? 0) <= 0) { sum.waiting++; continue; }
    // claim it, so two runs at once cannot both send
    const gate = await withTenant(tenantId, async (tx) => {
      const claimed = await tx.stockAlert.updateMany({ where: { id: a.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
      if (claimed.count === 0) return "taken" as const;
      if (await tx.smsOptOut.findFirst({ where: { phone: a.phone } })) { await tx.stockAlert.update({ where: { id: a.id }, data: { skipReason: "opted out" } }); return "skip" as const; }
      if (!(await consumeSmsCredit(tx, tenantId))) { await tx.stockAlert.update({ where: { id: a.id }, data: { notifiedAt: null } }); return "no_credits" as const; }
      return "send" as const;
    });
    if (gate === "taken") continue;
    if (gate === "skip") { sum.skipped++; continue; }
    if (gate === "no_credits") { sum.waiting++; continue; }
    budget.set(a.variantId, (budget.get(a.variantId) ?? 1) - 1);
    const p = a.variant.product;
    const title = ready.locale === "bn" && p.titleBn ? p.titleBn : p.title;
    const name = a.variant.title && a.variant.title.toLowerCase() !== "default" ? `${title} (${a.variant.title})` : title;
    try {
      await currentSmsSender().send(tenantId, a.phone, MESSAGE[ready.locale](name, ready.store, `${origin}/products/${p.slug}`));
      sum.sent++;
    } catch (e) {
      console.error("[stock-alerts] sms failed", e instanceof Error ? e.name : "unknown");
      await withTenant(tenantId, (tx) => tx.stockAlert.update({ where: { id: a.id }, data: { skipReason: "sms failed" } }));
      sum.skipped++;
    }
  }
  return sum;
}

/** For the scheduled job: every store that has shoppers waiting for something now in stock. One store failing does not stop the rest. */
export async function sweepStockAlerts(): Promise<RestockSummary & { stores: number; failed: number }> {
  const rows = await getBasePrisma().$queryRaw<{ tenantId: string }[]>(Prisma.sql`SELECT "tenantId" FROM tenants_with_restocked_alerts()`);
  const total = { stores: rows.length, checked: 0, sent: 0, skipped: 0, waiting: 0, failed: 0 };
  for (const r of rows) {
    try {
      const s = await notifyRestocked(r.tenantId);
      total.checked += s.checked; total.sent += s.sent; total.skipped += s.skipped; total.waiting += s.waiting;
    } catch (e) {
      total.failed++;
      console.error("[stock-alerts] store failed", r.tenantId, e instanceof Error ? e.name : "unknown");
    }
  }
  return total;
}

/** A shopper's request removed by the owner (for example a wrong number). */
export async function removeStockAlerts(tenantId: string, actor: StaffActor, variantId: string): Promise<number> {
  assertCan(actor, "products", "edit");
  return withTenant(tenantId, async (tx) => {
    const { count } = await tx.stockAlert.deleteMany({ where: { variantId, notifiedAt: null } });
    await audit(tx, tenantId, actor, "stock_alerts.cleared", { count });
    return count;
  });
}

/** Called after stock went up. Tells waiting shoppers, and never lets a failed message undo the stock change. */
export async function afterRestock(tenantId: string): Promise<void> {
  try {
    await notifyRestocked(tenantId);
  } catch (e) {
    console.error("[stock-alerts] after restock failed", e instanceof Error ? e.name : "unknown");
  }
}
