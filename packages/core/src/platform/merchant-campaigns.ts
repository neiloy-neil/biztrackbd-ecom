import { z } from "zod";
import { Prisma, getBasePrisma, getPlatformPrisma, withTenant, type PrismaClient } from "@biztrackbd/db";
import { currentSmsSender } from "../customers/auth";
import { NotFoundError, ValidationError } from "../errors";
import { sendPlatformEmail } from "../mail/send";
import { assertCan, type StaffActor } from "../permissions";
import { normalizeBdPhone } from "../phone";
import { assertPlatformCan, type PlatformActor } from "./admin";
import { applySegmentFilter, parseSegmentFilter, type SegmentFilterInput } from "./crm";
import {
  NUDGES, NUDGE_KEYS, campaignHash, nudgeEmail, renderCampaignEmail, renderCampaignSms, unsubscribeReady, unsubscribeUrl, verifyUnsubscribe, type MessageVars, type NudgeKey,
} from "./merchant-messages";
import { computeStoreHealth, type StoreHealthRow } from "./store-health";

/**
 * Messages from the platform team to store owners, outside billing. A one-off campaign goes to a saved group of stores: written as a draft,
 * tested to the sender, then confirmed by typing how many stores it will reach, and sent once. Automatic nudges go out on their own to
 * stores in a situation (no products yet, no orders, gone quiet, near a limit). Every one of them respects the owner's opt-out;
 * billing and account messages are separate and never opted out of.
 */

const DAY = 24 * 60 * 60 * 1000;
/** Text messages campaigns may send in a day, across all campaigns. Each one costs us money. */
export const SMS_CAMPAIGN_DAILY_CAP = 500;
const SAMPLE_PRODUCTS = 3; // a new store starts with three sample products; none of its own means no more than this

export interface MerchantCampaignDeps {
  db?: PrismaClient;
  now?: Date;
  sendEmail?: (to: string, subject: string, html: string, text: string) => Promise<"sent" | "skipped" | "failed">;
  sendSms?: (to: string, text: string) => Promise<void>;
}
const dbOf = (d?: MerchantCampaignDeps) => d?.db ?? getPlatformPrisma();
const nowOf = (d?: MerchantCampaignDeps) => d?.now ?? new Date();
const emailOf = (d?: MerchantCampaignDeps) => d?.sendEmail ?? sendPlatformEmail;
const smsOf = (d?: MerchantCampaignDeps) => d?.sendSms ?? ((to: string, text: string) => currentSmsSender().send("platform", to, text));

const adminOrigin = () => {
  if (process.env.ADMIN_ORIGIN) return process.env.ADMIN_ORIGIN.replace(/\/$/, "");
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (root && !root.startsWith("localhost")) return `https://admin.${root}`;
  return process.env.NODE_ENV === "production" ? "https://admin.biztrack.bd" : "http://localhost:3001";
};
const storeOrigin = (sub: string) => {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (root && !root.startsWith("localhost")) return `https://${sub}.${root}`;
  return process.env.NODE_ENV === "production" ? `https://${sub}.biztrack.bd` : `http://${sub}.${root || "localhost:3000"}`;
};
const langOf = (locale: string) => (locale.startsWith("bn") ? "bn" : "en") as "bn" | "en";

// ---- Who a message reaches -----------------------------------------------------------------------------------------------

interface Owner { tenantId: string; storeName: string; ownerName: string; email: string | null; phone: string | null; lang: "bn" | "en"; subdomain: string; optedOut: boolean }

async function loadOwners(db: PrismaClient, ids: string[]): Promise<Map<string, Owner>> {
  const out = new Map<string, Owner>();
  for (let i = 0; i < ids.length; i += 500) {
    const rows = await db.tenant.findMany({
      where: { id: { in: ids.slice(i, i + 500) }, isDemo: false },
      select: { id: true, name: true, ownerName: true, ownerEmail: true, ownerPhone: true, locale: true, subdomain: true, storeSettings: { select: { storeName: true, marketingOptOut: true } } },
    });
    for (const t of rows) out.set(t.id, { tenantId: t.id, storeName: t.storeSettings?.storeName ?? t.name, ownerName: t.ownerName ?? "", email: t.ownerEmail, phone: t.ownerPhone, lang: langOf(t.locale), subdomain: t.subdomain, optedOut: t.storeSettings?.marketingOptOut ?? false });
  }
  return out;
}

