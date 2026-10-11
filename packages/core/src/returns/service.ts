import { withTenant, type TenantTx } from "@biztrackbd/db";
import { z } from "zod";
import { recordOrderEvent } from "../admin/order-events";
import { audit } from "../audit/service";
import { InsufficientStockError, NotFoundError, ValidationError } from "../errors";
import { transitionOrder } from "../orders/service";
import { money } from "../orders/pricing";
import { assertCan, type StaffActor } from "../permissions";
import { verifyOrderAccess } from "../customers/auth";

/**
 * Returns, exchanges and store credit (docs/07 section 4).
 *
 *   PENDING -> APPROVED -> PICKUP_BOOKED -> RECEIVED -> REFUNDED   (refund to bKash or Nagad, or store credit)
 *                                       \-> EXCHANGED               (exchange: the replacement was set aside at approval)
 *   PENDING or APPROVED -> DECLINED
 *
 * A return is for a parcel the customer already received. A parcel that never reached the customer is a courier return and
 * is handled by the order itself (Returned), not here.
 */

export type ReturnType = "REFUND" | "EXCHANGE" | "STORE_CREDIT";
export type ReturnStatus = "PENDING" | "APPROVED" | "PICKUP_BOOKED" | "RECEIVED" | "REFUNDED" | "EXCHANGED" | "DECLINED";
export type ReturnTab = "requested" | "approved" | "coming_back" | "done" | "declined" | "all";

export const RETURN_REASONS = ["Wrong size", "Wrong item sent", "Damaged or defective", "Not as described", "Changed my mind", "Other"] as const;

const actorName = (a: StaffActor) => a.name ?? a.email;
const by = (a: StaffActor) => ({ id: a.userId, name: actorName(a) });
const TRX = /^[A-Za-z0-9]{8,12}$/;

interface ReturnLineSnapshot {
  orderItemId: string;
  variantId: string | null;
  productId: string;
  title: string;
  variantTitle: string | null;
  qty: number;
  unitPrice: number;
}

export const CreateReturnInput = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(3, "Choose or write the reason").max(200),
  note: z.string().trim().max(1000).optional(),
  type: z.enum(["REFUND", "EXCHANGE", "STORE_CREDIT"]),
  items: z.array(z.object({ orderItemId: z.string().min(1), qty: z.number().int().min(1).max(1000) })).min(1, "Pick at least one item"),
  exchangeVariantId: z.string().min(1).optional(),
});
export type CreateReturnInput = z.infer<typeof CreateReturnInput>;

export interface ReturnRow {
  id: string;
  code: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  status: ReturnStatus;
  type: ReturnType;
  reason: string;
  customerNote: string | null;
  adminNote: string | null;
  lines: ReturnLineSnapshot[];
  refundAmount: number | null;
  exchangeVariantId: string | null;
  exchangeLabel: string | null;
  returnTrackingCode: string | null;
  refundMethod: string | null;
  refundTrxId?: string | null;
  photos?: string[];
  createdAt: Date;
  decidedAt: Date | null;
  receivedAt: Date | null;
  refundedAt: Date | null;
}

export interface ReturnMetrics {
  waiting: number;
  comingBack: number;
  /** Returns opened in the last 30 days, as a percent of orders delivered in the same 30 days. */
  returnRatePercent: number | null;
  refunded30Days: number;
}

const TAB_STATUSES: Record<ReturnTab, string[] | null> = {
  requested: ["PENDING"], approved: ["APPROVED"], coming_back: ["PICKUP_BOOKED", "RECEIVED"], done: ["REFUNDED", "EXCHANGED"], declined: ["DECLINED"], all: null,
};

function asLines(v: unknown): ReturnLineSnapshot[] {
  return Array.isArray(v) ? (v as ReturnLineSnapshot[]) : [];
}

async function nextCode(tx: TenantTx, tenantId: string): Promise<string> {
  // One writer at a time per store, so two requests cannot take the same number.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`returns:${tenantId}`}))`;
  const rows = await tx.$queryRaw<{ n: number | null }[]>`SELECT max(substring(code from 4)::int) AS n FROM "ReturnRequest" WHERE code ~ '^RT-[0-9]+$'`;
  return `RT-${String((rows[0]?.n ?? 0) + 1).padStart(4, "0")}`;
}

async function lockReturn(tx: TenantTx, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ReturnRequest" WHERE "id" = ${id} FOR UPDATE`;
  if (rows.length === 0) throw new NotFoundError("Return");
  return tx.returnRequest.findFirstOrThrow({ where: { id } });
}

