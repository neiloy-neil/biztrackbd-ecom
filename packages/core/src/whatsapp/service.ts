import { withTenant } from "@biztrackbd/db";
import { currentSmsSender } from "../customers/auth";
import { formatWhatsAppPhone } from "./deep-links";
import type {
  WhatsAppEventType,
  WhatsAppEventInfo,
  WhatsAppConfigView,
  WhatsAppTemplateView,
  WhatsAppVar,
  WhatsAppSendParams,
  WhatsAppSendResult,
} from "./types";

export const WHATSAPP_EVENTS: WhatsAppEventInfo[] = [
  {
    event: "COD_CONFIRMATION",
    label: "COD Order Confirmation",
    description: "Sent immediately when a Cash on Delivery order is placed to verify customer intent",
    defaultEn:
      "Hi {customer_name}, thanks for ordering from *{store_name}*! Your order *#{order_number}* total is *{order_total}* (Cash on Delivery).\n\nReply *1* to CONFIRM your order.\nReply *2* to CANCEL.",
    defaultBn:
      "আসসালামু আলাইকুম {customer_name}, *{store_name}* থেকে আপনার অর্ডার *#{order_number}* মোট *{order_total}* (ক্যাশ অন ডেলিভারি) গ্রহণ করা হয়েছে।\n\nঅর্ডারটি নিশ্চিত করতে *1* এবং বাতিল করতে *2* লিখে রিপ্লাই দিন।",
    vars: ["customer_name", "order_number", "order_total", "items_list", "delivery_address", "store_name"],
  },
  {
    event: "ORDER_CONFIRMED",
    label: "Order Confirmed",
    description: "Sent after customer confirms or merchant marks order as confirmed",
    defaultEn:
      "Hi {customer_name}, your order *#{order_number}* is confirmed! We are packaging your items.\n\nTrack your order: {tracking_url}\nThank you, *{store_name}*",
    defaultBn:
      "ধন্যবাদ {customer_name}! আপনার অর্ডার *#{order_number}* কনফার্ম হয়েছে। পার্সেল প্রস্তুত হচ্ছে।\n\nট্র্যাকিং লিংক: {tracking_url}\nধন্যবাদ, *{store_name}*",
    vars: ["customer_name", "order_number", "order_total", "tracking_url", "store_name"],
  },
  {
    event: "DISPATCHED",
    label: "Courier Dispatched",
    description: "Sent when order is handed over to Pathao, Steadfast, or RedX with tracking details",
    defaultEn:
      "Great news {customer_name}! Your order *#{order_number}* has been dispatched via *{courier_name}*.\nTracking Code: *{tracking_code}*\nTrack here: {tracking_url}\n\nThank you, *{store_name}*",
    defaultBn:
      "শুভ সংবাদ {customer_name}! আপনার অর্ডার *#{order_number}* *{courier_name}*-এর মাধ্যমে পাঠানো হয়েছে।\nট্র্যাকিং কোড: *{tracking_code}*\nট্র্যাকিং লিংক: {tracking_url}\n\nধন্যবাদ, *{store_name}*",
    vars: ["customer_name", "order_number", "courier_name", "tracking_code", "tracking_url", "store_name"],
  },
  {
    event: "OUT_FOR_DELIVERY",
    label: "Out For Delivery / Cash Reminder",
    description: "Sent on the day of delivery reminding customer to keep exact cash ready",
    defaultEn:
      "Hi {customer_name}, your order *#{order_number}* is out for delivery today! 🛵\nPlease keep the exact Cash on Delivery amount *{order_total}* ready for the delivery rider.\n\nThank you, *{store_name}*",
    defaultBn:
      "আসসালামু আলাইকুম {customer_name}, আপনার অর্ডার *#{order_number}* আজ ডেলিভারি হবে! 🛵\nদয়া করে ডেলিভারি রাইডারের জন্য ক্যাশ অন ডেলিভারির মোট টাকা *{order_total}* প্রস্তুত রাখুন।\n\nধন্যবাদ, *{store_name}*",
    vars: ["customer_name", "order_number", "order_total", "store_name"],
  },
  {
    event: "DELIVERED",
    label: "Order Delivered & Review Request",
    description: "Sent when courier marks delivery complete asking for customer review",
    defaultEn:
      "Order *#{order_number}* has been delivered! 🎉\nThank you for choosing *{store_name}*. We hope you love your purchase! Please leave us a review: {tracking_url}",
    defaultBn:
      "আপনার অর্ডার *#{order_number}* পৌঁছে গেছে! 🎉\n*{store_name}*-কে বেছে নেওয়ার জন্য ধন্যবাদ। পণ্যটি কেমন লেগেছে আমাদের জানান: {tracking_url}",
    vars: ["customer_name", "order_number", "tracking_url", "store_name"],
  },
  {
    event: "DELIVERY_FAILED",
    label: "Delivery Attempt Failed",
    description: "Sent when courier reports customer unavailable or address issue",
    defaultEn:
      "Hi {customer_name}, the courier could not deliver order *#{order_number}* today. Please reply here or call us at *{store_name}* to reschedule your delivery.",
    defaultBn:
      "আসসালামু আলাইকুম {customer_name}, আজ আপনার অর্ডার *#{order_number}* ডেলিভারি করা সম্ভব হয়নি। পুনরায় পাঠাতে সরাসরি এখানে রিপ্লাই দিন বা আমাদের সাথে যোগাযোগ করুন। - *{store_name}*",
    vars: ["customer_name", "order_number", "store_name"],
  },
  {
    event: "ABANDONED_CART_STAGE_1",
    label: "Abandoned Cart (Stage 1 - 30 Mins)",
    description: "Sent 30 minutes after customer leaves checkout with direct cart restoration link",
    defaultEn:
      "Hi {customer_name}, you left items in your cart at *{store_name}*! Complete your order before items sell out:\n{recover_url}\n\nReply here if you have any questions!",
    defaultBn:
      "আসসালামু আলাইকুম {customer_name}, *{store_name}*-এ আপনার পছন্দের পণ্য কার্টে রয়ে গেছে! স্টক শেষ হওয়ার আগেই অর্ডার সম্পন্ন করুন:\n{recover_url}\n\nযেকোনো প্রয়োজনে আমাদের রিপ্লাই দিন!",
    vars: ["customer_name", "recover_url", "cart_items", "store_name"],
  },
  {
    event: "ABANDONED_CART_STAGE_2",
    label: "Abandoned Cart (Stage 2 - 24 Hours)",
    description: "Sent 24 hours later with an exclusive incentive discount coupon",
    defaultEn:
      "Special gift for {customer_name}! 🎁 Use exclusive coupon code *{discount_code}* to get an extra discount on your cart at *{store_name}*:\n{recover_url}\n\nOffer valid for today only!",
    defaultBn:
      "আপনার জন্য স্পেশাল অফার {customer_name}! 🎁 *{store_name}*-এ আপনার কার্ট সম্পূর্ণ করতে কুপন কোড *{discount_code}* ব্যবহার করুন:\n{recover_url}\n\nঅফারটি শুধুমাত্র আজকের জন্য প্রযোজ্য!",
    vars: ["customer_name", "discount_code", "recover_url", "store_name"],
  },
];