const varsOf = (o: Owner): MessageVars => ({ ownerName: o.ownerName, storeName: o.storeName, storeUrl: storeOrigin(o.subdomain), adminUrl: adminOrigin() });

function phoneOf(raw: string | null): string | null {
  if (!raw) return null;
  try { return normalizeBdPhone(raw); } catch { return null; }
}

export interface MerchantCampaignPreview {
  /** Stores in the group. */
  total: number;
  /** Owners who will get it. */
  willSend: number;
  optedOut: number;
  noContact: number;
  /** Already handled by an earlier send of this campaign. */
  alreadyDone: number;
}

interface Resolved { preview: MerchantCampaignPreview; send: Owner[]; skippedOptOut: Owner[]; skippedNoContact: Owner[] }

async function resolve(db: PrismaClient, c: { id: string; channel: string; filter: unknown }, now: Date): Promise<Resolved> {
  const rows = applySegmentFilter(await computeStoreHealth(db, now), parseSegmentFilter(c.filter));
  const owners = await loadOwners(db, rows.map((r) => r.tenantId));
  const done = new Set((await db.merchantCampaignSend.findMany({ where: { campaignId: c.id }, select: { tenantId: true } })).map((s) => s.tenantId));
  const send: Owner[] = [], skippedOptOut: Owner[] = [], skippedNoContact: Owner[] = [];
  let alreadyDone = 0;
  for (const r of rows) {
    const o = owners.get(r.tenantId);
    if (!o) continue;
    if (done.has(o.tenantId)) { alreadyDone++; continue; }
    if (o.optedOut) skippedOptOut.push(o);
    else if (c.channel === "EMAIL" ? !o.email : !phoneOf(o.phone)) skippedNoContact.push(o);
    else send.push(o);
  }
  return { preview: { total: rows.length, willSend: send.length, optedOut: skippedOptOut.length, noContact: skippedNoContact.length, alreadyDone }, send, skippedOptOut, skippedNoContact };
}

// ---- Campaigns -----------------------------------------------------------------------------------------------------------

export const MERCHANT_CAMPAIGN_CHANNELS = ["EMAIL", "SMS"] as const;

export const MerchantCampaignInput = z.object({
  name: z.string().trim().min(2, "Name the campaign").max(80, "Keep the name under 80 characters"),
  channel: z.enum(MERCHANT_CAMPAIGN_CHANNELS),
  segmentId: z.string().trim().min(1).max(60).optional().nullable(),
  filter: z.unknown().optional(),
  subject: z.string().trim().max(120, "Keep the subject under 120 characters").optional().nullable(),
  body: z.string().trim().min(5, "Write the message").max(2000, "Keep the message under 2000 characters"),
});

function checkWording(channel: string, subject: string | null | undefined, body: string): void {
  if (channel === "EMAIL" && (!subject || subject.trim().length < 3)) throw new ValidationError("An email needs a subject.", { field: "subject" });
  if (channel === "SMS" && body.length > 320) throw new ValidationError("A text message can be up to 320 characters (two messages).", { field: "body" });
}

const stable = (f: SegmentFilterInput): string => JSON.stringify(Object.keys(f).sort().map((k) => [k, (f as Record<string, unknown>)[k]]));

export interface MerchantCampaignView {
  id: string; name: string; channel: "EMAIL" | "SMS"; segmentName: string | null; filter: SegmentFilterInput; subject: string | null; body: string;
  status: "DRAFT" | "SENDING" | "SENT"; tested: boolean; recipients: number; sentCount: number; failedCount: number; skippedCount: number;
  createdByName: string | null; createdAt: Date; sentAt: Date | null;
}