async function stockMove(tx: TenantTx, tenantId: string, actor: StaffActor, variantId: string, delta: number, reason: "RETURNED" | "OTHER", note: string) {
  const rows = await tx.$queryRaw<{ stock: number; product: string; variant: string }[]>`
    UPDATE "ProductVariant" v SET "stockQuantity" = v."stockQuantity" + ${delta}, "updatedAt" = now()
    FROM "Product" p WHERE v.id = ${variantId} AND p.id = v."productId" AND v."stockQuantity" + ${delta} >= 0
    RETURNING v."stockQuantity" AS stock, p.title AS product, v.title AS variant`;
  const r = rows[0];
  if (!r) throw new InsufficientStockError("That replacement is out of stock", variantId, 0);
  await tx.stockAdjustment.create({
    data: { tenantId, variantId, productTitle: r.product, variantTitle: r.variant, delta, quantityAfter: r.stock, reason, note, actorId: actor.userId, actorName: actorName(actor) },
  });
}

// ---------------------------------------------------------------------------------------------------------------------

export async function createReturn(tenantId: string, actor: StaffActor, raw: unknown): Promise<{ id: string; code: string }> {
  assertCan(actor, "orders", "edit");
  const parsed = CreateReturnInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid return");
  const input = parsed.data;
  return withTenant(tenantId, async (tx) => {
    const order = await tx.order.findFirst({ where: { id: input.orderId }, include: { items: true } });
    if (!order) throw new NotFoundError("Order");
    if (order.status !== "DELIVERED") throw new ValidationError("Only a delivered order can have a return");

    const earlier = await tx.returnRequest.findMany({ where: { orderId: order.id, status: { not: "DECLINED" } } });
    const used = new Map<string, number>();
    for (const r of earlier) for (const l of asLines(r.items)) used.set(l.orderItemId, (used.get(l.orderItemId) ?? 0) + l.qty);

    const lines: ReturnLineSnapshot[] = [];
    const seen = new Set<string>();
    for (const want of input.items) {
      if (seen.has(want.orderItemId)) throw new ValidationError("Each item can be listed once");
      seen.add(want.orderItemId);
      const item = order.items.find((i) => i.id === want.orderItemId);
      if (!item) throw new ValidationError("That item is not on this order");
      const left = item.quantity - (used.get(item.id) ?? 0);
      if (want.qty > left) throw new ValidationError(left <= 0 ? `${item.productTitle} is already in another return` : `Only ${left} of ${item.productTitle} can still be returned`);
      lines.push({ orderItemId: item.id, variantId: item.variantId, productId: item.productId, title: item.productTitle, variantTitle: item.variantTitle, qty: want.qty, unitPrice: Number(item.unitPrice) });
    }
    if (input.type === "EXCHANGE") {
      if (!input.exchangeVariantId) throw new ValidationError("Choose the size or colour to send instead");
      const v = await tx.productVariant.findFirst({ where: { id: input.exchangeVariantId } });
      if (!v) throw new ValidationError("That replacement is not in your catalogue");
    }
    const value = money(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));
    const code = await nextCode(tx, tenantId);
    const row = await tx.returnRequest.create({
      data: {
        tenantId, orderId: order.id, code, reason: input.reason, customerNote: input.note ?? null, type: input.type, items: lines as unknown as object,
        refundAmount: input.type === "EXCHANGE" ? null : value, exchangeVariantId: input.type === "EXCHANGE" ? input.exchangeVariantId : null, status: "PENDING",
      },
    });
    await recordOrderEvent(tx, tenantId, order.id, {
      type: "RETURN", message: `${input.type === "EXCHANGE" ? "Exchange" : "Return"} ${code} opened: ${input.reason}`, actor: by(actor), data: { returnId: row.id, code, type: input.type },
    });
    await audit(tx, tenantId, actor, "return.created", { code, orderNumber: order.orderNumber, type: input.type, value });
    return { id: row.id, code };
  });
}

export interface ApproveInput {
  /** Change the resolution when approving, for example from refund to exchange after talking to the customer. */
  type?: ReturnType;
  refundAmount?: number;
  exchangeVariantId?: string;
  note?: string;
}

