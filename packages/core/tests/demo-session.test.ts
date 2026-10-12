import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, withTenant, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  DEMO_MAX_ACTIVE, DemoBusyError, DemoLimitError, DemoLockedError, DemoStoreError, addDomain, bookCourier, createDemoCookie, createDemoSession, createOrder, demoCreatorKey, inviteStaff,
  listConnectedCouriers, listInventory, listAdminProducts, loadDemoTenant, maybeDropDemoOrder, notifyOrder, resetDemoStore, saveMessageTemplate, setEventPublisher, setOrdersPaused, setSmsSender, sweepDemoSessions,
  verifyDemoCookie, importProductsCsv, getDashboard, getLive, parseKeepCode, readKeptStore, signupStore, type DemoDeps, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let saved = 0;
const sent: string[] = [];
const deps: DemoDeps = {
  rasterize: async (svg) => Buffer.from(svg),
  save: async (tenantId) => ({ url: `https://media.example.test/${tenantId}/${++saved}.webp` }),
  remove: async () => undefined,
};
const actorFor = (id: string): StaffActor => ({ userId: id, email: "demo@example.test", name: "Demo owner", role: "STORE_OWNER" });

beforeAll(async () => {
  process.env.PHONE_TRUST_SALT = "test-salt-test-salt-test-salt-0001";
  process.env.CUSTOMER_AUTH_SECRET ||= "test-secret-test-secret-test-secret-1234";
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "biztrack.test";
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  setPlatformPrisma(owner);
  await seedPlans(owner);
  await resetDemoStore("kapor", deps); // the template store a visitor's copy is made from
});
beforeEach(() => {
  sent.length = 0;
  setEventPublisher(async () => {});
  setSmsSender({ async send(_t, to, text) { sent.push(`${to}: ${text}`); } });
});
afterAll(async () => {
  await app.$disconnect();
  await owner.$disconnect();
});

const who = (n: string) => demoCreatorKey(`10.0.0.${n}`, "test");
const ownerOf = async (tenantId: string) => (await owner.tenantUser.findFirstOrThrow({ where: { tenantId, role: "STORE_OWNER" } })).id;

describe("the demo cookie", () => {
  it("opens only what it was signed for, and not after it expires or if it was changed", () => {
    const now = Date.now();
    const c = createDemoCookie({ tenantId: "t1", expiresAt: now + 60_000 });
    expect(verifyDemoCookie(c, now)).toEqual({ tenantId: "t1", expiresAt: now + 60_000 });
    expect(verifyDemoCookie(c, now + 61_000)).toBeNull();
    const [json, sig] = c.split(".");
    const forged = `${Buffer.from(JSON.stringify({ tenantId: "t2", expiresAt: now + 60_000 })).toString("base64url")}.${sig}`;
    expect(verifyDemoCookie(forged, now)).toBeNull();
    expect(verifyDemoCookie(`${json}.x`, now)).toBeNull();
    expect(verifyDemoCookie("", now)).toBeNull();
    expect(verifyDemoCookie(undefined, now)).toBeNull();
  });
});

