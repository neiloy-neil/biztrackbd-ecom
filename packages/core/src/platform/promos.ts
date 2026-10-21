import { getPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import type { PlatformActor } from "./admin";

export interface SubscriptionPromoView {
  id: string;
  code: string;
  discountType: "PERCENTAGE" | "FIXED_BDT";
  discountValue: number;
  applicableTiers: string[];
  billingInterval: "ANY" | "MONTHLY" | "YEARLY";
  maxUses: number | null;
  usedCount: number;
  validFrom: Date;
  validUntil: Date | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
}

export interface CreateSubscriptionPromoInput {
  code: string;
  discountType: "PERCENTAGE" | "FIXED_BDT";
  discountValue: number;
  applicableTiers?: string[];
  billingInterval?: "ANY" | "MONTHLY" | "YEARLY";
  maxUses?: number | null;
  validUntil?: Date | null;
}

export interface PromoValidationResult {
  valid: boolean;
  promoId?: string;
  code: string;
  discountType: "PERCENTAGE" | "FIXED_BDT";
  discountValue: number;
  discountAmountBdt: number;
  finalPriceBdt: number;
  message?: string;
}

export interface Deps {
  db?: PrismaClient;
}

const dbOf = (d?: Deps) => d?.db ?? getPlatformPrisma();

function assertCanManagePlans(actor: PlatformActor): void {
  if (actor.role !== "OWNER" && actor.role !== "FINANCE") {
    throw new ForbiddenError();
  }
}

/**
 * List all subscription promo codes for platform staff.
 */
export async function listSubscriptionPromos(actor: PlatformActor, deps?: Deps): Promise<SubscriptionPromoView[]> {
  const db = dbOf(deps);
  const rows = await db.subscriptionPromo.findMany({
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    discountType: r.discountType as "PERCENTAGE" | "FIXED_BDT",
    discountValue: Number(r.discountValue),
    applicableTiers: r.applicableTiers,
    billingInterval: r.billingInterval as "ANY" | "MONTHLY" | "YEARLY",
    maxUses: r.maxUses,
    usedCount: r.usedCount,
    validFrom: r.validFrom,
    validUntil: r.validUntil,
    isActive: r.isActive,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
  }));
}

/**
 * Create a new subscription promo code.
 */
