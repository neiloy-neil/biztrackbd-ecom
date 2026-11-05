import { z } from "zod";
import { getPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { NotFoundError, ValidationError } from "../errors";
import { dhakaDate } from "../admin/dashboard";
import { assertPlatformCan, type PlatformActor } from "./admin";
import { byWorstFirst, computeStoreHealth, type StoreHealthRow } from "./store-health";

/**
 * The merchant CRM, phase 3: who owns a store, what we owe it and when, saved groups of stores, and one timeline of everything that has
 * happened with it. Platform team only; a store never sees any of this.
 */

const DAY = 24 * 60 * 60 * 1000;
const STAGES = ["NEW", "CONTACTED", "DEMO_IN_PROGRESS", "HOT_LEAD", "CONVERTED", "LOST"] as const;

/** The start of today in Dhaka, as a moment in time. */
const startOfToday = (now: Date) => new Date(`${dhakaDate(now)}T00:00:00+06:00`);

async function userName(db: PrismaClient, id: string | null): Promise<string | null> {
  if (!id) return null;
  const u = await db.platformUser.findUnique({ where: { id }, select: { name: true, email: true, isActive: true } });
  return u ? u.name || u.email : null;
}

async function activeUserOrThrow(db: PrismaClient, id: string) {
  const u = await db.platformUser.findUnique({ where: { id }, select: { id: true, name: true, email: true, isActive: true } });
  if (!u || !u.isActive) throw new ValidationError("Pick a team member who is active.");
  return u;
}

/** Keeps the date the store list shows in step with the earliest open follow-up. */
async function syncNextFollowUp(db: PrismaClient, tenantId: string): Promise<void> {
  const next = await db.tenantFollowUp.findFirst({ where: { tenantId, status: "OPEN" }, orderBy: { dueAt: "asc" }, select: { dueAt: true } });
  await db.tenant.update({ where: { id: tenantId }, data: { leadNextFollowUpAt: next?.dueAt ?? null } });
}

// ---- Assignment ----------------------------------------------------------------------------------------------------------

/** Puts a store in one team member's hands (or takes it back with null). The change is written to the store's timeline. */
export async function assignTenant(actor: PlatformActor, tenantId: string, assigneeId: string | null, db: PrismaClient = getPlatformPrisma(), now: Date = new Date()): Promise<void> {
  assertPlatformCan(actor, "tenants", "edit");
  const t = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, leadAssignedToId: true } });
  if (!t) throw new NotFoundError("Store");
  const who = assigneeId ? await activeUserOrThrow(db, assigneeId) : null;
  if (t.leadAssignedToId === (who?.id ?? null)) return;
  await db.$transaction([
    db.tenant.update({ where: { id: tenantId }, data: { leadAssignedToId: who?.id ?? null } }),
    db.tenantCrmActivity.create({ data: { tenantId, actorId: actor.id, actorName: actor.email, type: "NOTE", outcome: "ASSIGNED", notes: who ? `Assigned to ${who.name || who.email}` : "Taken off the owner", createdAt: now } }),
  ]);
}

// ---- Follow-up tasks -----------------------------------------------------------------------------------------------------

export const FollowUpInput = z.object({
  dueAt: z.coerce.date(),
  note: z.string().trim().min(2, "Say what the follow-up is for").max(300, "Keep it under 300 characters"),
  assigneeId: z.string().trim().min(1).max(60).optional().nullable(),
});

export interface FollowUpView {
  id: string;
  tenantId: string;
  storeName: string;
  subdomain: string;
  dueAt: Date;
  note: string;
  status: "OPEN" | "DONE";
  assigneeId: string | null;
  assigneeName: string | null;
  createdByName: string | null;
  doneAt: Date | null;
  /** Days past due; 0 or less when it is not late yet. */
  daysLate: number;
}

