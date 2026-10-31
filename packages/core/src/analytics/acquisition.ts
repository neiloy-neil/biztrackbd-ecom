import { withTenant } from "@biztrackbd/db";
import { assertCan, type StaffActor } from "../permissions";

export type AcquisitionChannel = "META" | "GOOGLE" | "TIKTOK" | "YOUTUBE" | "WHATSAPP" | "DIRECT" | "OTHER";

export interface CampaignRow {
  key: string;
  name: string;
  source: string;
  medium: string;
  channel: AcquisitionChannel;
  channelLabel: string;
  ordersCount: number;
  deliveredCount: number;
  cancelledCount: number;
  grossRevenue: number;
  deliveredRevenue: number;
  adSpend: number;
  roas: number;
  deliveredRoas: number;
  netProfit: number;
  aov: number;
}

export interface ChannelSummary {
  channel: AcquisitionChannel;
  label: string;
  ordersCount: number;
  grossRevenue: number;
  deliveredRevenue: number;
  sharePercent: number;
}

export interface CapiHealthSummary {
  totalEvents: number;
  serverEvents: number;
  browserEvents: number;
  dedupedCount: number;
  dedupeRatePercent: number;
  matchQualityGrade: "EXCELLENT" | "GOOD" | "FAIR" | "NEEDS_ATTENTION";
  recentEvents: Array<{
    id: string;
    name: string;
    origin: string;
    status: string;
    eventId: string;
    orderId: string | null;
    createdAt: Date;
  }>;
}

export interface AcquisitionReport {
  period: {
    from: string;
    to: string;
    days: number;
    touch: "last" | "first";
  };
  kpis: {
    totalOrders: number;
    adAttributedOrders: number;
    grossRevenue: number;
    adAttributedRevenue: number;
    totalAdSpend: number;
    blendedRoas: number;
    deliveredOrders: number;
    deliveredRevenue: number;
    deliveredRoas: number;
    cancelledOrders: number;
    cancelledRevenue: number;
    cancelRatePercent: number;
    aov: number;
    topChannel: AcquisitionChannel;
  };
  campaigns: CampaignRow[];
  channels: ChannelSummary[];
  capiHealth: CapiHealthSummary;
}

export function classifyChannel(source?: string | null, medium?: string | null): AcquisitionChannel {
  const s = (source || "").toLowerCase().trim();
  const m = (medium || "").toLowerCase().trim();

  if (!s && !m) return "DIRECT";
  if (s === "direct" || s === "none" || s === "(direct)") return "DIRECT";

  // Meta (Facebook, Instagram)
  if (
    s.includes("facebook") ||
    s.includes("fb") ||
    s.includes("instagram") ||
    s.includes("ig") ||
    s.includes("meta") ||
    m.includes("fb_") ||
    m.includes("facebook") ||
    m.includes("paid_social")
  ) {
    return "META";
  }

  // Google Ads & Search
  if (
    s.includes("google") ||
    s.includes("cpc") ||
    s.includes("adwords") ||
    s.includes("gclid") ||
    m.includes("cpc") ||
    m.includes("search")
  ) {
    return "GOOGLE";
  }

  // YouTube
  if (s.includes("youtube") || s.includes("yt") || m.includes("youtube")) {
    return "YOUTUBE";
  }

  // TikTok
  if (s.includes("tiktok") || s.includes("tt") || m.includes("tiktok")) {
    return "TIKTOK";
  }

  // WhatsApp
  if (s.includes("whatsapp") || s.includes("wa") || m.includes("whatsapp")) {
    return "WHATSAPP";
  }

  return "OTHER";
}

export function channelDisplayName(channel: AcquisitionChannel): string {
  switch (channel) {
    case "META":
      return "Meta Ads (FB/IG)";
    case "GOOGLE":
      return "Google Ads";
    case "TIKTOK":
      return "TikTok Ads";
    case "YOUTUBE":
      return "YouTube";
    case "WHATSAPP":
      return "WhatsApp Direct";
    case "DIRECT":
      return "Direct / Organic";
    case "OTHER":
    default:
      return "Other Referral";
  }
}

