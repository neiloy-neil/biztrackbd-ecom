import { withTenant, type TenantTx } from "@biztrackbd/db";
import { recordOrderEvent } from "../admin/order-events";
import { audit } from "../audit/service";
import { NotFoundError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { normalizeBdPhone } from "../phone";
import { FLAG_LABELS } from "./assess";
import { lookupTrust, type TrustScore } from "./trust";

const actorName = (a: StaffActor) => a.name ?? a.email;
const OPEN = ["PENDING", "CONFIRMED", "PROCESSING"] as const;

export interface FlaggedOrder {
  id: string;
  orderNumber: string;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  district: string;
  total: number;
  paymentMethod: string;
  status: string;
  level: string;
  score: number;
  flags: { code: string; label: string }[];
  held: boolean;
}

export interface FraudOverview {
  held: number;
  flaggedThisMonth: number;
  blockedNumbers: number;
  /** Order value of held orders the owner then cancelled this month: the cash on delivery they did not ship. */
  valueStopped: number;
}

export interface BlockedRow {
  id: string;
  phone: string;
  reason: string;
  source: string;
  createdAt: Date;
}

const flagList = (codes: string[]) => codes.filter((c) => c !== "FIRST_TIME_BUYER").map((code) => ({ code, label: FLAG_LABELS[code] ?? code }));

export async function getFraudOverview(tenantId: string, actor: StaffActor): Promise<FraudOverview> {
  assertCan(actor, "orders", "view");
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);
  return withTenant(tenantId, async (tx) => {
    const [held, flagged, blocked, stopped] = await Promise.all([
      tx.order.count({ where: { fraudReview: "HELD", status: { in: [...OPEN] } } }),
      tx.order.count({ where: { fraudRiskLevel: { in: ["MEDIUM", "HIGH"] }, createdAt: { gt: monthAgo } } }),
      tx.blockedContact.count(),
      tx.order.aggregate({ _sum: { totalAmount: true }, where: { fraudReview: "HELD", status: "CANCELLED", createdAt: { gt: monthAgo } } }),
    ]);
    return { held, flaggedThisMonth: flagged, blockedNumbers: blocked, valueStopped: Number(stopped._sum.totalAmount ?? 0) };
  });
}

