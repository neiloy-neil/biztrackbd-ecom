import { notifyOwner } from "../mail/send";
import { Prisma, getPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { addDays, dhakaDate } from "../admin/dashboard";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { publishEvent } from "../events";
import { money } from "../orders/pricing";
import { syncTenantRouting } from "../routing/edge-config";
import { accessState, addPeriod, statusFor, type Access } from "./lifecycle";
import { toPlanView, type PlanView } from "./billing";
import { redactName, redactPhone } from "../site/mode";

/**
 * The super admin's operations (docs/07 section 25). Every function takes the acting platform user first, checks what their
 * role allows, runs on the platform client (which sees every store), and writes a PlatformAuditLog line in the same transaction.
 */

export type PlatformRole = "OWNER" | "SUPPORT_LEAD" | "SUPPORT" | "FINANCE";
export interface PlatformActor {
  id: string;
  email: string;
  role: PlatformRole;
  ip?: string;
}
export interface Deps {
  db?: PrismaClient;
  now?: Date;
}
const dbOf = (d?: Deps) => d?.db ?? getPlatformPrisma();
const nowOf = (d?: Deps) => d?.now ?? new Date();

export type PlatformArea = "tenants" | "payments" | "plans" | "audit" | "suspend" | "adjust" | "tickets" | "announcements" | "settings";
type Level = "none" | "view" | "edit";
const N = "none", V = "view", E = "edit";
export const PLATFORM_PERMISSIONS: Record<PlatformRole, Record<PlatformArea, Level>> = {
  OWNER:        { tenants: E, payments: E, plans: E, audit: E, suspend: E, adjust: E, tickets: E, announcements: E, settings: E },
  FINANCE:      { tenants: V, payments: E, plans: V, audit: V, suspend: N, adjust: E, tickets: V, announcements: V, settings: N },
  SUPPORT_LEAD: { tenants: V, payments: V, plans: V, audit: N, suspend: E, adjust: E, tickets: E, announcements: E, settings: E },
  SUPPORT:      { tenants: V, payments: N, plans: N, audit: N, suspend: N, adjust: N, tickets: E, announcements: V, settings: N },
};
const RANK = { none: 0, view: 1, edit: 2 } as const;
export const canPlatform = (role: PlatformRole, area: PlatformArea, level: "view" | "edit" = "view") => RANK[PLATFORM_PERMISSIONS[role]?.[area] ?? "none"] >= RANK[level];
export function assertPlatformCan(actor: PlatformActor, area: PlatformArea, level: "view" | "edit" = "view"): void {
  if (!canPlatform(actor.role, area, level)) throw new ForbiddenError();
}

type Tx = Prisma.TransactionClient | PrismaClient;
async function log(tx: Tx, actor: PlatformActor | "SYSTEM", action: string, tenantId: string | null, details: Record<string, unknown> = {}) {
  await tx.platformAuditLog.create({
    data: { actorId: actor === "SYSTEM" ? "SYSTEM" : actor.id, action, tenantId, details: details as Prisma.InputJsonValue, ipAddress: actor === "SYSTEM" ? null : actor.ip },
  });
}

const accessOf = (t: { status: never | string; trialEndsAt: Date; suspendedReason: string | null }, sub: { amount: Prisma.Decimal; currentPeriodEnd: Date } | null, now: Date): Access =>
  accessState({ status: t.status as never, trialEndsAt: t.trialEndsAt, suspendedReason: t.suspendedReason, subscription: sub ? { amount: Number(sub.amount), currentPeriodEnd: sub.currentPeriodEnd } : null }, now);

/** After a status change the storefront router must hear about it (docs/13). Never fails the change: Postgres is already right. */
async function resync(tenantId: string): Promise<void> {
  try {
    await syncTenantRouting(tenantId);
  } catch (e) {
    console.error("[platform] routing sync failed", tenantId, e instanceof Error ? e.name : "unknown");
  }
}

// ---- Overview ------------------------------------------------------------------------------------------------------

export interface PlatformOverview {
  mrr: number;
  arr: number;
  payingStores: number;
  activeTrials: number;
  trialsEndingSoon: number;
  pastDue: number;
  readOnlyOrLocked: number;
  failingDomains: number;
  /** Stores that have paid at least once, out of stores whose trial is over. */
  trialToPaidPercent: number | null;
  /** Paying stores that lapsed in the last 30 days, out of those plus the ones still paying. */
  churnPercent: number | null;
  pendingPayments: { count: number; amount: number };
  openTickets: number;
  quarantined: number;
  signups: { date: string; count: number }[];
  byPlan: { tier: string; stores: number }[];
  cohorts: {
    portfolioSites: number;
    ecommerceStores: number;
    hybridTenants: number;
    portfolioLeads7d: number;
    portfolioBookings7d: number;
  };
  needsAttentionQueue: {
    severity: "CRIT" | "HIGH" | "WARN" | "INFO";
    tenantId: string;
    tenantName: string;
    subdomain: string;
    siteMode: string;
    issue: string;
    impactedService: string;
    actionUrl: string;
    actionLabel: string;
  }[];
  newestSignups: {
    id: string;
    name: string;
    subdomain: string;
    theme: string;
    status: "Trial" | "Paying" | "Suspended" | "Past due";
    createdAt: Date;
  }[];
}

const THEME_NAMES: Record<string, string> = {
  kapor: "Kapor",
  gadgetstudio: "Gadget Studio",
  "mini-bunny": "Mini Bunny",
  axionwear: "Axionwear",
  bindu: "Bindu",
  berber: "Berber",
};

export async function getOverview(actor: PlatformActor, deps?: Deps): Promise<PlatformOverview> {
  assertPlatformCan(actor, "tenants", "view");
  const db = dbOf(deps), now = nowOf(deps);
  const since7d = new Date(now.getTime() - 7 * 86_400_000);

  const [subs, tenants, pending, quarantined, paidEver, openTicketsCount, failingDomainsCount, recentTenants, portfolioLeads7d, portfolioBookings7d, failingDomainsList] = await Promise.all([
    db.subscription.findMany({ select: { tenantId: true, amount: true, interval: true, status: true, planTier: true, currentPeriodEnd: true } }),
    db.tenant.findMany({ where: { isDemo: false }, select: { id: true, name: true, subdomain: true, status: true, trialEndsAt: true, createdAt: true, suspendedReason: true, planTier: true, siteMode: true, businessVertical: true, quarantined: true } }),
    db.paymentProof.aggregate({ where: { status: "PENDING" }, _count: { _all: true }, _sum: { amount: true } }),
    db.tenant.count({ where: { quarantined: true, suspendedReason: null, isDemo: false } }),
    db.paymentProof.groupBy({ by: ["tenantId"], where: { status: "APPROVED" } }),
    db.supportTicket.count({ where: { status: "OPEN" } }),
    db.domain.count({ where: { verified: false } }),
    db.tenant.findMany({
      where: { isDemo: false },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        subdomain: true,
        createdAt: true,
        status: true,
        trialEndsAt: true,
        suspendedReason: true,
        themeInstalls: { where: { isActive: true }, select: { themeId: true }, take: 1 },
        subscription: { select: { amount: true, currentPeriodEnd: true } },
      },
    }),
    db.siteLead.count({ where: { createdAt: { gte: since7d } } }).catch(() => 0),
    db.bookingRequest.count({ where: { createdAt: { gte: since7d } } }).catch(() => 0),
    db.domain.findMany({
      where: { verified: false },
      take: 4,
      select: { domain: true, tenantId: true, tenant: { select: { name: true, subdomain: true, siteMode: true } } },
    }).catch(() => []),
  ]);
  const subOf = new Map(subs.map((s) => [s.tenantId, s]));
  let mrr = 0, paying = 0, trials = 0, trialsEndingSoon = 0, pastDue = 0, locked = 0, lapsed = 0, trialsOver = 0;
  let portfolioSites = 0, ecommerceStores = 0, hybridTenants = 0;
  const byPlan = new Map<string, number>();

  for (const t of tenants) {
    const s = subOf.get(t.id) ?? null;
    const a = accessOf(t, s, now);
    if (a.state === "ACTIVE") {
      paying++;
      mrr += s ? (s.interval === "YEARLY" ? Number(s.amount) / 12 : Number(s.amount)) : 0;
      byPlan.set(t.planTier, (byPlan.get(t.planTier) ?? 0) + 1);
    }
    if (a.state === "TRIAL") {
      trials++;
      if (a.daysLeft !== null && a.daysLeft <= 3) trialsEndingSoon++;
    }
    if (a.state === "GRACE") pastDue++;
    if (a.state === "READ_ONLY" || a.state === "LOCKED") locked++;
    if (a.state !== "TRIAL") trialsOver++;
    if (s && Number(s.amount) > 0 && a.state !== "ACTIVE" && now.getTime() - s.currentPeriodEnd.getTime() < 30 * 86_400_000) lapsed++;

    const mode = t.siteMode || "ECOMMERCE";
    if (mode === "PORTFOLIO") portfolioSites++;
    else if (mode === "HYBRID") hybridTenants++;
    else ecommerceStores++;
  }

  const needsAttentionQueue: PlatformOverview["needsAttentionQueue"] = [];

  for (const fd of failingDomainsList) {
    needsAttentionQueue.push({
      severity: "CRIT",
      tenantId: fd.tenantId,
      tenantName: fd.tenant.name,
      subdomain: fd.tenant.subdomain,
      siteMode: fd.tenant.siteMode || "ECOMMERCE",
      issue: `Custom domain ${fd.domain} verification pending (SSL at risk)`,
      impactedService: "Storefront / Edge Routing",
      actionUrl: `/tenants/${fd.tenantId}?tab=domains`,
      actionLabel: "Fix Domain",
    });
  }

  const quarantinedTenants = tenants.filter((t) => t.quarantined && !t.suspendedReason);
  for (const qt of quarantinedTenants.slice(0, 3)) {
    needsAttentionQueue.push({
      severity: "HIGH",
      tenantId: qt.id,
      tenantName: qt.name,
      subdomain: qt.subdomain,
      siteMode: qt.siteMode || "ECOMMERCE",
      issue: "Tenant quarantined under brand safety review",
      impactedService: "Public Website",
      actionUrl: `/tenants/${qt.id}`,
      actionLabel: "Review Hold",
    });
  }

  const expiringTrials = tenants.filter((t) => {
    const s = subOf.get(t.id) ?? null;
    const a = accessOf(t, s, now);
    return a.state === "TRIAL" && a.daysLeft !== null && a.daysLeft <= 3;
  });
  for (const et of expiringTrials.slice(0, 3)) {
    needsAttentionQueue.push({
      severity: "WARN",
      tenantId: et.id,
      tenantName: et.name,
      subdomain: et.subdomain,
      siteMode: et.siteMode || "ECOMMERCE",
      issue: "Trial expires in <= 3 days",
      impactedService: "Merchant Access",
      actionUrl: `/tenants/${et.id}`,
      actionLabel: "Extend Trial",
    });
  }

  const today = dhakaDate(now);
  const counts = new Map<string, number>();
  for (const t of tenants) counts.set(dhakaDate(t.createdAt), (counts.get(dhakaDate(t.createdAt)) ?? 0) + 1);
  const signups = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((date) => ({ date, count: counts.get(date) ?? 0 }));

  const newestSignups = recentTenants.map((rt) => {
    const sub = rt.subscription;
    const a = accessOf(rt, sub, now);
    const themeRaw = rt.themeInstalls[0]?.themeId ?? "kapor";
    const status: "Trial" | "Paying" | "Suspended" | "Past due" =
      rt.suspendedReason ? "Suspended" : a.state === "ACTIVE" ? "Paying" : a.state === "GRACE" ? "Past due" : "Trial";
    return {
      id: rt.id,
      name: rt.name,
      subdomain: rt.subdomain,
      theme: THEME_NAMES[themeRaw] ?? themeRaw,
      status,
      createdAt: rt.createdAt,
    };
  });

  return {
    mrr: money(mrr), arr: money(mrr * 12), payingStores: paying, activeTrials: trials, trialsEndingSoon, pastDue, readOnlyOrLocked: locked,
    failingDomains: failingDomainsCount,
    trialToPaidPercent: trialsOver > 0 ? Math.round((paidEver.length / trialsOver) * 1000) / 10 : null,
    churnPercent: paying + lapsed > 0 ? Math.round((lapsed / (paying + lapsed)) * 1000) / 10 : null,
    pendingPayments: { count: pending._count._all, amount: Number(pending._sum.amount ?? 0) },
    openTickets: openTicketsCount,
    quarantined, signups,
    byPlan: [...byPlan.entries()].map(([tier, stores]) => ({ tier, stores })),
    cohorts: {
      portfolioSites,
      ecommerceStores,
      hybridTenants,
      portfolioLeads7d,
      portfolioBookings7d,
    },
    needsAttentionQueue,
    newestSignups,
  };
}

