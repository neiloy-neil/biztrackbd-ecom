import { getBasePrisma, getPlatformPrisma } from "@biztrackbd/db";
import { resolveReportRange, type ResolvedReportRange } from "../admin/reports-shared";
import { addDays, dhakaDate, STORE_TZ } from "../admin/dashboard";

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
    const utmSource = data.utmSource ? data.utmSource.slice(0, 150) : (data.fbclid || data.fbc ? "meta" : null);
    const utmMedium = data.utmMedium ? data.utmMedium.slice(0, 150) : (data.fbclid || data.fbc ? "paid_social" : null);
    const utmCampaign = data.utmCampaign ? data.utmCampaign.slice(0, 200) : (data.fbclid || data.fbc ? "Meta Ads (Untagged)" : null);

    await db.platformVisitorSession.create({
      data: {
        id: data.sessionId,
        landingPage: data.landingPage.slice(0, 500),
        referrer: data.referrer ? data.referrer.slice(0, 500) : null,
        fbclid: data.fbclid ? data.fbclid.slice(0, 500) : null,
        fbp: data.fbp ? data.fbp.slice(0, 100) : null,
        fbc: data.fbc ? data.fbc.slice(0, 500) : null,
        utmSource,
        utmMedium,
        utmCampaign,
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
  // Ensure session exists first to satisfy foreign key constraint even if event arrives first
  await db.platformVisitorSession.upsert({
    where: { id: data.sessionId },
    create: {
      id: data.sessionId,
      landingPage: data.pagePath.slice(0, 500),
      startedAt: new Date(),
      lastActiveAt: new Date(),
    },
    update: {
      lastActiveAt: new Date(),
      exitPage: data.pagePath.slice(0, 500),
    },
  });

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

export const IGNORABLE_CLIENT_ERROR_PATTERNS = [
  /Java object is gone/i,
  /^Script error\.?$/i,
  /ResizeObserver loop/i,
  /Non-Error promise rejection/i,
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-extension:\/\//i,
  /ChunkLoadError/i,
  /Loading chunk .* failed/i,
  /NetworkError when attempting to fetch resource/i,
];

export function isIgnorableClientError(message: string, stack?: string | null): boolean {
  if (!message) return true;
  return IGNORABLE_CLIENT_ERROR_PATTERNS.some((p) => p.test(message) || (stack ? p.test(stack) : false));
}

/** Record or increment a client runtime error */
export async function recordClientError(data: ClientErrorPayload): Promise<void> {
  const normalizedMsg = data.message.trim().slice(0, 1000);
  if (isIgnorableClientError(normalizedMsg, data.stack)) {
    // Silently drop known third-party browser/webview noise (e.g. Android Meta in-app browser teardown)
    return;
  }
  const db = getBasePrisma();
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

export interface ConversionMeta {
  tenantId?: string | null;
  ip?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  utmCampaign?: string | null;
  utmSource?: string | null;
}

/** Flag a session as converted when user signs up */
export async function markSessionConverted(
  sessionId?: string | null,
  meta?: ConversionMeta,
): Promise<boolean> {
  const db = getPlatformPrisma();
  const cleanSid = sessionId?.trim();

  // 1. Try marking by explicit sessionId if provided
  if (cleanSid) {
    const updated = await db.platformVisitorSession.updateMany({
      where: { id: cleanSid },
      data: { convertedToSignup: true },
    }).catch(() => ({ count: 0 }));
    if (updated.count > 0) return true;
  }

  // 2. Fallback: match by fbc or fbp (exact Meta click / browser identifiers)
  if (meta?.fbc || meta?.fbp) {
    const orCond: { fbc?: string; fbp?: string }[] = [];
    if (meta.fbc) orCond.push({ fbc: meta.fbc });
    if (meta.fbp) orCond.push({ fbp: meta.fbp });

    const match = await db.platformVisitorSession.findFirst({
      where: {
        OR: orCond,
        startedAt: { gte: new Date(Date.now() - 24 * 3600_000) },
      },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });
    if (match) {
      await db.platformVisitorSession.update({
        where: { id: match.id },
        data: { convertedToSignup: true },
      });
      return true;
    }
  }

  // 3. Fallback: match by IP address + utmCampaign within recent 3 hours
  if (meta?.ip && meta?.ip !== "local") {
    const match = await db.platformVisitorSession.findFirst({
      where: {
        ipAddress: meta.ip,
        ...(meta.utmCampaign ? { utmCampaign: meta.utmCampaign } : {}),
        startedAt: { gte: new Date(Date.now() - 3 * 3600_000) },
      },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });
    if (match) {
      await db.platformVisitorSession.update({
        where: { id: match.id },
        data: { convertedToSignup: true },
      });
      return true;
    }
  }

  // 4. Fallback: match most recent session on /start or matching campaign within the last 30 minutes
  if (meta?.utmCampaign) {
    const match = await db.platformVisitorSession.findFirst({
      where: {
        utmCampaign: meta.utmCampaign,
        convertedToSignup: false,
        startedAt: { gte: new Date(Date.now() - 30 * 60_000) },
      },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });
    if (match) {
      await db.platformVisitorSession.update({
        where: { id: match.id },
        data: { convertedToSignup: true },
      });
      return true;
    }
  }

  return false;
}

// ---- Query functions for Platform Admin (/analytics) ----------------------------------------------------

export interface AnalyticsFilters {
  range?: string | null;
  from?: string | null;
  to?: string | null;
  campaign?: string | null;
  device?: string | null;
}

export interface AnalyticsSummary {
  totalVisitors: number;
  totalPageviews: number;
  fbAdVisitors: number;
  totalSignups: number;
  conversionRate: number;
  activeNow: number;
  activeErrors: number;
}

export interface CreativeAttributionRow {
  creative: string;
  visitors: number;
  signups: number;
  conversionRate: number;
}

export interface CampaignAttributionRow {
  campaign: string;
  source: string;
  visitors: number;
  signups: number;
  conversionRate: number;
  creatives: CreativeAttributionRow[];
  lastActive: Date;
}

export interface ConversionFunnel {
  visitors: number;
  wizardStarted: number;
  completedSignup: number;
  visitorToWizardRate: number;
  wizardToSignupRate: number;
  overallConversionRate: number;
}

export interface TrendDataPoint {
  label: string;
  visitors: number;
  signups: number;
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

export interface AnalyticsDashboardResult {
  summary: AnalyticsSummary;
  funnel: ConversionFunnel;
  trend: TrendDataPoint[];
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
  activeRange: {
    presetKey: string;
    from: string;
    to: string;
    label: string;
    days: number;
  };
  activeFilters: {
    campaign?: string | null;
    device?: string | null;
  };
}

export async function getAnalyticsDashboardData(filters?: AnalyticsFilters): Promise<AnalyticsDashboardResult> {
  const db = getPlatformPrisma();

  let resolvedRange: ResolvedReportRange;
  try {
    resolvedRange = resolveReportRange({
      range: filters?.range || "30",
      from: filters?.from,
      to: filters?.to,
    });
  } catch {
    resolvedRange = resolveReportRange({ range: "30" });
  }

  const startDate = new Date(`${resolvedRange.from}T00:00:00+06:00`);
  const endDate = new Date(`${resolvedRange.to}T23:59:59.999+06:00`);

  const cleanCampaign = filters?.campaign?.trim() || null;
  const cleanDevice = filters?.device?.trim() || null;

  const sessionWhere: any = {
    startedAt: { gte: startDate, lte: endDate },
  };
  if (cleanCampaign) {
    sessionWhere.utmCampaign = cleanCampaign;
  }
  if (cleanDevice) {
    sessionWhere.device = cleanDevice;
  }

  const eventWhere: any = {
    eventType: "PAGEVIEW",
    createdAt: { gte: startDate, lte: endDate },
  };
  if (cleanCampaign || cleanDevice) {
    eventWhere.session = {
      ...(cleanCampaign ? { utmCampaign: cleanCampaign } : {}),
      ...(cleanDevice ? { device: cleanDevice } : {}),
    };
  }

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  const [
    totalVisitors,
    totalPageviews,
    fbAdVisitors,
    convertedSessionCount,
    actualRealTenantsCount,
    activeNow,
    activeErrors,
    campaignRows,
    recentSessions,
    topPageviews,
    errorRows,
    sessionsForTrend,
    wizardStartedCount,
  ] = await Promise.all([
    db.platformVisitorSession.count({ where: sessionWhere }),
    db.platformVisitorEvent.count({ where: eventWhere }),
    db.platformVisitorSession.count({
      where: {
        ...sessionWhere,
        OR: [{ fbclid: { not: null } }, { utmSource: { in: ["fb", "facebook", "meta", "fb_ads", "ig", "instagram"] } }],
      },
    }),
    db.platformVisitorSession.count({ where: { ...sessionWhere, convertedToSignup: true } }),
    (!cleanCampaign && !cleanDevice)
      ? db.tenant.count({ where: { isDemo: false, createdAt: { gte: startDate, lte: endDate } } })
      : Promise.resolve(0),
    db.platformVisitorSession.count({ where: { lastActiveAt: { gte: fifteenMinutesAgo } } }),
    db.platformClientError.count({ where: { status: "NEW" } }),
    db.platformVisitorSession.groupBy({
      by: ["utmCampaign", "utmSource"],
      where: { ...sessionWhere, utmCampaign: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    }),
    db.platformVisitorSession.findMany({
      where: sessionWhere,
      orderBy: { startedAt: "desc" },
      take: 50,
      include: {
        _count: { select: { events: true } },
      },
    }),
    db.platformVisitorEvent.groupBy({
      by: ["pagePath"],
      where: eventWhere,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 15,
    }),
    db.platformClientError.findMany({
      where: { status: "NEW" },
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
    db.platformVisitorSession.findMany({
      where: sessionWhere,
      select: { startedAt: true, convertedToSignup: true },
    }),
    db.platformVisitorSession.count({
      where: {
        ...sessionWhere,
        OR: [
          { landingPage: { contains: "/start" } },
          { events: { some: { pagePath: { contains: "/start" } } } },
          { convertedToSignup: true },
        ],
      },
    }),
  ]);

  const campaigns: CampaignAttributionRow[] = await Promise.all(
    campaignRows.map(async (c) => {
      const campName = c.utmCampaign || "Direct / Unknown";
      const signups = await db.platformVisitorSession.count({
        where: {
          ...sessionWhere,
          utmCampaign: c.utmCampaign,
          convertedToSignup: true,
        },
      });
      const visitors = c._count.id;
      const rate = visitors > 0 ? Math.round((signups / visitors) * 1000) / 10 : 0;

      // Group by creative (utmContent)
      const creativeGroups = await db.platformVisitorSession.groupBy({
        by: ["utmContent"],
        where: {
          ...sessionWhere,
          utmCampaign: c.utmCampaign,
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      });

      const creatives: CreativeAttributionRow[] = await Promise.all(
        creativeGroups.map(async (cr) => {
          const crSignups = await db.platformVisitorSession.count({
            where: {
              ...sessionWhere,
              utmCampaign: c.utmCampaign,
              utmContent: cr.utmContent,
              convertedToSignup: true,
            },
          });
          const crVisitors = cr._count.id;
          const crRate = crVisitors > 0 ? Math.round((crSignups / crVisitors) * 1000) / 10 : 0;
          return {
            creative: cr.utmContent || "Default / Unspecified",
            visitors: crVisitors,
            signups: crSignups,
            conversionRate: crRate,
          };
        })
      );

      return {
        campaign: campName,
        source: c.utmSource || "Meta Ads",
        visitors,
        signups,
        conversionRate: rate,
        creatives,
        lastActive: new Date(),
      };
    })
  );

  const totalSignups = Math.max(convertedSessionCount, actualRealTenantsCount);
  const conversionRate = totalVisitors > 0 ? Math.round((totalSignups / totalVisitors) * 1000) / 10 : 0;

  const visitorToWizardRate = totalVisitors > 0 ? Math.round((wizardStartedCount / totalVisitors) * 1000) / 10 : 0;
  const wizardToSignupRate = wizardStartedCount > 0 ? Math.round((totalSignups / wizardStartedCount) * 1000) / 10 : 0;

  const funnel: ConversionFunnel = {
    visitors: totalVisitors,
    wizardStarted: wizardStartedCount,
    completedSignup: totalSignups,
    visitorToWizardRate,
    wizardToSignupRate,
    overallConversionRate: conversionRate,
  };

  let trend: TrendDataPoint[] = [];
  if (resolvedRange.days === 1) {
    const hourMap = new Map<number, { visitors: number; signups: number }>();
    for (let h = 0; h < 24; h++) {
      hourMap.set(h, { visitors: 0, signups: 0 });
    }
    for (const s of sessionsForTrend) {
      const hStr = new Intl.DateTimeFormat("en-GB", {
        timeZone: STORE_TZ,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(s.startedAt);
      const h = parseInt(hStr, 10);
      const bucket = hourMap.get(h);
      if (bucket) {
        bucket.visitors += 1;
        if (s.convertedToSignup) bucket.signups += 1;
      }
    }
    trend = Array.from({ length: 24 }, (_, h) => {
      const b = hourMap.get(h)!;
      return {
        label: `${h.toString().padStart(2, "0")}:00`,
        visitors: b.visitors,
        signups: b.signups,
      };
    });
  } else {
    const dateMap = new Map<string, { visitors: number; signups: number }>();
    let curr = resolvedRange.from;
    while (curr <= resolvedRange.to) {
      dateMap.set(curr, { visitors: 0, signups: 0 });
      curr = addDays(curr, 1);
    }
    for (const s of sessionsForTrend) {
      const dStr = dhakaDate(s.startedAt);
      const bucket = dateMap.get(dStr);
      if (bucket) {
        bucket.visitors += 1;
        if (s.convertedToSignup) bucket.signups += 1;
      }
    }
    trend = Array.from(dateMap.entries()).map(([dateStr, b]) => {
      const dObj = new Date(`${dateStr}T12:00:00Z`);
      const label = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(dObj);
      return {
        label,
        visitors: b.visitors,
        signups: b.signups,
      };
    });
  }

  return {
    summary: {
      totalVisitors,
      totalPageviews,
      fbAdVisitors,
      totalSignups,
      conversionRate,
      activeNow,
      activeErrors,
    },
    funnel,
    trend,
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
    activeRange: {
      presetKey: resolvedRange.presetKey,
      from: resolvedRange.from,
      to: resolvedRange.to,
      label: resolvedRange.label,
      days: resolvedRange.days,
    },
    activeFilters: {
      campaign: cleanCampaign,
      device: cleanDevice,
    },
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

/** Clean up known client noise errors that were previously recorded */
export async function purgeKnownNoiseErrors(): Promise<number> {
  const db = getPlatformPrisma();
  const res = await db.platformClientError.updateMany({
    where: {
      status: "NEW",
      OR: [
        { message: { contains: "Java object is gone", mode: "insensitive" } },
        { message: { contains: "Script error", mode: "insensitive" } },
        { message: { contains: "ResizeObserver loop", mode: "insensitive" } },
        { message: { contains: "Non-Error promise rejection", mode: "insensitive" } },
      ],
    },
    data: { status: "IGNORED" },
  });
  return res.count;
}
