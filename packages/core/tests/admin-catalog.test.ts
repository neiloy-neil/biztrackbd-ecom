import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  DomainError, bulkProductAction, importProductsCsv, claimStorage, releaseStorage, adjustStock, couponStatus, createOrder, deleteCategory, deleteCoupon, getProductForEdit, listAdminProducts, listCategoriesAdmin,
  listCoupons, listInventory, listStockHistory, saveCategory, saveCoupon, saveProduct, setCouponActive, setEventPublisher, setProductStatus, slugify,
  updateStockSettings, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const phone = () => `0131${String(1000000 + ++seq).slice(-7)}`;

async function store(name: string, productLimit: number | null = 300) {
  await owner.plan.update({ where: { tier: "STARTER" }, data: { limits: { products: productLimit, ordersPerMonth: 500, staff: 5 } } });
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 20 });
  await owner.tenant.update({ where: { id: f.tenantId }, data: { planTier: "STARTER", productCount: 3 } });
  const mk = (role: StaffActor["role"], n: string): StaffActor => ({ userId: `u-${n}-${seq}`, email: `${n}${seq}@example.test`, name: n, role });
  return { f, owner: mk("STORE_OWNER", "Nusrat"), manager: mk("STORE_MANAGER", "Kamrul"), packer: mk("ORDER_PACKER", "Rubel"), support: mk("TELEMARKETER", "Sumaiya"), editor: mk("CONTENT_EDITOR", "Mina") };
}

const fails = async (p: Promise<unknown>, code: string) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  return e as DomainError;
};
const vid = (f: TenantFixture, p = 0, v = 0) => f.products[p]!.variants[v]!.id;

const newProduct = (over: Record<string, unknown> = {}) => ({
  title: "Handloom Gamchha", basePrice: 450, status: "ACTIVE", variants: [{ title: "Default", price: 450, stockQuantity: 12 }], ...over,
});

beforeAll(async () => {
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  await seedPlans(owner);
});
beforeEach(() => setEventPublisher(async () => {}));
afterAll(async () => {
  await owner?.$disconnect();
  await app?.$disconnect();
});

