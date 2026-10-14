import { Prisma, withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { currentSmsSender } from "../customers/auth";
import { NotFoundError, ValidationError } from "../errors";
import { consumeSmsCredit } from "../growth/abandoned";
import { assertCan, type StaffActor } from "../permissions";
import { VIP_ORDERS, VIP_SPENT } from "./customers";

export type CampaignSegment = "ALL" | "VIP" | "REPEAT" | "DORMANT" | "DHAKA" | "OUTSIDE_DHAKA";

export interface CreateCampaignInput {
  name: string;
  channel: "SMS" | "EMAIL";
  targetSegment: CampaignSegment;
  subject?: string;
  body: string;
}

export interface CampaignRow {
  id: string;
  name: string;
  channel: "SMS" | "EMAIL";
  targetSegment: string;
  subject: string | null;
  body: string;
  recipientsCount: number;
  creditsUsed: number;
  status: string;
  sentAt: Date | null;
  createdAt: Date;
}

function getSegmentWhere(channel: "SMS" | "EMAIL", segment: CampaignSegment): Prisma.CustomerWhereInput {
  const base: Prisma.CustomerWhereInput = {
    isBlacklisted: false,
    ...(channel === "SMS" ? { smsConsent: true } : { emailConsent: true }),
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
  channel: "SMS" | "EMAIL",
  segment: CampaignSegment,
  messageText = "",
): Promise<{ count: number; credits: number; isUnicode: boolean; parts: number }> {
  assertCan(actor, "marketing", "view");

  return withTenant(tenantId, async (tx) => {
    const where = getSegmentWhere(channel, segment);
    const count = await tx.customer.count({ where });

    const { isUnicode, parts } = calculateSmsParts(messageText || "Sample");
    const credits = channel === "SMS" ? count * parts : count;

    return { count, credits, isUnicode, parts };
  });
}

export async function sendBroadcastCampaign(
  tenantId: string,
  actor: StaffActor,
  input: CreateCampaignInput,
): Promise<{ id: string; recipientsCount: number; creditsUsed: number }> {
  assertCan(actor, "marketing", "edit");

  const name = (input.name ?? "").trim();
  const body = (input.body ?? "").trim();
  if (name.length < 2) throw new ValidationError("Enter a campaign name", { field: "name" });
  if (body.length < 5) throw new ValidationError("Message body must be at least 5 characters", { field: "body" });
  if (input.channel === "EMAIL" && (!input.subject || input.subject.trim().length < 2)) {
    throw new ValidationError("Email campaigns require a subject line", { field: "subject" });
  }

  return withTenant(tenantId, async (tx) => {
    const where = getSegmentWhere(input.channel, input.targetSegment);
    const customers = await tx.customer.findMany({
      where,
      select: { id: true, phone: true, email: true, name: true },
      take: 2000,
    });

    if (customers.length === 0) {
      throw new ValidationError("No opted-in customers found in this audience segment.");
    }

    const { parts } = calculateSmsParts(body);
    const creditsUsed = input.channel === "SMS" ? customers.length * parts : customers.length;

    // Check credits if SMS
    if (input.channel === "SMS") {
      const optOuts = new Set(
        (await tx.smsOptOut.findMany({ where: { phone: { in: customers.map((c) => c.phone) } }, select: { phone: true } })).map((o) => o.phone),
      );

      const sender = currentSmsSender();
      let sentCount = 0;

      for (const customer of customers) {
        if (optOuts.has(customer.phone)) continue;
        const credited = await consumeSmsCredit(tx, tenantId);
        if (!credited) {
          if (sentCount === 0) throw new ValidationError("SMS allowance exhausted for this month on your current plan.");
          break; // Stop when plan runs out
        }
        await sender.send(tenantId, customer.phone, body).catch(() => {});
        sentCount++;
      }
    }

    const campaign = await tx.marketingCampaign.create({
      data: {
        tenantId,
        name,
        channel: input.channel,
        targetSegment: input.targetSegment,
        subject: input.subject?.trim() || null,
        body,
        recipientsCount: customers.length,
        creditsUsed,
        status: "SENT",
        sentAt: new Date(),
      },
    });

    await audit(tx, tenantId, actor, "campaign.sent", {
      campaignId: campaign.id,
      name,
      channel: input.channel,
      recipients: customers.length,
      creditsUsed,
    });

    return {
      id: campaign.id,
      recipientsCount: customers.length,
      creditsUsed,
    };
  });
}

export async function listCampaigns(tenantId: string, actor: StaffActor): Promise<CampaignRow[]> {
  assertCan(actor, "marketing", "view");

  return withTenant(tenantId, async (tx) => {
    const rows = await tx.marketingCampaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      channel: r.channel as "SMS" | "EMAIL",
      targetSegment: r.targetSegment,
      subject: r.subject,
      body: r.body,
      recipientsCount: r.recipientsCount,
      creditsUsed: r.creditsUsed,
      status: r.status,
      sentAt: r.sentAt,
      createdAt: r.createdAt,
    }));
  });
}
