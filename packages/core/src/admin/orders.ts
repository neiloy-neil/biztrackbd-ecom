import type { OrderStatus, Prisma, TenantTx } from "@biztrackbd/db";
import { withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { NotFoundError, ValidationError } from "../errors";
import { isValidAddress } from "../geo/bd-geo";
import { assertCan, type StaffActor } from "../permissions";
import { deliveryFor, money, pickZone } from "../orders/pricing";
import { transitionOrder } from "../orders/service";
import { TRANSITIONS } from "../orders/state-machine";
import { recordOrderEvent } from "./order-events";
import { COURIER_STATUS_LABELS, type CourierStatus } from "../couriers/types";
import { lookupInTx, fetchSteadfastFraudStats, type PhoneLookup } from "../fraud/service";
import { FLAG_LABELS } from "../fraud/assess";

const actorName = (a: StaffActor) => a.name ?? a.email;

export type OrderTab = "all" | "new" | "check" | "to_pack" | "shipped" | "delivered" | "returns" | "cancelled";

/** Tabs on the orders screen. "check" cuts across statuses: orders waiting for the owner to confirm a bKash or Nagad payment. */
function tabWhere(tab: OrderTab): Prisma.OrderWhereInput {
  switch (tab) {
    case "new": return { status: "PENDING" };
    case "check": return { paymentStatus: "PENDING_VERIFICATION", status: { notIn: ["CANCELLED", "REFUNDED"] } };
    case "to_pack": return { status: { in: ["CONFIRMED", "PROCESSING"] } };
    case "shipped": return { status: "SHIPPED" };
    case "delivered": return { status: "DELIVERED" };
    case "returns": return { status: { in: ["RETURNED", "REFUNDED"] } };
    case "cancelled": return { status: "CANCELLED" };
    default: return {};
  }
}

export interface OrderFilters {
  tab?: OrderTab;
  /** Order number, customer name or phone. */
  q?: string;
  payment?: "COD" | "MANUAL_BKASH" | "MANUAL_NAGAD";
  district?: string;
  /** The courier an order was booked with (STEADFAST, PATHAO, REDX). */
  courier?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export interface OrderRow {
  id: string;
  orderNumber: string;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  district: string;
  area: string;
  itemCount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: OrderStatus;
  totalAmount: number;
  channel: string;
  courierProvider: string | null;
  trackingCode: string | null;
  /** A Gold or Platinum member's order: packed first. */
  priority: boolean;
}

export async function listOrders(tenantId: string, actor: StaffActor, f: OrderFilters = {}): Promise<{ rows: OrderRow[]; total: number; page: number; pageSize: number }> {
  assertCan(actor, "orders", "view");
  const pageSize = Math.min(Math.max(f.pageSize ?? 25, 1), 100);
  const page = Math.max(f.page ?? 1, 1);
  const q = f.q?.trim().slice(0, 60);
  const digits = q?.replace(/\D/g, "");
  // Prisma passes "contains" to LIKE as is, so a typed % or _ would act as a wildcard. Escape them.
  const like = q?.replace(/[\\%_]/g, (c) => `\\${c}`);
  const where: Prisma.OrderWhereInput = {
    deletedAt: null,
    ...tabWhere(f.tab ?? "all"),
    ...(f.payment ? { paymentMethod: f.payment } : {}),
    ...(f.district ? { shippingDistrict: f.district } : {}),
    ...(f.courier === "STEADFAST" || f.courier === "PATHAO" || f.courier === "REDX" ? { courierProvider: f.courier } : {}),
    ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } } : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: like, mode: "insensitive" } },
            { customerName: { contains: like, mode: "insensitive" } },
            ...(digits && digits.length >= 4 ? [{ customerPhone: { contains: digits.replace(/^880/, "0") } }] : []),
          ],
        }
      : {}),
  };
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.order.findMany({
      relationLoadStrategy: "join",
      // On the "to pack" list, members' orders come first; everywhere else it is simply newest first.
      where, orderBy: f.tab === "to_pack" ? [{ priorityPacking: "desc" }, { createdAt: "asc" }] : { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
      include: { items: { select: { quantity: true } } },
    });
    const total = await tx.order.count({ where });
    return {
      total, page, pageSize,
      rows: rows.map((o) => ({
        id: o.id, orderNumber: o.orderNumber, createdAt: o.createdAt, customerName: o.customerName, customerPhone: o.customerPhone,
        district: o.shippingDistrict, area: o.shippingCity, itemCount: o.items.reduce((n, i) => n + i.quantity, 0), paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus, status: o.status, totalAmount: Number(o.totalAmount), channel: o.channel, courierProvider: o.courierProvider, trackingCode: o.trackingCode, priority: o.priorityPacking,
      })),
    };
  });
}

