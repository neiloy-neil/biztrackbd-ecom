import { describe, it, expect, vi } from "vitest";
import {
  validateSubscriptionPromo,
  type SubscriptionPromoView,
} from "../src/platform/promos";

describe("Platform Admin Suite - Subscription Promos & Quota Overrides", () => {
  describe("validateSubscriptionPromo", () => {
    const mockDb = {
      subscriptionPromo: {
        findUnique: vi.fn(),
      },
    } as any;

    it("rejects blank or invalid promo code", async () => {
      const res = await validateSubscriptionPromo("", "PRO", "MONTHLY", 2499, { db: mockDb });
      expect(res.valid).toBe(false);
      expect(res.message).toMatch(/valid coupon code/i);
    });

    it("rejects non-existent or inactive promo", async () => {
      mockDb.subscriptionPromo.findUnique.mockResolvedValueOnce(null);
      const res = await validateSubscriptionPromo("NONEXISTENT", "PRO", "MONTHLY", 2499, { db: mockDb });
      expect(res.valid).toBe(false);
      expect(res.message).toMatch(/invalid or has expired/i);
    });

    it("calculates percentage discount accurately", async () => {
      mockDb.subscriptionPromo.findUnique.mockResolvedValueOnce({
        id: "p1",
        code: "EID50",
        discountType: "PERCENTAGE",
        discountValue: 50,
        applicableTiers: ["ALL"],
        billingInterval: "ANY",
        maxUses: null,
        usedCount: 10,
        validUntil: null,
        isActive: true,
      });

      const res = await validateSubscriptionPromo("EID50", "PRO", "MONTHLY", 2000, { db: mockDb });
      expect(res.valid).toBe(true);
      expect(res.discountAmountBdt).toBe(1000);
      expect(res.finalPriceBdt).toBe(1000);
    });

    it("calculates fixed BDT discount accurately", async () => {
      mockDb.subscriptionPromo.findUnique.mockResolvedValueOnce({
        id: "p2",
        code: "FLAT500",
        discountType: "FIXED_BDT",
        discountValue: 500,
        applicableTiers: ["ALL"],
        billingInterval: "ANY",
        maxUses: null,
        usedCount: 2,
        validUntil: null,
        isActive: true,
      });

      const res = await validateSubscriptionPromo("FLAT500", "PRO", "MONTHLY", 2499, { db: mockDb });
      expect(res.valid).toBe(true);
      expect(res.discountAmountBdt).toBe(500);
      expect(res.finalPriceBdt).toBe(1999);
    });

    it("restricts promo code to applicable plan tiers", async () => {
      mockDb.subscriptionPromo.findUnique.mockResolvedValueOnce({
        id: "p3",
        code: "PROONLY",
        discountType: "PERCENTAGE",
        discountValue: 20,
        applicableTiers: ["PRO"],
        billingInterval: "ANY",
        maxUses: null,
        usedCount: 0,
        validUntil: null,
        isActive: true,
      });

      const res = await validateSubscriptionPromo("PROONLY", "STARTER", "MONTHLY", 999, { db: mockDb });
      expect(res.valid).toBe(false);
      expect(res.message).toMatch(/not valid for the STARTER plan/i);
    });

    it("restricts promo code to billing intervals (Monthly vs Yearly)", async () => {
      mockDb.subscriptionPromo.findUnique.mockResolvedValueOnce({
        id: "p4",
        code: "YEARLYSPECIAL",
        discountType: "PERCENTAGE",
        discountValue: 30,
        applicableTiers: ["ALL"],
        billingInterval: "YEARLY",
        maxUses: null,
        usedCount: 0,
        validUntil: null,
        isActive: true,
      });

      const res = await validateSubscriptionPromo("YEARLYSPECIAL", "PRO", "MONTHLY", 2499, { db: mockDb });
      expect(res.valid).toBe(false);
      expect(res.message).toMatch(/only valid for yearly billing/i);
    });

    it("rejects expired promo code", async () => {
      mockDb.subscriptionPromo.findUnique.mockResolvedValueOnce({
        id: "p5",
        code: "EXPIRED",
        discountType: "PERCENTAGE",
        discountValue: 50,
        applicableTiers: ["ALL"],
        billingInterval: "ANY",
        maxUses: null,
        usedCount: 0,
        validUntil: new Date("2020-01-01"),
        isActive: true,
      });

      const res = await validateSubscriptionPromo("EXPIRED", "PRO", "MONTHLY", 2499, { db: mockDb });
      expect(res.valid).toBe(false);
      expect(res.message).toMatch(/has expired/i);
    });

    it("rejects promo code that reached max redemptions", async () => {
      mockDb.subscriptionPromo.findUnique.mockResolvedValueOnce({
        id: "p6",
        code: "LIMITED10",
        discountType: "PERCENTAGE",
        discountValue: 50,
        applicableTiers: ["ALL"],
        billingInterval: "ANY",
        maxUses: 10,
        usedCount: 10,
        validUntil: null,
        isActive: true,
      });

      const res = await validateSubscriptionPromo("LIMITED10", "PRO", "MONTHLY", 2499, { db: mockDb });
      expect(res.valid).toBe(false);
      expect(res.message).toMatch(/maximum redemption limit/i);
    });
  });
});
