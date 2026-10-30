import { getPlatformPrisma } from "@biztrackbd/db";

export interface RegisterDeviceInput {
  appType: "STORE_MANAGER" | "PLATFORM_ADMIN";
  tenantId?: string | null;
  userId: string;
  pushToken: string;
  platform?: string;
  deviceModel?: string;
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string | null;
  priority?: "default" | "normal" | "high";
  channelId?: string;
  badge?: number;
}

/**
 * Registers or updates a device's push notification token in the database.
 */
export async function registerDeviceToken(input: RegisterDeviceInput): Promise<void> {
  if (!input.pushToken || !input.pushToken.trim()) return;

  const db = getPlatformPrisma();
  const token = input.pushToken.trim();

  await db.mobileDeviceToken.upsert({
    where: { pushToken: token },
    create: {
      appType: input.appType,
      tenantId: input.tenantId || null,
      userId: input.userId,
      pushToken: token,
      platform: input.platform || "android",
      deviceModel: input.deviceModel || null,
      lastActiveAt: new Date(),
    },
    update: {
      appType: input.appType,
      tenantId: input.tenantId || null,
      userId: input.userId,
      platform: input.platform || "android",
      deviceModel: input.deviceModel || null,
      lastActiveAt: new Date(),
    },
  });
}

/**
 * Unregisters a push token upon user sign-out.
 */
export async function unregisterDeviceToken(pushToken: string): Promise<void> {
  if (!pushToken) return;
  const db = getPlatformPrisma();
  await db.mobileDeviceToken.deleteMany({
    where: { pushToken },
  }).catch(() => {});
}

/**
 * Sends push notifications to a list of Expo push tokens via the Expo Push API.
 */
export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  if (!messages || messages.length === 0) return;

  // Filter valid ExponentPushToken formats
  const validMessages = messages.filter(
    (m) => m.to && (m.to.startsWith("ExponentPushToken[") || m.to.startsWith("ExpoPushToken["))
  );

  if (validMessages.length === 0) return;

  // Expo recommends chunks of up to 100 messages
  const chunkSize = 100;
  for (let i = 0; i < validMessages.length; i += chunkSize) {
    const chunk = validMessages.slice(i, i + chunkSize);
    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
    } catch (err) {
      console.error("[Expo Push Send Error]", err);
    }
  }
}

/**
 * Dispatches an instant high-priority "Cha-Ching" notification to all registered merchant devices for an order.
 */
export async function notifyStoreOrder(
  tenantId: string,
  order: {
    orderId?: string;
    orderNumber: string;
    totalAmount: number;
    paymentMethod: string;
    customerName: string;
  }
): Promise<void> {
  const db = getPlatformPrisma();

  const devices = await db.mobileDeviceToken.findMany({
    where: {
      tenantId,
      appType: "STORE_MANAGER",
    },
    select: { pushToken: true },
  });

  if (devices.length === 0) return;

  const paymentDesc =
    order.paymentMethod === "COD"
      ? "ক্যাশ অন ডেলিভারি"
      : order.paymentMethod.includes("BKASH")
      ? "বিকাশ পেমেন্ট"
      : order.paymentMethod.includes("NAGAD")
      ? "নগদ পেমেন্ট"
      : "অনলাইন পেমেন্ট";

  const messages: ExpoPushMessage[] = devices.map((d) => ({
    to: d.pushToken,
    title: `🔔 নতুন অর্ডার #${order.orderNumber} (৳${order.totalAmount.toLocaleString("en-BD")})`,
    body: `${order.customerName} • ${paymentDesc}. বিস্তারিত দেখতে ট্যাপ করুন।`,
    sound: "default",
    priority: "high",
    channelId: "orders-high-priority",
    data: {
      type: "ORDER_CREATED",
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      tab: "unconfirmed",
    },
  }));

  await sendExpoPush(messages);
}

/**
 * Dispatches an alert when a customer submits a manual bKash/Nagad TrxID for verification.
 */
export async function notifyStorePaymentVerification(
  tenantId: string,
  verification: {
    orderNumber: string;
    trxId: string;
    amount: number;
    senderNumber?: string;
  }
): Promise<void> {
  const db = getPlatformPrisma();

  const devices = await db.mobileDeviceToken.findMany({
    where: {
      tenantId,
      appType: "STORE_MANAGER",
    },
    select: { pushToken: true },
  });

  if (devices.length === 0) return;

  const messages: ExpoPushMessage[] = devices.map((d) => ({
    to: d.pushToken,
    title: `⚠️ বিকাশ/নগদ ভেরিফিকেশন বাকি #${verification.orderNumber}`,
    body: `TrxID: ${verification.trxId} (৳${verification.amount.toLocaleString("en-BD")}). চেক করে অর্ডার নিশ্চিত করুন।`,
    sound: "default",
    priority: "high",
    channelId: "orders-high-priority",
    data: {
      type: "PAYMENT_VERIFY",
      orderNumber: verification.orderNumber,
      tab: "unconfirmed",
    },
  }));

  await sendExpoPush(messages);
}

export type PlatformPushEventType =
  | "TENANT_SIGNUP"
  | "PAYMENT_APPROVAL"
  | "SUBSCRIPTION_APPROVAL"
  | "CRITICAL_INCIDENT"
  | "SUPPORT_TICKET";

export interface PlatformPushEvent {
  type: PlatformPushEventType;
  title: string;
  body: string;
  channelId?: string;
  data?: Record<string, unknown>;
}

/**
 * Dispatches high-priority alerts to Platform Super Admins (tenant signups, subscription payment waiting, critical incidents).
 */
export async function notifyPlatformSuperAdmins(event: PlatformPushEvent): Promise<void> {
  const db = getPlatformPrisma();

  const devices = await db.mobileDeviceToken.findMany({
    where: {
      appType: "PLATFORM_ADMIN",
    },
    select: { pushToken: true },
  });

  if (devices.length === 0) return;

  const channelId =
    event.channelId ||
    (event.type === "CRITICAL_INCIDENT"
      ? "platform-critical-alerts"
      : event.type === "TENANT_SIGNUP"
      ? "platform-signups"
      : "platform-approvals");

  const messages: ExpoPushMessage[] = devices.map((d) => ({
    to: d.pushToken,
    title: event.title,
    body: event.body,
    sound: "default",
    priority: "high",
    channelId,
    data: {
      type: event.type,
      ...(event.data || {}),
    },
  }));

  await sendExpoPush(messages);
}

/**
 * Dispatches instant notification to Platform Super Admins when a new merchant / store signs up.
 */
export async function notifyPlatformTenantSignup(tenant: {
  tenantId: string;
  subdomain: string;
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  plan: string;
  category?: string;
  cameFrom?: string;
}): Promise<void> {
  await notifyPlatformSuperAdmins({
    type: "TENANT_SIGNUP",
    title: `🏪 নতুন স্টোর সাইনআপ: ${tenant.storeName}`,
    body: `${tenant.ownerName} (${tenant.ownerPhone}) • ${tenant.subdomain}.biztrack.bd • প্ল্যান: ${tenant.plan}`,
    channelId: "platform-signups",
    data: {
      type: "TENANT_SIGNUP",
      tenantId: tenant.tenantId,
      subdomain: tenant.subdomain,
      storeName: tenant.storeName,
      ownerName: tenant.ownerName,
      ownerPhone: tenant.ownerPhone,
      ownerEmail: tenant.ownerEmail,
      plan: tenant.plan,
    },
  });
}