export async function orderTabCounts(tenantId: string, actor: StaffActor): Promise<Record<OrderTab, number>> {
  assertCan(actor, "orders", "view");
  const tabs: OrderTab[] = ["all", "new", "check", "to_pack", "shipped", "delivered", "returns", "cancelled"];
  return withTenant(tenantId, async (tx) => {
    const out = {} as Record<OrderTab, number>;
    for (const t of tabs) out[t] = await tx.order.count({ where: { deletedAt: null, ...tabWhere(t) } });
    return out;
  });
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
  paymentMethod: string;
  channel: string;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  address: { line: string; area: string; district: string; division: string; zone: string };
  notes: string | null;
  totals: { subtotal: number; delivery: number; codFee: number; discount: number; couponCode: string | null; tierDiscount: number; referralDiscount: number; pointsDiscount: number; pointsUsed: number; total: number };
  mfs: { trxId: string | null; sender: string | null; verifiedAt: Date | null; verifiedBy: string | null };
  /** Other orders in this store that used the same TrxID. Placement blocks this, so a hit means something was changed by hand. */
  trxReuse: { id: string; orderNumber: string }[];
  courier: {
    provider: string | null; trackingCode: string | null; consignmentId: string | null; trackingUrl: string | null; bookedAt: Date | null;
    status: CourierStatus | null; statusLabel: string | null; statusAt: Date | null; syncedAt: Date | null; fee: number | null;
  };
  risk: {
    level: string; score: number; review: "HELD" | "CLEARED" | null; flags: { code: string; label: string }[]; firstTime: boolean; refusedAtDoor: boolean;
    /** Cross-store counts for this number plus this store's own history. */
    lookup: PhoneLookup;
  };
  items: { id: string; productId: string; slug: string | null; title: string; variantTitle: string | null; sku: string | null; unitPrice: number; quantity: number; total: number; imageUrl: string | null }[];
  events: { id: string; type: string; message: string; actorName: string | null; createdAt: Date }[];
  customer: { id: string | null; totalOrders: number; totalSpent: number; delivered: number; returned: number; cancelled: number; deliverySuccessPercent: number | null; isBlocked: boolean; since: Date | null } | null;
  nextStatuses: OrderStatus[];
  canEditAddress: boolean;
}