const MODULE_KEY = "ad_attribution";

/**
 * Retrieve saved campaign spend overrides for a tenant.
 */
export async function getCampaignAdSpends(tenantId: string): Promise<Record<string, number>> {
  try {
    const mod = await withTenant(tenantId, (tx) =>
      tx.tenantModule.findUnique({
        where: { tenantId_moduleKey: { tenantId, moduleKey: MODULE_KEY } },
        select: { settings: true },
      })
    );
    if (!mod || !mod.settings || typeof mod.settings !== "object") return {};
    const settings = mod.settings as Record<string, unknown>;
    const spends = settings.campaignSpends;
    if (spends && typeof spends === "object") {
      return spends as Record<string, number>;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Save custom ad spend entry for a campaign in BDT.
 */
export async function saveCampaignAdSpend(
  tenantId: string,
  actor: StaffActor,
  campaignKey: string,
  spendBdt: number
): Promise<{ ok: boolean }> {
  assertCan(actor, "marketing", "edit");
  const cleanKey = campaignKey.trim();
  const validSpend = Math.max(0, Number(spendBdt) || 0);

  await withTenant(tenantId, async (tx) => {
    const existing = await tx.tenantModule.findUnique({
      where: { tenantId_moduleKey: { tenantId, moduleKey: MODULE_KEY } },
    });

    const currentSettings = (existing?.settings && typeof existing.settings === "object")
      ? (existing.settings as Record<string, any>)
      : {};

    const currentSpends = (currentSettings.campaignSpends && typeof currentSettings.campaignSpends === "object")
      ? { ...currentSettings.campaignSpends }
      : {};

    currentSpends[cleanKey] = validSpend;

    await tx.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey: MODULE_KEY } },
      create: {
        tenantId,
        moduleKey: MODULE_KEY,
        isEnabled: true,
        settings: { ...currentSettings, campaignSpends: currentSpends },
      },
      update: {
        settings: { ...currentSettings, campaignSpends: currentSpends },
      },
    });
  });

  return { ok: true };
}

/**
 * Main query for campaign acquisition performance, ROAS, channel share, and CAPI diagnostics.
 */
