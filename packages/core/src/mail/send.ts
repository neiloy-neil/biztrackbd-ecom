import { withTenant } from "@biztrackbd/db";
import { issueEmailCode, sendEmailCode } from "../auth/supabase";
import { currentSmsSender } from "../customers/auth";
import { isDemoTenantId } from "../demo/guard";
import { emailSenderFromEnv, type EmailSender } from "../growth/email";
import type { MailLang } from "./layout";
import { URGENT_KINDS, buildMail, type MailKind, type MailVars } from "./templates";

/**
 * Sends the emails (and, for the urgent ones, a text message) described in docs/44 to a store's owner. Every send is recorded with a key for
 * the moment it is about (a payment, the date a trial ends), so running a sweep twice, or retrying, never sends the same thing twice.
 * Nothing here ever throws: a message that cannot go out must never stop a payment being approved or an invite being made.
 */

let override: EmailSender | null | undefined;
/** Tests swap in a fake sender (or null for "email is not set up"). */
export function setMailSender(s: EmailSender | null | undefined): void {
  override = s;
}
const emailer = (): EmailSender | null => (override !== undefined ? override : emailSenderFromEnv());

let issuer: ((email: string) => Promise<string | null>) | undefined;
let fallback: ((email: string) => Promise<void>) | undefined;
/** Tests: where the code comes from, and what happens when we cannot send it ourselves. */
export function setCodeHooks(h: { issue?: (email: string) => Promise<string | null>; fallback?: (email: string) => Promise<void> } | undefined): void {
  issuer = h?.issue;
  fallback = h?.fallback;
}

export type MailSendResult = "sent" | "duplicate" | "skipped" | "failed";

const adminOrigin = () => {
  if (process.env.ADMIN_ORIGIN) return process.env.ADMIN_ORIGIN.replace(/\/$/, "");
  if (process.env.NEXT_PUBLIC_ADMIN_URL) return process.env.NEXT_PUBLIC_ADMIN_URL.replace(/\/$/, "");
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (root && !root.startsWith("localhost")) return `https://admin.${root}`;
  if (process.env.NODE_ENV === "production") return "https://admin.biztrack.bd";
  return "http://localhost:3001";
};
const storeOrigin = (sub: string) => {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (root && !root.startsWith("localhost")) return `https://${sub}.${root}`;
  if (process.env.NODE_ENV === "production") return `https://${sub}.biztrack.bd`;
  return `http://${sub}.${root || "localhost:3000"}`;
};

export function formatMailDate(d: Date, lang: MailLang): string {
  return new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }).format(d);
}

/** Records that this message is going out. False if it already has (so it must not be sent again). */
async function claim(tenantId: string, kind: MailKind, channel: "EMAIL" | "SMS", key: string): Promise<boolean> {
  try {
    await withTenant(tenantId, (tx) => tx.platformMessage.create({ data: { tenantId, kind, channel, dedupeKey: key.slice(0, 120), status: "SENT" } }));
    return true;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return false;
    throw e;
  }
}

/** The send failed, so the record is removed: a later retry may try again. */
async function release(tenantId: string, kind: MailKind, channel: "EMAIL" | "SMS", key: string): Promise<void> {
  await withTenant(tenantId, (tx) => tx.platformMessage.deleteMany({ where: { tenantId, kind, channel, dedupeKey: key.slice(0, 120) } })).catch(() => undefined);
}

interface OwnerInfo { name: string; storeName: string; ownerName: string | null; ownerEmail: string | null; ownerPhone: string | null; lang: MailLang; subdomain: string }

async function loadOwner(tenantId: string): Promise<OwnerInfo | null> {
  return withTenant(tenantId, async (tx) => {
    const t = await tx.tenant.findFirst({ select: { name: true, ownerName: true, ownerEmail: true, ownerPhone: true, locale: true, subdomain: true, isDemo: true } });
    if (!t || t.isDemo) return null;
    const s = await tx.storeSettings.findFirst({ select: { storeName: true } });
    return { name: t.name, storeName: s?.storeName ?? t.name, ownerName: t.ownerName, ownerEmail: t.ownerEmail, ownerPhone: t.ownerPhone, lang: t.locale.startsWith("bn") ? "bn" : "en", subdomain: t.subdomain };
  });
}

async function deliver(to: string, subject: string, html: string, text: string): Promise<"sent" | "skipped" | "failed"> {
  const s = emailer();
  if (!s) {
    // Not set up (development, or the keys are missing): say so in the log and carry on.
    console.log(`[mail] not sent (no email provider): "${subject}" to ${to.replace(/^(.).*(@.*)$/, "$1***$2")}`);
    return "skipped";
  }
  try {
    await s.send(to, subject, html, text);
    return "sent";
  } catch (e) {
    console.error("[mail] send failed", e instanceof Error ? e.name : "unknown");
    return "failed";
  }
}

/**
 * Tells a store's owner something. `dedupeKey` names the moment (a payment id, "trial-ends-2026-10-20"): the same key is sent only once.
 * Email always; the urgent kinds also send one short text message to the owner's mobile number. Demo stores are never written to.
 */
export type OwnerMailExtra = Partial<MailVars> & { paidUntilDate?: Date; trialEndsDate?: Date };

