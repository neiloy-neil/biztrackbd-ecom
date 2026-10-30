import { getBasePrisma, getPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { emailSenderFromEnv, type EmailSender } from "../growth/email";
import { NotFoundError, ValidationError } from "../errors";
import { assertPlatformCan, type PlatformActor } from "./admin";

/**
 * Staff notifications (new signup, contact inquiry, payment proof, support ticket). Each event is written to a feed in Platform Admin and
 * emailed to the addresses staff added there for that kind of event. Sending never throws and never waits long: a notification that cannot
 * go out must not stop a signup, a payment proof or a ticket.
 */

export const NOTIFY_KINDS = ["SIGNUP", "INQUIRY", "PAYMENT_PROOF", "TICKET"] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number];

export const NOTIFY_LABELS: Record<NotifyKind, string> = {
  SIGNUP: "New signup",
  INQUIRY: "Contact inquiry",
  PAYMENT_PROOF: "Payment proof submitted",
  TICKET: "New support ticket",
};

export interface NotifyInput {
  kind: NotifyKind;
  /** One line: it becomes the email subject and the feed heading. */
  title: string;
  /** Label and value pairs shown as a table. Empty values are left out. */
  lines: [string, string | null | undefined][];
  link?: { label: string; url: string };
}

interface Deps {
  db?: PrismaClient;
  sender?: EmailSender | null;
}

const SEND_BUDGET_MS = 6000;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function render(input: NotifyInput): { subject: string; text: string; html: string; rows: [string, string][] } {
  const rows = input.lines.filter((l): l is [string, string] => Boolean(l[1] && String(l[1]).trim())).map(([k, v]) => [k, String(v).trim().slice(0, 500)] as [string, string]);
  const text = [input.title, "", ...rows.map(([k, v]) => `${k}: ${v}`), ...(input.link ? ["", `${input.link.label}: ${input.link.url}`] : [])].join("\n");
  const html =
    `<div style="font-family:Arial,sans-serif;color:#0b2a21;max-width:560px">` +
    `<h2 style="margin:0 0 12px;color:#0B4D3B">${esc(input.title)}</h2>` +
    `<table style="border-collapse:collapse;width:100%">` +
    rows.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#3D5A52;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;font-weight:600">${esc(v)}</td></tr>`).join("") +
    `</table>` +
    (input.link ? `<p style="margin-top:16px"><a href="${esc(input.link.url)}" style="color:#0B4D3B">${esc(input.link.label)}</a></p>` : "") +
    `<p style="margin-top:24px;font-size:12px;color:#6b7f78">You get this because your address is on the BizTrackBD staff notification list (Platform Admin, Notifications).</p>` +
    `</div>`;
  return { subject: `[BizTrackBD] ${input.title}`.slice(0, 200), text, html, rows };
}

async function run(input: NotifyInput, deps?: Deps): Promise<void> {
  const db = deps?.db ?? getBasePrisma();
  const { subject, text, html, rows } = render(input);

  await db.$queryRaw`SELECT platform_notify_record(${input.kind}, ${input.title}, ${text}, ${JSON.stringify({ rows, link: input.link ?? null })}::jsonb)`;

  const sender = deps?.sender !== undefined ? deps.sender : emailSenderFromEnv();
  if (!sender) {
    console.log(`[notify] feed entry saved, email not sent (no email provider): ${input.kind}`);
    return;
  }
  const res = await db.$queryRaw<{ r: string[] | null }[]>`SELECT platform_notify_recipients(${input.kind}) AS r`;
  const to = (res[0]?.r ?? []).filter((e) => EMAIL.test(e));
  await Promise.all(
    to.map((addr) =>
      sender.send(addr, subject, html, text).catch((e) => console.error("[notify] send failed", input.kind, e instanceof Error ? e.name : "unknown")),
    ),
  );
}

/** Records the event and emails the staff who want it. Never throws; gives up after a few seconds. */
export async function notifyPlatform(input: NotifyInput, deps?: Deps): Promise<void> {
  try {
    await Promise.race([run(input, deps), new Promise<void>((r) => setTimeout(r, SEND_BUDGET_MS))]);
  } catch (e) {
    console.error("[notify] failed", input.kind, e instanceof Error ? e.message : "unknown");
  }
}

// ---- Admin: recipients and feed ----------------------------------------------------------------------------------------

export interface NotifyRecipientView {
  id: string;
  email: string;
  label: string | null;
  events: NotifyKind[];
  active: boolean;
  createdAt: Date;
}

