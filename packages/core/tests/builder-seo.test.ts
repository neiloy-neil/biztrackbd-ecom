import { describe, expect, it } from "vitest";
import {
  calculateSeoHealthScore,
  defaultHomePage,
  extractPageSeoHeuristic,
  newSection,
  normalizePageSeo,
  validatePage,
  type PageJson,
  type PageSeoSettings,
} from "../src";

describe("Visual SiteBuilder - In-Builder SEO & Social Share Inspector", () => {
  describe("normalizePageSeo", () => {
    it("returns undefined for empty, undefined, or invalid inputs", () => {
      expect(normalizePageSeo(undefined)).toBeUndefined();
      expect(normalizePageSeo(null)).toBeUndefined();
      expect(normalizePageSeo({})).toBeUndefined();
      expect(normalizePageSeo([])).toBeUndefined();
      expect(normalizePageSeo("not an object")).toBeUndefined();
      expect(normalizePageSeo({ title: "   " })).toBeUndefined();
    });

    it("sanitizes text fields, removes control characters and strips HTML tags", () => {
      const input = {
        title: "  <b>Premium Panjabi Collection</b>  ",
        description: "<script>alert('xss')</script>Explore authentic handcrafted items.\n\x00\x08",
        keywords: "panjabi, <tag>eid</tag>, clothing",
        socialImage: "https://example.com/banner.webp",
        noIndex: true,
        canonicalUrl: "https://example.com/canonical",
        ogTitle: "<i>Social Title</i>",
        ogDescription: "Social card details",
      };

      const normalized = normalizePageSeo(input);
      expect(normalized).toBeDefined();
      expect(normalized?.title).toBe("Premium Panjabi Collection");
      expect(normalized?.description).toBe("alert('xss')Explore authentic handcrafted items.");
      expect(normalized?.keywords).toBe("panjabi, eid, clothing");
      expect(normalized?.socialImage).toBe("https://example.com/banner.webp");
      expect(normalized?.noIndex).toBe(true);
      expect(normalized?.canonicalUrl).toBe("https://example.com/canonical");
      expect(normalized?.ogTitle).toBe("Social Title");
      expect(normalized?.ogDescription).toBe("Social card details");
    });

    it("rejects unsafe or javascript image and canonical URLs", () => {
      const input = {
        title: "Test Page",
        socialImage: "javascript:alert(1)",
        canonicalUrl: "javascript:alert(2)",
      };

      const normalized = normalizePageSeo(input);
      expect(normalized?.title).toBe("Test Page");
      expect(normalized?.socialImage).toBeUndefined();
      expect(normalized?.canonicalUrl).toBeUndefined();
    });

    it("allows valid relative media paths for socialImage", () => {
      const input = {
        title: "Test Page",
        socialImage: "/media/uploaded-banner.webp",
      };

      const normalized = normalizePageSeo(input);
      expect(normalized?.socialImage).toBe("/media/uploaded-banner.webp");
    });
  });

  describe("extractPageSeoHeuristic", () => {
    it("extracts title, description, and hero image from home page sections", () => {
      const homePage = defaultHomePage();
      // defaultHomePage has: "hero", "featured-products", "category-grid", "trust-strip"
      const hero = homePage.sections.find((s) => s.type === "hero");
      if (hero) {
        hero.settings.title = "Artisan Bangladeshi Attire";
        hero.settings.subtitle = "Handcrafted organic cotton panjabis and sarees with cash on delivery across Bangladesh.";
        hero.settings.image = "https://example.com/hero-artisan.webp";
      }

      const extracted = extractPageSeoHeuristic(homePage, "My Store");
      expect(extracted.title).toBe("Artisan Bangladeshi Attire");
      expect(extracted.description).toContain("Handcrafted organic cotton panjabis");
      expect(extracted.socialImage).toBe("https://example.com/hero-artisan.webp");
    });

    it("falls back to fallbackTitle when page sections contain no text headings", () => {
      const emptyPage: PageJson = {
        version: 1,
        sections: [],
      };

      const extracted = extractPageSeoHeuristic(emptyPage, "About Us");
      expect(extracted.title).toBe("About Us");
      expect(extracted.description).toContain("About Us - Explore our curated selections");
      expect(extracted.socialImage).toBeUndefined();
    });

    it("extracts image from section style bgImage if settings.image is absent", () => {
      const banner = newSection("banner");
      banner.settings.title = "Spring Festive Discount";
      banner.style = { bgImage: "https://example.com/bg-banner.jpg" };

      const page: PageJson = {
        version: 1,
        sections: [banner],
      };

      const extracted = extractPageSeoHeuristic(page);
      expect(extracted.title).toBe("Spring Festive Discount");
      expect(extracted.socialImage).toBe("https://example.com/bg-banner.jpg");
    });
  });

  describe("calculateSeoHealthScore", () => {
    it("calculates a high health score (>=80) for well-optimized page metadata", () => {
      const optimalSeo: PageSeoSettings = {
        title: "Authentic Silk Panjabi & Eid Collection | Dhaka", // ~50 chars
        description: "Explore our exclusive handcrafted silk panjabi and kurta collection with nationwide doorstep Cash on Delivery across all 64 districts in Bangladesh.", // ~150 chars
        socialImage: "https://example.com/og-banner.webp",
        noIndex: false,
      };

      const report = calculateSeoHealthScore(optimalSeo);
      expect(report.score).toBe(100);
      expect(report.status).toBe("good");
      expect(report.checklist.every((c) => c.passed)).toBe(true);
    });

    it("flags missing title and description as bad (<45)", () => {
      const emptySeo: PageSeoSettings = {};
      const report = calculateSeoHealthScore(emptySeo);
      expect(report.score).toBeLessThan(45);
      expect(report.status).toBe("bad");

      const titleCheck = report.checklist.find((c) => c.id === "title_present");
      expect(titleCheck?.passed).toBe(false);

      const descCheck = report.checklist.find((c) => c.id === "desc_present");
      expect(descCheck?.passed).toBe(false);
    });

    it("awards partial score and warns when title or description is too short or too long", () => {
      const shortSeo: PageSeoSettings = {
        title: "Short", // < 40 chars
        description: "Too short description.", // < 120 chars
      };

      const report = calculateSeoHealthScore(shortSeo);
      expect(report.status).toBe("warning");

      const titleLenCheck = report.checklist.find((c) => c.id === "title_length");
      expect(titleLenCheck?.passed).toBe(false);

      const descLenCheck = report.checklist.find((c) => c.id === "desc_length");
      expect(descLenCheck?.passed).toBe(false);
    });

    it("penalizes score when page is marked with noIndex", () => {
      const noIndexSeo: PageSeoSettings = {
        title: "Authentic Silk Panjabi & Eid Collection | Dhaka",
        description: "Explore our exclusive handcrafted silk panjabi and kurta collection with nationwide doorstep Cash on Delivery across all 64 districts in Bangladesh.",
        socialImage: "https://example.com/banner.webp",
        noIndex: true,
      };

      const report = calculateSeoHealthScore(noIndexSeo);
      expect(report.score).toBe(90); // 100 - 10 for indexing
      const indexCheck = report.checklist.find((c) => c.id === "indexing");
      expect(indexCheck?.passed).toBe(false);
      expect(indexCheck?.tip).toContain("marked as 'noindex'");
    });
  });

  describe("validatePage with SEO schema", () => {
    it("validates and preserves seo metadata on PageJson", () => {
      const pageWithSeo = {
        version: 1,
        sections: [
          {
            id: "hero_1",
            type: "hero",
            settings: { title: "Welcome" },
          },
          {
            id: "trust_strip_1",
            type: "trust-strip",
            settings: {},
          },
        ],
        seo: {
          title: "<b>Online Shopping BD</b>",
          description: "Top e-commerce store with cash on delivery.",
          socialImage: "https://example.com/cover.jpg",
          keywords: "shopping, ecommerce, bangladesh",
        },
      };

      const validated = validatePage("home", pageWithSeo);
      expect(validated.seo).toBeDefined();
      expect(validated.seo?.title).toBe("Online Shopping BD");
      expect(validated.seo?.description).toBe("Top e-commerce store with cash on delivery.");
      expect(validated.seo?.socialImage).toBe("https://example.com/cover.jpg");
      expect(validated.seo?.keywords).toBe("shopping, ecommerce, bangladesh");
    });
  });
});
