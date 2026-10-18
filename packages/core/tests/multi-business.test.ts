import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAdditionalBusiness,
  getMerchantBusinesses,
  getDevBusinesses,
  type BusinessAccountSummary,
} from "../src";

// Mock DB objects
const mockTenants: any[] = [];
const mockTenantUsers: any[] = [];
const mockStoreSettings: any[] = [];
const mockProducts: any[] = [];
const mockProductVariants: any[] = [];
const mockShippingZones: any[] = [];
const mockMenuCategories: any[] = [];
const mockMenuItems: any[] = [];

const mockPrisma = {
  tenant: {
    findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
      return mockTenants.find((t) => t.subdomain === where.subdomain || t.id === where.id) || null;
    }),
    findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
      if (where?.OR) {
        return mockTenants.find((t) => where.OR.some((cond: any) => cond.subdomain === t.subdomain || cond.id === t.id)) || null;
      }
      return mockTenants.find((t) => (where.subdomain ? t.subdomain === where.subdomain : true) && (where.id ? t.id === where.id : true)) || null;
    }),
    findMany: vi.fn().mockImplementation(async ({ where }: any) => {
      if (where?.id?.in) {
        return mockTenants.filter((t) => where.id.in.includes(t.id));
      }
      if (where?.ownerEmail) {
        const target = typeof where.ownerEmail === "string" ? where.ownerEmail : where.ownerEmail.equals;
        return mockTenants.filter((t) => t.ownerEmail?.toLowerCase() === target?.toLowerCase());
      }
      if (where?.OR) {
        return mockTenants.filter((t) => {
          return where.OR.some((cond: any) => {
            if (cond.id) return t.id === cond.id;
            if (cond.ownerEmail) {
              const target = typeof cond.ownerEmail === "string" ? cond.ownerEmail : cond.ownerEmail.equals;
              return t.ownerEmail?.toLowerCase() === target?.toLowerCase();
            }
            if (cond.users?.some?.email) {
              const target = cond.users.some.email.equals;
              return t.users?.some((u: any) => u.email?.toLowerCase() === target?.toLowerCase());
            }
            return false;
          });
        });
      }
      return mockTenants.filter((t) => t.status !== "CANCELLED");
    }),
    create: vi.fn().mockImplementation(async ({ data }: any) => {
      const row = { id: `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, ...data };
      mockTenants.push(row);
      return row;
    }),
  },
  tenantUser: {
    create: vi.fn().mockImplementation(async ({ data }: any) => {
      const row = { id: `tu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, ...data };
      mockTenantUsers.push(row);
      return row;
    }),
    findMany: vi.fn().mockImplementation(async ({ where }: any) => {
      return mockTenantUsers.filter((u) => u.tenantId === where?.tenantId);
    }),
  },
  $queryRaw: vi.fn().mockImplementation(async (strings: TemplateStringsArray, ...args: any[]) => {
    const text = Array.isArray(strings) ? strings.join(" ") : String(strings);
    if (text.includes("signup_create_tenant")) {
      const [id, name, sub, theme] = args;
      const row = { id, name, subdomain: sub, themeId: theme, status: "TRIAL" };
      mockTenants.push(row);
      return [{ id }];
    }
    // Mock staff_memberships SQL return
    return mockTenantUsers.map((u) => {
      const t = mockTenants.find((item) => item.id === u.tenantId);
      return {
        userId: u.id,
        tenantId: u.tenantId,
        subdomain: t?.subdomain || "test",
        storeName: t?.name || "Test Store",
        role: u.role || "STORE_OWNER",
        name: u.name || "Owner",
        isActive: u.isActive ?? true,
        tenantStatus: t?.status || "TRIAL",
      };
    });
  }),
};