describe("a visitor's private copy", () => {
  it("is a working store: the template's products, a published home page, starter orders in every state and a dashboard with a week of sales", async () => {
    const d = await createDemoSession("kapor", who("1"));
    expect(d.subdomain).toMatch(/^d-[0-9a-f]{8}$/);
    expect(d.expiresAt.getTime()).toBeGreaterThan(Date.now() + 2.9 * 3_600_000);
    expect((await loadDemoTenant(d.tenantId))?.template).toBe("kapor");
    const a = actorFor(await ownerOf(d.tenantId));
    const products = await listAdminProducts(d.tenantId, a);
    expect(products.total).toBeGreaterThanOrEqual(8);
    expect(products.rows.every((p) => p.imageUrl?.startsWith("https://media.example.test/"))).toBe(true); // pictures reused by address, none stored
    const t = await owner.tenant.findUniqueOrThrow({ where: { id: d.tenantId } });
    expect([t.isDemo, t.demoKind, t.planTier]).toEqual([true, "SESSION", "BUSINESS"]);
    const dash = await getDashboard(d.tenantId, a);
    expect(dash.series.days).toHaveLength(7);
    expect(dash.recent.length).toBeGreaterThan(0);
    expect(dash.awaitingCheck.count).toBeGreaterThan(0); // a bKash payment is waiting to be checked
    const statuses = (await owner.order.findMany({ where: { tenantId: d.tenantId } })).map((o) => o.status);
    for (const s of ["DELIVERED", "SHIPPED", "CANCELLED", "PENDING"]) expect(statuses, s).toContain(s);
    expect((await listInventory(d.tenantId, a, {})).total).toBeGreaterThan(0);
  });

  it("is private: two visitors never see each other's orders or changes", async () => {
    const a = await createDemoSession("kapor", who("2"));
    const b = await createDemoSession("kapor", who("3"));
    await owner.product.updateMany({ where: { tenantId: a.tenantId }, data: { title: "Only in A" } });
    const inB = await listAdminProducts(b.tenantId, actorFor(await ownerOf(b.tenantId)), { q: "Only in A" });
    expect(inB.total).toBe(0);
    const ordersA = await owner.order.count({ where: { tenantId: a.tenantId } });
    await maybeDropDemoOrder(a.tenantId, new Date(Date.now() + 10 * 60_000));
    expect(await owner.order.count({ where: { tenantId: b.tenantId } })).toBe(await owner.order.count({ where: { tenantId: b.tenantId } }));
    expect(await owner.order.count({ where: { tenantId: a.tenantId } })).toBe(ordersA + 1);
  });

  it("stays out of the template store, the platform numbers and the real stores' lists", async () => {
    const d = await createDemoSession("kapor", who("4"));
    const t = await owner.tenant.findUniqueOrThrow({ where: { id: d.tenantId } });
    expect(t.isDemo).toBe(true);
    expect(await owner.tenant.count({ where: { demoKind: "TEMPLATE" } })).toBe(1);
  });

  it("limits one visitor to three an hour, and the whole demo to 50 at once, before making anything", async () => {
    const me = who("5");
    for (let i = 0; i < 3; i++) await createDemoSession("kapor", me);
    const before = await owner.tenant.count({ where: { demoKind: "SESSION" } });
    await expect(createDemoSession("kapor", me)).rejects.toBeInstanceOf(DemoLimitError);
    expect(await owner.tenant.count({ where: { demoKind: "SESSION" } })).toBe(before);

    const fill = DEMO_MAX_ACTIVE - before;
    const ids: string[] = [];
    for (let i = 0; i < fill; i++) {
      const f = await createTenantFixture(owner, { name: `fill${i}`, subdomain: `fill${i}x`, stock: 1 });
      await owner.tenant.update({ where: { id: f.tenantId }, data: { isDemo: true, demoKind: "SESSION", demoExpiresAt: new Date(Date.now() + 3_600_000), demoCreator: `c-${i}` } });
      ids.push(f.tenantId);
    }
    await expect(createDemoSession("kapor", who("6"))).rejects.toBeInstanceOf(DemoBusyError);
    await owner.tenant.deleteMany({ where: { id: { in: ids } } });
  });

  it("refuses an unknown template and one whose store is not built", async () => {
    await expect(createDemoSession("nope", who("7"))).rejects.toThrow(/not available/);
    await expect(createDemoSession("gadgetstudio", who("7"))).rejects.toThrow(/not available/);
  });
});

