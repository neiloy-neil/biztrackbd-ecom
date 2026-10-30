import { getBasePrisma, getPlatformPrisma } from "@biztrackbd/db";

export interface VisitorSessionPayload {
  sessionId: string;
  landingPage: string;
  referrer?: string | null;
  fbclid?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  ipAddress?: string | null;
}

export interface VisitorEventPayload {
  sessionId: string;
  eventType: "PAGEVIEW" | "CLICK" | "CTA" | "SIGNUP";
  pagePath: string;
  pageTitle?: string | null;
  targetText?: string | null;
  targetHref?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ClientErrorPayload {
  sessionId?: string | null;
  pageUrl: string;
  message: string;
  stack?: string | null;
  component?: string | null;
  browser?: string | null;
  os?: string | null;
  device?: string | null;
  metadata?: Record<string, unknown>;
}

/** Record or update a visitor session */
export async function recordVisitorSession(data: VisitorSessionPayload): Promise<void> {
  const db = getBasePrisma();
  const existing = await db.platformVisitorSession.findUnique({
    where: { id: data.sessionId },
    select: { id: true, startedAt: true },
  });

  const now = new Date();

  if (existing) {
    const durationSeconds = Math.max(0, Math.floor((now.getTime() - existing.startedAt.getTime()) / 1000));
    await db.platformVisitorSession.update({
      where: { id: data.sessionId },
      data: {
        lastActiveAt: now,
        durationSeconds,
        exitPage: data.landingPage,
      },
    });
  } else {
    await db.platformVisitorSession.create({
      data: {
        id: data.sessionId,
        landingPage: data.landingPage.slice(0, 500),
        referrer: data.referrer ? data.referrer.slice(0, 500) : null,
        fbclid: data.fbclid ? data.fbclid.slice(0, 500) : null,
        fbp: data.fbp ? data.fbp.slice(0, 100) : null,
        fbc: data.fbc ? data.fbc.slice(0, 500) : null,
        utmSource: data.utmSource ? data.utmSource.slice(0, 150) : null,
        utmMedium: data.utmMedium ? data.utmMedium.slice(0, 150) : null,
        utmCampaign: data.utmCampaign ? data.utmCampaign.slice(0, 200) : null,
        utmContent: data.utmContent ? data.utmContent.slice(0, 200) : null,
        utmTerm: data.utmTerm ? data.utmTerm.slice(0, 200) : null,
        device: data.device || "desktop",
        browser: data.browser || null,
        os: data.os || null,
        ipAddress: data.ipAddress || null,
        startedAt: now,
        lastActiveAt: now,
      },
    });
  }
}

/** Record an event (pageview, CTA click, etc.) */
export async function recordVisitorEvent(data: VisitorEventPayload): Promise<void> {
  const db = getBasePrisma();
  await db.platformVisitorEvent.create({
    data: {
      sessionId: data.sessionId,
      eventType: data.eventType,
      pagePath: data.pagePath.slice(0, 500),
      pageTitle: data.pageTitle ? data.pageTitle.slice(0, 300) : null,
      targetText: data.targetText ? data.targetText.slice(0, 200) : null,
      targetHref: data.targetHref ? data.targetHref.slice(0, 500) : null,
      metadata: (data.metadata || {}) as any,
    },
  });
}

/** Record or increment a client runtime error */
export async function recordClientError(data: ClientErrorPayload): Promise<void> {
  const db = getBasePrisma();
  const normalizedMsg = data.message.trim().slice(0, 1000);
  const now = new Date();

  // Deduplicate errors occurring on the same page with the same message in the last 24h
  const existing = await db.platformClientError.findFirst({
    where: {
      pageUrl: data.pageUrl,
      message: normalizedMsg,
      status: "NEW",
    },
    select: { id: true, count: true },
  });

  if (existing) {
    await db.platformClientError.update({
      where: { id: existing.id },
      data: {
        count: { increment: 1 },
        lastOccurredAt: now,
        stack: data.stack ? data.stack.slice(0, 4000) : undefined,
      },
    });
  } else {
    await db.platformClientError.create({
      data: {
        sessionId: data.sessionId || null,
        pageUrl: data.pageUrl.slice(0, 500),
        message: normalizedMsg,
        stack: data.stack ? data.stack.slice(0, 4000) : null,
        component: data.component ? data.component.slice(0, 150) : null,
        browser: data.browser || null,
        os: data.os || null,
        device: data.device || null,
        metadata: (data.metadata || {}) as any,
        createdAt: now,
        lastOccurredAt: now,
      },
    });
  }
}

/** Flag a session as converted when user signs up */
export async function markSessionConverted(sessionId: string): Promise<void> {
  if (!sessionId) return;
  const db = getBasePrisma();
  await db.platformVisitorSession.updateMany({
    where: { id: sessionId },
    data: { convertedToSignup: true },
  }).catch(() => undefined);
}

// ---- Query functions for Platform Admin (/analytics) ----------------------------------------------------

export interface AnalyticsSummary {
  totalVisitors: number;
  totalPageviews: number;
  fbAdVisitors: number;
  totalSignups: number;
  conversionRate: number;
  activeErrors: number;
}

export interface CampaignAttributionRow {
  campaign: string;
  source: string;
  visitors: number;
  signups: number;
  conversionRate: number;
  lastActive: Date;
}

export interface RecentVisitorRow {
  id: string;
  landingPage: string;
  referrer: string | null;
  campaign: string | null;
  fbclid: string | null;
  device: string | null;
  browser: string | null;
  durationSeconds: number;
  converted: boolean;
  eventCount: number;
  startedAt: Date;
}

export async function getAnalyticsDashboardData(): Promise<{
  summary: AnalyticsSummary;
  campaigns: CampaignAttributionRow[];
  recentVisitors: RecentVisitorRow[];
  topPages: { path: string; views: number }[];
  recentErrors: {
    id: string;
    pageUrl: string;
    message: string;
    count: number;
    browser: string | null;
    device: string | null;
    lastOccurredAt: Date;
    status: string;
  }[];
}> {
  const db = getPlatformPrisma();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalVisitors,
    totalPageviews,
    fbAdVisitors,
    totalSignups,
    activeErrors,
    campaignRows,
    recentSessions,
    topPageviews,
    errorRows,
  ] = await Promise.all([
    db.platformVisitorSession.count({ where: { startedAt: { gte: thirtyDaysAgo } } }),
    db.platformVisitorEvent.count({ where: { eventType: "PAGEVIEW", createdAt: { gte: thirtyDaysAgo } } }),
    db.platformVisitorSession.count({
      where: {
        startedAt: { gte: thirtyDaysAgo },
        OR: [{ fbclid: { not: null } }, { utmSource: { in: ["fb", "facebook", "meta", "fb_ads", "ig", "instagram"] } }],
      },
    }),
    db.platformVisitorSession.count({ where: { convertedToSignup: true, startedAt: { gte: thirtyDaysAgo } } }),
    db.platformClientError.count({ where: { status: "NEW" } }),
    db.platformVisitorSession.groupBy({
      by: ["utmCampaign", "utmSource"],
      where: { startedAt: { gte: thirtyDaysAgo }, utmCampaign: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    }),
    db.platformVisitorSession.findMany({
      where: { startedAt: { gte: thirtyDaysAgo } },
      orderBy: { startedAt: "desc" },
      take: 50,
      include: {
        _count: { select: { events: true } },
      },
    }),
    db.platformVisitorEvent.groupBy({
      by: ["pagePath"],
      where: { eventType: "PAGEVIEW", createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 15,
    }),
    db.platformClientError.findMany({
      orderBy: { lastOccurredAt: "desc" },
      take: 50,
      select: {
        id: true,
        pageUrl: true,
        message: true,
        count: true,
        browser: true,
        device: true,
        lastOccurredAt: true,
        status: true,
      },
    }),
  ]);

  const campaigns: CampaignAttributionRow[] = await Promise.all(
    campaignRows.map(async (c) => {
      const campName = c.utmCampaign || "Direct / Unknown";
      const signups = await db.platformVisitorSession.count({
        where: { utmCampaign: c.utmCampaign, convertedToSignup: true },
      });
      const visitors = c._count.id;
      const rate = visitors > 0 ? Math.round((signups / visitors) * 1000) / 10 : 0;
      return {
        campaign: campName,
        source: c.utmSource || "Meta Ads",
        visitors,
        signups,
        conversionRate: rate,
        lastActive: new Date(),
      };
    })
  );

  const conversionRate = totalVisitors > 0 ? Math.round((totalSignups / totalVisitors) * 1000) / 10 : 0;

  return {
    summary: {
      totalVisitors,
      totalPageviews,
      fbAdVisitors,
      totalSignups,
      conversionRate,
      activeErrors,
    },
    campaigns,
    recentVisitors: recentSessions.map((s) => ({
      id: s.id,
      landingPage: s.landingPage,
      referrer: s.referrer,
      campaign: s.utmCampaign,
      fbclid: s.fbclid,
      device: s.device,
      browser: s.browser,
      durationSeconds: s.durationSeconds,
      converted: s.convertedToSignup,
      eventCount: s._count.events,
      startedAt: s.startedAt,
    })),
    topPages: topPageviews.map((p) => ({ path: p.pagePath, views: p._count.id })),
    recentErrors: errorRows,
  };
}

/** Update error status (RESOLVED, IGNORED) */
export async function updateErrorStatus(errorId: string, status: "NEW" | "RESOLVED" | "IGNORED"): Promise<void> {
  const db = getPlatformPrisma();
  await db.platformClientError.update({
    where: { id: errorId },
    data: { status },
  });
}
