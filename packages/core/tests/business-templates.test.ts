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
  it("defines the 6 launch templates with custom pages and chrome", () => {
    expect(BUSINESS_TEMPLATES).toHaveLength(6);
    const ids = BUSINESS_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual([
      "dhaka-bistro",
      "modern-clinic",
      "apex-corporate",
      "local-service-pro",
      "portfolio-focus",
      "public-profile",
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

  it("retrieves a template by id or alias", () => {
    const bistro = getBusinessTemplate("dhaka-bistro");
    expect(bistro).toBeDefined();
    expect(bistro?.vertical).toBe("RESTAURANT");
    expect(bistro?.customPages.some((p) => p.slug === "menu")).toBe(true);

    const clinic = getBusinessTemplate("modern-clinic");
    expect(clinic).toBeDefined();
    expect(clinic?.vertical).toBe("DOCTOR_CLINIC");
    expect(clinic?.customPages.some((p) => p.slug === "chambers")).toBe(true);

    // Canonical apex-corporate and its alias corporate-trust
    const corpCanonical = getBusinessTemplate("apex-corporate");
    expect(corpCanonical).toBeDefined();
    expect(corpCanonical?.vertical).toBe("BUSINESS_COMPANY");

    const corpAlias = getBusinessTemplate("corporate-trust");
    expect(corpAlias).toBeDefined();
    expect(corpAlias?.id).toBe("apex-corporate");

    // 6th template: public-profile
    const publicProfile = getBusinessTemplate("public-profile");
    expect(publicProfile).toBeDefined();
    expect(publicProfile?.vertical).toBe("PUBLIC_FIGURE");
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

  describe("Business Demo Templates & Demo Subdomains Engine", () => {
    it("defines 5 authentic business demo templates with dedicated subdomains", async () => {
      const { BUSINESS_DEMO_TEMPLATES, isBusinessDemoHost, findBusinessDemoTemplate } = await import(
        "../src/demo/business-templates"
      );

      expect(BUSINESS_DEMO_TEMPLATES).toHaveLength(6);
      const hosts = BUSINESS_DEMO_TEMPLATES.map((t) => t.host);
      expect(hosts).toEqual([
        "dhakabistro",
        "modernclinic",
        "apexcorp",
        "localservice",
        "creativefolio",
        "publicprofile",
      ]);

      for (const tpl of BUSINESS_DEMO_TEMPLATES) {
        expect(tpl.name).toBeTruthy();
        expect(tpl.nameBn).toBeTruthy();
        expect(tpl.tagline).toBeTruthy();
        expect(tpl.taglineBn).toBeTruthy();
        expect(tpl.phone).toBeTruthy();
        expect(tpl.whatsapp).toBeTruthy();
        expect(tpl.palette).toBeDefined();
        expect(tpl.baseLook).toBeTruthy();
      }

      // Check specific vertical data presence
      const bistro = findBusinessDemoTemplate("dhaka-bistro");
      expect(bistro).toBeDefined();
      expect(bistro?.vertical).toBe("RESTAURANT");
      expect(bistro?.menuCategories?.length).toBeGreaterThan(0);
      expect(bistro?.menuCategories?.[0]?.items?.length).toBeGreaterThan(0);

      const clinic = findBusinessDemoTemplate("modern-clinic");
      expect(clinic).toBeDefined();
      expect(clinic?.vertical).toBe("DOCTOR_CLINIC");
      expect(clinic?.contentItems?.some((i) => i.kind === "SERVICE")).toBe(true);
      expect(clinic?.contentItems?.some((i) => i.kind === "CREDENTIAL")).toBe(true);

      const corp = findBusinessDemoTemplate("apex-corporate");
      expect(corp).toBeDefined();
      expect(corp?.vertical).toBe("BUSINESS_COMPANY");
      expect(corp?.contentItems?.some((i) => i.kind === "TEAM")).toBe(true);
      expect(corp?.downloads?.length).toBeGreaterThan(0);

      const service = findBusinessDemoTemplate("local-service-pro");
      expect(service).toBeDefined();
      expect(service?.vertical).toBe("SERVICE_PROVIDER");
      expect(service?.contentItems?.some((i) => i.kind === "SERVICE")).toBe(true);

      const portfolio = findBusinessDemoTemplate("portfolio-focus");
      expect(portfolio).toBeDefined();
      expect(portfolio?.vertical).toBe("PERSONAL_PORTFOLIO");
      expect(portfolio?.contentItems?.some((i) => i.kind === "PORTFOLIO")).toBe(true);
    });

    it("resolves business demo templates by id, host, and aliases", async () => {
      const { findBusinessDemoTemplate, isBusinessDemoHost } = await import(
        "../src/demo/business-templates"
      );

      // By host
      expect(findBusinessDemoTemplate("dhakabistro")?.id).toBe("dhaka-bistro");
      expect(findBusinessDemoTemplate("modernclinic")?.id).toBe("modern-clinic");
      expect(findBusinessDemoTemplate("apexcorp")?.id).toBe("apex-corporate");

      // By hyphenated id
      expect(findBusinessDemoTemplate("dhaka-bistro")?.host).toBe("dhakabistro");
      expect(findBusinessDemoTemplate("local-service-pro")?.host).toBe("localservice");

      // By alias
      expect(findBusinessDemoTemplate("corporate-trust")?.host).toBe("apexcorp");

      // isBusinessDemoHost checks
      expect(isBusinessDemoHost("dhakabistro")).toBe(true);
      expect(isBusinessDemoHost("modernclinic")).toBe(true);
      expect(isBusinessDemoHost("randomstore")).toBe(false);
    });
  });

  it("no template page uses an address the storefront already serves (like /media)", async () => {
    const { BUSINESS_TEMPLATES, RESERVED_PAGE_SLUGS } = await import("../src");
    for (const t of BUSINESS_TEMPLATES) for (const p of t.customPages) expect(RESERVED_PAGE_SLUGS.has(p.slug), `${t.id}/${p.slug}`).toBe(false);
  });

  it("every template's hero says its own words, not the clothing-store defaults", async () => {
    const { BUSINESS_TEMPLATES, validatePage, sectionDef } = await import("../src");
    const dflt = (sectionDef("hero")!.defaults as { title: string }).title;
    for (const t of BUSINESS_TEMPLATES) {
      const hero = validatePage("home", t.pages.home).sections.find((x) => x.type === "hero");
      if (hero) expect(hero.settings.title, t.id).not.toBe(dflt);
    }
  });
});
