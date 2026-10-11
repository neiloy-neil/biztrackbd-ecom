import { withTenant, type OrderStatus } from "@biztrackbd/db";
import { NotFoundError } from "../errors";
import { verifyOrderAccess } from "../customers/auth";

export interface MilestoneStage {
  id: "PLACED" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED";
  label: string;
  labelBn: string;
  date: Date | null;
  completed: boolean;
  current: boolean;
}

export interface TrackingCheckpoint {
  id: string;
  time: Date;
  title: string;
  titleBn: string;
  source: "COURIER" | "SYSTEM" | "SHOP";
  note?: string;
  hub?: string;
}

export interface OrderTrackingTimeline {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  isDelivered: boolean;
  isCancelled: boolean;
  isReturned: boolean;
  stages: MilestoneStage[];
  currentStageIndex: number;
  courier: {
    provider: string | null;
    consignmentId: string | null;
    trackingCode: string | null;
    trackingUrl: string | null;
    courierStatus: string | null;
    courierStatusAt: Date | null;
  } | null;
  checkpoints: TrackingCheckpoint[];
}

export function buildCourierTrackingUrl(
  provider: string | null | undefined,
  trackingCode: string | null | undefined,
  consignmentId: string | null | undefined,
  storedUrl?: string | null,
): string | null {
  if (storedUrl && storedUrl.startsWith("http")) return storedUrl;
  const code = trackingCode || consignmentId;
  if (!provider || !code) return null;
  const p = provider.toUpperCase();
  if (p === "STEADFAST") return `https://steadfast.com.bd/t/${encodeURIComponent(code)}`;
  if (p === "REDX") return `https://redx.com.bd/track-global-parcel/?trackingId=${encodeURIComponent(code)}`;
  if (p === "PATHAO" && consignmentId) return `https://merchant.pathao.com/tracking?consignment_id=${encodeURIComponent(consignmentId)}`;
  return null;
}

function normalizeCourierCheckpoint(e: {
  id: string;
  status: string | null;
  createdAt: Date;
  payload: unknown;
  provider: string;
}): TrackingCheckpoint | null {
  const s = (e.status ?? "").toUpperCase();
  const payload = (e.payload && typeof e.payload === "object" ? e.payload : {}) as Record<string, unknown>;
  const rawMsg = typeof payload.message === "string" ? payload.message : typeof payload.status === "string" ? payload.status : undefined;

  let title = "Courier status update";
  let titleBn = "কুরিয়ার স্ট্যাটাস আপডেট";

  if (s === "BOOKED" || s === "IN_REVIEW") {
    title = "Parcel registered with courier";
    titleBn = "কুরিয়ারে পার্সেল বুকিং হয়েছে";
  } else if (s === "PICKED_UP" || s === "PICKED") {
    title = "Parcel picked up by courier rider";
    titleBn = "কুরিয়ার পার্সেল সংগ্রহ করেছে";
  } else if (s === "IN_TRANSIT") {
    title = "Parcel in transit to destination hub";
    titleBn = "পার্সেল গন্তব্যের উদ্দেশ্যে রওনা হয়েছে";
  } else if (s === "OUT_FOR_DELIVERY") {
    title = "Out for delivery with rider";
    titleBn = "ডেলিভারি রাইডার নিয়ে বের হয়েছেন";
  } else if (s === "DELIVERED") {
    title = "Parcel successfully delivered to customer";
    titleBn = "পার্সেল সফলভাবে ডেলিভারি করা হয়েছে";
  } else if (s === "HOLD") {
    title = "Delivery on hold (customer requested time / unreachable)";
    titleBn = "ডেলিভারি সাময়িক স্থগিত (গ্রাহক অনুরোধ বা যোগাযোগ করা যায়নি)";
  } else if (s === "RETURNED" || s === "CANCELLED") {
    title = "Parcel returning to merchant";
    titleBn = "পার্সেল মার্চেন্টের কাছে ফেরত আসছে";
  } else if (s === "REFUSED") {
    title = "Customer refused parcel at door";
    titleBn = "গ্রাহক পার্সেল গ্রহণ করেননি";
  }

  return {
    id: e.id,
    time: e.createdAt,
    title,
    titleBn,
    source: "COURIER",
    note: rawMsg,
  };
}

