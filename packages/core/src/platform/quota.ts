import { getPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { assertPlatformCan, type PlatformActor } from "./admin";

export interface QuotaAdjustmentView {
  id: string;
  tenantId: string;
  type: "SMS_CREDITS" | "PRODUCT_LIMIT" | "STAFF_LIMIT";
  amount: number;
  reason: string;
  actorId: string;
  createdAt: Date;
}

export interface AddQuotaAdjustmentInput {
  type: "SMS_CREDITS" | "PRODUCT_LIMIT" | "STAFF_LIMIT";
  amount: number;
  reason: string;
}

export interface Deps {
  db?: PrismaClient;
}

const dbOf = (d?: Deps) => d?.db ?? getPlatformPrisma();

/**
 * List all quota adjustments granted to a specific store.
 */
export async function listTenantQuotaAdjustments(
  actor: PlatformActor,
  tenantId: string,
  deps?: Deps,
): Promise<QuotaAdjustmentView[]> {
  const db = dbOf(deps);
  const rows = await db.tenantQuotaAdjustment.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    type: r.type as "SMS_CREDITS" | "PRODUCT_LIMIT" | "STAFF_LIMIT",
    amount: r.amount,
    reason: r.reason,
    actorId: r.actorId,
    createdAt: r.createdAt,
  }));
}

/**
 * Grant an instant quota top-up (SMS credits, Product capacity, or Staff slots) to a store.
 */
export async function addTenantQuotaAdjustment(
  actor: PlatformActor,
  tenantId: string,
  input: AddQuotaAdjustmentInput,
  deps?: Deps,
): Promise<QuotaAdjustmentView> {
  assertPlatformCan(actor, "adjust", "edit");
  const db = dbOf(deps);

  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundError("Store not found.");

  if (!input.amount || input.amount <= 0) {
    throw new ValidationError("Adjustment amount must be a positive number.");
  }
  if (!input.reason?.trim()) {
    throw new ValidationError("An audit reason must be supplied for manual quota overrides.");
  }

  const adj = await db.tenantQuotaAdjustment.create({
    data: {
      tenantId,
      type: input.type,
      amount: input.amount,
      reason: input.reason.trim(),
      actorId: actor.id,
    },
  });

  await db.platformAuditLog.create({
    data: {
      actorId: actor.id,
      action: "TENANT_QUOTA_ADJUSTED",
      tenantId,
      details: {
        type: input.type,
        amount: input.amount,
        reason: input.reason.trim(),
      },
      ipAddress: actor.ip ?? null,
    },
  });

  return {
    id: adj.id,
    tenantId: adj.tenantId,
    type: adj.type as "SMS_CREDITS" | "PRODUCT_LIMIT" | "STAFF_LIMIT",
    amount: adj.amount,
    reason: adj.reason,
    actorId: adj.actorId,
    createdAt: adj.createdAt,
  };
}

/**
 * Get cumulative bonus quota for a store.
 */
export async function getTenantBonusQuota(
  tenantId: string,
  deps?: Deps,
): Promise<{ smsCredits: number; productLimit: number; staffLimit: number }> {
  const db = dbOf(deps);
  const rows = await db.tenantQuotaAdjustment.findMany({
    where: { tenantId },
    select: { type: true, amount: true },
  });

  let smsCredits = 0;
  let productLimit = 0;
  let staffLimit = 0;

  for (const r of rows) {
    if (r.type === "SMS_CREDITS") smsCredits += r.amount;
    else if (r.type === "PRODUCT_LIMIT") productLimit += r.amount;
    else if (r.type === "STAFF_LIMIT") staffLimit += r.amount;
  }

  return { smsCredits, productLimit, staffLimit };
}