export async function getOrderDetail(tenantId: string, actor: StaffActor, orderId: string): Promise<OrderDetail> {
  assertCan(actor, "orders", "view");
  return withTenant(tenantId, async (tx) => {
    const o = await tx.order.findFirst({ where: { id: orderId } });
    if (!o) throw new NotFoundError("Order");
    const items = await tx.orderItem.findMany({
      relationLoadStrategy: "join",
      where: { orderId },
      include: { product: { select: { slug: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } }, variant: { select: { imageUrl: true } } },
    });
    const events = await tx.orderEvent.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
    const reuse = o.mfsTrxId ? await tx.order.findMany({ where: { mfsTrxId: o.mfsTrxId, id: { not: o.id } }, select: { id: true, orderNumber: true } }) : [];

    const courierStats = await fetchSteadfastFraudStats(tenantId, o.customerPhone);
    const lookup = await lookupInTx(tx, o.customerPhone, courierStats);
    let customer: OrderDetail["customer"] = null;
    if (o.customerId) {
      const c = await tx.customer.findFirst({ where: { id: o.customerId } });
      if (c) {
        const delivered = await tx.order.count({ where: { customerId: c.id, status: "DELIVERED" } });
        const returned = await tx.order.count({ where: { customerId: c.id, status: { in: ["RETURNED", "REFUNDED"] } } });
        const cancelled = await tx.order.count({ where: { customerId: c.id, status: "CANCELLED" } });
        const finished = delivered + returned;
        customer = {
          id: c.id, totalOrders: c.totalOrders, totalSpent: Number(c.totalSpent), delivered, returned, cancelled,
          deliverySuccessPercent: finished > 0 ? Math.round((delivered / finished) * 100) : null,
          isBlocked: c.isBlacklisted || Boolean(await tx.blockedContact.findFirst({ where: { phone: c.phone } })), since: c.createdAt,
        };
      }
    }
    return {
      id: o.id, orderNumber: o.orderNumber, status: o.status, paymentStatus: o.paymentStatus, paymentMethod: o.paymentMethod, channel: o.channel, createdAt: o.createdAt,
      customerName: o.customerName, customerPhone: o.customerPhone, customerEmail: o.customerEmail,
      address: { line: o.shippingAddress, area: o.shippingCity, district: o.shippingDistrict, division: o.shippingDivision, zone: o.deliveryZone },
      notes: o.notes,
      totals: { subtotal: Number(o.subtotalAmount), delivery: Number(o.deliveryCharge), codFee: Number(o.codFee), discount: Number(o.discountAmount), couponCode: o.couponCode, tierDiscount: Number(o.tierDiscountBdt), referralDiscount: Number(o.referralDiscountBdt), pointsDiscount: Number(o.loyaltyDiscountBdt), pointsUsed: o.loyaltyPointsUsed, total: Number(o.totalAmount) },
      mfs: { trxId: o.mfsTrxId, sender: o.mfsSenderNumber, verifiedAt: o.mfsVerifiedAt, verifiedBy: o.mfsVerifiedBy },
      trxReuse: reuse,
      courier: {
        provider: o.courierProvider, trackingCode: o.trackingCode, consignmentId: o.consignmentId, trackingUrl: o.courierTrackingUrl, bookedAt: o.courierBookedAt,
        status: (o.courierStatus as CourierStatus | null) ?? null, statusLabel: o.courierStatus ? COURIER_STATUS_LABELS[o.courierStatus as CourierStatus] ?? o.courierStatus : null,
        statusAt: o.courierStatusAt, syncedAt: o.courierSyncedAt, fee: o.courierBookingFee == null ? null : Number(o.courierBookingFee),
      },
      risk: {
        level: o.fraudRiskLevel, score: o.fraudTrustScore, review: o.fraudReview as "HELD" | "CLEARED" | null,
        flags: o.fraudFlags.filter((f) => f !== "FIRST_TIME_BUYER").map((code) => ({ code, label: FLAG_LABELS[code] ?? code })), firstTime: o.fraudFlags.includes("FIRST_TIME_BUYER"),
        refusedAtDoor: o.refusedAtDoor, lookup,
      },
      items: items.map((i) => ({
        id: i.id, productId: i.productId, slug: i.product.slug, title: i.productTitle, variantTitle: i.variantTitle, sku: i.sku, unitPrice: Number(i.unitPrice),
        quantity: i.quantity, total: Number(i.totalPrice), imageUrl: i.variant?.imageUrl ?? i.product.images[0]?.url ?? null,
      })),
      events: events.map((e) => ({ id: e.id, type: e.type, message: e.message, actorName: e.actorName, createdAt: e.createdAt })),
      customer,
      nextStatuses: TRANSITIONS[o.status] ?? [],
      canEditAddress: ["PENDING", "CONFIRMED", "PROCESSING"].includes(o.status),
    };
  });
}

async function lockOrder(tx: TenantTx, orderId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  if (rows.length === 0) throw new NotFoundError("Order");
}

/**
 * The owner has checked their bKash or Nagad app and the money is there. Marks the order paid and, if it was still new,
 * confirms it: a verified payment is the confirmation, so the order moves straight to "to pack".
 */