// ---- Tenants -------------------------------------------------------------------------------------------------------

export interface TenantRow {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  tier: string;
  access: Access;
  mrr?: number;
  ordersCount?: number;
  quarantined: boolean;
  isDemo: boolean;
  createdAt: Date;
  status?: string;
  siteMode?: string;
  businessVertical?: string | null;
}

export type TenantFilter = "all" | "trial" | "paying" | "overdue" | "locked" | "flagged" | "suspended" | "cancelled";

export interface TenantCounts {
  all: number;
  paying: number;
  trial: number;
  overdue: number;
  suspended: number;
  cancelled: number;
}

export async function listTenants(actor: PlatformActor, opts: { q?: string; filter?: TenantFilter; page?: number; pageSize?: number } = {}, deps?: Deps): Promise<{ rows: TenantRow[]; total: number; page: number; pageSize: number; counts: TenantCounts }> {
  assertPlatformCan(actor, "tenants", "view");
  const db = dbOf(deps), now = nowOf(deps);
  const q = opts.q?.trim();
  // Digits only count as a phone number when the search looks like one, so "shop12" does not match every number containing 12.
  const phoneDigits = q && /^[\d\s+()-]{4,}$/.test(q) ? q.replace(/[^\d]/g, "").replace(/^88/, "") : "";
  // Visitors' private demo copies (docs/41) come and go every few hours; they are not stores anyone needs to manage.
  const notCopies: Prisma.TenantWhereInput = { OR: [{ demoKind: null }, { demoKind: { not: "SESSION" } }] };
  const where: Prisma.TenantWhereInput = q
    ? { AND: [notCopies, { OR: [
        { name: { contains: q, mode: "insensitive" } }, { subdomain: { contains: q.toLowerCase() } }, { ownerEmail: { contains: q.toLowerCase() } },
        { ownerPhone: { contains: phoneDigits || "~" } }, { customDomain: { contains: q.toLowerCase() } }, { domains: { some: { domain: { contains: q.toLowerCase() } } } },
      ] }] }
    : notCopies;
  // Access states come from dates, so the filters are applied after the read. A platform with thousands of stores moves this into SQL.
  const all = await db.tenant.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 2000,
    include: {
      subscription: { select: { amount: true, interval: true, currentPeriodEnd: true } },
      _count: { select: { orders: true } },
    },
  });

  const counts: TenantCounts = { all: 0, paying: 0, trial: 0, overdue: 0, suspended: 0, cancelled: 0 };

  const allRows = all.map((t): TenantRow => {
    const access = accessOf(t, t.subscription, now);
    const sub = t.subscription;
    const isPaying = sub && sub.currentPeriodEnd > now && Number(sub.amount) > 0;
    const mrr = isPaying ? (sub.interval === "YEARLY" ? Math.round(Number(sub.amount) / 12) : Number(sub.amount)) : 0;

    counts.all++;
    if (t.status === "CANCELLED") counts.cancelled++;
    else if (t.suspendedReason) counts.suspended++;
    else if (access.state === "ACTIVE") counts.paying++;
    else if (access.state === "TRIAL") counts.trial++;
    else if (access.state === "GRACE") counts.overdue++;

    return {
      id: t.id,
      name: t.name,
      subdomain: t.subdomain,
      customDomain: t.customDomain,
      ownerName: t.ownerName,
      ownerEmail: t.ownerEmail,
      ownerPhone: t.ownerPhone,
      tier: t.planTier,
      access,
      mrr,
      ordersCount: t._count.orders,
      quarantined: t.quarantined,
      isDemo: t.isDemo,
      createdAt: t.createdAt,
      status: t.status,
      siteMode: t.siteMode,
      businessVertical: t.businessVertical,
    };
  });

  const filter = opts.filter ?? "all";
  const rows = allRows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "trial") return r.access.state === "TRIAL" && !r.access.suspendedByPlatform && r.status !== "CANCELLED";
    if (filter === "paying") return r.access.state === "ACTIVE" && !r.access.suspendedByPlatform && r.status !== "CANCELLED";
    if (filter === "overdue") return r.access.state === "GRACE" && !r.access.suspendedByPlatform && r.status !== "CANCELLED";
    if (filter === "locked") return (r.access.state === "READ_ONLY" || r.access.state === "LOCKED") && r.status !== "CANCELLED";
    if (filter === "flagged") return r.quarantined;
    if (filter === "suspended") return Boolean(r.access.suspendedByPlatform);
    if (filter === "cancelled") return r.status === "CANCELLED";
    return true;
  });

  const pageSize = opts.pageSize ?? 25, page = Math.max(1, opts.page ?? 1);
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize, counts };
}