type CampaignRow = Awaited<ReturnType<PrismaClient["merchantCampaign"]["findUniqueOrThrow"]>>;
const toView = (r: CampaignRow): MerchantCampaignView => ({
  id: r.id, name: r.name, channel: r.channel === "SMS" ? "SMS" : "EMAIL", segmentName: r.segmentName, filter: parseSegmentFilter(r.filter), subject: r.subject, body: r.body,
  status: r.status === "SENT" ? "SENT" : r.status === "SENDING" ? "SENDING" : "DRAFT", tested: Boolean(r.testedAt && r.testHash === campaignHash({ channel: r.channel, subject: r.subject, body: r.body })),
  recipients: r.recipients, sentCount: r.sentCount, failedCount: r.failedCount, skippedCount: r.skippedCount, createdByName: r.createdByName, createdAt: r.createdAt, sentAt: r.sentAt,
});

/** Writes a draft for a saved segment or a filter. Nothing is sent. */
export async function createMerchantCampaign(actor: PlatformActor, raw: unknown, deps?: MerchantCampaignDeps): Promise<{ id: string }> {
  assertPlatformCan(actor, "tenants", "edit");
  const db = dbOf(deps);
  const parsed = MerchantCampaignInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the campaign");
  const input = parsed.data;
  checkWording(input.channel, input.subject, input.body);
  let filter: SegmentFilterInput;
  let segmentName: string | null = null;
  if (input.segmentId) {
    const seg = await db.crmSegment.findUnique({ where: { id: input.segmentId } });
    if (!seg) throw new NotFoundError("Segment");
    filter = parseSegmentFilter(seg.filter);
    segmentName = seg.name;
  } else filter = parseSegmentFilter(input.filter);
  if (Object.keys(filter).length === 0) throw new ValidationError("Pick a saved segment, so the message goes to a chosen group and not every store.", { field: "segmentId" });
  const row = await db.merchantCampaign.create({ data: { name: input.name, channel: input.channel, filter, filterKey: stable(filter), segmentName, subject: input.channel === "EMAIL" ? input.subject!.trim() : null, body: input.body, createdById: actor.id, createdByName: actor.email } });
  return { id: row.id };
}

export async function listMerchantCampaigns(actor: PlatformActor, deps?: MerchantCampaignDeps): Promise<MerchantCampaignView[]> {
  assertPlatformCan(actor, "tenants", "view");
  const rows = await dbOf(deps).merchantCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return rows.map(toView);
}

export async function getMerchantCampaign(actor: PlatformActor, id: string, deps?: MerchantCampaignDeps): Promise<{ campaign: MerchantCampaignView; preview: MerchantCampaignPreview }> {
  assertPlatformCan(actor, "tenants", "view");
  const db = dbOf(deps);
  const row = await db.merchantCampaign.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Campaign");
  const campaign = toView(row);
  if (row.status === "SENT") return { campaign, preview: { total: row.recipients + row.skippedCount, willSend: row.sentCount + row.failedCount, optedOut: 0, noContact: 0, alreadyDone: row.recipients } };
  return { campaign, preview: (await resolve(db, row, nowOf(deps))).preview };
}

/** Changes the wording of a draft. A test send no longer counts, because the words are new. */
export async function editMerchantCampaign(actor: PlatformActor, id: string, raw: { subject?: string | null; body: string }, deps?: MerchantCampaignDeps): Promise<void> {
  assertPlatformCan(actor, "tenants", "edit");
  const db = dbOf(deps);
  const row = await db.merchantCampaign.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Campaign");
  if (row.status !== "DRAFT") throw new ValidationError("A campaign that has started sending cannot be changed.");
  const body = (raw.body ?? "").trim();
  if (body.length < 5 || body.length > 2000) throw new ValidationError("Write a message of 5 to 2000 characters.");
  const subject = row.channel === "EMAIL" ? (raw.subject ?? "").trim() : null;
  checkWording(row.channel, subject, body);
  await db.merchantCampaign.update({ where: { id }, data: { subject, body, testedAt: null, testHash: null } });
}