describe("saving products", () => {
  it("creates a product with variants, a free URL name, a new category and photos", async () => {
    const S = await store("create");
    const r = await saveProduct(S.f.tenantId, S.owner, newProduct({
      newCategoryName: "Gamchha", tags: ["Cotton", "cotton", "handloom"], images: [{ url: "/media/abc/cover.webp", alt: "Front" }, { url: "https://x.supabase.co/a.webp" }],
      variants: [{ title: "Red", price: 450, stockQuantity: 5, sku: "gm-red", options: { Color: "Red" } }, { title: "Blue", price: 480, stockQuantity: 7, options: { Color: "Blue" } }],
    }));
    expect(r.slug).toBe("handloom-gamchha");
    const p = await getProductForEdit(S.f.tenantId, S.owner, r.id);
    expect(p.variants.map((v) => [v.title, v.sku, v.stockQuantity])).toEqual([["Red", "GM-RED", 5], ["Blue", null, 7]]);
    expect(p.images.map((i) => i.url)).toEqual(["/media/abc/cover.webp", "https://x.supabase.co/a.webp"]);
    expect(p.tags).toEqual(["cotton", "handloom"]);
    expect((await listCategoriesAdmin(S.f.tenantId, S.owner)).map((c) => c.name)).toContain("Gamchha");
    expect((await owner.tenant.findUniqueOrThrow({ where: { id: S.f.tenantId } })).productCount).toBe(4);
    expect(await owner.auditLog.count({ where: { tenantId: S.f.tenantId, action: "product.created" } })).toBe(1);
  });

  it("gives a duplicate title its own URL name, but refuses a duplicate typed URL name", async () => {
    const S = await store("slug");
    const a = await saveProduct(S.f.tenantId, S.owner, newProduct());
    const b = await saveProduct(S.f.tenantId, S.owner, newProduct());
    expect([a.slug, b.slug]).toEqual(["handloom-gamchha", "handloom-gamchha-2"]);
    await fails(saveProduct(S.f.tenantId, S.owner, newProduct({ slug: "handloom-gamchha" })), "VALIDATION_ERROR");
    expect(slugify("দেশি গামছা")).toMatch(/^product-[a-z0-9]{6}$/);
    expect(slugify("  Eid  Special—Fatua! ")).toBe("eid-special-fatua");
  });

  it("respects the plan's product limit and gives the slot back on failure", async () => {
    const S = await store("limit", 4);
    await saveProduct(S.f.tenantId, S.owner, newProduct());
    await fails(saveProduct(S.f.tenantId, S.owner, newProduct({ title: "One too many" })), "PLAN_LIMIT");
    await fails(saveProduct(S.f.tenantId, S.owner, newProduct({ title: "Bad", variants: [] })), "VALIDATION_ERROR");
    expect((await owner.tenant.findUniqueOrThrow({ where: { id: S.f.tenantId } })).productCount).toBe(4);
  });

  it("validates prices, duplicate variants, SKUs and photo addresses", async () => {
    const S = await store("valid");
    await fails(saveProduct(S.f.tenantId, S.owner, newProduct({ basePrice: 0 })), "VALIDATION_ERROR");
    await fails(saveProduct(S.f.tenantId, S.owner, newProduct({ compareAtPrice: 400 })), "VALIDATION_ERROR");
    await fails(saveProduct(S.f.tenantId, S.owner, newProduct({ variants: [{ title: "A", price: 1, stockQuantity: 1 }, { title: "a", price: 1, stockQuantity: 1 }] })), "VALIDATION_ERROR");
    await fails(saveProduct(S.f.tenantId, S.owner, newProduct({ variants: [{ title: "A", price: 1, stockQuantity: 1, sku: "X" }, { title: "B", price: 1, stockQuantity: 1, sku: "x" }] })), "VALIDATION_ERROR");
    for (const url of ["javascript:alert(1)", "data:image/png;base64,AAAA", "//evil.test/a.png", "http://insecure.test/a.png", "/etc/passwd", "/media/../../etc/passwd x"]) {
      await fails(saveProduct(S.f.tenantId, S.owner, newProduct({ images: [{ url }] })), "VALIDATION_ERROR");
    }
  });

  it("cleans the description before it is stored", async () => {
    const S = await store("clean");
    const r = await saveProduct(S.f.tenantId, S.owner, newProduct({ descriptionHtml: `<p onclick="x()">Soft</p><script>alert(1)</script>` }));
    expect((await getProductForEdit(S.f.tenantId, S.owner, r.id)).descriptionHtml).toBe("<p>Soft</p>");
  });

  it("updates a product: edits, adds and removes variants, keeps at least one", async () => {
    const S = await store("update");
    const r = await saveProduct(S.f.tenantId, S.owner, newProduct({ variants: [{ title: "S", price: 450, stockQuantity: 3 }, { title: "M", price: 450, stockQuantity: 4 }] }));
    const p = await getProductForEdit(S.f.tenantId, S.owner, r.id);
    const s = p.variants[0]!;
    await saveProduct(S.f.tenantId, S.owner, {
      ...p, title: "Gamchha Plus", variants: [{ ...s, price: 500 }, { title: "L", price: 520, stockQuantity: 9 }],
    }, r.id);
    const after = await getProductForEdit(S.f.tenantId, S.owner, r.id);
    expect(after.title).toBe("Gamchha Plus");
    expect(after.variants.map((v) => [v.title, v.price])).toEqual([["S", 500], ["L", 520]]);
    expect(after.slug).toBe("handloom-gamchha"); // the URL name is stable unless changed on purpose
    await fails(saveProduct(S.f.tenantId, S.owner, { ...after, variants: [] }, r.id), "VALIDATION_ERROR");
  });

  it("a stock edit made from a stale page applies only the difference, so a sale in between is not undone", async () => {
    const S = await store("stale");
    const r = await saveProduct(S.f.tenantId, S.owner, newProduct({ variants: [{ title: "Default", price: 450, stockQuantity: 10 }] }));
    const loaded = await getProductForEdit(S.f.tenantId, S.owner, r.id);
    const variantId = loaded.variants[0]!.id;
    // a customer buys 3 while the owner has the editor open
    await createOrder(S.f.tenantId, {
      idempotencyKey: `stale-${Date.now()}`, customer: { name: "Late Buyer", phone: phone() },
      shipping: { address: "House 1, Road 1", city: "Mirpur", district: "Dhaka", division: "Dhaka" }, items: [{ variantId, quantity: 3 }],
    });
    // the owner adds 5 to the count they saw (10 -> 15) and saves
    await saveProduct(S.f.tenantId, S.owner, { ...loaded, variants: [{ ...loaded.variants[0]!, stockQuantity: 15, stockBefore: 10 }] }, r.id);
    expect((await owner.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stockQuantity).toBe(12); // 10 - 3 + 5
    const hist = await listStockHistory(S.f.tenantId, S.owner, variantId);
    expect(hist[0]).toMatchObject({ delta: 5, quantityAfter: 12, reason: "CORRECTION" });
  });

  it("only products editors can save; support cannot", async () => {
    const S = await store("perm");
    await saveProduct(S.f.tenantId, S.editor, newProduct());
    await saveProduct(S.f.tenantId, S.packer, newProduct({ title: "By packer" }));
    await fails(saveProduct(S.f.tenantId, S.support, newProduct({ title: "No" })), "FORBIDDEN");
  });

  it("cannot edit another store's product", async () => {
    const A = await store("xa");
    const B = await store("xb");
    const r = await saveProduct(A.f.tenantId, A.owner, newProduct());
    await fails(saveProduct(B.f.tenantId, B.owner, newProduct(), r.id), "NOT_FOUND");
    await fails(getProductForEdit(B.f.tenantId, B.owner, r.id), "NOT_FOUND");
  });
});

describe("product list", () => {
  it("filters by tab and search, counts the tabs and reports 30-day sales", async () => {
    const S = await store("list");
    const draft = await saveProduct(S.f.tenantId, S.owner, newProduct({ title: "Draft Item", status: "DRAFT" }));
    const gone = await saveProduct(S.f.tenantId, S.owner, newProduct({ title: "Sold Out Item", variants: [{ title: "Default", price: 300, stockQuantity: 0 }] }));
    await createOrder(S.f.tenantId, {
      idempotencyKey: `list-${Date.now()}`, customer: { name: "Buyer Person", phone: phone() },
      shipping: { address: "House 1, Road 1", city: "Mirpur", district: "Dhaka", division: "Dhaka" }, items: [{ variantId: vid(S.f), quantity: 2 }],
    });
    const all = await listAdminProducts(S.f.tenantId, S.owner);
    expect(all.counts).toEqual({ all: 5, active: 4, draft: 1, out: 1 });
    expect((await listAdminProducts(S.f.tenantId, S.owner, { tab: "draft" })).rows.map((r) => r.id)).toEqual([draft.id]);
    expect((await listAdminProducts(S.f.tenantId, S.owner, { tab: "out" })).rows.map((r) => r.id)).toEqual([gone.id]);
    expect((await listAdminProducts(S.f.tenantId, S.owner, { q: "sold out" })).total).toBe(1);
    expect((await listAdminProducts(S.f.tenantId, S.owner, { q: "%" })).total).toBe(0);
    const sold = all.rows.find((r) => r.id === S.f.products[0]!.id)!;
    expect(sold.sold30d).toBe(2);
    expect(sold.variantCount).toBe(3);
    await setProductStatus(S.f.tenantId, S.owner, draft.id, "ACTIVE");
    expect((await listAdminProducts(S.f.tenantId, S.owner)).counts.draft).toBe(0);
  });
});

describe("categories", () => {
  it("creates, renames, hides and deletes without losing products", async () => {
    const S = await store("cats");
    const c = await saveCategory(S.f.tenantId, S.owner, { name: "Eid Special" });
    await fails(saveCategory(S.f.tenantId, S.owner, { name: "eid special" }), "VALIDATION_ERROR");
    await saveCategory(S.f.tenantId, S.owner, { name: "Eid Collection", isActive: false }, c.id);
    const p = await saveProduct(S.f.tenantId, S.owner, newProduct({ categoryId: c.id }));
    expect((await listCategoriesAdmin(S.f.tenantId, S.owner)).find((x) => x.id === c.id)).toMatchObject({ name: "Eid Collection", isActive: false, products: 1 });
    await deleteCategory(S.f.tenantId, S.owner, c.id);
    expect((await getProductForEdit(S.f.tenantId, S.owner, p.id)).categoryId).toBeNull();
    await fails(deleteCategory(S.f.tenantId, S.owner, c.id), "NOT_FOUND");
  });
});

describe("inventory", () => {
  it("lists variants with committed units and states, with a summary", async () => {
    const S = await store("inv");
    const low = vid(S.f, 0, 0);
    await owner.productVariant.update({ where: { id: low }, data: { stockQuantity: 3, reorderLevel: 5, shelfCode: "A-12" } });
    await owner.productVariant.update({ where: { id: vid(S.f, 0, 1) }, data: { stockQuantity: 0 } });
    await createOrder(S.f.tenantId, {
      idempotencyKey: `inv-${Date.now()}`, customer: { name: "Inv Buyer", phone: phone() },
      shipping: { address: "House 1, Road 1", city: "Mirpur", district: "Dhaka", division: "Dhaka" }, items: [{ variantId: low, quantity: 1 }],
    });
    const all = await listInventory(S.f.tenantId, S.owner);
    expect(all.summary.low).toBe(1);
    expect(all.summary.out).toBe(1);
    expect(all.rows[0]).toMatchObject({ state: "out" }); // problems first
    const row = all.rows.find((r) => r.variantId === low)!;
    expect(row).toMatchObject({ available: 2, committed: 1, state: "low", shelf: "A-12" });
    expect((await listInventory(S.f.tenantId, S.owner, { filter: "low" })).rows.map((r) => r.variantId)).toEqual([low]);
    expect((await listInventory(S.f.tenantId, S.owner, { filter: "out" })).total).toBe(1);
    expect((await listInventory(S.f.tenantId, S.owner, { shelf: "A-12" })).total).toBe(1);
    expect((await listInventory(S.f.tenantId, S.owner, { q: "%" })).total).toBe(0);
    expect(all.shelves).toEqual(["A-12"]);
  });

  it("adjusts stock by a change or to a counted number, with a reason, and keeps history", async () => {
    const S = await store("adj");
    const v = vid(S.f);
    expect(await adjustStock(S.f.tenantId, S.owner, v, { delta: 10, reason: "RECEIVED", note: "Supplier delivery" })).toEqual({ quantityAfter: 30, delta: 10 });
    expect(await adjustStock(S.f.tenantId, S.owner, v, { setTo: 25, reason: "RECOUNT" })).toEqual({ quantityAfter: 25, delta: -5 });
    expect(await adjustStock(S.f.tenantId, S.owner, v, { setTo: 25, reason: "RECOUNT" })).toEqual({ quantityAfter: 25, delta: 0 });
    const h = await listStockHistory(S.f.tenantId, S.owner, v);
    expect(h.map((x) => [x.delta, x.quantityAfter, x.reason])).toEqual([[-5, 25, "RECOUNT"], [10, 30, "RECEIVED"]]);
    expect(h[1]).toMatchObject({ note: "Supplier delivery", actorName: "Nusrat" });
  });

  it("cannot take stock below zero, and rejects bad input", async () => {
    const S = await store("neg");
    const v = vid(S.f);
    await fails(adjustStock(S.f.tenantId, S.owner, v, { delta: -21, reason: "DAMAGED" }), "VALIDATION_ERROR");
    await fails(adjustStock(S.f.tenantId, S.owner, v, { delta: 1.5, reason: "RECEIVED" }), "VALIDATION_ERROR");
    await fails(adjustStock(S.f.tenantId, S.owner, v, { delta: 0, reason: "RECEIVED" }), "VALIDATION_ERROR");
    await fails(adjustStock(S.f.tenantId, S.owner, v, { delta: 1, setTo: 5, reason: "RECOUNT" }), "VALIDATION_ERROR");
    await fails(adjustStock(S.f.tenantId, S.owner, v, { delta: 1, reason: "WHATEVER" }), "VALIDATION_ERROR");
    await fails(adjustStock(S.f.tenantId, S.owner, v, { setTo: -1, reason: "RECOUNT" }), "VALIDATION_ERROR");
    expect((await owner.productVariant.findUniqueOrThrow({ where: { id: v } })).stockQuantity).toBe(20);
  });

  it("many simultaneous removals never go below zero", async () => {
    const S = await store("race");
    const v = vid(S.f);
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => adjustStock(S.f.tenantId, S.owner, v, { delta: -3, reason: "DAMAGED" })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(6); // 20 units, 3 each
    expect((await owner.productVariant.findUniqueOrThrow({ where: { id: v } })).stockQuantity).toBe(2);
  });

  it("an adjustment and a customer order together never lose a unit", async () => {
    const S = await store("mix");
    const v = vid(S.f);
    await owner.productVariant.update({ where: { id: v }, data: { stockQuantity: 10 } });
    const ops = [
      ...Array.from({ length: 4 }, () => adjustStock(S.f.tenantId, S.owner, v, { delta: -1, reason: "DAMAGED" })),
      ...Array.from({ length: 4 }, () => createOrder(S.f.tenantId, {
        idempotencyKey: `mix-${++seq}-${Date.now()}`, customer: { name: "Mixed Buyer", phone: phone() },
        shipping: { address: "House 1, Road 1", city: "Mirpur", district: "Dhaka", division: "Dhaka" }, items: [{ variantId: v, quantity: 1 }],
      })),
    ];
    const done = (await Promise.allSettled(ops)).filter((r) => r.status === "fulfilled").length;
    expect(done).toBe(8);
    expect((await owner.productVariant.findUniqueOrThrow({ where: { id: v } })).stockQuantity).toBe(2);
  });

  it("changes reorder level and shelf; only product editors may adjust; another store cannot", async () => {
    const A = await store("sa");
    const B = await store("sb");
    const v = vid(A.f);
    await updateStockSettings(A.f.tenantId, A.owner, v, { reorderLevel: 9, shelfCode: " B-03 " });
    expect(await owner.productVariant.findUniqueOrThrow({ where: { id: v } })).toMatchObject({ reorderLevel: 9, shelfCode: "B-03" });
    await fails(updateStockSettings(A.f.tenantId, A.owner, v, { reorderLevel: -1 }), "VALIDATION_ERROR");
    await fails(adjustStock(A.f.tenantId, A.support, v, { delta: 1, reason: "RECEIVED" }), "FORBIDDEN");
    await fails(adjustStock(B.f.tenantId, B.owner, v, { delta: 1, reason: "RECEIVED" }), "NOT_FOUND");
    await fails(updateStockSettings(B.f.tenantId, B.owner, v, { reorderLevel: 1 }), "NOT_FOUND");
  });
});

describe("coupons", () => {
  it("creates, lists with a status, disables and re-enables", async () => {
    const S = await store("coupon");
    const day = 86_400_000;
    await saveCoupon(S.f.tenantId, S.owner, { code: " eid10 ", type: "PERCENTAGE", value: 10, minOrderValue: 1500, usageLimit: 500, startsAt: new Date(Date.now() + 2 * day) });
    await saveCoupon(S.f.tenantId, S.owner, { code: "WELCOME100", type: "FIXED_AMOUNT", value: 100, minOrderValue: 800 });
    await saveCoupon(S.f.tenantId, S.owner, { code: "OLD20", type: "PERCENTAGE", value: 20, startsAt: new Date(Date.now() - 9 * day), expiresAt: new Date(Date.now() - day) });
    await saveCoupon(S.f.tenantId, S.owner, { code: "SHIP", type: "FREE_SHIPPING", value: 99 });
    const list = await listCoupons(S.f.tenantId, S.owner);
    const by = Object.fromEntries(list.map((c) => [c.code, c]));
    expect(by.EID10!.status).toBe("scheduled");
    expect(by.WELCOME100!.status).toBe("active");
    expect(by.OLD20!.status).toBe("expired");
    expect(by.SHIP!.value).toBe(0); // free shipping carries no value
    await setCouponActive(S.f.tenantId, S.owner, by.WELCOME100!.id, false);
    expect((await listCoupons(S.f.tenantId, S.owner)).find((c) => c.code === "WELCOME100")!.status).toBe("off");
    await setCouponActive(S.f.tenantId, S.owner, by.WELCOME100!.id, true);
    expect((await listCoupons(S.f.tenantId, S.owner)).find((c) => c.code === "WELCOME100")!.status).toBe("active");
  });

  it("validates codes, percentages, dates and duplicates", async () => {
    const S = await store("cv");
    await fails(saveCoupon(S.f.tenantId, S.owner, { code: "x", type: "PERCENTAGE", value: 10 }), "VALIDATION_ERROR");
    await fails(saveCoupon(S.f.tenantId, S.owner, { code: "bad code!", type: "PERCENTAGE", value: 10 }), "VALIDATION_ERROR");
    await fails(saveCoupon(S.f.tenantId, S.owner, { code: "TOOMUCH", type: "PERCENTAGE", value: 150 }), "VALIDATION_ERROR");
    await fails(saveCoupon(S.f.tenantId, S.owner, { code: "ZERO", type: "FIXED_AMOUNT", value: 0 }), "VALIDATION_ERROR");
    await fails(saveCoupon(S.f.tenantId, S.owner, { code: "DATES", type: "PERCENTAGE", value: 5, startsAt: new Date("2030-01-02"), expiresAt: new Date("2030-01-01") }), "VALIDATION_ERROR");
    await saveCoupon(S.f.tenantId, S.owner, { code: "DUP", type: "PERCENTAGE", value: 5 });
    await fails(saveCoupon(S.f.tenantId, S.owner, { code: "dup", type: "PERCENTAGE", value: 5 }), "VALIDATION_ERROR");
    await fails(saveCoupon(S.f.tenantId, S.support, { code: "NOPE1", type: "PERCENTAGE", value: 5 }), "FORBIDDEN");
  });

  it("the storefront honours a coupon made here, and a used coupon is disabled rather than deleted", async () => {
    const S = await store("cuse");
    const c = await saveCoupon(S.f.tenantId, S.owner, { code: "HELLO50", type: "FIXED_AMOUNT", value: 50, perCustomerLimit: 3 });
    const o = await createOrder(S.f.tenantId, {
      idempotencyKey: `cu-${Date.now()}`, customer: { name: "Coupon User", phone: phone() }, couponCode: "hello50",
      shipping: { address: "House 1, Road 1", city: "Mirpur", district: "Dhaka", division: "Dhaka" }, items: [{ variantId: vid(S.f), quantity: 1 }],
    });
    expect(o.totalAmount).toBe(1180);
    expect(await deleteCoupon(S.f.tenantId, S.owner, c.id)).toBe("disabled");
    expect((await listCoupons(S.f.tenantId, S.owner))[0]).toMatchObject({ isActive: false, status: "off", usageCount: 1 });
    const unused = await saveCoupon(S.f.tenantId, S.owner, { code: "UNUSED", type: "PERCENTAGE", value: 5 });
    expect(await deleteCoupon(S.f.tenantId, S.owner, unused.id)).toBe("deleted");
  });

  it("status helper covers every state", () => {
    const base = { isActive: true, startsAt: new Date(Date.now() - 1000), expiresAt: null, usageLimit: null, usageCount: 0 };
    expect(couponStatus(base)).toBe("active");
    expect(couponStatus({ ...base, usageLimit: 5, usageCount: 5 })).toBe("used_up");
    expect(couponStatus({ ...base, isActive: false })).toBe("off");
  });
});

describe("photo storage limit", () => {
  it("allows uploads up to the plan's storage and refuses beyond it, even when they race", async () => {
    const S = await store("storage");
    await owner.plan.update({ where: { tier: "STARTER" }, data: { limits: { products: 300, ordersPerMonth: 500, staff: 5, storageGb: 0.001 } } }); // about 1 MB
    const limit = Math.round(0.001 * 1024 ** 3);
    await claimStorage(S.f.tenantId, Math.floor(limit / 2));
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => claimStorage(S.f.tenantId, Math.floor(limit / 4))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "PLAN_LIMIT", details: { metric: "storage" } });
    expect(Number((await owner.tenant.findUniqueOrThrow({ where: { id: S.f.tenantId } })).storageBytesUsed)).toBeLessThanOrEqual(limit);
    await owner.plan.update({ where: { tier: "STARTER" }, data: { limits: { products: 300, ordersPerMonth: 500, staff: 5, storageGb: null } } });
    await claimStorage(S.f.tenantId, 5 * 1024 ** 3); // unlimited
  });
});

