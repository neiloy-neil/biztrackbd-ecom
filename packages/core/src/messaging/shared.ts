import { ValidationError } from "../errors";

/**
 * The messages a store sends its customers (AdmNotifications). Every message has a ready-made English and Bangla text. A store can
 * turn each one on, change the words, or put the ready-made text back. Nothing is sent until the store turns a message on, because
 * every SMS uses one of the plan's SMS credits.
 */

export type MessageEvent = "ORDER_RECEIVED" | "PAYMENT_CONFIRMED" | "ORDER_SHIPPED" | "DELIVERED" | "ORDER_CANCELLED" | "ABANDONED_RECOVERY";
export type MessageLocale = "en" | "bn";
export const MESSAGE_LOCALES: MessageLocale[] = ["en", "bn"];

export type MessageVar = "customer_name" | "order_number" | "total" | "store_name" | "tracking_link";

export interface MessageEventInfo {
  event: MessageEvent;
  label: string;
  when: string;
  /** Recovery texts are always on (the store switches abandoned-cart recovery on elsewhere); they only have words to edit. */
  alwaysOn: boolean;
  vars: MessageVar[];
}

const ORDER_VARS: MessageVar[] = ["customer_name", "order_number", "total", "store_name", "tracking_link"];

export const MESSAGE_EVENTS: MessageEventInfo[] = [
  { event: "ORDER_RECEIVED", label: "Order received", when: "Right after a customer places an order", alwaysOn: false, vars: ORDER_VARS },
  { event: "PAYMENT_CONFIRMED", label: "Payment confirmed", when: "When you confirm a bKash or Nagad payment", alwaysOn: false, vars: ORDER_VARS },
  { event: "ORDER_SHIPPED", label: "Order shipped", when: "When an order is marked as shipped", alwaysOn: false, vars: ORDER_VARS },
  { event: "DELIVERED", label: "Order delivered", when: "When an order is marked as delivered", alwaysOn: false, vars: ORDER_VARS },
  { event: "ORDER_CANCELLED", label: "Order cancelled", when: "When an order is cancelled", alwaysOn: false, vars: ORDER_VARS },
  { event: "ABANDONED_RECOVERY", label: "Abandoned cart reminder", when: "When someone leaves checkout without ordering", alwaysOn: true, vars: ["customer_name", "store_name", "total", "tracking_link"] },
];

export const EVENT_BY_NAME = new Map(MESSAGE_EVENTS.map((e) => [e.event, e]));

export const VAR_HELP: Record<MessageVar, { label: string; sample: string }> = {
  customer_name: { label: "Customer's name", sample: "Rina" },
  order_number: { label: "Order number", sample: "BT-10482" },
  total: { label: "Order total", sample: "৳ 1,850" },
  store_name: { label: "Your store name", sample: "Rongdhonu" },
  tracking_link: { label: "Link to the order (or cart)", sample: "https://rongdhonu.biztrack.bd/o/x7k2" },
};

/** The ready-made texts. Short on purpose: one Bangla SMS part holds only 70 characters. */
export const DEFAULT_MESSAGES: Record<MessageEvent, Record<MessageLocale, string>> = {
  ORDER_RECEIVED: {
    en: "Hi {customer_name}, we got your order {order_number} ({total}). Thank you for shopping with {store_name}. Track it: {tracking_link}",
    bn: "{customer_name}, আপনার অর্ডার {order_number} ({total}) পেয়েছি। {store_name}-এ কেনাকাটার জন্য ধন্যবাদ। দেখুন: {tracking_link}",
  },
  PAYMENT_CONFIRMED: {
    en: "Hi {customer_name}, your payment for order {order_number} is confirmed. We will pack it soon. {store_name}",
    bn: "{customer_name}, অর্ডার {order_number}-এর পেমেন্ট নিশ্চিত হয়েছে। শীঘ্রই প্যাক করব। {store_name}",
  },
  ORDER_SHIPPED: {
    en: "Hi {customer_name}, order {order_number} is on its way. Track it: {tracking_link} - {store_name}",
    bn: "{customer_name}, অর্ডার {order_number} পাঠানো হয়েছে। দেখুন: {tracking_link} - {store_name}",
  },
  DELIVERED: {
    en: "Hi {customer_name}, order {order_number} was delivered. Thank you for choosing {store_name}!",
    bn: "{customer_name}, অর্ডার {order_number} পৌঁছে গেছে। {store_name}-কে বেছে নেওয়ার জন্য ধন্যবাদ!",
  },
  ORDER_CANCELLED: {
    en: "Hi {customer_name}, order {order_number} was cancelled. Questions? Reply to this message or call us. {store_name}",
    bn: "{customer_name}, অর্ডার {order_number} বাতিল করা হয়েছে। প্রশ্ন থাকলে আমাদের জানান। {store_name}",
  },
  ABANDONED_RECOVERY: {
    en: "Hi {customer_name}, you left items worth {total} in your {store_name} cart. Finish your order: {tracking_link}",
    bn: "{customer_name}, আপনার {store_name} কার্টে {total} এর পণ্য রয়ে গেছে। অর্ডার সম্পূর্ণ করুন: {tracking_link}",
  },
};

export const MESSAGE_MAX_LENGTH = 480;

export const VAR_RE = /\{([a-z_]+)\}/g;

/** Fills a text. Unknown words in braces are left as they are. */
export function renderMessage(body: string, vars: Partial<Record<MessageVar, string>>): string {
  return body.replace(VAR_RE, (m, k: string) => (k in vars ? (vars[k as MessageVar] ?? "") : m));
}

export function sampleVars(storeName: string): Record<MessageVar, string> {
  return { customer_name: VAR_HELP.customer_name.sample, order_number: VAR_HELP.order_number.sample, total: VAR_HELP.total.sample, store_name: storeName, tracking_link: VAR_HELP.tracking_link.sample };
}

const GSM = /^[\n\r !"#$%&'()*+,\-./0-9:;<=>?@A-Z_a-z¡£¤¥§¿ÄÅÆÇÉÑÖØÜßàäåæèéìñòöøùü€^{}\\[~\]|]*$/;

/** How many SMS parts a text costs the customer's phone: Bangla (and any non-Latin letter) is 70 characters a part, plain English 160. */
export function smsParts(text: string): { chars: number; parts: number; unicode: boolean } {
  const unicode = !GSM.test(text);
  const chars = [...text].length;
  const [single, multi] = unicode ? [70, 67] : [160, 153];
  return { chars, unicode, parts: chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi) };
}

/** Checks the words a store wrote: not empty, not too long, and only the placeholders that exist for that message. */
export function validateMessage(event: MessageEvent, body: string): string {
  const info = EVENT_BY_NAME.get(event);
  if (!info) throw new ValidationError("Unknown message");
  const text = body.replace(/\r\n/g, "\n").trim();
  if (text.length < 5) throw new ValidationError("Write the message. It is too short.", { field: "body" });
  if (text.length > MESSAGE_MAX_LENGTH) throw new ValidationError(`Keep the message under ${MESSAGE_MAX_LENGTH} characters.`, { field: "body" });
  const unknown = [...new Set([...text.matchAll(VAR_RE)].map((m) => m[1]!).filter((k) => !info.vars.includes(k as MessageVar)))];
  if (unknown.length) throw new ValidationError(`{${unknown.join("}, {")}} cannot be used in this message. You can use: ${info.vars.map((v) => `{${v}}`).join(" ")}`, { field: "body" });
  return text;
}

