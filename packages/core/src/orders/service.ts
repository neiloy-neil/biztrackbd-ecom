import { assertTakesOrders } from "../demo/guard";
import { randomUUID } from "node:crypto";
import { Prisma, withTenant, type OrderStatus, type TenantTx } from "@biztrackbd/db";
import {
  BlockedCustomerError, OrderRateLimitError, PaymentMethodUnavailableError, StorePausedError, CouponError, InsufficientStockError, NotFoundError, ValidationError,
} from "../errors";
import { audit } from "../audit/service";
import { recordOrderEvent } from "../admin/order-events";
import { publishEvent } from "../events";
import { notifyOrder } from "../messaging/templates";
import { assertCan, type StaffActor } from "../permissions";
import { assertCouponUsable, deliveryFor, discountFor, money, pickZone } from "./pricing";
import { recordOrderUsage, type OrderThreshold } from "../limits/plan";
import { assessOrderRisk } from "../fraud/assess";
import { markRecoveredByOrder } from "../growth/abandoned";
import { sendServerCancellation } from "../growth/tracking";
import { recordOutcome, type TrustKind } from "../fraud/trust";
import { onCancelled, onDelivered, onReturned, priceLoyalty, recordAtOrder, referralAddressClash, sendNotices, type Notice } from "../loyalty/engine";
import { normalizeBdPhone } from "../phone";
import { CreateOrderInput } from "./schema";
import { RESTOCKS_ON, assertTransition } from "./state-machine";

const IDEMPOTENCY_TTL_MS = 24 * 3_600_000;
const TRX_ID = /^[A-Z0-9]{8,12}$/;
/** Customer-facing channels only. Staff keying in a phone order for a regular customer is not limited. */
const CUSTOMER_CHANNELS = new Set(["STOREFRONT", "LANDING_PAGE", "WHATSAPP_BOT", "MESSENGER_BOT"]);
const MAX_ORDERS_PER_PHONE_PER_DAY = 3;

export interface PlacedOrder {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  replayed: boolean;
}

/**
 * Places an order. Everything runs in one tenant-scoped transaction, so a failure at any step
 * (stock, coupon, duplicate TrxID) rolls the whole order back, including the stock and coupon counters.
 * Client prices are never read: totals are computed here from the database.
 */
export async function createOrder(tenantId: string, rawInput: unknown): Promise<PlacedOrder> {
  const parsed = CreateOrderInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid order", { issues: parsed.error.issues });
  }
  const input = parsed.data;
  const phone = normalizeBdPhone(input.customer.phone);

  try {
    const { placed, usage } = await withTenant(tenantId, async (tx) => {
      await assertTakesOrders(tx);
      const p = await place(tx, tenantId, input, phone);
      // A replay is not a new order, so it does not count against the plan.
      const u = p.replayed ? null : await recordOrderUsage(tx, tenantId);
      return { placed: p, usage: u };
    });
    if (!placed.replayed) {
      await notifyOrder(tenantId, placed.orderId, "ORDER_RECEIVED");
      await publishEvent("order/created", { tenantId, orderId: placed.orderId, orderNumber: placed.orderNumber, totalAmount: placed.totalAmount });
      for (const percent of usage?.crossed ?? ([] as OrderThreshold[])) {
        await publishEvent("usage/threshold-crossed", { tenantId, metric: "orders", percent, used: usage!.used, limit: usage!.limit! });
      }
    }
    return placed;
  } catch (e) {
    // Two requests with the same key raced past the existence check; the loser hits the unique index. If no
    // order exists for the key the conflict was something else, so it is rethrown below.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await withTenant(tenantId, (tx) => findByKey(tx, input.idempotencyKey));
      if (existing) return existing;
    }
    throw e;
  }
}

async function findByKey(tx: TenantTx, key: string): Promise<PlacedOrder | null> {
  const o = await tx.order.findFirst({ where: { idempotencyKey: key } });
  return o ? { orderId: o.id, orderNumber: o.orderNumber, totalAmount: Number(o.totalAmount), replayed: true } : null;
}