export async function verifyPayment(tenantId: string, actor: StaffActor, orderId: string): Promise<void> {
  assertCan(actor, "orders", "edit");
  let shouldConfirm = false;
  await withTenant(tenantId, async (tx) => {
    await lockOrder(tx, orderId);
    const o = await tx.order.findFirstOrThrow({ where: { id: orderId } });
    if (o.status === "CANCELLED" || o.status === "REFUNDED") throw new ValidationError("This order is closed");
    if (o.paymentStatus === "PAID") return; // double click
    if (o.paymentStatus !== "PENDING_VERIFICATION" && o.paymentStatus !== "UNPAID" && o.paymentStatus !== "FAILED") throw new ValidationError("This payment cannot be confirmed");
    await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID", mfsVerifiedAt: new Date(), mfsVerifiedBy: actor.userId } });
    await recordOrderEvent(tx, tenantId, orderId, {
      type: "PAYMENT_VERIFIED", message: o.mfsTrxId ? `Payment confirmed (TrxID ${o.mfsTrxId})` : "Marked as paid",
      actor: { id: actor.userId, name: actorName(actor) }, data: { trxId: o.mfsTrxId },
    });
    await audit(tx, tenantId, actor, "order.payment_verified", { orderNumber: o.orderNumber, method: o.paymentMethod, trxId: o.mfsTrxId });
    shouldConfirm = o.status === "PENDING";
  });
  if (shouldConfirm) await transitionOrder(tenantId, orderId, "CONFIRMED", { type: "MERCHANT", id: actor.userId, name: actorName(actor) }, "payment confirmed");
}

/** "Payment not received". Keeps the TrxID on file so it cannot be used again, and leaves the order for the owner to cancel or call about. */
export async function rejectPayment(tenantId: string, actor: StaffActor, orderId: string, reason: string): Promise<void> {
  assertCan(actor, "orders", "edit");
  const why = reason.trim().slice(0, 200);
  if (why.length < 3) throw new ValidationError("Say briefly why, for example: not in my bKash history");
  await withTenant(tenantId, async (tx) => {
    await lockOrder(tx, orderId);
    const o = await tx.order.findFirstOrThrow({ where: { id: orderId } });
    if (o.paymentStatus !== "PENDING_VERIFICATION") throw new ValidationError("There is no payment waiting to be checked on this order");
    await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "FAILED" } });
    await recordOrderEvent(tx, tenantId, orderId, {
      type: "PAYMENT_REJECTED", message: `Payment not received: ${why}`, actor: { id: actor.userId, name: actorName(actor) }, data: { trxId: o.mfsTrxId, reason: why },
    });
    await audit(tx, tenantId, actor, "order.payment_rejected", { orderNumber: o.orderNumber, trxId: o.mfsTrxId, reason: why });
  });
}

export async function addOrderNote(tenantId: string, actor: StaffActor, orderId: string, text: string): Promise<void> {
  assertCan(actor, "orders", "edit");
  const note = text.trim();
  if (note.length === 0) throw new ValidationError("Write a note first");
  await withTenant(tenantId, async (tx) => {
    const o = await tx.order.findFirst({ where: { id: orderId }, select: { id: true } });
    if (!o) throw new NotFoundError("Order");
    await recordOrderEvent(tx, tenantId, orderId, { type: "NOTE", message: note.slice(0, 500), actor: { id: actor.userId, name: actorName(actor) } });
  });
}

export interface AddressEdit {
  name?: string;
  line: string;
  area: string;
  district: string;
  division: string;
}

/**
 * Fixes the delivery address before the parcel leaves. Changing the district can change the delivery charge; that is
 * recalculated with the same rules as checkout, and refused if the order is already paid and the total would change.
 */