export async function deleteMerchantCampaign(actor: PlatformActor, id: string, deps?: MerchantCampaignDeps): Promise<void> {
  assertPlatformCan(actor, "tenants", "edit");
  const db = dbOf(deps);
  const row = await db.merchantCampaign.findUnique({ where: { id } });
  if (!row) return;
  if (row.status !== "DRAFT") throw new ValidationError("Only a draft can be deleted. A sent campaign is kept as a record.");
  await db.merchantCampaign.delete({ where: { id } });
}

/** Sends the campaign to one address or number, with sample store details, so the sender can see exactly what owners will get. */
export async function sendMerchantCampaignTest(actor: PlatformActor, id: string, to: string, deps?: MerchantCampaignDeps): Promise<void> {
  assertPlatformCan(actor, "tenants", "edit");
  const db = dbOf(deps);
  const row = await db.merchantCampaign.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Campaign");
  if (row.status !== "DRAFT") throw new ValidationError("This campaign has already started sending.");
  const sample: MessageVars = { ownerName: "Sample Owner", storeName: "Sample Store", storeUrl: storeOrigin("sample"), adminUrl: adminOrigin() };
  if (row.channel === "EMAIL") {
    const addr = z.string().trim().email("Enter a valid email address").safeParse(to);
    if (!addr.success) throw new ValidationError(addr.error.issues[0]!.message, { field: "to" });
    const m = renderCampaignEmail({ subject: `[Test] ${row.subject ?? ""}`, body: row.body }, sample, "en", `${storeOrigin("sample")}/unsubscribe`);
    const res = await emailOf(deps)(addr.data, m.subject, m.html, m.text);
    if (res === "skipped") throw new ValidationError("No email provider is set up, so nothing was sent.");
    if (res === "failed") throw new ValidationError("The email could not be sent. Try again in a moment.");
  } else {
    const phone = phoneOf(to);
    if (!phone) throw new ValidationError("Enter a mobile number like 01712345678", { field: "to" });
    await smsOf(deps)(phone, `[Test] ${renderCampaignSms(row.body, sample)}`).catch(() => { throw new ValidationError("The text could not be sent. Try again in a moment."); });
  }
  await db.merchantCampaign.update({ where: { id }, data: { testedAt: nowOf(deps), testHash: campaignHash({ channel: row.channel, subject: row.subject, body: row.body }) } });
}

export interface MerchantCampaignResult { sent: number; failed: number; skipped: number; recipients: number }

/**
 * Sends a tested draft. The sender types how many stores it will reach, so a changed group is noticed. Each store gets it once: its row is
 * written before the send, so a retry or a second click can never message anyone twice. One campaign per group a day, and texts are capped.
 */
