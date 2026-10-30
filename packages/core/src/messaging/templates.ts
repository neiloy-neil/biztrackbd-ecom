import { withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { recordOrderEvent } from "../admin/order-events";
import { currentSmsSender, signOrderAccess } from "../customers/auth";
import { consumeSmsCredit } from "../growth/abandoned";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { can, type StaffActor } from "../permissions";

import {
  DEFAULT_MESSAGES, EVENT_BY_NAME, MESSAGE_EVENTS, MESSAGE_LOCALES, renderMessage, smsParts, validateMessage,
  type MessageEvent, type MessageLocale, type MessageVar,
} from "./shared";
import { enqueueNotificationJob } from "./queue";

export * from "./shared";
export * from "./queue";

export interface MessageTemplateView {
  event: MessageEvent;
  label: string;
  when: string;
  alwaysOn: boolean;
  vars: MessageVar[];
  enabled: boolean;
  /** The language customers get. Messages are sent in the store's language. */
  sendsIn: MessageLocale;
  texts: Record<MessageLocale, { body: string; custom: boolean; defaultBody: string }>;
}

const localeOf = (l: string): MessageLocale => (l.startsWith("bn") ? "bn" : "en");

export async function listMessageTemplates(tenantId: string, actor: StaffActor): Promise<{ templates: MessageTemplateView[]; storeName: string; smsCredits: { used: number; limit: number | null } }> {
  if (!can(actor.role, "design", "view") && !can(actor.role, "marketing", "view")) throw new ForbiddenError();
  return withTenant(tenantId, async (tx) => {
    const t = await tx.tenant.findFirstOrThrow({ select: { name: true, locale: true, planTier: true } });
    const settings = await tx.storeSettings.findFirst({ select: { storeName: true } });
    const rows = await tx.messageTemplate.findMany({ where: { channel: "SMS" } });
    const plan = await tx.plan.findUnique({ where: { tier: t.planTier } });
    const limits = (plan?.limits ?? {}) as Record<string, unknown>;
    const usage = await tx.usageCounter.findFirst({ where: { metric: "sms" }, orderBy: { periodStart: "desc" } });
    const templates = MESSAGE_EVENTS.map<MessageTemplateView>((info) => {
      const mine = rows.filter((r) => r.event === info.event);
      const text = (l: MessageLocale) => {
        const row = mine.find((r) => r.locale === l);
        return { body: row?.body ?? DEFAULT_MESSAGES[info.event][l], custom: Boolean(row), defaultBody: DEFAULT_MESSAGES[info.event][l] };
      };
      return {
        event: info.event, label: info.label, when: info.when, alwaysOn: info.alwaysOn, vars: info.vars,
        enabled: info.alwaysOn ? true : mine.some((r) => r.isEnabled), sendsIn: localeOf(t.locale), texts: { en: text("en"), bn: text("bn") },
      };
    });
    return { templates, storeName: settings?.storeName ?? t.name, smsCredits: { used: Number(usage?.value ?? 0), limit: typeof limits.smsCredits === "number" ? limits.smsCredits : null } };
  });
}

/**
 * Saves one message: the words in one language, and/or whether it is on. Turning a message on writes both languages (ready-made text
 * where the store has not written its own) so the store's language is always covered.
 */
export async function saveMessageTemplate(
  tenantId: string, actor: StaffActor, input: { event: MessageEvent; texts?: Partial<Record<MessageLocale, string>>; enabled?: boolean },
): Promise<void> {
  if (!can(actor.role, "design", "edit") && !can(actor.role, "marketing", "edit")) throw new ForbiddenError();
  const info = EVENT_BY_NAME.get(input.event);
  if (!info) throw new ValidationError("Unknown message");
  const clean: Partial<Record<MessageLocale, string>> = {};
  for (const l of MESSAGE_LOCALES) {
    const raw = input.texts?.[l];
    if (raw === undefined) continue;
    clean[l] = raw.trim() === DEFAULT_MESSAGES[input.event][l] ? DEFAULT_MESSAGES[input.event][l] : validateMessage(input.event, raw);
  }
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.messageTemplate.findMany({ where: { event: input.event, channel: "SMS" } });
    const was = info.alwaysOn ? true : existing.some((r) => r.isEnabled);
    const enabled = info.alwaysOn ? true : (input.enabled ?? was);
    for (const l of MESSAGE_LOCALES) {
      const row = existing.find((r) => r.locale === l);
      const body = clean[l] ?? row?.body ?? DEFAULT_MESSAGES[input.event][l];
      const wanted = enabled || clean[l] !== undefined || Boolean(row);
      if (!wanted) continue;
      await tx.messageTemplate.upsert({
        where: { tenantId_event_channel_locale: { tenantId, event: input.event, channel: "SMS", locale: l } },
        create: { tenantId, event: input.event, channel: "SMS", locale: l, body, isEnabled: enabled },
        update: { body, isEnabled: enabled },
      });
    }
    if (!enabled) await tx.messageTemplate.updateMany({ where: { event: input.event, channel: "SMS" }, data: { isEnabled: false } });
    await audit(tx, tenantId, actor, "settings.message_changed", { event: input.event, enabled, languages: Object.keys(clean) });
  });
}

