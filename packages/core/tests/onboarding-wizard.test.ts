import { describe, expect, it } from "vitest";
import {
  createAutoLoginToken,
  verifyAutoLoginToken,
  createAutoLoginSessionCookie,
  verifyAutoLoginSessionCookie,
  getCategoryStarterPreset,
  SignupInput,
} from "../src";

describe("Merchant Onboarding & Auto-Login Flow", () => {
  describe("Auto-login token generation & verification", () => {
    it("generates a signed single-use auto-login token that verifies successfully", () => {
      const data = {
        tenantId: "ten_test_123",
        userId: "usr_test_456",
        email: "merchant@example.com",
      };
      const token = createAutoLoginToken(data);
      expect(typeof token).toBe("string");
      expect(token).toContain(".");

      const verified = verifyAutoLoginToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.tenantId).toBe(data.tenantId);
      expect(verified?.userId).toBe(data.userId);
      expect(verified?.email).toBe(data.email);
      expect(verified?.exp).toBeGreaterThan(Date.now());
    });

    it("rejects tampered or forged auto-login tokens", () => {
      const token = createAutoLoginToken({
        tenantId: "ten_test_123",
        userId: "usr_test_456",
        email: "merchant@example.com",
      });
      const [body, sig] = token.split(".");
      const forged = `${body}.${sig!.slice(0, -2)}xx`;
      expect(verifyAutoLoginToken(forged)).toBeNull();
      expect(verifyAutoLoginToken("invalid.token.structure")).toBeNull();
      expect(verifyAutoLoginToken("")).toBeNull();
    });

    it("generates and verifies 14-day auto-login session cookies", () => {
      const data = {
        tenantId: "ten_store_789",
        userId: "usr_owner_789",
        email: "owner@shondor.bd",
      };
      const cookieVal = createAutoLoginSessionCookie(data);
      expect(typeof cookieVal).toBe("string");

      const payload = verifyAutoLoginSessionCookie(cookieVal);
      expect(payload).not.toBeNull();
      expect(payload?.tenantId).toBe(data.tenantId);
      expect(payload?.email).toBe(data.email);
      expect(payload?.exp).toBeGreaterThan(Date.now() + 13 * 86400 * 1000);
    });
  });

  describe("Category Starter Catalog Presets", () => {
    const categories = ["FASHION", "BEAUTY", "ELECTRONICS", "GROCERY", "GENERAL"] as const;

    it("provides curated starter presets for all 5 business categories", () => {
      for (const cat of categories) {
        const preset = getCategoryStarterPreset(cat);
        expect(preset).toBeDefined();
        expect(preset.categoryKey).toBe(cat);
        expect(preset.products.length).toBe(3);
        expect(preset.shipping.insideDhaka.rate).toBeGreaterThan(0);
        expect(preset.shipping.outsideDhaka.rate).toBeGreaterThan(0);
      }
    });

    it("includes category-specific variants and Bangladeshi pricing", () => {
      const fashion = getCategoryStarterPreset("FASHION");
      expect(fashion.products[0]?.titleBn).toBe("প্রিমিয়াম সেমি-ড্রপ কটন পাঞ্জাবি");
      expect(fashion.products[0]?.variants?.length).toBeGreaterThan(0);
      expect(fashion.products[0]?.price).toBe(1850);

      const beauty = getCategoryStarterPreset("BEAUTY");
      expect(beauty.products[0]?.titleBn).toBe("১০% পিওর ভিটামিন সি রেডিয়েন্স সিরাম (৩০ মি.লি.)");

      const electronics = getCategoryStarterPreset("ELECTRONICS");
      expect(electronics.products[0]?.titleBn).toBe("প্রো হাইব্রিড এএনসি ট্রু ওয়্যারলেস এয়ারবাডস");

      const grocery = getCategoryStarterPreset("GROCERY");
      expect(grocery.products[0]?.titleBn).toBe("কাঠের ঘানিতে ভাঙানো খাঁটি সরিষার তেল (১ লিটার)");
    });

    it("falls back to GENERAL category when an unknown category is requested", () => {
      const fallback = getCategoryStarterPreset("UNKNOWN");
      expect(fallback.categoryKey).toBe("GENERAL");
    });
  });

  describe("SignupInput Schema Validation", () => {
    it("successfully parses valid input with category and optional password", () => {
      const raw = {
        ownerName: "Tanvir Ahmed",
        email: "Tanvir@Example.com ",
        phone: "01712345678",
        storeName: "Dhaka Handloom Crafts",
        category: "FASHION",
        password: "securePassword123!",
        subdomain: "dhaka-crafts",
        plan: "PRO",
      };
      const parsed = SignupInput.parse(raw);
      expect(parsed.ownerName).toBe("Tanvir Ahmed");
      expect(parsed.email).toBe("tanvir@example.com");
      expect(parsed.category).toBe("FASHION");
      expect(parsed.plan).toBe("PRO");
      expect(parsed.demoData).toBe(true);
    });

    it("defaults category to GENERAL and plan to PRO if omitted", () => {
      const raw = {
        ownerName: "Rahim Mia",
        email: "rahim@example.com",
        phone: "01812345678",
        storeName: "Rahim Store",
        subdomain: "rahim-store",
      };
      const parsed = SignupInput.parse(raw);
      expect(parsed.category).toBe("GENERAL");
      expect(parsed.plan).toBe("PRO");
    });

    it("rejects invalid emails and short passwords", () => {
      expect(() =>
        SignupInput.parse({
          ownerName: "Test",
          email: "not-an-email",
          phone: "01711111111",
          storeName: "Test Store",
          subdomain: "test-store",
        }),
      ).toThrow();

      expect(() =>
        SignupInput.parse({
          ownerName: "Test",
          email: "test@example.com",
          phone: "01711111111",
          storeName: "Test Store",
          subdomain: "test-store",
          password: "short",
        }),
      ).toThrow();
    });
  });
});
