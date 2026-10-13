import type { TenantTx } from "@biztrackbd/db";
import { withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { InsufficientStockError, NotFoundError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { deliveryFor, discountFor, money, pickZone } from "../orders/pricing";
import { recordOrderEvent } from "./order-events";

const actorName = (a: StaffActor) => a.name ?? a.email;

/** One line of the order as the owner wants it to be. A line that already exists is named by `itemId`; a new one has none. */
export interface WantedLine {
  itemId?: string;
  variantId: string;
  quantity: number;
}

/** What the order can be changed to: the lines now, and the other sizes or colours of each product, with what is in stock. */
export interface EditableOrder {
  editable: boolean;
  /** When it cannot be changed, why, in words for the owner. */
  reason: string | null;
  lines: { itemId: string; productId: string; productTitle: string; variantId: string; variantTitle: string; quantity: number; unitPrice: number; options: { variantId: string; title: string; stock: number; price: number }[] }[];
}

const GONE = "An item on this order has been removed from your catalogue, so its stock cannot be put back. Cancel it and key in a new order.";
const EDITABLE_STATUS = ["PENDING", "CONFIRMED", "PROCESSING"];

/** Why an order cannot have its items changed, or null if it can. Used by the screen and again by the change itself. */
function whyLocked(o: { status: string; courierBookedAt: Date | null; consignmentId: string | null; loyaltyPointsUsed: number; referralDiscountBdt: unknown; landingPageId: string | null }): string | null {
  if (!EDITABLE_STATUS.includes(o.status)) return "Items can only be changed before the order ships.";
  if (o.consignmentId || o.courierBookedAt) return "A courier has already been booked for this parcel. Items can only be changed before booking.";
  if (o.loyaltyPointsUsed > 0) return "The customer paid part of this order with reward points. Cancel it and key in a new order instead.";
  if (Number(o.referralDiscountBdt) > 0) return "This order used a friend's first-order offer. Cancel it and key in a new order instead.";
  if (o.landingPageId) return "This order came from a landing page deal. Cancel it and key in a new order instead.";
  return null;
}

export async function getEditableOrder(tenantId: string, actor: StaffActor, orderId: string): Promise<EditableOrder> {
  assertCan(actor, "orders", "view");
  return withTenant(tenantId, async (tx) => {
    const o = await tx.order.findFirst({ where: { id: orderId } });
    if (!o) throw new NotFoundError("Order");
    const items = await tx.orderItem.findMany({ where: { orderId }, orderBy: { id: "asc" } });
    const gone = items.some((i) => !i.variantId);
    const variants = await tx.productVariant.findMany({ where: { productId: { in: [...new Set(items.map((i) => i.productId))] } }, orderBy: { createdAt: "asc" } });
    return {
      editable: !gone && whyLocked(o) === null, reason: gone ? GONE : whyLocked(o),
      lines: items.map((i) => ({
        itemId: i.id, productId: i.productId, productTitle: i.productTitle, variantId: i.variantId ?? "", variantTitle: i.variantTitle ?? "", quantity: i.quantity, unitPrice: Number(i.unitPrice),
        options: variants.filter((v) => v.productId === i.productId).map((v) => ({ variantId: v.id, title: v.title, stock: v.stockQuantity, price: Number(v.price) })),
      })),
    };
  });
}

/**
 * Changes what is in an open order: a different size or colour, a different quantity, an item removed, an item added.
 * Stock follows (what comes off the order goes back on the shelf, what is added is taken, atomically), the subtotal, the
 * coupon, the delivery charge and the total are worked out again with the checkout rules, and the timeline says what changed.
 *
 * Refused when a courier is booked, when the order is past packing, or when it used reward points, a friend's offer or a
 * landing-page deal (those cannot be re-priced fairly). Refused too when the customer has already paid or sent a TrxID and the
 * total would change: the owner cancels it and keys in a new order, so the money always matches.
 */
export async function editOrderItems(tenantId: string, actor: StaffActor, orderId: string, wanted: WantedLine[]): Promise<{ total: number; changed: boolean }> {
  assertCan(actor, "orders", "edit");
  if (wanted.length === 0) throw new ValidationError("An order needs at least one item. To remove everything, cancel the order.");
  if (wanted.length > 30) throw new ValidationError("Too many lines");
  for (const w of wanted) if (!Number.isInteger(w.quantity) || w.quantity < 1 || w.quantity > 50) throw new ValidationError("Each quantity must be between 1 and 50");

  return withTenant(tenantId, async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    if (locked.length === 0) throw new NotFoundError("Order");
    const o = await tx.order.findFirstOrThrow({ where: { id: orderId } });
    const lock = whyLocked(o);
    if (lock) throw new ValidationError(lock);

    const old = await tx.orderItem.findMany({ where: { orderId } });
    if (old.some((i) => !i.variantId)) throw new ValidationError(GONE);
    const oldById = new Map(old.map((i) => [i.id, i]));
    for (const w of wanted) if (w.itemId && !oldById.has(w.itemId)) throw new ValidationError("That line is no longer on the order. Reload and try again.");
    if (new Set(wanted.filter((w) => w.itemId).map((w) => w.itemId)).size !== wanted.filter((w) => w.itemId).length) throw new ValidationError("A line was listed twice");

    const variantIds = [...new Set([...wanted.map((w) => w.variantId), ...old.map((i) => i.variantId!)])].sort();
    const variants = await tx.productVariant.findMany({ where: { id: { in: variantIds } }, include: { product: true } });
    const variant = new Map(variants.map((v) => [v.id, v]));
    for (const w of wanted) {
      const v = variant.get(w.variantId);
      if (!v) throw new ValidationError("One of the items does not exist any more");
      const stays = w.itemId && oldById.get(w.itemId)!.variantId === w.variantId;
      if (!stays && (v.product.status !== "ACTIVE" || v.product.deletedAt)) throw new ValidationError(`${v.product.title} is not on sale any more`);
    }

    // Stock: the difference per variant, taken or given back in a stable order so two edits cannot deadlock each other.
    const delta = new Map<string, number>();
    for (const i of old) delta.set(i.variantId!, (delta.get(i.variantId!) ?? 0) - i.quantity);
    for (const w of wanted) delta.set(w.variantId, (delta.get(w.variantId) ?? 0) + w.quantity);
    for (const id of [...delta.keys()].sort()) {
      const d = delta.get(id)!;
      if (d > 0) {
        const n = await tx.$executeRaw`UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" - ${d}, "updatedAt" = now() WHERE "id" = ${id} AND "stockQuantity" >= ${d}`;
        if (n === 0) {
          const v = variant.get(id)!;
          throw new InsufficientStockError(`Only ${Math.max(v.stockQuantity, 0)} left of ${v.product.title}`, id, Math.max(v.stockQuantity, 0));
        }
      } else if (d < 0) {
        await tx.$executeRaw`UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" + ${-d}, "updatedAt" = now() WHERE "id" = ${id}`;
      }
    }

    // Lines. A line whose variant did not change keeps the price the customer saw; a new size, colour or product is at today's price.
    const keep = new Set(wanted.filter((w) => w.itemId).map((w) => w.itemId!));
    const summary: string[] = [];
    for (const i of old) if (!keep.has(i.id)) { await tx.orderItem.delete({ where: { id: i.id } }); summary.push(`removed ${i.productTitle}${i.variantTitle ? ` (${i.variantTitle})` : ""}`); }
    let subtotal = 0;
    for (const w of wanted) {
      const prev = w.itemId ? oldById.get(w.itemId) : undefined;
      const v = variant.get(w.variantId)!;
      if (prev && prev.variantId === w.variantId) {
        const total = money(Number(prev.unitPrice) * w.quantity);
        subtotal += total;
        if (prev.quantity !== w.quantity) {
          await tx.orderItem.update({ where: { id: prev.id }, data: { quantity: w.quantity, totalPrice: total } });
          summary.push(`${prev.productTitle}${prev.variantTitle ? ` (${prev.variantTitle})` : ""} ${prev.quantity} to ${w.quantity}`);
        }
      } else {
        const unit = Number(v.price);
        const total = money(unit * w.quantity);
        subtotal += total;
        if (prev) await tx.orderItem.delete({ where: { id: prev.id } });
        await tx.orderItem.create({
          data: { tenantId, orderId, productId: v.productId, variantId: v.id, productTitle: v.product.title, variantTitle: v.title, sku: v.sku, unitPrice: unit, unitCost: v.product.costPrice, quantity: w.quantity, totalPrice: total },
        });
        summary.push(prev ? `${prev.productTitle}${prev.variantTitle ? ` (${prev.variantTitle})` : ""} changed to ${v.title === "Default" ? v.product.title : `${v.product.title} (${v.title})`} × ${w.quantity}` : `added ${v.product.title}${v.title === "Default" ? "" : ` (${v.title})`} × ${w.quantity}`);
      }
    }
    subtotal = money(subtotal);
    if (summary.length === 0) return { total: Number(o.totalAmount), changed: false };

    // Price it again with the checkout's rules.
    const oldSubtotal = Number(o.subtotalAmount);
    let discount = Number(o.discountAmount);
    if (o.couponId) {
      const c = await tx.coupon.findFirst({ where: { id: o.couponId } });
      if (c) {
        if (subtotal < Number(c.minOrderValue)) throw new ValidationError(`Coupon ${o.couponCode} needs at least ৳${Number(c.minOrderValue)}. Remove it by cancelling and keying in a new order, or keep the cart above that amount.`);
        discount = discountFor(c, subtotal).discount;
      }
    }
    const tier = oldSubtotal > 0 ? money(Number(o.tierDiscountBdt) * (subtotal / oldSubtotal)) : 0;
    let delivery = Number(o.deliveryCharge);
    if (!o.deliveryWaived) {
      const zone = pickZone(await tx.shippingZone.findMany(), o.shippingDistrict);
      if (zone) delivery = deliveryFor(zone, subtotal);
    }
    const total = money(Math.max(0, subtotal - discount - tier) + delivery + Number(o.codFee));
    if ((o.paymentStatus === "PAID" || o.paymentStatus === "PENDING_VERIFICATION") && total !== Number(o.totalAmount)) {
      throw new ValidationError(`The customer has already paid or sent a TrxID for ৳${Number(o.totalAmount)} and this change makes the total ৳${total}. Cancel it and key in a new order so the money matches.`);
    }
    await tx.order.update({ where: { id: orderId }, data: { subtotalAmount: subtotal, discountAmount: discount, tierDiscountBdt: tier, deliveryCharge: delivery, totalAmount: total } });
    await rescaleEarn(tx, orderId, o.orderNumber, oldSubtotal, Number(o.discountAmount), Number(o.tierDiscountBdt), subtotal, discount, tier);

    await recordOrderEvent(tx, tenantId, orderId, {
      type: "ITEMS_CHANGED", message: `Items changed: ${summary.join("; ")}${total !== Number(o.totalAmount) ? `. Total ৳${Number(o.totalAmount)} to ৳${total}` : ""}`,
      actor: { id: actor.userId, name: actorName(actor) }, data: { before: old.map((i) => ({ v: i.variantId, q: i.quantity })), after: wanted.map((w) => ({ v: w.variantId, q: w.quantity })), total },
    });
    await audit(tx, tenantId, actor, "order.items_changed", { orderNumber: o.orderNumber, lines: wanted.length, total });
    return { total, changed: true };
  });
}

/** The points an order will earn follow what the customer actually pays for the goods. Scaled by the same ratio, never below zero. */
async function rescaleEarn(tx: TenantTx, orderId: string, orderNumber: string, oldSub: number, oldDisc: number, oldTier: number, newSub: number, newDisc: number, newTier: number): Promise<void> {
  const earn = await tx.loyaltyTransaction.findFirst({ where: { orderId, type: "EARN_PURCHASE", status: "PENDING" } });
  if (!earn) return;
  const oldNet = Math.max(oldSub - oldDisc - oldTier, 0);
  const newNet = Math.max(newSub - newDisc - newTier, 0);
  const pts = oldNet > 0 ? Math.max(Math.round(earn.points * (newNet / oldNet)), 0) : 0;
  if (pts === earn.points) return;
  await tx.loyaltyTransaction.update({ where: { id: earn.id }, data: { points: pts, amountBdt: money(newNet), description: `Earned on order ${orderNumber}, unlocks when it is delivered` } });
  await tx.$executeRaw`UPDATE "CustomerLoyaltyAccount" SET "pendingPoints" = GREATEST("pendingPoints" + ${pts - earn.points}, 0), "updatedAt" = now() WHERE "id" = ${earn.accountId}`;
}
