import { describe, expect, it } from "vitest";
import {
  SECTIONS,
  STORE_SECTION_CATEGORIES,
  newSection,
  normalizeSectionStyle,
  normalizeSettings,
  sectionDef,
  sectionsFor,
  validatePage,
  youtubeId,
  type PageJson,
} from "../src";

describe("Visual Theme Builder Studio - New Conversion Sections", () => {
  const NEW_TYPES = [
    "countdown-timer",
    "accordion-faq",
    "marquee-ticker",
    "video-reels",
    "floating-contact",
  ] as const;

  it("all 5 high-converting Bangladeshi e-commerce sections are registered in SECTIONS", () => {
    for (const type of NEW_TYPES) {
      const def = sectionDef(type);
      expect(def, `Section def for ${type} must exist`).toBeDefined();
      expect(def?.type).toBe(type);
      expect(def?.label).toBeTruthy();
      expect(def?.description).toBeTruthy();
    }
  });

  it("every new section initializes with valid defaults and normalizes cleanly", () => {
    for (const type of NEW_TYPES) {
      const def = sectionDef(type)!;
      const initial = newSection(type);
      expect(initial.type).toBe(type);
      expect(initial.id).toBeTruthy();
      expect(initial.id.length).toBeGreaterThan(6);

      // Normalization of empty settings should return valid defaults without throwing
      const normalized = normalizeSettings(def, {});
      expect(normalized).toBeDefined();
      expect(typeof normalized).toBe("object");
    }
  });

  describe("countdown-timer section", () => {
    const def = sectionDef("countdown-timer")!;

    it("has required timer fields and Bengali twin fields", () => {
      const fieldKeys = def.fields.map((f) => f.key);
      expect(fieldKeys).toContain("badge");
      expect(fieldKeys).toContain("badgeBn");
      expect(fieldKeys).toContain("title");
      expect(fieldKeys).toContain("titleBn");
      expect(fieldKeys).toContain("subhead");
      expect(fieldKeys).toContain("subheadBn");
      expect(fieldKeys).toContain("endsAt");
      expect(fieldKeys).toContain("ctaText");
      expect(fieldKeys).toContain("ctaTextBn");
      expect(fieldKeys).toContain("ctaLink");
    });

    it("sanitizes text fields and preserves Bengali content", () => {
      const s = normalizeSettings(def, {
        title: "<b>Mega Eid Flash Sale</b>",
        titleBn: "ঈদের সেরা অফার",
      });
      expect(s.title).toBe("Mega Eid Flash Sale");
      expect(s.titleBn).toBe("ঈদের সেরা অফার");
    });
  });

  describe("accordion-faq section", () => {
    const def = sectionDef("accordion-faq")!;

    it("contains list spec with Q&A and Bengali twins", () => {
      expect(def.list).toBeDefined();
      expect(def.list?.key).toBe("items");
      const subKeys = def.list?.fields.map((f) => f.key) ?? [];
      expect(subKeys).toContain("q");
      expect(subKeys).toContain("qBn");
      expect(subKeys).toContain("a");
      expect(subKeys).toContain("aBn");
    });

    it("provides built-in COD and delivery questions in defaults", () => {
      const s = normalizeSettings(def, {});
      const items = s.items as Array<Record<string, unknown>>;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items[0]?.q).toContain("Cash on Delivery");
      expect(items[0]?.qBn).toContain("ক্যাশ অন ডেলিভারি");
    });
  });

  describe("marquee-ticker section", () => {
    const def = sectionDef("marquee-ticker")!;

    it("contains speed options and badge icon choices", () => {
      const speedField = def.fields.find((f) => f.key === "speed");
      expect(speedField).toBeDefined();
      expect(speedField?.type).toBe("select");
      expect(speedField?.options?.map((o) => o.value)).toContain("normal");
      expect(speedField?.options?.map((o) => o.value)).toContain("slow");
      expect(speedField?.options?.map((o) => o.value)).toContain("fast");

      const iconField = def.fields.find((f) => f.key === "icon");
      expect(iconField).toBeDefined();
      expect(iconField?.options?.map((o) => o.value)).toContain("lightning");
    });

    it("normalizes ticker text and Bengali twins", () => {
      const s = normalizeSettings(def, {});
      expect(String(s.text)).toContain("CASH ON DELIVERY");
      expect(String(s.textBn)).toContain("ক্যাশ অন ডেলিভারি");
    });
  });

  describe("video-reels section", () => {
    const def = sectionDef("video-reels")!;

    it("supports 16-9 widescreen and 9-16 vertical reels aspect ratio", () => {
      const ratioField = def.fields.find((f) => f.key === "aspectRatio");
      expect(ratioField).toBeDefined();
      expect(ratioField?.options?.map((o) => o.value)).toEqual(["16-9", "9-16"]);
    });

    it("correctly extracts YouTube ID from multiple YouTube URL formats", () => {
      expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(youtubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(youtubeId("not-a-valid-url")).toBeNull();
    });
  });

  describe("floating-contact section", () => {
    const def = sectionDef("floating-contact")!;

    it("contains phone, whatsapp, position, and message fields", () => {
      const keys = def.fields.map((f) => f.key);
      expect(keys).toContain("phone");
      expect(keys).toContain("whatsapp");
      expect(keys).toContain("position");
      expect(keys).toContain("message");
    });

    it("normalizes default WhatsApp message and position", () => {
      const s = normalizeSettings(def, {});
      expect(s.position).toBe("bottom-right");
      expect(String(s.message)).toContain("ask a question");
    });
  });

  describe("Page integration & validation", () => {
    it("allows new sections on home and custom pages", () => {
      const homeSections = sectionsFor("home").map((d) => d.type);
      const customSections = sectionsFor("custom").map((d) => d.type);

      for (const type of NEW_TYPES) {
        expect(homeSections).toContain(type);
        expect(customSections).toContain(type);
      }
    });

    it("validates a home page with all 5 new sections included", () => {
      const page: PageJson = {
        version: 1,
        sections: [
          newSection("hero"),
          newSection("countdown-timer"),
          newSection("marquee-ticker"),
          newSection("video-reels"),
          newSection("accordion-faq"),
          newSection("floating-contact"),
        ],
      };

      expect(() => validatePage("home", page)).not.toThrow();
    });
  });

  describe("Section Categories for Theme Builder Studio", () => {
    it("all section types in STORE_SECTION_CATEGORIES exist in SECTIONS", () => {
      const allTypes = new Set(SECTIONS.map((s) => s.type));

      for (const cat of STORE_SECTION_CATEGORIES) {
        for (const type of cat.types) {
          expect(allTypes.has(type), `Category "${cat.title}" contains unrecognized type "${type}"`).toBe(true);
        }
      }
    });
  });

  describe("Phase 2 Dynamic Modern Widgets", () => {
    const PHASE2_TYPES = ["bento-grid", "content-tabs", "video-lightbox"];

    it("registers all Phase 2 modern dynamic sections in SECTIONS", () => {
      const types = SECTIONS.map((s) => s.type);
      for (const t of PHASE2_TYPES) {
        expect(types).toContain(t);
      }
    });

    it("normalizes bento-grid settings and items list properly", () => {
      const def = sectionDef("bento-grid")!;
      expect(def).toBeDefined();
      const s = normalizeSettings(def, {});
      expect(s.layout).toBe("bento-3");
      expect(Array.isArray(s.items)).toBe(true);
      const items = s.items as Array<Record<string, unknown>>;
      expect(items.length).toBeGreaterThan(0);
      expect(items[0]?.cardStyle).toBe("accent");
      expect(items[0]?.span).toBe("2");
    });

    it("normalizes content-tabs settings and items list properly", () => {
      const def = sectionDef("content-tabs")!;
      expect(def).toBeDefined();
      const s = normalizeSettings(def, {});
      expect(s.tabStyle).toBe("pills");
      expect(Array.isArray(s.items)).toBe(true);
      const items = s.items as Array<Record<string, unknown>>;
      expect(items.length).toBeGreaterThanOrEqual(3);
      expect(items[0]?.label).toBe("Quality Craft");
    });

    it("normalizes video-lightbox settings and aspect ratio properly", () => {
      const def = sectionDef("video-lightbox")!;
      expect(def).toBeDefined();
      const s = normalizeSettings(def, {});
      expect(s.aspectRatio).toBe("16-9");
      expect(s.videoUrl).toContain("youtube.com");
      expect(s.playLabel).toBe("Watch Story (2 mins)");
    });

    it("validates a page containing Phase 2 modern widgets", () => {
      const page: PageJson = {
        version: 1,
        sections: [
          newSection("hero"),
          newSection("bento-grid"),
          newSection("content-tabs"),
          newSection("video-lightbox"),
        ],
      };

      expect(() => validatePage("home", page)).not.toThrow();
      
      const customPage: PageJson = {
        version: 1,
        sections: [
          newSection("banner"),
          newSection("bento-grid"),
          newSection("content-tabs"),
          newSection("video-lightbox"),
        ],
      };
      expect(() => validatePage("custom", customPage)).not.toThrow();
    });
  });

  describe("Phase 3 Conversions, Reviews & Pricing Matrix Widgets", () => {
    const PHASE3_TYPES = ["testimonials-slider", "pricing-matrix", "promo-popup"];

    it("registers all Phase 3 sections in SECTIONS", () => {
      const types = SECTIONS.map((s) => s.type);
      for (const t of PHASE3_TYPES) {
        expect(types).toContain(t);
      }
    });

    it("normalizes testimonials-slider with star ratings and verified buyer badges", () => {
      const def = sectionDef("testimonials-slider")!;
      expect(def).toBeDefined();
      const s = normalizeSettings(def, {});
      expect(s.layout).toBe("cards");
      expect(Array.isArray(s.items)).toBe(true);
      const items = s.items as Array<Record<string, unknown>>;
      expect(items.length).toBeGreaterThanOrEqual(3);
      expect(items[0]?.name).toBe("Sumaiya Akter");
      expect(items[0]?.rating).toBe(5);
      expect(items[0]?.verified).toBe(true);
    });

    it("normalizes pricing-matrix with highlighted plan and feature checklist", () => {
      const def = sectionDef("pricing-matrix")!;
      expect(def).toBeDefined();
      const s = normalizeSettings(def, {});
      expect(Array.isArray(s.items)).toBe(true);
      const items = s.items as Array<Record<string, unknown>>;
      expect(items.length).toBeGreaterThanOrEqual(3);
      const popular = items.find((i) => i.highlighted);
      expect(popular).toBeDefined();
      expect(popular?.name).toBe("Growth Pro");
      expect(popular?.price).toBe("৳ 1,499");
      expect(String(popular?.features)).toContain("Unlimited Monthly Orders");
    });

    it("normalizes promo-popup with code, discount banner, and trigger", () => {
      const def = sectionDef("promo-popup")!;
      expect(def).toBeDefined();
      const s = normalizeSettings(def, {});
      expect(s.trigger).toBe("delay");
      expect(s.code).toBe("SAVE200");
      expect(s.discountText).toBe("৳ 200 FLAT OFF");
      expect(s.showPhoneCapture).toBe(false);
    });

    it("validates pages containing all Phase 3 modern conversion widgets", () => {
      const page: PageJson = {
        version: 1,
        sections: [
          newSection("hero"),
          newSection("testimonials-slider"),
          newSection("pricing-matrix"),
          newSection("promo-popup"),
        ],
      };

      expect(() => validatePage("home", page)).not.toThrow();

      const customPage: PageJson = {
        version: 1,
        sections: [
          newSection("banner"),
          newSection("testimonials-slider"),
          newSection("pricing-matrix"),
          newSection("promo-popup"),
        ],
      };
      expect(() => validatePage("custom", customPage)).not.toThrow();
    });
  });

  describe("Phase 4 Motion, Developer Controls & Section Nicknames", () => {
    it("normalizes animation presets, duration, and delay", () => {
      const style = normalizeSectionStyle({
        animation: "slide-up",
        animDuration: "fast",
        animDelay: 150,
      });
      expect(style).toBeDefined();
      expect(style?.animation).toBe("slide-up");
      expect(style?.animDuration).toBe("fast");
      expect(style?.animDelay).toBe(150);
    });

    it("drops invalid animation values safely", () => {
      const style = normalizeSectionStyle({
        animation: "invalid-bounce",
        animDuration: "ultra-slow",
        animDelay: 9999,
      });
      expect(style).toBeUndefined();
    });

    it("cleans and normalizes anchorId slug", () => {
      const style = normalizeSectionStyle({
        anchorId: " #Our-Menu_2026! ",
      });
      expect(style?.anchorId).toBe("our-menu_2026");

      const invalidStyle = normalizeSectionStyle({
        anchorId: "x", // too short (min 2)
      });
      expect(invalidStyle?.anchorId).toBeUndefined();
    });

    it("cleans and sanitizes customClass string", () => {
      const style = normalizeSectionStyle({
        customClass: "  hero-glow  card-highlight <script>alert(1)</script> ",
      });
      expect(style?.customClass).toBe("hero-glow  card-highlight scriptalert1script");
    });

    it("validates and preserves section label (custom nickname) in validatePage", () => {
      const page: PageJson = {
        version: 1,
        sections: [
          {
            ...newSection("hero"),
            label: "Eid Festival Hero Banner",
            style: {
              animation: "zoom-in",
              animDuration: "normal",
              anchorId: "featured",
              customClass: "eid-hero-banner",
            },
          },
        ],
      };

      const validated = validatePage("home", page);
      expect(validated.sections[0]?.label).toBe("Eid Festival Hero Banner");
      expect(validated.sections[0]?.style?.animation).toBe("zoom-in");
      expect(validated.sections[0]?.style?.anchorId).toBe("featured");
      expect(validated.sections[0]?.style?.customClass).toBe("eid-hero-banner");
    });
  });
});



