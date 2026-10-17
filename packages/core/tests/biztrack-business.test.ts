import { describe, expect, it } from "vitest";
import {
  SITE_MODES,
  BUSINESS_VERTICALS,
  isSiteMode,
  isBusinessVertical,
  normalizeSiteMode,
  normalizeBusinessVertical,
} from "../src/site/mode";
import {
  getBusinessTemplate,
  getBusinessTemplateByVertical,
  BUSINESS_TEMPLATES,
} from "../src/site/templates/manifests";
import {
  validateContentItemData,
  slugifyContentTitle,
  UpsertContentItemSchema,
  contentItemsCsv,
} from "../src/site/content-items";
import {
  UpsertDownloadSchema,
  downloadsCsv,
} from "../src/site/downloads";
import {
  listPublicPortfolioPlans,
  FALLBACK_PORTFOLIO_PLANS,
} from "../src/platform/billing";
import { createPublicLead } from "../src/site/leads";
import { createPublicBooking } from "../src/site/bookings";
import { SECTIONS, STORE_SECTION_CATEGORIES } from "../src/builder/registry";
import { CUSTOM_PAGE_TEMPLATES } from "../src/builder/custom-pages";
import { can, PERMISSIONS, AREAS } from "../src/permissions";
import type { SiteContentItem, SiteDownload } from "@biztrackbd/db";

