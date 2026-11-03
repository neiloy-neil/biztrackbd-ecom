import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEffectivePlan, orderState } from "../src/limits/plan";
import { FALLBACK_PORTFOLIO_PLANS } from "../src/platform/billing";
import { PORTFOLIO_PLAN_DEFS } from "../src/platform/portfolio-plans";
import { resolveTenantCapabilities } from "../src/site/capabilities";
import { upsertDownload } from "../src/site/downloads";
import { upsertContentItem } from "../src/site/content-items";
import { PlanLimitError } from "../src/errors";

const tenant = { planTier: "STARTER", siteMode: "PORTFOLIO", timezone: "Asia/Dhaka" };
const state = { downloads: 0, contentItems: 0 };

const mockTx = {
  tenant: { findFirstOrThrow: vi.fn(async () => tenant) },
  tenantQuotaAdjustment: { findMany: vi.fn(async () => []) },
  plan: { findUnique: vi.fn(async () => ({ limits: { products: 300, ordersPerMonth: 500, staff: 2, storageGb: 5, landingPages: 3, customPages: 7 } })) },
  siteDownload: { count: vi.fn(async () => state.downloads), create: vi.fn(async () => ({ id: "d1" })), findFirst: vi.fn(), update: vi.fn() },
  siteContentItem: { findUnique: vi.fn(async () => null), count: vi.fn(async () => state.contentItems), create: vi.fn(async () => ({ id: "c1" })), findFirst: vi.fn(), update: vi.fn() },
};

vi.mock("@biztrackbd/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@biztrackbd/db")>();
  return { ...actual, withTenant: vi.fn(async (_id: string, fn: (tx: unknown) => unknown) => fn(mockTx)) };
});

const download = { label: "Brochure", kind: "BROCHURE", fileUrl: "https://cdn.example.com/b.pdf", fileName: "b.pdf" } as never;
const item = { kind: "SERVICE", slug: "web-design", title: "Web design" } as never;

beforeEach(() => {
  tenant.planTier = "STARTER";
  tenant.siteMode = "PORTFOLIO";
  state.downloads = 0;
  state.contentItems = 0;
});

describe("portfolio plan definitions", () => {
  it("the public plan list is built from the same numbers the checks use", () => {
    for (const def of PORTFOLIO_PLAN_DEFS) {
      const view = FALLBACK_PORTFOLIO_PLANS.find((p) => p.tier === def.tier)!;
      expect(view.limits.products).toBe(def.limits.products);
      expect(view.limits.staff).toBe(def.limits.staff);
      expect(view.limits.landingPages).toBe(def.limits.landingPages);
      expect(view.features.downloadsLimit).toBe(def.limits.downloads ?? "unlimited");
      expect(view.features.bookingRequests).toBe(def.features.bookingRequests);
    }
  });
});

describe("getEffectivePlan", () => {
  it("a Business-website store follows the Business plan, not the shop plan of the same tier", async () => {
    const p = await getEffectivePlan(mockTx as never);
    expect(p).toMatchObject({ products: 10, staff: 1, landingPages: 5, customPages: 5, downloads: 5, contentItems: 15 });
  });

  it("Plus is generous but not unbounded on products", async () => {
    tenant.planTier = "BUSINESS";
    const p = await getEffectivePlan(mockTx as never);
    expect(p).toMatchObject({ products: 200, ordersPerMonth: 1000, staff: 10, downloads: null, contentItems: null, customPages: null });
  });

  it("an online shop still reads the Plan table", async () => {
    tenant.siteMode = "ECOMMERCE";
    const p = await getEffectivePlan(mockTx as never);
    expect(p).toMatchObject({ products: 300, staff: 2, landingPages: 3, customPages: 7, downloads: null, contentItems: null });
  });

  it("an order limit of zero means the plan has no orders to count", () => {
    expect(orderState(40, 0)).toBe("unlimited");
    expect(orderState(40, 100)).toBe("ok");
  });
});

describe("downloads and content items", () => {
  it("Starter stops at 5 downloads and 15 content items", async () => {
    state.downloads = 5;
    await expect(upsertDownload("t1", download)).rejects.toBeInstanceOf(PlanLimitError);
    state.contentItems = 15;
    await expect(upsertContentItem("t1", item)).rejects.toBeInstanceOf(PlanLimitError);
  });

  it("Starter can still add up to the limit", async () => {
    state.downloads = 4;
    await expect(upsertDownload("t1", download)).resolves.toBeDefined();
    state.contentItems = 14;
    await expect(upsertContentItem("t1", item)).resolves.toBeDefined();
  });

  it("Pro has no cap", async () => {
    tenant.planTier = "PRO";
    state.downloads = 500;
    state.contentItems = 500;
    await expect(upsertDownload("t1", download)).resolves.toBeDefined();
    await expect(upsertContentItem("t1", item)).resolves.toBeDefined();
  });
});

describe("plan-gated capabilities", () => {
  const restaurant = { siteMode: "PORTFOLIO", vertical: "RESTAURANT" };

  it("booking requests and team profiles come with Pro, not Starter", () => {
    expect(resolveTenantCapabilities({ ...restaurant, planTier: "STARTER" })).toMatchObject({ booking_requests: false, team_profiles: false });
    expect(resolveTenantCapabilities({ ...restaurant, planTier: "PRO" })).toMatchObject({ booking_requests: true, team_profiles: true });
  });

  it("without a plan nothing is held back", () => {
    expect(resolveTenantCapabilities(restaurant)).toMatchObject({ booking_requests: true, team_profiles: true });
  });
});
