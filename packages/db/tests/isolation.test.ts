import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { PrismaClient } from "@prisma/client";
import { createBaseClient } from "../src/client";
import { assertTenantId, createTenantPrismaClient, resolveTenantByHost, withTenant } from "../src/tenant";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "../src/testing";

let urls: ReturnType<typeof testUrls>;
let owner: PrismaClient; // owner role: bypasses RLS, used for fixtures only
let app: PrismaClient; // restricted role: what the real apps use
let A: TenantFixture;
let B: TenantFixture;

beforeAll(async () => {
  urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 5);
  await seedPlans(owner);
  A = await createTenantFixture(owner, { name: "Store A", subdomain: "store-a" });
  B = await createTenantFixture(owner, { name: "Store B", subdomain: "store-b" });
});

afterAll(async () => {
  await owner?.$disconnect();
  await app?.$disconnect();
});

describe("schema level guarantees", () => {
  it("every table with a required tenantId has RLS enabled and forced", async () => {
    const c = new pg.Client({ connectionString: urls.direct });
    await c.connect();
    const { rows } = await c.query(`
      SELECT cl.relname, cl.relrowsecurity AS enabled, cl.relforcerowsecurity AS forced
      FROM pg_class cl
      JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = 'public'
      JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attname = 'tenantId' AND NOT a.attisdropped AND a.attnotnull
      WHERE cl.relkind = 'r'`);
    await c.end();
    expect(rows.length).toBeGreaterThan(40);
    const unprotected = rows.filter((r) => !r.enabled || !r.forced).map((r) => r.relname);
    expect(unprotected).toEqual([]);
  });

  it("the application role cannot bypass row-level security", async () => {
    const [row] = await owner.$queryRaw<{ rolbypassrls: boolean; rolsuper: boolean }[]>`
      SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'biztrack_app'`;
    expect(row).toEqual({ rolbypassrls: false, rolsuper: false });
  });
});

