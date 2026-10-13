import { withTenant } from "@biztrackbd/db";
import { normalizeBdPhone } from "../phone";
import { NotFoundError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { audit } from "../audit/service";

/**
 * What a landing page earns and who it reached (docs/46, stage 3). Views are counted per day with no visitor identified. A lead is a name and
 * number someone typed on the page; it is kept for 30 days so the seller can call, and becomes ORDERED when an order from that number arrives.
 */

export const LEAD_KEEP_DAYS = 30;
const day = (d = new Date()): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Counts one view of a live page. A page that does not exist or is not live counts nothing and says nothing. */
export async function recordLandingView(tenantId: string, slug: string): Promise<void> {
  await withTenant(tenantId, async (tx) => {
    const page = await tx.landingPage.findFirst({ where: { slug, isPublished: true }, select: { id: true } });
    if (!page) return;
    await tx.$executeRaw`INSERT INTO "LandingDaily" ("landingPageId", "day", "tenantId", "views", "orders") VALUES (${page.id}, ${day()}::date, ${tenantId}, 1, 0)
      ON CONFLICT ("landingPageId", "day") DO UPDATE SET "views" = "LandingDaily"."views" + 1`;
  });
}

/** Counts an order that came from the page and marks the lead from the same number as ordered. Called once per new order. */
export async function recordLandingOrder(tenantId: string, landingPageId: string, phone: string): Promise<void> {
  await withTenant(tenantId, async (tx) => {
    await tx.$executeRaw`INSERT INTO "LandingDaily" ("landingPageId", "day", "tenantId", "views", "orders") VALUES (${landingPageId}, ${day()}::date, ${tenantId}, 0, 1)
      ON CONFLICT ("landingPageId", "day") DO UPDATE SET "orders" = "LandingDaily"."orders" + 1`;
    await tx.landingLead.updateMany({ where: { landingPageId, phone }, data: { status: "ORDERED" } });
  });
}

export interface LeadInput {
  name: string;
  phone: string;
  offerLabel?: string;
  utmSource?: string;
  utmCampaign?: string;
}

/**
 * Keeps a name and number typed on a page. One lead per number per page; typing again updates it. Never overwrites an ORDERED lead, and
 * quietly drops anything that is not a real mobile number and a name. Old leads are removed here, so no separate job is needed.
 */
export async function saveLandingLead(tenantId: string, slug: string, input: LeadInput): Promise<boolean> {
  let phone: string;
  try {
    phone = normalizeBdPhone(input.phone);
  } catch {
    return false;
  }
  const name = input.name.replace(/[<>]/g, "").trim().slice(0, 120);
  if (name.length < 2) return false;
  return withTenant(tenantId, async (tx) => {
    const page = await tx.landingPage.findFirst({ where: { slug, isPublished: true }, select: { id: true } });
    if (!page) return false;
    const clip = (v: string | undefined, n: number) => (v ? v.slice(0, n) : null);
    await tx.landingLead.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - LEAD_KEEP_DAYS * 86_400_000) } } });
    const data = { name, offerLabel: clip(input.offerLabel, 80), utmSource: clip(input.utmSource, 100), utmCampaign: clip(input.utmCampaign, 100) };
    const existing = await tx.landingLead.findFirst({ where: { landingPageId: page.id, phone }, select: { id: true, status: true } });
    if (existing) {
      if (existing.status === "NEW") await tx.landingLead.update({ where: { id: existing.id }, data });
      return true;
    }
    await tx.landingLead.create({ data: { tenantId, landingPageId: page.id, phone, ...data } });
    return true;
  });
}

export interface LandingStats {
  days: number;
  views: number;
  orders: number;
  /** Orders per hundred views, one decimal; null before the first view. */
  conversion: number | null;
  perDay: { day: string; views: number; orders: number }[];
  sources: { source: string; campaign: string; orders: number }[];
  leads: number;
}

export async function landingStats(tenantId: string, actor: StaffActor, id: string, days = 30): Promise<LandingStats> {
  assertCan(actor, "design", "view");
  const since = day(new Date(Date.now() - (days - 1) * 86_400_000));
  return withTenant(tenantId, async (tx) => {
    if (!(await tx.landingPage.findFirst({ where: { id }, select: { id: true } }))) throw new NotFoundError("Landing page");
    const rows = await tx.landingDaily.findMany({ where: { landingPageId: id, day: { gte: since } }, orderBy: { day: "asc" } });
    const views = rows.reduce((n, r) => n + r.views, 0);
    const orders = rows.reduce((n, r) => n + r.orders, 0);
    const bySource = await tx.order.groupBy({ by: ["utmSource", "utmCampaign"], where: { landingPageId: id, createdAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { id: "desc" } }, take: 8 });
    const leads = await tx.landingLead.count({ where: { landingPageId: id, status: "NEW" } });
    return {
      days, views, orders, conversion: views > 0 ? Math.round((orders / views) * 1000) / 10 : null,
      perDay: rows.map((r) => ({ day: r.day.toISOString().slice(0, 10), views: r.views, orders: r.orders })),
      sources: bySource.map((s) => ({ source: s.utmSource ?? "direct", campaign: s.utmCampaign ?? "", orders: s._count._all })),
      leads,
    };
  });
}

/** Views and orders in the last N days for each page, for the list screen. */
export async function landingTotals(tenantId: string, actor: StaffActor, ids: string[], days = 30): Promise<Map<string, { views: number; orders: number }>> {
  assertCan(actor, "design", "view");
  const since = day(new Date(Date.now() - (days - 1) * 86_400_000));
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.landingDaily.groupBy({ by: ["landingPageId"], where: { landingPageId: { in: ids }, day: { gte: since } }, _sum: { views: true, orders: true } });
    return new Map(rows.map((r) => [r.landingPageId, { views: r._sum.views ?? 0, orders: r._sum.orders ?? 0 }]));
  });
}

export interface LeadRow {
  id: string;
  name: string;
  phone: string;
  offerLabel: string | null;
  source: string;
  status: string;
  createdAt: Date;
}

export async function listLandingLeads(tenantId: string, actor: StaffActor, id: string, take = 100): Promise<LeadRow[]> {
  assertCan(actor, "design", "view");
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.landingLead.findMany({ where: { landingPageId: id }, orderBy: { createdAt: "desc" }, take });
    return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, offerLabel: r.offerLabel, source: [r.utmSource, r.utmCampaign].filter(Boolean).join(" / ") || "direct", status: r.status, createdAt: r.createdAt }));
  });
}

export async function deleteLandingLead(tenantId: string, actor: StaffActor, leadId: string): Promise<void> {
  assertCan(actor, "design", "edit");
  await withTenant(tenantId, async (tx) => {
    const lead = await tx.landingLead.findFirst({ where: { id: leadId }, select: { id: true, landingPageId: true } });
    if (!lead) throw new ValidationError("That lead is already gone");
    await tx.landingLead.delete({ where: { id: lead.id } });
    await audit(tx, tenantId, actor, "landing.lead.deleted", { landingPageId: lead.landingPageId });
  });
}
