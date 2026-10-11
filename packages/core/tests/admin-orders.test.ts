import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  DomainError, addOrderNote, createOrder, getDashboard, getOrderDetail, listOrders, markPacked, orderTabCounts, quoteOrder, rejectPayment,
  setEventPublisher, shipManually, transitionOrder, updateShippingAddress, verifyPayment, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

const phone = () => `0141${String(1000000 + ++seq).slice(-7)}`;
const trx = () => `TX${Date.now().toString(36).toUpperCase()}${++seq}`.slice(0, 11).padEnd(9, "A");
const key = () => `adm-${Date.now()}-${++seq}`;

async function store(name: string) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 100 });
  await owner.storeSettings.create({ data: { tenantId: f.tenantId, storeName: name, contactPhone: "01712345678", bkashNumber: "01712345678", nagadNumber: "01812345678" } });
  const mk = (role: StaffActor["role"], n: string): StaffActor => ({ userId: `u-${n}-${seq}`, email: `${n}${seq}@example.test`, name: n, role });
  return { f, owner: mk("STORE_OWNER", "Nusrat"), manager: mk("STORE_MANAGER", "Kamrul"), support: mk("TELEMARKETER", "Sumaiya"), packer: mk("ORDER_PACKER", "Rubel") };
}

const vid = (f: TenantFixture, p = 0, v = 0) => f.products[p]!.variants[v]!.id;
const place = (f: TenantFixture, over: Record<string, unknown> = {}) =>
  createOrder(f.tenantId, {
    idempotencyKey: key(), customer: { name: "Test Buyer", phone: phone() },
    shipping: { address: "House 4, Road 2, Dhanmondi", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" },
    items: [{ variantId: vid(f), quantity: 1 }], ...over,
  });
const mfsOrder = (f: TenantFixture, over: Record<string, unknown> = {}) => place(f, { paymentMethod: "MANUAL_BKASH", mfs: { senderNumber: "01712345678", trxId: trx() }, ...over });

const fails = async (p: Promise<unknown>, code: string) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  return e as DomainError;
};
const events = (orderId: string) => owner.orderEvent.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });

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

describe("order timeline", () => {
  it("records the order being placed, the TrxID, and every status change with who did it", async () => {
    const S = await store("timeline");
    const o = await mfsOrder(S.f);
    await verifyPayment(S.f.tenantId, S.owner, o.orderId);
    await markPacked(S.f.tenantId, S.owner, [o.orderId]);
    await addOrderNote(S.f.tenantId, S.owner, o.orderId, "Customer asked for gift wrap");
    const e = await events(o.orderId);
    expect(e.map((x) => x.type)).toEqual(["PLACED", "PAYMENT_SUBMITTED", "PAYMENT_VERIFIED", "STATUS", "STATUS", "NOTE"]);
    expect(e[0]).toMatchObject({ message: "Order placed by customer", actorName: "Customer" });
    expect(e[1]!.message).toMatch(/^bKash TrxID submitted: /);
    expect(e[3]).toMatchObject({ message: "Order confirmed: payment confirmed", actorName: "Nusrat" });
    expect(e[4]).toMatchObject({ message: "Order being packed: packed", actorName: "Nusrat" });
    expect(e[5]).toMatchObject({ message: "Customer asked for gift wrap", actorName: "Nusrat" });
  });

  it("is append-only for the application role", async () => {
    const S = await store("append");
    const o = await place(S.f);
    const { withTenant } = await import("@biztrackbd/db");
    await expect(withTenant(S.f.tenantId, (tx) => tx.orderEvent.updateMany({ data: { message: "tampered" } }))).rejects.toBeTruthy();
    await expect(withTenant(S.f.tenantId, (tx) => tx.orderEvent.deleteMany({}))).rejects.toBeTruthy();
    expect((await events(o.orderId)).length).toBeGreaterThan(0);
  });

  it("another store cannot read it", async () => {
    const A = await store("tla");
    const B = await store("tlb");
    const o = await place(A.f);
    await fails(getOrderDetail(B.f.tenantId, B.owner, o.orderId), "NOT_FOUND");
  });
});

