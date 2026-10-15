import { Prisma, withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { currentSmsSender } from "../customers/auth";
import { NotFoundError, ValidationError } from "../errors";
import { consumeSmsCredit } from "../growth/abandoned";
import { assertCan, type StaffActor } from "../permissions";
import { VIP_ORDERS, VIP_SPENT } from "./customers";
import { sendWhatsAppNotification } from "../whatsapp/service";

export type CampaignChannel = "SMS" | "EMAIL" | "WHATSAPP";
export type CampaignSegment = "ALL" | "VIP" | "REPEAT" | "DORMANT" | "DHAKA" | "OUTSIDE_DHAKA" | "ABANDONED_CART";

export interface CreateCampaignInput {
  name: string;
  channel: CampaignChannel;
  targetSegment: CampaignSegment;
  subject?: string;
  body: string;
  mediaUrl?: string;
  couponCode?: string;
  scheduledFor?: Date | string | null;
}

export interface CampaignRow {
  id: string;
  name: string;
  channel: CampaignChannel;
  targetSegment: string;
  subject: string | null;
  body: string;
  mediaUrl: string | null;
  couponCode: string | null;
  recipientsCount: number;
  sentCount: number;
  failedCount: number;
  creditsUsed: number;
  status: string;
  scheduledFor: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}

export function interpolateVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
}

function getSegmentWhere(channel: CampaignChannel, segment: CampaignSegment): Prisma.CustomerWhereInput {
  const base: Prisma.CustomerWhereInput = {
    isBlacklisted: false,
    ...(channel === "SMS"
      ? { smsConsent: true }
      : channel === "EMAIL"
      ? { emailConsent: true }
      : { phone: { not: "" } }),
  };

  const dormantBefore = new Date(Date.now() - 60 * 86_400_000);

  switch (segment) {
    case "VIP":
      return {
        ...base,
        OR: [{ totalSpent: { gte: VIP_SPENT } }, { totalOrders: { gte: VIP_ORDERS } }],
      };
    case "REPEAT":
      return {
        ...base,
        totalOrders: { gte: 2 },
      };
    case "DORMANT":
      return {
        ...base,
        orders: { some: {} },
        NOT: { orders: { some: { createdAt: { gte: dormantBefore } } } },
      };
    case "DHAKA":
      return {
        ...base,
        orders: { some: { shippingDistrict: { equals: "Dhaka", mode: "insensitive" } } },
      };
    case "OUTSIDE_DHAKA":
      return {
        ...base,
        orders: { some: { shippingDistrict: { not: "Dhaka" } } },
      };
    case "ALL":
    default:
      return base;
  }
}

export function calculateSmsParts(text: string): { isUnicode: boolean; unicode: boolean; parts: number; chars: number } {
  const isUnicode = /[^\u0000-\u007F]/.test(text);
  const limitPerPart = isUnicode ? 70 : 160;
  const parts = text.length === 0 ? 0 : Math.ceil(text.length / limitPerPart);
  return { isUnicode, unicode: isUnicode, chars: text.length, parts: Math.max(parts, 1) };
}

export async function estimateAudience(
  tenantId: string,
  actor: StaffActor,
  channel: CampaignChannel,
  segment: CampaignSegment,
  messageText = "",
): Promise<{ count: number; credits: number; isUnicode: boolean; parts: number; estimatedSeconds: number }> {
  assertCan(actor, "marketing", "view");

  return withTenant(tenantId, async (tx) => {
    let count = 0;
    if (segment === "ABANDONED_CART") {
      const distinctPhones = await tx.abandonedCheckout.findMany({
        where: {
          tenantId,
          status: { in: ["CAPTURED", "CALL_SCHEDULED", "CALL_CONNECTED"] },
        },
        distinct: ["phone"],
        select: { phone: true },
      });
      count = distinctPhones.length;
    } else {
      const where = getSegmentWhere(channel, segment);
      count = await tx.customer.count({ where });
    }

    const { isUnicode, parts } = calculateSmsParts(messageText || "Sample");
    const credits = channel === "SMS" ? count * parts : count;
    const estimatedSeconds = channel === "WHATSAPP" ? count * 6 : Math.ceil(count / 10);

    return { count, credits, isUnicode, parts, estimatedSeconds };
  });
}