export async function approveReturn(tenantId: string, actor: StaffActor, returnId: string, input: ApproveInput = {}): Promise<void> {
  assertCan(actor, "orders", "edit");
  await withTenant(tenantId, async (tx) => {
    const r = await lockReturn(tx, returnId);
    if (r.status !== "PENDING") throw new ValidationError("This return was already decided");
    const order = await tx.order.findFirstOrThrow({ where: { id: r.orderId } });
    const type = (input.type ?? r.type) as ReturnType;
    const lines = asLines(r.items);
    const qty = lines.reduce((s, l) => s + l.qty, 0);
    const value = money(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));

    let refundAmount: number | null = null;
    let exchangeVariantId: string | null = null;
    let reserved = false;
    if (type === "EXCHANGE") {
      exchangeVariantId = input.exchangeVariantId ?? r.exchangeVariantId;
      if (!exchangeVariantId) throw new ValidationError("Choose the size or colour to send instead");
      // Set the replacement aside now so it cannot be sold to someone else before the old parcel arrives.
      await stockMove(tx, tenantId, actor, exchangeVariantId, -qty, "OTHER", `Set aside for exchange ${r.code}`);
      reserved = true;
    } else {
      refundAmount = money(input.refundAmount ?? Number(r.refundAmount ?? value));
      if (!(refundAmount > 0)) throw new ValidationError("The refund must be more than zero");
      if (refundAmount > Number(order.totalAmount)) throw new ValidationError("The refund cannot be more than the order total");
    }
    await tx.returnRequest.update({
      where: { id: returnId },
      data: { status: "APPROVED", type, refundAmount, exchangeVariantId, exchangeReserved: reserved, adminNote: input.note?.trim().slice(0, 500) || r.adminNote, decidedBy: actor.userId, decidedAt: new Date() },
    });
    await recordOrderEvent(tx, tenantId, order.id, { type: "RETURN", message: `${r.code} approved${type === "EXCHANGE" ? " as an exchange" : type === "STORE_CREDIT" ? " as store credit" : ` for a refund of ৳${refundAmount}`}`, actor: by(actor), data: { returnId, code: r.code } });
    await audit(tx, tenantId, actor, "return.approved", { code: r.code, type, refundAmount });
  });
}

async function releaseReservation(tx: TenantTx, tenantId: string, actor: StaffActor, r: { code: string; exchangeVariantId: string | null; exchangeReserved: boolean; items: unknown }) {
  if (!r.exchangeReserved || !r.exchangeVariantId) return;
  const qty = asLines(r.items).reduce((s, l) => s + l.qty, 0);
  await stockMove(tx, tenantId, actor, r.exchangeVariantId, qty, "OTHER", `Replacement released: ${r.code} was declined`);
}

export async function declineReturn(tenantId: string, actor: StaffActor, returnId: string, reason: string): Promise<void> {
  assertCan(actor, "orders", "edit");
  const why = reason.trim().slice(0, 300);
  if (why.length < 3) throw new ValidationError("Tell the customer why, for example: worn and washed");
  await withTenant(tenantId, async (tx) => {
    const r = await lockReturn(tx, returnId);
    if (r.status !== "PENDING" && r.status !== "APPROVED") throw new ValidationError("This return can no longer be declined");
    await releaseReservation(tx, tenantId, actor, r);
    await tx.returnRequest.update({ where: { id: returnId }, data: { status: "DECLINED", adminNote: why, exchangeReserved: false, decidedBy: actor.userId, decidedAt: new Date() } });
    await recordOrderEvent(tx, tenantId, r.orderId, { type: "RETURN", message: `${r.code} declined: ${why}`, actor: by(actor), data: { returnId, code: r.code } });
    await audit(tx, tenantId, actor, "return.declined", { code: r.code, reason: why });
  });
}

/** Writes down that the parcel is on its way back (the owner booked a pickup, or the customer is posting it). */
export async function markPickupBooked(tenantId: string, actor: StaffActor, returnId: string, trackingCode?: string): Promise<void> {
  assertCan(actor, "orders", "edit");
  await withTenant(tenantId, async (tx) => {
    const r = await lockReturn(tx, returnId);
    if (r.status !== "APPROVED") throw new ValidationError("Approve the return first");
    const code = trackingCode?.trim().slice(0, 60) || null;
    await tx.returnRequest.update({ where: { id: returnId }, data: { status: "PICKUP_BOOKED", returnTrackingCode: code } });
    await recordOrderEvent(tx, tenantId, r.orderId, { type: "RETURN", message: `${r.code}: parcel coming back${code ? `, tracking ${code}` : ""}`, actor: by(actor), data: { returnId, code: r.code } });
  });
}

/**
 * The parcel is back in the shop. Good items go back on the shelf (damaged ones do not). For an exchange this also
 * completes the return: the replacement was set aside at approval and is now ready to send.
 */