export async function createSubscriptionPromo(
  actor: PlatformActor,
  input: CreateSubscriptionPromoInput,
  deps?: Deps,
): Promise<SubscriptionPromoView> {
  assertCanManagePlans(actor);
  const db = dbOf(deps);

  const cleanCode = input.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (!cleanCode || cleanCode.length < 3) {
    throw new ValidationError("Promo code must be at least 3 alphanumeric characters.");
  }

  if (input.discountValue <= 0) {
    throw new ValidationError("Discount value must be greater than zero.");
  }

  if (input.discountType === "PERCENTAGE" && input.discountValue > 100) {
    throw new ValidationError("Percentage discount cannot exceed 100%.");
  }

  const existing = await db.subscriptionPromo.findUnique({ where: { code: cleanCode } });
  if (existing) {
    throw new ValidationError(`Promo code "${cleanCode}" already exists.`);
  }

  let promo: Awaited<ReturnType<typeof db.subscriptionPromo.create>>;
  try {
    promo = await db.subscriptionPromo.create({
      data: {
        code: cleanCode,
        discountType: input.discountType,
        discountValue: input.discountValue,
        applicableTiers: input.applicableTiers && input.applicableTiers.length > 0 ? input.applicableTiers : ["ALL"],
        billingInterval: input.billingInterval ?? "ANY",
        maxUses: input.maxUses ?? null,
        validUntil: input.validUntil ?? null,
        isActive: true,
        createdBy: actor.email,
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new ValidationError(`Promo code "${cleanCode}" already exists.`);
    throw e;
  }

  await db.platformAuditLog.create({
    data: {
      actorId: actor.id,
      action: "SUBSCRIPTION_PROMO_CREATED",
      details: {
        code: cleanCode,
        discountType: input.discountType,
        discountValue: input.discountValue,
      },
      ipAddress: actor.ip ?? null,
    },
  });

  return {
    id: promo.id,
    code: promo.code,
    discountType: promo.discountType as "PERCENTAGE" | "FIXED_BDT",
    discountValue: Number(promo.discountValue),
    applicableTiers: promo.applicableTiers,
    billingInterval: promo.billingInterval as "ANY" | "MONTHLY" | "YEARLY",
    maxUses: promo.maxUses,
    usedCount: promo.usedCount,
    validFrom: promo.validFrom,
    validUntil: promo.validUntil,
    isActive: promo.isActive,
    createdBy: promo.createdBy,
    createdAt: promo.createdAt,
  };
}

/**
 * Toggle a promo code active/inactive.
 */
export async function toggleSubscriptionPromo(
  actor: PlatformActor,
  id: string,
  isActive: boolean,
  deps?: Deps,
): Promise<{ ok: true }> {
  assertCanManagePlans(actor);
  const db = dbOf(deps);

  const promo = await db.subscriptionPromo.findUnique({ where: { id } });
  if (!promo) throw new NotFoundError("Subscription promo code not found.");

  await db.subscriptionPromo.update({
    where: { id },
    data: { isActive },
  });

  await db.platformAuditLog.create({
    data: {
      actorId: actor.id,
      action: isActive ? "SUBSCRIPTION_PROMO_ACTIVATED" : "SUBSCRIPTION_PROMO_DEACTIVATED",
      details: { id, code: promo.code },
      ipAddress: actor.ip ?? null,
    },
  });

  return { ok: true };
}

/**
 * Delete a promo code.
 */
export async function deleteSubscriptionPromo(
  actor: PlatformActor,
  id: string,
  deps?: Deps,
): Promise<{ ok: true }> {
  assertCanManagePlans(actor);
  const db = dbOf(deps);

  const promo = await db.subscriptionPromo.findUnique({ where: { id } });
  if (!promo) throw new NotFoundError("Subscription promo code not found.");

  await db.subscriptionPromo.delete({ where: { id } });

  await db.platformAuditLog.create({
    data: {
      actorId: actor.id,
      action: "SUBSCRIPTION_PROMO_DELETED",
      details: { id, code: promo.code },
      ipAddress: actor.ip ?? null,
    },
  });

  return { ok: true };
}

/**
 * Validate a promo code at checkout or subscription upgrade time.
 */
export async function validateSubscriptionPromo(
  code: string,
  tier: string,
  interval: "MONTHLY" | "YEARLY",
  basePriceBdt: number,
  deps?: Deps,
): Promise<PromoValidationResult> {
  const clean = code.trim().toUpperCase();
  if (!clean) {
    return {
      valid: false,
      code,
      discountType: "FIXED_BDT",
      discountValue: 0,
      discountAmountBdt: 0,
      finalPriceBdt: basePriceBdt,
      message: "Please enter a valid coupon code.",
    };
  }

  const db = dbOf(deps);
  const promo = await db.subscriptionPromo.findUnique({ where: { code: clean } });

  if (!promo || !promo.isActive) {
    return {
      valid: false,
      code: clean,
      discountType: "FIXED_BDT",
      discountValue: 0,
      discountAmountBdt: 0,
      finalPriceBdt: basePriceBdt,
      message: "Coupon code is invalid or has expired.",
    };
  }

  const now = new Date();
  if (promo.validUntil && promo.validUntil < now) {
    return {
      valid: false,
      code: clean,
      discountType: "FIXED_BDT",
      discountValue: 0,
      discountAmountBdt: 0,
      finalPriceBdt: basePriceBdt,
      message: "This coupon code has expired.",
    };
  }

  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return {
      valid: false,
      code: clean,
      discountType: "FIXED_BDT",
      discountValue: 0,
      discountAmountBdt: 0,
      finalPriceBdt: basePriceBdt,
      message: "This coupon code has reached its maximum redemption limit.",
    };
  }

  const targetTier = tier.toUpperCase();
  if (
    !promo.applicableTiers.includes("ALL") &&
    !promo.applicableTiers.map((t) => t.toUpperCase()).includes(targetTier)
  ) {
    return {
      valid: false,
      code: clean,
      discountType: "FIXED_BDT",
      discountValue: 0,
      discountAmountBdt: 0,
      finalPriceBdt: basePriceBdt,
      message: `Coupon code is not valid for the ${tier} plan.`,
    };
  }

  if (promo.billingInterval !== "ANY" && promo.billingInterval.toUpperCase() !== interval.toUpperCase()) {
    return {
      valid: false,
      code: clean,
      discountType: "FIXED_BDT",
      discountValue: 0,
      discountAmountBdt: 0,
      finalPriceBdt: basePriceBdt,
      message: `Coupon code is only valid for ${promo.billingInterval.toLowerCase()} billing.`,
    };
  }

  const discountVal = Number(promo.discountValue);
  let discountAmountBdt = 0;

  if (promo.discountType === "PERCENTAGE") {
    discountAmountBdt = Math.round((basePriceBdt * discountVal) / 100);
  } else {
    discountAmountBdt = Math.min(basePriceBdt, discountVal);
  }

  const finalPriceBdt = Math.max(0, basePriceBdt - discountAmountBdt);

  return {
    valid: true,
    promoId: promo.id,
    code: promo.code,
    discountType: promo.discountType as "PERCENTAGE" | "FIXED_BDT",
    discountValue: discountVal,
    discountAmountBdt,
    finalPriceBdt,
  };
}
