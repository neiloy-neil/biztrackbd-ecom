import { withTenant } from "@biztrackbd/db";
import { recordOrderEvent } from "../admin/order-events";
import { sendStaffWhatsAppReply } from "./bot";

/**
 * 1-Click order confirmation from Support Desk.
 * Updates order status to CONFIRMED, logs state transition, and dispatches confirmation WhatsApp message.
 */
export async function quickConfirmOrderFromDesk(
  tenantId: string,
  conversationId: string,
  orderId: string,
  staffUserId: string
) {
  return withTenant(tenantId, async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, tenantId },
    });
    if (!order) throw new Error("Order not found");

    if (order.status !== "PENDING") {
      throw new Error(`Order #${order.orderNumber} is already ${order.status}`);
    }

    // 1. Update order status
    await tx.order.update({
      where: { id: order.id },
      data: { status: "CONFIRMED" },
    });

    // 2. Audit log
    await tx.orderStateLog.create({
      data: {
        tenantId,
        orderId: order.id,
        fromStatus: "PENDING",
        toStatus: "CONFIRMED",
        actorType: "STAFF",
        reason: "Customer confirmed via Live WhatsApp Support Desk",
      },
    });

    await recordOrderEvent(tx, tenantId, order.id, {
      type: "STATUS",
      message: `Order marked as Confirmed by Support Agent`,
      actor: { name: "Support Staff" },
    });

    // 3. Post confirmation message into conversation
    const replyBody = `ধন্যবাদ! আপনার অর্ডার *#${order.orderNumber}* সফলভাবে কনফার্ম করা হয়েছে।\nশীঘ্রই পার্সেল প্রস্তুত করে কুরিয়ারে হ্যান্ডওভার করা হবে।`;

    return sendStaffWhatsAppReply(tenantId, conversationId, staffUserId, replyBody);
  });
}

/**
 * 1-Click dispatch of courier tracking information to WhatsApp customer.
 */
export async function sendOrderTrackingFromDesk(
  tenantId: string,
  conversationId: string,
  orderId: string,
  staffUserId: string
) {
  return withTenant(tenantId, async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, tenantId },
    });
    if (!order) throw new Error("Order not found");

    const courier = order.courierProvider || "কুরিয়ার";
    const tracking = order.trackingCode;

    let replyBody = "";
    if (tracking) {
      replyBody = `আপনার অর্ডার *#${order.orderNumber}* সংক্রান্ত আপডেট:\nকুরিয়ার: *${courier}*\nট্র্যাকিং কোড: *${tracking}*\n\nকুরিয়ারের ওয়েবসাইট বা ট্র্যাকিং লিংক থেকে বর্তমান স্ট্যাটাস জানতে পারবেন। যেকোনো প্রয়োজনে আমাদের জানান!`;
    } else {
      replyBody = `আপনার অর্ডার *#${order.orderNumber}* বর্তমানে *${order.status}* অবস্থায় রয়েছে। কুরিয়ারে হ্যান্ডওভারের সাথে সাথেই আমরা আপনাকে ট্র্যাকিং কোড জানিয়ে দেব।`;
    }

    return sendStaffWhatsAppReply(tenantId, conversationId, staffUserId, replyBody);
  });
}

/**
 * 1-Click dispatch of payment/bKash details or checkout reminder.
 */
export async function sendOrderPaymentDetailsFromDesk(
  tenantId: string,
  conversationId: string,
  orderId: string,
  staffUserId: string
) {
  return withTenant(tenantId, async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        tenant: {
          include: {
            storeSettings: true,
          },
        },
      },
    });
    if (!order) throw new Error("Order not found");

    const total = Number(order.totalAmount).toLocaleString("en-IN");
    const due = Number(order.balanceDue) > 0 ? Number(order.balanceDue).toLocaleString("en-IN") : total;

    const replyBody = `আপনার অর্ডার *#${order.orderNumber}* এর পেমেন্ট সংক্রান্ত তথ্য:\nমোট প্রদেয়: *৳ ${due}*\n\nবিকাশ/নগদ এর মাধ্যমে পেমেন্ট করতে রেফারেন্সে অর্ডার নম্বর *${order.orderNumber}* উল্লেখ করুন এবং পেমেন্ট শেষে TrxID টি আমাদের এখানে জানিয়ে দিন। ধন্যবাদ!`;

    return sendStaffWhatsAppReply(tenantId, conversationId, staffUserId, replyBody);
  });
}