export async function notifyOwner(tenantId: string, kind: MailKind, extra: OwnerMailExtra, opts: { dedupeKey: string }): Promise<{ email: MailSendResult; sms: MailSendResult }> {
  const out: { email: MailSendResult; sms: MailSendResult } = { email: "skipped", sms: "skipped" };
  try {
    if (await isDemoTenantId(tenantId)) return out;
    const o = await loadOwner(tenantId);
    if (!o) return out;
    const { paidUntilDate, trialEndsDate, ...rest } = extra;
    const vars: MailVars = {
      storeName: o.storeName, ownerName: o.ownerName ?? undefined, adminUrl: adminOrigin(), billingUrl: `${adminOrigin()}/billing`, storeUrl: storeOrigin(o.subdomain), ...rest,
      ...(paidUntilDate ? { paidUntil: formatMailDate(paidUntilDate, o.lang) } : {}), ...(trialEndsDate ? { trialEnds: formatMailDate(trialEndsDate, o.lang) } : {}),
    };
    const mail = buildMail(kind, o.lang, vars);

    if (o.ownerEmail) {
      if (await claim(tenantId, kind, "EMAIL", opts.dedupeKey)) {
        out.email = await deliver(o.ownerEmail, mail.subject, mail.html, mail.text);
        if (out.email !== "sent") await release(tenantId, kind, "EMAIL", opts.dedupeKey);
      } else out.email = "duplicate";
    }

    if (mail.sms && URGENT_KINDS.includes(kind) && o.ownerPhone) {
      if (await claim(tenantId, kind, "SMS", opts.dedupeKey)) {
        try {
          await currentSmsSender().send(tenantId, o.ownerPhone, mail.sms);
          out.sms = "sent";
        } catch (e) {
          console.error("[mail] sms failed", e instanceof Error ? e.name : "unknown");
          out.sms = "failed";
          await release(tenantId, kind, "SMS", opts.dedupeKey);
        }
      } else out.sms = "duplicate";
    }
  } catch (e) {
    console.error("[mail] notify failed", e instanceof Error ? e.name : "unknown");
  }
  return out;
}

/** Emails the invite link to the person invited to join a store's team. */
export async function emailStaffInvite(tenantId: string, i: { to: string; roleLabel: string; inviterName: string; token: string; expiresAt: Date }): Promise<MailSendResult> {
  try {
    if (await isDemoTenantId(tenantId)) return "skipped";
    const o = await loadOwner(tenantId);
    if (!o) return "skipped";
    const key = `${i.to.toLowerCase()}:${i.expiresAt.getTime()}`;
    const mail = buildMail("STAFF_INVITE", o.lang, {
      storeName: o.storeName, inviterName: i.inviterName, roleLabel: i.roleLabel, link: `${adminOrigin()}/join/${i.token}`, expires: formatMailDate(i.expiresAt, o.lang),
    }, null);
    if (!(await claim(tenantId, "STAFF_INVITE", "EMAIL", key))) return "duplicate";
    const r = await deliver(i.to, mail.subject, mail.html, mail.text);
    if (r !== "sent") await release(tenantId, "STAFF_INVITE", "EMAIL", key);
    return r;
  } catch (e) {
    console.error("[mail] invite failed", e instanceof Error ? e.name : "unknown");
    return "failed";
  }
}

/**
 * Sends a sign-in code (first sign-in, or a forgotten password) in BizTrackBD's own email, instead of Supabase's. The caller has already
 * checked the address belongs to someone on a team and is rate limiting. If we cannot send it ourselves (no email provider set up, or it
 * is down) Supabase's own sender is asked to, so signing in never depends on only one of the two. The code is never logged.
 */
export async function sendSignInCode(email: string, lang: MailLang | "both" = "both"): Promise<MailSendResult> {
  const viaSupabase = () => (fallback ?? sendEmailCode)(email).catch(() => undefined);
  try {
    if (!emailer()) { await viaSupabase(); return "skipped"; }
    const code = await (issuer ?? issueEmailCode)(email);
    if (!code) { await viaSupabase(); return "failed"; }
    const mail = buildMail("SIGN_IN_CODE", lang, { storeName: "", code }, null);
    const r = await deliver(email, mail.subject, mail.html, mail.text);
    if (r !== "sent") await viaSupabase();
    return r;
  } catch (e) {
    console.error("[mail] sign-in code failed", e instanceof Error ? e.name : "unknown");
    await viaSupabase();
    return "failed";
  }
}

/**
 * Sends a digital delivery email to the customer with their download / access link.
 */
export async function sendCustomerDigitalDeliveryEmail(opts: {
  to: string;
  orderNumber: string;
  storeName: string;
  customerName?: string | null;
  productTitle: string;
  downloadUrl: string;
}): Promise<"sent" | "skipped" | "failed"> {
  const subject = `আপনার ডিজিটাল ফাইল প্রস্তুত হয়েছে - অর্ডার #${opts.orderNumber} (${opts.storeName})`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f766e; margin-top: 0;">${opts.storeName}</h2>
      <p>প্রিয় ${opts.customerName || "গ্রাহক"},</p>
      <p>আপনার অর্ডার <b>#${opts.orderNumber}</b> (${opts.productTitle}) এর ডিজিটাল ফাইল প্রস্তুত করা হয়েছে।</p>
      <div style="margin: 24px 0;">
        <a href="${opts.downloadUrl}" style="background-color: #0f766e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          ফাইল ডাউনলোড করুন / এক্সেস করুন
        </a>
      </div>
      <p style="font-size: 13px; color: #64748b;">
        সরাসরি লিংক: <a href="${opts.downloadUrl}">${opts.downloadUrl}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #94a3b8;">ধন্যবাদ,<br/>${opts.storeName}</p>
    </div>
  `;
  const text = `প্রিয় ${opts.customerName || "গ্রাহক"},\n\nআপনার অর্ডার #${opts.orderNumber} এর ডিজিটাল ফাইল প্রস্তুত হয়েছে। ডাউনলোড লিংক: ${opts.downloadUrl}\n\nধন্যবাদ,\n${opts.storeName}`;
  return deliver(opts.to, subject, html, text);
}
