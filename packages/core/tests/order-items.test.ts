import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import { DomainError, createOrder, editOrderItems, getEditableOrder, getOrderDetail, setEventPublisher, transitionOrder, type StaffActor } from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

const phone = () => `0161${String(3000000 + ++seq).slice(-7)}`;
const trx = () => `TX${Date.now().toString(36).toUpperCase()}${++seq}`.slice(0, 11).padEnd(9, "A");
async function store(name: string) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 20 });
  await owner.storeSettings.create({ data: { tenantId: f.tenantId, storeName: name, contactPhone: "01712345678", bkashNumber: "01712345678", nagadNumber: "01812345678" } });
  const mk = (role: StaffActor["role"], n: string): StaffActor => ({ userId: `u-${n}-${seq}`, email: `${n}${seq}@example.test`, name: n, role });
  return { f, owner: mk("STORE_OWNER", "Nusrat"), content: mk("CONTENT_EDITOR", "Tamim") };
}
const place = (f: TenantFixture, items: { variantId: string; quantity: number }[], over: Record<string, unknown> = {}) =>
  createOrder(f.tenantId, {
    idempotencyKey: `oi-${Date.now()}-${++seq}`, customer: { name: "Test Buyer", phone: phone() },
    shipping: { address: "House 4, Road 2, Dhanmondi", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" }, items, ...over,
  });
const stockOf = async (id: string) => (await owner.productVariant.findUniqueOrThrow({ where: { id } })).stockQuantity;
const fails = async (p: Promise<unknown>, code: string, text?: RegExp) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  if (text) expect((e as DomainError).message).toMatch(text);
};

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

