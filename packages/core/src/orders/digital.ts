import { withTenant, type TenantTx } from "@biztrackbd/db";
import { createOrderDownloadToken } from "./download";
import { sendCustomerDigitalDeliveryEmail } from "../mail/send";
import { currentSmsSender } from "../customers/auth";

export interface DigitalPaymentResult {
  status: "DELIVERED" | "CONFIRMED";
  autoDelivered: boolean;
}

/**
 * Handles digital order completion inside an active database transaction when payment is confirmed.
 * - For instant digital products: marks items as delivered and auto-transitions the order to DELIVERED.
 * - For on-demand digital products: transitions the order to CONFIRMED (ready for merchant asset delivery).
 */
export async function handleDigitalOrderPaymentSuccess(
  tx: TenantTx,
  tenantId: string,
  orderId: string
): Promise<DigitalPaymentResult> {
  const order = await tx.order.findFirst({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return { status: "CONFIRMED", autoDelivered: false };

  if (!order.isDigital) {
    return { status: "CONFIRMED", autoDelivered: false };
  }

  // 1. Auto-deliver all instant digital items
  await tx.orderItem.updateMany({
    where: { orderId, isDigital: true, digitalDeliveryUrl: { not: null }, digitalDeliveredAt: null },
    data: { digitalDeliveredAt: new Date() },
  });

  // 2. Count remaining undelivered items (e.g. ON_DEMAND awaiting manual merchant upload)
  const undeliveredCount = await tx.orderItem.count({
    where: { orderId, isDigital: true, digitalDeliveredAt: null },
  });

  const now = new Date();
  if (undeliveredCount === 0) {
    // All items are delivered: complete the order immediately
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "DELIVERED",
        deliveredAt: now,
      },
    });

    await tx.orderStateLog.create({
      data: {
        tenantId,
        orderId,
        fromStatus: order.status,
        toStatus: "DELIVERED",
        actorType: "SYSTEM",
        reason: "Digital product auto-delivered upon payment",
      },
    });

    return { status: "DELIVERED", autoDelivered: true };
  } else {
    // On-demand items waiting for merchant file upload: auto-confirm so merchant can deliver asset
    if (order.status === "PENDING") {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "CONFIRMED",
        },
      });

      await tx.orderStateLog.create({
        data: {
          tenantId,
          orderId,
          fromStatus: order.status,
          toStatus: "CONFIRMED",
          actorType: "SYSTEM",
          reason: "Digital order auto-confirmed upon payment (awaiting asset preparation)",
        },
      });
    }

    return { status: "CONFIRMED", autoDelivered: false };
  }
}

/**
 * Dispatches email and SMS notifications with access/download links to the customer.
 */
export async function dispatchDigitalOrderDeliveryNotifications(
  tenantId: string,
  orderId: string,
  specificItemId?: string
): Promise<void> {
  try {
    await withTenant(tenantId, async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId },
        include: {
          items: {
            where: specificItemId
              ? { id: specificItemId }
              : { isDigital: true, digitalDeliveredAt: { not: null } },
          },
        },
      });
      if (!order || !order.isDigital || order.items.length === 0) return;

      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, subdomain: true },
      });
      const storeName = tenant?.name || tenant?.subdomain || "Store";
      const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || (process.env.NODE_ENV === "production" ? "biztrack.bd" : "localhost:3000");
      const baseUrl = `https://${tenant?.subdomain}.${rootDomain}`;

      for (const item of order.items) {
        const token = createOrderDownloadToken(tenantId, orderId, item.id);
        const fullDownloadUrl = `${baseUrl}/d/${token}`;

        if (order.customerEmail) {
          try {
            await sendCustomerDigitalDeliveryEmail({
              to: order.customerEmail,
              orderNumber: order.orderNumber,
              storeName,
              customerName: order.customerName,
              productTitle: item.productTitle,
              downloadUrl: fullDownloadUrl,
            });
          } catch (err) {
            console.warn("[digital-delivery] Email failed:", err);
          }
        }

        if (order.customerPhone) {
          try {
            const smsMsg = `আপনার অর্ডার #${order.orderNumber} (${item.productTitle}) এর ডিজিটাল ফাইল প্রস্তুত হয়েছে। ডাউনলোড করুন: ${fullDownloadUrl} - ${storeName}`;
            await currentSmsSender().send("platform", order.customerPhone, smsMsg);
          } catch (err) {
            console.warn("[digital-delivery] SMS failed:", err);
          }
        }
      }
    });
  } catch (err) {
    console.error("[dispatchDigitalOrderDeliveryNotifications] error:", err);
  }
}