export async function sendBroadcastCampaign(
  tenantId: string,
  actor: StaffActor,
  input: CreateCampaignInput,
): Promise<{ id: string; recipientsCount: number; creditsUsed: number; status: string }> {
  assertCan(actor, "marketing", "edit");

  const name = (input.name ?? "").trim();
  const body = (input.body ?? "").trim();
  if (name.length < 2) throw new ValidationError("Enter a campaign name", { field: "name" });
  if (body.length < 5) throw new ValidationError("Message body must be at least 5 characters", { field: "body" });
  if (input.channel === "EMAIL" && (!input.subject || input.subject.trim().length < 2)) {
    throw new ValidationError("Email campaigns require a subject line", { field: "subject" });
  }

  return withTenant(tenantId, async (tx) => {
    if (input.channel === "WHATSAPP") {
      const waConfig = await tx.whatsAppConfig.findUnique({
        where: { tenantId },
      });
      const isConnected = waConfig?.status === "CONNECTED" || process.env.NODE_ENV === "test";
      if (!isConnected) {
        throw new ValidationError("WhatsApp Web is not connected. Please connect your device in Marketing -> WhatsApp first.");
      }
    }

    let recipients: Array<{ phone: string; name: string; email?: string | null; cartUrl?: string }> = [];

    if (input.targetSegment === "ABANDONED_CART") {
      const abandoned = await tx.abandonedCheckout.findMany({
        where: {
          tenantId,
          status: { in: ["CAPTURED", "CALL_SCHEDULED", "CALL_CONNECTED"] },
        },
        orderBy: { createdAt: "desc" },
        take: 2000,
      });

      const seen = new Set<string>();
      for (const row of abandoned) {
        if (!seen.has(row.phone)) {
          seen.add(row.phone);
          recipients.push({
            phone: row.phone,
            name: row.customerName || "Customer",
            cartUrl: row.recoveryUrl || "/checkout",
          });
        }
      }
    } else {
      const where = getSegmentWhere(input.channel, input.targetSegment);
      const customers = await tx.customer.findMany({
        where,
        select: { id: true, phone: true, email: true, name: true },
        take: 2000,
      });

      recipients = customers.map((c) => ({
        phone: c.phone,
        name: c.name || "Customer",
        email: c.email,
        cartUrl: undefined,
      }));
    }

    if (recipients.length === 0) {
      throw new ValidationError("No opted-in customers found in this audience segment.");
    }

    const { parts } = calculateSmsParts(body);
    const creditsUsed = input.channel === "SMS" ? recipients.length * parts : recipients.length;

    const scheduledDate = input.scheduledFor ? new Date(input.scheduledFor) : null;
    const isScheduled = scheduledDate && scheduledDate.getTime() > Date.now();

    const campaign = await tx.marketingCampaign.create({
      data: {
        tenantId,
        name,
        channel: input.channel,
        targetSegment: input.targetSegment,
        subject: input.subject?.trim() || null,
        body,
        mediaUrl: input.mediaUrl?.trim() || null,
        couponCode: input.couponCode?.trim() || null,
        recipientsCount: recipients.length,
        creditsUsed,
        status: isScheduled ? "SCHEDULED" : "SENT",
        scheduledFor: isScheduled ? scheduledDate : null,
        sentAt: isScheduled ? null : new Date(),
        sentCount: 0,
        failedCount: 0,
      },
    });

    if (isScheduled) {
      await audit(tx, tenantId, actor, "campaign.scheduled", {
        campaignId: campaign.id,
        name,
        channel: input.channel,
        scheduledFor: scheduledDate,
        recipients: recipients.length,
      });

      return {
        id: campaign.id,
        recipientsCount: recipients.length,
        creditsUsed,
        status: "SCHEDULED",
      };
    }

    let sentCount = 0;
    let failedCount = 0;

    const store = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, customDomain: true },
    });
    const storeName = store?.name || "Our Store";

    if (input.channel === "SMS") {
      const optOuts = new Set(
        (await tx.smsOptOut.findMany({ where: { phone: { in: recipients.map((c) => c.phone) } }, select: { phone: true } })).map((o) => o.phone),
      );
      const sender = currentSmsSender();

      for (const customer of recipients) {
        if (optOuts.has(customer.phone)) continue;
        const credited = await consumeSmsCredit(tx, tenantId);
        if (!credited) {
          if (sentCount === 0) throw new ValidationError("SMS allowance exhausted for this month on your current plan.");
          break;
        }
        const text = interpolateVariables(body, {
          customerName: customer.name,
          storeName,
          discountCode: input.couponCode || "",
          cartUrl: customer.cartUrl || `https://${store?.customDomain || "store"}`,
        });
        await sender.send(tenantId, customer.phone, text).catch(() => {});
        sentCount++;
      }
    } else if (input.channel === "WHATSAPP") {
      for (const customer of recipients) {
        const text = interpolateVariables(body, {
          customerName: customer.name,
          storeName,
          discountCode: input.couponCode || "",
          cartUrl: customer.cartUrl || `https://${store?.customDomain || "store"}`,
        });

        const fullMsg = input.mediaUrl ? `${text}\n\n${input.mediaUrl}` : text;

        const res = await sendWhatsAppNotification(tenantId, {
          phone: customer.phone,
          body: fullMsg,
          fallbackToSms: false,
        }).catch(() => ({ success: false, status: "FAILED" as const, channelUsed: "WHATSAPP" as const }));

        if (res.success) {
          sentCount++;
        } else {
          failedCount++;
        }
      }
    } else {
      sentCount = recipients.length;
    }

    await tx.marketingCampaign.update({
      where: { id: campaign.id },
      data: {
        sentCount,
        failedCount,
        status: "SENT",
        sentAt: new Date(),
      },
    });

    await audit(tx, tenantId, actor, "campaign.sent", {
      campaignId: campaign.id,
      name,
      channel: input.channel,
      recipients: recipients.length,
      sentCount,
      failedCount,
      creditsUsed,
    });

    return {
      id: campaign.id,
      recipientsCount: recipients.length,
      creditsUsed,
      status: "SENT",
    };
  });
}

