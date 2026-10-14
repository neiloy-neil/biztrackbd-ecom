import { describe, expect, it } from "vitest";
import {
  CreateBundleInput,
  UpdateBundleInput,
  CreateOrderBumpInput,
  UpdateOrderBumpInput,
  QuoteInput,
} from "../src";

describe("Product Bundles & Order Bumps - Schema & Input Validation", () => {
  it("validates valid bundle creation payload", () => {
    const valid = {
      title: "Skincare Glow Trio",
      titleBn: "স্কিনকেয়ার গ্লো কম্বো",
      slug: "skincare-glow-trio",
      description: "Complete 3-step routine",
      discountType: "PERCENTAGE",
      discountValue: 20,
      allowCoupon: false,
      items: [
        { productId: "prod_cleanser_123", variantId: "var_clean_1", quantity: 1, sortOrder: 0 },
        { productId: "prod_serum_456", variantId: "var_serum_1", quantity: 1, sortOrder: 1 },
      ],
    };

    const parsed = CreateBundleInput.parse(valid);
    expect(parsed.title).toBe("Skincare Glow Trio");
    expect(parsed.discountType).toBe("PERCENTAGE");
    expect(parsed.discountValue).toBe(20);
    expect(parsed.allowCoupon).toBe(false);
    expect(parsed.items).toHaveLength(2);
  });

  it("rejects bundle with fewer than 2 items", () => {
    const invalid = {
      title: "Solo Product",
      discountType: "PERCENTAGE",
      discountValue: 10,
      items: [{ productId: "prod_solo", quantity: 1 }],
    };

    expect(() => CreateBundleInput.parse(invalid)).toThrow();
  });

  it("validates 1-Click Order Bump creation payload", () => {
    const validBump = {
      title: "Add Silk Scrunchie",
      titleBn: "সিল্ক স্ক্রাঞ্চি যোগ করুন",
      highlightText: "🔥 EXCLUSIVE 1-TIME OFFER",
      highlightTextBn: "🔥 এককালীন বিশেষ অফার",
      description: "100% pure mulberry silk to prevent hair damage",
      productId: "prod_scrunchie_999",
      variantId: "var_scrunchie_pink",
      bumpPrice: 150,
      allowCoupon: false,
      triggerType: "GLOBAL",
      status: "ACTIVE",
    };

    const parsed = CreateOrderBumpInput.parse(validBump);
    expect(parsed.title).toBe("Add Silk Scrunchie");
    expect(parsed.bumpPrice).toBe(150);
    expect(parsed.allowCoupon).toBe(false);
    expect(parsed.triggerType).toBe("GLOBAL");
    expect(parsed.triggerIds).toEqual([]);
  });

  it("rejects order bump with invalid bump price <= 0", () => {
    const invalid = {
      title: "Free bump",
      productId: "prod_scrunchie_999",
      variantId: "var_scrunchie_pink",
      bumpPrice: 0,
    };

    expect(() => CreateOrderBumpInput.parse(invalid)).toThrow();
  });
});

describe("Order Quotes with Bundles & Bumps", () => {
  it("accepts quote input with bundleId and bumpIds", () => {
    const input = {
      items: [
        { variantId: "var_shirt_blue", quantity: 1 },
        { variantId: "var_pant_black", quantity: 1 },
        { variantId: "var_belt_brown", quantity: 1, isBump: true },
      ],
      bundleId: "bundle_combo_suit",
      bumpIds: ["bump_leather_belt"],
      district: "Dhaka",
    };

    const parsed = QuoteInput.parse(input);
    expect(parsed.bundleId).toBe("bundle_combo_suit");
    expect(parsed.bumpIds).toEqual(["bump_leather_belt"]);
    expect(parsed.items[2]?.isBump).toBe(true);
  });

  it("correctly models percentage discount pricing logic", () => {
    const regularItem1 = 1200;
    const regularItem2 = 800;
    const regularTotal = regularItem1 + regularItem2; // 2000
    const discountPercent = 25; // 25% OFF

    const bundlePrice = regularTotal * (1 - discountPercent / 100); // 1500
    const savings = regularTotal - bundlePrice; // 500

    expect(bundlePrice).toBe(1500);
    expect(savings).toBe(500);
    expect(Math.round((savings / regularTotal) * 100)).toBe(25);
  });

  it("correctly models fixed discount pricing logic", () => {
    const regularTotal = 3500;
    const discountAmount = 450;

    const bundlePrice = Math.max(0, regularTotal - discountAmount);
    const savings = regularTotal - bundlePrice;

    expect(bundlePrice).toBe(3050);
    expect(savings).toBe(450);
  });

  it("correctly models fixed price combo deal pricing logic", () => {
    const regularTotal = 4200;
    const fixedPromoPrice = 3499;

    const bundlePrice = Math.min(fixedPromoPrice, regularTotal);
    const savings = regularTotal - bundlePrice;

    expect(bundlePrice).toBe(3499);
    expect(savings).toBe(701);
  });

  it("correctly models margin protection when allowCoupon is false", () => {
    const regularItemsSubtotal = 1000;
    const bundlePromoSubtotal = 1500;
    const bumpPromoSubtotal = 200;

    const totalCartSubtotal = regularItemsSubtotal + bundlePromoSubtotal + bumpPromoSubtotal; // 2700

    // Bundle and bump have allowCoupon = false:
    const bundleAllowCoupon = false;
    const bumpAllowCoupon = false;

    let couponEligibleSubtotal = totalCartSubtotal;
    if (!bundleAllowCoupon) {
      couponEligibleSubtotal -= bundlePromoSubtotal;
    }
    if (!bumpAllowCoupon) {
      couponEligibleSubtotal -= bumpPromoSubtotal;
    }

    // Only regular unbundled items should be discountable by coupons:
    expect(couponEligibleSubtotal).toBe(1000);

    // If user applies a 10% coupon:
    const couponPercent = 10;
    const couponDiscount = Math.round(couponEligibleSubtotal * (couponPercent / 100));
    expect(couponDiscount).toBe(100); // 100 BDT off, not 270 BDT off!
  });
});

describe("Checkout Order Bump Trigger Rules Matching", () => {
  it("matches GLOBAL trigger for all checkouts unless target product is already in cart", () => {
    const bump = {
      productId: "prod_perfume",
      triggerType: "GLOBAL" as const,
      triggerIds: [],
    };

    const cart1 = ["prod_dress", "prod_shoes"];
    const cart2 = ["prod_dress", "prod_perfume"]; // already in cart

    const match1 = bump.triggerType === "GLOBAL" && !cart1.includes(bump.productId);
    const match2 = bump.triggerType === "GLOBAL" && !cart2.includes(bump.productId);

    expect(match1).toBe(true);
    expect(match2).toBe(false);
  });

  it("matches SPECIFIC_PRODUCTS trigger only when trigger product is present in cart", () => {
    const bump = {
      productId: "prod_phone_case",
      triggerType: "SPECIFIC_PRODUCTS" as const,
      triggerIds: ["prod_smartphone_x", "prod_smartphone_pro"],
    };

    const cartMatching = ["prod_smartphone_x", "prod_headphones"];
    const cartNonMatching = ["prod_tshirt", "prod_shoes"];

    const isMatch1 = bump.triggerIds.some((id) => cartMatching.includes(id));
    const isMatch2 = bump.triggerIds.some((id) => cartNonMatching.includes(id));

    expect(isMatch1).toBe(true);
    expect(isMatch2).toBe(false);
  });
});
