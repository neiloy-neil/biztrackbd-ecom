import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  RateLimitError, createOrder, getAccount, getKaporSettings, getProductBySlug, getStoreInfo, listCategories, listProducts, quoteOrder,
  readCustomerSession, requestOtp, signOrderAccess, verifyOrderAccess, setSmsSender, signCustomerSession, verifyOtp, DomainError, KAPOR_DEFAULTS,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let A: TenantFixture;
let B: TenantFixture;
let seq = 0;
const phone = () => `0151${String(1000000 + ++seq).slice(-7)}`;
const vid = (f: TenantFixture, p = 0, v = 0) => f.products[p]!.variants[v]!.id;

let sent: { to: string; text: string }[] = [];
const lastCode = (to: string) => [...sent].reverse().find((s) => s.to === to)?.text.match(/^(\d{6})/)?.[1] ?? "";

beforeAll(async () => {
  process.env.CUSTOMER_AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  await seedPlans(owner);
  A = await createTenantFixture(owner, { name: "Shop A", subdomain: "shop-a", stock: 1000 });
  B = await createTenantFixture(owner, { name: "Shop B", subdomain: "shop-b", stock: 1000 });
  await owner.coupon.createMany({
    data: [
      { tenantId: A.tenantId, code: "EID10", type: "PERCENTAGE", value: 10, minOrderValue: 1500, usageLimit: 100, perCustomerLimit: 1 },
      { tenantId: A.tenantId, code: "SHIPFREE", type: "FREE_SHIPPING", value: 0, perCustomerLimit: 5 },
      { tenantId: A.tenantId, code: "FLAT200", type: "FIXED_AMOUNT", value: 200, perCustomerLimit: 5 },
    ],
  });
});

beforeEach(() => {
  sent = [];
  setSmsSender({ send: async (_t, to, text) => { sent.push({ to, text }); } });
});

afterAll(async () => {
  await owner?.$disconnect();
  await app?.$disconnect();
});