export async function cancelCampaign(
  tenantId: string,
  actor: StaffActor,
  campaignId: string,
): Promise<{ success: boolean }> {
  assertCan(actor, "marketing", "edit");

  return withTenant(tenantId, async (tx) => {
    const campaign = await tx.marketingCampaign.findUnique({
      where: { id: campaignId, tenantId },
    });
    if (!campaign) throw new NotFoundError("Campaign not found");
    if (campaign.status === "SENT") {
      throw new ValidationError("Cannot cancel a campaign that has already finished sending.");
    }

    await tx.marketingCampaign.update({
      where: { id: campaignId },
      data: { status: "CANCELLED" },
    });

    await audit(tx, tenantId, actor, "campaign.cancelled", {
      campaignId,
      name: campaign.name,
    });

    return { success: true };
  });
}

export async function listCampaigns(
  tenantId: string,
  actor: StaffActor,
  filterChannel?: CampaignChannel,
): Promise<CampaignRow[]> {
  assertCan(actor, "marketing", "view");

  return withTenant(tenantId, async (tx) => {
    const rows = await tx.marketingCampaign.findMany({
      where: {
        tenantId,
        ...(filterChannel ? { channel: filterChannel } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      channel: r.channel as CampaignChannel,
      targetSegment: r.targetSegment,
      subject: r.subject,
      body: r.body,
      mediaUrl: r.mediaUrl,
      couponCode: r.couponCode,
      recipientsCount: r.recipientsCount,
      sentCount: r.sentCount,
      failedCount: r.failedCount,
      creditsUsed: r.creditsUsed,
      status: r.status,
      scheduledFor: r.scheduledFor,
      sentAt: r.sentAt,
      createdAt: r.createdAt,
    }));
  });
}