export const WHATSAPP_EVENT_MAP = new Map(WHATSAPP_EVENTS.map((e) => [e.event, e]));

/**
 * Replaces `{var_name}` placeholders with their actual values.
 */
export function renderWhatsAppText(
  body: string,
  vars: Partial<Record<WhatsAppVar, string | number | null | undefined>>
): string {
  return body.replace(/\{([a-z_]+)\}/g, (match, key: string) => {
    const val = vars[key as WhatsAppVar];
    if (val === undefined || val === null) return match;
    return String(val);
  });
}

import { generateWhatsAppQrSvg } from "./session";

/**
 * Retrieves the store's WhatsApp configuration.
 */
export async function getWhatsAppConfig(tenantId: string): Promise<WhatsAppConfigView> {
  return withTenant(tenantId, async (tx) => {
    const [existing, settings] = await Promise.all([
      tx.whatsAppConfig.findUnique({
        where: { tenantId },
      }),
      tx.storeSettings.findUnique({
        where: { tenantId },
        select: { whatsappNumber: true },
      }),
    ]);

    const activePhone = existing?.phoneNumber || (settings?.whatsappNumber ? formatWhatsAppPhone(settings.whatsappNumber) : null);

    let qrSvg: string | null = null;
    if (existing?.status === "SCAN_QR" && existing?.qrCodeData) {
      try {
        qrSvg = await generateWhatsAppQrSvg(existing.qrCodeData);
      } catch {
        // Ignore QR error
      }
    }

    if (existing) {
      return {
        providerMode: existing.providerMode,
        status: existing.status,
        phoneNumber: activePhone,
        qrCodeData: existing.qrCodeData,
        qrSvg,
        gatewayUrl: existing.gatewayUrl,
        autoConfirmCod: existing.autoConfirmCod,
        shippingUpdatesEnabled: existing.shippingUpdatesEnabled,
        abandonedRecoveryEnabled: existing.abandonedRecoveryEnabled,
        botEnabled: existing.botEnabled,
        smsFallbackEnabled: existing.smsFallbackEnabled,
        followUpReminderHours: existing.followUpReminderHours,
        lastConnectedAt: existing.lastConnectedAt,
      };
    }

    return {
      providerMode: "QR_SESSION",
      status: "DISCONNECTED",
      phoneNumber: activePhone,
      qrCodeData: null,
      qrSvg: null,
      gatewayUrl: null,
      autoConfirmCod: true,
      shippingUpdatesEnabled: true,
      abandonedRecoveryEnabled: true,
      botEnabled: true,
      smsFallbackEnabled: true,
      followUpReminderHours: 12,
      lastConnectedAt: null,
    };
  });
}