export interface TenantNoteRow {
  id: string;
  tenantId: string;
  authorId: string;
  authorName: string | null;
  body: string;
  createdAt: Date;
}

export interface TenantDetail extends TenantRow {
  status: string;
  trialEndsAt: Date;
  suspendedReason: string | null;
  quarantineReason: string | null;
  siteMode: string;
  businessVertical: string | null;
  leadsCount: number;
  leads30Days: number;
  bookingsConfirmed: number;
  recentLeads: {
    id: string;
    type: string;
    status: string;
    name: string;
    phone: string;
    sourcePage: string | null;
    createdAt: Date;
  }[];
  subscription: { tier: string; interval: string; amount: number; status: string; periodStart: Date; periodEnd: Date } | null;
  usage: {
    products: number;
    staff: number;
    ordersThisMonth: number;
    gmv30Days: number;
    ordersTotal: number;
    orders30Days: number;
    customers: number;
    smsUsed: number;
    storageMb: number;
  };
  planLimits: {
    products: number | null;
    staff: number | null;
    storageGb: number | null;
    smsCredits: number | null;
    ordersPerMonth: number | null;
  } | null;
  domains: { domain: string; verified: boolean; sslStatus: string; isPrimary: boolean }[];
  modules: { key: string; label: string; isEnabled: boolean }[];
  proofs: { id: string; plan: string; interval: string; amount: number; provider: string; trxId: string; status: string; createdAt: Date }[];
  notes: TenantNoteRow[];
  tickets: { id: string; subject: string; code: string; status: string; priority: string; createdAt: Date }[];
  audit: { id: string; action: string; actorId: string; createdAt: Date; details: unknown }[];
}