describe("payment rules from the store settings", () => {
  it("cash on delivery can be switched off, capped and charged a fee", async () => {
    const S = await store("cod");
    await owner.storeSettings.update({ where: { tenantId: S.f.tenantId }, data: { codFee: 40, codMaxAmount: 2000 } });
    const o = await place(S.f); // 1150 + 80 delivery + 40 fee
    expect(o.totalAmount).toBe(1270);
    expect(Number((await owner.order.findUniqueOrThrow({ where: { id: o.orderId } })).codFee)).toBe(40);
    await fails(place(S.f, { items: [{ variantId: vid(S.f), quantity: 2 }] }), "PAYMENT_METHOD_UNAVAILABLE"); // 2300 + 80 + 40 > 2000
    await owner.storeSettings.update({ where: { tenantId: S.f.tenantId }, data: { codEnabled: false } });
    await fails(place(S.f), "PAYMENT_METHOD_UNAVAILABLE");
    // mobile money is not charged the cash fee
    const m = await mfsOrder(S.f);
    expect(m.totalAmount).toBe(1230);
  });

  it("the checkout quote matches what is charged, with and without the cash fee", async () => {
    const S = await store("quotecod");
    await owner.storeSettings.update({ where: { tenantId: S.f.tenantId }, data: { codFee: 50 } });
    const items = [{ variantId: vid(S.f), quantity: 1 }];
    const cod = await quoteOrder(S.f.tenantId, { items, district: "Dhaka", paymentMethod: "COD" });
    const mfs = await quoteOrder(S.f.tenantId, { items, district: "Dhaka", paymentMethod: "MANUAL_BKASH" });
    expect(cod).toMatchObject({ codFee: 50, total: 1280 });
    expect(mfs).toMatchObject({ codFee: 0, total: 1230 });
    expect((await place(S.f)).totalAmount).toBe(cod.total);
    expect(cod.paymentOptions).toMatchObject({ cod: { available: true, fee: 50 }, bkash: { available: true }, nagad: { available: true } });
  });

  it("reports unavailable methods to the checkout", async () => {
    const S = await store("opts");
    await owner.storeSettings.update({ where: { tenantId: S.f.tenantId }, data: { bkashEnabled: false, nagadNumber: null, codMaxAmount: 1000 } });
    const q = await quoteOrder(S.f.tenantId, { items: [{ variantId: vid(S.f), quantity: 1 }], district: "Dhaka" });
    expect(q.paymentOptions.bkash.available).toBe(false);
    expect(q.paymentOptions.nagad.available).toBe(false);
    expect(q.paymentOptions.cod).toMatchObject({ available: false, reason: expect.stringContaining("up to") });
    await fails(mfsOrder(S.f), "PAYMENT_METHOD_UNAVAILABLE");
  });

  it("a paused store refuses customer orders but staff can still key one in", async () => {
    const S = await store("pause");
    await owner.storeSettings.update({ where: { tenantId: S.f.tenantId }, data: { ordersPaused: true } });
    await fails(place(S.f), "STORE_PAUSED");
    await expect(place(S.f, { channel: "QUICK_PHONE" })).resolves.toBeTruthy();
  });

  it("a store with no settings row behaves as before", async () => {
    const f = await createTenantFixture(owner, { name: "Nosettings", subdomain: `nosettings${++seq}`, stock: 10 });
    await expect(place(f)).resolves.toMatchObject({ totalAmount: 1230 });
  });
});