/**
 * Updates WhatsApp configuration toggles and preferences.
 */
export async function saveWhatsAppConfig(
  tenantId: string,
  data: Partial<WhatsAppConfigView>
): Promise<WhatsAppConfigView> {
  return withTenant(tenantId, async (tx) => {
    const upserted = await tx.whatsAppConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        providerMode: data.providerMode ?? "QR_SESSION",
        status: data.status ?? "DISCONNECTED",
        phoneNumber: data.phoneNumber ? formatWhatsAppPhone(data.phoneNumber) : null,
        gatewayUrl: data.gatewayUrl ?? null,
        autoConfirmCod: data.autoConfirmCod ?? true,
        shippingUpdatesEnabled: data.shippingUpdatesEnabled ?? true,
        abandonedRecoveryEnabled: data.abandonedRecoveryEnabled ?? true,
        botEnabled: data.botEnabled ?? true,
        smsFallbackEnabled: data.smsFallbackEnabled ?? true,
        followUpReminderHours: data.followUpReminderHours ?? 12,
      },
      update: {
        providerMode: data.providerMode,
        phoneNumber: data.phoneNumber !== undefined ? (data.phoneNumber ? formatWhatsAppPhone(data.phoneNumber) : null) : undefined,
        gatewayUrl: data.gatewayUrl,
        autoConfirmCod: data.autoConfirmCod,
        shippingUpdatesEnabled: data.shippingUpdatesEnabled,
        abandonedRecoveryEnabled: data.abandonedRecoveryEnabled,
        botEnabled: data.botEnabled,
        smsFallbackEnabled: data.smsFallbackEnabled,
        followUpReminderHours: data.followUpReminderHours,
      },
    });

    return {
      providerMode: upserted.providerMode,
      status: upserted.status,
      phoneNumber: upserted.phoneNumber,
      qrCodeData: upserted.qrCodeData,
      gatewayUrl: upserted.gatewayUrl,
      autoConfirmCod: upserted.autoConfirmCod,
      shippingUpdatesEnabled: upserted.shippingUpdatesEnabled,
      abandonedRecoveryEnabled: upserted.abandonedRecoveryEnabled,
      botEnabled: upserted.botEnabled,
      smsFallbackEnabled: upserted.smsFallbackEnabled,
      followUpReminderHours: upserted.followUpReminderHours,
      lastConnectedAt: upserted.lastConnectedAt,
    };
  });
}