async function place(tx: TenantTx, tenantId: string, input: ReturnType<typeof CreateOrderInput.parse>, phone: string): Promise<PlacedOrder> {
  const replay = await findByKey(tx, input.idempotencyKey);
  if (replay) return replay;

  // Blocked customers. Same vague error either way.
  const blocked = await tx.blockedContact.findFirst({ where: { phone } });
  const existingCustomer = await tx.customer.findFirst({ where: { phone } });
  if (blocked || existingCustomer?.isBlacklisted) throw new BlockedCustomerError();

  // Doc 07: at most 3 orders per phone number per day from the storefront. Stops one number flooding a store with fake orders.
  if (CUSTOMER_CHANNELS.has(input.channel)) {
    const today = await tx.order.count({ where: { customerPhone: phone, status: { not: "CANCELLED" }, createdAt: { gt: new Date(Date.now() - 24 * 3_600_000) } } });
    if (today >= MAX_ORDERS_PER_PHONE_PER_DAY) throw new OrderRateLimitError();
  }

  // Store rules (AdmPayments): paused store, payment methods the owner switched off, cash on delivery limits.
  const settings = await tx.storeSettings.findFirst();
  const customerFacing = CUSTOMER_CHANNELS.has(input.channel);
  if (customerFacing && settings?.ordersPaused) throw new StorePausedError();
  if (customerFacing && settings) {
    if (input.paymentMethod === "COD" && !settings.codEnabled) throw new PaymentMethodUnavailableError("Cash on delivery is not available. Please choose another way to pay.");
    if (input.paymentMethod === "MANUAL_BKASH" && (!settings.bkashEnabled || !settings.bkashNumber)) throw new PaymentMethodUnavailableError("bKash is not available. Please choose another way to pay.");
    if (input.paymentMethod === "MANUAL_NAGAD" && (!settings.nagadEnabled || !settings.nagadNumber)) throw new PaymentMethodUnavailableError("Nagad is not available. Please choose another way to pay.");
  }

  // Lines: merge duplicates, load from the database. RLS hides other tenants' variants, so a foreign id is just "not found".
  const wanted = new Map<string, number>();
  for (const l of input.items) wanted.set(l.variantId, (wanted.get(l.variantId) ?? 0) + l.quantity);
  const variantIds = [...wanted.keys()].sort();
  const variants = await tx.productVariant.findMany({ where: { id: { in: variantIds } }, include: { product: true } });
  if (variants.length !== variantIds.length || variants.some((v) => v.product.status !== "ACTIVE" || v.product.deletedAt)) {
    throw new ValidationError("One of the items is no longer available");
  }

  // Reserve stock atomically, in a stable order so concurrent orders cannot deadlock each other.
  for (const id of variantIds) {
    const qty = wanted.get(id)!;
    const n = await tx.$executeRaw`UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" - ${qty}, "updatedAt" = now() WHERE "id" = ${id} AND "stockQuantity" >= ${qty}`;
    if (n === 0) {
      const v = variants.find((x) => x.id === id)!;
      throw new InsufficientStockError(`Only ${Math.max(v.stockQuantity, 0)} left of ${v.product.title}`, id, Math.max(v.stockQuantity, 0));
    }
  }

  const lines = variantIds.map((id) => {
    const v = variants.find((x) => x.id === id)!;
    const quantity = wanted.get(id)!;
    const unitPrice = Number(v.price);
    return { v, quantity, unitPrice, totalPrice: money(unitPrice * quantity) };
  });
  const subtotal = money(lines.reduce((s, l) => s + l.totalPrice, 0));

  // Delivery zone: exact district match first, then the catch-all "*" zone.
  const zones = await tx.shippingZone.findMany();
  const district = input.shipping.district.trim().toLowerCase();
  const zone = pickZone(zones, district);
  if (!zone) throw new ValidationError("We do not deliver to that district yet", { field: "district" });
  let deliveryCharge = deliveryFor(zone, subtotal);

  // Coupon: validated, then usage claimed atomically so the limit holds under concurrency.
  let discount = 0;
  let couponId: string | null = null;
  let couponCode: string | null = null;
  if (input.couponCode) {
    const code = input.couponCode.toUpperCase();
    const c = await tx.coupon.findFirst({ where: { code } });
    assertCouponUsable(c, subtotal);
    const used = await tx.order.count({ where: { customerPhone: phone, couponId: c.id, status: { not: "CANCELLED" } } });
    if (used >= c.perCustomerLimit) throw new CouponError("You have already used this coupon");
    const claimed = await tx.$executeRaw`UPDATE "Coupon" SET "usageCount" = "usageCount" + 1 WHERE "id" = ${c.id} AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit")`;
    if (claimed === 0) throw new CouponError("This coupon has been fully claimed");
    const applied = discountFor(c, subtotal);
    discount = applied.discount;
    if (applied.freeShipping) deliveryCharge = 0;
    couponId = c.id;
    couponCode = c.code;
  }
  // Loyalty (docs/26): the VIP discount, a friend's first-order discount, and points spent. Priced here, in the same transaction.
  const loyalty = await priceLoyalty(tx, { phone, verifiedCustomerId: input.verifiedCustomerId, subtotal, couponDiscount: discount, redeemPoints: input.redeemPoints, referralCode: input.referralCode });
  if ((input.redeemPoints ?? 0) > 0 && loyalty.pointsError) throw new ValidationError(loyalty.pointsError, { field: "points" });
  if (input.referralCode && loyalty.referralError) throw new ValidationError(loyalty.referralError, { field: "referral" });
  if (loyalty.referral && (await referralAddressClash(tx, loyalty.referral.customerId, input.shipping.address, input.shipping.district))) {
    throw new ValidationError("The referral offer is for a new customer at a new address.", { field: "referral" });
  }
  // A friend ordering from the very same connection as the person who invited them is not a new customer.
  if (loyalty.referral && input.clientHash && (await tx.order.findFirst({ where: { customerId: loyalty.referral.customerId, clientHash: input.clientHash, createdAt: { gt: new Date(Date.now() - 90 * 86_400_000) } }, select: { id: true } }))) {
    throw new ValidationError("The referral offer cannot be used from the same connection as the person who invited you.", { field: "referral" });
  }
  // A landing page's deal (bundle price, order bump), already worked out from database prices by placeLandingOrder; it can never exceed what is left to pay for the goods.
  const offerDiscount = money(Math.min(input.offerDiscount ?? 0, Math.max(0, subtotal - discount - loyalty.tierDiscount - loyalty.referralDiscount - loyalty.pointsDiscount)));
  discount = money(discount + offerDiscount);
  const couponWaives = couponId != null && deliveryCharge === 0 && zone != null && deliveryFor(zone, subtotal) > 0;
  if (loyalty.freeDelivery) deliveryCharge = 0;
  const deliveryWaived = loyalty.freeDelivery || couponWaives;
  const memberDiscount = money(loyalty.tierDiscount + loyalty.referralDiscount + loyalty.pointsDiscount);
  const codFee = input.paymentMethod === "COD" && settings ? Number(settings.codFee) : 0;
  if (input.paymentMethod === "COD" && customerFacing && settings?.codMaxAmount != null && money(subtotal - discount - memberDiscount + deliveryCharge + codFee) > Number(settings.codMaxAmount)) {
    throw new PaymentMethodUnavailableError(`Cash on delivery is available up to ৳${Number(settings.codMaxAmount)}. Please pay with bKash or Nagad.`);
  }
  const total = money(subtotal - discount - memberDiscount + deliveryCharge + codFee);

  // Manual mobile-money payment: needs a TrxID, and a TrxID can only back one order. Staff recording money they
  // already received (quick order desk) may leave it out.
  let mfs: { sender: string; trx: string } | null = null;
  const staffPaid = Boolean(input.alreadyPaid) && !customerFacing;
  if (input.paymentMethod !== "COD" && !(staffPaid && !input.mfs)) {
    if (!input.mfs) throw new ValidationError("Enter the sender number and transaction ID", { field: "mfs" });
    const trx = input.mfs.trxId.trim().toUpperCase();
    if (!TRX_ID.test(trx)) throw new ValidationError("That transaction ID does not look right", { field: "trxId" });
    const sender = normalizeBdPhone(input.mfs.senderNumber);
    if (await tx.order.findFirst({ where: { mfsTrxId: trx } })) {
      throw new ValidationError("That transaction ID has already been used", { field: "trxId" });
    }
    mfs = { sender, trx };
  }

  // Atomic per-tenant order number. Never count() rows.
  const [counter] = await tx.$queryRaw<{ orderPrefix: string; n: number }[]>`
    UPDATE "Tenant" SET "nextOrderNumber" = "nextOrderNumber" + 1 WHERE "id" = ${tenantId}
    RETURNING "orderPrefix", ("nextOrderNumber" - 1)::int AS n`;
  if (!counter) throw new NotFoundError("Store");
  const orderNumber = `${counter.orderPrefix}${counter.n}`;

  // Atomic upsert: two first-time orders from the same phone must not race on the unique index.
  const [customer] = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO "Customer" ("id", "tenantId", "name", "phone", "email", "totalOrders", "updatedAt")
    VALUES (${randomUUID()}, ${tenantId}, ${input.customer.name}, ${phone}, ${input.customer.email ?? null}, 1, now())
    ON CONFLICT ("tenantId", "phone") DO UPDATE
      SET "name" = EXCLUDED."name", "totalOrders" = "Customer"."totalOrders" + 1, "updatedAt" = now()
    RETURNING "id"`;
  if (!customer) throw new NotFoundError("Customer");

  const fraud = await assessOrderRisk(tx, {
    phone, paymentMethod: input.paymentMethod, total, address: input.shipping.address, district: input.shipping.district, customerFacing,
  });
  const order = await tx.order.create({
    data: {
      tenantId, orderNumber, idempotencyKey: input.idempotencyKey, customerId: customer.id,
      customerName: input.customer.name, customerPhone: phone, customerEmail: input.customer.email,
      shippingAddress: input.shipping.address, shippingCity: input.shipping.city,
      shippingDistrict: input.shipping.district, shippingDivision: input.shipping.division,
      shippingPostalCode: input.shipping.postalCode, deliveryZone: zone.name,
      paymentMethod: input.paymentMethod,
      paymentStatus: staffPaid && input.paymentMethod !== "COD" ? "PAID" : mfs ? "PENDING_VERIFICATION" : "UNPAID",
      ...(staffPaid && input.paymentMethod !== "COD" ? { mfsVerifiedAt: new Date(), mfsVerifiedBy: input.createdByUserId } : {}),
      subtotalAmount: subtotal, deliveryCharge, codFee, discountAmount: discount, totalAmount: total,
      couponId, couponCode,
      tierDiscountBdt: loyalty.tierDiscount, referralDiscountBdt: loyalty.referralDiscount, referralCode: loyalty.referral?.code,
      loyaltyPointsUsed: loyalty.pointsUsed, loyaltyDiscountBdt: loyalty.pointsDiscount, deliveryWaived, clientHash: input.clientHash,
      mfsSenderNumber: mfs?.sender, mfsTrxId: mfs?.trx,
      fraudRiskLevel: fraud.level, fraudTrustScore: fraud.score, fraudFlags: fraud.flags, fraudReview: fraud.hold ? "HELD" : null,
      channel: input.channel, createdByUserId: input.createdByUserId,
      utmSource: input.utmSource, utmCampaign: input.utmCampaign, utmMedium: input.utmMedium, landingPageId: input.landingPageId, notes: input.notes,
      items: {
        create: lines.map((l) => ({
          tenantId, productId: l.v.productId, variantId: l.v.id, productTitle: l.v.product.title,
          variantTitle: l.v.title, sku: l.v.sku, unitPrice: l.unitPrice, unitCost: l.v.product.costPrice, quantity: l.quantity, totalPrice: l.totalPrice,
        })),
      },
      stateLogs: { create: { tenantId, fromStatus: "PENDING", toStatus: "PENDING", actorType: "CUSTOMER", reason: "Order placed" } },
    },
  });

  // Points taken, the pending earn written, the referral recorded: all inside this order's transaction.
  const applied = await recordAtOrder(tx, { tenantId, orderId: order.id, orderNumber, customerId: customer.id, customerName: input.customer.name, phone, address: input.shipping.address, district: input.shipping.district, subtotal, couponDiscount: discount, pricing: loyalty });
  if (applied.pointsSpentConflict) throw new ValidationError("Those points were just used on another order. Please try again.", { field: "points" });
  // Gold and Platinum members' orders are packed first.
  if (applied.tier === "GOLD" || applied.tier === "PLATINUM") await tx.order.update({ where: { id: order.id }, data: { priorityPacking: true } });

  // Whoever placed it, a checkout this number left behind is recovered.
  await markRecoveredByOrder(tx, phone, order.id);

  const byStaff = !customerFacing;
  await recordOrderEvent(tx, tenantId, order.id, {
    type: "PLACED",
    message: byStaff ? `Order keyed in by ${input.createdByName ?? "staff"} (${input.channel.replace("QUICK_", "").toLowerCase()})` : "Order placed by customer",
    actor: byStaff ? { id: input.createdByUserId, name: input.createdByName ?? "Staff" } : { name: "Customer" },
    data: { channel: input.channel },
  });
  if (fraud.hold) {
    await recordOrderEvent(tx, tenantId, order.id, {
      type: "FRAUD", message: `Held for review: this number has a low delivery success rate (score ${fraud.score}). Call the customer before packing.`,
      actor: { name: "System" }, data: { score: fraud.score, flags: fraud.flags },
    });
  }
  if (mfs) {
    await recordOrderEvent(tx, tenantId, order.id, {
      type: staffPaid ? "PAYMENT_VERIFIED" : "PAYMENT_SUBMITTED",
      message: staffPaid ? `${input.paymentMethod === "MANUAL_BKASH" ? "bKash" : "Nagad"} payment recorded, TrxID ${mfs.trx}` : `${input.paymentMethod === "MANUAL_BKASH" ? "bKash" : "Nagad"} TrxID submitted: ${mfs.trx}`,
      actor: byStaff ? { id: input.createdByUserId, name: input.createdByName ?? "Staff" } : { name: "Customer" },
      data: { trxId: mfs.trx, sender: mfs.sender },
    });
  } else if (staffPaid && input.paymentMethod !== "COD") {
    await recordOrderEvent(tx, tenantId, order.id, { type: "PAYMENT_VERIFIED", message: "Payment already received (recorded when the order was keyed in)", actor: { id: input.createdByUserId, name: input.createdByName ?? "Staff" } });
  }

  await tx.idempotencyRecord.create({
    data: {
      tenantId, idempotencyKey: input.idempotencyKey, statusCode: 201,
      responseJson: { orderId: order.id }, expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
    },
  });

  return { orderId: order.id, orderNumber, totalAmount: total, replayed: false };
}

export interface Actor {
  type: "MERCHANT" | "CUSTOMER" | "COURIER_WEBHOOK" | "SYSTEM_CRON";
  id?: string;
  /** For the order timeline. */
  name?: string;
}

const STATUS_WORDS: Record<OrderStatus, string> = {
  PENDING: "new", CONFIRMED: "confirmed", PROCESSING: "being packed", SHIPPED: "shipped", DELIVERED: "delivered", CANCELLED: "cancelled", RETURNED: "returned", REFUNDED: "refunded",
};

/** Moves an order along the state machine. Locks the row, restocks on cancel/return, keeps customer totals right. */
export async function transitionOrder(tenantId: string, orderId: string, to: OrderStatus, actor: Actor, reason?: string, opts: { refused?: boolean } = {}) {
  const notices: Notice[] = [];
  const updated = await withTenant(tenantId, async (tx) => {
    const rows = await tx.$queryRaw<{ status: OrderStatus }[]>`SELECT "status" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const current = rows[0];
    if (!current) throw new NotFoundError("Order");
    assertTransition(current.status, to);

    const order = await tx.order.findFirstOrThrow({ where: { id: orderId }, include: { items: true } });

    if (RESTOCKS_ON.includes(to)) {
      const restock = new Map<string, number>();
      for (const i of order.items) if (i.variantId) restock.set(i.variantId, (restock.get(i.variantId) ?? 0) + i.quantity);
      for (const id of [...restock.keys()].sort()) {
        const qty = restock.get(id)!;
        await tx.$executeRaw`UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" + ${qty}, "updatedAt" = now() WHERE "id" = ${id}`;
      }
    }
    if (to === "CANCELLED" && order.couponId) {
      await tx.$executeRaw`UPDATE "Coupon" SET "usageCount" = GREATEST("usageCount" - 1, 0) WHERE "id" = ${order.couponId}`;
    }
    if (order.customerId) {
      if (to === "DELIVERED") {
        await tx.customer.update({ where: { id: order.customerId }, data: { totalSpent: { increment: order.totalAmount } } });
      } else if (current.status === "DELIVERED" && to === "RETURNED") {
        await tx.customer.update({ where: { id: order.customerId }, data: { totalSpent: { decrement: order.totalAmount } } });
      }
    }

    const now = new Date();
    const data: Prisma.OrderUncheckedUpdateInput = { status: to };
    let outcome: TrustKind | null = null;
    if (to === "DELIVERED") {
      const cash = order.paymentMethod === "COD";
      const viaCourier = order.courierProvider === "STEADFAST" || order.courierProvider === "PATHAO" || order.courierProvider === "REDX";
      data.deliveredAt = now;
      // Cash on delivery: whoever delivered it collected the money. Only a courier parcel leaves cash waiting to be paid out.
      if (cash && order.paymentStatus === "UNPAID") data.paymentStatus = "PAID";
      data.settlementStatus = cash && viaCourier && order.paymentStatus !== "PAID" ? "COLLECTED_UNSETTLED" : "SETTLED";
      outcome = "DELIVERED";
    } else if (to === "RETURNED") {
      data.returnedAt = now;
      data.refusedAtDoor = Boolean(opts.refused);
      outcome = opts.refused ? "REFUSED" : "RETURNED";
    }
    if (outcome) {
      // One outcome per order, corrected in place if a delivered parcel later comes back. Hashes only leave this store.
      await recordOutcome(tx, tenantId, orderId, order.customerPhone, outcome, now);
      data.trustRecorded = outcome;
    }
    const updated = await tx.order.update({ where: { id: orderId }, data });
    // Points and tiers follow the parcel (docs/26): unlock on delivery, give back or take back on cancel and return.
    if (to === "DELIVERED") notices.push(...(await onDelivered(tx, tenantId, orderId, now)));
    else if (to === "CANCELLED" || (to === "RETURNED" && current.status !== "DELIVERED")) await onCancelled(tx, orderId);
    else if (current.status === "DELIVERED" && (to === "RETURNED" || to === "REFUNDED")) await onReturned(tx, orderId, now);
    await tx.orderStateLog.create({
      data: { tenantId, orderId, fromStatus: current.status, toStatus: to, actorType: actor.type, actorId: actor.id, reason },
    });
    await recordOrderEvent(tx, tenantId, orderId, {
      type: "STATUS", message: `Order ${STATUS_WORDS[to]}${reason ? `: ${reason}` : ""}`,
      actor: { id: actor.id, name: actor.name ?? (actor.type === "CUSTOMER" ? "Customer" : actor.type === "MERCHANT" ? "Staff" : "System") },
      data: { from: current.status, to },
    });
    return updated;
  });
  // Messages go out after the change is saved; a failed message never undoes a delivery.
  await sendNotices(tenantId, notices);
  const told = to === "SHIPPED" ? "ORDER_SHIPPED" : to === "DELIVERED" ? "DELIVERED" : to === "CANCELLED" ? "ORDER_CANCELLED" : null;
  if (told) await notifyOrder(tenantId, orderId, told);
  if (to === "CANCELLED" || to === "RETURNED" || to === "REFUNDED") {
    sendServerCancellation(tenantId, orderId, reason ?? `Order ${to}`).catch(() => undefined);
  }
  return updated;
}

