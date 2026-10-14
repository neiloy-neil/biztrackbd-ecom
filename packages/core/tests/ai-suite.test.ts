import { describe, expect, it } from "vitest";
import {
  parseCustomerDetailsWithAi,
  TONE_LABELS,
  SocialPostSchema,
  SmsCampaignSchema,
  GeneratedProductSchema,
  PLAN_AI_QUOTAS,
} from "../src/index";

describe("AI Suite - Data Contracts & Customer Parser", () => {
  it("has valid cultural tone presets configured for Bangladeshi eCommerce", () => {
    expect(TONE_LABELS.DHAKA_YOUTH_TRENDY).toBeDefined();
    expect(TONE_LABELS.TRADITIONAL_ELEGANT).toBeDefined();
    expect(TONE_LABELS.LUXURY_PREMIUM).toBeDefined();
    expect(TONE_LABELS.TECH_MINIMALIST).toBeDefined();
    expect(PLAN_AI_QUOTAS.STARTER).toBe(50);
    expect(PLAN_AI_QUOTAS.PRO).toBe(250);
    expect(PLAN_AI_QUOTAS.BUSINESS).toBe(1000);
  });

  it("parses messy Bengali customer order text using heuristic fallback when AI is bypassed", async () => {
    const rawMessage = `
ভাইয়া আমার নাম রফিকুল ইসলাম
ফোন: ০১৭০০১২৩৪৫৬
ঠিকানা: বাড়ি ১২, রোড ৪, ব্লক সি, ধানমন্ডি, ঢাকা
ক্যাশ অন ডেলিভারিতে পাঠাবেন
`;

    const parsed = await parseCustomerDetailsWithAi("dummy-tenant", rawMessage, {
      bypassAi: true,
    });

    expect(parsed.name).toBe("রফিকুল ইসলাম");
    expect(parsed.phone).toBe("01700123456");
    expect(parsed.district).toBe("Dhaka");
    expect(parsed.paymentMethod).toBe("COD");
    expect(parsed.address).toContain("বাড়ি ১২");
  });

  it("validates GeneratedProductSchema with full bilingual fields and HTML description", () => {
    const validListing = {
      titleBn: "প্রিমিয়াম জামদানি সুতি শাড়ি",
      titleEn: "Premium Jamdani Cotton Saree",
      shortExcerptBn: "আভিজাত্য ও ঐতিহ্যের সেরা সমন্বয়।",
      descriptionHtml: "<p>১০০% খাঁটি সুতি সুতায় বোনা।</p><ul><li>রং: মেরুন</li><li>সাইজ: ১২ হাত</li></ul>",
      categorySuggestion: "Women's Fashion > Sarees",
      tags: ["jamdani", "saree", "জামদানি", "শাড়ি"],
      seo: {
        metaTitle: "প্রিমিয়াম জামদানি শাড়ি কিনুন | সেরা দামে",
        metaDescription: "অনলাইনে অর্ডার করুন আসল জামদানি শাড়ি। ক্যাশ অন ডেলিভারি সুবিধা সারা দেশে।",
      },
      adCopy: {
        facebookCaption: "🌟 আভিজাত্যের ছোঁয়ায় আপনার সাজ হোক অনন্য! অর্ডার করতে এখনই ইনবক্স করুন।",
      },
    };

    const result = GeneratedProductSchema.safeParse(validListing);
    expect(result.success).toBe(true);
  });

  it("validates SMS campaign limits for single-part GSM telecommunication standards", () => {
    const validSms = {
      englishSms: "Big Eid Sale! Get 20% off on all items with code EID20. Shop now: {link} T&C apply.",
      banglaSms: "ঈদ ধামাকা অফার! ২০% ছাড়ে কেনাকাটা করুন। কোড EID20",
      estimatedSmsParts: 1,
      previewText: "Eid 20% discount blast",
    };

    const result = SmsCampaignSchema.safeParse(validSms);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.englishSms.length).toBeLessThanOrEqual(160);
      expect(result.data.banglaSms.length).toBeLessThanOrEqual(70);
    }
  });

  it("validates SocialPostSchema with hashtags and hook", () => {
    const validPost = {
      captionBn: "দারুণ অফারে আপনার পছন্দের পোশাক কিনুন।",
      captionEn: "Grab your favorite apparel at an unbeatable price.",
      hook: "🔥 সীমিত সময়ের জন্য ধামাকা ছাড়!",
      hashtags: ["#OnlineShoppingBD", "#FashionBD", "#StyleDhaka"],
    };

    const result = SocialPostSchema.safeParse(validPost);
    expect(result.success).toBe(true);
  });
});