describe("orders list", () => {
  it("filters by tab, searches by number, name and phone, and counts the tabs", async () => {
    const S = await store("list");
    const buyer = { name: "Findable Person", phone: phone() };
    const a = await place(S.f, { customer: buyer });
    const b = await mfsOrder(S.f);
    const c = await place(S.f);
    await transitionOrder(S.f.tenantId, c.orderId, "CONFIRMED", { type: "MERCHANT", name: "x" });
    const all = await listOrders(S.f.tenantId, S.owner);
    expect(all.total).toBe(3);
    expect((await listOrders(S.f.tenantId, S.owner, { tab: "check" })).rows.map((r) => r.id)).toEqual([b.orderId]);
    expect((await listOrders(S.f.tenantId, S.owner, { tab: "to_pack" })).rows.map((r) => r.id)).toEqual([c.orderId]);
    expect((await listOrders(S.f.tenantId, S.owner, { tab: "new" })).total).toBe(2);
    expect((await listOrders(S.f.tenantId, S.owner, { q: "findable" })).rows.map((r) => r.id)).toEqual([a.orderId]);
    expect((await listOrders(S.f.tenantId, S.owner, { q: buyer.phone.slice(-6) })).rows.map((r) => r.id)).toEqual([a.orderId]);
    expect((await listOrders(S.f.tenantId, S.owner, { q: a.orderNumber })).rows.map((r) => r.id)).toEqual([a.orderId]);
    expect((await listOrders(S.f.tenantId, S.owner, { payment: "MANUAL_BKASH" })).rows.map((r) => r.id)).toEqual([b.orderId]);
    expect(await orderTabCounts(S.f.tenantId, S.owner)).toMatchObject({ all: 3, new: 2, check: 1, to_pack: 1, shipped: 0, cancelled: 0 });
  });

  it("treats % and _ in the search as plain characters", async () => {
    const S = await store("wild");
    await place(S.f);
    for (const q of ["%", "_", "%%%%"]) expect((await listOrders(S.f.tenantId, S.owner, { q })).total, q).toBe(0);
  });

  it("pages, and never shows another store's orders", async () => {
    const A = await store("pga");
    const B = await store("pgb");
    for (let i = 0; i < 5; i++) await place(A.f);
    await place(B.f);
    const p2 = await listOrders(A.f.tenantId, A.owner, { pageSize: 2, page: 3 });
    expect(p2.rows).toHaveLength(1);
    expect(p2.total).toBe(5);
    const names = (await listOrders(B.f.tenantId, B.owner)).rows;
    expect(names).toHaveLength(1);
  });

  it("is open to support (view) and closed to roles without orders access", async () => {
    const S = await store("perm");
    await place(S.f);
    expect((await listOrders(S.f.tenantId, S.support)).total).toBe(1);
    await fails(listOrders(S.f.tenantId, { ...S.support, role: "CONTENT_EDITOR" }), "FORBIDDEN");
  });
});

describe("verification desk", () => {
  it("verifying a bKash payment marks it paid and moves the order to pack, once", async () => {
    const S = await store("verify");
    const o = await mfsOrder(S.f);
    await Promise.all([verifyPayment(S.f.tenantId, S.owner, o.orderId), verifyPayment(S.f.tenantId, S.owner, o.orderId)]);
    const row = await owner.order.findUniqueOrThrow({ where: { id: o.orderId } });
    expect(row).toMatchObject({ paymentStatus: "PAID", status: "CONFIRMED", mfsVerifiedBy: S.owner.userId });
    expect((await events(o.orderId)).filter((e) => e.type === "PAYMENT_VERIFIED")).toHaveLength(1);
    expect((await owner.auditLog.findMany({ where: { tenantId: S.f.tenantId, action: "order.payment_verified" } })).length).toBe(1);
  });

  it("support can look but not verify; a closed order cannot be verified", async () => {
    const S = await store("noverify");
    const o = await mfsOrder(S.f);
    await fails(verifyPayment(S.f.tenantId, S.support, o.orderId), "FORBIDDEN");
    await transitionOrder(S.f.tenantId, o.orderId, "CANCELLED", { type: "MERCHANT" });
    await fails(verifyPayment(S.f.tenantId, S.owner, o.orderId), "VALIDATION_ERROR");
  });

  it("'payment not received' needs a reason, keeps the TrxID blocked, and can be corrected by verifying later", async () => {
    const S = await store("reject");
    const t = trx();
    const o = await mfsOrder(S.f, { mfs: { senderNumber: "01712345678", trxId: t } });
    await fails(rejectPayment(S.f.tenantId, S.owner, o.orderId, " "), "VALIDATION_ERROR");
    await rejectPayment(S.f.tenantId, S.owner, o.orderId, "not in my bKash history");
    expect((await owner.order.findUniqueOrThrow({ where: { id: o.orderId } })).paymentStatus).toBe("FAILED");
    expect((await events(o.orderId)).at(-1)).toMatchObject({ type: "PAYMENT_REJECTED", message: "Payment not received: not in my bKash history" });
    await fails(rejectPayment(S.f.tenantId, S.owner, o.orderId, "again"), "VALIDATION_ERROR");
    // the fake TrxID cannot be reused on a new order
    await fails(mfsOrder(S.f, { mfs: { senderNumber: "01712345678", trxId: t } }), "VALIDATION_ERROR");
    // the owner finds the money after all
    await verifyPayment(S.f.tenantId, S.owner, o.orderId);
    expect((await owner.order.findUniqueOrThrow({ where: { id: o.orderId } })).paymentStatus).toBe("PAID");
  });

  it("the order detail gives the desk everything on one screen", async () => {
    const S = await store("detail");
    const buyer = { name: "Detail Buyer", phone: phone() };
    const first = await place(S.f, { customer: buyer });
    await transitionOrder(S.f.tenantId, first.orderId, "CONFIRMED", { type: "MERCHANT" });
    await transitionOrder(S.f.tenantId, first.orderId, "PROCESSING", { type: "MERCHANT" });
    await transitionOrder(S.f.tenantId, first.orderId, "SHIPPED", { type: "MERCHANT" });
    await transitionOrder(S.f.tenantId, first.orderId, "DELIVERED", { type: "MERCHANT" });
    const o = await mfsOrder(S.f, { customer: buyer, items: [{ variantId: vid(S.f), quantity: 1 }, { variantId: vid(S.f, 1), quantity: 2 }] });
    const d = await getOrderDetail(S.f.tenantId, S.owner, o.orderId);
    expect(d).toMatchObject({ paymentMethod: "MANUAL_BKASH", paymentStatus: "PENDING_VERIFICATION", canEditAddress: true, nextStatuses: ["CONFIRMED", "CANCELLED"] });
    expect(d.items).toHaveLength(2);
    expect(d.totals).toMatchObject({ subtotal: 2850, delivery: 80, total: 2930 });
    expect(d.mfs.trxId).toMatch(/^TX/);
    expect(d.customer).toMatchObject({ totalOrders: 2, delivered: 1, deliverySuccessPercent: 100, isBlocked: false });
    expect(d.events.map((e) => e.type)).toContain("PAYMENT_SUBMITTED");
    expect(d.trxReuse).toEqual([]);
  });
});

