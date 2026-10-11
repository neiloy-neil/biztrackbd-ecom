import { withTenant } from "@biztrackbd/db";
import { z } from "zod";
import { ValidationError } from "../errors";
import { BD_GEO } from "../geo/bd-geo";
import { createOrder, type PlacedOrder } from "../orders/service";
import { assertCan, type StaffActor } from "../permissions";
import { normalizeBdPhone } from "../phone";

/**
 * Quick order desk (doc 28 section 4): orders that arrive on Messenger, WhatsApp, Instagram or the phone, keyed in fast.
 * The parser only SUGGESTS values from a pasted message. Every field is shown for the person to check before saving.
 */

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export const asciiDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

/** Common Bangla place names, since customers type addresses in Bangla. English names come from the geography data. */
const BN_PLACES: Record<string, string> = {
  ঢাকা: "Dhaka", মিরপুর: "Mirpur", উত্তরা: "Uttara", ধানমন্ডি: "Dhanmondi", গুলশান: "Gulshan", মোহাম্মদপুর: "Mohammadpur", বনানী: "Gulshan", বাড্ডা: "Badda",
  মতিঝিল: "Motijheel", যাত্রাবাড়ী: "Jatrabari", পল্টন: "Paltan", তেজগাঁও: "Tejgaon", সাভার: "Savar", গাজীপুর: "Gazipur", নারায়ণগঞ্জ: "Narayanganj",
  চট্টগ্রাম: "Chattogram", সিলেট: "Sylhet", রাজশাহী: "Rajshahi", খুলনা: "Khulna", বরিশাল: "Barishal", রংপুর: "Rangpur", ময়মনসিংহ: "Mymensingh",
  কুমিল্লা: "Cumilla", বগুড়া: "Bogura", যশোর: "Jessore", ফরিদপুর: "Faridpur", টাঙ্গাইল: "Tangail", নরসিংদী: "Narsingdi",
};

export interface CatalogVariant {
  productId: string;
  productTitle: string;
  variantId: string;
  variantTitle: string;
  stock: number;
}

export interface ParsedMessage {
  phone: string | null;
  name: string | null;
  division: string | null;
  district: string | null;
  upazila: string | null;
  /** What is left of the message after the parts we recognised, as a starting point for the address box. */
  addressHint: string | null;
  items: { variantId: string; productId: string; label: string; quantity: number }[];
  payment: "COD" | "MANUAL_BKASH" | "MANUAL_NAGAD" | null;
}

const PHONE_RE = /(?:\+?88)?0?1[3-9](?:[\s-]?\d){8}/;

