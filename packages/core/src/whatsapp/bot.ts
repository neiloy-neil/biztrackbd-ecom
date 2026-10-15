import { withTenant, type OrderStatus, type WhatsAppConversationStatus } from "@biztrackbd/db";
import { recordOrderEvent } from "../admin/order-events";
import { formatWhatsAppPhone } from "./deep-links";
import { sendWhatsAppNotification } from "./service";

export interface BotProcessResult {
  action: "ORDER_CONFIRMED" | "ORDER_CANCELLED" | "STATUS_INQUIRY" | "ESCALATED_TO_STAFF" | "BOT_REPLIED";
  orderId?: string;
  replyText?: string;
}

/**
 * Handles inbound WhatsApp messages received from customers.
 * Performs NLP intent classification:
 * 1. "1" / "Confirm" -> Auto-confirms latest pending COD order.
 * 2. "2" / "Cancel" -> Auto-cancels order and atomically restocks variant inventory.
 * 3. "Status" / "Tracking" -> Looks up courier tracking details and replies.
 * 4. General query -> Routes conversation into merchant /inbox.
 */
export async function processInboundWhatsAppMessage(
  tenantId: string,
  payload: {
    from: string;
    body: string;
    messageId?: string;
  }
): Promise<BotProcessResult> {
  const formattedPhone = formatWhatsAppPhone(payload.from);
  const text = payload.body.trim();
  const lower = text.toLowerCase();
  const phoneSuffix = formattedPhone.slice(-10);

  return withTenant(tenantId, async (tx) => {
    // 1. Fetch store settings and WhatsApp configuration
    const config = await tx.whatsAppConfig.findUnique({
      where: { tenantId },
    });
    const settings = await tx.storeSettings.findFirst({
      select: { storeName: true },
    });
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, locale: true },
    });
    const storeName = settings?.storeName || tenant?.name || "Store";
    const isBn = tenant?.locale?.startsWith("bn") ?? true;

    // 2. Identify or link customer
    const customer = await tx.customer.findFirst({
      where: {
        tenantId,
        phone: { contains: phoneSuffix },
      },
    });

    // 3. Upsert WhatsApp Conversation thread
    const conversation = await tx.whatsAppConversation.upsert({
      where: {
        tenantId_customerPhone: {
          tenantId,
          customerPhone: formattedPhone,
        },
      },
      create: {
        tenantId,
        customerPhone: formattedPhone,
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? null,
        status: "BOT_HANDLED",
        unreadCount: 1,
        lastMessageText: text,
        lastMessageAt: new Date(),
      },
      update: {
        customerId: customer?.id ?? undefined,
        customerName: customer?.name ?? undefined,
        unreadCount: { increment: 1 },
        lastMessageText: text,
        lastMessageAt: new Date(),
      },
    });

    // 4. Record inbound message log and chat message
    await tx.whatsAppChatMessage.create({
      data: {
        conversationId: conversation.id,
        tenantId,
        sender: "CUSTOMER",
        body: text,
        externalMsgId: payload.messageId || null,
      },
    });

    await tx.whatsAppMessageLog.create({
      data: {
        tenantId,
        phone: formattedPhone,
        direction: "INBOUND",
        status: "DELIVERED",
        messageBody: text,
        externalMsgId: payload.messageId || null,
        deliveredAt: new Date(),
      },
    });

    // 5. Bot Handoff & Auto-Pause: If bot is disabled in store config, paused on this thread, or in OPEN human handling
    const isBotPaused = conversation.botPausedUntil && conversation.botPausedUntil > new Date();
    if ((config && !config.botEnabled) || isBotPaused || conversation.status === "OPEN") {
      await tx.whatsAppConversation.update({
        where: { id: conversation.id },
        data: { status: "OPEN" },
      });
      return { action: "ESCALATED_TO_STAFF" };
    }

    // 5. Intent: COD Order Confirmation ("1", "confirm", "yes", "হ্যাঁ", "হা", "কনফার্ম")
    const isConfirmIntent =
      lower === "1" ||
      lower === "confirm" ||
      lower === "yes" ||
      lower === "y" ||
      text === "হ্যাঁ" ||
      text === "হা" ||
      text.includes("কনফার্ম");

    if (isConfirmIntent) {
      const pendingOrder = await tx.order.findFirst({
        where: {
          tenantId,
          customerPhone: { contains: phoneSuffix },
          status: "PENDING",
        },
        orderBy: { createdAt: "desc" },
      });

      if (pendingOrder) {
        // Move to CONFIRMED
        await tx.order.update({
          where: { id: pendingOrder.id },
          data: { status: "CONFIRMED" },
        });

        await tx.orderStateLog.create({
          data: {
            tenantId,
            orderId: pendingOrder.id,
            fromStatus: "PENDING",
            toStatus: "CONFIRMED",
            actorType: "CUSTOMER",
            reason: `Customer confirmed via WhatsApp Bot (Reply: "${text}")`,
          },
        });

        await recordOrderEvent(tx, tenantId, pendingOrder.id, {
          type: "STATUS",
          message: `Order confirmed via WhatsApp Bot (Reply: "${text}")`,
          actor: { name: "WhatsApp Bot" },
        });

        const reply = isBn
          ? `ধন্যবাদ! আপনার অর্ডার *#${pendingOrder.orderNumber}* কনফার্ম করা হয়েছে।\nশীঘ্রই পার্সেল প্রস্তুত করে কুরিয়ারে পাঠানো হবে।`
          : `Thank you! Your order *#${pendingOrder.orderNumber}* has been confirmed.\nWe are packaging your items for dispatch.`;

        // Send reply and log chat
        await tx.whatsAppChatMessage.create({
          data: {
            conversationId: conversation.id,
            tenantId,
            sender: "BOT",
            body: reply,
          },
        });

        await sendWhatsAppNotification(tenantId, {
          phone: formattedPhone,
          orderId: pendingOrder.id,
          body: reply,
          fallbackToSms: false,
        });

        return {
          action: "ORDER_CONFIRMED",
          orderId: pendingOrder.id,
          replyText: reply,
        };
      }
    }

    // 6. Intent: COD Order Cancellation ("2", "cancel", "no", "বাতিল", "না")
    const isCancelIntent =
      lower === "2" ||
      lower === "cancel" ||
      lower === "no" ||
      lower === "n" ||
      text === "না" ||
      text.includes("বাতিল");

    if (isCancelIntent) {
      const pendingOrder = await tx.order.findFirst({
        where: {
          tenantId,
          customerPhone: { contains: phoneSuffix },
          status: "PENDING",
        },
        orderBy: { createdAt: "desc" },
      });

      if (pendingOrder) {
        // Move to CANCELLED
        await tx.order.update({
          where: { id: pendingOrder.id },
          data: { status: "CANCELLED" },
        });

        // Restock inventory atomically
        const items = await tx.orderItem.findMany({
          where: { orderId: pendingOrder.id },
        });

        for (const item of items) {
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stockQuantity: { increment: item.quantity } },
            });
          }
        }

        await tx.orderStateLog.create({
          data: {
            tenantId,
            orderId: pendingOrder.id,
            fromStatus: "PENDING",
            toStatus: "CANCELLED",
            actorType: "CUSTOMER",
            reason: `Customer cancelled via WhatsApp Bot (Reply: "${text}") - Stock restocked atomically`,
          },
        });

        await recordOrderEvent(tx, tenantId, pendingOrder.id, {
          type: "STATUS",
          message: `Order cancelled via WhatsApp Bot (Reply: "${text}") - Variant stock auto-restocked`,
          actor: { name: "WhatsApp Bot" },
        });

        const reply = isBn
          ? `আপনার অর্ডার *#${pendingOrder.orderNumber}* বাতিল করা হয়েছে এবং পণ্যের স্টক রিস্টক করা হয়েছে। পরবর্তীতে আবার আপনার সেবা করার অপেক্ষায় রইলাম। - *${storeName}*`
          : `Your order *#${pendingOrder.orderNumber}* has been cancelled. We hope to serve you again in the future! - *${storeName}*`;

        await tx.whatsAppChatMessage.create({
          data: {
            conversationId: conversation.id,
            tenantId,
            sender: "BOT",
            body: reply,
          },
        });

        await sendWhatsAppNotification(tenantId, {
          phone: formattedPhone,
          orderId: pendingOrder.id,
          body: reply,
          fallbackToSms: false,
        });

        return {
          action: "ORDER_CANCELLED",
          orderId: pendingOrder.id,
          replyText: reply,
        };
      }
    }

    // 7. Intent: Order Status & Tracking Inquiry
    const isStatusIntent =
      lower.includes("status") ||
      lower.includes("track") ||
      lower.includes("parcel") ||
      lower.includes("kothay") ||
      text.includes("অবস্থা") ||
      text.includes("পার্সেল") ||
      text.includes("কোথায়");

    if (isStatusIntent) {
      const activeOrder = await tx.order.findFirst({
        where: {
          tenantId,
          customerPhone: { contains: phoneSuffix },
          status: { in: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (activeOrder) {
        let reply = "";
        const trackingUrl = activeOrder.courierTrackingUrl;
        const trackingCode = activeOrder.trackingCode;
        const courier = activeOrder.courierProvider || "Courier";

        if (activeOrder.status === "SHIPPED") {
          reply = isBn
            ? `আপনার অর্ডার *#${activeOrder.orderNumber}* ডেলিভারির পথে রয়েছে!\nকুরিয়ার: *${courier}*\n` +
              (trackingCode ? `ট্র্যাকিং কোড: *${trackingCode}*\n` : "") +
              (trackingUrl ? `ট্র্যাকিং লিংক: ${trackingUrl}\n` : "")
            : `Your order *#${activeOrder.orderNumber}* is in transit!\nCourier: *${courier}*\n` +
              (trackingCode ? `Tracking Code: *${trackingCode}*\n` : "") +
              (trackingUrl ? `Track: ${trackingUrl}\n` : "");
        } else if (activeOrder.status === "DELIVERED") {
          reply = isBn
            ? `আপনার অর্ডার *#${activeOrder.orderNumber}* ইতিমধ্যে ডেলিভারি সম্পন্ন হয়েছে।`
            : `Your order *#${activeOrder.orderNumber}* has been successfully delivered!`;
        } else {
          reply = isBn
            ? `আপনার অর্ডার *#${activeOrder.orderNumber}* বর্তমানে *${activeOrder.status}* অবস্থায় রয়েছে। পার্সেল প্রস্তুত করে দ্রুত পাঠানো হবে।`
            : `Your order *#${activeOrder.orderNumber}* is currently *${activeOrder.status}*. We are preparing it for shipment.`;
        }

        await tx.whatsAppChatMessage.create({
          data: {
            conversationId: conversation.id,
            tenantId,
            sender: "BOT",
            body: reply,
          },
        });

        await sendWhatsAppNotification(tenantId, {
          phone: formattedPhone,
          orderId: activeOrder.id,
          body: reply,
          fallbackToSms: false,
        });

        return {
          action: "STATUS_INQUIRY",
          orderId: activeOrder.id,
          replyText: reply,
        };
      }
    }

    // 8. Default: Escalate to human support inbox
    await tx.whatsAppConversation.update({
      where: { id: conversation.id },
      data: { status: "OPEN" },
    });

    return {
      action: "ESCALATED_TO_STAFF",
    };
  });
}

/**
 * Lists WhatsApp conversations for the unified merchant support desk (/inbox).
 */
export async function listWhatsAppConversations(
  tenantId: string,
  options?: {
    status?: WhatsAppConversationStatus;
    assignedUserId?: string | null;
    search?: string;
    limit?: number;
    offset?: number;
  }
) {
  const limit = options?.limit ?? 30;
  const offset = options?.offset ?? 0;

  return withTenant(tenantId, async (tx) => {
    const where = {
      tenantId,
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.assignedUserId !== undefined
        ? { assignedUserId: options.assignedUserId }
        : {}),
      ...(options?.search
        ? {
            OR: [
              { customerPhone: { contains: options.search } },
              { customerName: { contains: options.search, mode: "insensitive" as const } },
              { lastMessageText: { contains: options.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, conversations] = await Promise.all([
      tx.whatsAppConversation.count({ where }),
      tx.whatsAppConversation.findMany({
        where,
        orderBy: { lastMessageAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          assignedUser: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              totalOrders: true,
              totalSpent: true,
            },
          },
        },
      }),
    ]);

    return { total, conversations, limit, offset };
  });
}

/**
 * Fetches an individual conversation thread with full chat history and customer context.
 */
export async function getWhatsAppConversation(
  tenantId: string,
  conversationId: string
) {
  return withTenant(tenantId, async (tx) => {
    const conversation = await tx.whatsAppConversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        customer: {
          include: {
            orders: {
              take: 5,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                orderNumber: true,
                status: true,
                totalAmount: true,
                advancePaidAmount: true,
                balanceDue: true,
                createdAt: true,
                courierProvider: true,
                trackingCode: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 100,
        },
      },
    });

    if (!conversation) return null;

    // Reset unread counter
    if (conversation.unreadCount > 0) {
      await tx.whatsAppConversation.update({
        where: { id: conversationId },
        data: { unreadCount: 0 },
      });
    }

    return conversation;
  });
}

/**
 * Sends a manual staff reply from the /inbox desk.
 */
export async function sendStaffWhatsAppReply(
  tenantId: string,
  conversationId: string,
  staffUserId: string,
  body: string
) {
  const text = body.trim();
  if (!text) throw new Error("Reply message cannot be empty");

  return withTenant(tenantId, async (tx) => {
    const conversation = await tx.whatsAppConversation.findFirst({
      where: { id: conversationId, tenantId },
    });
    if (!conversation) throw new Error("Conversation not found");

    // Create staff chat message
    const chatMsg = await tx.whatsAppChatMessage.create({
      data: {
        conversationId,
        tenantId,
        sender: "STAFF",
        staffUserId,
        body: text,
      },
    });

    // Update conversation state: auto-pause bot for 24h & auto-assign if unassigned
    const pauseUntil = new Date(Date.now() + 24 * 3600 * 1000);
    await tx.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageText: text,
        lastMessageAt: new Date(),
        status: "RESOLVED",
        botPausedUntil: pauseUntil,
        assignedUserId: conversation.assignedUserId || staffUserId,
      },
    });

    // Dispatch WhatsApp message
    await sendWhatsAppNotification(tenantId, {
      phone: conversation.customerPhone,
      body: text,
      fallbackToSms: false,
    });

    return chatMsg;
  });
}

