import { randomBytes } from "node:crypto";
import { withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { DomainError, NotFoundError, ValidationError } from "../errors";
import { isValidAddress } from "../geo/bd-geo";
import { normalizeBdPhone } from "../phone";
import { assertCan, type StaffActor } from "../permissions";
import { createOrder } from "../orders/service";
import { quoteOrder, type Quote } from "../orders/quote";
import { recordOrderEvent } from "./order-events";

/**
 * Draft orders: the owner sets up an order for a customer (items, name, address) and sends them a link. The customer opens it, checks
 * it, picks how to pay and places it themselves. Nothing is reserved and nothing is charged until they do. Stored in CartShortLink.
 */

const SOURCE = "DRAFT_ORDER";
const DEFAULT_HOURS = 48;

interface DraftPayload {
  v: 1;
  customer: { name: string; phone: string };
  shipping: { division: string; district: string; upazila: string; address: string };
  items: { variantId: string; quantity: number }[];
  couponCode?: string;
  note?: string;
  createdBy: { id: string; name: string };
  cancelled?: boolean;
}

export type DraftStatus = "OPEN" | "CONVERTED" | "EXPIRED" | "CANCELLED";

const statusOf = (r: { isConverted: boolean; expiresAt: Date }, p: DraftPayload, now = new Date()): DraftStatus =>
  p.cancelled ? "CANCELLED" : r.isConverted ? "CONVERTED" : r.expiresAt <= now ? "EXPIRED" : "OPEN";

const newCode = () => randomBytes(9).toString("base64url"); // 12 characters, 72 bits: cannot be guessed

export interface DraftInput {
  customer: { name: string; phone: string };
  shipping: { division: string; district: string; upazila: string; address: string };
  items: { variantId: string; quantity: number }[];
  couponCode?: string;
  note?: string;
  /** How long the link works. Between 1 hour and 7 days. */
  hours?: number;
}

export async function createDraftOrder(tenantId: string, actor: StaffActor, input: DraftInput): Promise<{ id: string; code: string; total: number | null; expiresAt: Date }> {
  assertCan(actor, "orders", "edit");
  const name = input.customer.name.trim();
  if (name.length < 2) throw new ValidationError("Enter the customer's name");
  const phone = normalizeBdPhone(input.customer.phone);
  const address = input.shipping.address.trim();
  if (address.length < 5) throw new ValidationError("Enter the house, road and area");
  if (!isValidAddress(input.shipping.division, input.shipping.district, input.shipping.upazila)) throw new ValidationError("Choose the division, district and upazila from the lists");
  if (input.items.length === 0 || input.items.length > 30) throw new ValidationError("Add at least one item");
  const quote = await quoteOrder(tenantId, { items: input.items, district: input.shipping.district, couponCode: input.couponCode || undefined, phone, paymentMethod: "COD" });
  if (quote.lines.length === 0 || quote.problems.some((p) => p.kind === "unavailable")) throw new ValidationError("One of the items is not on sale any more");
  const short = quote.problems.find((p) => p.kind === "insufficient_stock");
  if (short) {
    const l = quote.lines.find((x) => x.variantId === short.variantId);
    throw new ValidationError(`Only ${short.available} left of ${l?.productTitle ?? "an item"}`);
  }
  if (input.couponCode && quote.couponError) throw new ValidationError(quote.couponError);
  const hours = Math.min(Math.max(Math.round(input.hours ?? DEFAULT_HOURS), 1), 168);
  const expiresAt = new Date(Date.now() + hours * 3_600_000);
  const payload: DraftPayload = {
    v: 1, customer: { name, phone }, shipping: { division: input.shipping.division, district: input.shipping.district, upazila: input.shipping.upazila, address },
    items: input.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })), couponCode: input.couponCode?.trim().toUpperCase() || undefined,
    note: input.note?.trim().slice(0, 300) || undefined, createdBy: { id: actor.userId, name: actor.name ?? actor.email },
  };
  return withTenant(tenantId, async (tx) => {
    const row = await tx.cartShortLink.create({ data: { tenantId, shortCode: newCode(), payloadJson: payload as object, source: SOURCE, expiresAt } });
    await audit(tx, tenantId, actor, "draft_order.created", { lines: payload.items.length });
    return { id: row.id, code: row.shortCode, total: quote.total, expiresAt };
  });
}

export interface DraftRow {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  district: string;
  itemCount: number;
  status: DraftStatus;
  createdAt: Date;
  expiresAt: Date;
  opened: number;
  createdBy: string;
  orderId: string | null;
}

export async function listDraftOrders(tenantId: string, actor: StaffActor): Promise<DraftRow[]> {
  assertCan(actor, "orders", "view");
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.cartShortLink.findMany({ where: { source: SOURCE }, orderBy: { createdAt: "desc" }, take: 100 });
    return rows.map((r) => {
      const p = r.payloadJson as unknown as DraftPayload;
      return {
        id: r.id, code: r.shortCode, customerName: p.customer.name, customerPhone: p.customer.phone, district: p.shipping.district,
        itemCount: p.items.reduce((n, i) => n + i.quantity, 0), status: statusOf(r, p), createdAt: r.createdAt, expiresAt: r.expiresAt, opened: r.clicksCount,
        createdBy: p.createdBy.name, orderId: r.orderId,
      };
    });
  });
}