describe("quoteOrder", () => {
  const scenarios: { name: string; items: { f: "A"; p: number; v: number; q: number }[]; district: string; coupon?: string }[] = [
    { name: "inside Dhaka under the free threshold", items: [{ f: "A", p: 0, v: 0, q: 1 }], district: "Dhaka" },
    { name: "outside Dhaka", items: [{ f: "A", p: 1, v: 0, q: 2 }], district: "Sylhet" },
    { name: "free delivery over the threshold", items: [{ f: "A", p: 0, v: 0, q: 3 }], district: "Dhaka" },
    { name: "percentage coupon", items: [{ f: "A", p: 0, v: 0, q: 2 }], district: "Dhaka", coupon: "eid10" },
    { name: "fixed coupon", items: [{ f: "A", p: 2, v: 0, q: 1 }], district: "Chattogram", coupon: "FLAT200" },
    { name: "free-shipping coupon", items: [{ f: "A", p: 1, v: 1, q: 1 }], district: "Rajshahi", coupon: "SHIPFREE" },
    { name: "mixed lines", items: [{ f: "A", p: 0, v: 1, q: 1 }, { f: "A", p: 2, v: 0, q: 2 }], district: "Gazipur" },
  ];

  for (const s of scenarios) {
    it(`matches what createOrder charges: ${s.name}`, async () => {
      const items = s.items.map((i) => ({ variantId: vid(A, i.p, i.v), quantity: i.q }));
      const q = await quoteOrder(A.tenantId, { items, district: s.district, couponCode: s.coupon });
      const placed = await createOrder(A.tenantId, {
        idempotencyKey: `quote-parity-${++seq}-${Date.now()}`,
        customer: { name: "Parity Buyer", phone: phone() },
        shipping: { address: "House 1, Road 1", city: s.district, district: s.district, division: "Dhaka" },
        items, couponCode: s.coupon,
      });
      expect(q.total).toBe(placed.totalAmount);
    });
  }

  it("leaves delivery unknown until a district is given", async () => {
    const q = await quoteOrder(A.tenantId, { items: [{ variantId: vid(A), quantity: 1 }] });
    expect(q).toMatchObject({ subtotal: 1150, deliveryCharge: null, total: null, zone: null });
  });

  it("reports the zone, ETA and how far from free delivery", async () => {
    const q = await quoteOrder(A.tenantId, { items: [{ variantId: vid(A), quantity: 1 }], district: "dhaka" });
    expect(q.zone).toMatchObject({ name: "Inside Dhaka city", rate: 80, freeOverAmount: 3000 });
    expect(q.freeDeliveryRemaining).toBe(1850);
    const free = await quoteOrder(A.tenantId, { items: [{ variantId: vid(A), quantity: 3 }], district: "Dhaka" });
    expect(free.deliveryCharge).toBe(0);
    expect(free.freeDeliveryRemaining).toBeNull();
  });

  it("explains a refused coupon and still returns the quote without it", async () => {
    const q = await quoteOrder(A.tenantId, { items: [{ variantId: vid(A), quantity: 1 }], district: "Dhaka", couponCode: "EID10" });
    expect(q.couponError).toMatch(/Spend at least/);
    expect(q.couponCode).toBeNull();
    expect(q.total).toBe(1230);
    expect((await quoteOrder(A.tenantId, { items: [{ variantId: vid(A), quantity: 1 }], couponCode: "NOPE" })).couponError).toMatch(/not valid/);
  });

  it("flags unavailable and out-of-stock lines without throwing", async () => {
    const v = vid(A, 2, 1);
    await owner.productVariant.update({ where: { id: v }, data: { stockQuantity: 2 } });
    const q = await quoteOrder(A.tenantId, { items: [{ variantId: v, quantity: 5 }, { variantId: "ghost-variant-id", quantity: 1 }], district: "Dhaka" });
    expect(q.problems).toEqual(expect.arrayContaining([{ variantId: v, kind: "insufficient_stock", available: 2 }, { variantId: "ghost-variant-id", kind: "unavailable", available: 0 }]));
    expect(q.lines).toHaveLength(1);
    await owner.productVariant.update({ where: { id: v }, data: { stockQuantity: 1000 } });
  });

  it("cannot price another store's variant, and reserves nothing", async () => {
    const before = (await owner.productVariant.findUniqueOrThrow({ where: { id: vid(A) } })).stockQuantity;
    const q = await quoteOrder(A.tenantId, { items: [{ variantId: vid(B), quantity: 1 }, { variantId: vid(A), quantity: 4 }] });
    expect(q.problems.find((p) => p.variantId === vid(B))?.kind).toBe("unavailable");
    expect((await owner.productVariant.findUniqueOrThrow({ where: { id: vid(A) } })).stockQuantity).toBe(before);
  });

  it("handles an empty cart", async () => {
    expect(await quoteOrder(A.tenantId, { items: [], district: "Dhaka" })).toMatchObject({ lines: [], subtotal: 0 });
  });
});