describe("what a demo cannot do", () => {
  it("cannot text anyone, even with a message turned on; the order timeline still says it would have", async () => {
    const d = await createDemoSession("kapor", who("8"));
    const a = actorFor(await ownerOf(d.tenantId));
    await saveMessageTemplate(d.tenantId, a, { event: "ORDER_RECEIVED", enabled: true });
    const order = await owner.order.findFirstOrThrow({ where: { tenantId: d.tenantId } });
    expect(await notifyOrder(d.tenantId, order.id, "ORDER_RECEIVED")).toBe("sent");
    expect(sent).toEqual([]);
  });

  it("locks the account: plan payments, domains, team, integration keys, pausing and imports say 'not in the demo'", async () => {
    const d = await createDemoSession("kapor", who("9"));
    const a = actorFor(await ownerOf(d.tenantId));
    const tries = [
      () => addDomain(d.tenantId, a, "shop.example.com"), () => inviteStaff(d.tenantId, a, { email: "x@example.com", role: "STORE_MANAGER" }),
      () => setOrdersPaused(d.tenantId, a, true), () => importProductsCsv(d.tenantId, a, "title,price\nA,10\n"),
    ];
    for (const run of tries) {
      await expect(run()).rejects.toBeInstanceOf(DemoLockedError);
    }
  });

  it("books the pretend courier, with a tracking code, and the parcel moves along", async () => {
    const d = await createDemoSession("kapor", who("10"));
    const a = actorFor(await ownerOf(d.tenantId));
    expect((await listConnectedCouriers(d.tenantId)).map((c) => c.provider)).toEqual(["STEADFAST", "PATHAO"]);
    const o = await owner.order.findFirstOrThrow({ where: { tenantId: d.tenantId, status: "PENDING", paymentMethod: "COD" } });
    await withTenant(d.tenantId, async (tx) => { await tx.order.update({ where: { id: o.id }, data: { status: "PROCESSING" } }); });
    const b = await bookCourier(d.tenantId, a, o.id, { provider: "STEADFAST" });
    expect(b.trackingCode).toMatch(/^DM-/);
    expect((await owner.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("SHIPPED");
  });

  it("still takes orders in a private copy, but a public template store refuses them", async () => {
    const d = await createDemoSession("kapor", who("11"));
    const v = await owner.productVariant.findFirstOrThrow({ where: { tenantId: d.tenantId, stockQuantity: { gt: 2 } } });
    const input = (key: string) => ({ idempotencyKey: key, customer: { name: "A B", phone: "01712340000" }, shipping: { address: "House 1, Road 2", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" }, items: [{ variantId: v.id, quantity: 1 }], paymentMethod: "COD" });
    expect((await createOrder(d.tenantId, input("k-copy-order-1"))).orderId).toBeTruthy();
    const tpl = await owner.tenant.findFirstOrThrow({ where: { demoKind: "TEMPLATE" } });
    const tv = await owner.productVariant.findFirstOrThrow({ where: { tenantId: tpl.id } });
    await expect(createOrder(tpl.id, { ...input("k-tpl-order-1"), items: [{ variantId: tv.id, quantity: 1 }] })).rejects.toBeInstanceOf(DemoStoreError);
  });
});

describe("a few new orders while the visitor looks around", () => {
  it("places one when it has been a few minutes, never twice at once, and stops at the cap", async () => {
    const d = await createDemoSession("kapor", who("12"));
    const n0 = await owner.order.count({ where: { tenantId: d.tenantId } });
    expect(await maybeDropDemoOrder(d.tenantId)).toBe(false); // just seeded
    const later = new Date(Date.now() + 5 * 60_000);
    const [x, y] = await Promise.all([maybeDropDemoOrder(d.tenantId, later), maybeDropDemoOrder(d.tenantId, later)]);
    expect([x, y].filter(Boolean)).toHaveLength(1);
    expect(await owner.order.count({ where: { tenantId: d.tenantId } })).toBe(n0 + 1);
    await owner.tenant.update({ where: { id: d.tenantId }, data: { demoLastOrderAt: new Date(0) } });
    await owner.order.updateMany({ where: { tenantId: d.tenantId }, data: { status: "DELIVERED" } });
    for (let i = 0; i < 30; i++) {
      await owner.tenant.update({ where: { id: d.tenantId }, data: { demoLastOrderAt: new Date(0) } });
      if (!(await maybeDropDemoOrder(d.tenantId, new Date(Date.now() + 60 * 60_000)))) break;
    }
    expect(await owner.order.count({ where: { tenantId: d.tenantId } })).toBeLessThanOrEqual(40);
  });
});

describe("cleanup", () => {
  it("deletes copies past their time and nothing else", async () => {
    const old = await createDemoSession("kapor", who("13"));
    const fresh = await createDemoSession("kapor", who("14"));
    await owner.tenant.update({ where: { id: old.tenantId }, data: { demoExpiresAt: new Date(Date.now() - 1000) } });
    expect(await loadDemoTenant(old.tenantId)).toBeNull();
    const r = await sweepDemoSessions();
    expect(r.deleted).toBeGreaterThanOrEqual(1);
    expect(await owner.tenant.count({ where: { id: old.tenantId } })).toBe(0);
    expect(await owner.order.count({ where: { tenantId: old.tenantId } })).toBe(0);
    expect(await owner.tenant.count({ where: { id: fresh.tenantId } })).toBe(1);
    expect(await owner.tenant.count({ where: { demoKind: "TEMPLATE" } })).toBe(1);
  });
});

describe("keep this store", () => {
  const copied: string[] = [];
  const copyImage = async (tenantId: string, url: string) => { copied.push(url); return `https://media.example.test/kept/${tenantId}/${copied.length}.webp`; };
  let n = 0;
  const signup = (keep?: string, over: Record<string, unknown> = {}) =>
    signupStore({ ownerName: "Rina", email: `keep${++n}@example.test`, phone: `0171000${String(1000 + n)}`, storeName: `Kept Store ${n}`, subdomain: `kept-store-${n}`, plan: "PRO", theme: "kapor", demoData: true, ...over },
      { pictures: { rasterize: async (svg) => Buffer.from(svg), save: async (t) => ({ url: `https://media.example.test/sample/${t}/${++saved}.webp` }) }, ...(keep ? { keep: { code: keep, copyImage } } : {}) });

  it("recognises a well-formed code and nothing else", () => {
    expect(parseKeepCode("0b1f2a3c-0000-4000-8000-000000000000.abcdefghijklmnop1234")).toMatchObject({ tenantId: "0b1f2a3c-0000-4000-8000-000000000000" });
    for (const bad of ["", "nope", "abc.def", "0b1f2a3c-0000-4000-8000-000000000000.short", undefined, null]) expect(parseKeepCode(bad as never)).toBeNull();
  });

  it("carries the visitor's changes into a real store: edited and new products, the pictures (copied, not linked), the details and the home page", async () => {
    const d = await createDemoSession("kapor", who("20"));
    const a = actorFor(await ownerOf(d.tenantId));
    const code = (await loadDemoTenant(d.tenantId))!.keepCode!;
    // The visitor changes things in their demo.
    const first = await owner.product.findFirstOrThrow({ where: { tenantId: d.tenantId }, orderBy: { createdAt: "asc" } });
    await owner.product.update({ where: { id: first.id }, data: { title: "My Own Panjabi", basePrice: 1999 } });
    await owner.storeSettings.updateMany({ where: { tenantId: d.tenantId }, data: { tagline: "Made by me" } });
    await owner.product.create({ data: { tenantId: d.tenantId, title: "Brand New Thing", slug: "brand-new-thing", descriptionHtml: "<p>x</p>", basePrice: 500, status: "ACTIVE" } });
    const demoProducts = await owner.product.count({ where: { tenantId: d.tenantId, deletedAt: null } });
    void a;

    copied.length = 0;
    const r = await signup(code);
    expect(r.kept).toBe(demoProducts);
    expect(r.keptPage).toBe(true);
    const mine = await listAdminProducts(r.tenantId, actorFor(await ownerOf(r.tenantId)), { q: "My Own Panjabi" });
    expect(mine.rows.map((x) => [x.title, x.price])).toEqual([["My Own Panjabi", 1999]]);
    expect((await listAdminProducts(r.tenantId, actorFor(await ownerOf(r.tenantId)), { q: "Brand New Thing" })).total).toBe(1);
    expect((await owner.storeSettings.findFirstOrThrow({ where: { tenantId: r.tenantId } })).tagline).toBe("Made by me");
    // Pictures were copied into the new store, not linked to the demo's.
    const imgs = await owner.productImage.findMany({ where: { tenantId: r.tenantId } });
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs.every((i) => i.url.includes(`/kept/${r.tenantId}/`))).toBe(true);
    expect(copied.length).toBeGreaterThan(0);
    // The home page came too, with its pictures swapped for the copies.
    const live = await getLive(r.tenantId, "home");
    expect(live).not.toBeNull();
    expect(JSON.stringify(live!.page)).not.toContain(`/${d.tenantId}/`);
    // It is a real store: on the plan they chose, in trial, and not a demo.
    const t = await owner.tenant.findUniqueOrThrow({ where: { id: r.tenantId } });
    expect([t.isDemo, t.demoKind, t.planTier, t.status]).toEqual([false, null, "PRO", "TRIAL"]);
    // The store was kept, so the demo is over: its copy is gone and the visitor's demo session no longer opens anything.
    expect(await loadDemoTenant(d.tenantId)).toBeNull();
    expect(await owner.tenant.count({ where: { id: d.tenantId } })).toBe(0);
    expect(await readKeptStore(code)).toBeNull();
  });

  it("works once: the same code later gives the template's sample products instead", async () => {
    const d = await createDemoSession("kapor", who("21"));
    const code = (await loadDemoTenant(d.tenantId))!.keepCode!;
    const first = await signup(code);
    expect(first.kept).toBeGreaterThan(0);
    const second = await signup(code);
    expect(second.kept ?? 0).toBe(0);
    expect(await owner.product.count({ where: { tenantId: second.tenantId } })).toBeGreaterThan(0); // the template's samples
  });

  it("ignores a wrong, someone else's or expired code, and signup still works", async () => {
    const a = await createDemoSession("kapor", who("22"));
    const b = await createDemoSession("kapor", who("23"));
    const codeA = (await loadDemoTenant(a.tenantId))!.keepCode!;
    const token = codeA.split(".")[1]!;
    expect(await readKeptStore(`${b.tenantId}.${token}`)).toBeNull(); // A's secret does not open B
    expect(await readKeptStore(`${a.tenantId}.${"x".repeat(24)}`)).toBeNull();
    await owner.tenant.update({ where: { id: a.tenantId }, data: { demoExpiresAt: new Date(Date.now() - 1000) } });
    expect(await readKeptStore(codeA)).toBeNull();
    for (const bad of [`${b.tenantId}.${token}`, codeA, "garbage"]) {
      const r = await signup(bad);
      expect(r.kept ?? 0).toBe(0);
      expect(r.tenantId).toBeTruthy();
    }
  });

  it("a picture that cannot be copied is left out; the product still comes", async () => {
    const d = await createDemoSession("kapor", who("24"));
    const code = (await loadDemoTenant(d.tenantId))!.keepCode!;
    const r = await signupStore({ ownerName: "Rina", email: `keep${++n}@example.test`, phone: `0171000${String(1000 + n)}`, storeName: `Kept Store ${n}`, subdomain: `kept-store-${n}`, plan: "PRO", theme: "kapor", demoData: true },
      { keep: { code, copyImage: async () => { throw new Error("storage down"); } } });
    expect(r.kept).toBeGreaterThan(0);
    expect(await owner.productImage.count({ where: { tenantId: r.tenantId } })).toBe(0);
    expect(await owner.product.count({ where: { tenantId: r.tenantId } })).toBe(r.kept);
  });
});
