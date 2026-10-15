import { describe, expect, it } from "vitest";
import {
  BUSINESS_TEMPLATES,
  getBusinessTemplate,
} from "../src/site/templates/manifests";
import {
  allowedOn,
  recommendedForVertical,
  sectionDef,
  sectionsFor,
} from "../src/builder/registry";

describe("BizTrack Business Templates & Section Filtering", () => {
  it("defines the first 5 launch templates with custom pages and chrome", () => {
    expect(BUSINESS_TEMPLATES).toHaveLength(5);
    const ids = BUSINESS_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual([
      "dhaka-bistro",
      "modern-clinic",
      "corporate-trust",
      "local-service-pro",
      "portfolio-focus",
    ]);

    for (const tpl of BUSINESS_TEMPLATES) {
      expect(tpl.name).toBeTruthy();
      expect(tpl.siteMode).toBe("PORTFOLIO");
      expect(tpl.settings).toBeDefined();
      expect(tpl.pages.home).toBeDefined();
      expect(tpl.customPages.length).toBeGreaterThan(0);
      expect(tpl.chrome.menu.items.length).toBeGreaterThan(0);
    }
  });

  it("retrieves a template by id", () => {
    const bistro = getBusinessTemplate("dhaka-bistro");
    expect(bistro).toBeDefined();
    expect(bistro?.vertical).toBe("RESTAURANT");
    expect(bistro?.customPages.some((p) => p.slug === "menu")).toBe(true);

    const clinic = getBusinessTemplate("modern-clinic");
    expect(clinic).toBeDefined();
    expect(clinic?.vertical).toBe("DOCTOR_CLINIC");
    expect(clinic?.customPages.some((p) => p.slug === "chambers")).toBe(true);
  });

  it("filters commerce sections when mode is PORTFOLIO or commerce capability is false", () => {
    const featuredProds = sectionDef("featured-products");
    expect(featuredProds).toBeDefined();

    // In default/unfiltered mode, allowed on home
    expect(allowedOn(featuredProds!, "home")).toBe(true);

    // In PORTFOLIO mode, commerce section is disallowed
    expect(allowedOn(featuredProds!, "home", { mode: "PORTFOLIO" })).toBe(false);

    // With commerce capability false, commerce section is disallowed
    expect(allowedOn(featuredProds!, "home", { capabilities: { commerce: false } })).toBe(false);

    // With commerce capability true, allowed
    expect(allowedOn(featuredProds!, "home", { capabilities: { commerce: true } })).toBe(true);
  });

  it("allows generic content and vertical sections in PORTFOLIO mode", () => {
    const hero = sectionDef("hero");
    expect(allowedOn(hero!, "home", { mode: "PORTFOLIO" })).toBe(true);

    const restaurantMenu = sectionDef("restaurant-menu");
    expect(allowedOn(restaurantMenu!, "custom", { mode: "PORTFOLIO", capabilities: { menu: true } })).toBe(true);

    // If capabilities.menu is false, restaurant-menu is disallowed
    expect(allowedOn(restaurantMenu!, "custom", { mode: "PORTFOLIO", capabilities: { menu: false } })).toBe(false);
  });

  it("identifies recommended sections for verticals", () => {
    const restaurantMenu = sectionDef("restaurant-menu");
    expect(recommendedForVertical(restaurantMenu!, "RESTAURANT")).toBe(true);
    expect(recommendedForVertical(restaurantMenu!, "DOCTOR_CLINIC")).toBe(false);

    const chambers = sectionDef("clinic-chambers");
    expect(recommendedForVertical(chambers!, "DOCTOR_CLINIC")).toBe(true);
    expect(recommendedForVertical(chambers!, "RESTAURANT")).toBe(false);
  });
});
