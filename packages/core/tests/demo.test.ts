import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  ART_KINDS, DEMO_SUBDOMAINS, DEMO_TEMPLATES, DomainError, classifyHost, createOrder, getLive, getOverview, listTenants, requestOtp, resetDemoStore, runBillingLifecycle,
  setEventPublisher, signupStore, validateSubdomain, type DemoDeps, type PlatformActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
const removed: string[] = [];
let saved = 0;
const deps: DemoDeps = {
  rasterize: async (svg) => Buffer.from(svg),
  save: async (tenantId) => ({ url: `https://media.example.test/${tenantId}/${++saved}.webp` }),
  remove: async (_t, url) => { removed.push(url); },
};
const boss: PlatformActor = { id: "pu-OWNER", email: "owner@biztrackbd.test", role: "OWNER" };

beforeAll(async () => {
  process.env.PHONE_TRUST_SALT = "test-salt-test-salt-test-salt-0001";
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "biztrack.test";
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  setPlatformPrisma(owner);
  await seedPlans(owner);
});
beforeEach(() => setEventPublisher(async () => {}));
afterAll(async () => {
  await app.$disconnect();
  await owner.$disconnect();
});

describe("the template demo content", () => {
  it("covers all six templates, each with its own address, products in both languages and a drawing for every product", () => {
    expect(DEMO_TEMPLATES.map((t) => t.id).sort()).toEqual(["axionwear", "berber", "bindu", "gadgetstudio", "kapor", "mini-bunny"]);
    for (const t of DEMO_TEMPLATES) {
      expect(DEMO_SUBDOMAINS.has(t.host), `${t.id} host is reserved from signup`).toBe(true);
      expect(t.products.length).toBeGreaterThanOrEqual(8);
      expect(t.products.filter((p) => p.featured).length, `${t.id} featured`).toBeGreaterThanOrEqual(4);
      const slugs = new Set<string>();
      const cats = new Set(t.categories.map((c) => c.slug));
      for (const p of t.products) {
        expect(slugs.has(p.slug), `${t.id}/${p.slug} duplicated`).toBe(false);
        slugs.add(p.slug);
        expect(Number.isInteger(p.price) && p.price > 0).toBe(true);
        expect(p.cost).toBeLessThan(p.price);
        if (p.compareAt) expect(p.compareAt).toBeGreaterThan(p.price);
        expect(p.title.length).toBeGreaterThan(2);
        expect(p.titleBn).toMatch(/[ঀ-৿]/); // Bangla script
        expect(p.textBn).toMatch(/[ঀ-৿]/);
        expect(cats.has(p.category), `${t.id}/${p.slug} category`).toBe(true);
        expect(ART_KINDS).toContain(p.art);
        expect(p.variants.length).toBeGreaterThan(0);
      }
      for (const c of t.categories) expect(t.products.some((p) => p.category === c.slug), `${t.id}/${c.slug} has no product`).toBe(true);
    }
  });

  it("keeps the demo names away from signup, but the stores still resolve as stores", () => {
    for (const label of DEMO_SUBDOMAINS) {
      expect(validateSubdomain(label)).toMatchObject({ ok: false, reason: "reserved" });
      expect(classifyHost(`${label}.biztrack.bd`, "biztrack.bd")).toEqual({ kind: "subdomain", label });
    }
  });
});

