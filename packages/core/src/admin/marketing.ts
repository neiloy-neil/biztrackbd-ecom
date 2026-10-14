import { withTenant } from "@biztrackbd/db";
import { assertCan, type StaffActor } from "../permissions";
import { getAbandonedMetrics } from "../growth/abandoned";
import { getTrackingOverview } from "../growth/tracking";
import { listCoupons } from "./coupons";

export interface MarketingKpiSummary {
  activeDiscounts: number;
  totalCouponOrders: number;
  totalDiscountGivenBdt: number;
  recoveredRevenueBdt: number;
  recoveryRatePercent: number | null;
  activePixelsCount: number;
  metaCapiStatus: "LIVE" | "TEST" | "DISCONNECTED";
  loyaltyAccounts: number;
  loyaltyPointsOutstanding: number;
  loyaltyLiabilityBdt: number;
  reviewsCount: number;
  reviewsAverageRating: number | null;
  landingPagesCount: number;
  campaignsCount: number;
}

export interface MarketingRecentEvent {
  id: string;
  type: "COUPON" | "ABANDONED_RECOVERED" | "REVIEW" | "LOYALTY" | "CAMPAIGN";
  title: string;
  detail: string;
  date: Date;
  link?: string;
}

export interface MarketingOverview {
  summary: MarketingKpiSummary;
  coupons: {
    activeCount: number;
    totalCount: number;
    topCoupon: { code: string; usageCount: number; discount: string } | null;
  };
  pixels: {
    metaConnected: boolean;
    metaCapiMode: "LIVE" | "TEST" | null;
    metaPixelId: string | null;
    tiktokPixelId: string | null;
    gtmId: string | null;
    ga4Id: string | null;
    eventsLast24h: number;
  };
  abandoned: {
    dropped7d: number;
    recoveredRevenue: number;
    recoveryRatePercent: number | null;
    toCallCount: number;
  };
  loyalty: {
    enabled: boolean;
    accounts: number;
    pointsOutstanding: number;
    liabilityBdt: number;
    referralsRewarded: number;
  };
  reviews: {
    totalPublished: number;
    averageRating: number | null;
    pendingModeration: number;
  };
  landing: {
    publishedCount: number;
  };
  campaigns: {
    totalSent: number;
    lastCampaignAt: Date | null;
  };
  recentEvents: MarketingRecentEvent[];
}