export async function updateShippingAddress(tenantId: string, actor: StaffActor, orderId: string, edit: AddressEdit): Promise<void> {
  assertCan(actor, "orders", "edit");
  const line = edit.line.trim();
  if (line.length < 5) throw new ValidationError("Enter the house, road and area");
  if (!isValidAddress(edit.division, edit.district, edit.area)) throw new ValidationError("Choose the division, district and upazila from the lists");
  await withTenant(tenantId, async (tx) => {
    await lockOrder(tx, orderId);
    const o = await tx.order.findFirstOrThrow({ where: { id: orderId } });
    if (!["PENDING", "CONFIRMED", "PROCESSING"].includes(o.status)) throw new ValidationError("The address can only be changed before the order ships");
    let delivery = Number(o.deliveryCharge);
    let zoneName = o.deliveryZone;
    // Free delivery earned by a member's level or a coupon stays free when the address changes.
    if (edit.district.toLowerCase() !== o.shippingDistrict.toLowerCase()) {
      const zone = pickZone(await tx.shippingZone.findMany(), edit.district);
      if (!zone) throw new ValidationError("You do not deliver to that district");
      zoneName = zone.name;
      delivery = o.deliveryWaived ? 0 : deliveryFor(zone, Number(o.subtotalAmount));
    }
    const total = money(Number(o.subtotalAmount) - Number(o.discountAmount) - Number(o.tierDiscountBdt) - Number(o.referralDiscountBdt) - Number(o.loyaltyDiscountBdt) + delivery + Number(o.codFee));
    if (o.paymentStatus === "PAID" && total !== Number(o.totalAmount)) {
      throw new ValidationError(`This order is already paid and the delivery charge for ${edit.district} would change the total. Cancel it and create a new order.`);
    }
    await tx.order.update({
      where: { id: orderId },
      data: {
        shippingAddress: line, shippingCity: edit.area, shippingDistrict: edit.district, shippingDivision: edit.division, deliveryZone: zoneName,
        deliveryCharge: delivery, totalAmount: total, ...(edit.name?.trim() ? { customerName: edit.name.trim() } : {}),
      },
    });
    await recordOrderEvent(tx, tenantId, orderId, {
      type: "ADDRESS_CHANGED", message: `Address changed to ${edit.area}, ${edit.district}${total !== Number(o.totalAmount) ? `. Total is now ৳${total}` : ""}`,
      actor: { id: actor.userId, name: actorName(actor) },
      data: { from: { line: o.shippingAddress, area: o.shippingCity, district: o.shippingDistrict }, to: { line, area: edit.area, district: edit.district }, total },
    });
    await audit(tx, tenantId, actor, "order.address_changed", { orderNumber: o.orderNumber });
  });
}

/** Moves confirmed orders to "being packed", many at once. Returns what was skipped and why. */
export async function markPacked(tenantId: string, actor: StaffActor, orderIds: string[]): Promise<{ done: string[]; skipped: { id: string; reason: string }[] }> {
  assertCan(actor, "orders", "edit");
  const done: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const id of [...new Set(orderIds)].slice(0, 100)) {
    try {
      await transitionOrder(tenantId, id, "PROCESSING", { type: "MERCHANT", id: actor.userId, name: actorName(actor) }, "packed");
      done.push(id);
    } catch (e) {
      skipped.push({ id, reason: e instanceof Error ? e.message : "failed" });
    }
  }
  return { done, skipped };
}

/** Hand the parcel to a courier the owner uses outside the platform, or deliver it themselves. Courier booking is Phase 4. */
export async function shipManually(tenantId: string, actor: StaffActor, orderId: string, opts: { trackingCode?: string } = {}): Promise<void> {
  assertCan(actor, "orders", "edit");
  const status = await withTenant(tenantId, async (tx) => (await tx.order.findFirst({ where: { id: orderId }, select: { status: true } }))?.status);
  if (!status) throw new NotFoundError("Order");
  const by = { type: "MERCHANT" as const, id: actor.userId, name: actorName(actor) };
  if (status === "CONFIRMED") await transitionOrder(tenantId, orderId, "PROCESSING", by, "packed");
  const tracking = opts.trackingCode?.trim().slice(0, 60) || null;
  await withTenant(tenantId, (tx) => tx.order.update({ where: { id: orderId }, data: { courierProvider: "MANUAL", trackingCode: tracking } }));
  await transitionOrder(tenantId, orderId, "SHIPPED", by, tracking ? `tracking ${tracking}` : "delivering it ourselves");
}

/** Notes the printing of documents on the timeline, so the team can see a slip was already printed. */
export async function recordPrinted(tenantId: string, actor: StaffActor, orderIds: string[], doc: string): Promise<void> {
  assertCan(actor, "orders", "view");
  await withTenant(tenantId, async (tx) => {
    for (const id of orderIds.slice(0, 100)) {
      const o = await tx.order.findFirst({ where: { id }, select: { id: true } });
      if (o) await recordOrderEvent(tx, tenantId, id, { type: "PRINTED", message: `${doc} printed`, actor: { id: actor.userId, name: actorName(actor) } });
    }
  });
}