describe("tenant isolation through the restricted role", () => {
  it("returns nothing when no tenant is set (fails closed)", async () => {
    expect(await app.product.count()).toBe(0);
    expect(await app.order.count()).toBe(0);
    expect(await app.tenant.count()).toBe(0);
  });

  it("each tenant sees only its own rows", async () => {
    const a = await withTenant(A.tenantId, (tx) => tx.product.findMany(), { client: app });
    const b = await withTenant(B.tenantId, (tx) => tx.product.findMany(), { client: app });
    expect(a).toHaveLength(3);
    expect(b).toHaveLength(3);
    expect(a.every((p) => p.tenantId === A.tenantId)).toBe(true);
    expect(b.every((p) => p.tenantId === B.tenantId)).toBe(true);
    const aIds = new Set(a.map((p) => p.id));
    expect(b.some((p) => aIds.has(p.id))).toBe(false);
  });

  it("a tenant cannot read another tenant's row by its id", async () => {
    const stolen = await withTenant(A.tenantId, (tx) => tx.product.findUnique({ where: { id: B.products[0]!.id } }), { client: app });
    expect(stolen).toBeNull();
    const variant = await withTenant(A.tenantId, (tx) => tx.productVariant.findUnique({ where: { id: B.products[0]!.variants[0]!.id } }), { client: app });
    expect(variant).toBeNull();
  });

  it("raw SQL is also confined to the tenant", async () => {
    const rows = await withTenant(A.tenantId, (tx) => tx.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "ProductVariant"`, { client: app });
    expect(Number(rows[0]!.n)).toBe(A.products.reduce((s, p) => s + p.variants.length, 0));
  });

  it("a tenant cannot insert a row for another tenant", async () => {
    await expect(
      withTenant(A.tenantId, (tx) => tx.coupon.create({ data: { tenantId: B.tenantId, code: "STEAL", type: "FIXED_AMOUNT", value: 100 } }), { client: app }),
    ).rejects.toThrow();
    const leaked = await owner.coupon.count({ where: { code: "STEAL" } });
    expect(leaked).toBe(0);
  });

  it("a tenant cannot update or delete another tenant's rows", async () => {
    const target = B.products[1]!.variants[0]!.id;
    const upd = await withTenant(A.tenantId, (tx) => tx.productVariant.updateMany({ where: { id: target }, data: { stockQuantity: 0 } }), { client: app });
    const del = await withTenant(A.tenantId, (tx) => tx.productVariant.deleteMany({ where: { id: target } }), { client: app });
    expect(upd.count).toBe(0);
    expect(del.count).toBe(0);
    const still = await owner.productVariant.findUniqueOrThrow({ where: { id: target } });
    expect(still.stockQuantity).toBe(10);
  });

  it("the Tenant row itself is only visible to its own tenant", async () => {
    const own = await withTenant(A.tenantId, (tx) => tx.tenant.findMany(), { client: app });
    expect(own.map((t) => t.id)).toEqual([A.tenantId]);
  });

  it("tenant context does not leak into the next transaction on a pooled connection", async () => {
    await withTenant(A.tenantId, (tx) => tx.product.count(), { client: app });
    expect(await app.product.count()).toBe(0);
  });

  it("stays isolated under concurrent mixed-tenant load", async () => {
    const jobs = Array.from({ length: 40 }, (_, i) => {
      const f = i % 2 === 0 ? A : B;
      return withTenant(f.tenantId, async (tx) => ({ f, rows: await tx.product.findMany({ select: { tenantId: true } }) }), { client: app });
    });
    for (const { f, rows } of await Promise.all(jobs)) {
      expect(rows).toHaveLength(3);
      expect(rows.every((r) => r.tenantId === f.tenantId)).toBe(true);
    }
  });
});

describe("cross-tenant foreign keys", () => {
  it("blocks an order item that points at another tenant's product", async () => {
    const order = await owner.order.create({
      data: {
        tenantId: A.tenantId, orderNumber: "FK-1", customerName: "X", customerPhone: "01712345678",
        shippingAddress: "a", shippingCity: "Dhaka", shippingDistrict: "Dhaka", shippingDivision: "Dhaka", deliveryZone: "INSIDE_DHAKA",
        subtotalAmount: 1, deliveryCharge: 0, totalAmount: 1,
      },
    });
    await expect(
      owner.orderItem.create({
        data: { tenantId: A.tenantId, orderId: order.id, productId: B.products[0]!.id, productTitle: "stolen", unitPrice: 1, quantity: 1, totalPrice: 1 },
      }),
    ).rejects.toThrow(/Cross-tenant reference blocked/);
  });

  it("allows an order item that points at the same tenant's product", async () => {
    const order = await owner.order.create({
      data: {
        tenantId: A.tenantId, orderNumber: "FK-2", customerName: "X", customerPhone: "01712345678",
        shippingAddress: "a", shippingCity: "Dhaka", shippingDistrict: "Dhaka", shippingDivision: "Dhaka", deliveryZone: "INSIDE_DHAKA",
        subtotalAmount: 1, deliveryCharge: 0, totalAmount: 1,
      },
    });
    const item = await owner.orderItem.create({
      data: { tenantId: A.tenantId, orderId: order.id, productId: A.products[0]!.id, productTitle: "ok", unitPrice: 1, quantity: 1, totalPrice: 1 },
    });
    expect(item.id).toBeTruthy();
  });
});

describe("platform level tables", () => {
  it("are not readable by the tenant app role, except Plan", async () => {
    await expect(app.$queryRaw`SELECT 1 FROM "PlatformUser" LIMIT 1`).rejects.toThrow(/permission denied/i);
    await expect(app.$queryRaw`SELECT 1 FROM "PhoneTrustStat" LIMIT 1`).rejects.toThrow(/permission denied/i);
    await expect(app.$queryRaw`SELECT 1 FROM "PhoneTrustEvent" LIMIT 1`).rejects.toThrow(/permission denied/i);
    await expect(app.$queryRaw`SELECT 1 FROM "PlatformAuditLog" LIMIT 1`).rejects.toThrow(/permission denied/i);
    expect(await app.plan.count()).toBe(3);
  });

  it("the app role cannot modify plans", async () => {
    await expect(app.plan.update({ where: { tier: "PRO" }, data: { priceMonthlyBdt: 1 } })).rejects.toThrow(/permission denied/i);
  });
});

describe("hostname resolution", () => {
  it("resolves a platform subdomain", async () => {
    const t = await resolveTenantByHost("store-a.localhost:3000", "localhost:3000", app);
    expect(t?.id).toBe(A.tenantId);
    expect(t?.themeId).toBe("kapor");
  });

  it("returns null for an unknown host", async () => {
    expect(await resolveTenantByHost("nobody.localhost", "localhost", app)).toBeNull();
    expect(await resolveTenantByHost("example.com", "localhost", app)).toBeNull();
  });

  it("resolves only VERIFIED custom domains", async () => {
    await owner.domain.create({ data: { tenantId: B.tenantId, domain: "shop-b.com", verified: false } });
    expect(await resolveTenantByHost("shop-b.com", "localhost", app)).toBeNull();
    await owner.domain.updateMany({ where: { domain: "shop-b.com" }, data: { verified: true } });
    expect((await resolveTenantByHost("shop-b.com", "localhost", app))?.id).toBe(B.tenantId);
  });
});

describe("tenant scoped client", () => {
  it("scopes reads and injects tenantId on create", async () => {
    const db = createTenantPrismaClient(A.tenantId, app);
    expect(await db.product.count()).toBe(3);
    const c = await db.coupon.create({ data: { code: "WELCOME", type: "PERCENTAGE", value: 10 } as never });
    expect(c.tenantId).toBe(A.tenantId);
    const other = createTenantPrismaClient(B.tenantId, app);
    expect(await other.coupon.findUnique({ where: { tenantId_code: { tenantId: A.tenantId, code: "WELCOME" } } })).toBeNull();
  });

  it("refuses platform models", async () => {
    const db = createTenantPrismaClient(A.tenantId, app) as unknown as { platformUser: { findMany: () => Promise<unknown> } };
    await expect(db.platformUser.findMany()).rejects.toThrow(/platform-level/);
  });

  it("raw SQL on the extended client has no tenant context and sees nothing", async () => {
    const db = createTenantPrismaClient(A.tenantId, app);
    const rows = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "Product"`;
    expect(Number(rows[0]!.n)).toBe(0);
  });
});

describe("tenant id validation", () => {
  it.each(["", "x", "a'; DROP TABLE \"Product\"; --", "tenant id with spaces", "a".repeat(80)])("rejects %j", (bad) => {
    expect(() => assertTenantId(bad)).toThrow();
  });
  it("rejects SQL injection attempts before they reach the database", async () => {
    await expect(withTenant("abc'; DROP TABLE \"Product\"; --", async () => 1, { client: app })).rejects.toThrow();
    expect(await owner.product.count()).toBeGreaterThan(0);
  });
});