describe("catalog read layer", () => {
  it("lists only active, undeleted products of this store", async () => {
    await owner.product.update({ where: { id: A.products[2]!.id }, data: { status: "DRAFT" } });
    const a = await listProducts(A.tenantId);
    expect(a.items.map((p) => p.title)).not.toContain("Slim Chino, Navy");
    expect(a.total).toBe(2);
    const b = await listProducts(B.tenantId);
    expect(b.items.every((p) => ![A.products[0]!.id].includes(p.id))).toBe(true);
    await owner.product.update({ where: { id: A.products[2]!.id }, data: { status: "ACTIVE" } });
  });

  it("treats % and _ typed by a shopper as plain characters, not wildcards", async () => {
    const id = A.products[0]!.id;
    const original = (await owner.product.findUniqueOrThrow({ where: { id } })).title;
    await owner.product.update({ where: { id }, data: { title: "100% Cotton_Panjabi" } });
    try {
      expect((await listProducts(A.tenantId, { query: "100%" })).items.map((p) => p.title)).toEqual(["100% Cotton_Panjabi"]);
      expect((await listProducts(A.tenantId, { query: "Cotton_P" })).items.map((p) => p.title)).toEqual(["100% Cotton_Panjabi"]);
      // A lone wildcard must not match everything.
      expect((await listProducts(A.tenantId, { query: "%" })).items.map((p) => p.title)).toEqual(["100% Cotton_Panjabi"]);
      expect((await listProducts(A.tenantId, { query: "Linen_Shirt" })).total).toBe(0);
    } finally {
      await owner.product.update({ where: { id }, data: { title: original } });
    }
  });

  it("searches, sorts and pages", async () => {
    expect((await listProducts(A.tenantId, { query: "linen" })).items.map((p) => p.title)).toEqual(["Linen Shirt, Sage"]);
    expect((await listProducts(A.tenantId, { query: "LINEN" })).total).toBe(1);
    const asc = (await listProducts(A.tenantId, { sort: "price_asc" })).items.map((p) => p.price);
    expect(asc).toEqual([...asc].sort((x, y) => x - y));
    const page2 = await listProducts(A.tenantId, { limit: 2, page: 2 });
    expect(page2.items).toHaveLength(1);
    expect(page2.total).toBe(3);
  });

  it("treats search input as data, not as a pattern", async () => {
    for (const q of ["%", "_", "'; DROP TABLE \"Product\"; --", "a".repeat(500)]) {
      await expect(listProducts(A.tenantId, { query: q })).resolves.toBeTruthy();
    }
    expect((await listProducts(A.tenantId)).total).toBe(3);
  });

  it("a % or _ in the search matches only a literal % or _, not everything", async () => {
    for (const q of ["%", "_", "%%", "l_nen", "lin%"]) expect((await listProducts(A.tenantId, { query: q })).total, q).toBe(0);
    expect((await listProducts(A.tenantId, { query: "linen" })).total).toBe(1);
  });

  it("returns a product with variants, stock and related items, and null for unknown or other stores' slugs", async () => {
    const p = await getProductBySlug(A.tenantId, "cotton-panjabi-off-white");
    expect(p?.variants.map((v) => v.title)).toEqual(["M", "L", "XL"]);
    expect(p?.related.length).toBeGreaterThan(0);
    expect(p?.rating).toBeNull();
    expect(await getProductBySlug(A.tenantId, "nope")).toBeNull();
    const cat = await owner.category.findFirstOrThrow({ where: { tenantId: B.tenantId } });
    expect((await listCategories(B.tenantId)).map((c) => c.id)).toContain(cat.id);
    expect((await listCategories(A.tenantId)).map((c) => c.id)).not.toContain(cat.id);
  });

  it("summarises reviews", async () => {
    // One review per customer per product, so two ratings need two customers.
    for (const rating of [5, 4]) {
      const c = await owner.customer.create({ data: { tenantId: A.tenantId, name: "R", phone: phone() } });
      await owner.review.create({ data: { tenantId: A.tenantId, productId: A.products[0]!.id, customerId: c.id, rating, body: "ok" } });
    }
    expect((await getProductBySlug(A.tenantId, "cotton-panjabi-off-white"))?.rating).toEqual({ average: 4.5, count: 2 });
  });

  it("store info and theme settings fall back to sensible defaults", async () => {
    expect((await getStoreInfo(A.tenantId)).storeName).toBe("Shop A");
    const k = await getKaporSettings(A.tenantId);
    expect(k).toMatchObject({ heroTitle: KAPOR_DEFAULTS.heroTitle, freeDeliveryOver: 3000 });
    await owner.storeSettings.create({ data: { tenantId: B.tenantId, storeName: "Shop B Fashion", bkashNumber: "01712345678" } });
    await owner.themeInstall.create({ data: { tenantId: B.tenantId, themeId: "kapor", isActive: true, settings: { heroTitle: "Custom headline" }, pagesJson: {} } });
    expect(await getStoreInfo(B.tenantId)).toMatchObject({ storeName: "Shop B Fashion", bkashNumber: "01712345678" });
    expect(await getKaporSettings(B.tenantId)).toMatchObject({ heroTitle: "Custom headline", heroCta: KAPOR_DEFAULTS.heroCta });
    expect((await getStoreInfo(A.tenantId)).bkashNumber).toBeNull();
  });
});

