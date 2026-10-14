import { getPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { ForbiddenError, NotFoundError } from "../errors";
import { APP_CATALOG, type AppCatalogItem } from "../modules/catalog";
import type { PlatformActor } from "./admin";

export interface ManagedAppCatalogItem extends AppCatalogItem {
  storesActive: number;
  isGloballyDisabled: boolean;
  maintenanceReason?: string;
  effectiveMinPlan: "STARTER" | "PRO" | "BUSINESS";
}

export interface Deps {
  db?: PrismaClient;
}

const dbOf = (d?: Deps) => d?.db ?? getPlatformPrisma();

function assertCanManageModules(actor: PlatformActor): void {
  if (actor.role !== "OWNER" && actor.role !== "SUPPORT_LEAD") {
    throw new ForbiddenError();
  }
}

/**
 * Retrieve the complete App Catalog enriched with live store adoption telemetry,
 * emergency maintenance kill-switches, and plan tier overrides.
 */
export async function getAppCatalogWithTelemetry(
  actor: PlatformActor,
  deps?: Deps,
): Promise<ManagedAppCatalogItem[]> {
  const db = dbOf(deps);

  // 1. Fetch active counts per module across tenants
  const moduleCounts = await db.tenantModule.groupBy({
    by: ["moduleKey"],
    where: { isEnabled: true },
    _count: { id: true },
  });

  const countMap = new Map(moduleCounts.map((m) => [m.moduleKey, m._count.id]));

  // 2. Fetch platform config overrides for modules
  const configRows = await db.platformConfig.findMany({
    where: {
      OR: [
        { key: { startsWith: "module_maintenance_" } },
        { key: { startsWith: "module_tier_override_" } },
      ],
    },
  });

  const configMap = new Map(configRows.map((r) => [r.key, r.value]));

  return APP_CATALOG.map((item) => {
    const maintenanceVal = configMap.get(`module_maintenance_${item.key}`);
    const tierOverrideVal = configMap.get(`module_tier_override_${item.key}`) as
      | "STARTER"
      | "PRO"
      | "BUSINESS"
      | undefined;

    let isGloballyDisabled = false;
    let maintenanceReason: string | undefined;

    if (maintenanceVal) {
      try {
        const parsed = JSON.parse(maintenanceVal) as { disabled: boolean; reason?: string };
        isGloballyDisabled = Boolean(parsed.disabled);
        maintenanceReason = parsed.reason;
      } catch {
        isGloballyDisabled = maintenanceVal === "true";
      }
    }

    const effectiveMinPlan = tierOverrideVal || item.minPlan || "PRO";

    return {
      ...item,
      storesActive: countMap.get(item.key) ?? 0,
      isGloballyDisabled,
      maintenanceReason,
      effectiveMinPlan,
    };
  });
}

/**
 * Toggle emergency platform-wide maintenance kill-switch for an app/module.
 */
export async function toggleGlobalModuleMaintenance(
  actor: PlatformActor,
  moduleKey: string,
  isUnderMaintenance: boolean,
  reason?: string,
  deps?: Deps,
): Promise<{ ok: true }> {
  assertCanManageModules(actor);
  const db = dbOf(deps);

  const exists = APP_CATALOG.some((a) => a.key === moduleKey);
  if (!exists) throw new NotFoundError(`App with key "${moduleKey}" does not exist in catalog.`);

  const configKey = `module_maintenance_${moduleKey}`;

  if (isUnderMaintenance) {
    await db.platformConfig.upsert({
      where: { key: configKey },
      create: {
        key: configKey,
        value: JSON.stringify({ disabled: true, reason: reason?.trim() || "Under scheduled maintenance." }),
        description: `Emergency maintenance kill-switch for ${moduleKey}`,
        updatedBy: actor.email,
      },
      update: {
        value: JSON.stringify({ disabled: true, reason: reason?.trim() || "Under scheduled maintenance." }),
        updatedBy: actor.email,
      },
    });
  } else {
    await db.platformConfig.deleteMany({ where: { key: configKey } });
  }

  await db.platformAuditLog.create({
    data: {
      actorId: actor.id,
      action: isUnderMaintenance ? "MODULE_MAINTENANCE_ENABLED" : "MODULE_MAINTENANCE_DISABLED",
      details: { moduleKey, isUnderMaintenance, reason },
      ipAddress: actor.ip ?? null,
    },
  });

  return { ok: true };
}

/**
 * Override the required plan tier for an app platform-wide.
 */
export async function setModulePlanOverride(
  actor: PlatformActor,
  moduleKey: string,
  minPlan: "STARTER" | "PRO" | "BUSINESS" | "DEFAULT",
  deps?: Deps,
): Promise<{ ok: true }> {
  assertCanManageModules(actor);
  const db = dbOf(deps);

  const exists = APP_CATALOG.some((a) => a.key === moduleKey);
  if (!exists) throw new NotFoundError(`App with key "${moduleKey}" does not exist in catalog.`);

  const configKey = `module_tier_override_${moduleKey}`;

  if (minPlan === "DEFAULT") {
    await db.platformConfig.deleteMany({ where: { key: configKey } });
  } else {
    await db.platformConfig.upsert({
      where: { key: configKey },
      create: {
        key: configKey,
        value: minPlan,
        description: `Plan tier requirement override for ${moduleKey}`,
        updatedBy: actor.email,
      },
      update: {
        value: minPlan,
        updatedBy: actor.email,
      },
    });
  }

  await db.platformAuditLog.create({
    data: {
      actorId: actor.id,
      action: "MODULE_TIER_OVERRIDE_CHANGED",
      details: { moduleKey, minPlan },
      ipAddress: actor.ip ?? null,
    },
  });

  return { ok: true };
}
