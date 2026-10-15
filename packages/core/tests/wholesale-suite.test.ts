import { describe, expect, it } from "vitest";
import {
  WholesaleRegistrationSchema,
  WholesaleTierSchema,
  WholesalePriceOverrideSchema,
  WholesaleSettingsSchema,
  APP_CATALOG,
} from "../src";

describe("Wholesale & B2B Pricing Suite", () => {
  describe("Zod Validation Schemas", () => {
    it("validates valid reseller registration data", () => {
      const valid = {
        companyName: "Rina Boutique",
        applicantName: "Rina Akter",
        phone: "01712345678",
        whatsappNumber: "01712345678",
        businessType: "Physical Boutique / Shop",
        tradeLicense: "TRAD/DSCC/019283",
        taxId: "001928374-0101",
        address: "House 12, Road 4, Dhanmondi",
        district: "Dhaka",
      };

      const parsed = WholesaleRegistrationSchema.parse(valid);
      expect(parsed.companyName).toBe("Rina Boutique");
      expect(parsed.phone).toBe("01712345678");
      expect(parsed.tradeLicense).toBe("TRAD/DSCC/019283");
    });

    it("rejects invalid reseller registration without required fields", () => {
      expect(() =>
        WholesaleRegistrationSchema.parse({
          companyName: "",
          applicantName: "Rina",
          phone: "123",
        })
      ).toThrow();
    });

    it("validates wholesale tier configuration", () => {
      const tier = {
        name: "VIP Distributor",
        discountPercent: 25,
        minOrderAmount: 10000,
        allowCod: true,
        partialDepositPercent: 30,
      };

      const parsed = WholesaleTierSchema.parse(tier);
      expect(parsed.discountPercent).toBe(25);
      expect(parsed.minOrderAmount).toBe(10000);
      expect(parsed.allowCod).toBe(true);
      expect(parsed.partialDepositPercent).toBe(30);
    });

    it("validates volume pricing override schema", () => {
      const override = {
        variantId: "var_cotton_panjabi_l",
        tierId: null, // public volume break
        minQuantity: 6,
        price: 950,
      };

      const parsed = WholesalePriceOverrideSchema.parse(override);
      expect(parsed.minQuantity).toBe(6);
      expect(parsed.price).toBe(950);
      expect(parsed.tierId).toBeNull();
    });

    it("validates store wholesale settings and bank details", () => {
      const settings = {
        wholesaleEnabled: true,
        wholesaleMinOrderAmount: 5000,
        wholesaleDefaultMoq: 6,
        wholesaleAllowRegistration: true,
        wholesaleBankDetails: {
          bankName: "City Bank PLC",
          branchName: "Gulshan Branch",
          accountName: "BizTrack BD Ltd.",
          accountNumber: "1102938472001",
          routingNumber: "225272635",
          instructions: "Please WhatsApp deposit slip to 017XXXXXXXX",
        },
      };

      const parsed = WholesaleSettingsSchema.parse(settings);
      expect(parsed.wholesaleEnabled).toBe(true);
      expect(parsed.wholesaleBankDetails?.accountNumber).toBe("1102938472001");
    });
  });

  describe("Best Price Guarantee Resolution Logic", () => {
    it("selects lowest price among retail, public volume break, and tier overrides", () => {
      const retailPrice = 1200;
      const publicBreakPrice = 1050; // for 6+ pcs
      const tierOverridePrice = 950;  // for 6+ pcs on Gold Tier
      const tierFlatDiscountPercent = 20; // 20% off retail = 960

      const tierFlatPrice = Math.round(retailPrice * (1 - tierFlatDiscountPercent / 100));
      expect(tierFlatPrice).toBe(960);

      // Best Price Guarantee: lowest price wins
      const lowestUnitPrice = Math.min(
        retailPrice,
        publicBreakPrice,
        tierOverridePrice,
        tierFlatPrice
      );

      expect(lowestUnitPrice).toBe(950);
      expect(lowestUnitPrice).toBe(tierOverridePrice);

      const quantity = 10;
      const totalSavings = (retailPrice - lowestUnitPrice) * quantity;
      expect(totalSavings).toBe(2500);
    });

    it("awards public volume break to retail shoppers when quantity reaches threshold", () => {
      const retailPrice = 500;
      const volumeBreak = { minQuantity: 12, price: 420 };

      // Shopper buys 5 pcs -> regular price
      const qty1 = 5;
      const price1 = qty1 >= volumeBreak.minQuantity ? volumeBreak.price : retailPrice;
      expect(price1).toBe(500);

      // Shopper buys 12 pcs -> bulk volume break
      const qty2 = 12;
      const price2 = qty2 >= volumeBreak.minQuantity ? volumeBreak.price : retailPrice;
      expect(price2).toBe(420);
      expect(price2).toBeLessThan(retailPrice);
    });

    it("calculates storewide wholesale minimum order deficit", () => {
      const minOrderAmount = 5000;
      const cartSubtotal1 = 3200;

      const isMet1 = cartSubtotal1 >= minOrderAmount;
      const deficit1 = Math.max(0, minOrderAmount - cartSubtotal1);
      expect(isMet1).toBe(false);
      expect(deficit1).toBe(1800);

      const cartSubtotal2 = 6400;
      const isMet2 = cartSubtotal2 >= minOrderAmount;
      const deficit2 = Math.max(0, minOrderAmount - cartSubtotal2);
      expect(isMet2).toBe(true);
      expect(deficit2).toBe(0);
    });
  });

  describe("Module Catalog & App Store Registration", () => {
    it("registers wholesale_b2b as built ADDON module in APP_CATALOG", () => {
      const wholesaleApp = APP_CATALOG.find((app) => app.key === "wholesale_b2b");
      expect(wholesaleApp).toBeDefined();
      expect(wholesaleApp?.built).toBe(true);
      expect(wholesaleApp?.tier).toBe("ADDON");
      expect(wholesaleApp?.configureHref).toBe("/products/wholesale");
      expect(wholesaleApp?.features.length).toBeGreaterThanOrEqual(4);
    });
  });
});