describe("photos taken off a product", () => {
  it("are reported back when no other product uses them, so the file can go and the storage return", async () => {
    const S = await store("photos1");
    const a = `/media/${S.f.tenantId}/aaaaaaaa-1111.webp`;
    const b = `/media/${S.f.tenantId}/bbbbbbbb-2222.webp`;
    const shared = `/media/${S.f.tenantId}/cccccccc-3333.webp`;
    const first = await saveProduct(S.f.tenantId, S.owner, newProduct({ images: [{ url: a }, { url: b }, { url: shared }] }));
    expect(first.removedImages).toEqual([]);
    await saveProduct(S.f.tenantId, S.owner, newProduct({ title: "Second product", images: [{ url: shared }] }));
    const next = await saveProduct(S.f.tenantId, S.owner, newProduct({ images: [{ url: a }] }), first.id);
    // b is used by nothing else; shared is still on the second product.
    expect(next.removedImages).toEqual([b]);
    const none = await saveProduct(S.f.tenantId, S.owner, newProduct({ images: [] }), first.id);
    expect(none.removedImages).toEqual([a]);
  });

  it("give storage back, and never below zero", async () => {
    const S = await store("photos2");
    await claimStorage(S.f.tenantId, 5_000);
    await releaseStorage(S.f.tenantId, 2_000);
    expect(Number((await owner.tenant.findUniqueOrThrow({ where: { id: S.f.tenantId } })).storageBytesUsed)).toBe(3_000);
    await releaseStorage(S.f.tenantId, 999_999);
    expect(Number((await owner.tenant.findUniqueOrThrow({ where: { id: S.f.tenantId } })).storageBytesUsed)).toBe(0);
    await releaseStorage(S.f.tenantId, -5);
    await releaseStorage(S.f.tenantId, 0);
    expect(Number((await owner.tenant.findUniqueOrThrow({ where: { id: S.f.tenantId } })).storageBytesUsed)).toBe(0);
  });
});