/** Sets a follow-up for a store. It goes to the person named, or to whoever is adding it. */
export async function addFollowUp(actor: PlatformActor, tenantId: string, raw: unknown, db: PrismaClient = getPlatformPrisma(), now: Date = new Date()): Promise<{ id: string }> {
  assertPlatformCan(actor, "tenants", "view");
  const parsed = FollowUpInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the follow-up");
  const { dueAt, note } = parsed.data;
  if (Number.isNaN(dueAt.getTime())) throw new ValidationError("Pick a date for the follow-up.");
  if (dueAt.getTime() > now.getTime() + 366 * DAY) throw new ValidationError("That date is more than a year away.");
  const t = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!t) throw new NotFoundError("Store");
  const assignee = await activeUserOrThrow(db, parsed.data.assigneeId || actor.id).catch((e) => { if (!parsed.data.assigneeId) return null; throw e; });
  const row = await db.tenantFollowUp.create({ data: { tenantId, assigneeId: assignee?.id ?? null, dueAt, note, createdById: actor.id, createdByName: actor.email } });
  await db.tenantCrmActivity.create({ data: { tenantId, actorId: actor.id, actorName: actor.email, type: "FOLLOW_UP_SCHEDULED", outcome: dueAt.toISOString(), notes: note, createdAt: now } });
  await syncNextFollowUp(db, tenantId);
  return { id: row.id };
}

/** Marks a follow-up done, with what came of it. Counts as contact with the store. */
export async function completeFollowUp(actor: PlatformActor, id: string, outcome: string | undefined, db: PrismaClient = getPlatformPrisma(), now: Date = new Date()): Promise<void> {
  assertPlatformCan(actor, "tenants", "view");
  const row = await db.tenantFollowUp.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Follow-up");
  if (row.status === "DONE") return;
  const said = (outcome ?? "").trim().slice(0, 300);
  const claimed = await db.tenantFollowUp.updateMany({ where: { id, status: "OPEN" }, data: { status: "DONE", doneAt: now, doneById: actor.id } });
  if (claimed.count === 0) return; // someone else just closed it
  await db.tenantCrmActivity.create({ data: { tenantId: row.tenantId, actorId: actor.id, actorName: actor.email, type: "NOTE", outcome: "FOLLOW_UP_DONE", notes: said ? `${row.note} — ${said}` : row.note, createdAt: now } });
  await db.tenant.update({ where: { id: row.tenantId }, data: { leadLastContactedAt: now } });
  await syncNextFollowUp(db, row.tenantId);
}

/** Removes a follow-up that was added by mistake or is no longer needed. */
export async function cancelFollowUp(actor: PlatformActor, id: string, db: PrismaClient = getPlatformPrisma()): Promise<void> {
  assertPlatformCan(actor, "tenants", "view");
  const row = await db.tenantFollowUp.findUnique({ where: { id } });
  if (!row) return;
  await db.tenantFollowUp.delete({ where: { id } });
  await syncNextFollowUp(db, row.tenantId);
}

export type FollowUpBucket = "overdue" | "today" | "upcoming" | "done";

export interface FollowUpQueue {
  items: FollowUpView[];
  counts: { overdue: number; today: number; upcoming: number; done: number };
  bucket: FollowUpBucket;
}