export async function sendMerchantCampaign(actor: PlatformActor, id: string, input: { confirmCount?: number }, deps?: MerchantCampaignDeps): Promise<MerchantCampaignResult> {
  assertPlatformCan(actor, "tenants", "edit");
  const db = dbOf(deps);
  const now = nowOf(deps);
  const row = await db.merchantCampaign.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Campaign");
  if (row.status === "SENT") throw new ValidationError("This campaign has already been sent.");
  const resuming = row.status === "SENDING";
  if (row.channel === "EMAIL" && !unsubscribeReady()) throw new ValidationError("Unsubscribe links are not set up yet (UNSUBSCRIBE_SECRET is missing), so no email can be sent. Ask the platform owner to add it.");
  const hash = campaignHash({ channel: row.channel, subject: row.subject, body: row.body });
  if (!resuming && (!row.testedAt || row.testHash !== hash)) throw new ValidationError("Send a test of this exact message to yourself first.");

  const r = await resolve(db, row, now);
  if (!resuming) {
    if (r.preview.willSend === 0) throw new ValidationError("No owner would receive this: everyone is opted out or has no contact.");
    if (input.confirmCount !== r.preview.willSend) throw new ValidationError(`This will reach ${r.preview.willSend} store${r.preview.willSend === 1 ? "" : "s"}. Type ${r.preview.willSend} to confirm.`, { field: "confirmCount" });
    const sameToday = await db.merchantCampaign.findFirst({ where: { filterKey: row.filterKey, id: { not: id }, status: { in: ["SENDING", "SENT"] }, sentAt: { gte: new Date(now.getTime() - DAY) } } });
    if (sameToday) throw new ValidationError(`"${sameToday.name}" already went to this group in the last day. Wait, or use a different group.`);
    if (row.channel === "SMS") {
      const today = await db.merchantCampaign.aggregate({ where: { channel: "SMS", sentAt: { gte: new Date(now.getTime() - DAY) } }, _sum: { sentCount: true } });
      const used = today._sum.sentCount ?? 0;
      if (used + r.preview.willSend > SMS_CAMPAIGN_DAILY_CAP) throw new ValidationError(`Text campaigns are capped at ${SMS_CAMPAIGN_DAILY_CAP} a day. ${used} have gone out, and this would add ${r.preview.willSend}.`);
    }
  }

  const claimed = await db.merchantCampaign.updateMany({ where: { id, status: { in: ["DRAFT", "SENDING"] } }, data: { status: "SENDING", sentById: actor.id, sentAt: row.sentAt ?? now, recipients: row.recipients || r.preview.willSend } });
  if (claimed.count === 0) throw new ValidationError("This campaign has already been sent.");

  const record = async (o: Owner, status: string) => {
    try { await db.merchantCampaignSend.create({ data: { campaignId: id, tenantId: o.tenantId, status } }); return true; } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
      throw e;
    }
  };
  for (const o of r.skippedOptOut) await record(o, "SKIPPED_OPTOUT");
  for (const o of r.skippedNoContact) await record(o, "SKIPPED_NO_CONTACT");

  const email = emailOf(deps), sms = smsOf(deps);
  const sendOne = async (o: Owner) => {
    // Written as FAILED first: if the process dies mid-send, the store is not messaged again on a retry.
    if (!(await record(o, "FAILED"))) return;
    let ok = false;
    try {
      const v = varsOf(o);
      if (row.channel === "EMAIL") {
        const m = renderCampaignEmail({ subject: row.subject ?? "", body: row.body }, v, o.lang, unsubscribeUrl(o.tenantId));
        ok = (await email(o.email!, m.subject, m.html, m.text)) === "sent";
      } else {
        await sms(phoneOf(o.phone)!, renderCampaignSms(row.body, v));
        ok = true;
      }
    } catch (e) { console.error("[campaign] send failed", e instanceof Error ? e.name : "unknown"); }
    if (ok) await db.merchantCampaignSend.updateMany({ where: { campaignId: id, tenantId: o.tenantId }, data: { status: "SENT" } });
  };
  for (let i = 0; i < r.send.length; i += 5) await Promise.all(r.send.slice(i, i + 5).map(sendOne));

  const totals = await db.merchantCampaignSend.groupBy({ by: ["status"], where: { campaignId: id }, _count: { _all: true } });
  const n = (s: string) => totals.find((t) => t.status === s)?._count._all ?? 0;
  const skipped = n("SKIPPED_OPTOUT") + n("SKIPPED_NO_CONTACT");
  await db.merchantCampaign.update({ where: { id }, data: { status: "SENT", sentCount: n("SENT"), failedCount: n("FAILED"), skippedCount: skipped, recipients: n("SENT") + n("FAILED") } });
  await db.platformAuditLog.create({ data: { actorId: actor.id, action: "CRM_CAMPAIGN_SENT", details: { id, name: row.name, channel: row.channel, sent: n("SENT"), failed: n("FAILED"), skipped }, ipAddress: actor.ip ?? null } });
  return { sent: n("SENT"), failed: n("FAILED"), skipped, recipients: n("SENT") + n("FAILED") };
}