describe("BizTrack Business Architecture & Quality Gates (Phase 5)", () => {
  describe("1. Mode & Vertical Architecture", () => {
    it("validates all site modes and vertical types", () => {
      expect(isSiteMode("ECOMMERCE")).toBe(true);
      expect(isSiteMode("PORTFOLIO")).toBe(true);
      expect(isSiteMode("HYBRID")).toBe(true);
      expect(isSiteMode("INVALID")).toBe(false);

      expect(isBusinessVertical("RESTAURANT")).toBe(true);
      expect(isBusinessVertical("DOCTOR_CLINIC")).toBe(true);
      expect(isBusinessVertical("PUBLIC_FIGURE")).toBe(true);
      expect(isBusinessVertical("BUSINESS_COMPANY")).toBe(true);
      expect(isBusinessVertical("SERVICE_PROVIDER")).toBe(true);
      expect(isBusinessVertical("PERSONAL_PORTFOLIO")).toBe(true);
      expect(isBusinessVertical("UNKNOWN")).toBe(false);
    });

    it("normalizes unknown modes to ECOMMERCE and verticals to null", () => {
      expect(normalizeSiteMode("INVALID")).toBe("ECOMMERCE");
      expect(normalizeSiteMode(null)).toBe("ECOMMERCE");
      expect(normalizeSiteMode("PORTFOLIO")).toBe("PORTFOLIO");

      expect(normalizeBusinessVertical("INVALID")).toBeNull();
      expect(normalizeBusinessVertical(null)).toBeNull();
      expect(normalizeBusinessVertical("RESTAURANT")).toBe("RESTAURANT");
    });

    it("resolves starter templates matching verticals", () => {
      const restaurantTpl = getBusinessTemplateByVertical("RESTAURANT");
      expect(restaurantTpl?.id).toBe("dhaka-bistro");
      expect(restaurantTpl?.vertical).toBe("RESTAURANT");

      const clinicTpl = getBusinessTemplateByVertical("DOCTOR_CLINIC");
      expect(clinicTpl?.id).toBe("modern-clinic");
      expect(clinicTpl?.vertical).toBe("DOCTOR_CLINIC");

      const fallbackTpl = getBusinessTemplateByVertical(null);
      expect(fallbackTpl).toBeDefined();
      expect(fallbackTpl?.id).toBe("dhaka-bistro");
    });
  });

  describe("2. SiteContentItem Data Validation & Security", () => {
    it("sanitizes SERVICE data and drops unexpected fields", () => {
      const clean = validateContentItemData("SERVICE", {
        priceStartingAt: 12000,
        features: ["Initial Review", "Implementation", "30-day Support"],
        icon: "shield-check",
        ctaLabel: "Get Started",
        ctaUrl: "/contact",
        injectionPayload: "DROP TABLE users;",
      });

      expect(clean).toBeDefined();
      expect(clean?.priceStartingAt).toBe(12000);
      expect(clean?.features).toHaveLength(3);
      expect((clean as Record<string, unknown>).injectionPayload).toBeUndefined();
    });

    it("sanitizes CREDENTIAL data for verified doctors and professionals", () => {
      const clean = validateContentItemData("CREDENTIAL", {
        issuer: "Dhaka Medical College",
        credentialId: "BMDC-A-12345",
        issuedYear: "2018",
        verificationUrl: "https://bmdc.org.bd/verify",
        unexpectedHackerField: "malicious_content",
      });

      expect(clean).toBeDefined();
      expect(clean?.issuer).toBe("Dhaka Medical College");
      expect(clean?.credentialId).toBe("BMDC-A-12345");
      expect(clean?.issuedYear).toBe("2018");
      expect((clean as Record<string, unknown>).unexpectedHackerField).toBeUndefined();
    });

    it("generates deterministic slugs and handles non-Latin/Bengali characters", () => {
      expect(slugifyContentTitle("Dental Cleaning & Whitening")).toBe("dental-cleaning-whitening");
      expect(slugifyContentTitle("  Specialized Cardiologist Consultation 2026!  ")).toBe(
        "specialized-cardiologist-consultation-2026"
      );
      // Pure non-ASCII title generates a deterministic timestamp fallback
      const bnSlug = slugifyContentTitle("দাঁতের স্কেলিং ও পলিশিং");
      expect(bnSlug).toMatch(/^item-[a-z0-9]+$/);
    });

    it("neutralizes CSV formula injection in content items export", () => {
      const maliciousItems = [
        {
          id: "item_malicious_1",
          tenantId: "tenant_1",
          kind: "SERVICE",
          title: "=cmd|' /C calc'!A0",
          titleBn: null,
          slug: "calc-exploit",
          summary: "+1234567890",
          summaryBn: null,
          bodyHtml: null,
          bodyHtmlBn: null,
          mediaUrl: null,
          data: null,
          isPublished: true,
          sortOrder: 0,
          createdAt: new Date("2026-10-16T12:00:00Z"),
          updatedAt: new Date("2026-10-16T12:00:00Z"),
        },
        {
          id: "item_malicious_2",
          tenantId: "tenant_1",
          kind: "PORTFOLIO",
          title: "@SUM(1+1)*cmd|' /C calc'!A0",
          titleBn: null,
          slug: "sum-exploit",
          summary: "-danger",
          summaryBn: null,
          bodyHtml: null,
          bodyHtmlBn: null,
          mediaUrl: null,
          data: null,
          isPublished: true,
          sortOrder: 1,
          createdAt: new Date("2026-10-16T12:00:00Z"),
          updatedAt: new Date("2026-10-16T12:00:00Z"),
        },
      ] as unknown as SiteContentItem[];

      const csv = contentItemsCsv(maliciousItems);

      // Verify dangerous formula prefixes are escaped with a leading single quote
      expect(csv).toContain("\"'=cmd|' /C calc'!A0\"");
      expect(csv).toContain("\"'+1234567890\"");
      expect(csv).toContain("\"'@SUM(1+1)*cmd|' /C calc'!A0\"");
      expect(csv).toContain("\"'-danger\"");
    });
  });

  describe("3. Digital Downloads & Lead-Gating Validation", () => {
    it("validates UpsertDownloadSchema for lead-gated and public downloads", () => {
      const publicParsed = UpsertDownloadSchema.safeParse({
        label: "Autumn Dining Menu 2026",
        fileUrl: "https://cdn.biztrackbd.com/menu.pdf",
        fileName: "menu.pdf",
        fileSize: 2450000,
        mimeType: "application/pdf",
        isPublic: true,
      });
      expect(publicParsed.success).toBe(true);
      if (publicParsed.success) {
        expect(publicParsed.data.isPublic).toBe(true);
      }

      const gatedParsed = UpsertDownloadSchema.safeParse({
        label: "Exclusive Brand Lookbook & Ratecard",
        fileUrl: "https://cdn.biztrackbd.com/lookbook.pdf",
        fileName: "lookbook.pdf",
        requiresLead: true, // friendly alias
      });
      expect(gatedParsed.success).toBe(true);
      if (gatedParsed.success) {
        expect(gatedParsed.data.isPublic).toBe(false);
      }
    });

    it("neutralizes CSV formula injection in digital downloads export", () => {
      const downloads = [
        {
          id: "dl_1",
          tenantId: "tenant_1",
          label: "=1+1",
          labelBn: null,
          kind: "FILE",
          fileUrl: "https://cdn.example.com/f.pdf",
          fileName: "-test.pdf",
          fileSize: 1024,
          mimeType: "application/pdf",
          isPublic: false,
          downloadCount: 42,
          sortOrder: 0,
          createdAt: new Date("2026-10-16T12:00:00Z"),
          updatedAt: new Date("2026-10-16T12:00:00Z"),
        },
      ] as unknown as SiteDownload[];

      const csv = downloadsCsv(downloads);
      expect(csv).toContain("\"'=1+1\"");
      expect(csv).toContain("\"'-test.pdf\"");
      expect(csv).toContain("Gated (Lead Required)");
    });
  });

  describe("4. Anti-Bot Shield & Validation for Leads and Bookings", () => {
    it("shields honeypot submissions without leaking error to bot", async () => {
      const lead = await createPublicLead("tenant-test", {
        name: "Bot Spammer",
        phone: "01711111111",
        hp: "http://spam.org",
      });
      expect(lead.status).toBe("SPAM");
      expect(lead.id).toBe("lead_bot_shielded");

      const booking = await createPublicBooking("tenant-test", {
        name: "Bot Booking",
        phone: "01711111111",
        hp: "filled_honeypot",
      });
      expect(booking.bookingId).toBe("bk_shielded");
    });

    it("shields sub-second automated rapid submissions (elapsedMs < 1500)", async () => {
      const lead = await createPublicLead("tenant-test", {
        name: "Headless Chrome Bot",
        email: "bot@automation.com",
        elapsedMs: 350,
      });
      expect(lead.status).toBe("SPAM");
      expect(lead.id).toBe("lead_bot_speed_shielded");

      const booking = await createPublicBooking("tenant-test", {
        name: "Rapid Booking",
        phone: "01711111111",
        elapsedMs: 500,
      });
      expect(booking.bookingId).toBe("bk_speed_shielded");
    });

    it("rejects leads with insufficient name length", async () => {
      await expect(
        createPublicLead("tenant-test", {
          name: "X",
          phone: "01711111111",
          elapsedMs: 2500,
        })
      ).rejects.toThrow(/at least 2 characters/);
    });

    it("rejects leads missing both phone and email contact options", async () => {
      await expect(
        createPublicLead("tenant-test", {
          name: "Anonymous Visitor",
          message: "Please contact me",
          elapsedMs: 3000,
        })
      ).rejects.toThrow(/phone number or an email/);
    });
  });

  describe("5. Portfolio Plans & Pricing Architecture", () => {
    it("provides 3 public portfolio fallback plans with zero commission and custom domains", async () => {
      const plans = await listPublicPortfolioPlans();
      expect(plans).toHaveLength(3);

      const [starter, pro, business] = plans;
      expect(starter?.tier).toBe("STARTER");
      expect(starter?.priceMonthly).toBe(399);
      expect(starter?.features.customDomain).toBe(true);
      expect(starter?.features.mode).toBe("PORTFOLIO");

      expect(pro?.tier).toBe("PRO");
      expect(pro?.priceMonthly).toBe(799);
      expect(pro?.features.bookingRequests).toBe(true);
      expect(pro?.features.downloadsLimit).toBe("unlimited");

      expect(business?.tier).toBe("BUSINESS");
      expect(business?.priceMonthly).toBe(1499);
      expect(business?.features.hybridStore).toBe(true);
      expect(business?.features.teamProfiles).toBe(true);
    });
  });

  describe("6. Theme & Page Builder Vertical Integration (Milestones 1-3)", () => {
    it("features 'business' as top drawer category #2 after 'all'", () => {
      expect(STORE_SECTION_CATEGORIES[0]?.id).toBe("all");
      expect(STORE_SECTION_CATEGORIES[1]?.id).toBe("business");
      expect(STORE_SECTION_CATEGORIES[1]?.title).toBe("Business & Verticals");
    });

    it("verifies all 10 vertical sections are registered in SECTIONS with proper categories and settings", () => {
      const sectionTypes = [
        "restaurant-menu",
        "restaurant-hours-location",
        "reservation-cta",
        "doctor-hero",
        "clinic-chambers",
        "service-cards",
        "team-grid",
        "portfolio-grid",
        "download-card",
        "contact-form",
      ];

      for (const st of sectionTypes) {
        const sec = SECTIONS.find((s) => s.type === st);
        expect(sec).toBeDefined();
        expect(sec?.label).toBeTruthy();
        expect(sec?.description).toBeTruthy();
      }

      // Check specific vertical tags and defaults
      const menuSec = SECTIONS.find((s) => s.type === "restaurant-menu");
      expect(menuSec?.verticals).toContain("RESTAURANT");
      expect(menuSec?.fields.some((f) => f.key === "source")).toBe(true);
      expect(menuSec?.list?.key).toBe("items");

      const serviceSec = SECTIONS.find((s) => s.type === "service-cards");
      expect(serviceSec?.fields.some((f) => f.key === "source")).toBe(true);
      expect(serviceSec?.fields.some((f) => f.key === "columns")).toBe(true);
      expect(serviceSec?.list?.key).toBe("items");

      const teamSec = SECTIONS.find((s) => s.type === "team-grid");
      expect(teamSec?.fields.some((f) => f.key === "columns")).toBe(true);
      expect(teamSec?.list?.key).toBe("items");

      const portfolioSec = SECTIONS.find((s) => s.type === "portfolio-grid");
      expect(portfolioSec?.fields.some((f) => f.key === "columns")).toBe(true);
      expect(portfolioSec?.list?.key).toBe("items");

      const businessCat = STORE_SECTION_CATEGORIES.find((c) => c.id === "business");
      expect(businessCat?.types).toContain("contact-form");
    });

    it("provides all 5 vertical presets in CUSTOM_PAGE_TEMPLATES", () => {
      const templateKeys = CUSTOM_PAGE_TEMPLATES.map((t) => t.id);
      expect(templateKeys).toContain("services");
      expect(templateKeys).toContain("portfolio");
      expect(templateKeys).toContain("team");
      expect(templateKeys).toContain("chambers");
      expect(templateKeys).toContain("menu");

      const servicesTpl = CUSTOM_PAGE_TEMPLATES.find((t) => t.id === "services");
      expect(servicesTpl?.titleSuggestion).toBe("Services");
      expect(servicesTpl?.build().sections.some((s) => s.type === "service-cards")).toBe(true);

      const portfolioTpl = CUSTOM_PAGE_TEMPLATES.find((t) => t.id === "portfolio");
      expect(portfolioTpl?.titleSuggestion).toBe("Portfolio");
      expect(portfolioTpl?.build().sections.some((s) => s.type === "portfolio-grid")).toBe(true);

      const teamTpl = CUSTOM_PAGE_TEMPLATES.find((t) => t.id === "team");
      expect(teamTpl?.titleSuggestion).toBe("Our Team");
      expect(teamTpl?.build().sections.some((s) => s.type === "team-grid")).toBe(true);

      const chambersTpl = CUSTOM_PAGE_TEMPLATES.find((t) => t.id === "chambers");
      expect(chambersTpl?.titleSuggestion).toBe("Chambers & Appointment");
      expect(chambersTpl?.build().sections.some((s) => s.type === "clinic-chambers")).toBe(true);

      const menuTpl = CUSTOM_PAGE_TEMPLATES.find((t) => t.id === "menu");
      expect(menuTpl?.titleSuggestion).toBe("Menu");
      expect(menuTpl?.build().sections.some((s) => s.type === "restaurant-menu")).toBe(true);
    });
  });

  describe("6. Dedicated Business Permissions (AUTH-001)", () => {
    it("includes leads and bookings in system AREAS", () => {
      expect(AREAS).toContain("leads");
      expect(AREAS).toContain("bookings");
    });

    it("verifies STORE_OWNER has full edit permissions across all areas including leads and bookings", () => {
      expect(can("STORE_OWNER", "leads", "view")).toBe(true);
      expect(can("STORE_OWNER", "leads", "edit")).toBe(true);
      expect(can("STORE_OWNER", "bookings", "view")).toBe(true);
      expect(can("STORE_OWNER", "bookings", "edit")).toBe(true);
    });

    it("verifies STORE_MANAGER has full edit permissions for leads and bookings", () => {
      expect(can("STORE_MANAGER", "leads", "view")).toBe(true);
      expect(can("STORE_MANAGER", "leads", "edit")).toBe(true);
      expect(can("STORE_MANAGER", "bookings", "view")).toBe(true);
      expect(can("STORE_MANAGER", "bookings", "edit")).toBe(true);
    });

    it("verifies TELEMARKETER (support) can triage and edit leads and bookings", () => {
      expect(can("TELEMARKETER", "leads", "view")).toBe(true);
      expect(can("TELEMARKETER", "leads", "edit")).toBe(true);
      expect(can("TELEMARKETER", "bookings", "view")).toBe(true);
      expect(can("TELEMARKETER", "bookings", "edit")).toBe(true);
    });

    it("verifies ORDER_PACKER is strictly forbidden from accessing leads and bookings", () => {
      expect(can("ORDER_PACKER", "leads", "view")).toBe(false);
      expect(can("ORDER_PACKER", "leads", "edit")).toBe(false);
      expect(can("ORDER_PACKER", "bookings", "view")).toBe(false);
      expect(can("ORDER_PACKER", "bookings", "edit")).toBe(false);
    });

    it("verifies CONTENT_EDITOR is strictly forbidden from accessing private leads and bookings", () => {
      expect(can("CONTENT_EDITOR", "leads", "view")).toBe(false);
      expect(can("CONTENT_EDITOR", "leads", "edit")).toBe(false);
      expect(can("CONTENT_EDITOR", "bookings", "view")).toBe(false);
      expect(can("CONTENT_EDITOR", "bookings", "edit")).toBe(false);
    });
  });

  describe("7. Plan Continuity & Public Pricing (PLAN-001, PLAN-003)", () => {
    it("ensures public Business plans return exact agreed tiers: ৳399, ৳799, ৳1,499", () => {
      const plans = FALLBACK_PORTFOLIO_PLANS;
      expect(plans).toHaveLength(3);

      const starter = plans.find((p) => p.tier === "STARTER");
      expect(starter).toBeDefined();
      expect(starter?.priceMonthly).toBe(399);
      expect(starter?.priceYearly).toBe(3990);
      expect(starter?.features.mode).toBe("PORTFOLIO");
      expect(starter?.features.leadCapture).toBe(true);

      const pro = plans.find((p) => p.tier === "PRO");
      expect(pro).toBeDefined();
      expect(pro?.priceMonthly).toBe(799);
      expect(pro?.priceYearly).toBe(7990);
      expect(pro?.features.bookingRequests).toBe(true);

      const business = plans.find((p) => p.tier === "BUSINESS");
      expect(business).toBeDefined();
      expect(business?.priceMonthly).toBe(1499);
      expect(business?.priceYearly).toBe(14990);
    });
  });
});