const MODULE_LABELS: Record<string, string> = {
  bespoke: "Bespoke tailoring",
  drops: "Drops and launches",
  baby_profiles: "Baby profiles",
  loyalty: "Loyalty, VIP & referrals",
  booking: "Bookings & appointments",
  wholesale: "Wholesale & B2B",
};

export async function getTenantDetail(actor: PlatformActor, tenantId: string, deps?: Deps): Promise<TenantDetail> {
  assertPlatformCan(actor, "tenants", "view");
  const db = dbOf(deps), now = nowOf(deps);
  const t = await db.tenant.findUnique({ where: { id: tenantId }, include: { subscription: true } });
  if (!t) throw new NotFoundError("Store");
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [staff, gmv, ordersTotal, orders30Days, customers, smsUsage, usageRow, domains, modules, proofs, notes, tickets, audit, plan, leadsCount, leads30Days, bookingsConfirmed, recentLeads] = await Promise.all([
    db.tenantUser.count({ where: { tenantId, isActive: true } }),
    db.order.aggregate({ where: { tenantId, status: "DELIVERED", deliveredAt: { gte: since } }, _sum: { totalAmount: true } }),
    db.order.count({ where: { tenantId } }),
    db.order.count({ where: { tenantId, createdAt: { gte: since } } }),
    db.customer.count({ where: { tenantId } }),
    db.usageCounter.findFirst({ where: { tenantId, metric: "sms", periodStart: { gte: month } }, orderBy: { periodStart: "desc" } }),
    db.usageCounter.findFirst({ where: { tenantId, metric: "orders", periodStart: { gte: month } }, orderBy: { periodStart: "desc" } }),
    db.domain.findMany({ where: { tenantId }, select: { domain: true, verified: true, sslStatus: true, isPrimary: true } }),
    db.tenantModule.findMany({ where: { tenantId } }),
    db.paymentProof.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.tenantNote.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.supportTicket.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.platformAuditLog.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.plan.findUnique({ where: { tier: t.planTier } }),
    db.siteLead.count({ where: { tenantId } }).catch(() => 0),
    db.siteLead.count({ where: { tenantId, createdAt: { gte: since } } }).catch(() => 0),
    db.bookingRequest.count({ where: { tenantId, status: "CONFIRMED" } }).catch(() => 0),
    db.siteLead.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        status: true,
        name: true,
        phone: true,
        sourcePage: true,
        createdAt: true,
      },
    }).catch(() => []),
  ]);

  const limits = (plan?.limits ?? {}) as Record<string, number | null>;

  return {
    id: t.id, name: t.name, subdomain: t.subdomain, ownerName: t.ownerName, ownerEmail: t.ownerEmail, ownerPhone: t.ownerPhone, tier: t.planTier, access: accessOf(t, t.subscription, now),
    quarantined: t.quarantined, isDemo: t.isDemo, createdAt: t.createdAt, status: t.status, trialEndsAt: t.trialEndsAt, suspendedReason: t.suspendedReason, quarantineReason: t.quarantineReason,
    siteMode: t.siteMode || "ECOMMERCE",
    businessVertical: t.businessVertical,
    leadsCount,
    leads30Days,
    bookingsConfirmed,
    recentLeads: recentLeads.map((l) => ({
      id: l.id,
      type: l.type,
      status: l.status,
      name: redactName(l.name),
      phone: redactPhone(l.phone),
      sourcePage: l.sourcePage,
      createdAt: l.createdAt,
    })),
    subscription: t.subscription ? { tier: t.subscription.planTier, interval: t.subscription.interval, amount: Number(t.subscription.amount), status: t.subscription.status, periodStart: t.subscription.currentPeriodStart, periodEnd: t.subscription.currentPeriodEnd } : null,
    usage: {
      products: t.productCount,
      staff,
      ordersThisMonth: Number(usageRow?.value ?? 0),
      gmv30Days: Number(gmv._sum.totalAmount ?? 0),
      ordersTotal,
      orders30Days,
      customers,
      smsUsed: Number(smsUsage?.value ?? 0),
      storageMb: Math.round(Number(t.storageBytesUsed) / 1_048_576),
    },
    planLimits: plan ? {
      products: typeof limits.products === "number" ? limits.products : null,
      staff: typeof limits.staff === "number" ? limits.staff : null,
      storageGb: typeof limits.storageGb === "number" ? limits.storageGb : null,
      smsCredits: typeof limits.smsCredits === "number" ? limits.smsCredits : null,
      ordersPerMonth: typeof limits.ordersPerMonth === "number" ? limits.ordersPerMonth : null,
    } : null,
    domains,
    modules: modules.map((m) => ({ key: m.moduleKey, label: MODULE_LABELS[m.moduleKey] ?? m.moduleKey, isEnabled: m.isEnabled })),
    proofs: proofs.map((p) => ({ id: p.id, plan: p.planTier, interval: p.billingPeriod, amount: Number(p.amount), provider: p.mfsProvider, trxId: p.trxId, status: p.status, createdAt: p.createdAt })),
    notes: notes.map((n) => ({ id: n.id, tenantId: n.tenantId, authorId: n.authorId, authorName: n.authorName, body: n.body, createdAt: n.createdAt })),
    tickets: tickets.map((tk) => ({ id: tk.id, subject: tk.subject, code: tk.code, status: tk.status, priority: tk.priority, createdAt: tk.createdAt })),
    audit: audit.map((a) => ({ id: a.id, action: a.action, actorId: a.actorId, createdAt: a.createdAt, details: a.details })),
  };
}