// ---- Opt-out -------------------------------------------------------------------------------------------------------------

/** The owner's own switch for product tips and offers. Billing and account messages are not affected. */
export async function setMarketingOptOut(tenantId: string, actor: StaffActor, optedOut: boolean): Promise<void> {
  assertCan(actor, "billing", "edit");
  await withTenant(tenantId, async (tx) => {
    const s = await tx.storeSettings.findFirst({ select: { id: true } });
    if (!s) throw new NotFoundError("Store settings");
    await tx.storeSettings.update({ where: { id: s.id }, data: { marketingOptOut: optedOut, marketingOptOutAt: optedOut ? new Date() : null } });
  });
}

export async function getMarketingOptOut(tenantId: string, actor: StaffActor): Promise<boolean> {
  assertCan(actor, "billing", "view");
  return withTenant(tenantId, async (tx) => (await tx.storeSettings.findFirst({ select: { marketingOptOut: true } }))?.marketingOptOut ?? false);
}

/**
 * The unsubscribe link in an email. Proves the link is ours, then switches marketing off for that store through a narrow database function,
 * so the public marketing site never needs the all-access login. Returns the store's name, or null for a bad link.
 */
export async function unsubscribeByToken(token: string | null | undefined, db: Pick<PrismaClient, "$queryRaw"> = getBasePrisma()): Promise<{ storeName: string } | null> {
  const tenantId = verifyUnsubscribe(token);
  if (!tenantId) return null;
  const rows = await db.$queryRaw<{ name: string | null }[]>`SELECT marketing_opt_out(${tenantId}) AS name`;
  const name = rows[0]?.name;
  return name === null || name === undefined ? null : { storeName: name };
}

// ---- Automatic nudges ----------------------------------------------------------------------------------------------------

export interface AutomationView { key: NudgeKey; label: string; when: string; enabled: boolean; sentLast30Days: number }

export async function listAutomations(actor: PlatformActor, deps?: MerchantCampaignDeps): Promise<AutomationView[]> {
  assertPlatformCan(actor, "tenants", "view");
  const db = dbOf(deps);
  const since = new Date(nowOf(deps).getTime() - 30 * DAY);
  const [rows, counts] = await Promise.all([
    db.platformAutomation.findMany(),
    db.platformMessage.groupBy({ by: ["kind"], where: { kind: { in: NUDGE_KEYS.map((k) => `NUDGE_${k.toUpperCase()}`) }, status: "SENT", createdAt: { gte: since } }, _count: { _all: true } }),
  ]);
  return NUDGE_KEYS.map((k) => ({ key: k, label: NUDGES[k].label, when: NUDGES[k].when, enabled: rows.find((r) => r.key === k)?.enabled ?? false, sentLast30Days: counts.find((c) => c.kind === `NUDGE_${k.toUpperCase()}`)?._count._all ?? 0 }));
}

export async function setAutomation(actor: PlatformActor, key: string, enabled: boolean, deps?: MerchantCampaignDeps): Promise<void> {
  assertPlatformCan(actor, "tenants", "edit");
  if (!(NUDGE_KEYS as readonly string[]).includes(key)) throw new NotFoundError("Automation");
  const db = dbOf(deps);
  await db.platformAutomation.upsert({ where: { key }, create: { key, enabled, updatedById: actor.id }, update: { enabled, updatedById: actor.id } });
  await db.platformAuditLog.create({ data: { actorId: actor.id, action: "CRM_AUTOMATION_SET", details: { key, enabled }, ipAddress: actor.ip ?? null } });
}

const OPEN = ["TRIAL", "ACTIVE", "PAST_DUE"];

interface Match { row: StoreHealthRow; what?: string; period: string }

