import { CouponError } from "../errors";

/**
 * The money rules, in one place. createOrder (which charges) and quoteOrder (which previews at checkout) both use these,
 * so what a customer sees is what they are charged.
 */

export const money = (n: number): number => Math.round(n * 100) / 100;

export interface ZoneLike {
  name: string;
  districts: string[];
  rate: { toString(): string } | number;
  freeOverAmount: { toString(): string } | number | null;
  etaMinDays?: number;
  etaMaxDays?: number;
}

/** Exact district match first (case-insensitive), then the catch-all "*" zone. */
export function pickZone<Z extends ZoneLike>(zones: Z[], district: string): Z | undefined {
  const d = district.trim().toLowerCase();
  return zones.find((z) => z.districts.some((x) => x.toLowerCase() === d)) ?? zones.find((z) => z.districts.includes("*"));
}

export function deliveryFor(zone: ZoneLike, subtotal: number): number {
  if (zone.freeOverAmount != null && subtotal >= Number(zone.freeOverAmount)) return 0;
  return Number(zone.rate);
}

export interface CouponLike {
  code: string;
  type: string;
  value: { toString(): string } | number;
  minOrderValue: { toString(): string } | number | null;
  isActive: boolean;
  startsAt: Date;
  expiresAt: Date | null;
}

/** Throws a plain-language CouponError if the code cannot be used on this subtotal right now. */
export function assertCouponUsable(c: CouponLike | null | undefined, subtotal: number, now = new Date()): asserts c is CouponLike {
  if (!c || !c.isActive || c.startsAt > now || (c.expiresAt && c.expiresAt < now)) throw new CouponError("That coupon code is not valid");
  if (c.minOrderValue != null && subtotal < Number(c.minOrderValue)) {
    throw new CouponError(`Spend at least ৳${Number(c.minOrderValue)} to use this coupon`);
  }
}

export function discountFor(c: CouponLike, subtotal: number): { discount: number; freeShipping: boolean } {
  if (c.type === "PERCENTAGE") return { discount: money((subtotal * Number(c.value)) / 100), freeShipping: false };
  if (c.type === "FIXED_AMOUNT") return { discount: Math.min(Number(c.value), subtotal), freeShipping: false };
  if (c.type === "FREE_SHIPPING") return { discount: 0, freeShipping: true };
  return { discount: 0, freeShipping: false };
}