export function parseOrderMessage(rawText: string, catalog: CatalogVariant[]): ParsedMessage {
  const text = asciiDigits(rawText).replace(/[।|]/g, ",");
  const out: ParsedMessage = { phone: null, name: null, division: null, district: null, upazila: null, addressHint: null, items: [], payment: null };

  // Phone: first thing that looks like a Bangladeshi mobile number.
  const pm = PHONE_RE.exec(text.replace(/\s+(?=\d)/g, (m) => (m.length > 1 ? " " : m)));
  if (pm) {
    try {
      out.phone = normalizeBdPhone(pm[0].replace(/[^\d+]/g, ""));
    } catch {
      /* not a real number */
    }
  }
  const rest = pm ? text.replace(pm[0], ", ") : text;

  // Payment hint
  if (/\b(cod|cash\s*on\s*delivery)\b|ক্যাশ\s*অন/i.test(rest)) out.payment = "COD";
  else if (/bkash|বিকাশ/i.test(rest)) out.payment = "MANUAL_BKASH";
  else if (/nagad|নগদ/i.test(rest)) out.payment = "MANUAL_NAGAD";

  // Place: prefer the most specific (upazila) match, longest name first, then district.
  const lower = rest.toLowerCase();
  const places: { name: string; district: string; division: string; upazila: string | null }[] = [];
  for (const div of BD_GEO) for (const d of div.districts) {
    places.push({ name: d.name, district: d.name, division: div.name, upazila: null });
    for (const u of d.upazilas) places.push({ name: u, district: d.name, division: div.name, upazila: u });
  }
  const mentioned = (needle: string) => new RegExp(`(^|[^a-z])${needle.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(lower);
  const aliasHits = Object.entries(BN_PLACES).filter(([bn]) => rest.includes(bn)).map(([, en]) => en);
  const candidates = places.filter((p) => mentioned(p.name) || aliasHits.includes(p.name)).sort((a, b) => (b.upazila ? 1 : 0) - (a.upazila ? 1 : 0) || b.name.length - a.name.length);
  const best = candidates.find((c) => c.upazila) ?? candidates[0];
  if (best) {
    out.district = best.district;
    out.division = best.division;
    out.upazila = best.upazila;
    // "Mirpur" exists as an upazila under Dhaka; a bare district alias like Dhaka alone leaves the upazila for the person to pick.
  }

  // Quantity
  const qm = /(\d+)\s*(?:pcs?|pieces?|টি|পিস|ta|x)\b/i.exec(rest) ?? /\b(?:qty|quantity)\s*[:=]?\s*(\d+)/i.exec(rest);
  const quantity = qm ? Math.min(Math.max(parseInt(qm[1]!, 10), 1), 50) : 1;

  // Product and size: the product whose words appear most in the message, then a variant whose title is a size mentioned.
  const words = new Set(lower.split(/[^a-z0-9ঀ-৿]+/).filter((w) => w.length >= 3));
  const products = new Map<string, { title: string; score: number; variants: CatalogVariant[] }>();
  for (const v of catalog) {
    const entry = products.get(v.productId) ?? { title: v.productTitle, score: 0, variants: [] };
    entry.variants.push(v);
    products.set(v.productId, entry);
  }
  for (const e of products.values()) e.score = e.title.toLowerCase().split(/[^a-z0-9ঀ-৿]+/).filter((w) => w.length >= 3 && words.has(w)).length;
  const top = [...products.values()].filter((p) => p.score > 0).sort((a, b) => b.score - a.score)[0];
  if (top) {
    const tokens = new Set(rest.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean));
    const variant = top.variants.find((v) => tokens.has(v.variantTitle.toUpperCase())) ?? (top.variants.length === 1 ? top.variants[0] : undefined);
    if (variant) out.items.push({ variantId: variant.variantId, productId: variant.productId, label: `${variant.productTitle}${variant.variantTitle.toLowerCase() === "default" ? "" : ` (${variant.variantTitle})`}`, quantity });
    else out.items.push({ variantId: "", productId: top.variants[0]!.productId, label: top.title, quantity });
  }

  // Name: the first comma-separated piece when it has no digits and looks like a short name.
  const first = rest.split(",").map((s) => s.trim()).find(Boolean);
  if (first && !/\d/.test(first) && first.split(/\s+/).length <= 4 && first.length >= 2 && !out.items.some((i) => first.toLowerCase().includes(i.label.toLowerCase().slice(0, 4)))) {
    const looksLikePlace = places.some((p) => p.name.toLowerCase() === first.toLowerCase()) || Boolean(BN_PLACES[first]);
    if (!looksLikePlace && !/^(cod|bkash|nagad)$/i.test(first)) out.name = first;
  }

  // Address hint: pieces of the ORIGINAL message (Bangla digits intact) that are not the phone, name, a payment word, a product or the quantity.
  const original = rawText.replace(/[।|]/g, ",").split(",").map((x) => x.trim()).filter(Boolean);
  const pieces = original.filter((s) => {
    const a = asciiDigits(s);
    if (PHONE_RE.test(a.replace(/\s+(?=\d)/g, " "))) return false;
    if (s === out.name || /^(cod|bkash|nagad|cash on delivery)$/i.test(s)) return false;
    if (/\b(?:pcs?|pieces?)\b|\d\s*(?:টি|পিস)/i.test(a)) return false;
    if (top && a.toLowerCase().includes(top.title.toLowerCase().split(/\s+/)[0]!)) return false;
    return true;
  });
  out.addressHint = pieces.length ? pieces.join(", ").slice(0, 250) : null;
  return out;
}

// ---- Database helpers for the desk

export async function findCustomerForOrder(tenantId: string, actor: StaffActor, rawPhone: string) {
  assertCan(actor, "orders", "view");
  let phone: string;
  try {
    phone = normalizeBdPhone(rawPhone);
  } catch {
    return null;
  }
  return withTenant(tenantId, async (tx) => {
    const c = await tx.customer.findFirst({ where: { phone } });
    if (!c) return null;
    const last = await tx.order.findFirst({ where: { customerId: c.id }, orderBy: { createdAt: "desc" } });
    const delivered = await tx.order.count({ where: { customerId: c.id, status: "DELIVERED" } });
    const returned = await tx.order.count({ where: { customerId: c.id, status: { in: ["RETURNED", "REFUNDED"] } } });
    const blocked = c.isBlacklisted || Boolean(await tx.blockedContact.findFirst({ where: { phone } }));
    return {
      id: c.id, name: c.name, phone, orders: c.totalOrders, spent: Number(c.totalSpent), blocked,
      deliverySuccessPercent: delivered + returned > 0 ? Math.round((delivered / (delivered + returned)) * 100) : null,
      lastAddress: last ? { line: last.shippingAddress, area: last.shippingCity, district: last.shippingDistrict, division: last.shippingDivision } : null,
    };
  });
}

/** Variants matching a typed name or SKU, with stock, for the product picker. */
export async function searchVariantsForOrder(tenantId: string, actor: StaffActor, query: string, limit = 12): Promise<(CatalogVariant & { price: number; sku: string | null })[]> {
  assertCan(actor, "orders", "view");
  const q = query.trim().slice(0, 60);
  const like = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.$queryRaw<{ vid: string; pid: string; product: string; variant: string; stock: number; price: number; sku: string | null }[]>`
      SELECT v.id AS vid, p.id AS pid, p.title AS product, v.title AS variant, v."stockQuantity" AS stock, v.price::float8 AS price, v.sku
      FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
      WHERE p.status = 'ACTIVE' AND p."deletedAt" IS NULL
        AND (${like}::text IS NULL OR p.title ILIKE ${like} OR v.sku ILIKE ${like} OR p."titleBn" ILIKE ${like})
      ORDER BY p."updatedAt" DESC, v."createdAt" ASC LIMIT ${Math.min(limit, 50) * 6}`;
    return rows.map((r) => ({ productId: r.pid, productTitle: r.product, variantId: r.vid, variantTitle: r.variant, stock: r.stock, price: r.price, sku: r.sku }));
  });
}

export const QUICK_SOURCES = ["MESSENGER", "WHATSAPP", "PHONE", "INSTAGRAM"] as const;
export type QuickSource = (typeof QUICK_SOURCES)[number];

export const QuickOrderInput = z.object({
  idempotencyKey: z.string().min(8).max(100),
  source: z.enum(QUICK_SOURCES),
  customer: z.object({ name: z.string().trim().min(2).max(120), phone: z.string().min(10).max(20) }),
  shipping: z.object({ division: z.string(), district: z.string(), upazila: z.string(), address: z.string().trim().min(5).max(300) }),
  items: z.array(z.object({ variantId: z.string().min(8), quantity: z.number().int().min(1).max(50) })).min(1).max(30),
  paymentMethod: z.enum(["COD", "MANUAL_BKASH", "MANUAL_NAGAD"]).default("COD"),
  /** The customer already paid by bKash or Nagad (for example while on the phone). */
  alreadyPaid: z.boolean().default(false),
  trxId: z.string().trim().max(20).optional(),
  couponCode: z.string().trim().max(40).optional(),
  note: z.string().trim().max(300).optional(),
});

export async function createQuickOrder(tenantId: string, actor: StaffActor, raw: unknown): Promise<PlacedOrder> {
  assertCan(actor, "orders", "edit");
  const parsed = QuickOrderInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the order details");
  const i = parsed.data;
  return createOrder(tenantId, {
    idempotencyKey: i.idempotencyKey,
    customer: i.customer,
    shipping: { address: i.shipping.address, city: i.shipping.upazila, district: i.shipping.district, division: i.shipping.division },
    items: i.items,
    paymentMethod: i.paymentMethod,
    alreadyPaid: i.alreadyPaid && i.paymentMethod !== "COD",
    mfs: i.paymentMethod !== "COD" && i.trxId ? { senderNumber: i.customer.phone, trxId: i.trxId } : undefined,
    couponCode: i.couponCode || undefined,
    notes: i.note || undefined,
    channel: `QUICK_${i.source}`,
    createdByUserId: actor.userId,
    createdByName: actor.name ?? actor.email,
  });
}