export async function addTenantNote(actor: PlatformActor, tenantId: string, body: string, deps?: Deps): Promise<TenantNoteRow> {
  assertPlatformCan(actor, "tenants", "view");
  const text = body.trim();
  if (text.length < 2) throw new ValidationError("Note cannot be empty");
  const db = dbOf(deps);
  const note = await db.tenantNote.create({
    data: {
      tenantId,
      authorId: actor.id,
      authorName: actor.email,
      body: text,
    },
  });
  await log(db, actor, "TENANT_NOTE_ADDED", tenantId, { noteId: note.id });
  return { id: note.id, tenantId: note.tenantId, authorId: note.authorId, authorName: note.authorName, body: note.body, createdAt: note.createdAt };
}

export async function listTenantNotes(actor: PlatformActor, tenantId: string, deps?: Deps): Promise<TenantNoteRow[]> {
  assertPlatformCan(actor, "tenants", "view");
  const db = dbOf(deps);
  const rows = await db.tenantNote.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((n) => ({ id: n.id, tenantId: n.tenantId, authorId: n.authorId, authorName: n.authorName, body: n.body, createdAt: n.createdAt }));
}

// ---- Payments ------------------------------------------------------------------------------------------------------

export interface PaymentRow {
  id: string;
  tenantId: string;
  storeName: string;
  subdomain: string;
  plan: string;
  interval: string;
  amount: number;
  provider: string;
  senderNumber: string;
  trxId: string;
  note: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: Date;
  approvedAt: Date | null;
  /** Other proofs with the same sender number: a hint that one person is paying for several stores, or reusing a number. */
  senderSeenOnOtherStores: number;
}