vi.mock("@biztrackbd/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@biztrackbd/db")>();
  return {
    ...actual,
    getBasePrisma: () => mockPrisma,
    getPlatformPrisma: () => mockPrisma,
    withTenant: vi.fn().mockImplementation(async (tenantId: string, fn: any) => {
      const tx = {
        tenant: {
          update: vi.fn().mockImplementation(async ({ where, data }) => {
            const t = mockTenants.find((item) => item.id === where.id);
            if (t) Object.assign(t, data);
            return t;
          }),
        },
        tenantUser: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            const row = { id: `tu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, ...data };
            mockTenantUsers.push(row);
            return row;
          }),
        },
        storeSettings: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            mockStoreSettings.push({ ...data, tenantId });
            return data;
          }),
        },
        product: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            const p = { id: `prod_${Date.now()}`, ...data, tenantId };
            mockProducts.push(p);
            return p;
          }),
        },
        productVariant: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            const v = { id: `var_${Date.now()}`, ...data, tenantId };
            mockProductVariants.push(v);
            return v;
          }),
        },
        category: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            return { id: `cat_${Date.now()}`, ...data, tenantId };
          }),
        },
        shippingZone: {
          createMany: vi.fn().mockImplementation(async ({ data }) => {
            mockShippingZones.push(...data);
            return { count: data.length };
          }),
        },
        menuCategory: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            const mc = { id: `mc_${Date.now()}`, ...data, tenantId };
            mockMenuCategories.push(mc);
            return mc;
          }),
        },
        menuItem: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            const mi = { id: `mi_${Date.now()}`, ...data, tenantId };
            mockMenuItems.push(mi);
            return mi;
          }),
        },
      };
      return fn(tx);
    }),
  };
});

describe("Multi-Business Provisioning & Switcher Suite", () => {
  beforeEach(() => {
    mockTenants.length = 0;
    mockTenantUsers.length = 0;
    mockStoreSettings.length = 0;
    mockProducts.length = 0;
    mockProductVariants.length = 0;
    mockShippingZones.length = 0;
    mockMenuCategories.length = 0;
    mockMenuItems.length = 0;
  });

  it("rejects invalid or too-short subdomains", async () => {
    await expect(
      createAdditionalBusiness({
        name: "My Bistro",
        subdomain: "ab",
        siteMode: "PORTFOLIO",
        businessVertical: "RESTAURANT",
        ownerUserId: "user_123",
        ownerEmail: "owner@example.com",
      })
    ).rejects.toThrow(/Subdomain must be at least 3 characters/);

    await expect(
      createAdditionalBusiness({
        name: "My Bistro",
        subdomain: "admin", // reserved subdomain
        siteMode: "PORTFOLIO",
        businessVertical: "RESTAURANT",
        ownerUserId: "user_123",
        ownerEmail: "owner@example.com",
      })
    ).rejects.toThrow(/reserved/i);
  });

  it("provisions a Restaurant business with digital dining menu anchor and starter dish", async () => {
    const res = await createAdditionalBusiness({
      name: "Gulshan Bistro",
      subdomain: "gulshanbistro",
      siteMode: "PORTFOLIO",
      businessVertical: "RESTAURANT",
      ownerUserId: "user_owner_1",
      ownerEmail: "chef@bistro.example",
      ownerName: "Chef Kabir",
    });

    expect(res).toBeDefined();
    expect(res.name).toBe("Gulshan Bistro");
    expect(res.subdomain).toBe("gulshanbistro");
    expect(res.siteMode).toBe("PORTFOLIO");
    expect(res.businessVertical).toBe("RESTAURANT");

    // Verify tenant and user created
    expect(mockTenants).toHaveLength(1);
    expect(mockTenants[0].themeId).toBe("dhakabistro");
    expect(mockTenants[0].status).toBe("TRIAL");

    expect(mockTenantUsers).toHaveLength(1);
    expect(mockTenantUsers[0].role).toBe("STORE_OWNER");
    expect(mockTenantUsers[0].authUserId).toBe("user_owner_1");
    expect(mockTenantUsers[0].email).toBe("chef@bistro.example");

    // Verify backing anchor product was created for dining table orders
    const anchorProduct = mockProducts.find((p) => p.slug === "dining-menu");
    expect(anchorProduct).toBeDefined();

    // Verify starter menu item created
    expect(mockMenuCategories).toHaveLength(1);
    expect(mockMenuItems).toHaveLength(1);
    expect(mockMenuItems[0].name).toBe("Signature Dish");
  });

  it("provisions an Ecommerce business with shipping zones and starter product", async () => {
    const res = await createAdditionalBusiness({
      name: "Gulshan Bistro Merch",
      subdomain: "bistro-merch",
      siteMode: "ECOMMERCE",
      ownerUserId: "user_owner_1",
      ownerEmail: "chef@bistro.example",
      ownerName: "Chef Kabir",
    });

    expect(res).toBeDefined();
    expect(res.name).toBe("Gulshan Bistro Merch");
    expect(res.subdomain).toBe("bistro-merch");
    expect(res.siteMode).toBe("ECOMMERCE");

    expect(mockTenants[0].themeId).toBe("kapor");
    expect(mockShippingZones.length).toBeGreaterThanOrEqual(2);
    expect(mockProducts.find((p) => p.slug === "featured-product")).toBeDefined();
  });

  it("prevents creating a business with an already taken subdomain", async () => {
    mockTenants.push({
      id: "existing_1",
      name: "Existing Shop",
      subdomain: "alreadytaken",
      status: "ACTIVE",
    });

    await expect(
      createAdditionalBusiness({
        name: "New Shop",
        subdomain: "alreadytaken",
        siteMode: "ECOMMERCE",
        ownerUserId: "user_owner_2",
        ownerEmail: "test@example.com",
      })
    ).rejects.toThrow(/already taken/i);
  });

  it("retrieves all businesses for a merchant and marks the current active one", async () => {
    // Seed 2 businesses under same owner
    mockTenants.push(
      {
        id: "t_dining",
        name: "Dhaka Bistro",
        subdomain: "dhakabistro",
        status: "ACTIVE",
        siteMode: "PORTFOLIO",
        businessVertical: "RESTAURANT",
        customDomain: "dhakabistro.com",
      },
      {
        id: "t_shop",
        name: "Dhaka Bistro Shop",
        subdomain: "dhakabistro-shop",
        status: "ACTIVE",
        siteMode: "ECOMMERCE",
        businessVertical: null,
        customDomain: "shop.dhakabistro.com",
      }
    );

    mockTenantUsers.push(
      {
        id: "tu_1",
        tenantId: "t_dining",
        authUserId: "auth_owner_1",
        email: "owner@bistro.example",
        role: "STORE_OWNER",
        name: "Owner",
        isActive: true,
      },
      {
        id: "tu_2",
        tenantId: "t_shop",
        authUserId: "auth_owner_1",
        email: "owner@bistro.example",
        role: "STORE_OWNER",
        name: "Owner",
        isActive: true,
      }
    );

    const businesses = await getMerchantBusinesses(
      { id: "auth_owner_1", email: "owner@bistro.example", emailConfirmed: true },
      "t_dining"
    );

    expect(businesses).toHaveLength(2);
    const dining = businesses.find((b) => b.tenantId === "t_dining");
    const shop = businesses.find((b) => b.tenantId === "t_shop");

    expect(dining?.isCurrent).toBe(true);
    expect(dining?.siteMode).toBe("PORTFOLIO");
    expect(dining?.businessVertical).toBe("RESTAURANT");
    expect(dining?.customDomain).toBe("dhakabistro.com");

    expect(shop?.isCurrent).toBe(false);
    expect(shop?.siteMode).toBe("ECOMMERCE");
    expect(shop?.customDomain).toBe("shop.dhakabistro.com");
  });

  it("strictly isolates businesses so different store owners never see each other's stores", async () => {
    // Add another store belonging to a completely different owner
    mockTenants.push({
      id: "t_unrelated",
      name: "Unrelated Store",
      subdomain: "unrelated-store",
      status: "ACTIVE",
      siteMode: "ECOMMERCE",
      businessVertical: null,
      customDomain: null,
      ownerEmail: "different@owner.example",
      ownerName: "Different Owner",
      users: [
        {
          id: "tu_other",
          tenantId: "t_unrelated",
          email: "different@owner.example",
          role: "STORE_OWNER",
          name: "Different Owner",
        },
      ],
    });

    // 1. Production discovery check
    const merchantStores = await getMerchantBusinesses(
      { id: "auth_owner_1", email: "owner@bistro.example", emailConfirmed: true },
      "t_dining"
    );
    expect(merchantStores.map((s) => s.subdomain)).not.toContain("unrelated-store");
    expect(merchantStores.every((s) => s.tenantId !== "t_unrelated")).toBe(true);

    // 2. Dev discovery check
    const devStores = await getDevBusinesses("dhakabistro", "owner@bistro.example");
    expect(devStores.map((s) => s.subdomain)).not.toContain("unrelated-store");
    expect(devStores.every((s) => s.tenantId !== "t_unrelated")).toBe(true);
  });
});
