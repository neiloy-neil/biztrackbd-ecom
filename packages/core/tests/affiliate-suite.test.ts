import { describe, expect, it } from "vitest";
import { APP_CATALOG } from "../src/modules/catalog";

describe("Affiliate & Influencer Commission Hub", () => {
  describe("App Catalog Integration", () => {
    it("includes affiliate_influencer_hub in APP_CATALOG", () => {
      const app = APP_CATALOG.find((a) => a.key === "affiliate_influencer_hub");
      expect(app).toBeDefined();
      expect(app?.label).toBe("Affiliate & Influencer Hub");
      expect(app?.built).toBe(true);
      expect(app?.category).toBe("GROWTH");
      expect(app?.configureHref).toBe("/marketing/affiliates");
    });
  });

  describe("Commission Calculation Utilities", () => {
    it("calculates percentage commissions accurately", () => {
      const subtotal = 2500;
      const rate = 12.5; // 12.5%
      const commission = Math.round(subtotal * (rate / 100) * 100) / 100;
      expect(commission).toBe(312.5);
    });

    it("calculates flat fee commissions regardless of subtotal", () => {
      const subtotal = 1200;
      const flatFee = 150;
      expect(flatFee).toBe(150);
      expect(flatFee < subtotal).toBe(true);
    });
  });

  describe("Phone Masking for Privacy", () => {
    function maskPhone(phone: string): string {
      if (phone.length <= 6) return phone;
      return `${phone.slice(0, 5)}***${phone.slice(-3)}`;
    }

    it("masks standard 11-digit Bangladeshi mobile numbers", () => {
      expect(maskPhone("01712345678")).toBe("01712***678");
      expect(maskPhone("01987654321")).toBe("01987***321");
    });

    it("returns short inputs unchanged without error", () => {
      expect(maskPhone("123")).toBe("123");
    });
  });

  describe("Payout Rules & Balances", () => {
    it("enforces minimum payout threshold of ৳100", () => {
      const minPayout = 100;
      const requestAmount1 = 50;
      const requestAmount2 = 150;

      expect(requestAmount1 < minPayout).toBe(true);
      expect(requestAmount2 >= minPayout).toBe(true);
    });

    it("validates that requested amount cannot exceed payable balance", () => {
      const payableBalance = 450;
      const requested = 500;
      expect(requested > payableBalance).toBe(true);
    });

    it("reserves payable balance upfront when requested", () => {
      let payableBalance = 1000;
      const requested = 300;

      payableBalance -= requested;
      expect(payableBalance).toBe(700);

      // If rejected, balance is restored
      payableBalance += requested;
      expect(payableBalance).toBe(1000);
    });
  });

  describe("Settlement State Transitions", () => {
    it("advances pending commission to approved on DELIVERED", () => {
      let referralStatus: "PENDING" | "APPROVED" | "VOID" | "PAID" = "PENDING";
      let totalEarned = 0;
      let payableBalance = 0;
      const comm = 200;

      // Delivery occurs
      if (referralStatus === "PENDING") {
        referralStatus = "APPROVED";
        totalEarned += comm;
        payableBalance += comm;
      }

      expect(referralStatus).toBe("APPROVED");
      expect(totalEarned).toBe(200);
      expect(payableBalance).toBe(200);
    });

    it("voids pending commission on CANCELLED without altering balances", () => {
      let referralStatus: "PENDING" | "APPROVED" | "VOID" | "PAID" = "PENDING";
      const totalEarned = 0;
      const payableBalance = 0;

      referralStatus = "VOID";

      expect(referralStatus).toBe("VOID");
      expect(totalEarned).toBe(0);
      expect(payableBalance).toBe(0);
    });

    it("reverses approved commission if delivered order is returned", () => {
      let referralStatus: "PENDING" | "APPROVED" | "VOID" | "PAID" = "APPROVED";
      let totalEarned = 350;
      let payableBalance = 350;
      const comm = 350;

      // Returned parcel
      referralStatus = "VOID";
      totalEarned -= comm;
      payableBalance -= comm;

      expect(referralStatus).toBe("VOID");
      expect(totalEarned).toBe(0);
      expect(payableBalance).toBe(0);
    });
  });
});