export async function listPayments(actor: PlatformActor, status: "PENDING" | "APPROVED" | "REJECTED" | "ALL" = "PENDING", deps?: Deps): Promise<PaymentRow[]> {
  assertPlatformCan(actor, "payments", "view");
  const db = dbOf(deps);
  const rows = await db.paymentProof.findMany({ where: status === "ALL" ? {} : { status }, orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" }, take: 200, include: { tenant: { select: { name: true, subdomain: true } } } });
  const senders = [...new Set(rows.map((r) => r.senderNumber))];
  const others = senders.length ? await db.paymentProof.groupBy({ by: ["senderNumber", "tenantId"], where: { senderNumber: { in: senders } } }) : [];
  return rows.map((p) => ({
    id: p.id, tenantId: p.tenantId, storeName: p.tenant.name, subdomain: p.tenant.subdomain, plan: p.planTier, interval: p.billingPeriod, amount: Number(p.amount), provider: p.mfsProvider,
    senderNumber: p.senderNumber, trxId: p.trxId, note: p.note, status: p.status, rejectionReason: p.rejectionReason, createdAt: p.createdAt, approvedAt: p.approvedAt,
    senderSeenOnOtherStores: others.filter((o) => o.senderNumber === p.senderNumber && o.tenantId !== p.tenantId).length,
  }));
}

export interface Approved {
  tenantId: string;
  plan: string;
  interval: string;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * The money is in the platform's bKash or Nagad: switch the plan on. Idempotent against double clicks (the proof row is locked,
 * and only a PENDING one is approved). Paying the same plan again before it runs out adds a period to the end; changing plan
 * starts a fresh period now (there is no proration yet).
 */
export async function approveSubscriptionPayment(actor: PlatformActor, proofId: string, deps?: Deps): Promise<Approved> {
  assertPlatformCan(actor, "payments", "edit");
  const db = dbOf(deps), now = nowOf(deps);
  const out = await db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "PaymentProof" WHERE id = ${proofId} FOR UPDATE`;
    if (locked.length === 0) throw new NotFoundError("Payment");
    const proof = await tx.paymentProof.findUniqueOrThrow({ where: { id: proofId } });
    if (proof.status !== "PENDING") throw new ValidationError(proof.status === "APPROVED" ? "This payment was already approved." : "This payment was already rejected.");
    await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${proof.tenantId} FOR UPDATE`;
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: proof.tenantId }, include: { subscription: true } });
    const sub = tenant.subscription;
    const stillPaid = sub && Number(sub.amount) > 0 && sub.currentPeriodEnd > now && sub.planTier === proof.planTier;
    const periodStart = stillPaid ? sub!.currentPeriodEnd : now;
    const periodEnd = addPeriod(periodStart, proof.billingPeriod);
    const data = { planTier: proof.planTier, interval: proof.billingPeriod, status: "ACTIVE" as const, amount: proof.amount, currentPeriodStart: stillPaid ? sub!.currentPeriodStart : periodStart, currentPeriodEnd: periodEnd, gateway: "MANUAL_MFS", cancelAtPeriodEnd: false, canceledAt: null };
    await tx.subscription.upsert({ where: { tenantId: tenant.id }, create: { tenantId: tenant.id, ...data }, update: data });
    await tx.tenant.update({ where: { id: tenant.id }, data: { planTier: proof.planTier, status: tenant.suspendedReason ? "SUSPENDED" : "ACTIVE" } });
    await tx.paymentProof.update({ where: { id: proof.id }, data: { status: "APPROVED", approvedBy: actor.id, approvedAt: now, appliedFrom: periodStart, appliedTo: periodEnd } });
    await log(tx, actor, "PAYMENT_APPROVED", tenant.id, { proofId, plan: proof.planTier, interval: proof.billingPeriod, amount: Number(proof.amount), trxId: proof.trxId, periodEnd });
    return { tenantId: tenant.id, plan: proof.planTier, interval: proof.billingPeriod, periodStart, periodEnd };
  });
  await resync(out.tenantId);
  await publishEvent("billing/payment-approved", { tenantId: out.tenantId, plan: out.plan, interval: out.interval, periodEnd: out.periodEnd.toISOString() });
  await notifyOwner(out.tenantId, "PAYMENT_APPROVED", { plan: out.plan.charAt(0) + out.plan.slice(1).toLowerCase(), paidUntilDate: out.periodEnd }, { dedupeKey: proofId });
  return out;
}