describe("customer sign-in", () => {
  it("sends a 6-digit code and signs the customer in with it, once", async () => {
    const p = phone();
    const r = await requestOtp(A.tenantId, p, { storeName: "Shop A" });
    expect(r).toEqual({ sent: true, expiresInSeconds: 300 });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.text).toMatch(/^\d{6} is your Shop A sign-in code/);
    const code = lastCode(p);
    const who = await verifyOtp(A.tenantId, p, code);
    expect(who.phone).toBe(p);
    await expect(verifyOtp(A.tenantId, p, code)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await owner.customer.count({ where: { tenantId: A.tenantId, phone: p } })).toBe(1);
  });

  it("accepts the number in any common format, and the code with spaces", async () => {
    const p = phone();
    await requestOtp(A.tenantId, `+88 ${p.slice(0, 5)}-${p.slice(5)}`);
    expect(sent[0]!.to).toBe(p);
    expect((await verifyOtp(A.tenantId, `88${p}`, lastCode(p).replace(/(\d{3})(\d{3})/, "$1 $2"))).phone).toBe(p);
  });

  it("stores only a hash of the code", async () => {
    const p = phone();
    await requestOtp(A.tenantId, p);
    const row = await owner.customerOtp.findFirstOrThrow({ where: { tenantId: A.tenantId, phone: p } });
    expect(row.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(row)).not.toContain(lastCode(p));
  });

  it("kills a code after 5 wrong guesses, even if the right one comes next", async () => {
    const p = phone();
    await requestOtp(A.tenantId, p);
    const good = lastCode(p);
    const wrong = good === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await expect(verifyOtp(A.tenantId, p, wrong)).rejects.toThrow();
    await expect(verifyOtp(A.tenantId, p, good)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("parallel guesses cannot beat the attempt limit", async () => {
    const p = phone();
    await requestOtp(A.tenantId, p);
    const good = lastCode(p);
    const wrong = good === "123456" ? "654321" : "123456";
    await Promise.allSettled(Array.from({ length: 20 }, () => verifyOtp(A.tenantId, p, wrong)));
    await expect(verifyOtp(A.tenantId, p, good)).rejects.toThrow();
  });

  it("rejects an expired code and a code for another number or another store", async () => {
    const p = phone();
    await requestOtp(A.tenantId, p);
    const code = lastCode(p);
    await expect(verifyOtp(A.tenantId, phone(), code)).rejects.toThrow();
    await expect(verifyOtp(B.tenantId, p, code)).rejects.toThrow();
    await owner.customerOtp.updateMany({ where: { tenantId: A.tenantId, phone: p }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(verifyOtp(A.tenantId, p, code)).rejects.toThrow();
  });

  it("a newer code replaces the older one", async () => {
    const p = phone();
    await requestOtp(A.tenantId, p);
    const first = lastCode(p);
    await requestOtp(A.tenantId, p);
    const second = lastCode(p);
    if (first !== second) await expect(verifyOtp(A.tenantId, p, first)).rejects.toThrow();
    await expect(verifyOtp(A.tenantId, p, second)).resolves.toBeTruthy();
  });

  it("limits codes per phone and per IP", async () => {
    const p = phone();
    for (let i = 0; i < 3; i++) await requestOtp(A.tenantId, p);
    await expect(requestOtp(A.tenantId, p)).rejects.toBeInstanceOf(RateLimitError);
    expect(sent.filter((s) => s.to === p)).toHaveLength(3);
    for (let i = 0; i < 10; i++) await requestOtp(A.tenantId, phone(), { ip: "203.0.113.9" });
    await expect(requestOtp(A.tenantId, phone(), { ip: "203.0.113.9" })).rejects.toMatchObject({ code: "RATE_LIMITED", httpStatus: 429 });
    await expect(requestOtp(A.tenantId, phone(), { ip: "203.0.113.10" })).resolves.toBeTruthy();
  });

  it("looks the same for blocked numbers but sends nothing", async () => {
    const p = phone();
    await owner.blockedContact.create({ data: { tenantId: A.tenantId, phone: p, reason: "refused parcels" } });
    expect(await requestOtp(A.tenantId, p)).toEqual({ sent: true, expiresInSeconds: 300 });
    expect(sent).toHaveLength(0);
  });

  it("rejects bad numbers and malformed codes", async () => {
    await expect(requestOtp(A.tenantId, "12345")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(verifyOtp(A.tenantId, phone(), "12ab56")).rejects.toBeInstanceOf(DomainError);
    await expect(verifyOtp(A.tenantId, "bad", "123456")).rejects.toBeInstanceOf(DomainError);
  });
});

describe("customer session cookie", () => {
  const T = "tenant-aaaaaaaa";

  it("round-trips for the store it was issued for", () => {
    const token = signCustomerSession({ tenantId: T, customerId: "cust-1" });
    expect(readCustomerSession(token, T)).toMatchObject({ tenantId: T, customerId: "cust-1" });
  });

  it("is rejected on another store, when expired, tampered with, or malformed", () => {
    const now = Date.now();
    const token = signCustomerSession({ tenantId: T, customerId: "cust-1" }, now);
    expect(readCustomerSession(token, "tenant-bbbbbbbb")).toBeNull();
    expect(readCustomerSession(token, T, now + 31 * 24 * 3600 * 1000)).toBeNull();
    const [payload, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ tenantId: T, customerId: "someone-else", exp: 9999999999 })).toString("base64url");
    expect(readCustomerSession(`${forged}.${sig}`, T)).toBeNull();
    expect(readCustomerSession(`${payload}.${sig!.slice(0, -2)}xx`, T)).toBeNull();
    for (const bad of [undefined, null, "", "abc", "a.b", "..", `${payload}`, "x".repeat(3000)]) expect(readCustomerSession(bad as string, T)).toBeNull();
  });

  it("a token signed with a different key is rejected", () => {
    const token = signCustomerSession({ tenantId: T, customerId: "c" }, Date.now(), "another-key-another-key-another-key-123");
    expect(readCustomerSession(token, T)).toBeNull();
  });
});

describe("order access links", () => {
  it("accepts the token for that order in that store only", () => {
    const t = signOrderAccess("tenant-aaaaaaaa", "order-1");
    expect(verifyOrderAccess("tenant-aaaaaaaa", "order-1", t)).toBe(true);
    expect(verifyOrderAccess("tenant-aaaaaaaa", "order-2", t)).toBe(false);
    expect(verifyOrderAccess("tenant-bbbbbbbb", "order-1", t)).toBe(false);
    for (const bad of [undefined, null, "", "x", t.slice(0, -1), `${t}x`, "a".repeat(200)]) expect(verifyOrderAccess("tenant-aaaaaaaa", "order-1", bad as string)).toBe(false);
    expect(verifyOrderAccess("tenant-aaaaaaaa", "order-1", signOrderAccess("tenant-aaaaaaaa", "order-1", "another-key-another-key-another-key-123"))).toBe(false);
  });
});

describe("account data", () => {
  it("lists a customer's own orders only", async () => {
    const p = phone();
    const placed = await createOrder(A.tenantId, {
      idempotencyKey: `acct-${Date.now()}-${++seq}`, customer: { name: "Acct Buyer", phone: p },
      shipping: { address: "House 1, Road 1", city: "Dhaka", district: "Dhaka", division: "Dhaka" }, items: [{ variantId: vid(A), quantity: 2 }],
    });
    const who = await verifyOtpFor(p);
    const acct = await getAccount(A.tenantId, who.customerId);
    expect(acct?.orders.map((o) => o.orderNumber)).toEqual([placed.orderNumber]);
    expect(acct?.orders[0]).toMatchObject({ itemCount: 2, status: "PENDING" });
    expect(await getAccount(B.tenantId, who.customerId)).toBeNull();
  });

  async function verifyOtpFor(p: string) {
    await requestOtp(A.tenantId, p);
    return verifyOtp(A.tenantId, p, lastCode(p));
  }
});
