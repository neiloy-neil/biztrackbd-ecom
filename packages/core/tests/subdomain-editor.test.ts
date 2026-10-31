import { describe, expect, it, vi, beforeEach } from "vitest";
import { checkSubdomainAvailabilityForTenant, changeTenantSubdomain } from "../src/domains/service";

// Mock @biztrackbd/db
const mockTenant = { id: "tenant-100", subdomain: "novoblink", name: "NovoBlink" };
let takenResult = false;
let updatedData: any = null;

vi.mock("@biztrackbd/db", () => ({
  getBasePrisma: () => ({
    $queryRaw: vi.fn(async () => [{ taken: takenResult }]),
  }),
  withTenant: vi.fn(async (_tenantId: string, fn: any) => {
    const tx = {
      $queryRaw: vi.fn(),
      tenant: {
        findUnique: vi.fn(async () => mockTenant),
        update: vi.fn(async (args: any) => {
          updatedData = args.data;
          return { ...mockTenant, ...args.data };
        }),
      },
    };
    return fn(tx);
  }),
  Prisma: {},
}));

vi.mock("../src/audit/service", () => ({
  audit: vi.fn(async () => undefined),
}));

vi.mock("../src/demo/guard", () => ({
  assertNotInDemo: vi.fn(),
}));

vi.mock("../src/events", () => ({
  publishEvent: vi.fn(),
}));

vi.mock("../src/routing/edge-config", () => ({
  syncTenantRouting: vi.fn(async () => ({ skipped: true, items: 0 })),
}));

describe("checkSubdomainAvailabilityForTenant", () => {
  beforeEach(() => {
    takenResult = false;
    updatedData = null;
  });

  it("recognizes the store's own current subdomain as valid and current", async () => {
    const res = await checkSubdomainAvailabilityForTenant("tenant-100", "novoblink");
    expect(res).toEqual({
      ok: true,
      isCurrent: true,
      label: "novoblink",
      message: "This is your store's current subdomain.",
    });
  });

  it("recognizes the store's current subdomain case-insensitively with trimming", async () => {
    const res = await checkSubdomainAvailabilityForTenant("tenant-100", "  NovoBlink  ");
    expect(res).toEqual({
      ok: true,
      isCurrent: true,
      label: "novoblink",
      message: "This is your store's current subdomain.",
    });
  });

  it("rejects invalid subdomains (too short)", async () => {
    const res = await checkSubdomainAvailabilityForTenant("tenant-100", "nb");
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("too_short");
  });

  it("rejects reserved subdomains", async () => {
    const res = await checkSubdomainAvailabilityForTenant("tenant-100", "admin");
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("reserved");
  });

  it("rejects invalid characters (spaces, special symbols)", async () => {
    const res = await checkSubdomainAvailabilityForTenant("tenant-100", "novo blink");
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("invalid");
  });

  it("reports when candidate is taken by another store", async () => {
    takenResult = true;
    const res = await checkSubdomainAvailabilityForTenant("tenant-100", "popular-shop");
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("taken");
  });

  it("reports available when candidate is fresh and untaken", async () => {
    takenResult = false;
    const res = await checkSubdomainAvailabilityForTenant("tenant-100", "brand-new-store");
    expect(res).toEqual({
      ok: true,
      isCurrent: false,
      label: "brand-new-store",
      message: "✓ brand-new-store is available!",
    });
  });
});

describe("changeTenantSubdomain", () => {
  const actor = { userId: "user-1", email: "owner@test.com", role: "STORE_OWNER" as const };

  beforeEach(() => {
    takenResult = false;
    updatedData = null;
  });

  it("updates tenant subdomain when valid and available", async () => {
    const res = await changeTenantSubdomain("tenant-100", actor, "novo-official");
    expect(res).toEqual({
      oldSubdomain: "novoblink",
      newSubdomain: "novo-official",
    });
    expect(updatedData).toEqual({ subdomain: "novo-official" });
  });

  it("returns cleanly without redundant update if candidate is already current", async () => {
    const res = await changeTenantSubdomain("tenant-100", actor, "novoblink");
    expect(res).toEqual({
      oldSubdomain: "novoblink",
      newSubdomain: "novoblink",
    });
    expect(updatedData).toBeNull();
  });

  it("throws validation error if candidate is taken", async () => {
    takenResult = true;
    await expect(changeTenantSubdomain("tenant-100", actor, "taken-shop")).rejects.toThrow(
      /already taken/i,
    );
  });
});
