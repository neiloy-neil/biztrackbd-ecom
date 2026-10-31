import { describe, it, expect } from "vitest";
import { calculatePlanCharge } from "../src/platform/billing";
import type { PlanView } from "../src/platform/billing";

describe("Subscription Stacking and Prorated Upgrades", () => {
  const starter: PlanView = {
    tier: "STARTER",
    name: "Starter",
    priceMonthly: 699,
    priceYearly: 6990,
    trialDays: 14,
    yearlyMonthsFree: 2,
    limits: { products: 300, ordersPerMonth: 500, staff: 2, storageGb: 5, smsCredits: 200, landingPages: 3 },
    features: { capi: true, fraud: "basic", modules: 0, customDomain: false, courierBooking: "manual", paymentGateway: false, sectionBuilder: "settings" },
  };

  const pro: PlanView = {
    tier: "PRO",
    name: "Pro",
    priceMonthly: 1499,
    priceYearly: 14990,
    trialDays: 14,
    yearlyMonthsFree: 2,
    limits: { products: 2000, ordersPerMonth: 3000, staff: 5, storageGb: 20, smsCredits: 1000, landingPages: 20 },
    features: { capi: true, fraud: "full", modules: 3, customDomain: true, courierBooking: "auto", paymentGateway: false, sectionBuilder: "home" },
  };

  it("stacks 30 days onto currentPeriodEnd when renewing the same plan early", () => {
    const now = new Date("2026-11-01T00:00:00Z");
    const existingEnd = new Date("2026-12-01T00:00:00Z");
    const sub = {
      planTier: "STARTER",
      interval: "MONTHLY",
      amount: 699,
      currentPeriodStart: new Date("2026-10-31T00:00:00Z"),
      currentPeriodEnd: existingEnd,
    };

    const quote = calculatePlanCharge(sub, starter, "MONTHLY", now);
    expect(quote.isRenewal).toBe(true);
    expect(quote.isUpgrade).toBe(false);
    expect(quote.amountToPay).toBe(699);
    expect(quote.creditApplied).toBe(0);
    expect(quote.newPeriodStart.toISOString()).toBe(existingEnd.toISOString());
    // December + 1 month = January 1, 2027
    expect(quote.newPeriodEnd.getUTCFullYear()).toBe(2027);
    expect(quote.newPeriodEnd.getUTCMonth()).toBe(0); // Jan
    expect(quote.newPeriodEnd.getUTCDate()).toBe(1);
  });

  it("prorates unused days from starter plan as credit when upgrading mid-cycle to pro", () => {
    // 30 day month: started Oct 1, ends Oct 31. Upgrades on Oct 16 (halfway through = 50% unused)
    const periodStart = new Date("2026-10-01T00:00:00Z");
    const periodEnd = new Date("2026-10-31T00:00:00Z");
    const now = new Date("2026-10-16T00:00:00Z");

    const sub = {
      planTier: "STARTER",
      interval: "MONTHLY",
      amount: 600, // 600 for easy 50% calculation
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    };

    const quote = calculatePlanCharge(sub, pro, "MONTHLY", now);
    expect(quote.isUpgrade).toBe(true);
    expect(quote.isRenewal).toBe(false);
    // 15 days remaining of 30 days = 50% unused credit = 300 BDT
    expect(quote.creditApplied).toBe(300);
    // Pro price 1499 - 300 = 1199 BDT
    expect(quote.amountToPay).toBe(1499 - 300);
    // Cycle starts now
    expect(quote.newPeriodStart.toISOString()).toBe(now.toISOString());
  });

  it("charges standard full price when store is on free trial or expired", () => {
    const quote = calculatePlanCharge(null, starter, "MONTHLY");
    expect(quote.isRenewal).toBe(false);
    expect(quote.isUpgrade).toBe(false);
    expect(quote.amountToPay).toBe(699);
    expect(quote.creditApplied).toBe(0);
  });
});
