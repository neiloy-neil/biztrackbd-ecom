import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { renderMail, type MailLang } from "../mail/layout";

/**
 * The words and links of messages the platform team sends to store owners outside billing: one-off campaigns and the automatic nudges.
 * Billing and account messages live in mail/templates.ts and are never opted out of; everything here can be.
 */

// ---- Unsubscribe link ----------------------------------------------------------------------------------------------------

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET || process.env.CUSTOMER_AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("UNSUBSCRIBE_SECRET (or CUSTOMER_AUTH_SECRET) must be set to at least 32 characters");
  return s;
}
const sig = (tenantId: string, key: string) => createHmac("sha256", key).update(`unsub|${tenantId}`).digest("base64url").slice(0, 27);

/** A token that proves a link was made by us for this one store. It opts the store out of marketing and does nothing else. */
export function signUnsubscribe(tenantId: string, key: string = secret()): string {
  return `${tenantId}.${sig(tenantId, key)}`;
}

/** The store the token is for, or null if it is not one of ours. */
export function verifyUnsubscribe(token: string | null | undefined, key?: string): string | null {
  if (!token || token.length > 120) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const tenantId = token.slice(0, dot);
  let want: string;
  try { want = sig(tenantId, key ?? secret()); } catch { return null; }
  const a = Buffer.from(token.slice(dot + 1)), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b) ? tenantId : null;
}

const marketingOrigin = () => {
  const set = process.env.MARKETING_ORIGIN || process.env.NEXT_PUBLIC_MARKETING_URL;
  if (set) return set.replace(/\/$/, "");
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (root && !root.startsWith("localhost")) return `https://${root}`;
  if (process.env.NODE_ENV === "production") return "https://biztrack.bd";
  return "http://localhost:3002";
};
/** True when unsubscribe links can be signed here. Nothing marketing is sent without one. */
export function unsubscribeReady(): boolean {
  try { secret(); return true; } catch { return false; }
}

export const unsubscribeUrl = (tenantId: string): string => `${marketingOrigin()}/unsubscribe?t=${encodeURIComponent(signUnsubscribe(tenantId))}`;

// ---- Campaign wording ----------------------------------------------------------------------------------------------------

export interface MessageVars { ownerName: string; storeName: string; storeUrl: string; adminUrl: string }

/** {owner_name} {store_name} {store_url} {admin_url} become that store's own details. */
export function fillPlaceholders(text: string, v: MessageVars): string {
  return text
    .replace(/\{owner_name\}/g, v.ownerName.trim().split(/\s+/)[0] || (v.storeName))
    .replace(/\{store_name\}/g, v.storeName)
    .replace(/\{store_url\}/g, v.storeUrl)
    .replace(/\{admin_url\}/g, v.adminUrl);
}

export const CAMPAIGN_PLACEHOLDERS = ["{owner_name}", "{store_name}", "{store_url}", "{admin_url}"] as const;

/** A fingerprint of the wording, so a test send only counts for the exact words that were tested. */
export const campaignHash = (c: { channel: string; subject: string | null; body: string }): string =>
  createHash("sha256").update(JSON.stringify([c.channel, c.subject ?? "", c.body])).digest("hex").slice(0, 32);

const footer = (lang: MailLang, url: string) =>
  lang === "bn" ? `পণ্য টিপস ও অফার আর পেতে না চাইলে: ${url}` : `To stop product tips and offers: ${url}`;

/** An email for one store: the wording with its details filled in, in the standard layout, with an unsubscribe line. */
export function renderCampaignEmail(c: { subject: string; body: string }, v: MessageVars, lang: MailLang, unsubUrl: string): { subject: string; html: string; text: string } {
  const subject = fillPlaceholders(c.subject, v).slice(0, 150);
  const paragraphs = fillPlaceholders(c.body, v).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const mail = renderMail({ lang, preheader: paragraphs[0]?.slice(0, 90) ?? subject, heading: subject, paragraphs, note: footer(lang, unsubUrl) }, v.storeName);
  return { subject, html: mail.html, text: mail.text };
}

/** A text message for one store. The opt-out is by the owner's store setting; the text is kept short. */
export function renderCampaignSms(body: string, v: MessageVars): string {
  return fillPlaceholders(body, v).trim();
}

// ---- Automatic nudges ----------------------------------------------------------------------------------------------------

export const NUDGE_KEYS = ["no_product", "no_order", "win_back", "near_limit"] as const;
export type NudgeKey = (typeof NUDGE_KEYS)[number];

export interface NudgeInfo { key: NudgeKey; label: string; when: string }
export const NUDGES: Record<NudgeKey, NudgeInfo> = {
  no_product: { key: "no_product", label: "No products after 3 days", when: "A store at least 3 days old that has added no products of its own. Sent once." },
  no_order: { key: "no_order", label: "No order after 14 days", when: "A store at least 14 days old with products but no order in the last 30 days. Sent once." },
  win_back: { key: "win_back", label: "Win-back after 21 days", when: "An open store whose owner has not logged in for 21 days. Sent once." },
  near_limit: { key: "near_limit", label: "Near a plan limit", when: "A store at 80 percent of its products or free SMS. At most once a month." },
};