/** The stores a nudge applies to right now. Pure, so the rules can be tested without a database. */
export function nudgeMatches(key: NudgeKey, rows: StoreHealthRow[], now: Date): Match[] {
  const month = new Date(now.getTime() + 6 * 3600_000).toISOString().slice(0, 7);
  const out: Match[] = [];
  for (const row of rows) {
    if (!OPEN.includes(row.status)) continue;
    const age = Math.floor((now.getTime() - row.createdAt.getTime()) / DAY);
    if (key === "no_product" && age >= 3 && age < 30 && row.productCount <= SAMPLE_PRODUCTS) out.push({ row, period: "once" });
    else if (key === "no_order" && age >= 14 && age < 60 && row.productCount > SAMPLE_PRODUCTS && row.orders30d === 0) out.push({ row, period: "once" });
    else if (key === "win_back" && row.daysSinceLogin !== null && row.daysSinceLogin >= 21 && row.daysSinceLogin < 90) out.push({ row, period: "once" });
    else if (key === "near_limit") {
      const products = row.productLimit !== null && row.productLimit > 0 && row.productCount >= row.productLimit * 0.8;
      const sms = row.smsLimit !== null && row.smsLimit > 0 && row.smsUsed >= row.smsLimit * 0.8;
      if (products || sms) out.push({ row, what: products ? "product limit" : "free SMS for this month", period: month });
    }
  }
  return out;
}

export interface NudgeRunSummary { key: NudgeKey; eligible: number; sent: number; skipped: number }

/** The daily sweep: sends every switched-on nudge to the stores it applies to. Safe to run again: each store gets each nudge once (or once a month). */
export async function runNudges(deps?: MerchantCampaignDeps & { cap?: number }): Promise<NudgeRunSummary[]> {
  const db = dbOf(deps);
  const now = nowOf(deps);
  const cap = deps?.cap ?? 200;
  const on = (await db.platformAutomation.findMany({ where: { enabled: true } })).map((r) => r.key).filter((k): k is NudgeKey => (NUDGE_KEYS as readonly string[]).includes(k));
  if (on.length === 0) return [];
  if (!unsubscribeReady()) {
    console.error("[nudges] skipped: UNSUBSCRIBE_SECRET is not set, so emails cannot carry an unsubscribe link");
    return on.map((key) => ({ key, eligible: 0, sent: 0, skipped: 0 }));
  }
  const rows = await computeStoreHealth(db, now);
  const out: NudgeRunSummary[] = [];
  const email = emailOf(deps);
  for (const key of on) {
    const summary: NudgeRunSummary = { key, eligible: 0, sent: 0, skipped: 0 };
    try {
      const matches = nudgeMatches(key, rows, now);
      summary.eligible = matches.length;
      const owners = await loadOwners(db, matches.map((m) => m.row.tenantId));
      const kind = `NUDGE_${key.toUpperCase()}`;
      for (const m of matches) {
        if (summary.sent >= cap) break;
        const o = owners.get(m.row.tenantId);
        if (!o || o.optedOut || !o.email) { summary.skipped++; continue; }
        // Built before the store is claimed, so a problem making the email never uses up that store's one nudge.
        const mail = nudgeEmail(key, o.lang, { ...varsOf(o), what: m.what }, unsubscribeUrl(o.tenantId));
        try {
          await db.platformMessage.create({ data: { tenantId: o.tenantId, kind, channel: "EMAIL", dedupeKey: m.period, status: "SENT" } });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") { summary.skipped++; continue; }
          throw e;
        }
        const res = await email(o.email, mail.subject, mail.html, mail.text);
        if (res === "sent") summary.sent++;
        else {
          // Not delivered (no provider, or it failed): forget the claim so a later run tries again.
          await db.platformMessage.deleteMany({ where: { tenantId: o.tenantId, kind, channel: "EMAIL", dedupeKey: m.period } });
          summary.skipped++;
        }
      }
    } catch (e) { console.error("[nudges] failed", key, e instanceof Error ? e.name : "unknown"); }
    out.push(summary);
  }
  return out;
}