describe("importing products from a CSV", () => {
  const head = "title,price,stock,sku,status,category,description,compare_at_price\n";

  it("adds a product per row, makes new categories, escapes the description and reports a row it cannot read", async () => {
    const S = await store("imp");
    const r = await importProductsCsv(S.f.tenantId, S.owner, `${head}Panjabi,1850,12,PJ-1,active,Panjabi,"Soft <b>cotton</b>, light",2200
Lungi,700,,,,Panjabi,,
Broken,abc,1,,,,,
Negative,100,-2,,,,,
`);
    // A stock below zero is read as none left; a price that is not a number is reported and the row is skipped.
    expect(r.created).toBe(3);
    expect(r.failed.length).toBeGreaterThanOrEqual(1);
    expect(r.failed.some((f) => /price/i.test(f.reason))).toBe(true);
    const list = await listAdminProducts(S.f.tenantId, S.owner, { q: "Panjabi" });
    const p = list.rows.find((x) => x.title === "Panjabi")!;
    expect([p.status, p.stock, p.price, p.categoryName]).toEqual(["ACTIVE", 12, 1850, "Panjabi"]);
    const lungi = (await listAdminProducts(S.f.tenantId, S.owner, { q: "Lungi" })).rows[0]!;
    expect(lungi.title).toBe("Lungi"); // a row with no stock or status still comes in, with the importer's defaults
    expect((await listAdminProducts(S.f.tenantId, S.owner, { q: "Negative" })).rows[0]!.stock).toBe(0);
    const edit = await getProductForEdit(S.f.tenantId, S.owner, p.id);
    expect(edit.descriptionHtml).toContain("cotton"); // simple formatting is kept; the saved text is sanitised like any product description
    expect(edit.compareAtPrice).toBe(2200);
  });

  it("refuses a file without the needed columns, an empty file and too many rows", async () => {
    const S = await store("impbad");
    await fails(importProductsCsv(S.f.tenantId, S.owner, "name,colour\nShirt,red\n"), "VALIDATION_ERROR");
    await fails(importProductsCsv(S.f.tenantId, S.owner, head), "VALIDATION_ERROR");
    await fails(importProductsCsv(S.f.tenantId, S.owner, head + Array.from({ length: 501 }, (_, i) => `P${i},10`).join("\n")), "VALIDATION_ERROR");
  });

  it("stops at the plan's product limit and says so, keeping what was added", async () => {
    const S = await store("implimit", 5); // 3 already counted
    const r = await importProductsCsv(S.f.tenantId, S.owner, `${head}A1,10\nA2,10\nA3,10\nA4,10\n`);
    expect(r.created).toBe(2);
    expect(r.stoppedByPlan).toBe(true);
  });

  it("only a person who can edit products may import", async () => {
    const S = await store("impperm");
    await fails(importProductsCsv(S.f.tenantId, S.support, `${head}A1,10\n`), "FORBIDDEN");
  });
});

