import { withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { currentSmsSender } from "../customers/auth";
import { DomainError, NotFoundError, ValidationError } from "../errors";
import { consumeSmsCredit } from "../growth/abandoned";
import { assertCan, type StaffActor } from "../permissions";
import { normalizeBdPhone } from "../phone";
import { smsParts } from "../messaging/shared";

/** The store contact form and the inbox the owner answers it from. */

export const CONTACT_MESSAGE_MAX = 1000;
export const CONTACT_REPLY_MAX = 200;
const PER_PHONE_PER_HOUR = 3;
const PER_CONNECTION_PER_HOUR = 6;

export class ContactRateLimitError extends DomainError {
  constructor() {
    super("CONTACT_RATE_LIMIT", "You have sent a few messages already. Please wait a while, or call the store.", 429);
  }
}

export interface ContactInput {
  name: string;
  phone: string;
  email?: string;
  message: string;
  /** A keyed hash of the sender's connection, for limiting. Never the address itself. */
  clientHash?: string;
}

/** A shopper writes to the store. Public: anyone may, so it is limited by phone number and by connection. */
export async function submitContactMessage(tenantId: string, input: ContactInput): Promise<{ id: string }> {
  const name = input.name.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 80) throw new ValidationError("Enter your name", { field: "name" });
  let phone: string;
  try { phone = normalizeBdPhone(input.phone); } catch { throw new ValidationError("Enter a valid mobile number, like 01712345678", { field: "phone" }); }
  const email = input.email?.trim().toLowerCase() || undefined;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError("Enter a valid email or leave it empty", { field: "email" });
  const message = input.message.replace(/\r\n/g, "\n").trim();
  if (message.length < 5) throw new ValidationError("Write your message", { field: "message" });
  if (message.length > CONTACT_MESSAGE_MAX) throw new ValidationError(`Please keep it under ${CONTACT_MESSAGE_MAX} characters`, { field: "message" });
  return withTenant(tenantId, async (tx) => {
    const hourAgo = new Date(Date.now() - 3_600_000);
    if ((await tx.contactMessage.count({ where: { phone, createdAt: { gt: hourAgo } } })) >= PER_PHONE_PER_HOUR) throw new ContactRateLimitError();
    if (input.clientHash && (await tx.contactMessage.count({ where: { clientHash: input.clientHash, createdAt: { gt: hourAgo } } })) >= PER_CONNECTION_PER_HOUR) throw new ContactRateLimitError();
    // the same words again within ten minutes are a double tap, not a second message
    const same = await tx.contactMessage.findFirst({ where: { phone, message, createdAt: { gt: new Date(Date.now() - 600_000) } }, select: { id: true } });
    if (same) return { id: same.id };
    const row = await tx.contactMessage.create({ data: { tenantId, name, phone, email, message, clientHash: input.clientHash } });
    return { id: row.id };
  });
}

export type ContactStatus = "NEW" | "READ" | "REPLIED" | "CLOSED";
export type ContactTab = "open" | "replied" | "closed";

export interface ContactRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message: string;
  status: ContactStatus;
  replyText: string | null;
  repliedBy: string | null;
  repliedAt: Date | null;
  createdAt: Date;
}

const rowOf = (m: { id: string; name: string; phone: string; email: string | null; message: string; status: string; replyText: string | null; repliedBy: string | null; repliedAt: Date | null; createdAt: Date }): ContactRow => ({ ...m, status: m.status as ContactStatus });

export async function listContactMessages(tenantId: string, actor: StaffActor, tab: ContactTab = "open"): Promise<{ rows: ContactRow[]; counts: Record<ContactTab, number>; unread: number }> {
  assertCan(actor, "customers", "view");
  return withTenant(tenantId, async (tx) => {
    const where = { open: { status: { in: ["NEW", "READ"] } }, replied: { status: "REPLIED" }, closed: { status: "CLOSED" } }[tab];
    const rows = await tx.contactMessage.findMany({ where, orderBy: { createdAt: tab === "open" ? "asc" : "desc" }, take: 100 });
    const counts = {
      open: await tx.contactMessage.count({ where: { status: { in: ["NEW", "READ"] } } }),
      replied: await tx.contactMessage.count({ where: { status: "REPLIED" } }),
      closed: await tx.contactMessage.count({ where: { status: "CLOSED" } }),
    };
    return { rows: rows.map(rowOf), counts, unread: await tx.contactMessage.count({ where: { status: "NEW" } }) };
  });
}

/** Opening a message marks it read. People who can only look do not change anything. */
export async function markContactRead(tenantId: string, actor: StaffActor, id: string): Promise<void> {
  assertCan(actor, "customers", "edit");
  await withTenant(tenantId, (tx) => tx.contactMessage.updateMany({ where: { id, status: "NEW" }, data: { status: "READ" } }));
}

/** Answers by SMS to the number they gave: one SMS credit, refused if they opted out. The answer is kept with the message. */
export async function replyToContact(tenantId: string, actor: StaffActor, id: string, rawText: string): Promise<{ parts: number }> {
  assertCan(actor, "customers", "edit");
  const text = rawText.replace(/\s+/g, " ").trim();
  if (text.length < 2) throw new ValidationError("Write your reply first");
  if ([...text].length > CONTACT_REPLY_MAX) throw new ValidationError(`Keep the reply under ${CONTACT_REPLY_MAX} characters`);
  const gate = await withTenant(tenantId, async (tx) => {
    const m = await tx.contactMessage.findFirst({ where: { id } });
    if (!m) throw new NotFoundError("Message");
    if (m.status === "REPLIED") return { kind: "done" as const };
    if (await tx.smsOptOut.findFirst({ where: { phone: m.phone } })) return { kind: "opted_out" as const };
    if (!(await consumeSmsCredit(tx, tenantId))) return { kind: "no_credits" as const };
    return { kind: "ok" as const, phone: m.phone };
  });
  if (gate.kind === "done") throw new ValidationError("This message was already answered");
  if (gate.kind === "opted_out") throw new ValidationError("This person asked not to get SMS from your store.");
  if (gate.kind === "no_credits") throw new ValidationError("You have used all the SMS credits in your plan this month.");
  try {
    await currentSmsSender().send(tenantId, gate.phone, text);
  } catch (e) {
    console.error("[contact] reply sms failed", e instanceof Error ? e.name : "unknown");
    throw new ValidationError("The SMS could not be sent. Try again in a minute, or call them.");
  }
  await withTenant(tenantId, async (tx) => {
    await tx.contactMessage.update({ where: { id }, data: { status: "REPLIED", replyText: text, repliedBy: actor.name ?? actor.email, repliedAt: new Date() } });
    await audit(tx, tenantId, actor, "contact.replied", { parts: smsParts(text).parts });
  });
  return { parts: smsParts(text).parts };
}

/** For a message that needs no answer, for example one answered by phone. */
export async function closeContact(tenantId: string, actor: StaffActor, id: string): Promise<void> {
  assertCan(actor, "customers", "edit");
  await withTenant(tenantId, async (tx) => {
    const { count } = await tx.contactMessage.updateMany({ where: { id, status: { in: ["NEW", "READ"] } }, data: { status: "CLOSED" } });
    if (count === 0) {
      if (!(await tx.contactMessage.findFirst({ where: { id }, select: { id: true } }))) throw new NotFoundError("Message");
      return;
    }
    await audit(tx, tenantId, actor, "contact.closed", {});
  });
}
