import { describe, it, expect, vi } from "vitest";
import {
  isSiteMode,
  isBusinessVertical,
  normalizeSiteMode,
  normalizeBusinessVertical,
  redactPhone,
  redactEmail,
  redactName,
  SITE_MODES,
  BUSINESS_VERTICALS,
} from "../src/site/mode";

describe("Mode & Vertical metadata and normalizers", () => {
  it("recognizes valid and invalid site modes", () => {
    expect(isSiteMode("ECOMMERCE")).toBe(true);
    expect(isSiteMode("PORTFOLIO")).toBe(true);
    expect(isSiteMode("HYBRID")).toBe(true);
    expect(isSiteMode("INVALID")).toBe(false);
    expect(isSiteMode(null)).toBe(false);
    expect(normalizeSiteMode("PORTFOLIO")).toBe("PORTFOLIO");
    expect(normalizeSiteMode("GARBAGE")).toBe("ECOMMERCE");
  });

  it("recognizes valid and invalid business verticals", () => {
    expect(isBusinessVertical("RESTAURANT")).toBe(true);
    expect(isBusinessVertical("DOCTOR_CLINIC")).toBe(true);
    expect(isBusinessVertical("PUBLIC_FIGURE")).toBe(true);
    expect(isBusinessVertical("BUSINESS_COMPANY")).toBe(true);
    expect(isBusinessVertical("SERVICE_PROVIDER")).toBe(true);
    expect(isBusinessVertical("PERSONAL_PORTFOLIO")).toBe(true);
    expect(isBusinessVertical("RETAIL_STORE")).toBe(false);
    expect(normalizeBusinessVertical("DOCTOR_CLINIC")).toBe("DOCTOR_CLINIC");
    expect(normalizeBusinessVertical("UNKNOWN")).toBe(null);
  });

  it("contains complete metadata definitions for modes and verticals", () => {
    expect(SITE_MODES.PORTFOLIO.labelEn).toContain("Business Website");
    expect(SITE_MODES.PORTFOLIO.labelBn).toContain("পোর্টফোলিও");
    expect(SITE_MODES.HYBRID.labelEn).toContain("Hybrid");
    expect(BUSINESS_VERTICALS.RESTAURANT.recommendedCapabilities).toContain("menu");
    expect(BUSINESS_VERTICALS.DOCTOR_CLINIC.recommendedCapabilities).toContain("booking_requests");
  });
});

describe("Privacy PII Redaction for Platform Operators", () => {
  it("masks phone numbers correctly", () => {
    expect(redactPhone("01711122233")).toBe("01711******");
    expect(redactPhone("+8801812345678")).toBe("+8801******");
    expect(redactPhone("123")).toBe("***");
    expect(redactPhone(null)).toBe("—");
    expect(redactPhone(undefined)).toBe("—");
  });

  it("masks email addresses correctly", () => {
    expect(redactEmail("user@example.com")).toBe("us***@example.com");
    expect(redactEmail("a@example.com")).toBe("a***@example.com");
    expect(redactEmail("invalid-email")).toBe("***@***");
    expect(redactEmail(null)).toBe("—");
    expect(redactEmail(undefined)).toBe("—");
  });

  it("masks customer names correctly", () => {
    expect(redactName("Rafiqul Islam")).toBe("Rafiqul I***");
    expect(redactName("Sumaiya")).toBe("Sum***");
    expect(redactName("Jo")).toBe("J***");
    expect(redactName(null)).toBe("Anonymous Visitor");
    expect(redactName("")).toBe("Anonymous Visitor");
  });
});

describe("Guarded Mode Transition Engine error states", () => {
  it("rejects execution without verified merchant consent", async () => {
    const { executeModeTransition } = await import("../src/site/mode");
    await expect(
      executeModeTransition(
        "test-tenant-id",
        { userId: "sa-1", email: "sa@biztrackbd.com" },
        {
          targetMode: "PORTFOLIO",
          targetVertical: "DOCTOR_CLINIC",
          reason: "Migrating clinic website",
          confirmedConsent: false,
        }
      )
    ).rejects.toThrow(/consent/i);
  });

  it("rejects execution with an empty or too short reason", async () => {
    const { executeModeTransition } = await import("../src/site/mode");
    await expect(
      executeModeTransition(
        "test-tenant-id",
        { userId: "sa-1", email: "sa@biztrackbd.com" },
        {
          targetMode: "PORTFOLIO",
          targetVertical: "DOCTOR_CLINIC",
          reason: " ",
          confirmedConsent: true,
        }
      )
    ).rejects.toThrow(/reason/i);
  });
});
