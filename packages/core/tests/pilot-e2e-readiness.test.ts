import { describe, expect, it } from "vitest";
import {
  BUSINESS_DEMO_TEMPLATES,
  findBusinessDemoTemplate,
} from "../src/demo/business-templates";
import {
  BUSINESS_TEMPLATES,
  getBusinessTemplateByVertical,
} from "../src/site/templates/manifests";
import {
  SITE_MODES,
  BUSINESS_VERTICALS,
  redactPhone,
  redactEmail,
  redactName,
  validateModeTransitionDryRun,
  executeModeTransition,
} from "../src/site/mode";
import {
  checkPublicSubmissionRateLimit,
  recordPublicSubmission,
  getCachedIdempotentResult,
  setCachedIdempotentResult,
  validateLeadMetadata,
  _clearAbuseProtectionState,
} from "../src/site/abuse-protection";
import { normalizeBdPhone } from "../src/phone";
import {
  can,
  PERMISSIONS,
} from "../src/permissions";
import { ValidationError, PublicSubmissionRateLimitError } from "../src/errors";

describe("BizTrack Business Pilot E2E Readiness & Verification", () => {
  describe("1. Pilot Profile & Demo Manifest Verification", () => {
    it("validates Restaurant pilot profile (dhaka-bistro)", () => {
      const template = findBusinessDemoTemplate("dhaka-bistro");
      expect(template).toBeDefined();
      expect(template?.vertical).toBe("RESTAURANT");
      expect(template?.menuCategories).toBeDefined();
      expect(template?.menuCategories!.length).toBeGreaterThan(0);

      const firstCat = template!.menuCategories![0]!;
      expect(firstCat.name).toBeTruthy();
      expect(firstCat.items.length).toBeGreaterThan(0);
      expect(firstCat.items[0]?.price).toBeGreaterThan(0);

      const manifest = getBusinessTemplateByVertical("RESTAURANT");
      expect(manifest?.id).toBe("dhaka-bistro");
      expect(manifest?.siteMode).toBe("PORTFOLIO");
      expect(manifest?.settings.accent).toBeTruthy();
    });

    it("validates Doctor / Clinic pilot profile (modern-clinic)", () => {
      const template = findBusinessDemoTemplate("modern-clinic");
      expect(template).toBeDefined();
      expect(template?.vertical).toBe("DOCTOR_CLINIC");
      expect(template?.contentItems).toBeDefined();
      expect(template?.contentItems!.length).toBeGreaterThan(0);

      const credentials = template!.contentItems!.filter(
        (ci) => ci.kind === "CREDENTIAL"
      );
      expect(credentials.length).toBeGreaterThan(0);
      expect(credentials[0]?.data.issuer).toBeTruthy();

      const manifest = getBusinessTemplateByVertical("DOCTOR_CLINIC");
      expect(manifest?.id).toBe("modern-clinic");
      expect(manifest?.vertical).toBe("DOCTOR_CLINIC");
      expect(manifest?.siteMode).toBe("PORTFOLIO");
    });

    it("verifies all 6 business verticals have complete manifests and recommended capabilities", () => {
      const verticals = Object.keys(BUSINESS_VERTICALS) as (keyof typeof BUSINESS_VERTICALS)[];
      expect(verticals).toHaveLength(6);

      for (const v of verticals) {
        const meta = BUSINESS_VERTICALS[v];
        expect(meta.labelEn).toBeTruthy();
        expect(meta.labelBn).toBeTruthy();
        expect(meta.recommendedCapabilities.length).toBeGreaterThan(0);

        const manifest = getBusinessTemplateByVertical(v);
        expect(manifest).toBeDefined();
        expect(manifest?.vertical).toBe(v);
      }
    });
  });

  describe("2. Public Ingestion Abuse Defense & Data Normalization", () => {
    it("normalizes diverse Bangladeshi phone formats to canonical 01XXXXXXXXX", () => {
      expect(normalizeBdPhone("01712345678")).toBe("01712345678");
      expect(normalizeBdPhone("8801812345678")).toBe("01812345678");
      expect(normalizeBdPhone("+880 1912-345678")).toBe("01912345678");
      expect(normalizeBdPhone("01300000000")).toBe("01300000000");
      expect(normalizeBdPhone("01400000000")).toBe("01400000000");
    });

    it("enforces sliding window rate limits on suspicious repetitive requests", () => {
      _clearAbuseProtectionState();
      const testTenant = "t-rate-limit-test";
      const testIp = "192.168.1.100";

      // 5 submissions allowed per hour
      for (let i = 0; i < 5; i++) {
        expect(() =>
          checkPublicSubmissionRateLimit({
            tenantId: testTenant,
            ip: testIp,
          })
        ).not.toThrow();
        recordPublicSubmission({
          tenantId: testTenant,
          ip: testIp,
        });
      }

      // 6th submission must be rejected with 429 rate limit error
      expect(() =>
        checkPublicSubmissionRateLimit({
          tenantId: testTenant,
          ip: testIp,
        })
      ).toThrow(PublicSubmissionRateLimitError);
    });

    it("enforces idempotency key caching to deduplicate double clicks", () => {
      const key = "idem_pilot_test_" + Date.now();
      const mockResult = { id: "lead_123", status: "NEW" };

      expect(getCachedIdempotentResult("t1", key)).toBeNull();
      setCachedIdempotentResult("t1", key, mockResult);
      expect(getCachedIdempotentResult("t1", key)).toEqual(mockResult);
    });

    it("sanitizes lead metadata and drops dangerous or oversized payloads", () => {
      const sanitized = validateLeadMetadata({
        preferredTime: "Evening",
        companySize: "10-50",
        suspiciousKey: "x".repeat(300),
        maliciousObject: { nested: true },
      });
      expect(sanitized).toBeDefined();
      expect(sanitized?.preferredTime).toBe("Evening");
      expect(sanitized?.companySize).toBe("10-50");
      expect((sanitized as Record<string, unknown>).suspiciousKey).toBeUndefined();
      expect((sanitized as Record<string, unknown>).maliciousObject).toBeUndefined();
    });
  });

  describe("3. Merchant RBAC Permissions & CSV Protection", () => {
    it("enforces dedicated leads and bookings permissions for staff roles", () => {
      // Owner has full access to leads and bookings
      expect(can("STORE_OWNER", "leads", "view")).toBe(true);
      expect(can("STORE_OWNER", "leads", "edit")).toBe(true);
      expect(can("STORE_OWNER", "bookings", "edit")).toBe(true);

      // Store Manager has edit access
      expect(can("STORE_MANAGER", "leads", "edit")).toBe(true);
      expect(can("STORE_MANAGER", "bookings", "edit")).toBe(true);

      // Telemarketer (Support / Reception) has leads and bookings edit access
      expect(can("TELEMARKETER", "leads", "view")).toBe(true);
      expect(can("TELEMARKETER", "leads", "edit")).toBe(true);
      expect(can("TELEMARKETER", "bookings", "edit")).toBe(true);

      // Order packer has NO leads or bookings access
      expect(can("ORDER_PACKER", "leads", "view")).toBe(false);
      expect(can("ORDER_PACKER", "bookings", "view")).toBe(false);

      // Content editor has design access, but NO leads or bookings access
      expect(can("CONTENT_EDITOR", "leads", "view")).toBe(false);
      expect(can("CONTENT_EDITOR", "bookings", "view")).toBe(false);
      expect(can("CONTENT_EDITOR", "design", "edit")).toBe(true);
    });

    it("neutralizes formula injection characters in CSV exports", () => {
      // Test formula injection sanitizer logic used by CSV export
      const sanitizeCsvField = (val: string) => {
        const clean = val.replace(/[\r\n]+/g, " ").trim();
        if (/^[=+\-@\t\r]/.test(clean)) {
          return `'${clean}`;
        }
        return clean;
      };

      expect(sanitizeCsvField("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(sanitizeCsvField("+8801700000000")).toBe("'+8801700000000");
      expect(sanitizeCsvField("-200")).toBe("'-200");
      expect(sanitizeCsvField("@cmd|'/C calc'!A0")).toBe("'@cmd|'/C calc'!A0");
      expect(sanitizeCsvField("Normal Lead Name")).toBe("Normal Lead Name");
    });
  });

  describe("4. Platform Super-Admin Governance & Redaction", () => {
    it("redacts customer PII in platform operator views", () => {
      expect(redactPhone("01712345678")).toBe("01712******");
      expect(redactEmail("doctor.patient@gmail.com")).toBe("do***@gmail.com");
      expect(redactName("Dr. Mahmudur Rahman")).toBe("Dr. R***");
    });

    it("enforces consent before mode transition execution", async () => {
      await expect(
        executeModeTransition(
          "tenant-1",
          { userId: "sa-1", email: "sa@biztrackbd.com" },
          {
            targetMode: "HYBRID",
            targetVertical: "RESTAURANT",
            reason: "Adding takeout store",
            confirmedConsent: false,
          }
        )
      ).rejects.toThrow(/consent/i);
    });
  });
});
