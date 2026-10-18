import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listPublicPlansForSiteMode,
  listPublicPortfolioPlans,
  listPublicPlans,
  FALLBACK_PORTFOLIO_PLANS,
} from "../src/platform/billing";
import { executeModeTransition } from "../src/site/mode";

const mockTenantRecord = {
  id: "tenant-plan-test",
  name: "Al-Barakah Organics",
  siteMode: "ECOMMERCE",
  businessVertical: null,
  planTier: "STARTER",
};

const mockTx = {
  tenant: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    create: vi.fn().mockResolvedValue({ id: "audit_1" }),
  },
};

vi.mock("@biztrackbd/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@biztrackbd/db")>();
  return {
    ...actual,
    getBasePrisma: vi.fn().mockReturnValue({
      plan: {
        findMany: vi.fn().mockRejectedValue(new Error("DB offline")),
      },
    }),
    withTenant: vi.fn().mockImplementation(async (_tenantId, fn) => fn(mockTx)),
  };
});

vi.mock("../src/audit/service", () => ({
  audit: vi.fn().mockResolvedValue({ id: "audit_1" }),
}));

vi.mock("../src/routing/edge-config", () => ({
  syncTenantRouting: vi.fn().mockResolvedValue(undefined),
}));

describe("Billing & Subscription Plans Mode Alignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listPublicPlansForSiteMode", () => {
    it("returns business & dining portfolio plans for PORTFOLIO site mode", async () => {
      const plans = await listPublicPlansForSiteMode("PORTFOLIO");
      expect(plans).toHaveLength(3);

      const starter = plans.find((p) => p.tier === "STARTER");
      expect(starter).toBeDefined();
      expect(starter?.name).toBe("Business Starter");
      expect(starter?.priceMonthly).toBe(399);
      expect(starter?.priceYearly).toBe(3990);
      expect(starter?.yearlyMonthsFree).toBe(2);
      expect(starter?.features.hybridStore).toBe(false);

      const pro = plans.find((p) => p.tier === "PRO");
      expect(pro).toBeDefined();
      expect(pro?.name).toBe("Business");
      expect(pro?.priceMonthly).toBe(799);
      expect(pro?.priceYearly).toBe(7990);
      expect(pro?.yearlyMonthsFree).toBe(2);
      expect(pro?.features.hybridStore).toBe(true);

      const business = plans.find((p) => p.tier === "BUSINESS");
      expect(business).toBeDefined();
      expect(business?.name).toBe("Business Plus");
      expect(business?.priceMonthly).toBe(1499);
      expect(business?.priceYearly).toBe(14990);
      expect(business?.yearlyMonthsFree).toBe(2);
      expect(business?.features.hybridStore).toBe(true);
    });

    it("returns online store commerce plans for ECOMMERCE site mode", async () => {
      const plans = await listPublicPlansForSiteMode("ECOMMERCE");
      expect(plans).toHaveLength(3);

      const starter = plans.find((p) => p.tier === "STARTER");
      expect(starter?.priceMonthly).toBe(699);
      expect(starter?.priceYearly).toBe(6990);
      expect(starter?.yearlyMonthsFree).toBe(2);

      const pro = plans.find((p) => p.tier === "PRO");
      expect(pro?.priceMonthly).toBe(1499);
      expect(pro?.priceYearly).toBe(14990);
      expect(pro?.yearlyMonthsFree).toBe(2);

      const business = plans.find((p) => p.tier === "BUSINESS");
      expect(business?.priceMonthly).toBe(3499);
      expect(business?.priceYearly).toBe(34990);
      expect(business?.yearlyMonthsFree).toBe(2);
    });

    it("defaults to online store commerce plans for null or HYBRID site mode", async () => {
      const nullPlans = await listPublicPlansForSiteMode(null);
      expect(nullPlans[0]?.priceMonthly).toBe(699);

      const hybridPlans = await listPublicPlansForSiteMode("HYBRID");
      expect(hybridPlans[0]?.priceMonthly).toBe(699);
    });
  });

  describe("Hybrid Gating in executeModeTransition", () => {
    const actor = { userId: "usr-owner-1", email: "owner@albarakah.com" };

    it("blocks transition to HYBRID when tenant is on STARTER tier", async () => {
      mockTx.tenant.findUnique.mockResolvedValueOnce({
        ...mockTenantRecord,
        siteMode: "PORTFOLIO",
        planTier: "STARTER",
      });

      await expect(
        executeModeTransition("tenant-plan-test", actor, {
          targetMode: "HYBRID",
          reason: "Upgrading to dual engine website and store",
          confirmedConsent: true,
        })
      ).rejects.toThrow(/Hybrid dual-engine mode requires at least the PRO plan tier/i);

      expect(mockTx.tenant.update).not.toHaveBeenCalled();
    });

    it("allows transition to HYBRID when tenant is on PRO tier", async () => {
      mockTx.tenant.findUnique.mockResolvedValueOnce({
        ...mockTenantRecord,
        siteMode: "PORTFOLIO",
        planTier: "PRO",
      });
      mockTx.tenant.update.mockResolvedValueOnce({
        ...mockTenantRecord,
        siteMode: "HYBRID",
        planTier: "PRO",
      });

      const res = await executeModeTransition("tenant-plan-test", actor, {
        targetMode: "HYBRID",
        reason: "Adding store engine to business website",
        confirmedConsent: true,
      });

      expect(res.success).toBe(true);
      expect(res.newMode).toBe("HYBRID");
      expect(mockTx.tenant.update).toHaveBeenCalledWith({
        where: { id: "tenant-plan-test" },
        data: {
          siteMode: "HYBRID",
          businessVertical: null,
        },
      });
    });

    it("allows transition to HYBRID when tenant is on BUSINESS tier", async () => {
      mockTx.tenant.findUnique.mockResolvedValueOnce({
        ...mockTenantRecord,
        siteMode: "ECOMMERCE",
        planTier: "BUSINESS",
      });
      mockTx.tenant.update.mockResolvedValueOnce({
        ...mockTenantRecord,
        siteMode: "HYBRID",
        planTier: "BUSINESS",
      });

      const res = await executeModeTransition("tenant-plan-test", actor, {
        targetMode: "HYBRID",
        targetVertical: "RESTAURANT",
        reason: "Adding dining website to ecommerce store",
        confirmedConsent: true,
      });

      expect(res.success).toBe(true);
      expect(res.newMode).toBe("HYBRID");
      expect(res.newVertical).toBe("RESTAURANT");
    });

    it("allows transition between single-engine modes even on STARTER tier", async () => {
      mockTx.tenant.findUnique.mockResolvedValueOnce({
        ...mockTenantRecord,
        siteMode: "ECOMMERCE",
        planTier: "STARTER",
      });
      mockTx.tenant.update.mockResolvedValueOnce({
        ...mockTenantRecord,
        siteMode: "PORTFOLIO",
        businessVertical: "DOCTOR_CLINIC",
        planTier: "STARTER",
      });

      const res = await executeModeTransition("tenant-plan-test", actor, {
        targetMode: "PORTFOLIO",
        targetVertical: "DOCTOR_CLINIC",
        reason: "Switching from shop to doctor clinic website",
        confirmedConsent: true,
      });

      expect(res.success).toBe(true);
      expect(res.newMode).toBe("PORTFOLIO");
      expect(res.newVertical).toBe("DOCTOR_CLINIC");
    });
  });
});
