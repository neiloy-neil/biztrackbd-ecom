import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  archiveProduct, createOrder, createProduct, getUsage, monthStart, orderState, productState, reconcileProductCount,
  restoreProduct, setEventPublisher, DomainError,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const key = () => `limit-key-${Date.now()}-${++seq}`;
const phone = () => `0161${String(1000000 + ++seq).slice(-7)}`;

/** A STARTER store with the fixture's 3 products already counted. Limits come from setStarterLimits(). */
async function newStore(name: string): Promise<TenantFixture> {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}-${++seq}`, stock: 100000 });
  await owner.tenant.update({ where: { id: f.tenantId }, data: { planTier: "STARTER", productCount: 3 } });
  return f;
}

const productInput = (n: number) => ({ title: `Product ${n}`, slug: `product-${n}-${seq}`, basePrice: 500 });
const orderInput = (f: TenantFixture) => ({
  idempotencyKey: key(),
  customer: { name: "Limit Buyer", phone: phone() },
  shipping: { address: "House 1, Road 1", city: "Dhaka", district: "Dhaka", division: "Dhaka" },
  items: [{ variantId: f.products[0]!.variants[0]!.id, quantity: 1 }],
});

/** Plans are shared rows, so each test group sets the STARTER limits it needs and the tests run one after another. */
async function setStarterLimits(limits: { products: number | null; ordersPerMonth: number | null }) {
  await owner.plan.update({ where: { tier: "STARTER" }, data: { limits: { ...limits, staff: 2 } } });
}

beforeAll(async () => {
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  await seedPlans(owner);
});

afterAll(async () => {
  setEventPublisher(async () => {});
  await owner?.$disconnect();
  await app?.$disconnect();
});

describe("pure state helpers", () => {
  it("classifies product usage", () => {
    expect(productState(10, 100)).toBe("ok");
    expect(productState(80, 100)).toBe("warning");
    expect(productState(100, 100)).toBe("at_limit");
    expect(productState(5000, null)).toBe("unlimited");
  });

  it("classifies order usage with the 10% grace", () => {
    expect(orderState(399, 500)).toBe("ok");
    expect(orderState(400, 500)).toBe("warning");
    expect(orderState(500, 500)).toBe("over");
    expect(orderState(550, 500)).toBe("over");
    expect(orderState(551, 500)).toBe("exceeded");
    expect(orderState(99999, null)).toBe("unlimited");
  });

  it("rolls the month over at midnight in the store's timezone", () => {
    // 20:00 UTC on 30 June is already 02:00 on 1 July in Dhaka (UTC+6)
    expect(monthStart(new Date("2026-06-30T20:00:00Z"), "Asia/Dhaka")).toBe("2026-07-01");
    expect(monthStart(new Date("2026-06-30T20:00:00Z"), "UTC")).toBe("2026-06-01");
  });
});

describe("product limit (hard)", () => {
  it("allows creating up to the limit and then blocks with an upgrade error", async () => {
    await setStarterLimits({ products: 5, ordersPerMonth: 500 });
    const f = await newStore("hard");
    const a = await createProduct(f.tenantId, productInput(1));
    expect(a.usage.products).toMatchObject({ used: 4, limit: 5, state: "warning" });
    await createProduct(f.tenantId, productInput(2));
    const err = await createProduct(f.tenantId, productInput(3)).then(() => null, (e) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect(err.code).toBe("PLAN_LIMIT");
    expect(err.details).toMatchObject({ metric: "products", limit: 5, used: 5 });
    expect(await owner.product.count({ where: { tenantId: f.tenantId } })).toBe(5);
  });

  it("never exceeds the limit when many creates race for the last slots", async () => {
    await setStarterLimits({ products: 10, ordersPerMonth: 500 });
    const f = await newStore("race");
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => createProduct(f.tenantId, productInput(100 + i))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(7); // 3 existing + 7 = 10
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(rejected.every((r) => r.reason?.code === "PLAN_LIMIT")).toBe(true);
    expect(await owner.product.count({ where: { tenantId: f.tenantId } })).toBe(10);
    expect((await owner.tenant.findUniqueOrThrow({ where: { id: f.tenantId } })).productCount).toBe(10);
  });

  it("gives the slot back when the insert fails (duplicate URL name)", async () => {
    await setStarterLimits({ products: 5, ordersPerMonth: 500 });
    const f = await newStore("dup");
    await createProduct(f.tenantId, { ...productInput(1), slug: "same-slug" });
    await expect(createProduct(f.tenantId, { ...productInput(2), slug: "same-slug" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect((await owner.tenant.findUniqueOrThrow({ where: { id: f.tenantId } })).productCount).toBe(4);
  });

  it("deleting frees a slot, once, and restoring needs a free slot", async () => {
    await setStarterLimits({ products: 4, ordersPerMonth: 500 });
    const f = await newStore("archive");
    const p = await createProduct(f.tenantId, productInput(1)); // now 4 of 4
    await expect(createProduct(f.tenantId, productInput(2))).rejects.toMatchObject({ code: "PLAN_LIMIT" });
    await Promise.all([archiveProduct(f.tenantId, p.id), archiveProduct(f.tenantId, p.id)]);
    expect((await owner.tenant.findUniqueOrThrow({ where: { id: f.tenantId } })).productCount).toBe(3);
    const q = await createProduct(f.tenantId, productInput(3)); // takes the freed slot
    await expect(restoreProduct(f.tenantId, p.id)).rejects.toMatchObject({ code: "PLAN_LIMIT" });
    await archiveProduct(f.tenantId, q.id);
    await restoreProduct(f.tenantId, p.id);
    expect((await owner.tenant.findUniqueOrThrow({ where: { id: f.tenantId } })).productCount).toBe(4);
  });

  it("null means unlimited", async () => {
    await setStarterLimits({ products: null, ordersPerMonth: null });
    const f = await newStore("unlimited");
    for (let i = 0; i < 5; i++) await createProduct(f.tenantId, productInput(200 + i));
    const u = await getUsage(f.tenantId);
    expect(u.products.state).toBe("unlimited");
    expect(u.products.limit).toBeNull();
  });

  it("a plan change applies immediately, and a downgrade keeps existing products but blocks new ones", async () => {
    await setStarterLimits({ products: 100, ordersPerMonth: 500 });
    const f = await newStore("downgrade");
    await createProduct(f.tenantId, productInput(1));
    await setStarterLimits({ products: 2, ordersPerMonth: 500 });
    await expect(createProduct(f.tenantId, productInput(2))).rejects.toMatchObject({ code: "PLAN_LIMIT" });
    expect(await owner.product.count({ where: { tenantId: f.tenantId } })).toBe(4);
    expect((await getUsage(f.tenantId)).products.state).toBe("at_limit");
  });

  it("reconcile repairs a drifted counter", async () => {
    await setStarterLimits({ products: 50, ordersPerMonth: 500 });
    const f = await newStore("drift");
    await owner.tenant.update({ where: { id: f.tenantId }, data: { productCount: 40 } });
    const { withTenant } = await import("@biztrackbd/db");
    const n = await withTenant(f.tenantId, (tx) => reconcileProductCount(tx, f.tenantId));
    expect(n).toBe(3);
    expect((await getUsage(f.tenantId)).products.used).toBe(3);
  });

  it("one store's usage does not affect another's", async () => {
    await setStarterLimits({ products: 4, ordersPerMonth: 500 });
    const a = await newStore("iso-a");
    const b = await newStore("iso-b");
    await createProduct(a.tenantId, productInput(1));
    await expect(createProduct(a.tenantId, productInput(2))).rejects.toMatchObject({ code: "PLAN_LIMIT" });
    await expect(createProduct(b.tenantId, productInput(1))).resolves.toBeTruthy();
  });
});

describe("order limit (soft)", () => {
  it("counts every order and reports usage", async () => {
    await setStarterLimits({ products: 300, ordersPerMonth: 100 });
    const f = await newStore("count");
    for (let i = 0; i < 5; i++) await createOrder(f.tenantId, orderInput(f));
    const u = await getUsage(f.tenantId);
    expect(u.orders).toMatchObject({ used: 5, limit: 100, percent: 5, state: "ok", graceLimit: 110 });
  });

  it("does not count an idempotent replay", async () => {
    await setStarterLimits({ products: 300, ordersPerMonth: 100 });
    const f = await newStore("replay");
    const input = orderInput(f);
    await createOrder(f.tenantId, input);
    await createOrder(f.tenantId, input);
    expect((await getUsage(f.tenantId)).orders.used).toBe(1);
  });

  it("does not count an order that failed", async () => {
    await setStarterLimits({ products: 300, ordersPerMonth: 100 });
    const f = await newStore("failed");
    await expect(createOrder(f.tenantId, { ...orderInput(f), items: [{ variantId: "does-not-exist-1", quantity: 1 }] })).rejects.toBeTruthy();
    expect((await getUsage(f.tenantId)).orders.used).toBe(0);
  });

  it("keeps accepting orders past the limit and past the grace, and fires each warning exactly once", async () => {
    await setStarterLimits({ products: 300, ordersPerMonth: 10 });
    const f = await newStore("soft");
    const seen: number[] = [];
    setEventPublisher(async (name, data) => {
      if (name === "usage/threshold-crossed" && data.tenantId === f.tenantId) seen.push((data as { percent: number }).percent);
    });
    // 14 orders against a limit of 10: 80% at 8, 100% at 10, 110% at 11, grace ends after 11
    for (let i = 0; i < 14; i++) await createOrder(f.tenantId, orderInput(f));
    expect(seen).toEqual([80, 100, 110]);
    const u = await getUsage(f.tenantId);
    expect(u.orders).toMatchObject({ used: 14, state: "exceeded", graceLimit: 11 });
    setEventPublisher(async () => {});
  });

  it("fires each warning once even when orders arrive at the same moment", async () => {
    await setStarterLimits({ products: 300, ordersPerMonth: 10 });
    const f = await newStore("burst");
    const seen: number[] = [];
    setEventPublisher(async (name, data) => {
      if (name === "usage/threshold-crossed" && data.tenantId === f.tenantId) seen.push((data as { percent: number }).percent);
    });
    await Promise.all(Array.from({ length: 12 }, () => createOrder(f.tenantId, orderInput(f))));
    expect(seen.sort()).toEqual([100, 110, 80]);
    expect((await getUsage(f.tenantId)).orders.used).toBe(12);
    setEventPublisher(async () => {});
  });

  it("unlimited plans never warn", async () => {
    await setStarterLimits({ products: null, ordersPerMonth: null });
    const f = await newStore("nolimit");
    const seen: number[] = [];
    setEventPublisher(async (name, data) => { if (name === "usage/threshold-crossed" && data.tenantId === f.tenantId) seen.push(1); });
    for (let i = 0; i < 4; i++) await createOrder(f.tenantId, orderInput(f));
    expect(seen).toEqual([]);
    expect((await getUsage(f.tenantId)).orders.state).toBe("unlimited");
    setEventPublisher(async () => {});
  });

  it("a new month starts from zero", async () => {
    await setStarterLimits({ products: 300, ordersPerMonth: 100 });
    const f = await newStore("month");
    await owner.usageCounter.create({ data: { tenantId: f.tenantId, metric: "orders", periodStart: new Date("2020-01-01"), value: 99 } });
    await createOrder(f.tenantId, orderInput(f));
    expect((await getUsage(f.tenantId)).orders.used).toBe(1);
  });
});