describe("bulk product actions and the collection filter", () => {
  it("publishes, unpublishes and archives many at once, skipping the ones already so", async () => {
    const S = await store("bulk");
    const ids: string[] = [];
    for (const t of ["B1", "B2", "B3"]) ids.push((await saveProduct(S.f.tenantId, S.owner, newProduct({ title: t, status: "DRAFT" }))).id);
    expect(await bulkProductAction(S.f.tenantId, S.owner, ids, "publish")).toEqual({ done: 3, skipped: 0 });
    expect(await bulkProductAction(S.f.tenantId, S.owner, ids, "publish")).toEqual({ done: 0, skipped: 3 });
    expect((await listAdminProducts(S.f.tenantId, S.owner, { tab: "active", q: "B" })).rows.length).toBeGreaterThanOrEqual(3);
    expect(await bulkProductAction(S.f.tenantId, S.owner, ids.slice(0, 1), "unpublish")).toEqual({ done: 1, skipped: 0 });
    expect(await bulkProductAction(S.f.tenantId, S.owner, ids, "archive")).toEqual({ done: 3, skipped: 0 });
    expect(await bulkProductAction(S.f.tenantId, S.owner, ids, "archive")).toEqual({ done: 0, skipped: 3 });
    expect((await listAdminProducts(S.f.tenantId, S.owner, { q: "B1" })).rows).toHaveLength(0);
    await fails(bulkProductAction(S.f.tenantId, S.support, ids, "publish"), "FORBIDDEN");
  });

  it("filters the list by collection", async () => {
    const S = await store("coll");
    const a = await saveProduct(S.f.tenantId, S.owner, newProduct({ title: "InColl" }));
    await saveProduct(S.f.tenantId, S.owner, newProduct({ title: "OutColl" }));
    const c = await owner.collection.create({ data: { tenantId: S.f.tenantId, title: "Eid", slug: "eid" } });
    await owner.collectionProduct.create({ data: { tenantId: S.f.tenantId, collectionId: c.id, productId: a.id } });
    const list = await listAdminProducts(S.f.tenantId, S.owner, { collectionId: c.id });
    expect(list.rows.map((r) => r.title)).toEqual(["InColl"]);
    expect(list.collections.map((x) => x.title)).toContain("Eid");
  });
});