export interface NudgeVars extends MessageVars { what?: string }

interface Copy { subject: string; heading: string; paragraphs: string[]; button: { text: string; url: string } }

/** The email for a nudge, in the owner's language. */
export function nudgeEmail(key: NudgeKey, lang: MailLang, v: NudgeVars, unsubUrl: string): { subject: string; html: string; text: string } {
  const hi = lang === "bn" ? `${v.ownerName.trim().split(/\s+/)[0] || v.storeName}, আসসালামু আলাইকুম।` : `Hi ${v.ownerName.trim().split(/\s+/)[0] || v.storeName},`;
  const en: Record<NudgeKey, Copy> = {
    no_product: { subject: `Add your first products to ${v.storeName}`, heading: "Your store is ready for its first products", paragraphs: [hi, `${v.storeName} is open, but there are no products in it yet. Add a few with photos and prices and your store is ready to take orders.`, "It takes about five minutes."], button: { text: "Add a product", url: `${v.adminUrl}/products/new` } },
    no_order: { subject: `Getting the first order for ${v.storeName}`, heading: "Let's get your first order", paragraphs: [hi, `${v.storeName} has products but no orders lately. Share your store link on Facebook and WhatsApp, and make sure Cash on Delivery or bKash is switched on at checkout.`], button: { text: "Open your store settings", url: `${v.adminUrl}/settings/payments` } },
    win_back: { subject: `Your BizTrack store is waiting, ${v.storeName}`, heading: "We have not seen you in a while", paragraphs: [hi, `You have not logged in to ${v.storeName} for three weeks. Your dashboard has your orders and anything that needs attention. If something is in the way, open Help in your admin and tell us.`], button: { text: "Open your dashboard", url: v.adminUrl } },
    near_limit: { subject: `${v.storeName} is close to a plan limit`, heading: "You are close to a limit", paragraphs: [hi, `${v.storeName} is close to its ${v.what ?? "plan limit"}. Upgrade your plan or buy extra SMS so nothing stops when you reach it.`], button: { text: "See your plan and usage", url: `${v.adminUrl}/billing` } },
  };
  const bn: Record<NudgeKey, Copy> = {
    no_product: { subject: `${v.storeName}-এ প্রথম পণ্য যোগ করুন`, heading: "আপনার স্টোর প্রথম পণ্যের জন্য প্রস্তুত", paragraphs: [hi, `${v.storeName} চালু আছে, কিন্তু এখনো কোনো পণ্য নেই। ছবি ও দামসহ কয়েকটি পণ্য যোগ করলেই স্টোর অর্ডার নিতে তৈরি।`, "সময় লাগে প্রায় পাঁচ মিনিট।"], button: { text: "পণ্য যোগ করুন", url: `${v.adminUrl}/products/new` } },
    no_order: { subject: `${v.storeName}-এর প্রথম অর্ডার পেতে`, heading: "চলুন প্রথম অর্ডার আনি", paragraphs: [hi, `${v.storeName}-এ পণ্য আছে, কিন্তু সম্প্রতি অর্ডার নেই। ফেসবুক ও হোয়াটসঅ্যাপে স্টোরের লিংক শেয়ার করুন, আর চেকআউটে ক্যাশ অন ডেলিভারি বা বিকাশ চালু আছে কি না দেখে নিন।`], button: { text: "পেমেন্ট সেটিংস খুলুন", url: `${v.adminUrl}/settings/payments` } },
    win_back: { subject: `${v.storeName}, আপনার স্টোর অপেক্ষা করছে`, heading: "অনেকদিন আপনাকে দেখিনি", paragraphs: [hi, `তিন সপ্তাহ ধরে ${v.storeName}-এ লগইন করা হয়নি। ড্যাশবোর্ডে আপনার অর্ডার আর জরুরি কাজ আছে। কোনো সমস্যা হলে অ্যাডমিনের Help খুলে আমাদের জানান।`], button: { text: "ড্যাশবোর্ড খুলুন", url: v.adminUrl } },
    near_limit: { subject: `${v.storeName} প্ল্যানের সীমার কাছাকাছি`, heading: "আপনি সীমার কাছাকাছি", paragraphs: [hi, `${v.storeName} এখন ${v.what ?? "প্ল্যানের সীমা"}-র কাছাকাছি। প্ল্যান আপগ্রেড করুন বা বাড়তি SMS কিনুন, যাতে সীমায় পৌঁছালেও কিছু বন্ধ না হয়।`], button: { text: "প্ল্যান ও ব্যবহার দেখুন", url: `${v.adminUrl}/billing` } },
  };
  const c = (lang === "bn" ? bn : en)[key];
  const mail = renderMail({ lang, preheader: c.paragraphs[1] ?? c.heading, heading: c.heading, paragraphs: c.paragraphs, button: c.button, note: footer(lang, unsubUrl) }, v.storeName);
  return { subject: c.subject, html: mail.html, text: mail.text };
}