/** The address a customer opens, on the store's own domain: its custom domain when verified, otherwise its subdomain. */
export async function draftLink(tenantId: string, code: string): Promise<string> {
  const t = await withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findFirstOrThrow({ select: { subdomain: true } });
    const domain = await tx.domain.findFirst({ where: { isPrimary: true, verified: true }, select: { domain: true } });
    return { subdomain: tenant.subdomain, domain: domain?.domain ?? null };
  });
  if (t.domain) return `https://${t.domain}/draft/${code}`;
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (root && !root.startsWith("localhost")) return `https://${t.subdomain}.${root}/draft/${code}`;
  if (process.env.NODE_ENV === "production") return `https://${t.subdomain}.biztrack.bd/draft/${code}`;
  return `http://${t.subdomain}.${root || "localhost:3000"}/draft/${code}`;
}

export async function cancelDraftOrder(tenantId: string, actor: StaffActor, id: string): Promise<void> {
  assertCan(actor, "orders", "edit");
  await withTenant(tenantId, async (tx) => {
    const r = await tx.cartShortLink.findFirst({ where: { id, source: SOURCE } });
    if (!r) throw new NotFoundError("Draft order");
    const p = r.payloadJson as unknown as DraftPayload;
    if (r.isConverted) throw new ValidationError("The customer has already placed this order");
    if (p.cancelled) return;
    await tx.cartShortLink.update({ where: { id }, data: { payloadJson: { ...p, cancelled: true } as object } });
    await audit(tx, tenantId, actor, "draft_order.cancelled", {});
  });
}

// ---- The customer's side ----------------------------------------------------------------------------------------------------

export type DraftView =
  | { state: "open"; customer: DraftPayload["customer"]; shipping: DraftPayload["shipping"]; note: string | null; quote: Quote; expiresAt: Date; storeName: string }
  | { state: "converted"; orderId: string }
  | { state: "expired" | "cancelled" | "missing" };

/** What the customer sees when they open the link. Counts the opening. Anyone with the code can see the draft: that is why it is long and random. */
export async function viewDraftOrder(tenantId: string, code: string): Promise<DraftView> {
  if (!/^[A-Za-z0-9_-]{12}$/.test(code)) return { state: "missing" };
  const row = await withTenant(tenantId, async (tx) => {
    const r = await tx.cartShortLink.findFirst({ where: { shortCode: code, source: SOURCE } });
    if (!r) return null;
    await tx.cartShortLink.update({ where: { id: r.id }, data: { clicksCount: { increment: 1 } } });
    const s = await tx.storeSettings.findFirst({ select: { storeName: true } });
    return { r, storeName: s?.storeName ?? "" };
  });
  if (!row) return { state: "missing" };
  const p = row.r.payloadJson as unknown as DraftPayload;
  const status = statusOf(row.r, p);
  if (status === "CONVERTED") return { state: "converted", orderId: row.r.orderId! };
  if (status === "EXPIRED") return { state: "expired" };
  if (status === "CANCELLED") return { state: "cancelled" };
  const quote = await quoteOrder(tenantId, { items: p.items, district: p.shipping.district, couponCode: p.couponCode, phone: p.customer.phone, paymentMethod: "COD" });
  return { state: "open", customer: p.customer, shipping: p.shipping, note: p.note ?? null, quote, expiresAt: row.r.expiresAt, storeName: row.storeName };
}

export interface PlaceDraftInput {
  paymentMethod: "COD" | "MANUAL_BKASH" | "MANUAL_NAGAD";
  mfs?: { senderNumber: string; trxId: string };
  clientHash?: string;
}

/**
 * The customer confirms. The order is created by the same code as any storefront order (stock, prices, delivery, coupon, fraud checks,
 * the store being paused), keyed by the draft so a double tap places it once. Prices are worked out now, not when the draft was made.
 */
export async function placeDraftOrder(tenantId: string, code: string, input: PlaceDraftInput): Promise<{ orderId: string; orderNumber: string; totalAmount: number }> {
  if (!/^[A-Za-z0-9_-]{12}$/.test(code)) throw new NotFoundError("Draft order");
  const row = await withTenant(tenantId, (tx) => tx.cartShortLink.findFirst({ where: { shortCode: code, source: SOURCE } }));
  if (!row) throw new NotFoundError("Draft order");
  const p = row.payloadJson as unknown as DraftPayload;
  const status = statusOf(row, p);
  if (status === "CANCELLED") throw new DomainError("DRAFT_CANCELLED", "This order link is no longer valid. Please ask the store for a new one.", 410);
  // A draft already placed answers with the same order, so a second tap or a reload is harmless.
  if (status === "EXPIRED") throw new DomainError("DRAFT_EXPIRED", "This order link has expired. Please ask the store for a new one.", 410);
  const placed = await createOrder(tenantId, {
    idempotencyKey: `draft-${row.id}`,
    customer: { name: p.customer.name, phone: p.customer.phone },
    shipping: { address: p.shipping.address, city: p.shipping.upazila, district: p.shipping.district, division: p.shipping.division },
    items: p.items, paymentMethod: input.paymentMethod, mfs: input.paymentMethod === "COD" ? undefined : input.mfs,
    couponCode: p.couponCode, notes: p.note, channel: "STOREFRONT", clientHash: input.clientHash, createdByUserId: p.createdBy.id,
  });
  if (!placed.replayed) {
    await withTenant(tenantId, async (tx) => {
      await tx.cartShortLink.update({ where: { id: row.id }, data: { isConverted: true, orderId: placed.orderId } });
      await recordOrderEvent(tx, tenantId, placed.orderId, { type: "NOTE", message: `Placed from the order link ${p.createdBy.name} sent`, actor: { name: "Customer" } });
    });
  }
  return { orderId: placed.orderId, orderNumber: placed.orderNumber, totalAmount: placed.totalAmount };
}