/** Staff confirm a manual bKash/Nagad/Rocket payment (or cash received). */
export async function markPaid(tenantId: string, orderId: string, actorId: string, staff?: StaffActor) {
  if (staff) assertCan(staff, "orders", "edit");
  let changed = false;
  const result = await withTenant(tenantId, async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId } });
    if (!order) throw new NotFoundError("Order");
    if (order.status === "CANCELLED" || order.status === "REFUNDED") throw new ValidationError("A closed order cannot be marked paid");
    if (order.paymentStatus === "PAID") return order;
    if (order.paymentStatus !== "PENDING_VERIFICATION" && order.paymentStatus !== "UNPAID") {
      throw new ValidationError(`A ${order.paymentStatus.toLowerCase()} order cannot be marked paid`);
    }
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: "PAID", mfsVerifiedAt: new Date(), mfsVerifiedBy: actorId },
    });
    if (staff) await audit(tx, tenantId, staff, "order.marked_paid", { orderNumber: order.orderNumber, method: order.paymentMethod, trxId: order.mfsTrxId });
    await recordOrderEvent(tx, tenantId, orderId, {
      type: "PAYMENT_VERIFIED", message: order.mfsTrxId ? `Payment confirmed (TrxID ${order.mfsTrxId})` : "Marked as paid",
      actor: { id: actorId, name: staff?.email ?? "Staff" }, data: { trxId: order.mfsTrxId },
    });
    changed = true;
    return updated;
  });
  if (changed) await notifyOrder(tenantId, orderId, "PAYMENT_CONFIRMED");
  return result;
}
