import { Prisma, withTenant } from "@biztrackbd/db";
import { z } from "zod";
import { audit } from "../audit/service";
import { NotFoundError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";

export type CouponStatus = "scheduled" | "active" | "expired" | "used_up" | "off";

/** What the discounts screen shows for a coupon right now. */
export function couponStatus(c: { isActive: boolean; startsAt: Date; expiresAt: Date | null; usageLimit: number | null; usageCount: number }, now = new Date()): CouponStatus {
  if (!c.isActive) return "off";
  if (c.expiresAt && c.expiresAt < now) return "expired";
  if (c.usageLimit != null && c.usageCount >= c.usageLimit) return "used_up";
  if (c.startsAt > now) return "scheduled";
  return "active";
}

export const CouponInput = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,20}$/, "Use 3 to 20 letters, numbers, dashes or underscores"),
    type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"]),
    value: z.number().min(0).max(1_000_000),
    minOrderValue: z.number().min(0).max(10_000_000).nullable().optional(),
    usageLimit: z.number().int().min(1).max(10_000_000).nullable().optional(),
    perCustomerLimit: z.number().int().min(1).max(1000).default(1),
    startsAt: z.date().optional(),
    expiresAt: z.date().nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .superRefine((c, ctx) => {
    if (c.type === "PERCENTAGE" && (c.value <= 0 || c.value > 100)) ctx.addIssue({ code: "custom", path: ["value"], message: "A percentage must be between 1 and 100" });
    if (c.type === "FIXED_AMOUNT" && c.value <= 0) ctx.addIssue({ code: "custom", path: ["value"], message: "Enter the amount in taka" });
    if (c.startsAt && c.expiresAt && c.expiresAt <= c.startsAt) ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "The end date must be after the start date" });
  });
export type CouponInput = z.input<typeof CouponInput>;

export async function listCoupons(tenantId: string, actor: StaffActor) {
  assertCan(actor, "marketing", "view");
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.coupon.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((c) => ({
      id: c.id, code: c.code, type: c.type, value: Number(c.value), minOrderValue: c.minOrderValue != null ? Number(c.minOrderValue) : null,
      usageLimit: c.usageLimit, usageCount: c.usageCount, perCustomerLimit: c.perCustomerLimit, startsAt: c.startsAt, expiresAt: c.expiresAt,
      isActive: c.isActive, status: couponStatus(c),
    }));
  });
}

export async function saveCoupon(tenantId: string, actor: StaffActor, raw: unknown, couponId?: string): Promise<{ id: string }> {
  assertCan(actor, "marketing", "edit");
  const parsed = CouponInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid coupon", { field: String(parsed.error.issues[0]?.path[0] ?? "") });
  const c = parsed.data;
  const data = {
    code: c.code, type: c.type, value: c.type === "FREE_SHIPPING" ? 0 : c.value, minOrderValue: c.minOrderValue ?? null, usageLimit: c.usageLimit ?? null,
    perCustomerLimit: c.perCustomerLimit, startsAt: c.startsAt ?? new Date(), expiresAt: c.expiresAt ?? null, isActive: c.isActive,
  };
  try {
    return await withTenant(tenantId, async (tx) => {
      if (couponId) {
        const { count } = await tx.coupon.updateMany({ where: { id: couponId }, data });
        if (count === 0) throw new NotFoundError("Coupon");
        await audit(tx, tenantId, actor, "coupon.updated", { code: c.code });
        return { id: couponId };
      }
      const created = await tx.coupon.create({ data: { tenantId, ...data } });
      await audit(tx, tenantId, actor, "coupon.created", { code: c.code, type: c.type, value: data.value });
      return { id: created.id };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ValidationError("You already have a coupon with that code", { field: "code" });
    throw e;
  }
}

export async function setCouponActive(tenantId: string, actor: StaffActor, couponId: string, active: boolean): Promise<void> {
  assertCan(actor, "marketing", "edit");
  await withTenant(tenantId, async (tx) => {
    const c = await tx.coupon.findFirst({ where: { id: couponId } });
    if (!c) throw new NotFoundError("Coupon");
    await tx.coupon.update({ where: { id: couponId }, data: { isActive: active } });
    await audit(tx, tenantId, actor, active ? "coupon.enabled" : "coupon.disabled", { code: c.code });
  });
}

/** Unused coupons are deleted. A coupon that has been used is switched off instead, so past orders keep their reference. */
export async function deleteCoupon(tenantId: string, actor: StaffActor, couponId: string): Promise<"deleted" | "disabled"> {
  assertCan(actor, "marketing", "edit");
  return withTenant(tenantId, async (tx) => {
    const c = await tx.coupon.findFirst({ where: { id: couponId } });
    if (!c) throw new NotFoundError("Coupon");
    const used = await tx.order.count({ where: { couponId } });
    if (used > 0 || c.usageCount > 0) {
      await tx.coupon.update({ where: { id: couponId }, data: { isActive: false } });
      await audit(tx, tenantId, actor, "coupon.disabled", { code: c.code, reason: "already used" });
      return "disabled";
    }
    await tx.coupon.delete({ where: { id: couponId } });
    await audit(tx, tenantId, actor, "coupon.deleted", { code: c.code });
    return "deleted";
  });
}