describe("changing the items of an open order", () => {
  it("changes a quantity: stock, subtotal and total follow, and the timeline says so", async () => {
    const S = await store("qty");
    const v = S.f.products[0]!.variants[0]!.id;
    const o = await place(S.f, [{ variantId: v, quantity: 1 }]);
    const before = await stockOf(v);
    const d = await getOrderDetail(S.f.tenantId, S.owner, o.orderId);
    const r = await editOrderItems(S.f.tenantId, S.owner, o.orderId, [{ itemId: d.items[0]!.id, variantId: v, quantity: 3 }]);
    expect(r.changed).toBe(true);
    expect(await stockOf(v)).toBe(before - 2);
    const after = await getOrderDetail(S.f.tenantId, S.owner, o.orderId);
    expect(after.items[0]!.quantity).toBe(3);
    expect(after.totals.subtotal).toBe(d.items[0]!.unitPrice * 3);
    expect(after.totals.total).toBe(r.total);
    const e = await owner.orderEvent.findMany({ where: { orderId: o.orderId, type: "ITEMS_CHANGED" } });
    expect(e).toHaveLength(1);
    expect(e[0]!.message).toMatch(/1 to 3/);
    expect(e[0]!.actorName).toBe("Nusrat");
    // asking for exactly what is already there changes nothing and logs nothing
    const same = await editOrderItems(S.f.tenantId, S.owner, o.orderId, [{ itemId: d.items[0]!.id, variantId: v, quantity: 3 }]);
    expect(same.changed).toBe(false);
    expect(await owner.orderEvent.count({ where: { orderId: o.orderId, type: "ITEMS_CHANGED" } })).toBe(1);
  });

  it("swaps a size: the old size goes back on the shelf, the new one is taken", async () => {
    const S = await store("swap");
    const p = S.f.products[0]!;
    expect(p.variants.length).toBeGreaterThan(0);
    // make a second size for the same product
    const first = p.variants[0]!;
    const second = await owner.productVariant.create({ data: { tenantId: S.f.tenantId, productId: p.id, title: "XL", sku: `XL-${++seq}`, price: 900, stockQuantity: 5, options: {} } });
    const o = await place(S.f, [{ variantId: first.id, quantity: 2 }]);
    const d = await getOrderDetail(S.f.tenantId, S.owner, o.orderId);
    const stock1 = await stockOf(first.id);
    const r = await editOrderItems(S.f.tenantId, S.owner, o.orderId, [{ itemId: d.items[0]!.id, variantId: second.id, quantity: 2 }]);
    expect(await stockOf(first.id)).toBe(stock1 + 2);
    expect(await stockOf(second.id)).toBe(3);
    const after = await getOrderDetail(S.f.tenantId, S.owner, o.orderId);
    expect(after.items).toHaveLength(1);
    expect(after.items[0]).toMatchObject({ variantTitle: "XL", unitPrice: 900, quantity: 2 });
    expect(after.totals.subtotal).toBe(1800);
    expect(r.total).toBe(after.totals.total);
  });

  it("refuses more than is in stock and leaves everything as it was", async () => {
    const S = await store("short");
    const v = S.f.products[0]!.variants[0]!.id;
    const o = await place(S.f, [{ variantId: v, quantity: 1 }]);
    const d = await getOrderDetail(S.f.tenantId, S.owner, o.orderId);
    const before = await stockOf(v);
    await fails(editOrderItems(S.f.tenantId, S.owner, o.orderId, [{ itemId: d.items[0]!.id, variantId: v, quantity: 50 }]), "INSUFFICIENT_STOCK");
    expect(await stockOf(v)).toBe(before);
    expect((await getOrderDetail(S.f.tenantId, S.owner, o.orderId)).items[0]!.quantity).toBe(1);
  });

  it("adds another product and removes a line; an order cannot be emptied", async () => {
    const S = await store("addrm");
    const a = S.f.products[0]!.variants[0]!.id;
    const b = S.f.products[1]!.variants[0]!.id;
    const o = await place(S.f, [{ variantId: a, quantity: 1 }]);
    const d = await getOrderDetail(S.f.tenantId, S.owner, o.orderId);
    const stockB = await stockOf(b);
    await editOrderItems(S.f.tenantId, S.owner, o.orderId, [{ itemId: d.items[0]!.id, variantId: a, quantity: 1 }, { variantId: b, quantity: 2 }]);
    expect(await stockOf(b)).toBe(stockB - 2);
    const two = await getOrderDetail(S.f.tenantId, S.owner, o.orderId);
    expect(two.items).toHaveLength(2);
    const stockA = await stockOf(a);
    await editOrderItems(S.f.tenantId, S.owner, o.orderId, [{ itemId: two.items.find((i) => i.productId !== d.items[0]!.productId)!.id, variantId: b, quantity: 2 }]);
    expect(await stockOf(a)).toBe(stockA + 1);
    await fails(editOrderItems(S.f.tenantId, S.owner, o.orderId, []), "VALIDATION_ERROR", /at least one item/);
  });

  it("keeps the price the customer saw when only the quantity changes, even after the shelf price moved", async () => {
    const S = await store("price");
    const v = S.f.products[0]!.variants[0]!.id;
    const o = await place(S.f, [{ variantId: v, quantity: 1 }]);
    const d = await getOrderDetail(S.f.tenantId, S.owner, o.orderId);
    await owner.productVariant.update({ where: { id: v }, data: { price: 99999 } });
    await editOrderItems(S.f.tenantId, S.owner, o.orderId, [{ itemId: d.items[0]!.id, variantId: v, quantity: 2 }]);
    expect((await getOrderDetail(S.f.tenantId, S.owner, o.orderId)).items[0]!.unitPrice).toBe(d.items[0]!.unitPrice);
  });

  it("re-works the delivery charge and the coupon with the checkout rules", async () => {
    const S = await store("rules");
    const v = S.f.products[0]!.variants[0]!.id;
    await owner.coupon.create({ data: { tenantId: S.f.tenantId, code: "TEN", type: "PERCENTAGE", value: 10, minOrderValue: 0, perCustomerLimit: 5, isActive: true } });
    const o = await place(S.f, [{ variantId: v, quantity: 1 }], { couponCode: "TEN" });
    const d = await getOrderDetail(S.f.tenantId, S.owner, o.orderId);
    const r = await editOrderItems(S.f.tenantId, S.owner, o.orderId, [{ itemId: d.items[0]!.id, variantId: v, quantity: 4 }]);
    const after = await getOrderDetail(S.f.tenantId, S.owner, o.orderId);
    const sub = d.items[0]!.unitPrice * 4;
    expect(after.totals.subtotal).toBe(sub);
    expect(after.totals.discount).toBeCloseTo(sub * 0.1, 2);
    expect(r.total).toBeCloseTo(sub - sub * 0.1 + after.totals.delivery, 2);
  });

  it("refuses when the customer has paid and the total would change, but allows a swap at the same price", async () => {
    const S = await store("paid");
    const p = S.f.products[0]!;
    const first = p.variants[0]!;
    const price = Number((await owner.productVariant.findUniqueOrThrow({ where: { id: first.id } })).price);
    const same = await owner.productVariant.create({ data: { tenantId: S.f.tenantId, productId: p.id, title: "L", sku: `L-${++seq}`, price, stockQuantity: 5, options: {} } });
    const o = await place(S.f, [{ variantId: first.id, quantity: 1 }], { paymentMethod: "MANUAL_BKASH", mfs: { senderNumber: "01712345678", trxId: trx() } });
    const d = await getOrderDetail(S.f.tenantId, S.owner, o.orderId);
    await fails(editOrderItems(S.f.tenantId, S.owner, o.orderId, [{ itemId: d.items[0]!.id, variantId: first.id, quantity: 2 }]), "VALIDATION_ERROR", /already paid or sent a TrxID/);
    const r = await editOrderItems(S.f.tenantId, S.owner, o.orderId, [{ itemId: d.items[0]!.id, variantId: same.id, quantity: 1 }]);
    expect(r.total).toBe(d.totals.total);
    expect((await getOrderDetail(S.f.tenantId, S.owner, o.orderId)).items[0]!.variantTitle).toBe("L");
  });

  it("is closed once the order has shipped, and to people who cannot edit orders", async () => {
    const S = await store("closed");
    const v = S.f.products[0]!.variants[0]!.id;
    const o = await place(S.f, [{ variantId: v, quantity: 1 }]);
    const d = await getOrderDetail(S.f.tenantId, S.owner, o.orderId);
    await fails(editOrderItems(S.f.tenantId, S.content, o.orderId, [{ itemId: d.items[0]!.id, variantId: v, quantity: 2 }]), "FORBIDDEN");
    expect((await getEditableOrder(S.f.tenantId, S.owner, o.orderId)).editable).toBe(true);
    const by = { type: "MERCHANT" as const, id: "u", name: "x" };
    await transitionOrder(S.f.tenantId, o.orderId, "CONFIRMED", by);
    await transitionOrder(S.f.tenantId, o.orderId, "PROCESSING", by);
    await transitionOrder(S.f.tenantId, o.orderId, "SHIPPED", by);
    const e = await getEditableOrder(S.f.tenantId, S.owner, o.orderId);
    expect(e.editable).toBe(false);
    expect(e.reason).toMatch(/before the order ships/);
    await fails(editOrderItems(S.f.tenantId, S.owner, o.orderId, [{ itemId: d.items[0]!.id, variantId: v, quantity: 2 }]), "VALIDATION_ERROR", /before the order ships/);
  });

  it("another store cannot touch it", async () => {
    const A = await store("oia");
    const B = await store("oib");
    const o = await place(A.f, [{ variantId: A.f.products[0]!.variants[0]!.id, quantity: 1 }]);
    await fails(editOrderItems(B.f.tenantId, B.owner, o.orderId, [{ variantId: B.f.products[0]!.variants[0]!.id, quantity: 1 }]), "NOT_FOUND");
  });
});
