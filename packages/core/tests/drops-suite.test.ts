import { describe, expect, it } from "vitest";
import { APP_CATALOG } from "../src/modules/catalog";
import { calculateDropDeposit } from "../src/drops/service";
import { CreateDropInput, WaitlistSubscriptionInput } from "../src/drops/types";

describe("Limited Drops & Pre-Orders Suite", () => {
  describe("App Catalog Integration", () => {
    it("includes limited_drops in APP_CATALOG as built", () => {
      const app = APP_CATALOG.find((a) => a.key === "limited_drops");
      expect(app).toBeDefined();
      expect(app?.label).toBe("Limited Drops & Pre-Orders");
      expect(app?.built).toBe(true);
      expect(app?.category).toBe("COMMERCE");
      expect(app?.configureHref).toBe("/marketing/drops");
      expect(app?.features).toContain("Landing page launch countdown clocks");
      expect(app?.features).toContain("Fulfillment hold and courier COD balance calculation");
    });
  });

  describe("Deposit & Balance Due Calculations", () => {
    it("returns zero deposit and full balance due when depositType is NONE", () => {
      const res = calculateDropDeposit("NONE", 0, 2400);
      expect(res.depositRequired).toBe(0);
      expect(res.balanceDue).toBe(2400);
      expect(res.isPreOrder).toBe(true);
    });

    it("calculates fixed deposit accurately and limits it to item price", () => {
      // ৳500 advance deposit on ৳1,800 item
      const res1 = calculateDropDeposit("FIXED", 500, 1800);
      expect(res1.depositRequired).toBe(500);
      expect(res1.balanceDue).toBe(1300);

      // ৳2,000 advance deposit on ৳1,500 item (cap at item price)
      const res2 = calculateDropDeposit("FIXED", 2000, 1500);
      expect(res2.depositRequired).toBe(1500);
      expect(res2.balanceDue).toBe(0);
    });

    it("calculates percentage deposit accurately (e.g., 20% advance)", () => {
      // 20% advance on ৳3,500 item = ৳700
      const res = calculateDropDeposit("PERCENTAGE", 20, 3500);
      expect(res.depositRequired).toBe(700);
      expect(res.balanceDue).toBe(2800);
    });

    it("requires full 100% prepayment when depositType is FULL", () => {
      const res = calculateDropDeposit("FULL", 0, 4200);
      expect(res.depositRequired).toBe(4200);
      expect(res.balanceDue).toBe(0);
    });
  });

  describe("Drop Input Validation", () => {
    it("validates valid drop creation inputs", () => {
      const futureDate = new Date(Date.now() + 86400000 * 3);
      const input = {
        title: "Exclusive Eid Panjabi Drop",
        mode: "LIVE_PREORDER" as const,
        status: "SCHEDULED" as const,
        startsAt: futureDate,
        depositType: "PERCENTAGE" as const,
        depositValue: 25,
        allocationCap: 50,
        productItems: [
          { productId: "prod_1", allocatedQty: 50 },
        ],
      };

      const parsed = CreateDropInput.parse(input);
      expect(parsed.title).toBe("Exclusive Eid Panjabi Drop");
      expect(parsed.depositValue).toBe(25);
      expect(parsed.allocationCap).toBe(50);
      expect(parsed.productItems).toHaveLength(1);
    });

    it("rejects drop creation without products", () => {
      const input = {
        title: "Empty Drop",
        startsAt: new Date(),
        productItems: [],
      };

      expect(() => CreateDropInput.parse(input)).toThrow();
    });

    it("validates waitlist subscriber inputs", () => {
      const sub = {
        dropId: "drop_123",
        phone: "01712345678",
        name: "Arif Khan",
      };

      const parsed = WaitlistSubscriptionInput.parse(sub);
      expect(parsed.phone).toBe("01712345678");
      expect(parsed.name).toBe("Arif Khan");
    });
  });
});
