import { getPlatformPrisma, withTenant, type PrismaClient, type Prisma } from "@biztrackbd/db";
import { assertPlatformCan, type PlatformActor } from "./admin";
import { ValidationError } from "../errors";

export type AnnouncementAudienceType = "ALL" | "PLAN" | "INTEGRATION" | "TENANT";

export interface AnnouncementAudience {
  type: AnnouncementAudienceType;
  value?: string;
}

export interface CreateAnnouncementInput {
  title: string;
  titleBn?: string | null;
  body: string;
  bodyBn?: string | null;
  audience: AnnouncementAudience;
  channels?: string[];
  startsAt?: Date;
  endsAt?: Date | null;
}

export interface AnnouncementView {
  id: string;
  title: string;
  titleBn: string | null;
  body: string;
  bodyBn: string | null;
  audience: AnnouncementAudience;
  channels: string[];
  startsAt: Date;
  endsAt: Date | null;
  createdBy: string;
  createdAt: Date;
  status: "LIVE" | "ENDED" | "SCHEDULED";
  reachEstimate: number;
}

export interface Deps {
  db?: PrismaClient;
  now?: Date;
}

const dbOf = (d?: Deps) => d?.db ?? getPlatformPrisma();
const nowOf = (d?: Deps) => d?.now ?? new Date();

function statusOf(startsAt: Date, endsAt: Date | null, now: Date): "LIVE" | "ENDED" | "SCHEDULED" {
  if (startsAt > now) return "SCHEDULED";
  if (endsAt && endsAt <= now) return "ENDED";
  return "LIVE";
}

/** Calculate how many active stores match this announcement's audience filter. */
export async function countAudienceReach(audience: AnnouncementAudience, deps?: Deps): Promise<number> {
  const db = dbOf(deps);
  if (audience.type === "ALL") {
    return db.tenant.count({ where: { isDemo: false, status: { not: "SUSPENDED" } } });
  }
  if (audience.type === "PLAN" && audience.value) {
    return db.tenant.count({ where: { isDemo: false, planTier: audience.value as never, status: { not: "SUSPENDED" } } });
  }
  if (audience.type === "TENANT" && audience.value) {
    return 1;
  }
  if (audience.type === "INTEGRATION" && audience.value) {
    return db.tenantIntegration.count({ where: { provider: audience.value, mode: "LIVE" } });
  }
  return 0;
}

/** List all platform announcements with computed status and reach estimates. */
export async function listAnnouncements(actor: PlatformActor, deps?: Deps): Promise<AnnouncementView[]> {
  assertPlatformCan(actor, "announcements", "view");
  const db = dbOf(deps);
  const now = nowOf(deps);

  const rows = await db.announcement.findMany({
    orderBy: { createdAt: "desc" },
  });

  const totalStores = await db.tenant.count({ where: { isDemo: false, status: { not: "SUSPENDED" } } });

  return Promise.all(
    rows.map(async (r) => {
      const aud = (r.audience && typeof r.audience === "object" ? ((r.audience as unknown) as AnnouncementAudience) : { type: "ALL" }) as AnnouncementAudience;
      let reach = totalStores;
      if (aud.type !== "ALL") {
        reach = await countAudienceReach(aud, deps);
      }
      return {
        id: r.id,
        title: r.title,
        titleBn: r.titleBn,
        body: r.body,
        bodyBn: r.bodyBn,
        audience: aud,
        channels: r.channels,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        createdBy: r.createdBy,
        createdAt: r.createdAt,
        status: statusOf(r.startsAt, r.endsAt, now),
        reachEstimate: reach,
      };
    })
  );
}

/** Create a new platform announcement and record an audit log entry. */
export async function createAnnouncement(
  actor: PlatformActor,
  input: CreateAnnouncementInput,
  deps?: Deps
): Promise<AnnouncementView> {
  assertPlatformCan(actor, "announcements", "edit");
  const title = input.title?.trim();
  const body = input.body?.trim();
  if (!title) throw new ValidationError("Title is required");
  if (!body) throw new ValidationError("Message body is required");

  const db = dbOf(deps);
  const now = nowOf(deps);
  const startsAt = input.startsAt ?? now;
  const endsAt = input.endsAt ?? null;
  const audience = input.audience || { type: "ALL" };
  const channels = input.channels && input.channels.length > 0 ? input.channels : ["BANNER"];

  const created = await db.$transaction(async (tx) => {
    const row = await tx.announcement.create({
      data: {
        title,
        titleBn: input.titleBn?.trim() || null,
        body,
        bodyBn: input.bodyBn?.trim() || null,
        audience: audience as unknown as Prisma.InputJsonValue,
        channels,
        startsAt,
        endsAt,
        createdBy: actor.email,
      },
    });

    await tx.platformAuditLog.create({
      data: {
        actorId: actor.id,
        action: "announcement.created",
        tenantId: audience.type === "TENANT" ? audience.value ?? null : null,
        details: { title, audience: audience as unknown as Prisma.InputJsonValue, channels, startsAt: startsAt.toISOString(), endsAt: endsAt?.toISOString() ?? null },
        ipAddress: actor.ip ?? null,
      },
    });

    return row;
  });

  const reach = await countAudienceReach(audience, deps);

  return {
    id: created.id,
    title: created.title,
    titleBn: created.titleBn,
    body: created.body,
    bodyBn: created.bodyBn,
    audience,
    channels: created.channels,
    startsAt: created.startsAt,
    endsAt: created.endsAt,
    createdBy: created.createdBy,
    createdAt: created.createdAt,
    status: statusOf(created.startsAt, created.endsAt, now),
    reachEstimate: reach,
  };
}

/**
 * Fetch active announcements relevant to a specific tenant.
 * Used by Store Admin (apps/admin) to render dismissible banners.
 */
export async function getActiveAnnouncementsForTenant(
  tenantId: string,
  deps?: Deps
): Promise<{ id: string; title: string; titleBn: string | null; body: string; bodyBn: string | null; startsAt: Date }[]> {
  const db = dbOf(deps);
  const now = nowOf(deps);

  return withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, planTier: true },
    });
    if (!tenant) return [];

    const activeRows = await tx.announcement.findMany({
      where: {
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      orderBy: { startsAt: "desc" },
    });

    // Check if tenant has integrations if any announcement needs it
    const hasIntegrationNeed = activeRows.some((r) => {
      const a = (r.audience as unknown) as AnnouncementAudience | null;
      return a?.type === "INTEGRATION";
    });

    let integrations = new Set<string>();
    if (hasIntegrationNeed) {
      const rows = await tx.tenantIntegration.findMany({
        where: { tenantId, mode: "LIVE" },
        select: { provider: true },
      });
      integrations = new Set(rows.map((i) => i.provider));
    }

    const matched = activeRows.filter((r) => {
      const a = (r.audience && typeof r.audience === "object" ? ((r.audience as unknown) as AnnouncementAudience) : { type: "ALL" }) as AnnouncementAudience;
      if (a.type === "ALL") return true;
      if (a.type === "TENANT") return a.value === tenantId;
      if (a.type === "PLAN") return a.value === tenant.planTier;
      if (a.type === "INTEGRATION" && a.value) return integrations.has(a.value);
      return false;
    });

    return matched.map((m) => ({
      id: m.id,
      title: m.title,
      titleBn: m.titleBn,
      body: m.body,
      bodyBn: m.bodyBn,
      startsAt: m.startsAt,
    }));
  });
}
