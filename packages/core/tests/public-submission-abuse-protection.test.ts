import { beforeEach, describe, expect, it } from "vitest";
import {
  validateLeadMetadata,
  checkPublicSubmissionRateLimit,
  recordPublicSubmission,
  getCachedIdempotentResult,
  setCachedIdempotentResult,
  _clearAbuseProtectionState,
  MAX_SUBMISSIONS_PER_IP_PER_HOUR,
  MAX_SUBMISSIONS_PER_PHONE_PER_HOUR,
} from "../src/site/abuse-protection";
import { PublicSubmissionRateLimitError, ValidationError } from "../src/errors";
import { normalizeBdPhone } from "../src/phone";

describe("Public Submission Abuse Protection & Anti-Spam Suite (Phase 1)", () => {
  beforeEach(() => {
    _clearAbuseProtectionState();
  });

  describe("Metadata Strict Allow-List Validation", () => {
    it("accepts valid typed metadata fields", () => {
      const valid = {
        serviceId: "srv_consulting_01",
        serviceTitle: "Advanced Cataract Surgery",
        providerName: "Prof. Dr. Tariqul Islam",
        preferredTime: "Evening Chamber (6 PM - 9 PM)",
        companySize: "10-50",
        budgetRangeBdt: "৳ 25,000 - ৳ 50,000",
        dietaryRequirements: "Halal, no nuts",
        partySize: 4,
        notes: "Window side table preferred.",
        consentTextVersion: "v2026.1",
      };

      const result = validateLeadMetadata(valid);
      expect(result).toBeDefined();
      expect(result?.serviceId).toBe("srv_consulting_01");
      expect(result?.serviceTitle).toBe("Advanced Cataract Surgery");
      expect(result?.partySize).toBe(4);
      expect(result?.consentTextVersion).toBe("v2026.1");
    });

    it("strips arbitrary hacker payload fields and keeps only allowed properties", () => {
      const polluted = {
        serviceTitle: "Digital Smile Makeover",
        companySize: "1-10",
        hackerExploitPayload: "<script>alert(1)</script>",
        internalAdminPasswordReset: true,
        nestedSqlQuery: "DROP TABLE users;",
      };

      const result = validateLeadMetadata(polluted);
      expect(result).toBeDefined();
      expect(result?.serviceTitle).toBe("Digital Smile Makeover");
      expect(result?.companySize).toBe("1-10");
      expect((result as any)?.hackerExploitPayload).toBeUndefined();
      expect((result as any)?.internalAdminPasswordReset).toBeUndefined();
      expect((result as any)?.nestedSqlQuery).toBeUndefined();
    });

    it("returns null for non-object or nullish metadata", () => {
      expect(validateLeadMetadata(null)).toBeNull();
      expect(validateLeadMetadata(undefined)).toBeNull();
      expect(validateLeadMetadata("string-instead-of-object")).toBeNull();
      expect(validateLeadMetadata(12345)).toBeNull();
    });
  });

  describe("Bangladeshi Phone Normalization & Validation", () => {
    it("normalizes standard 11-digit numbers", () => {
      expect(normalizeBdPhone("01712345678")).toBe("01712345678");
    });

    it("normalizes international and local prefix formats", () => {
      expect(normalizeBdPhone("+8801712345678")).toBe("01712345678");
      expect(normalizeBdPhone("8801812345678")).toBe("01812345678");
      expect(normalizeBdPhone("1912345678")).toBe("01912345678");
    });

    it("handles Bengali digits and formatting characters", () => {
      expect(normalizeBdPhone("০১৭১২-৩৪৫৬৭৮")).toBe("01712345678");
      expect(normalizeBdPhone("+৮৮০১৭১২ ৩৪৫ ৬৭৮")).toBe("01712345678");
    });

    it("throws ValidationError on invalid numbers", () => {
      expect(() => normalizeBdPhone("01212345678")).toThrow(ValidationError);
      expect(() => normalizeBdPhone("12345")).toThrow(ValidationError);
      expect(() => normalizeBdPhone("017123456789999")).toThrow(ValidationError);
    });
  });

  describe("Sliding Window Rate Limiting", () => {
    const tenantId = "tenant_test_store";
    const testIp = "103.145.118.22"; // Bangladeshi ISP IP
    const testPhone = "01711223344";

    it("allows submissions up to the IP limit and blocks the 6th within 1 hour", () => {
      const now = Date.now();

      // Submit 5 times (limit)
      for (let i = 0; i < MAX_SUBMISSIONS_PER_IP_PER_HOUR; i++) {
        expect(() => {
          checkPublicSubmissionRateLimit({ tenantId, ip: testIp, now });
          recordPublicSubmission({ tenantId, ip: testIp, now });
        }).not.toThrow();
      }

      // 6th submission must trigger 429 rate limit
      expect(() => {
        checkPublicSubmissionRateLimit({ tenantId, ip: testIp, now });
      }).toThrow(PublicSubmissionRateLimitError);
    });

    it("allows submissions up to the phone limit and blocks the 4th within 1 hour", () => {
      const now = Date.now();

      // Submit 3 times (limit)
      for (let i = 0; i < MAX_SUBMISSIONS_PER_PHONE_PER_HOUR; i++) {
        expect(() => {
          checkPublicSubmissionRateLimit({ tenantId, phone: testPhone, now });
          recordPublicSubmission({ tenantId, phone: testPhone, now });
        }).not.toThrow();
      }

      // 4th submission from same phone number must trigger rate limit
      expect(() => {
        checkPublicSubmissionRateLimit({ tenantId, phone: testPhone, now });
      }).toThrow(PublicSubmissionRateLimitError);
    });

    it("clears rate limit after sliding window expires (1 hour)", () => {
      const now = Date.now();

      // Fill quota
      for (let i = 0; i < MAX_SUBMISSIONS_PER_PHONE_PER_HOUR; i++) {
        recordPublicSubmission({ tenantId, phone: testPhone, now });
      }

      // Blocked at current time
      expect(() => {
        checkPublicSubmissionRateLimit({ tenantId, phone: testPhone, now });
      }).toThrow(PublicSubmissionRateLimitError);

      // Fast-forward 61 minutes
      const later = now + 61 * 60 * 1000;
      expect(() => {
        checkPublicSubmissionRateLimit({ tenantId, phone: testPhone, now: later });
      }).not.toThrow();
    });
  });

  describe("Idempotency Key Deduplication", () => {
    const tenantId = "tenant_test_store";
    const idempotencyKey = "idemp_test_uuid_9482";
    const mockResult = {
      id: "lead_9482",
      type: "CONTACT",
      status: "NEW",
      whatsAppFollowUpUrl: "https://wa.me/8801712345678",
    };

    it("caches and retrieves results for identical idempotency keys", () => {
      expect(getCachedIdempotentResult(tenantId, idempotencyKey)).toBeNull();

      setCachedIdempotentResult(tenantId, idempotencyKey, mockResult);

      const cached = getCachedIdempotentResult<typeof mockResult>(tenantId, idempotencyKey);
      expect(cached).toBeDefined();
      expect(cached?.id).toBe("lead_9482");
      expect(cached?.status).toBe("NEW");
    });

    it("isolates idempotency keys across different tenants", () => {
      setCachedIdempotentResult("tenant_A", idempotencyKey, { id: "lead_A" });
      setCachedIdempotentResult("tenant_B", idempotencyKey, { id: "lead_B" });

      expect(getCachedIdempotentResult<{ id: string }>("tenant_A", idempotencyKey)?.id).toBe("lead_A");
      expect(getCachedIdempotentResult<{ id: string }>("tenant_B", idempotencyKey)?.id).toBe("lead_B");
      expect(getCachedIdempotentResult("tenant_C", idempotencyKey)).toBeNull();
    });
  });
});