export async function rejectSubscriptionPayment(actor: PlatformActor, proofId: string, reason: string, deps?: Deps): Promise<void> {
  assertPlatformCan(actor, "payments", "edit");
  const why = reason.trim().slice(0, 200);
  if (why.length < 3) throw new ValidationError("Tell the store why, for example: TrxID not found in our bKash");
  const db = dbOf(deps), now = nowOf(deps);
  let storeId = "";
  await db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "PaymentProof" WHERE id = ${proofId} FOR UPDATE`;
    if (locked.length === 0) throw new NotFoundError("Payment");
    const proof = await tx.paymentProof.findUniqueOrThrow({ where: { id: proofId } });
    if (proof.status !== "PENDING") throw new ValidationError("This payment was already decided.");
    storeId = proof.tenantId;
    // The TrxID stays on file (and unique), so a rejected number cannot simply be submitted again for another store.
    await tx.paymentProof.update({ where: { id: proofId }, data: { status: "REJECTED", rejectionReason: why, approvedBy: actor.id, approvedAt: now } });
    await log(tx, actor, "PAYMENT_REJECTED", proof.tenantId, { proofId, trxId: proof.trxId, reason: why });
  });
  if (storeId) await notifyOwner(storeId, "PAYMENT_REJECTED", { reason: why }, { dedupeKey: proofId });
}

// ---- Store controls ------------------------------------------------------------------------------------------------

async function tenantFor(tx: Tx, id: string) {
  const t = await tx.tenant.findUnique({ where: { id }, include: { subscription: true } });
  if (!t) throw new NotFoundError("Store");
  return t;
}

/** Switches a store off for a reason that is not an unpaid bill. The store and its admin are locked at once. */
export async function suspendTenant(actor: PlatformActor, tenantId: string, reason: string, deps?: Deps): Promise<void> {
  assertPlatformCan(actor, "suspend", "edit");
  const why = reason.trim().slice(0, 300);
  if (why.length < 5) throw new ValidationError("Write the reason. The store owner will see it.");
  const db = dbOf(deps), now = nowOf(deps);
  await db.$transaction(async (tx) => {
    const t = await tenantFor(tx, tenantId);
    await tx.tenant.update({ where: { id: tenantId }, data: { status: "SUSPENDED", suspendedReason: why, suspendedAt: now } });
    await log(tx, actor, "TENANT_SUSPENDED", tenantId, { reason: why, from: t.status });
  });
  await resync(tenantId);
}

/** Lifts a platform suspension. The status is then worked out from the dates again, so an unpaid store does not come back open. */
export async function reactivateTenant(actor: PlatformActor, tenantId: string, deps?: Deps): Promise<void> {
  assertPlatformCan(actor, "suspend", "edit");
  const db = dbOf(deps), now = nowOf(deps);
  await db.$transaction(async (tx) => {
    const t = await tenantFor(tx, tenantId);
    if (!t.suspendedReason) throw new ValidationError("This store was not suspended by the platform.");
    const a = accessOf({ ...t, suspendedReason: null }, t.subscription, now);
    await tx.tenant.update({ where: { id: tenantId }, data: { suspendedReason: null, suspendedAt: null, status: statusFor(a.state, t.status) } });
    await log(tx, actor, "TENANT_REACTIVATED", tenantId, { now: a.state });
  });
  await resync(tenantId);
}

export async function extendTrial(actor: PlatformActor, tenantId: string, days: number, deps?: Deps): Promise<Date> {
  assertPlatformCan(actor, "adjust", "edit");
  if (!Number.isInteger(days) || days < 1 || days > 60) throw new ValidationError("Extend by 1 to 60 days");
  const db = dbOf(deps), now = nowOf(deps);
  const end = await db.$transaction(async (tx) => {
    const t = await tenantFor(tx, tenantId);
    if (t.subscription && Number(t.subscription.amount) > 0) throw new ValidationError("This store is paying. Extend its plan by approving a payment instead.");
    // Count from the later of now and the old end, so extending a lapsed trial gives the full days from today.
    const from = t.trialEndsAt > now ? t.trialEndsAt : now;
    const trialEndsAt = new Date(from.getTime() + days * 86_400_000);
    await tx.tenant.update({ where: { id: tenantId }, data: { trialEndsAt } });
    if (t.subscription) await tx.subscription.update({ where: { tenantId }, data: { currentPeriodEnd: trialEndsAt, status: "TRIALING" } });
    const a = accessOf({ ...t, trialEndsAt }, t.subscription ? { amount: t.subscription.amount, currentPeriodEnd: trialEndsAt } : null, now);
    if (!t.suspendedReason) await tx.tenant.update({ where: { id: tenantId }, data: { status: statusFor(a.state, t.status) } });
    await log(tx, actor, "TRIAL_EXTENDED", tenantId, { days, trialEndsAt });
    return trialEndsAt;
  });
  await resync(tenantId);
  return end;
}

export async function changePlan(actor: PlatformActor, tenantId: string, tier: "STARTER" | "PRO" | "BUSINESS", deps?: Deps): Promise<void> {
  assertPlatformCan(actor, "adjust", "edit");
  if (!["STARTER", "PRO", "BUSINESS"].includes(tier)) throw new ValidationError("Choose a plan");
  const db = dbOf(deps);
  await db.$transaction(async (tx) => {
    const t = await tenantFor(tx, tenantId);
    if (t.planTier === tier) return;
    await tx.tenant.update({ where: { id: tenantId }, data: { planTier: tier } });
    if (t.subscription) await tx.subscription.update({ where: { tenantId }, data: { planTier: tier } });
    await log(tx, actor, "PLAN_CHANGED", tenantId, { from: t.planTier, to: tier });
  });
}

/** A person has looked at a store flagged by the brand scanner. */
export async function reviewQuarantine(actor: PlatformActor, tenantId: string, decision: "APPROVE" | "SUSPEND", note: string, deps?: Deps): Promise<void> {
  assertPlatformCan(actor, "suspend", "edit");
  const why = note.trim().slice(0, 300);
  if (why.length < 3) throw new ValidationError("Write what you checked, for example: has a trade licence in the name");
  const db = dbOf(deps), now = nowOf(deps);
  await db.$transaction(async (tx) => {
    const t = await tenantFor(tx, tenantId);
    if (!t.quarantined) throw new ValidationError("This store is not flagged.");
    if (decision === "APPROVE") await tx.tenant.update({ where: { id: tenantId }, data: { quarantined: false } });
    else await tx.tenant.update({ where: { id: tenantId }, data: { quarantined: false, status: "SUSPENDED", suspendedReason: `Brand review: ${why}`, suspendedAt: now } });
    await log(tx, actor, decision === "APPROVE" ? "QUARANTINE_APPROVED" : "QUARANTINE_SUSPENDED", tenantId, { note: why, matched: t.quarantineReason });
  });
  if (decision === "SUSPEND") await resync(tenantId);
}

// ---- Plans ---------------------------------------------------------------------------------------------------------

export async function listPlans(actor: PlatformActor, deps?: Deps): Promise<(PlanView & { isPublic: boolean; stores: number })[]> {
  assertPlatformCan(actor, "plans", "view");
  const db = dbOf(deps);
  const [plans, counts] = await Promise.all([db.plan.findMany({ orderBy: { sortOrder: "asc" } }), db.tenant.groupBy({ by: ["planTier"], _count: { _all: true } })]);
  return plans.map((p) => ({ ...toPlanView(p), isPublic: p.isPublic, stores: counts.find((c) => c.planTier === p.tier)?._count._all ?? 0 }));
}

export interface PlanPatch {
  priceMonthlyBdt?: number;
  priceYearlyBdt?: number;
  trialDays?: number;
  isPublic?: boolean;
  /** null means unlimited. */
  limits?: Partial<Record<"products" | "ordersPerMonth" | "staff" | "storageGb" | "smsCredits" | "landingPages", number | null>>;
}

/** Prices and limits live in the Plan table (docs/05). A change applies at once to everyone on the plan, because limits are read live. */
export async function updatePlan(actor: PlatformActor, tier: string, patch: PlanPatch, deps?: Deps): Promise<void> {
  assertPlatformCan(actor, "plans", "edit");
  if (!["STARTER", "PRO", "BUSINESS", "ENTERPRISE"].includes(tier)) throw new NotFoundError("Plan");
  const db = dbOf(deps);
  const bad = (n: unknown, max: number) => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > max;
  if (patch.priceMonthlyBdt !== undefined && bad(patch.priceMonthlyBdt, 1_000_000)) throw new ValidationError("Enter the monthly price in taka");
  if (patch.priceYearlyBdt !== undefined && bad(patch.priceYearlyBdt, 10_000_000)) throw new ValidationError("Enter the yearly price in taka");
  if (patch.trialDays !== undefined && (!Number.isInteger(patch.trialDays) || patch.trialDays < 0 || patch.trialDays > 60)) throw new ValidationError("Trial days are 0 to 60");
  for (const [k, v] of Object.entries(patch.limits ?? {})) if (v !== null && (v === undefined || bad(v, 1_000_000_000))) throw new ValidationError(`Enter a number for ${k}, or leave it unlimited`);
  await db.$transaction(async (tx) => {
    const p = await tx.plan.findUnique({ where: { tier: tier as never } });
    if (!p) throw new NotFoundError("Plan");
    const limits = { ...((p.limits ?? {}) as Record<string, unknown>), ...(patch.limits ?? {}) };
    await tx.plan.update({
      where: { tier: tier as never },
      data: {
        ...(patch.priceMonthlyBdt !== undefined ? { priceMonthlyBdt: patch.priceMonthlyBdt } : {}), ...(patch.priceYearlyBdt !== undefined ? { priceYearlyBdt: patch.priceYearlyBdt } : {}),
        ...(patch.trialDays !== undefined ? { trialDays: patch.trialDays } : {}), ...(patch.isPublic !== undefined ? { isPublic: patch.isPublic } : {}), limits: limits as Prisma.InputJsonValue,
      },
    });
    await log(tx, actor, "PLAN_EDITED", null, { tier, patch, before: { priceMonthlyBdt: Number(p.priceMonthlyBdt), priceYearlyBdt: Number(p.priceYearlyBdt), trialDays: p.trialDays, limits: p.limits } });
  });
}

// ---- Audit ---------------------------------------------------------------------------------------------------------

export async function listPlatformAudit(actor: PlatformActor, opts: { tenantId?: string; action?: string; limit?: number } = {}, deps?: Deps) {
  assertPlatformCan(actor, "audit", "view");
  const rows = await dbOf(deps).platformAuditLog.findMany({
    where: { ...(opts.tenantId ? { tenantId: opts.tenantId } : {}), ...(opts.action ? { action: opts.action } : {}) }, orderBy: { createdAt: "desc" }, take: Math.min(opts.limit ?? 100, 500),
  });
  return rows.map((r) => ({ id: r.id, action: r.action, actorId: r.actorId, tenantId: r.tenantId, details: r.details, createdAt: r.createdAt }));
}

// ---- The sweep -----------------------------------------------------------------------------------------------------

export interface LifecycleResult {
  checked: number;
  changed: number;
  toGrace: number;
  toReadOnly: number;
  toLocked: number;
  reminders: number;
}

/**
 * Run daily (or more often). Makes each store's stored status match its dates, so the storefront router shows the offline page
 * from day 4 and the subscription says what it is. Safe to run twice. A store switched off by the platform, or cancelled, is left alone.
 * Reminders are published once, on the day a milestone is reached (3 and 1 days before, then days 1, 4 and 15 overdue), so the
 * sweep must run at least daily; messaging subscribes to `billing/reminder`.
 */
export async function runBillingLifecycle(deps?: Deps): Promise<LifecycleResult> {
  const db = dbOf(deps), now = nowOf(deps);
  // Demo stores (docs/38) are never billed, reminded, put in grace or locked.
  const tenants = await db.tenant.findMany({ where: { status: { not: "CANCELLED" }, suspendedReason: null, isDemo: false }, include: { subscription: true } });
  const res: LifecycleResult = { checked: tenants.length, changed: 0, toGrace: 0, toReadOnly: 0, toLocked: 0, reminders: 0 };
  const changedIds: string[] = [];
  for (const t of tenants) {
    const a = accessOf(t, t.subscription, now);
    const status = statusFor(a.state, t.status);
    const subStatus = a.state === "TRIAL" ? "TRIALING" : a.state === "ACTIVE" ? "ACTIVE" : a.state === "GRACE" ? "PAST_DUE" : "UNPAID";
    if (status !== t.status || (t.subscription && t.subscription.status !== subStatus)) {
      await db.$transaction(async (tx) => {
        await tx.tenant.update({ where: { id: t.id }, data: { status } });
        if (t.subscription) await tx.subscription.update({ where: { tenantId: t.id }, data: { status: subStatus } });
        await log(tx, "SYSTEM", "STATUS_CHANGED", t.id, { from: t.status, to: status, state: a.state });
      });
      res.changed++;
      if (status !== t.status) changedIds.push(t.id);
      if (a.state === "GRACE") res.toGrace++;
      if (a.state === "READ_ONLY") res.toReadOnly++;
      if (a.state === "LOCKED") res.toLocked++;
    }
    const kind = a.overdueDays === 1 ? "PAYMENT_OVERDUE" : a.overdueDays === 4 ? "READ_ONLY_STARTED" : a.overdueDays === 15 ? "LOCKED"
      : a.daysLeft !== null && (a.daysLeft === 3 || a.daysLeft === 1) ? (a.state === "TRIAL" ? "TRIAL_ENDING" : "RENEWAL_DUE") : null;
    if (kind) {
      await publishEvent("billing/reminder", { tenantId: t.id, kind, daysLeft: a.daysLeft });
      // The owner is told by email, and by text message when missing it could take the store offline. The key is the milestone in this
      // billing period, so running the sweep twice a day, or again after a failure, never tells them twice.
      await notifyOwner(t.id, kind, { daysLeft: a.daysLeft }, { dedupeKey: `${kind}:${(a.paidThrough ? new Date(a.paidThrough) : now).toISOString().slice(0, 10)}:${a.daysLeft ?? a.overdueDays ?? 0}` });
      res.reminders++;
    }
  }
  for (const id of changedIds) await resync(id);
  return res;
}