describe("fixing an order", () => {
  it("changes the address, recalculating delivery when the district changes", async () => {
    const S = await store("addr");
    const o = await place(S.f);
    await updateShippingAddress(S.f.tenantId, S.owner, o.orderId, { line: "Village road, Sylhet Sadar", area: "Sylhet Sadar", district: "Sylhet", division: "Sylhet" });
    const row = await owner.order.findUniqueOrThrow({ where: { id: o.orderId } });
    expect(row).toMatchObject({ shippingDistrict: "Sylhet", deliveryZone: "Outside Dhaka" });
    expect(Number(row.deliveryCharge)).toBe(130);
    expect(Number(row.totalAmount)).toBe(1280);
    expect((await events(o.orderId)).at(-1)).toMatchObject({ type: "ADDRESS_CHANGED", message: expect.stringContaining("Total is now ৳1280") });
  });

  it("refuses a bad address, a changed total on a paid order, and an order that has shipped", async () => {
    const S = await store("addr2");
    const o = await mfsOrder(S.f);
    await fails(updateShippingAddress(S.f.tenantId, S.owner, o.orderId, { line: "x", area: "Mirpur", district: "Dhaka", division: "Dhaka" }), "VALIDATION_ERROR");
    await fails(updateShippingAddress(S.f.tenantId, S.owner, o.orderId, { line: "House 1, Road 1", area: "Nowhere", district: "Dhaka", division: "Dhaka" }), "VALIDATION_ERROR");
    await verifyPayment(S.f.tenantId, S.owner, o.orderId);
    await fails(updateShippingAddress(S.f.tenantId, S.owner, o.orderId, { line: "House 1, Road 1", area: "Sylhet Sadar", district: "Sylhet", division: "Sylhet" }), "VALIDATION_ERROR");
    // same total is fine (a different house in the same district)
    await updateShippingAddress(S.f.tenantId, S.owner, o.orderId, { line: "House 9, Road 3, Gulshan", area: "Gulshan", district: "Dhaka", division: "Dhaka" });
    await shipManually(S.f.tenantId, S.owner, o.orderId, { trackingCode: "MY-123" });
    await fails(updateShippingAddress(S.f.tenantId, S.owner, o.orderId, { line: "House 9, Road 3, Gulshan", area: "Gulshan", district: "Dhaka", division: "Dhaka" }), "VALIDATION_ERROR");
  });

  it("packs many orders at once and reports what could not be packed", async () => {
    const S = await store("pack");
    const ok1 = await place(S.f);
    const ok2 = await place(S.f);
    const notYet = await place(S.f); // still PENDING
    for (const id of [ok1.orderId, ok2.orderId]) await transitionOrder(S.f.tenantId, id, "CONFIRMED", { type: "MERCHANT" });
    const r = await markPacked(S.f.tenantId, S.owner, [ok1.orderId, ok2.orderId, notYet.orderId, ok1.orderId]);
    expect(r.done.sort()).toEqual([ok1.orderId, ok2.orderId].sort());
    expect(r.skipped.map((s) => s.id)).toEqual([notYet.orderId]);
  });

  it("ships it ourselves with an optional tracking code, stepping through packing", async () => {
    const S = await store("ship");
    const o = await place(S.f);
    await transitionOrder(S.f.tenantId, o.orderId, "CONFIRMED", { type: "MERCHANT" });
    await shipManually(S.f.tenantId, S.owner, o.orderId, { trackingCode: "RIDER-7" });
    expect(await owner.order.findUniqueOrThrow({ where: { id: o.orderId } })).toMatchObject({ status: "SHIPPED", courierProvider: "MANUAL", trackingCode: "RIDER-7" });
    expect((await events(o.orderId)).map((e) => e.message)).toContain("Order shipped: tracking RIDER-7");
    await fails(shipManually(S.f.tenantId, S.support, o.orderId), "FORBIDDEN");
  });

  it("notes must not be empty and are limited in length", async () => {
    const S = await store("note");
    const o = await place(S.f);
    await fails(addOrderNote(S.f.tenantId, S.owner, o.orderId, "  "), "VALIDATION_ERROR");
    await addOrderNote(S.f.tenantId, S.owner, o.orderId, "x".repeat(900));
    expect((await events(o.orderId)).at(-1)!.message.length).toBe(500);
  });
});