/**
 * Lists all WhatsApp templates with stored customizations and defaults.
 */
export async function getWhatsAppTemplates(tenantId: string): Promise<WhatsAppTemplateView[]> {
  return withTenant(tenantId, async (tx) => {
    const saved = await tx.whatsAppTemplate.findMany({
      where: { tenantId },
    });

    const savedMap = new Map(saved.map((s) => [s.event, s]));

    return WHATSAPP_EVENTS.map((item) => {
      const match = savedMap.get(item.event);
      return {
        id: match?.id,
        event: item.event,
        name: match?.name ?? item.label,
        bodyEn: match?.bodyEn ?? item.defaultEn,
        bodyBn: match?.bodyBn ?? item.defaultBn,
        isActive: match?.isActive ?? true,
        vars: item.vars,
      };
    });
  });
}

/**
 * Saves or updates a specific template.
 */
export async function saveWhatsAppTemplate(
  tenantId: string,
  event: WhatsAppEventType,
  data: { bodyEn: string; bodyBn?: string; isActive?: boolean }
): Promise<void> {
  const info = WHATSAPP_EVENT_MAP.get(event);
  if (!info) throw new Error(`Unknown WhatsApp event: ${event}`);

  await withTenant(tenantId, async (tx) => {
    await tx.whatsAppTemplate.upsert({
      where: {
        tenantId_event: { tenantId, event },
      },
      create: {
        tenantId,
        event,
        name: info.label,
        bodyEn: data.bodyEn.trim() || info.defaultEn,
        bodyBn: data.bodyBn?.trim() || info.defaultBn,
        isActive: data.isActive ?? true,
      },
      update: {
        bodyEn: data.bodyEn.trim() || info.defaultEn,
        bodyBn: data.bodyBn !== undefined ? (data.bodyBn?.trim() || info.defaultBn) : undefined,
        isActive: data.isActive,
      },
    });
  });
}

/**
 * Resets a template to default text.
 */
export async function resetWhatsAppTemplate(tenantId: string, event: WhatsAppEventType): Promise<void> {
  const info = WHATSAPP_EVENT_MAP.get(event);
  if (!info) throw new Error(`Unknown WhatsApp event: ${event}`);

  await withTenant(tenantId, async (tx) => {
    await tx.whatsAppTemplate.deleteMany({
      where: { tenantId, event },
    });
  });
}

/**
 * Sends an automated WhatsApp message or cascades to SMS if disconnected or failed.
 */
