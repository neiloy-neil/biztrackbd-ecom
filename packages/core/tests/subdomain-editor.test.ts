import { describe, expect, it, vi, beforeEach } from "vitest";
import { checkSubdomainAvailabilityForTenant, changeTenantSubdomain, getTenantSubdomainState } from "../src/domains/service";
import { decideRoute } from "../src/routing/decide";

// Mock @biztrackbd/db
let mockTenant: any = {
  id: "tenant-100",
  subdomain: "novoblink",
  name: "NovoBlink",
  subdomainChangedAt: null,
  previousSubdomain: null,
  previousSubdomainExpiresAt: null,
};
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
          mockTenant = { ...mockTenant, ...args.data };
          return mockTenant;
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
    mockTenant = {
      id: "tenant-100",
      subdomain: "novoblink",
      name: "NovoBlink",
      subdomainChangedAt: null,
      previousSubdomain: null,
      previousSubdomainExpiresAt: null,
    };
  });

  it("recognizes the store's own current subdomain as valid and current", async () => {
    const res = await checkSubdomainAvailabilityForTenant("tenant-100", "novoblink");
    expect(res).toEqual({
      ok: true,
      isCurrent: true,
      label: "novoblink",
      message: "This is your store's current subdomain.",
      cooldown: undefined,
      previousRedirect: null,
    });
  });

  it("recognizes the store's current subdomain case-insensitively with trimming", async () => {
    const res = await checkSubdomainAvailabilityForTenant("tenant-100", "  NovoBlink  ");
    expect(res).toEqual({
      ok: true,
      isCurrent: true,
      label: "novoblink",
      message: "This is your store's current subdomain.",
      cooldown: undefined,
      previousRedirect: null,
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
      cooldown: undefined,
      previousRedirect: null,
    });
  });

  it("reports active cooldown and previous redirect when store changed address recently", async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const futureExpires = new Date(Date.now() + 27 * 24 * 60 * 60 * 1000);
    mockTenant.subdomainChangedAt = threeDaysAgo;
    mockTenant.previousSubdomain = "old-novoblink";
    mockTenant.previousSubdomainExpiresAt = futureExpires;

    const res = await checkSubdomainAvailabilityForTenant("tenant-100", "fresh-candidate");
    expect(res.cooldown?.inCooldown).toBe(true);
    expect(res.cooldown?.daysLeft).toBe(11);
    expect(res.previousRedirect?.subdomain).toBe("old-novoblink");
  });
});

describe("changeTenantSubdomain", () => {
  const actor = { userId: "user-1", email: "owner@test.com", role: "STORE_OWNER" as const };

  beforeEach(() => {
    takenResult = false;
    updatedData = null;
    mockTenant = {
      id: "tenant-100",
      subdomain: "novoblink",
      name: "NovoBlink",
      subdomainChangedAt: null,
      previousSubdomain: null,
      previousSubdomainExpiresAt: null,
    };
  });

  it("updates tenant subdomain and configures 30-day transitional forwarding", async () => {
    const res = await changeTenantSubdomain("tenant-100", actor, "novo-official");
    expect(res.oldSubdomain).toBe("novoblink");
    expect(res.newSubdomain).toBe("novo-official");
    expect(res.redirectExpiresAt).toBeInstanceOf(Date);

    expect(updatedData.subdomain).toBe("novo-official");
    expect(updatedData.previousSubdomain).toBe("novoblink");
    expect(updatedData.subdomainChangedAt).toBeInstanceOf(Date);
    expect(updatedData.previousSubdomainExpiresAt).toBeInstanceOf(Date);

    // Verify redirect window is approximately 30 days
    const daysForwarding = Math.round((updatedData.previousSubdomainExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    expect(daysForwarding).toBe(30);
  });

  it("returns cleanly without redundant update if candidate is already current", async () => {
    const res = await changeTenantSubdomain("tenant-100", actor, "novoblink");
    expect(res.oldSubdomain).toBe("novoblink");
    expect(res.newSubdomain).toBe("novoblink");
    expect(updatedData).toBeNull();
  });

  it("enforces 14-day cooldown and rejects changes within 14 days", async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    mockTenant.subdomainChangedAt = twoDaysAgo;

    await expect(changeTenantSubdomain("tenant-100", actor, "too-soon")).rejects.toThrow(
      /changed recently.*12 days/i,
    );
  });

  it("throws validation error if candidate is taken", async () => {
    takenResult = true;
    await expect(changeTenantSubdomain("tenant-100", actor, "taken-shop")).rejects.toThrow(
      /already taken/i,
    );
  });
});

describe("decideRoute - Legacy 301 Subdomain Redirection", () => {
  it("issues HTTP 301 permanent redirect preserving deep-link path and query parameters", () => {
    const decision = decideRoute({
      host: "old-novoblink.biztrack.bd",
      path: "/products/stylish-jacket",
      search: "?color=blue&size=L",
      rootDomain: "biztrack.bd",
      protocol: "https",
      entry: {
        tenantId: "tenant-100",
        subdomain: "new-novoblink",
        themeId: "kapor",
        locale: "bn-BD",
        status: "ACTIVE",
        matched: "previous_subdomain",
        primaryDomain: null,
        redirectWww: true,
      },
    });

    expect(decision).toEqual({
      action: "redirect",
      status: 301,
      location: "https://new-novoblink.biztrack.bd/products/stylish-jacket?color=blue&size=L",
    });
  });

  it("redirects legacy subdomain to primary custom domain when configured", () => {
    const decision = decideRoute({
      host: "old-novoblink.biztrack.bd",
      path: "/cart",
      search: "",
      rootDomain: "biztrack.bd",
      protocol: "https",
      entry: {
        tenantId: "tenant-100",
        subdomain: "new-novoblink",
        themeId: "kapor",
        locale: "bn-BD",
        status: "ACTIVE",
        matched: "previous_subdomain",
        primaryDomain: "www.novoblink.shop",
        redirectWww: true,
      },
    });

    expect(decision).toEqual({
      action: "redirect",
      status: 301,
      location: "https://www.novoblink.shop/cart",
    });
  });
});