export interface NotificationView {
  id: string;
  kind: string;
  title: string;
  rows: [string, string][];
  link: { label: string; url: string } | null;
  createdAt: Date;
}

const adminDb = (d?: Deps) => d?.db ?? getPlatformPrisma();
const cleanEvents = (events: string[]): NotifyKind[] => NOTIFY_KINDS.filter((k) => events.includes(k));

export async function listNotifyRecipients(actor: PlatformActor, deps?: Deps): Promise<NotifyRecipientView[]> {
  assertPlatformCan(actor, "tenants", "view");
  const rows = await adminDb(deps).platformNotifyRecipient.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({ id: r.id, email: r.email, label: r.label, events: cleanEvents(r.events), active: r.active, createdAt: r.createdAt }));
}

export async function listNotifications(actor: PlatformActor, limit = 50, deps?: Deps): Promise<NotificationView[]> {
  assertPlatformCan(actor, "tenants", "view");
  const rows = await adminDb(deps).platformNotification.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(Math.max(limit, 1), 200) });
  return rows.map((r) => {
    const meta = (r.meta && typeof r.meta === "object" ? r.meta : {}) as { rows?: [string, string][]; link?: { label: string; url: string } | null };
    return { id: r.id, kind: r.kind, title: r.title, rows: Array.isArray(meta.rows) ? meta.rows : [], link: meta.link ?? null, createdAt: r.createdAt };
  });
}

export async function saveNotifyRecipient(
  actor: PlatformActor,
  input: { id?: string | null; email: string; label?: string | null; events: string[]; active: boolean },
  deps?: Deps,
): Promise<NotifyRecipientView> {
  assertPlatformCan(actor, "settings", "edit");
  const db = adminDb(deps);
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 160) throw new ValidationError("Enter a valid email address", { field: "email" });
  const events = cleanEvents(input.events);
  if (events.length === 0) throw new ValidationError("Choose at least one kind of event", { field: "events" });
  const label = input.label?.trim().slice(0, 80) || null;

  const taken = await db.platformNotifyRecipient.findUnique({ where: { email }, select: { id: true } });
  if (taken && taken.id !== (input.id ?? null)) throw new ValidationError("That address is already on the list", { field: "email" });

  const row = input.id
    ? await db.platformNotifyRecipient.update({ where: { id: input.id }, data: { email, label, events, active: input.active } }).catch(() => {
        throw new NotFoundError("Recipient not found");
      })
    : await db.platformNotifyRecipient.create({ data: { email, label, events, active: input.active, createdBy: actor.email } });

  await db.platformAuditLog.create({ data: { actorId: actor.id, action: input.id ? "NOTIFY_RECIPIENT_UPDATED" : "NOTIFY_RECIPIENT_ADDED", details: { email, events, active: input.active }, ipAddress: actor.ip } });
  return { id: row.id, email: row.email, label: row.label, events: cleanEvents(row.events), active: row.active, createdAt: row.createdAt };
}

export async function removeNotifyRecipient(actor: PlatformActor, id: string, deps?: Deps): Promise<void> {
  assertPlatformCan(actor, "settings", "edit");
  const db = adminDb(deps);
  const row = await db.platformNotifyRecipient.findUnique({ where: { id }, select: { email: true } });
  if (!row) throw new NotFoundError("Recipient not found");
  await db.platformNotifyRecipient.delete({ where: { id } });
  await db.platformAuditLog.create({ data: { actorId: actor.id, action: "NOTIFY_RECIPIENT_REMOVED", details: { email: row.email }, ipAddress: actor.ip } });
}

/** Sends one test email to a single address, so staff can check the setup. Returns what happened in plain words. */
export async function sendNotifyTest(actor: PlatformActor, email: string, deps?: Deps): Promise<"sent" | "no_provider"> {
  assertPlatformCan(actor, "settings", "edit");
  const to = email.trim().toLowerCase();
  if (!EMAIL.test(to)) throw new ValidationError("Enter a valid email address", { field: "email" });
  const sender = deps?.sender !== undefined ? deps.sender : emailSenderFromEnv();
  if (!sender) return "no_provider";
  const { subject, text, html } = render({ kind: "SIGNUP", title: "Test: staff notifications are working", lines: [["Sent by", actor.email], ["Sent to", to]] });
  await sender.send(to, subject, html, text);
  return "sent";
}