export async function receiveReturn(tenantId: string, actor: StaffActor, returnId: string, opts: { restock: boolean }): Promise<void> {
  assertCan(actor, "orders", "edit");
  await withTenant(tenantId, async (tx) => {
    const r = await lockReturn(tx, returnId);
    if (r.status !== "APPROVED" && r.status !== "PICKUP_BOOKED") throw new ValidationError("This return is not waiting for a parcel");
    const lines = asLines(r.items);
    if (opts.restock) {
      for (const l of lines.filter((x) => x.variantId).sort((a, b) => a.variantId!.localeCompare(b.variantId!))) {
        await stockMove(tx, tenantId, actor, l.variantId!, l.qty, "RETURNED", `Return ${r.code}`);
      }
    }
    const exchange = r.type === "EXCHANGE";
    await tx.returnRequest.update({ where: { id: returnId }, data: { status: exchange ? "EXCHANGED" : "RECEIVED", receivedAt: new Date(), restocked: opts.restock } });
    await recordOrderEvent(tx, tenantId, r.orderId, {
      type: "RETURN", message: `${r.code}: parcel received${opts.restock ? ", back in stock" : ", not restocked (damaged)"}${exchange ? ". Send the replacement." : ""}`, actor: by(actor), data: { returnId, code: r.code },
    });
    await audit(tx, tenantId, actor, "return.received", { code: r.code, restocked: opts.restock });
  });
}

export interface RefundInput {
  method: "BKASH_SEND_MONEY" | "STORE_CREDIT";
  /** Defaults to the approved amount. */
  amount?: number;
  /** The owner's own bKash or Nagad transaction ID for the money sent back. */
  trxId?: string;
}