/** Orders that need a human look: held for review, or scored medium or high and not yet shipped. Highest risk first. */
export async function listFlaggedOrders(tenantId: string, actor: StaffActor, tab: "held" | "watch" = "held"): Promise<FlaggedOrder[]> {
  assertCan(actor, "orders", "view");
  const rows = await withTenant(tenantId, (tx) =>
    tx.order.findMany({
      where: tab === "held"
        ? { fraudReview: "HELD", status: { in: [...OPEN] } }
        : { fraudRiskLevel: { in: ["MEDIUM", "HIGH"] }, fraudReview: { not: "HELD" }, status: { in: [...OPEN] } },
      orderBy: [{ fraudTrustScore: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
  );
  return rows.map((o) => ({
    id: o.id, orderNumber: o.orderNumber, createdAt: o.createdAt, customerName: o.customerName, customerPhone: o.customerPhone, district: o.shippingDistrict,
    total: Number(o.totalAmount), paymentMethod: o.paymentMethod, status: o.status, level: o.fraudRiskLevel, score: o.fraudTrustScore, flags: flagList(o.fraudFlags), held: o.fraudReview === "HELD",
  }));
}

/** The owner has called the customer and is happy to ship. */
export async function releaseHold(tenantId: string, actor: StaffActor, orderId: string, note?: string): Promise<void> {
  assertCan(actor, "orders", "edit");
  await withTenant(tenantId, async (tx) => {
    const o = await tx.order.findFirst({ where: { id: orderId } });
    if (!o) throw new NotFoundError("Order");
    if (o.fraudReview !== "HELD") return;
    await tx.order.update({ where: { id: orderId }, data: { fraudReview: "CLEARED" } });
    const why = note?.trim().slice(0, 200);
    await recordOrderEvent(tx, tenantId, orderId, { type: "FRAUD", message: `Hold released by ${actorName(actor)}${why ? `: ${why}` : ""}`, actor: { id: actor.userId, name: actorName(actor) } });
    await audit(tx, tenantId, actor, "fraud.hold_released", { orderNumber: o.orderNumber, score: o.fraudTrustScore, note: why ?? null });
  });
}

/** Puts an order back on hold, for example after a second thought. */
export async function holdOrder(tenantId: string, actor: StaffActor, orderId: string, note?: string): Promise<void> {
  assertCan(actor, "orders", "edit");
  await withTenant(tenantId, async (tx) => {
    const o = await tx.order.findFirst({ where: { id: orderId } });
    if (!o) throw new NotFoundError("Order");
    if (!OPEN.includes(o.status as (typeof OPEN)[number])) throw new ValidationError("Only an order that has not shipped can be held");
    if (o.fraudReview === "HELD") return;
    await tx.order.update({ where: { id: orderId }, data: { fraudReview: "HELD" } });
    const why = note?.trim().slice(0, 200);
    await recordOrderEvent(tx, tenantId, orderId, { type: "FRAUD", message: `Held for review by ${actorName(actor)}${why ? `: ${why}` : ""}`, actor: { id: actor.userId, name: actorName(actor) } });
    await audit(tx, tenantId, actor, "fraud.held", { orderNumber: o.orderNumber, note: why ?? null });
  });
}

// ---- Blocklist -----------------------------------------------------------------------------------------------------

export async function listBlocked(tenantId: string, actor: StaffActor): Promise<BlockedRow[]> {
  assertCan(actor, "customers", "view");
  const rows = await withTenant(tenantId, (tx) => tx.blockedContact.findMany({ orderBy: { createdAt: "desc" }, take: 500 }));
  return rows.map((r) => ({ id: r.id, phone: r.phone, reason: r.reason, source: r.source, createdAt: r.createdAt }));
}

/** Blocks a number for this store only. Works for numbers that are not customers yet. The blocked person is not told why. */
export async function blockPhone(tenantId: string, actor: StaffActor, phoneInput: string, reason: string, source: "MANUAL" | "FRAUD_REVIEW" | "REFUSED_PARCELS" = "MANUAL"): Promise<void> {
  assertCan(actor, "customers", "edit");
  const phone = normalizeBdPhone(phoneInput);
  if (!/^01[3-9]\d{8}$/.test(phone)) throw new ValidationError("Enter a Bangladesh mobile number, for example 01712345678");
  const why = reason.trim().slice(0, 200);
  if (why.length < 3) throw new ValidationError("Say briefly why, for example: refused three parcels");
  await withTenant(tenantId, async (tx) => {
    await tx.blockedContact.upsert({ where: { tenantId_phone: { tenantId, phone } }, create: { tenantId, phone, reason: why, source, createdBy: actor.userId }, update: { reason: why, source } });
    await tx.customer.updateMany({ where: { phone }, data: { isBlacklisted: true, blacklistReason: why } });
    await audit(tx, tenantId, actor, "customer.blocked", { phone, reason: why, source });
  });
}

export async function unblockPhone(tenantId: string, actor: StaffActor, blockedId: string): Promise<void> {
  assertCan(actor, "customers", "edit");
  await withTenant(tenantId, async (tx) => {
    const b = await tx.blockedContact.findFirst({ where: { id: blockedId } });
    if (!b) throw new NotFoundError("Blocked number");
    await tx.blockedContact.delete({ where: { id: b.id } });
    await tx.customer.updateMany({ where: { phone: b.phone }, data: { isBlacklisted: false, blacklistReason: null } });
    await audit(tx, tenantId, actor, "customer.unblocked", { phone: b.phone });
  });
}

// ---- Number lookup -------------------------------------------------------------------------------------------------

export interface PhoneLookup {
  phone: string;
  /** Across every store on the platform. Counts only; never names, addresses or items (docs/12 section 1C). */
  network: TrustScore;
  /** This store's own orders for the number. */
  here: { orders: number; delivered: number; returned: number; cancelled: number };
  blocked: boolean;
}

async function lookup(tx: TenantTx, phone: string): Promise<PhoneLookup> {
  const [network, orders, delivered, returned, cancelled, blocked] = await Promise.all([
    lookupTrust(tx, phone),
    tx.order.count({ where: { customerPhone: phone } }),
    tx.order.count({ where: { customerPhone: phone, status: "DELIVERED" } }),
    tx.order.count({ where: { customerPhone: phone, status: { in: ["RETURNED", "REFUNDED"] } } }),
    tx.order.count({ where: { customerPhone: phone, status: "CANCELLED" } }),
    tx.blockedContact.findFirst({ where: { phone }, select: { id: true } }),
  ]);
  return { phone, network, here: { orders, delivered, returned, cancelled }, blocked: Boolean(blocked) };
}

/** Check a number before taking its order, for example while on the phone with a new customer. */
export async function lookupPhone(tenantId: string, actor: StaffActor, phoneInput: string): Promise<PhoneLookup> {
  assertCan(actor, "orders", "view");
  const phone = normalizeBdPhone(phoneInput);
  if (!/^01[3-9]\d{8}$/.test(phone)) throw new ValidationError("Enter a Bangladesh mobile number, for example 01712345678");
  return withTenant(tenantId, (tx) => lookup(tx, phone));
}

/** The same lookup for an order's own number, inside the order screen. */
export async function lookupInTx(tx: TenantTx, phone: string): Promise<PhoneLookup> {
  return lookup(tx, phone);
}