describe("building a demo store", () => {
  it("creates a flagged, always-active store with its products, pictures and a published home page", async () => {
    const r = await resetDemoStore("kapor", deps);
    expect(r).toMatchObject({ template: "kapor", subdomain: "kapor", products: 8 });
    const t = await owner.tenant.findUniqueOrThrow({ where: { id: r.tenantId } });
    expect(t).toMatchObject({ isDemo: true, status: "ACTIVE", themeId: "kapor", locale: "en-BD", productCount: 8 });
    expect(t.trialEndsAt.getUTCFullYear()).toBeGreaterThan(2050);

    const products = await owner.product.findMany({ where: { tenantId: r.tenantId }, include: { images: true, variants: true } });
    expect(products).toHaveLength(8);
    for (const p of products) {
      expect(p.images).toHaveLength(1);
      expect(p.images[0]!.url).toMatch(/^https:\/\//);
      expect(p.variants.length).toBeGreaterThan(0);
      expect(p.titleBn).toMatch(/[ঀ-৿]/);
    }
    const live = await getLive(r.tenantId, "home");
    expect(live?.page.sections.map((s) => s.type)).toEqual(["announcement-bar", "hero", "featured-products", "category-grid", "banner", "featured-products", "rich-text", "trust-strip"]);
  });

  it("rebuilding starts clean: the old store and its pictures are removed and a new one stands in its place", async () => {
    const before = await owner.tenant.findFirstOrThrow({ where: { subdomain: "kapor" } });
    const oldPictures = (await owner.productImage.findMany({ where: { tenantId: before.id }, select: { url: true } })).map((i) => i.url);
    // A visitor left something behind.
    await owner.customer.create({ data: { tenantId: before.id, name: "Vandal", phone: "01711111111" } });
    removed.length = 0;
    const again = await resetDemoStore("kapor", deps);
    expect(again.tenantId).not.toBe(before.id);
    expect(await owner.tenant.count({ where: { subdomain: "kapor" } })).toBe(1);
    expect(await owner.customer.count({ where: { tenantId: before.id } })).toBe(0);
    for (const u of oldPictures) expect(removed).toContain(u);
  });

  it("refuses to wipe a real merchant's store that has a demo name", async () => {
    await owner.tenant.updateMany({ where: { subdomain: "kapor" }, data: { isDemo: false } });
    await expect(resetDemoStore("kapor", deps)).rejects.toThrow(/not a demo store/);
    await owner.tenant.updateMany({ where: { subdomain: "kapor" }, data: { isDemo: true } });
  });
});

describe("what a demo store refuses", () => {
  it("never takes an order, sends a code or keeps a cart", async () => {
    const t = await owner.tenant.findFirstOrThrow({ where: { subdomain: "kapor" } });
    const variant = await owner.productVariant.findFirstOrThrow({ where: { tenantId: t.id } });
    const order = createOrder(t.id, {
      idempotencyKey: `demo-${Date.now()}`, customer: { name: "Visitor", phone: "01712345678" },
      shipping: { address: "House 4, Road 2, Dhanmondi", city: "Dhaka", district: "Dhaka", division: "Dhaka" }, items: [{ variantId: variant.id, quantity: 1 }],
    });
    await expect(order).rejects.toMatchObject({ code: "DEMO_STORE" });
    await expect(order).rejects.toBeInstanceOf(DomainError);
    expect(await owner.order.count({ where: { tenantId: t.id } })).toBe(0);
    await expect(requestOtp(t.id, "01712345678")).rejects.toMatchObject({ code: "DEMO_STORE" });
    expect(await owner.customerOtp.count({ where: { tenantId: t.id } })).toBe(0);
  });
});

describe("demo stores in platform numbers", () => {
  it("leave out of revenue, trials, counts and the billing sweep, but are still listed for support", async () => {
    await resetDemoStore("bindu", deps);
    const real = await signupStore({ ownerName: "Nusrat Jahan", email: "real@example.test", phone: "01712345679", storeName: "Real Shop", subdomain: "realshop", plan: "STARTER" });
    const o = await getOverview(boss);
    expect(JSON.stringify(o)).not.toContain("kapor");
    // Three stores exist (two demos and one real trial). Only the real one is counted anywhere.
    expect(o.activeTrials).toBe(1);
    expect(o.signups.reduce((n, d) => n + d.count, 0)).toBe(1);
    expect(o.payingStores + o.pastDue + o.readOnlyOrLocked).toBe(0);
    expect((await owner.tenant.count({ where: { isDemo: true } }))).toBe(2);

    const sweep = await runBillingLifecycle();
    expect(sweep.checked).toBe(1);

    const list = await listTenants(boss, {});
    const names = list.rows.map((r) => r.subdomain).sort();
    expect(names).toEqual(["bindu", "kapor", real.subdomain].sort());
    expect(list.rows.find((r) => r.subdomain === "kapor")!.isDemo).toBe(true);
    expect(list.rows.find((r) => r.subdomain === real.subdomain)!.isDemo).toBe(false);
  });

  it("signup cannot claim a demo address", async () => {
    await expect(signupStore({ ownerName: "Someone", email: "x@example.test", phone: "01712345670", storeName: "Fake Kapor", subdomain: "kapor", plan: "STARTER" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("sample products at signup", () => {
  const input = (over: Record<string, unknown>) => ({ ownerName: "Nusrat Jahan", email: `s${Math.random().toString(36).slice(2, 8)}@example.test`, phone: `0171${String(Math.floor(1000000 + Math.random() * 8999999))}`, storeName: "Sample Shop", plan: "STARTER", ...over });
  const pictures = { rasterize: deps.rasterize, save: deps.save };

  it("follow the chosen template, each with a picture, worded as samples the owner can edit", async () => {
    const s = await signupStore(input({ subdomain: "gadgetshop", theme: "gadgetstudio", demoData: true }), { pictures });
    const products = await owner.product.findMany({ where: { tenantId: s.tenantId }, include: { images: true, variants: true } });
    expect(products).toHaveLength(8);
    expect(products.map((p) => p.title)).toContain("Wireless Earbuds Pro");
    expect(products.map((p) => p.title)).not.toContain("Cotton Panjabi, Off-white");
    for (const p of products) {
      expect(p.images).toHaveLength(1);
      expect(p.descriptionHtml).toContain("A sample product. Edit or delete it");
    }
    const t = await owner.tenant.findUniqueOrThrow({ where: { id: s.tenantId } });
    expect(t).toMatchObject({ isDemo: false, productCount: 8, status: "TRIAL" });
  });

  it("are created without pictures when picture storage is not set up, and not at all when switched off", async () => {
    const plain = await signupStore(input({ subdomain: "plainshop", theme: "bindu", demoData: true }));
    expect(await owner.product.count({ where: { tenantId: plain.tenantId } })).toBe(8);
    expect(await owner.productImage.count({ where: { tenantId: plain.tenantId } })).toBe(0);
    const none = await signupStore(input({ subdomain: "emptyshop", theme: "kapor", demoData: false }), { pictures });
    expect(await owner.product.count({ where: { tenantId: none.tenantId } })).toBe(0);
  });
});