/**
 * Updates conversation status (e.g. mark OPEN or RESOLVED).
 */
export async function setWhatsAppConversationStatus(
  tenantId: string,
  conversationId: string,
  status: WhatsAppConversationStatus
) {
  return withTenant(tenantId, async (tx) => {
    return tx.whatsAppConversation.updateMany({
      where: { id: conversationId, tenantId },
      data: { status },
    });
  });
}

/**
 * Assigns or reassigns a conversation to a staff user (or unassigns with null).
 */
export async function assignWhatsAppConversation(
  tenantId: string,
  conversationId: string,
  staffUserId: string | null
) {
  return withTenant(tenantId, async (tx) => {
    const pauseUntil = staffUserId ? new Date(Date.now() + 24 * 3600 * 1000) : undefined;
    return tx.whatsAppConversation.update({
      where: { id: conversationId, tenantId },
      data: {
        assignedUserId: staffUserId,
        ...(staffUserId ? { status: "OPEN", botPausedUntil: pauseUntil } : {}),
      },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  });
}

/**
 * Manually pauses or resumes the WhatsApp bot for an individual conversation thread.
 */
export async function setWhatsAppBotPause(
  tenantId: string,
  conversationId: string,
  isPaused: boolean
) {
  return withTenant(tenantId, async (tx) => {
    const pauseUntil = isPaused ? new Date(Date.now() + 24 * 3600 * 1000) : null;
    return tx.whatsAppConversation.update({
      where: { id: conversationId, tenantId },
      data: {
        botPausedUntil: pauseUntil,
        status: isPaused ? "OPEN" : "BOT_HANDLED",
      },
    });
  });
}

/**
 * Lists active staff members for conversation assignment.
 */
export async function listTenantStaffUsers(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    return tx.tenantUser.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });
  });
}