describe("dashboard", () => {
  it("counts today's orders and sales, what needs checking and packing, and leaves out cancelled orders", async () => {
    const S = await store("dash");
    const a = await place(S.f);
    const b = await mfsOrder(S.f);
    const c = await place(S.f);
    await transitionOrder(S.f.tenantId, c.orderId, "CONFIRMED", { type: "MERCHANT" });
    const x = await place(S.f);
    await transitionOrder(S.f.tenantId, x.orderId, "CANCELLED", { type: "MERCHANT" });
    const d = await getDashboard(S.f.tenantId, S.owner);
    expect(d.today).toEqual({ orders: 3, sales: a.totalAmount + b.totalAmount + c.totalAmount });
    expect(d.awaitingCheck).toMatchObject({ count: 1, oldestHours: 0 });
    expect(d.toPack.count).toBe(1);
    expect(d.newOrders.count).toBe(4);
    expect(d.week.days).toHaveLength(7);
    expect(d.week.days.at(-1)!.sales).toBe(d.today.sales);
    expect(d.recent).toHaveLength(4);
  });

  it("flags orders waiting over 24 hours and compares with yesterday", async () => {
    const S = await store("dash2");
    const old = await place(S.f);
    await transitionOrder(S.f.tenantId, old.orderId, "CONFIRMED", { type: "MERCHANT" });
    await owner.order.update({ where: { id: old.orderId }, data: { createdAt: new Date(Date.now() - 30 * 3_600_000) } });
    const d = await getDashboard(S.f.tenantId, S.owner);
    expect(d.toPack).toEqual({ count: 1, waitingOver24h: 1 });
    // 30 hours ago is yesterday or the day before, depending on the time of day in Dhaka; either way it is inside the week.
    expect(d.week.days.reduce((n, day) => n + day.orders, 0)).toBe(1);
  });

  it("lists low and out-of-stock items and the setup checklist", async () => {
    const S = await store("dash3");
    await owner.productVariant.update({ where: { id: vid(S.f, 0, 0) }, data: { stockQuantity: 2 } });
    await owner.productVariant.update({ where: { id: vid(S.f, 1, 0) }, data: { stockQuantity: 0 } });
    await owner.tenant.update({ where: { id: S.f.tenantId }, data: { productCount: 3 } });
    const d = await getDashboard(S.f.tenantId, S.owner);
    expect(d.lowStock.map((l) => l.stock)).toEqual([2]);
    expect(d.outOfStock.count).toBe(1);
    expect(d.setup.steps.find((s) => s.key === "products")!.done).toBe(true);
    expect(d.setup.steps.find((s) => s.key === "courier")!.done).toBe(false);
    expect(d.setup.done).toBeGreaterThanOrEqual(4);
  });

  it("is private to each store", async () => {
    const A = await store("dpa");
    const B = await store("dpb");
    await place(A.f);
    expect((await getDashboard(B.f.tenantId, B.owner)).today.orders).toBe(0);
  });
});
