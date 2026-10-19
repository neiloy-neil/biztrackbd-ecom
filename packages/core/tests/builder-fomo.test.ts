import { describe, it, expect } from "vitest";
import {
  sectionDef,
  newSection,
  normalizeSettings,
  validatePage,
  normalizeSocialProof,
  isCommerceSection,
  type PageJson,
  type SocialProofSettings,
} from "../src/builder/registry";
import {
  anonymizeBuyerName,
  formatTimeAgo,
  getFallbackSalesFeed,
} from "../src/builder/fomo-service";

describe("Visual SiteBuilder - Social Proof & FOMO Engine", () => {
  describe("normalizeSocialProof", () => {
    it("returns undefined for empty, undefined or invalid inputs", () => {
      expect(normalizeSocialProof(undefined)).toBeUndefined();
      expect(normalizeSocialProof(null)).toBeUndefined();
      expect(normalizeSocialProof("invalid")).toBeUndefined();
      expect(normalizeSocialProof([])).toBeUndefined();
      expect(normalizeSocialProof({})).toBeUndefined();
    });

    it("normalizes and preserves valid social proof configuration", () => {
      const input = {
        enabled: true,
        position: "bottom-left",
        initialDelaySec: 4,
        intervalSec: 15,
        displayDurationSec: 6,
        showOnMobile: true,
        safeAreaBottomPx: 76,
        maxItems: 12,
        anonymizeNames: true,
        includeDistricts: true,
      };

      const normalized = normalizeSocialProof(input);
      expect(normalized).toBeDefined();
      expect(normalized?.enabled).toBe(true);
      expect(normalized?.position).toBe("bottom-left");
      expect(normalized?.initialDelaySec).toBe(4);
      expect(normalized?.intervalSec).toBe(15);
      expect(normalized?.displayDurationSec).toBe(6);
      expect(normalized?.showOnMobile).toBe(true);
      expect(normalized?.safeAreaBottomPx).toBe(76);
      expect(normalized?.maxItems).toBe(12);
      expect(normalized?.anonymizeNames).toBe(true);
      expect(normalized?.includeDistricts).toBe(true);
    });

    it("rejects unknown positions and clamps out-of-range numeric values", () => {
      const input = {
        enabled: true,
        position: "center-screen", // invalid
        initialDelaySec: -10,      // min 1
        intervalSec: 500,          // max 180
        displayDurationSec: 0,     // min 2
        safeAreaBottomPx: 500,     // max 240
        maxItems: 0,               // min 1
      };

      const normalized = normalizeSocialProof(input);
      expect(normalized).toBeDefined();
      expect(normalized?.enabled).toBe(true);
      expect(normalized?.position).toBeUndefined();
      expect(normalized?.initialDelaySec).toBe(1);
      expect(normalized?.intervalSec).toBe(180);
      expect(normalized?.displayDurationSec).toBe(2);
      expect(normalized?.safeAreaBottomPx).toBe(240);
      expect(normalized?.maxItems).toBe(1);
    });
  });

  describe("visitor-counter section", () => {
    it("is registered with commerce capabilities and valid defaults", () => {
      const def = sectionDef("visitor-counter");
      expect(def).toBeDefined();
      if (!def) return;

      expect(def.type).toBe("visitor-counter");
      expect(def.label).toBe("Live Visitor Counter");
      expect(def.category).toBe("proof");
      expect(isCommerceSection(def)).toBe(true);

      const section = newSection("visitor-counter");
      expect(section.type).toBe("visitor-counter");
      expect(section.settings.headline).toBe("people are viewing this right now");
      expect(section.settings.minViewers).toBe(8);
      expect(section.settings.maxViewers).toBe(28);
      expect(section.settings.showCartCount).toBe(true);
      expect(section.settings.icon).toBe("fire");

      // Verify normalization
      const cleaned = normalizeSettings(def, section.settings);
      expect(cleaned.headline).toBe("people are viewing this right now");
      expect(cleaned.minViewers).toBe(8);
      expect(cleaned.maxViewers).toBe(28);
    });
  });

  describe("stock-scarcity section", () => {
    it("is registered with promotions capabilities and valid defaults", () => {
      const def = sectionDef("stock-scarcity");
      expect(def).toBeDefined();
      if (!def) return;

      expect(def.type).toBe("stock-scarcity");
      expect(def.label).toBe("Stock Scarcity Bar");
      expect(def.category).toBe("promotions");
      expect(isCommerceSection(def)).toBe(true);

      const section = newSection("stock-scarcity");
      expect(section.type).toBe("stock-scarcity");
      expect(section.settings.headline).toBe("Hurry, low stock!");
      expect(section.settings.threshold).toBe(4);
      expect(section.settings.showProgressBar).toBe(true);
      expect(section.settings.progressPercent).toBe(84);
      expect(section.settings.urgencyColor).toBe("#EF4444");

      // Verify normalization
      const cleaned = normalizeSettings(def, section.settings);
      expect(cleaned.headline).toBe("Hurry, low stock!");
      expect(cleaned.threshold).toBe(4);
      expect(cleaned.urgencyColor).toBe("#EF4444");
    });
  });

  describe("validatePage with social proof", () => {
    it("validates and preserves socialProof metadata on PageJson", () => {
      const pageWithSocialProof: PageJson = {
        version: 1,
        sections: [
          {
            id: "hero_1",
            type: "hero",
            settings: { title: "Welcome" },
          },
          {
            id: "vc_1",
            type: "visitor-counter",
            settings: { headline: "shoppers viewing" },
          },
          {
            id: "sc_1",
            type: "stock-scarcity",
            settings: { headline: "Selling out" },
          },
        ],
        socialProof: {
          enabled: true,
          position: "bottom-right",
          intervalSec: 10,
          showOnMobile: true,
        },
      };

      const validated = validatePage("home", pageWithSocialProof);
      expect(validated.socialProof).toBeDefined();
      expect(validated.socialProof?.enabled).toBe(true);
      expect(validated.socialProof?.position).toBe("bottom-right");
      expect(validated.socialProof?.intervalSec).toBe(10);
      expect(validated.socialProof?.showOnMobile).toBe(true);

      const vc = validated.sections.find((s) => s.type === "visitor-counter");
      expect(vc).toBeDefined();
      expect(vc?.settings.headline).toBe("shoppers viewing");

      const sc = validated.sections.find((s) => s.type === "stock-scarcity");
      expect(sc).toBeDefined();
      expect(sc?.settings.headline).toBe("Selling out");
    });
  });

  describe("fomo-service helpers", () => {
    it("anonymizes buyer names cleanly preserving privacy", () => {
      expect(anonymizeBuyerName("Tanvir Ahmed")).toBe("Tanvir A.");
      expect(anonymizeBuyerName("Rahim")).toBe("Rahim");
      expect(anonymizeBuyerName("Md. Shakil Khan")).toBe("Md. K.");
      expect(anonymizeBuyerName("")).toBe("A customer");
      expect(anonymizeBuyerName(null)).toBe("A customer");
      expect(anonymizeBuyerName(undefined)).toBe("A customer");
    });

    it("formats relative time differences accurately", () => {
      const base = new Date("2026-10-19T12:00:00Z");

      expect(formatTimeAgo(new Date("2026-10-19T11:59:30Z"), base)).toBe("Just now");
      expect(formatTimeAgo(new Date("2026-10-19T11:55:00Z"), base)).toBe("5 mins ago");
      expect(formatTimeAgo(new Date("2026-10-19T10:00:00Z"), base)).toBe("2 hours ago");
      expect(formatTimeAgo(new Date("2026-10-18T10:00:00Z"), base)).toBe("Yesterday");
      expect(formatTimeAgo(new Date("2026-10-16T10:00:00Z"), base)).toBe("3 days ago");
    });

    it("generates authentic curated fallback sales feed items", () => {
      const feed = getFallbackSalesFeed(4);
      expect(feed).toHaveLength(4);
      expect(feed[0]?.buyerName).toBeDefined();
      expect(feed[0]?.productTitle).toBeDefined();
      expect(feed[0]?.district).toContain("Dhaka");
      expect(feed[0]?.isRealOrder).toBe(false);
    });
  });
});