export async function getMarketingOverview(tenantId: string, actor: StaffActor): Promise<MarketingOverview> {
  assertCan(actor, "marketing", "view");

  const [couponsList, trackingOverview, abandonedMetrics] = await Promise.all([
    listCoupons(tenantId, actor).catch(() => []),
    getTrackingOverview(tenantId, actor).catch(() => null),
    getAbandonedMetrics(tenantId, actor).catch(() => ({ dropped7d: 0, valueLeftBehind: 0, recoveryRatePercent: null, recoveredRevenue: 0 })),
  ]);

  return withTenant(tenantId, async (tx) => {
    const [
      couponOrders,
      loyaltySums,
      loyaltyAccountsCount,
      referralsCount,
      reviewsGroup,
      pendingReviewsCount,
      landingPagesCount,
      campaignsList,
      recentRecovered,
    ] = await Promise.all([
      tx.order.findMany({
        where: { couponCode: { not: null }, deletedAt: null },
        select: { id: true, orderNumber: true, couponCode: true, discountAmount: true, totalAmount: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      tx.customerLoyaltyAccount.aggregate({
        _sum: { availablePoints: true, pendingPoints: true },
        _count: true,
      }),
      tx.customerLoyaltyAccount.count(),
      tx.customerReferral.count({ where: { isDelivered: true } }),
      tx.review.groupBy({
        by: ["rating"],
        where: { isPublished: true },
        _count: { _all: true },
      }),
      tx.review.count({ where: { isPublished: false } }),
      tx.landingPage.count({ where: { isPublished: true } }),
      tx.marketingCampaign.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      tx.abandonedCheckout.findMany({
        where: { status: "RECOVERED" },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: { id: true, phone: true, customerName: true, cartTotal: true, updatedAt: true },
      }),
    ]);

    // Coupons aggregation
    const activeCoupons = couponsList.filter((c) => c.status === "active");
    const topCoupon = couponsList.length
      ? [...couponsList].sort((a, b) => b.usageCount - a.usageCount)[0]
      : null;
    const totalCouponOrders = couponsList.reduce((acc, c) => acc + c.usageCount, 0);
    const totalDiscountGivenBdt = couponOrders.reduce((acc, o) => acc + Number(o.discountAmount ?? 0), 0);

    // Pixels & CAPI
    const c = trackingOverview?.config;
    let activeTrackers = 0;
    if (c?.pixelId) activeTrackers++;
    if (c?.tiktokPixelId) activeTrackers++;
    if (c?.googleTagManagerId) activeTrackers++;
    if (c?.googleAnalyticsId) activeTrackers++;

    const metaCapiStatus: "LIVE" | "TEST" | "DISCONNECTED" =
      c?.capiConnected && c.capiMode === "LIVE"
        ? "LIVE"
        : c?.capiConnected && c.capiMode === "TEST"
        ? "TEST"
        : "DISCONNECTED";

    const events24h = trackingOverview?.stats.reduce((n, e) => n + e.browser + e.server, 0) ?? 0;

    // Reviews aggregation
    const totalReviews = reviewsGroup.reduce((a, b) => a + b._count._all, 0);
    const sumStars = reviewsGroup.reduce((s, r) => s + r.rating * r._count._all, 0);
    const avgRating = totalReviews > 0 ? Math.round((sumStars / totalReviews) * 10) / 10 : null;

    // Loyalty points & liability
    const pointsOutstanding = loyaltySums._sum.availablePoints ?? 0;
    // Assuming 100 points = ৳10 by default
    const liabilityBdt = Math.round(pointsOutstanding * 0.1);

    // Assemble unified recent events feed
    const recentEvents: MarketingRecentEvent[] = [];

    for (const co of couponOrders.slice(0, 5)) {
      recentEvents.push({
        id: `coupon-${co.id}`,
        type: "COUPON",
        title: `Coupon ${co.couponCode} redeemed`,
        detail: `Order ${co.orderNumber} saved ৳${Number(co.discountAmount ?? 0).toLocaleString()}`,
        date: co.createdAt,
        link: `/orders/${co.id}`,
      });
    }

    for (const rec of recentRecovered.slice(0, 5)) {
      recentEvents.push({
        id: `rec-${rec.id}`,
        type: "ABANDONED_RECOVERED",
        title: "Abandoned checkout recovered",
        detail: `${rec.customerName || rec.phone} placed order (৳${Number(rec.cartTotal).toLocaleString()})`,
        date: rec.updatedAt,
        link: "/abandoned",
      });
    }

    for (const camp of campaignsList.slice(0, 5)) {
      recentEvents.push({
        id: `camp-${camp.id}`,
        type: "CAMPAIGN",
        title: `${camp.channel} Campaign: ${camp.name}`,
        detail: `Sent to ${camp.recipientsCount} customers (${camp.creditsUsed} credits)`,
        date: camp.createdAt,
        link: "/marketing/campaigns",
      });
    }

    recentEvents.sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      summary: {
        activeDiscounts: activeCoupons.length,
        totalCouponOrders,
        totalDiscountGivenBdt: Math.round(totalDiscountGivenBdt),
        recoveredRevenueBdt: Math.round(abandonedMetrics.recoveredRevenue),
        recoveryRatePercent: abandonedMetrics.recoveryRatePercent,
        activePixelsCount: activeTrackers,
        metaCapiStatus,
        loyaltyAccounts: loyaltyAccountsCount,
        loyaltyPointsOutstanding: pointsOutstanding,
        loyaltyLiabilityBdt: liabilityBdt,
        reviewsCount: totalReviews,
        reviewsAverageRating: avgRating,
        landingPagesCount,
        campaignsCount: campaignsList.length,
      },
      coupons: {
        activeCount: activeCoupons.length,
        totalCount: couponsList.length,
        topCoupon: topCoupon
          ? {
              code: topCoupon.code,
              usageCount: topCoupon.usageCount,
              discount:
                topCoupon.type === "PERCENTAGE"
                  ? `${topCoupon.value}% off`
                  : topCoupon.type === "FIXED_AMOUNT"
                  ? `৳${topCoupon.value} off`
                  : "Free delivery",
            }
          : null,
      },
      pixels: {
        metaConnected: c?.capiConnected ?? false,
        metaCapiMode: c?.capiMode ?? null,
        metaPixelId: c?.pixelId ?? null,
        tiktokPixelId: c?.tiktokPixelId ?? null,
        gtmId: c?.googleTagManagerId ?? null,
        ga4Id: c?.googleAnalyticsId ?? null,
        eventsLast24h: events24h,
      },
      abandoned: {
        dropped7d: abandonedMetrics.dropped7d,
        recoveredRevenue: Math.round(abandonedMetrics.recoveredRevenue),
        recoveryRatePercent: abandonedMetrics.recoveryRatePercent,
        toCallCount: 0,
      },
      loyalty: {
        enabled: loyaltyAccountsCount > 0,
        accounts: loyaltyAccountsCount,
        pointsOutstanding,
        liabilityBdt,
        referralsRewarded: referralsCount,
      },
      reviews: {
        totalPublished: totalReviews,
        averageRating: avgRating,
        pendingModeration: pendingReviewsCount,
      },
      landing: {
        publishedCount: landingPagesCount,
      },
      campaigns: {
        totalSent: campaignsList.length,
        lastCampaignAt: campaignsList[0]?.createdAt ?? null,
      },
      recentEvents: recentEvents.slice(0, 15),
    };
  });
}