/** The team's list of what is owed, for one person or everyone. Overdue first, soonest due first. */
export async function listFollowUps(actor: PlatformActor, opts: { assignee?: string; bucket?: FollowUpBucket } = {}, db: PrismaClient = getPlatformPrisma(), now: Date = new Date()): Promise<FollowUpQueue> {
  assertPlatformCan(actor, "tenants", "view");
  const today = startOfToday(now);
  const tomorrow = new Date(today.getTime() + DAY);
  const assignee = opts.assignee === "all" || !opts.assignee ? undefined : opts.assignee === "me" ? actor.id : opts.assignee === "none" ? null : opts.assignee;
  const mine = assignee === undefined ? {} : { assigneeId: assignee };
  const recent = new Date(now.getTime() - 30 * DAY);
  const [overdue, dueToday, upcoming, done] = await Promise.all([
    db.tenantFollowUp.count({ where: { ...mine, status: "OPEN", dueAt: { lt: today } } }),
    db.tenantFollowUp.count({ where: { ...mine, status: "OPEN", dueAt: { gte: today, lt: tomorrow } } }),
    db.tenantFollowUp.count({ where: { ...mine, status: "OPEN", dueAt: { gte: tomorrow } } }),
    db.tenantFollowUp.count({ where: { ...mine, status: "DONE", doneAt: { gte: recent } } }),
  ]);
  const bucket: FollowUpBucket = opts.bucket ?? (overdue > 0 ? "overdue" : dueToday > 0 ? "today" : "upcoming");
  const where =
    bucket === "overdue" ? { ...mine, status: "OPEN", dueAt: { lt: today } }
    : bucket === "today" ? { ...mine, status: "OPEN", dueAt: { gte: today, lt: tomorrow } }
    : bucket === "upcoming" ? { ...mine, status: "OPEN", dueAt: { gte: tomorrow } }
    : { ...mine, status: "DONE", doneAt: { gte: recent } };
  const rows = await db.tenantFollowUp.findMany({ where, orderBy: bucket === "done" ? { doneAt: "desc" } : { dueAt: "asc" }, take: 200, include: { tenant: { select: { name: true, subdomain: true } } } });
  const names = new Map<string, string>();
  for (const id of new Set(rows.map((r) => r.assigneeId).filter((x): x is string => Boolean(x)))) names.set(id, (await userName(db, id)) ?? "Former team member");
  const items = rows.map<FollowUpView>((r) => ({
    id: r.id, tenantId: r.tenantId, storeName: r.tenant.name, subdomain: r.tenant.subdomain, dueAt: r.dueAt, note: r.note, status: r.status === "DONE" ? "DONE" : "OPEN",
    assigneeId: r.assigneeId, assigneeName: r.assigneeId ? names.get(r.assigneeId) ?? null : null, createdByName: r.createdByName, doneAt: r.doneAt,
    daysLate: Math.max(0, Math.floor((today.getTime() - r.dueAt.getTime()) / DAY) + (r.dueAt < today ? 1 : 0)),
  }));
  return { items, counts: { overdue, today: dueToday, upcoming, done }, bucket };
}

/** Open follow-ups for one store, for its page. */
export async function listStoreFollowUps(actor: PlatformActor, tenantId: string, db: PrismaClient = getPlatformPrisma(), now: Date = new Date()): Promise<FollowUpView[]> {
  assertPlatformCan(actor, "tenants", "view");
  const today = startOfToday(now);
  const rows = await db.tenantFollowUp.findMany({ where: { tenantId, status: "OPEN" }, orderBy: { dueAt: "asc" }, take: 50, include: { tenant: { select: { name: true, subdomain: true } } } });
  const names = new Map<string, string>();
  for (const id of new Set(rows.map((r) => r.assigneeId).filter((x): x is string => Boolean(x)))) names.set(id, (await userName(db, id)) ?? "Former team member");
  return rows.map((r) => ({
    id: r.id, tenantId: r.tenantId, storeName: r.tenant.name, subdomain: r.tenant.subdomain, dueAt: r.dueAt, note: r.note, status: "OPEN" as const,
    assigneeId: r.assigneeId, assigneeName: r.assigneeId ? names.get(r.assigneeId) ?? null : null, createdByName: r.createdByName, doneAt: null,
    daysLate: r.dueAt < today ? Math.floor((today.getTime() - r.dueAt.getTime()) / DAY) + 1 : 0,
  }));
}

// ---- Saved segments ------------------------------------------------------------------------------------------------------

