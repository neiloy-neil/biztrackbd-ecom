import { describe, expect, it } from "vitest";
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
import { loadPageData } from "../src/builder/data";
import type { PageJson } from "../src/builder/registry";
import type { SiteContentItem, SiteDownload } from "@biztrackbd/db";

describe("BizTrack Business Content Items & Digital Downloads Suite", () => {
  describe("validateContentItemData", () => {
    it("validates and parses SERVICE data with known fields", () => {
      const parsed = validateContentItemData("SERVICE", {
        priceStartingAt: 5000,
        priceStartingAtBn: "৫,০০০ টাকা",
        duration: "2 weeks",
        features: ["Initial consultation", "Design blueprint"],
        icon: "sparkles",
        ctaLabel: "Request Proposal",
        ctaUrl: "/contact",
        unexpectedHackerField: "should_be_stripped",
      });

      expect(parsed).toBeDefined();
      expect(parsed?.priceStartingAt).toBe(5000);
      expect(parsed?.features).toEqual(["Initial consultation", "Design blueprint"]);
      expect(parsed?.ctaLabel).toBe("Request Proposal");
      // Unknown fields are stripped by Zod
      expect((parsed as Record<string, unknown>).unexpectedHackerField).toBeUndefined();
    });

    it("validates and parses PORTFOLIO data", () => {
      const parsed = validateContentItemData("PORTFOLIO", {
        clientName: "Apex Footwear",
        completionDate: "2026-08",
        tags: ["E-Commerce", "Next.js", "Brand Identity"],
        galleryUrls: ["https://cdn.example.com/p1.jpg", "https://cdn.example.com/p2.jpg"],
        testimonialQuote: "Exceptional quality and timely delivery.",
        testimonialAuthor: "Tanvir Ahmed",
        testimonialRole: "Head of Digital",
      });

      expect(parsed).toBeDefined();
      expect(parsed?.clientName).toBe("Apex Footwear");
      expect(parsed?.tags).toHaveLength(3);
      expect(parsed?.galleryUrls).toHaveLength(2);
      expect(parsed?.testimonialAuthor).toBe("Tanvir Ahmed");
    });

    it("validates and parses TEAM data", () => {
      const parsed = validateContentItemData("TEAM", {
        role: "Chief Medical Officer",
        roleBn: "প্রধান চিকিৎসা কর্মকর্তা",
        email: "doctor@clinic.com",
        phone: "+8801700000000",
        bio: "Senior consultant with 15+ years experience.",
        socialLinks: {
          linkedin: "https://linkedin.com/in/doctor",
          twitter: "https://twitter.com/doctor",
        },
        credentials: ["MBBS (Dhaka)", "FCPS (Medicine)"],
      });

      expect(parsed).toBeDefined();
      expect(parsed?.role).toBe("Chief Medical Officer");
      expect(parsed?.email).toBe("doctor@clinic.com");
      expect(parsed?.credentials).toContain("MBBS (Dhaka)");
      expect((parsed?.socialLinks as Record<string, string>)?.linkedin).toBe(
        "https://linkedin.com/in/doctor"
      );
    });

    it("validates and parses CREDENTIAL data", () => {
      const parsed = validateContentItemData("CREDENTIAL", {
        issuer: "Bangladesh Medical & Dental Council",
        issuedYear: 2018,
        credentialId: "BMDC-A-54321",
        verificationUrl: "https://bmdc.org.bd/verify/54321",
      });

      expect(parsed).toBeDefined();
      expect(parsed?.issuer).toBe("Bangladesh Medical & Dental Council");
      expect(parsed?.issuedYear).toBe(2018);
      expect(parsed?.credentialId).toBe("BMDC-A-54321");
    });

    it("returns null for non-object or unknown kinds", () => {
      expect(validateContentItemData("SERVICE", null)).toBeNull();
      expect(validateContentItemData("SERVICE", "string")).toBeNull();
    });
  });

  describe("slugifyContentTitle", () => {
    it("converts titles to clean url-safe slugs", () => {
      expect(slugifyContentTitle("Dental Implant Consultation")).toBe(
        "dental-implant-consultation"
      );
      expect(slugifyContentTitle("Web App & UI/UX Redesign!")).toBe(
        "web-app-ui-ux-redesign"
      );
    });

    it("generates fallback for very short strings", () => {
      const fallback = slugifyContentTitle("A");
      expect(fallback.startsWith("item-")).toBe(true);
    });
  });

  describe("UpsertContentItemSchema", () => {
    it("validates a complete content item input", () => {
      const valid = UpsertContentItemSchema.parse({
        kind: "SERVICE",
        slug: "brand-strategy",
        title: "Brand Strategy Workshop",
        titleBn: "ব্র্যান্ড কৌশল কর্মশালা",
        summary: "Comprehensive 2-day workshop to align your executive team.",
        sortOrder: 1,
        isPublished: true,
      });

      expect(valid.kind).toBe("SERVICE");
      expect(valid.slug).toBe("brand-strategy");
      expect(valid.title).toBe("Brand Strategy Workshop");
    });

    it("rejects empty titles or invalid slugs", () => {
      expect(() =>
        UpsertContentItemSchema.parse({
          kind: "SERVICE",
          slug: "",
          title: "Valid Title",
        })
      ).toThrow();

      expect(() =>
        UpsertContentItemSchema.parse({
          kind: "SERVICE",
          slug: "valid-slug",
          title: "",
        })
      ).toThrow();
    });
  });

  describe("Digital Downloads & Configurable Lead Gate", () => {
    it("validates direct 1-click download asset (isPublic = true)", () => {
      const parsed = UpsertDownloadSchema.parse({
        label: "Company Brochure 2026",
        kind: "BROCHURE",
        fileName: "company-profile-2026.pdf",
        fileUrl: "https://storage.biztrack.me/brochure.pdf",
        fileSize: 4500000,
        mimeType: "application/pdf",
        isPublic: true,
      });

      expect(parsed.label).toBe("Company Brochure 2026");
      expect(parsed.isPublic).toBe(true);
    });

    it("supports requiresLead toggle alias for Lead Magnet mode", () => {
      const parsed = UpsertDownloadSchema.parse({
        label: "Specialist Curriculum Vitae",
        kind: "CV",
        fileName: "dr-tanvir-cv.pdf",
        fileUrl: "https://storage.biztrack.me/cv.pdf",
        requiresLead: true, // Lead gate enabled
      });

      expect(parsed.requiresLead).toBe(true);
    });

    it("rejects download asset with missing required fields", () => {
      expect(() =>
        UpsertDownloadSchema.parse({
          label: "",
          fileName: "file.pdf",
          fileUrl: "https://example.com/file.pdf",
        })
      ).toThrow();

      expect(() =>
        UpsertDownloadSchema.parse({
          label: "Brochure",
          fileName: "",
          fileUrl: "https://example.com/file.pdf",
        })
      ).toThrow();
    });
  });

  describe("CSV Formula Injection Neutralization", () => {
    it("neutralizes dangerous formula characters in content items CSV export", () => {
      const mockItem = {
        id: "ci_1",
        tenantId: "tenant_1",
        kind: "SERVICE",
        slug: "safe-service",
        title: "=SUM(1,2)", // Malicious spreadsheet formula
        titleBn: "+cmd|' /C calc'!A0", // DDE attack formula
        summary: "@SUM(A1:A10)",
        summaryBn: null,
        bodyHtml: null,
        bodyHtmlBn: null,
        mediaUrl: "-100", // Leading minus formula trigger
        data: null,
        sortOrder: 0,
        isPublished: true,
        createdAt: new Date("2026-10-16T12:00:00Z"),
        updatedAt: new Date("2026-10-16T12:00:00Z"),
      } as unknown as SiteContentItem;

      const csv = contentItemsCsv([mockItem]);

      // Every malicious cell must start with single quote "'" inside quotes
      expect(csv).toContain("\"'=SUM(1,2)\"");
      expect(csv).toContain("\"'+cmd|' /C calc'!A0\"");
      expect(csv).toContain("\"'@SUM(A1:A10)\"");
      expect(csv).toContain("\"'-100\"");
    });

    it("neutralizes dangerous formula characters in downloads CSV export", () => {
      const mockDownload = {
        id: "dl_1",
        tenantId: "tenant_1",
        label: "=cmd|' /C notepad'!A0",
        labelBn: null,
        kind: "FILE",
        fileName: "-dangerous-file.pdf",
        fileUrl: "https://example.com/test.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
        isPublic: false,
        downloadCount: 42,
        sortOrder: 0,
        createdAt: new Date("2026-10-16T12:00:00Z"),
        updatedAt: new Date("2026-10-16T12:00:00Z"),
      } as unknown as SiteDownload;

      const csv = downloadsCsv([mockDownload]);

      expect(csv).toContain("\"'=cmd|' /C notepad'!A0\"");
      expect(csv).toContain("\"'-dangerous-file.pdf\"");
      expect(csv).toContain("\"Gated (Lead Required)\"");
    });
  });

  describe("Gated Downloads & loadPageData Builder Integration", () => {
    it("transforms requiresLead=true into isPublic=false (Lead Magnet mode)", () => {
      const parsed = UpsertDownloadSchema.parse({
        label: "Clinical Whitepaper",
        fileName: "whitepaper.pdf",
        fileUrl: "https://example.com/wp.pdf",
        requiresLead: true,
      });

      expect(parsed.isPublic).toBe(false);
    });

    it("transforms requiresLead=false into isPublic=true (Direct 1-Click)", () => {
      const parsed = UpsertDownloadSchema.parse({
        label: "Restaurant Menu PDF",
        fileName: "menu.pdf",
        fileUrl: "https://example.com/menu.pdf",
        requiresLead: false,
      });

      expect(parsed.isPublic).toBe(true);
    });

    it("populates downloads field in loadPageData when download-card section is present", async () => {
      const mockPage: PageJson = {
        version: 1,
        sections: [
          {
            id: "sec_download",
            type: "download-card",
            settings: {
              title: "Download CV",
              fileUrl: "https://example.com/cv.pdf",
            },
          },
        ],
      };

      const pageData = await loadPageData("tenant_mock", mockPage);

      expect(pageData).toBeDefined();
      expect(pageData.downloads).toBeDefined();
      expect(Array.isArray(pageData.downloads)).toBe(true);
    });

    it("leaves downloads undefined when no download-card section is present", async () => {
      const mockPage: PageJson = {
        version: 1,
        sections: [
          {
            id: "sec_hero",
            type: "hero",
            settings: {
              title: "Welcome to our store",
            },
          },
        ],
      };

      const pageData = await loadPageData("tenant_mock", mockPage);

      expect(pageData).toBeDefined();
      expect(pageData.downloads).toBeUndefined();
    });
  });
});