export async function getCampaignAcquisitionMetrics(
  tenantId: string,
  actor: StaffActor,
  query: {
    from?: Date | string;
    to?: Date | string;
    touch?: "last" | "first";
    channel?: string;
    search?: string;
  } = {}
): Promise<AcquisitionReport> {
  assertCan(actor, "marketing", "view");

  const now = new Date();
  const toDate = query.to ? new Date(query.to) : now;
  const fromDate = query.from
    ? new Date(query.from)
    : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000); // default 30 days
  const touch = query.touch === "first" ? "first" : "last";

  const days = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)));

  const [orders, trackingEvents, adSpends] = await Promise.all([
    withTenant(tenantId, (tx) =>
      tx.order.findMany({
        where: {
          createdAt: { gte: fromDate, lte: toDate },
        },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          paymentStatus: true,
          utmSource: true,
          utmCampaign: true,
          utmMedium: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      })
    ),
    withTenant(tenantId, (tx) =>
      tx.trackingEvent.findMany({
        where: {
          createdAt: { gte: fromDate, lte: toDate },
          name: "Purchase",
        },
        select: {
          id: true,
          provider: true,
          name: true,
          origin: true,
          status: true,
          eventId: true,
          orderId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      })
    ),
    getCampaignAdSpends(tenantId),
  ]);

  // Aggregate by campaign
  const campaignMap = new Map<string, {
    key: string;
    name: string;
    source: string;
    medium: string;
    channel: AcquisitionChannel;
    ordersCount: number;
    deliveredCount: number;
    cancelledCount: number;
    grossRevenue: number;
    deliveredRevenue: number;
  }>();

  // Channel metrics
  const channelMap = new Map<AcquisitionChannel, { ordersCount: number; grossRevenue: number; deliveredRevenue: number }>();
  const ALL_CHANNELS: AcquisitionChannel[] = ["META", "GOOGLE", "TIKTOK", "YOUTUBE", "WHATSAPP", "DIRECT", "OTHER"];
  for (const ch of ALL_CHANNELS) {
    channelMap.set(ch, { ordersCount: 0, grossRevenue: 0, deliveredRevenue: 0 });
  }

  let totalOrders = 0;
  let adAttributedOrders = 0;
  let grossRevenue = 0;
  let adAttributedRevenue = 0;
  let deliveredOrders = 0;
  let deliveredRevenue = 0;
  let cancelledOrders = 0;
  let cancelledRevenue = 0;

  for (const o of orders) {
    const amount = Number(o.totalAmount) || 0;
    const isDelivered = o.status === "DELIVERED";
    const isCancelled = o.status === "CANCELLED" || o.status === "RETURNED";

    totalOrders++;
    grossRevenue += amount;
    if (isDelivered) {
      deliveredOrders++;
      deliveredRevenue += amount;
    }
    if (isCancelled) {
      cancelledOrders++;
      cancelledRevenue += amount;
    }

    const campaignName = (o.utmCampaign || "").trim();
    const source = (o.utmSource || "").trim();
    const medium = (o.utmMedium || "").trim();
    const channel = classifyChannel(source, medium);

    const hasAttribution = Boolean(campaignName || source || medium);
    if (hasAttribution) {
      adAttributedOrders++;
      adAttributedRevenue += amount;
    }

    // Update channel stats
    const chStats = channelMap.get(channel)!;
    chStats.ordersCount++;
    chStats.grossRevenue += amount;
    if (isDelivered) chStats.deliveredRevenue += amount;

    // Grouping key: campaign::source::medium
    const key = campaignName || (hasAttribution ? `${source || "ad"} (${medium || "promo"})` : "Direct / Organic Traffic");
    let c = campaignMap.get(key);
    if (!c) {
      c = {
        key,
        name: key,
        source: source || (hasAttribution ? "unknown" : "direct"),
        medium: medium || "none",
        channel,
        ordersCount: 0,
        deliveredCount: 0,
        cancelledCount: 0,
        grossRevenue: 0,
        deliveredRevenue: 0,
      };
      campaignMap.set(key, c);
    }

    c.ordersCount++;
    c.grossRevenue += amount;
    if (isDelivered) {
      c.deliveredCount++;
      c.deliveredRevenue += amount;
    }
    if (isCancelled) {
      c.cancelledCount++;
    }
  }

  // Build Campaign rows with ad spend and calculated ROAS
  let totalAdSpend = 0;
  const campaignRows: CampaignRow[] = [];

  for (const c of campaignMap.values()) {
    const spend = adSpends[c.key] || adSpends[c.name] || 0;
    totalAdSpend += spend;

    const roas = spend > 0 ? Number((c.grossRevenue / spend).toFixed(2)) : 0;
    const deliveredRoas = spend > 0 ? Number((c.deliveredRevenue / spend).toFixed(2)) : 0;
    const netProfit = c.grossRevenue - spend;
    const aov = c.ordersCount > 0 ? Math.round(c.grossRevenue / c.ordersCount) : 0;

    campaignRows.push({
      key: c.key,
      name: c.name,
      source: c.source,
      medium: c.medium,
      channel: c.channel,
      channelLabel: channelDisplayName(c.channel),
      ordersCount: c.ordersCount,
      deliveredCount: c.deliveredCount,
      cancelledCount: c.cancelledCount,
      grossRevenue: Math.round(c.grossRevenue),
      deliveredRevenue: Math.round(c.deliveredRevenue),
      adSpend: Math.round(spend),
      roas,
      deliveredRoas,
      netProfit: Math.round(netProfit),
      aov,
    });
  }

  // Sort campaigns by revenue descending
  campaignRows.sort((a, b) => b.grossRevenue - a.grossRevenue);

  // Build Channel Summaries
  const channels: ChannelSummary[] = [];
  for (const ch of ALL_CHANNELS) {
    const stat = channelMap.get(ch)!;
    const sharePercent = grossRevenue > 0 ? Number(((stat.grossRevenue / grossRevenue) * 100).toFixed(1)) : 0;
    channels.push({
      channel: ch,
      label: channelDisplayName(ch),
      ordersCount: stat.ordersCount,
      grossRevenue: Math.round(stat.grossRevenue),
      deliveredRevenue: Math.round(stat.deliveredRevenue),
      sharePercent,
    });
  }

  // Identify top performing channel
  const sortedChannels = [...channels].sort((a, b) => b.grossRevenue - a.grossRevenue);
  const topChannel = sortedChannels[0]?.channel ?? "DIRECT";

  // CAPI & GA4 Diagnostics
  const serverPurchases = trackingEvents.filter((e) => e.origin === "SERVER").length;
  const browserPurchases = trackingEvents.filter((e) => e.origin === "BROWSER").length;

  // Deduplication check: eventIds present on both BROWSER and SERVER
  const serverEventIds = new Set(trackingEvents.filter((e) => e.origin === "SERVER").map((e) => e.eventId));
  const dedupedCount = trackingEvents.filter((e) => e.origin === "BROWSER" && serverEventIds.has(e.eventId)).length;

  const dedupeRatePercent = serverPurchases > 0 ? Math.min(100, Math.round((dedupedCount / serverPurchases) * 100)) : 100;

  let matchQualityGrade: CapiHealthSummary["matchQualityGrade"] = "EXCELLENT";
  if (serverPurchases === 0 && browserPurchases === 0) {
    matchQualityGrade = "FAIR";
  } else if (serverPurchases === 0 && browserPurchases > 0) {
    matchQualityGrade = "NEEDS_ATTENTION";
  } else if (dedupeRatePercent < 60) {
    matchQualityGrade = "GOOD";
  }

  const capiHealth: CapiHealthSummary = {
    totalEvents: trackingEvents.length,
    serverEvents: serverPurchases,
    browserEvents: browserPurchases,
    dedupedCount,
    dedupeRatePercent,
    matchQualityGrade,
    recentEvents: trackingEvents.slice(0, 15).map((e) => ({
      id: e.id,
      name: e.name,
      origin: e.origin,
      status: e.status,
      eventId: e.eventId,
      orderId: e.orderId,
      createdAt: e.createdAt,
    })),
  };

  const blendedRoas = totalAdSpend > 0 ? Number((grossRevenue / totalAdSpend).toFixed(2)) : 0;
  const deliveredRoas = totalAdSpend > 0 ? Number((deliveredRevenue / totalAdSpend).toFixed(2)) : 0;
  const cancelRatePercent = totalOrders > 0 ? Number(((cancelledOrders / totalOrders) * 100).toFixed(1)) : 0;
  const aov = totalOrders > 0 ? Math.round(grossRevenue / totalOrders) : 0;

  return {
    period: {
      from: fromDate.toISOString().split("T")[0]!,
      to: toDate.toISOString().split("T")[0]!,
      days,
      touch,
    },
    kpis: {
      totalOrders,
      adAttributedOrders,
      grossRevenue: Math.round(grossRevenue),
      adAttributedRevenue: Math.round(adAttributedRevenue),
      totalAdSpend: Math.round(totalAdSpend),
      blendedRoas,
      deliveredOrders,
      deliveredRevenue: Math.round(deliveredRevenue),
      deliveredRoas,
      cancelledOrders,
      cancelledRevenue: Math.round(cancelledRevenue),
      cancelRatePercent,
      aov,
      topChannel,
    },
    campaigns: campaignRows,
    channels,
    capiHealth,
  };
}