/** Puts the ready-made text back for one message. If the message was only on because it had been saved, it stays as it was. */
export async function resetMessageTemplate(tenantId: string, actor: StaffActor, event: MessageEvent, locale: MessageLocale): Promise<void> {
  if (!can(actor.role, "design", "edit") && !can(actor.role, "marketing", "edit")) throw new ForbiddenError();
  const info = EVENT_BY_NAME.get(event);
  if (!info) throw new ValidationError("Unknown message");
  await withTenant(tenantId, async (tx) => {
    if (info.alwaysOn) await tx.messageTemplate.deleteMany({ where: { event, channel: "SMS", locale } });
    else await tx.messageTemplate.updateMany({ where: { event, channel: "SMS", locale }, data: { body: DEFAULT_MESSAGES[event][locale] } });
    await audit(tx, tenantId, actor, "settings.message_reset", { event, locale });
  });
}

function storeOrigin(subdomain: string, primaryDomain: string | null): string {
  if (primaryDomain) return `https://${primaryDomain}`;
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (root && !root.startsWith("localhost")) return `https://${subdomain}.${root}`;
  if (process.env.NODE_ENV === "production") return `https://${subdomain}.biztrack.bd`;
  return `http://${subdomain}.${root || "localhost:3000"}`;
}

const takaText = (n: number) => `৳ ${Math.round(n).toLocaleString("en-IN")}`;

export type NotifyResult = "sent" | "off" | "no_phone" | "opted_out" | "no_credits" | "failed";

/**
 * Sends the customer a message about their order, if the store has that message turned on. Always called after the order's change
 * is saved, and never throws: a message that cannot go out never undoes an order. Uses one SMS credit; skips customers who opted out.
 */
export async function notifyOrder(tenantId: string, orderId: string, event: Exclude<MessageEvent, "ABANDONED_RECOVERY">): Promise<NotifyResult> {
  try {
    const prep = await withTenant(tenantId, async (tx) => {
      const rows = await tx.messageTemplate.findMany({ where: { event, channel: "SMS", isEnabled: true } });
      if (rows.length === 0) return null;
      const order = await tx.order.findFirst({ where: { id: orderId } });
      if (!order) return null;
      const t = await tx.tenant.findFirstOrThrow({ select: { name: true, subdomain: true, locale: true } });
      const settings = await tx.storeSettings.findFirst({ select: { storeName: true } });
      const domain = await tx.domain.findFirst({ where: { isPrimary: true, verified: true }, select: { domain: true } });
      return { rows, order, t, storeName: settings?.storeName ?? t.name, origin: storeOrigin(t.subdomain, domain?.domain ?? null) };
    });
    if (!prep) return "off";
    const { order } = prep;
    if (!order.customerPhone) return "no_phone";
    const locale = localeOf(prep.t.locale);
    const row = prep.rows.find((r) => r.locale === locale) ?? prep.rows.find((r) => r.locale === "en") ?? prep.rows[0]!;
    const link = `${prep.origin}/order/${order.id}?k=${signOrderAccess(tenantId, order.id)}`;
    const text = renderMessage(row.body, {
      customer_name: order.customerName?.trim().split(/\s+/)[0] ?? "", order_number: order.orderNumber, total: takaText(Number(order.totalAmount)), store_name: prep.storeName, tracking_link: link,
    });
    const gate = await withTenant(tenantId, async (tx) => {
      if (await tx.smsOptOut.findFirst({ where: { phone: order.customerPhone } })) return "opted_out" as const;
      return (await consumeSmsCredit(tx, tenantId)) ? ("ok" as const) : ("no_credits" as const);
    });
    if (gate !== "ok") return gate;
    const enq = await enqueueNotificationJob({
      tenantId,
      recipient: order.customerPhone,
      body: text,
      channel: "SMS",
      event,
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
    });

    if (enq.status === "SENT") {
      await withTenant(tenantId, (tx) =>
        recordOrderEvent(tx, tenantId, orderId, {
          type: "SMS",
          message: `Told the customer by SMS: ${MESSAGE_EVENTS.find((x) => x.event === event)!.label.toLowerCase()}`,
          actor: { name: "System" },
          data: { event, parts: smsParts(text).parts, jobId: enq.jobId },
        })
      );
      return "sent";
    } else if (enq.status === "PENDING") {
      await withTenant(tenantId, (tx) =>
        recordOrderEvent(tx, tenantId, orderId, {
          type: "SMS",
          message: `SMS queued for retry: ${MESSAGE_EVENTS.find((x) => x.event === event)!.label.toLowerCase()} (${enq.error ?? "provider timeout"})`,
          actor: { name: "System" },
          data: { event, parts: smsParts(text).parts, jobId: enq.jobId, queued: true },
        })
      );
      return "sent";
    }

    return "failed";
  } catch (e) {
    if (e instanceof NotFoundError) return "off";
    console.error("[messages] notify failed", e instanceof Error ? e.name : "unknown");
    return "failed";
  }
}