export async function getOrderTrackingTimeline(
  tenantId: string,
  orderId: string,
  auth: { customerId?: string | null; token?: string | null },
): Promise<OrderTrackingTimeline> {
  return withTenant(tenantId, async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId },
      include: {
        stateLogs: { orderBy: { createdAt: "asc" } },
        events: {
          where: { type: { in: ["PLACED", "STATUS", "COURIER_BOOKED", "COURIER_STATUS"] } },
          orderBy: { createdAt: "asc" },
        },
        courierEvents: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!order) throw new NotFoundError("Order");

    const hasAccess = verifyOrderAccess(tenantId, orderId, auth.token) || (auth.customerId && order.customerId === auth.customerId);
    if (!hasAccess) throw new NotFoundError("Order");

    const statusOrder: OrderStatus[] = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];
    const isCancelled = order.status === "CANCELLED";
    const isReturned = order.status === "RETURNED";
    const isDelivered = order.status === "DELIVERED";

    const logByStatus = new Map<OrderStatus, Date>();
    logByStatus.set("PENDING", order.createdAt);
    for (const log of order.stateLogs) {
      if (!logByStatus.has(log.toStatus)) {
        logByStatus.set(log.toStatus, log.createdAt);
      }
    }
    if (order.deliveredAt && !logByStatus.has("DELIVERED")) {
      logByStatus.set("DELIVERED", order.deliveredAt);
    }
    if (order.courierBookedAt && !logByStatus.has("SHIPPED")) {
      logByStatus.set("SHIPPED", order.courierBookedAt);
    }

    const currentStatusIdx = statusOrder.indexOf(order.status);
    let activeMilestoneIdx = 0;
    if (isDelivered) activeMilestoneIdx = 4;
    else if (order.status === "SHIPPED") activeMilestoneIdx = 3;
    else if (order.status === "PROCESSING") activeMilestoneIdx = 2;
    else if (order.status === "CONFIRMED") activeMilestoneIdx = 1;
    else if (order.status === "PENDING") activeMilestoneIdx = 0;
    else if (isCancelled || isReturned) {
      activeMilestoneIdx = Math.max(0, currentStatusIdx >= 0 ? currentStatusIdx : 0);
    }

    const stages: MilestoneStage[] = [
      {
        id: "PLACED",
        label: "Order Placed",
        labelBn: "অর্ডার গৃহীত হয়েছে",
        date: logByStatus.get("PENDING") ?? order.createdAt,
        completed: true,
        current: activeMilestoneIdx === 0,
      },
      {
        id: "CONFIRMED",
        label: "Confirmed",
        labelBn: "অর্ডার নিশ্চিত করা হয়েছে",
        date: logByStatus.get("CONFIRMED") ?? null,
        completed: activeMilestoneIdx >= 1 || (currentStatusIdx >= 1 && !isCancelled),
        current: activeMilestoneIdx === 1,
      },
      {
        id: "PROCESSING",
        label: "Packaging & Quality Check",
        labelBn: "প্যাকেজিং ও প্রস্তুতি চলছে",
        date: logByStatus.get("PROCESSING") ?? null,
        completed: activeMilestoneIdx >= 2 || (currentStatusIdx >= 2 && !isCancelled),
        current: activeMilestoneIdx === 2,
      },
      {
        id: "SHIPPED",
        label: "Handed to Courier",
        labelBn: "কুরিয়ারে হস্তান্তর করা হয়েছে",
        date: logByStatus.get("SHIPPED") ?? null,
        completed: activeMilestoneIdx >= 3 || (currentStatusIdx >= 3 && !isCancelled),
        current: activeMilestoneIdx === 3,
      },
      {
        id: "DELIVERED",
        label: "Delivered",
        labelBn: "ডেলিভারি সম্পন্ন",
        date: logByStatus.get("DELIVERED") ?? order.deliveredAt,
        completed: isDelivered,
        current: activeMilestoneIdx === 4,
      },
    ];

    const trackingUrl = buildCourierTrackingUrl(order.courierProvider, order.trackingCode, order.consignmentId, order.courierTrackingUrl);

    // Build chronological checkpoints
    const checkpoints: TrackingCheckpoint[] = [];

    // Add state logs as checkpoints
    for (const log of order.stateLogs) {
      let title = `Status changed to ${log.toStatus}`;
      let titleBn = `স্ট্যাটাস পরিবর্তন: ${log.toStatus}`;
      if (log.toStatus === "CONFIRMED") {
        title = "Order verified and confirmed";
        titleBn = "অর্ডার যাচাই ও নিশ্চিত করা হয়েছে";
      } else if (log.toStatus === "PROCESSING") {
        title = "Items packed and prepared for shipping";
        titleBn = "পণ্য প্যাকেজিং সম্পন্ন";
      } else if (log.toStatus === "SHIPPED") {
        title = `Parcel dispatched via ${order.courierProvider ?? "Courier"}`;
        titleBn = `${order.courierProvider ?? "কুরিয়ার"}-এর মাধ্যমে পাঠানো হয়েছে`;
      } else if (log.toStatus === "DELIVERED") {
        title = "Order delivered to recipient";
        titleBn = "গ্রাহকের কাছে পণ্য হস্তান্তর করা হয়েছে";
      } else if (log.toStatus === "CANCELLED") {
        title = "Order was cancelled";
        titleBn = "অর্ডারটি বাতিল করা হয়েছে";
      }

      checkpoints.push({
        id: `state-${log.id}`,
        time: log.createdAt,
        title,
        titleBn,
        source: log.actorType === "COURIER_WEBHOOK" ? "COURIER" : "SHOP",
        note: log.reason ?? undefined,
      });
    }

    // Add CourierEvent entries
    for (const ev of order.courierEvents) {
      const parsed = normalizeCourierCheckpoint(ev);
      if (parsed) checkpoints.push(parsed);
    }

    // Sort checkpoints descending by time (newest first)
    checkpoints.sort((a, b) => b.time.getTime() - a.time.getTime());

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      isDelivered,
      isCancelled,
      isReturned,
      stages,
      currentStageIndex: activeMilestoneIdx,
      courier: order.courierProvider || order.trackingCode || order.consignmentId ? {
        provider: order.courierProvider,
        consignmentId: order.consignmentId,
        trackingCode: order.trackingCode,
        trackingUrl,
        courierStatus: order.courierStatus,
        courierStatusAt: order.courierStatusAt,
      } : null,
      checkpoints,
    };
  });
}