export async function refundReturn(tenantId: string, actor: StaffActor, returnId: string, input: RefundInput): Promise<{ amount: number; orderClosed: boolean }> {
  assertCan(actor, "orders", "edit");
  let fullRefund = false;
  let orderId = "";
  let amount = 0;
  await withTenant(tenantId, async (tx) => {
    const r = await lockReturn(tx, returnId);
    if (r.type === "EXCHANGE") throw new ValidationError("An exchange has no refund");
    if (r.status !== "RECEIVED") throw new ValidationError(r.status === "REFUNDED" ? "Already refunded" : "Receive the parcel before refunding");
    orderId = r.orderId;
    if (input.method === "BKASH_SEND_MONEY" && !TRX.test(input.trxId?.trim() ?? "")) throw new ValidationError("Enter the transaction ID of the money you sent back");

    // Lock the order so two refunds cannot together pay out more than the customer paid.
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${r.orderId} FOR UPDATE`;
    const order = await tx.order.findFirstOrThrow({ where: { id: r.orderId } });
    const paidBack = await tx.refundLedger.aggregate({ where: { orderId: r.orderId }, _sum: { amount: true } });
    const remaining = money(Number(order.totalAmount) - Number(paidBack._sum.amount ?? 0));
    amount = money(input.amount ?? Number(r.refundAmount ?? 0));
    if (!(amount > 0)) throw new ValidationError("The refund must be more than zero");
    if (amount > remaining) throw new ValidationError(`Only ৳${remaining} of this order is left to refund`);

    await tx.refundLedger.create({
      data: {
        tenantId, orderId: r.orderId, amount, reason: `${r.code}: ${r.reason}`.slice(0, 200), method: input.method, trxId: input.trxId?.trim().toUpperCase() || null, processedBy: actor.userId,
      },
    });
    if (input.method === "STORE_CREDIT" && order.customerId) {
      await tx.customer.update({ where: { id: order.customerId }, data: { storeCredit: { increment: amount } } });
    }
    if (order.customerId) {
      const c = await tx.customer.findFirst({ where: { id: order.customerId }, select: { totalSpent: true } });
      if (c) await tx.customer.update({ where: { id: order.customerId }, data: { totalSpent: Math.max(0, money(Number(c.totalSpent) - amount)) } });
    }
    fullRefund = amount === remaining;
    await tx.order.update({ where: { id: r.orderId }, data: { paymentStatus: fullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
    await tx.returnRequest.update({ where: { id: returnId }, data: { status: "REFUNDED", refundAmount: amount, refundMethod: input.method, refundTrxId: input.trxId?.trim().toUpperCase() || null, refundedAt: new Date() } });
    await recordOrderEvent(tx, tenantId, r.orderId, {
      type: "RETURN", message: `${r.code}: refunded ৳${amount} ${input.method === "STORE_CREDIT" ? "as store credit" : "by bKash or Nagad"}`, actor: by(actor), data: { returnId, code: r.code, amount, method: input.method },
    });
    await audit(tx, tenantId, actor, "return.refunded", { code: r.code, orderNumber: order.orderNumber, amount, method: input.method });
  });
  // Everything on the order has been paid back: close it, so the sales and profit screens stop counting it.
  if (fullRefund) {
    await transitionOrder(tenantId, orderId, "REFUNDED", { type: "MERCHANT", id: actor.userId, name: actorName(actor) }, "fully refunded").catch((e) => console.error("[returns] could not close fully refunded order", orderId, e instanceof Error ? e.message : e));
  }
  return { amount, orderClosed: fullRefund };
}

// ---------------------------------------------------------------------------------------------------------------------

export async function listReturns(tenantId: string, actor: StaffActor, tab: ReturnTab = "all"): Promise<ReturnRow[]> {
  assertCan(actor, "orders", "view");
  const statuses = TAB_STATUSES[tab];
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.returnRequest.findMany({ where: statuses ? { status: { in: statuses } } : {}, orderBy: { createdAt: "desc" }, take: 200 });
    const orders = await tx.order.findMany({ where: { id: { in: rows.map((r) => r.orderId) } }, select: { id: true, orderNumber: true, customerName: true, customerPhone: true } });
    const variantIds = rows.map((r) => r.exchangeVariantId).filter((x): x is string => Boolean(x));
    const variants = variantIds.length ? await tx.productVariant.findMany({ where: { id: { in: variantIds } }, include: { product: { select: { title: true } } } }) : [];
    return rows.map((r) => {
      const o = orders.find((x) => x.id === r.orderId);
      const v = variants.find((x) => x.id === r.exchangeVariantId);
      return {
        id: r.id, code: r.code, orderId: r.orderId, orderNumber: o?.orderNumber ?? "", customerName: o?.customerName ?? "", customerPhone: o?.customerPhone ?? "",
        status: r.status as ReturnStatus, type: r.type as ReturnType, reason: r.reason, customerNote: r.customerNote, adminNote: r.adminNote, lines: asLines(r.items),
        refundAmount: r.refundAmount == null ? null : Number(r.refundAmount), exchangeVariantId: r.exchangeVariantId, exchangeLabel: v ? `${v.product.title} (${v.title})` : null,
        returnTrackingCode: r.returnTrackingCode, refundMethod: r.refundMethod, createdAt: r.createdAt, decidedAt: r.decidedAt, receivedAt: r.receivedAt, refundedAt: r.refundedAt,
      };
    });
  });
}

export async function returnTabCounts(tenantId: string, actor: StaffActor): Promise<Record<ReturnTab, number>> {
  assertCan(actor, "orders", "view");
  const rows = await withTenant(tenantId, (tx) => tx.returnRequest.groupBy({ by: ["status"], _count: { _all: true } }));
  const n = (s: string[]) => rows.filter((r) => s.includes(r.status)).reduce((a, r) => a + r._count._all, 0);
  return { requested: n(TAB_STATUSES.requested!), approved: n(TAB_STATUSES.approved!), coming_back: n(TAB_STATUSES.coming_back!), done: n(TAB_STATUSES.done!), declined: n(TAB_STATUSES.declined!), all: rows.reduce((a, r) => a + r._count._all, 0) };
}

export async function getReturnMetrics(tenantId: string, actor: StaffActor): Promise<ReturnMetrics> {
  assertCan(actor, "orders", "view");
  const since = new Date(Date.now() - 30 * 86_400_000);
  return withTenant(tenantId, async (tx) => {
    const [waiting, comingBack, opened, delivered, refunded] = await Promise.all([
      tx.returnRequest.count({ where: { status: "PENDING" } }),
      tx.returnRequest.count({ where: { status: "PICKUP_BOOKED" } }),
      tx.returnRequest.count({ where: { createdAt: { gt: since }, status: { not: "DECLINED" } } }),
      tx.order.count({ where: { deliveredAt: { gt: since } } }),
      tx.refundLedger.aggregate({ where: { createdAt: { gt: since } }, _sum: { amount: true } }),
    ]);
    return { waiting, comingBack, returnRatePercent: delivered > 0 ? Math.round((opened / delivered) * 1000) / 10 : null, refunded30Days: Number(refunded._sum.amount ?? 0) };
  });
}

/** What can still be returned from a delivered order: the order screen's "start a return" form. */
export async function returnableItems(tenantId: string, actor: StaffActor, orderId: string) {
  assertCan(actor, "orders", "view");
  return withTenant(tenantId, async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new NotFoundError("Order");
    const earlier = await tx.returnRequest.findMany({ where: { orderId, status: { not: "DECLINED" } } });
    const used = new Map<string, number>();
    for (const r of earlier) for (const l of asLines(r.items)) used.set(l.orderItemId, (used.get(l.orderItemId) ?? 0) + l.qty);
    return {
      eligible: order.status === "DELIVERED",
      items: order.items.map((i) => ({ id: i.id, title: i.productTitle, variantTitle: i.variantTitle, unitPrice: Number(i.unitPrice), left: i.quantity - (used.get(i.id) ?? 0), quantity: i.quantity })),
    };
  });
}

/** Variants the owner can offer as a replacement, with live stock. */
export async function exchangeOptions(tenantId: string, actor: StaffActor, productId?: string) {
  assertCan(actor, "orders", "view");
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.productVariant.findMany({
      where: { ...(productId ? { productId } : {}), product: { status: "ACTIVE", deletedAt: null } },
      include: { product: { select: { title: true } } }, orderBy: [{ productId: "asc" }, { title: "asc" }], take: 300,
    });
    return rows.map((v) => ({ id: v.id, label: `${v.product.title} (${v.title})`, stock: v.stockQuantity, productId: v.productId }));
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Storefront Customer Return Requests (Phase 5 Section B2)
// ---------------------------------------------------------------------------------------------------------------------

export const CustomerReturnInput = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(3, "Choose or write the reason").max(200),
  customerNote: z.string().trim().max(1000).optional(),
  type: z.enum(["REFUND", "EXCHANGE", "STORE_CREDIT"]),
  items: z.array(z.object({ orderItemId: z.string().min(1), qty: z.number().int().min(1).max(1000) })).min(1, "Pick at least one item"),
  exchangeVariantId: z.string().min(1).optional(),
  photos: z.array(z.string().max(500)).max(5).optional(),
  payoutMethod: z.enum(["BKASH", "NAGAD", "ROCKET"]).optional(),
  payoutNumber: z.string().trim().max(30).optional(),
});
export type CustomerReturnInput = z.infer<typeof CustomerReturnInput>;

export interface CustomerReturnableInfo {
  eligible: boolean;
  reasonIfNotEligible?: string;
  deliveredDaysAgo: number | null;
  daysRemaining: number | null;
  activeReturn: ReturnRow | null;
  items: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    title: string;
    variantTitle: string | null;
    unitPrice: number;
    purchasedQty: number;
    returnableQty: number;
  }>;
}

export async function customerReturnableItems(
  tenantId: string,
  orderId: string,
  auth: { customerId?: string | null; token?: string | null },
): Promise<CustomerReturnableInfo> {
  return withTenant(tenantId, async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundError("Order");

    const hasAccess = verifyOrderAccess(tenantId, order.id, auth.token) || (auth.customerId && order.customerId === auth.customerId);
    if (!hasAccess) throw new NotFoundError("Order");

    const existingReturns = await tx.returnRequest.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
    });

    const activePrisma = existingReturns.find((r) => ["PENDING", "APPROVED", "PICKUP_BOOKED", "RECEIVED"].includes(r.status));
    let activeReturn: ReturnRow | null = null;
    if (activePrisma) {
      let exchangeLabel: string | null = null;
      if (activePrisma.exchangeVariantId) {
        const v = await tx.productVariant.findFirst({
          where: { id: activePrisma.exchangeVariantId },
          include: { product: { select: { title: true } } },
        });
        if (v) exchangeLabel = `${v.product.title} (${v.title})`;
      }
      activeReturn = {
        id: activePrisma.id,
        code: activePrisma.code,
        orderId: activePrisma.orderId,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: activePrisma.status as ReturnStatus,
        type: activePrisma.type as ReturnType,
        reason: activePrisma.reason,
        customerNote: activePrisma.customerNote,
        adminNote: activePrisma.adminNote,
        lines: asLines(activePrisma.items),
        refundAmount: activePrisma.refundAmount == null ? null : Number(activePrisma.refundAmount),
        exchangeVariantId: activePrisma.exchangeVariantId,
        exchangeLabel,
        returnTrackingCode: activePrisma.returnTrackingCode,
        refundMethod: activePrisma.refundMethod,
        refundTrxId: activePrisma.refundTrxId,
        photos: activePrisma.photos,
        createdAt: activePrisma.createdAt,
        decidedAt: activePrisma.decidedAt,
        receivedAt: activePrisma.receivedAt,
        refundedAt: activePrisma.refundedAt,
      };
    }

    const deliveredAt = order.deliveredAt ?? (order.status === "DELIVERED" ? order.updatedAt : null);
    const deliveredDaysAgo = deliveredAt ? Math.floor((Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24)) : null;
    const daysRemaining = deliveredDaysAgo != null ? Math.max(0, 7 - deliveredDaysAgo) : null;

    let eligible = true;
    let reasonIfNotEligible: string | undefined;

    if (order.status !== "DELIVERED") {
      eligible = false;
      reasonIfNotEligible = "Only delivered orders are eligible for return or exchange";
    } else if (deliveredDaysAgo != null && deliveredDaysAgo > 7) {
      eligible = false;
      reasonIfNotEligible = "The 7-day return window has expired for this order";
    } else if (activeReturn) {
      eligible = false;
      reasonIfNotEligible = "A return request is already in progress";
    }

    const used = new Map<string, number>();
    for (const r of existingReturns.filter((r) => r.status !== "DECLINED")) {
      for (const l of asLines(r.items)) {
        used.set(l.orderItemId, (used.get(l.orderItemId) ?? 0) + l.qty);
      }
    }

    const items = order.items.map((i) => {
      const returnableQty = Math.max(0, i.quantity - (used.get(i.id) ?? 0));
      return {
        id: i.id,
        productId: i.productId,
        variantId: i.variantId,
        title: i.productTitle,
        variantTitle: i.variantTitle,
        unitPrice: Number(i.unitPrice),
        purchasedQty: i.quantity,
        returnableQty,
      };
    });

    if (eligible && items.every((i) => i.returnableQty === 0)) {
      eligible = false;
      reasonIfNotEligible = "All items from this order have already been returned";
    }

    return {
      eligible,
      reasonIfNotEligible,
      deliveredDaysAgo,
      daysRemaining,
      activeReturn,
      items,
    };
  });
}

export async function customerExchangeVariants(
  tenantId: string,
  orderId: string,
  auth: { customerId?: string | null; token?: string | null },
): Promise<Array<{ id: string; productId: string; title: string; stock: number }>> {
  return withTenant(tenantId, async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundError("Order");
    const hasAccess = verifyOrderAccess(tenantId, order.id, auth.token) || (auth.customerId && order.customerId === auth.customerId);
    if (!hasAccess) throw new NotFoundError("Order");

    const productIds = Array.from(new Set(order.items.map((i) => i.productId)));
    const variants = await tx.productVariant.findMany({
      where: {
        productId: { in: productIds },
        product: { status: "ACTIVE", deletedAt: null },
      },
      include: { product: { select: { title: true } } },
      orderBy: { title: "asc" },
    });

    return variants.map((v) => ({
      id: v.id,
      productId: v.productId,
      title: `${v.product.title} (${v.title})`,
      stock: v.stockQuantity,
    }));
  });
}

export async function customerRequestReturn(
  tenantId: string,
  raw: unknown,
  auth: { customerId?: string | null; token?: string | null },
): Promise<{ id: string; code: string; status: ReturnStatus }> {
  const parsed = CustomerReturnInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid return request");
  const input = parsed.data;

  return withTenant(tenantId, async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: input.orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundError("Order");

    const hasAccess = verifyOrderAccess(tenantId, order.id, auth.token) || (auth.customerId && order.customerId === auth.customerId);
    if (!hasAccess) throw new NotFoundError("Order");

    if (order.status !== "DELIVERED") {
      throw new ValidationError("Returns can only be requested for delivered orders");
    }

    const deliveredAt = order.deliveredAt ?? order.updatedAt;
    const daysSinceDelivery = (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDelivery > 7.05) {
      throw new ValidationError("The 7-day return window for this order has expired");
    }

    const activeReturn = await tx.returnRequest.findFirst({
      where: {
        orderId: order.id,
        status: { in: ["PENDING", "APPROVED", "PICKUP_BOOKED", "RECEIVED"] },
      },
    });
    if (activeReturn) {
      throw new ValidationError("An active return request is already in progress for this order");
    }

    const isDefectClaim = input.reason === "Damaged or defective" || input.reason === "Wrong item sent";
    if (isDefectClaim && (!input.photos || input.photos.length === 0)) {
      throw new ValidationError("Please upload at least one photo showing the damage or wrong item received");
    }

    const earlier = await tx.returnRequest.findMany({ where: { orderId: order.id, status: { not: "DECLINED" } } });
    const used = new Map<string, number>();
    for (const r of earlier) for (const l of asLines(r.items)) used.set(l.orderItemId, (used.get(l.orderItemId) ?? 0) + l.qty);

    const lines: ReturnLineSnapshot[] = [];
    const seen = new Set<string>();
    for (const want of input.items) {
      if (seen.has(want.orderItemId)) throw new ValidationError("Each item can be listed once");
      seen.add(want.orderItemId);
      const item = order.items.find((i) => i.id === want.orderItemId);
      if (!item) throw new ValidationError("That item is not on this order");
      const left = item.quantity - (used.get(item.id) ?? 0);
      if (want.qty > left) {
        throw new ValidationError(left <= 0 ? `${item.productTitle} is already returned` : `Only ${left} of ${item.productTitle} can still be returned`);
      }
      lines.push({
        orderItemId: item.id,
        variantId: item.variantId,
        productId: item.productId,
        title: item.productTitle,
        variantTitle: item.variantTitle,
        qty: want.qty,
        unitPrice: Number(item.unitPrice),
      });
    }

    if (input.type === "EXCHANGE") {
      if (!input.exchangeVariantId) throw new ValidationError("Please choose the size or colour you want in exchange");
      const v = await tx.productVariant.findFirst({ where: { id: input.exchangeVariantId } });
      if (!v) throw new ValidationError("The selected replacement variant is not available");
      if (v.stockQuantity < 1) throw new ValidationError("The selected replacement variant is currently out of stock");
    }

    let customerNote = input.customerNote?.trim() || "";
    if (input.type === "REFUND" && input.payoutNumber) {
      const payoutText = `Refund to: ${input.payoutMethod ?? "bKash"} (${input.payoutNumber})`;
      customerNote = customerNote ? `${payoutText}\n${customerNote}` : payoutText;
    }

    const value = money(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));
    const code = await nextCode(tx, tenantId);

    const row = await tx.returnRequest.create({
      data: {
        tenantId,
        orderId: order.id,
        code,
        reason: input.reason,
        customerNote: customerNote || null,
        type: input.type,
        items: lines as unknown as object,
        refundAmount: input.type === "EXCHANGE" ? null : value,
        exchangeVariantId: input.type === "EXCHANGE" ? input.exchangeVariantId : null,
        photos: input.photos ?? [],
        refundMethod: input.type === "REFUND" && input.payoutMethod ? input.payoutMethod : input.type === "STORE_CREDIT" ? "STORE_CREDIT" : null,
        status: "PENDING",
      },
    });

    await recordOrderEvent(tx, tenantId, order.id, {
      type: "RETURN",
      message: `Customer requested ${input.type === "EXCHANGE" ? "exchange" : "return"} (${code}): ${input.reason}`,
      actor: { name: "Customer" },
      data: { returnId: row.id, code, type: input.type },
    });

    return { id: row.id, code, status: "PENDING" };
  });
}

export async function getCustomerOrderReturns(
  tenantId: string,
  orderId: string,
  auth: { customerId?: string | null; token?: string | null },
): Promise<ReturnRow[]> {
  return withTenant(tenantId, async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId },
      select: { id: true, orderNumber: true, customerName: true, customerPhone: true, customerId: true },
    });
    if (!order) throw new NotFoundError("Order");
    const hasAccess = verifyOrderAccess(tenantId, order.id, auth.token) || (auth.customerId && order.customerId === auth.customerId);
    if (!hasAccess) throw new NotFoundError("Order");

    const rows = await tx.returnRequest.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });
    const variantIds = rows.map((r) => r.exchangeVariantId).filter((x): x is string => Boolean(x));
    const variants = variantIds.length
      ? await tx.productVariant.findMany({ where: { id: { in: variantIds } }, include: { product: { select: { title: true } } } })
      : [];

    return rows.map((r) => {
      const v = variants.find((x) => x.id === r.exchangeVariantId);
      return {
        id: r.id,
        code: r.code,
        orderId: r.orderId,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: r.status as ReturnStatus,
        type: r.type as ReturnType,
        reason: r.reason,
        customerNote: r.customerNote,
        adminNote: r.adminNote,
        lines: asLines(r.items),
        refundAmount: r.refundAmount == null ? null : Number(r.refundAmount),
        exchangeVariantId: r.exchangeVariantId,
        exchangeLabel: v ? `${v.product.title} (${v.title})` : null,
        returnTrackingCode: r.returnTrackingCode,
        refundMethod: r.refundMethod,
        refundTrxId: r.refundTrxId,
        photos: r.photos,
        createdAt: r.createdAt,
        decidedAt: r.decidedAt,
        receivedAt: r.receivedAt,
        refundedAt: r.refundedAt,
      };
    });
  });
}