export const SegmentFilter = z.object({
  health: z.array(z.enum(["NEW", "HEALTHY", "AT_RISK", "CHURNING"])).max(4).optional(),
  plans: z.array(z.enum(["STARTER", "PRO", "BUSINESS"])).max(3).optional(),
  billing: z.enum(["paying", "trial"]).optional(),
  stages: z.array(z.enum(STAGES)).max(6).optional(),
  /** "none" for stores nobody owns, or a team member's id. */
  assignee: z.string().trim().min(1).max(60).optional(),
  /** Trial stores whose trial ends within this many days. */
  trialEndsInDays: z.coerce.number().int().min(0).max(30).optional(),
  noOrders30d: z.boolean().optional(),
  /** Stores that have not logged in for at least this many days, or never. */
  noLoginDays: z.coerce.number().int().min(1).max(365).optional(),
  smsOut: z.boolean().optional(),
  q: z.string().trim().max(60).optional(),
}).strict();
export type SegmentFilterInput = z.infer<typeof SegmentFilter>;

/** Keeps the stores that match every part of the filter. An empty filter matches every store. */
export function applySegmentFilter(rows: StoreHealthRow[], f: SegmentFilterInput): StoreHealthRow[] {
  const q = f.q?.toLowerCase();
  return rows.filter((r) => {
    if (f.health?.length && !f.health.includes(r.health)) return false;
    if (f.plans?.length && !f.plans.includes(r.planTier as "STARTER" | "PRO" | "BUSINESS")) return false;
    if (f.billing === "paying" && !r.paying) return false;
    if (f.billing === "trial" && r.paying) return false;
    if (f.stages?.length && !f.stages.includes(r.leadStage)) return false;
    if (f.assignee === "none" ? r.assigneeId !== null : f.assignee ? r.assigneeId !== f.assignee : false) return false;
    if (f.trialEndsInDays !== undefined && !(!r.paying && r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= f.trialEndsInDays)) return false;
    if (f.noOrders30d && r.orders30d !== 0) return false;
    if (f.noLoginDays !== undefined && !(r.daysSinceLogin === null || r.daysSinceLogin >= f.noLoginDays)) return false;
    if (f.smsOut && !(r.smsLimit !== null && r.smsLimit > 0 && r.smsUsed >= r.smsLimit)) return false;
    if (q && !r.name.toLowerCase().includes(q) && !r.subdomain.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function parseSegmentFilter(raw: unknown): SegmentFilterInput {
  const parsed = SegmentFilter.safeParse(raw ?? {});
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the filter");
  return parsed.data;
}

export interface SegmentView { id: string; name: string; filter: SegmentFilterInput; createdByName: string | null; createdAt: Date; count: number }

/** Saved segments, each with how many stores match right now. */
export async function listSegments(actor: PlatformActor, db: PrismaClient = getPlatformPrisma(), now: Date = new Date()): Promise<SegmentView[]> {
  assertPlatformCan(actor, "tenants", "view");
  const [rows, stores] = await Promise.all([db.crmSegment.findMany({ orderBy: { createdAt: "asc" }, take: 100 }), computeStoreHealth(db, now)]);
  return rows.map((r) => {
    const parsed = SegmentFilter.safeParse(r.filter);
    const filter = parsed.success ? parsed.data : {};
    return { id: r.id, name: r.name, filter, createdByName: r.createdByName, createdAt: r.createdAt, count: parsed.success ? applySegmentFilter(stores, filter).length : 0 };
  });
}

/** The stores in a filter (or a saved segment), worst health first. */
export async function runSegment(actor: PlatformActor, source: { filter: unknown } | { id: string }, db: PrismaClient = getPlatformPrisma(), now: Date = new Date()): Promise<{ name: string | null; filter: SegmentFilterInput; rows: StoreHealthRow[]; total: number }> {
  assertPlatformCan(actor, "tenants", "view");
  let filter: SegmentFilterInput;
  let name: string | null = null;
  if ("id" in source) {
    const seg = await db.crmSegment.findUnique({ where: { id: source.id } });
    if (!seg) throw new NotFoundError("Segment");
    filter = parseSegmentFilter(seg.filter);
    name = seg.name;
  } else filter = parseSegmentFilter(source.filter);
  const rows = applySegmentFilter(await computeStoreHealth(db, now), filter).sort(byWorstFirst);
  return { name, filter, rows: rows.slice(0, 500), total: rows.length };
}

export async function saveSegment(actor: PlatformActor, name: string, rawFilter: unknown, db: PrismaClient = getPlatformPrisma()): Promise<{ id: string }> {
  assertPlatformCan(actor, "tenants", "edit");
  const clean = name.trim();
  if (clean.length < 2 || clean.length > 60) throw new ValidationError("Give the segment a name of 2 to 60 characters.");
  const filter = parseSegmentFilter(rawFilter);
  if (Object.keys(filter).length === 0) throw new ValidationError("Pick at least one filter, or the segment would be every store.");
  if ((await db.crmSegment.count()) >= 100) throw new ValidationError("There are 100 segments already. Delete one first.");
  if (await db.crmSegment.findFirst({ where: { name: { equals: clean, mode: "insensitive" } } })) throw new ValidationError("A segment with that name already exists.");
  const row = await db.crmSegment.create({ data: { name: clean, filter, createdById: actor.id, createdByName: actor.email } });
  await db.platformAuditLog.create({ data: { actorId: actor.id, action: "CRM_SEGMENT_SAVED", details: { id: row.id, name: clean, filter }, ipAddress: actor.ip ?? null } });
  return { id: row.id };
}

export async function deleteSegment(actor: PlatformActor, id: string, db: PrismaClient = getPlatformPrisma()): Promise<void> {
  assertPlatformCan(actor, "tenants", "edit");
  const row = await db.crmSegment.findUnique({ where: { id } });
  if (!row) return;
  await db.crmSegment.delete({ where: { id } });
  await db.platformAuditLog.create({ data: { actorId: actor.id, action: "CRM_SEGMENT_DELETED", details: { id, name: row.name }, ipAddress: actor.ip ?? null } });
}

// ---- One timeline ---------------------------------------------------------------------------------------------------------

export type TimelineKind = "crm" | "note" | "followup" | "payment" | "purchase" | "account" | "ticket" | "message";

export interface TimelineEvent { id: string; at: Date; kind: TimelineKind; title: string; detail: string | null; by: string | null }

const ACCOUNT_ACTIONS: Record<string, string> = {
  PLAN_CHANGED: "Plan changed", TRIAL_EXTENDED: "Trial extended", TENANT_SUSPENDED: "Store suspended", TENANT_REACTIVATED: "Store reactivated",
  STATUS_CHANGED: "Status changed", QUARANTINE_APPROVED: "Review passed", QUARANTINE_SUSPENDED: "Suspended after review",
};
const CRM_TITLE: Record<string, string> = { WHATSAPP: "WhatsApp message sent", PHONE_CALL: "Phone call", STAGE_CHANGE: "Stage changed", NOTE: "Note", FOLLOW_UP_SCHEDULED: "Follow-up set" };
const STATUS_WORD: Record<string, string> = { PENDING: "waiting", APPROVED: "approved", REJECTED: "rejected" };
const taka = (n: unknown) => `৳ ${Number(String(n)).toLocaleString("en-IN")}`;

/** Everything that has happened with one store, newest first: the team's notes and calls, follow-ups, payments, purchases, plan changes, support tickets and our emails and texts. */
export async function getStoreTimeline(actor: PlatformActor, tenantId: string, limit = 150, db: PrismaClient = getPlatformPrisma()): Promise<TimelineEvent[]> {
  assertPlatformCan(actor, "tenants", "view");
  const take = Math.min(Math.max(limit, 1), 300);
  const [crm, notes, followUps, proofs, themes, modules, sms, audit, tickets, messages] = await Promise.all([
    db.tenantCrmActivity.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take }),
    db.tenantNote.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take }),
    db.tenantFollowUp.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take }),
    db.paymentProof.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take }),
    db.themePurchase.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take }),
    db.modulePurchase.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take }),
    db.smsPurchase.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take }),
    db.platformAuditLog.findMany({ where: { tenantId, action: { in: Object.keys(ACCOUNT_ACTIONS) } }, orderBy: { createdAt: "desc" }, take }),
    db.supportTicket.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take }),
    db.platformMessage.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take }),
  ]);
  const ev: TimelineEvent[] = [];
  for (const a of crm) ev.push({ id: `crm-${a.id}`, at: a.createdAt, kind: "crm", title: a.outcome === "ASSIGNED" ? "Owner changed" : a.outcome === "FOLLOW_UP_DONE" ? "Follow-up done" : CRM_TITLE[a.type] ?? a.type, detail: [a.type === "STAGE_CHANGE" ? a.outcome : a.type === "PHONE_CALL" ? a.outcome : null, a.notes].filter(Boolean).join(": ") || null, by: a.actorName });
  for (const n of notes) ev.push({ id: `note-${n.id}`, at: n.createdAt, kind: "note", title: "Note", detail: n.body, by: n.authorName });
  for (const f of followUps) {
    ev.push({ id: `fu-${f.id}`, at: f.createdAt, kind: "followup", title: `Follow-up set for ${f.dueAt.toISOString().slice(0, 10)}`, detail: f.note, by: f.createdByName });
  }
  for (const p of proofs) ev.push({ id: `pay-${p.id}`, at: p.createdAt, kind: "payment", title: `Plan payment ${taka(p.amount)} ${STATUS_WORD[p.status] ?? p.status}`, detail: `${p.planTier} plan via ${p.mfsProvider}`, by: null });
  for (const p of themes) ev.push({ id: `theme-${p.id}`, at: p.createdAt, kind: "purchase", title: `Theme ${p.themeId} ${taka(p.amount)} ${STATUS_WORD[p.status] ?? p.status}`, detail: null, by: null });
  for (const p of modules) ev.push({ id: `mod-${p.id}`, at: p.createdAt, kind: "purchase", title: `Module ${p.moduleKey} ${taka(p.amount)} ${STATUS_WORD[p.status] ?? p.status}`, detail: null, by: null });
  for (const p of sms) ev.push({ id: `sms-${p.id}`, at: p.createdAt, kind: "purchase", title: `${p.quantity.toLocaleString("en-IN")} SMS ${taka(p.amount)} ${STATUS_WORD[p.status] ?? p.status}`, detail: null, by: null });
  for (const a of audit) ev.push({ id: `audit-${a.id}`, at: a.createdAt, kind: "account", title: ACCOUNT_ACTIONS[a.action] ?? a.action, detail: null, by: a.actorId === "SYSTEM" ? "System" : null });
  for (const t of tickets) ev.push({ id: `ticket-${t.id}`, at: t.createdAt, kind: "ticket", title: `Support ticket ${t.code}`, detail: `${t.subject} (${t.status.toLowerCase().replace(/_/g, " ")})`, by: null });
  for (const m of messages) ev.push({ id: `msg-${m.id}`, at: m.createdAt, kind: "message", title: `${m.channel === "SMS" ? "Text" : "Email"} sent: ${m.kind.toLowerCase().replace(/_/g, " ")}`, detail: m.status === "SENT" ? null : m.status.toLowerCase(), by: "System" });
  return ev.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, take);
}

/** The platform team, for the owner picker. */
export async function listCrmTeam(actor: PlatformActor, db: PrismaClient = getPlatformPrisma()): Promise<{ id: string; name: string }[]> {
  assertPlatformCan(actor, "tenants", "view");
  const users = await db.platformUser.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } });
  return users.map((u) => ({ id: u.id, name: u.name || u.email }));
}