export async function sendWhatsAppNotification(
  tenantId: string,
  params: WhatsAppSendParams
): Promise<WhatsAppSendResult> {
  const { phone, body, event, orderId, fallbackToSms } = params;
  const formattedPhone = formatWhatsAppPhone(phone);

  return withTenant(tenantId, async (tx) => {
    const config = await tx.whatsAppConfig.findUnique({
      where: { tenantId },
    });

    const isConnected = config?.status === "CONNECTED";
    const allowSmsFallback = fallbackToSms ?? config?.smsFallbackEnabled ?? true;

    // Create initial message log entry
    const log = await tx.whatsAppMessageLog.create({
      data: {
        tenantId,
        orderId: orderId || null,
        phone: formattedPhone,
        direction: "OUTBOUND",
        event: event || null,
        status: "QUEUED",
        messageBody: body,
      },
    });

    let sentViaWhatsApp = false;
    let externalId: string | undefined;
    let errorDetail: string | undefined;

    // Attempt WhatsApp delivery if connected or if custom gateway URL is specified
    if (isConnected || config?.gatewayUrl) {
      try {
        const gatewayUrl = config?.gatewayUrl || process.env.WHATSAPP_GATEWAY_URL;
        if (gatewayUrl) {
          const res = await fetch(`${gatewayUrl}/message/send`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(config?.gatewayApiKey ? { Authorization: `Bearer ${config.gatewayApiKey}` } : {}),
            },
            body: JSON.stringify({
              tenantId,
              to: formattedPhone,
              text: body,
            }),
            signal: AbortSignal.timeout(8_000),
          });
          if (res.ok) {
            const json = await res.json() as { messageId?: string };
            externalId = json.messageId;
            sentViaWhatsApp = true;
          } else {
            errorDetail = `Gateway returned ${res.status}: ${await res.text().catch(() => "")}`;
          }
        } else {
          // If native session is connected in simulated/embedded mode
          externalId = `wamid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          sentViaWhatsApp = true;
        }
      } catch (e) {
        errorDetail = e instanceof Error ? e.message : "WhatsApp delivery network error";
      }
    } else {
      errorDetail = "WhatsApp session is not connected";
    }

    if (sentViaWhatsApp) {
      await tx.whatsAppMessageLog.update({
        where: { id: log.id },
        data: {
          status: "SENT",
          externalMsgId: externalId,
          sentAt: new Date(),
        },
      });

      return {
        success: true,
        status: "SENT",
        externalMsgId: externalId,
        channelUsed: "WHATSAPP",
      };
    }

    // Cascade to SMS fallback if enabled
    if (allowSmsFallback) {
      try {
        const smsSender = currentSmsSender();
        // Remove markdown formatting like *bold* and _italic_ for plain SMS
        const plainText = body.replace(/[*_~`]/g, "");
        await smsSender.send(tenantId, formattedPhone, plainText);

        await tx.whatsAppMessageLog.update({
          where: { id: log.id },
          data: {
            status: "FALLBACK_TO_SMS",
            errorDetails: `WhatsApp unavailable (${errorDetail || "Disconnected"}). Dispatched via SMS fallback.`,
            sentAt: new Date(),
          },
        });

        return {
          success: true,
          status: "FALLBACK_TO_SMS",
          channelUsed: "SMS_FALLBACK",
        };
      } catch (smsErr) {
        const smsErrMsg = smsErr instanceof Error ? smsErr.message : "SMS fallback failed";
        await tx.whatsAppMessageLog.update({
          where: { id: log.id },
          data: {
            status: "FAILED",
            errorDetails: `WhatsApp failed (${errorDetail}); SMS fallback failed (${smsErrMsg})`,
          },
        });

        return {
          success: false,
          status: "FAILED",
          error: `WhatsApp & SMS fallback failed: ${smsErrMsg}`,
          channelUsed: "SMS_FALLBACK",
        };
      }
    }

    // Marked as FAILED without SMS fallback
    await tx.whatsAppMessageLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errorDetails: errorDetail,
      },
    });

    return {
      success: false,
      status: "FAILED",
      error: errorDetail,
      channelUsed: "WHATSAPP",
    };
  });
}

/**
 * Retrieves paginated WhatsApp message audit logs for merchant observability.
 */
export async function getWhatsAppMessageLogs(
  tenantId: string,
  options?: { limit?: number; offset?: number; phone?: string; event?: WhatsAppEventType }
) {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  return withTenant(tenantId, async (tx) => {
    const where = {
      tenantId,
      ...(options?.phone ? { phone: { contains: options.phone } } : {}),
      ...(options?.event ? { event: options.event } : {}),
    };

    const [total, logs] = await Promise.all([
      tx.whatsAppMessageLog.count({ where }),
      tx.whatsAppMessageLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              customerName: true,
              totalAmount: true,
            },
          },
        },
      }),
    ]);

    return { total, logs, limit, offset };
  });
}
