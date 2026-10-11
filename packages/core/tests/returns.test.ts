import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  DomainError, approveReturn, createOrder, createReturn, declineReturn, exchangeOptions, getReturnMetrics, listReturns, markPickupBooked, receiveReturn, refundReturn,
  returnTabCounts, returnableItems, setEventPublisher, transitionOrder, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

const phone = () => `0171${String(1000000 + ++seq).slice(-7)}`;
const key = () => `ret-${Date.now()}-${++seq}`;
const trx = () => `RF${Date.now().toString(36).toUpperCase()}${++seq}`.slice(0, 11).padEnd(9, "A");

async function store(name: string) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 20 });
  await owner.storeSettings.create({ data: { tenantId: f.tenantId, storeName: name, contactPhone: "01712345678", bkashNumber: "01712345678", nagadNumber: "01812345678" } });
  const mk = (role: StaffActor["role"], n: string): StaffActor => ({ userId: `u-${n}-${seq}`, email: `${n}${seq}@example.test`, name: n, role });
  return { f, owner: mk("STORE_OWNER", "Nusrat"), manager: mk("STORE_MANAGER", "Kamrul"), support: mk("TELEMARKETER", "Sumaiya") };
}
type Store = Awaited<ReturnType<typeof store>>;
const vid = (f: TenantFixture, p = 0, v = 0) => f.products[p]!.variants[v]!.id;
const stock = async (id: string) => (await owner.productVariant.findUniqueOrThrow({ where: { id } })).stockQuantity;
const merchant = (s: Store) => ({ type: "MERCHANT" as const, id: s.owner.userId, name: "Nusrat" });
const fails = async (p: Promise<unknown>, code: string, msg?: RegExp) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  if (msg) expect((e as DomainError).message).toMatch(msg);
};

/** A delivered order with two shirts and one pair of chinos (so a return can cover part of it). */
async function delivered(s: Store) {
  const o = await createOrder(s.f.tenantId, {
    idempotencyKey: key(), customer: { name: "Return Buyer", phone: phone() },
    shipping: { address: "House 4, Road 2, Dhanmondi", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" },
    items: [{ variantId: vid(s.f, 0, 1), quantity: 2 }, { variantId: vid(s.f, 2, 0), quantity: 1 }],
  });
  for (const to of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const) await transitionOrder(s.f.tenantId, o.orderId, to, merchant(s));
  const items = await owner.orderItem.findMany({ where: { orderId: o.orderId }, orderBy: { totalPrice: "desc" } });
  return { ...o, shirt: items.find((i) => i.productTitle.includes("Panjabi"))!, chino: items.find((i) => i.productTitle.includes("Chino"))! };
}
const order = (id: string) => owner.order.findUniqueOrThrow({ where: { id } });

beforeAll(async () => {
  process.env.PHONE_TRUST_SALT = "test-salt-test-salt-test-salt-0001";
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  await seedPlans(owner);
});
beforeEach(() => setEventPublisher(async () => {}));
afterAll(async () => {
  await app.$disconnect();
  await owner.$disconnect();
});

describe("opening a return", () => {
  it("only for a delivered order, and only for what was bought", async () => {
    const s = await store("open");
    const fresh = await createOrder(s.f.tenantId, {
      idempotencyKey: key(), customer: { name: "Not Yet", phone: phone() },
      shipping: { address: "House 4, Road 2, Dhanmondi", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" }, items: [{ variantId: vid(s.f), quantity: 1 }],
    });
    const freshItem = await owner.orderItem.findFirstOrThrow({ where: { orderId: fresh.orderId } });
    await fails(createReturn(s.f.tenantId, s.owner, { orderId: fresh.orderId, reason: "Wrong size", type: "REFUND", items: [{ orderItemId: freshItem.id, qty: 1 }] }), "VALIDATION_ERROR", /delivered/);

    const o = await delivered(s);
    await fails(createReturn(s.f.tenantId, s.owner, { orderId: o.orderId, reason: "Wrong size", type: "REFUND", items: [{ orderItemId: o.shirt.id, qty: 3 }] }), "VALIDATION_ERROR", /Only 2/);
    await fails(createReturn(s.f.tenantId, s.owner, { orderId: o.orderId, reason: "Wrong size", type: "REFUND", items: [{ orderItemId: freshItem.id, qty: 1 }] }), "VALIDATION_ERROR", /not on this order/);
    await fails(createReturn(s.f.tenantId, s.owner, { orderId: o.orderId, reason: "x", type: "REFUND", items: [{ orderItemId: o.shirt.id, qty: 1 }] }), "VALIDATION_ERROR");
    await fails(createReturn(s.f.tenantId, s.owner, { orderId: o.orderId, reason: "Wrong size", type: "REFUND", items: [] }), "VALIDATION_ERROR");
    await fails(createReturn(s.f.tenantId, s.owner, { orderId: o.orderId, reason: "Wrong size", type: "EXCHANGE", items: [{ orderItemId: o.shirt.id, qty: 1 }] }), "VALIDATION_ERROR", /size or colour/);
    await fails(createReturn(s.f.tenantId, s.support, { orderId: o.orderId, reason: "Wrong size", type: "REFUND", items: [{ orderItemId: o.shirt.id, qty: 1 }] }), "FORBIDDEN");
  });

  it("will not let the same unit be returned twice, but frees it when a return is declined", async () => {
    const s = await store("twice");
    const o = await delivered(s);
    const a = await createReturn(s.f.tenantId, s.owner, { orderId: o.orderId, reason: "Wrong size", type: "REFUND", items: [{ orderItemId: o.shirt.id, qty: 2 }] });
    await fails(createReturn(s.f.tenantId, s.owner, { orderId: o.orderId, reason: "Changed my mind", type: "REFUND", items: [{ orderItemId: o.shirt.id, qty: 1 }] }), "VALIDATION_ERROR", /already in another return/);
    expect((await returnableItems(s.f.tenantId, s.owner, o.orderId)).items.find((i) => i.id === o.shirt.id)!.left).toBe(0);
    await declineReturn(s.f.tenantId, s.owner, a.id, "worn and washed");
    expect((await returnableItems(s.f.tenantId, s.owner, o.orderId)).items.find((i) => i.id === o.shirt.id)!.left).toBe(2);
    await createReturn(s.f.tenantId, s.owner, { orderId: o.orderId, reason: "Changed my mind", type: "REFUND", items: [{ orderItemId: o.shirt.id, qty: 1 }] });
  });

  it("numbers returns RT-0001, RT-0002 per store, even when opened at the same moment", async () => {
    const s = await store("codes");
    const other = await store("codes2");
    const orders = await Promise.all(Array.from({ length: 4 }, () => delivered(s)));
    const made = await Promise.all(orders.map((o) => createReturn(s.f.tenantId, s.owner, { orderId: o.orderId, reason: "Wrong size", type: "REFUND", items: [{ orderItemId: o.shirt.id, qty: 1 }] })));
    expect(made.map((m) => m.code).sort()).toEqual(["RT-0001", "RT-0002", "RT-0003", "RT-0004"]);
    const o2 = await delivered(other);
    expect((await createReturn(other.f.tenantId, other.owner, { orderId: o2.orderId, reason: "Wrong size", type: "REFUND", items: [{ orderItemId: o2.shirt.id, qty: 1 }] })).code).toBe("RT-0001");
  });

  it("is invisible to another store", async () => {
    const a = await store("isoA");
    const b = await store("isoB");
    const o = await delivered(a);
    const r = await createReturn(a.f.tenantId, a.owner, { orderId: o.orderId, reason: "Wrong size", type: "REFUND", items: [{ orderItemId: o.shirt.id, qty: 1 }] });
    await fails(createReturn(b.f.tenantId, b.owner, { orderId: o.orderId, reason: "Wrong size", type: "REFUND", items: [{ orderItemId: o.shirt.id, qty: 1 }] }), "NOT_FOUND");
    await fails(approveReturn(b.f.tenantId, b.owner, r.id), "NOT_FOUND");
    expect(await listReturns(b.f.tenantId, b.owner)).toHaveLength(0);
  });
});

describe("a refund", () => {
  it("runs the whole path: approve, parcel back, restock, pay the customer back", async () => {
    const s = await store("refund");
    const o = await delivered(s);
    const shirtVariant = vid(s.f, 0, 1);
    const before = await stock(shirtVariant);
    const spentBefore = Number((await owner.customer.findFirstOrThrow({ where: { id: (await order(o.orderId)).customerId! } })).totalSpent);

    const r = await createReturn(s.f.tenantId, s.owner, { orderId: o.orderId, reason: "Wrong size", note: "too tight", type: "REFUND", items: [{ orderItemId: o.shirt.id, qty: 1 }] });
    let [row] = await listReturns(s.f.tenantId, s.owner, "requested");
    expect(row).toMatchObject({ code: r.code, status: "PENDING", refundAmount: 1150, orderNumber: o.orderNumber });

    await fails(receiveReturn(s.f.tenantId, s.owner, r.id, { restock: true }), "VALIDATION_ERROR");
    await fails(refundReturn(s.f.tenantId, s.owner, r.id, { method: "BKASH_SEND_MONEY", trxId: trx() }), "VALIDATION_ERROR", /Receive the parcel/);
    await approveReturn(s.f.tenantId, s.owner, r.id);
    await fails(approveReturn(s.f.tenantId, s.owner, r.id), "VALIDATION_ERROR", /already decided/);
    await markPickupBooked(s.f.tenantId, s.owner, r.id, "RET-TRK-1");
    [row] = await listReturns(s.f.tenantId, s.owner, "coming_back");
    expect(row).toMatchObject({ status: "PICKUP_BOOKED", returnTrackingCode: "RET-TRK-1" });

    await receiveReturn(s.f.tenantId, s.owner, r.id, { restock: true });
    expect(await stock(shirtVariant)).toBe(before + 1);
    expect(await owner.stockAdjustment.count({ where: { tenantId: s.f.tenantId, variantId: shirtVariant, reason: "RETURNED" } })).toBe(1);

    await fails(refundReturn(s.f.tenantId, s.owner, r.id, { method: "BKASH_SEND_MONEY" }), "VALIDATION_ERROR", /transaction ID/);
    const paid = await refundReturn(s.f.tenantId, s.owner, r.id, { method: "BKASH_SEND_MONEY", trxId: "rf12ab34cd" });
    expect(paid).toEqual({ amount: 1150, orderClosed: false });
    await fails(refundReturn(s.f.tenantId, s.owner, r.id, { method: "BKASH_SEND_MONEY", trxId: trx() }), "VALIDATION_ERROR", /Already refunded/);

    const ledger = await owner.refundLedger.findMany({ where: { orderId: o.orderId } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ method: "BKASH_SEND_MONEY", trxId: "RF12AB34CD", processedBy: s.owner.userId });
    expect(Number(ledger[0]!.amount)).toBe(1150);
    const after = await order(o.orderId);
    expect(after.paymentStatus).toBe("PARTIALLY_REFUNDED");
    expect(after.status).toBe("DELIVERED");
    expect(Number((await owner.customer.findFirstOrThrow({ where: { id: after.customerId! } })).totalSpent)).toBe(spentBefore - 1150);
    expect((await listReturns(s.f.tenantId, s.owner, "done"))[0]).toMatchObject({ status: "REFUNDED", refundMethod: "BKASH_SEND_MONEY" });
    expect((await owner.orderEvent.findMany({ where: { orderId: o.orderId, type: "RETURN" } })).length).toBeGreaterThanOrEqual(5);
    const actions = (await owner.auditLog.findMany({ where: { tenantId: s.f.tenantId, action: { startsWith: "return." } } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["return.created", "return.approved", "return.received", "return.refunded"]));
  });

  it("closes the order when everything has been paid back, and never pays back more than was paid", async () => {
    const s = await store("full");
    const o = await delivered(s);
    const total = Number((await order(o.orderId)).totalAmount);
    const r1 = await createReturn(s.f.tenantId, s.owner, { orderId: o.orderId, reason: "Not as described", type: "REFUND", items: [{ orderItemId: o.shirt.id, qty: 2 }, { orderItemId: o.chino.id, qty: 1 }] });
    await approveReturn(s.f.tenantId, s.owner, r1.id, { refundAmount: total });
    await receiveReturn(s.f.tenantId, s.owner, r1.id, { restock: true });
    await fails(refundReturn(s.f.tenantId, s.owner, r1.id, { method: "BKASH_SEND_MONEY", trxId: trx(), amount: total + 1 }), "VALIDATION_ERROR", /left to refund/);
    const res = await refundReturn(s.f.tenantId, s.owner, r1.id, { method: "BKASH_SEND_MONEY", trxId: trx() });
    expect(res).toEqual({ amount: total, orderClosed: true });
    const after = await order(o.orderId);
    expect(after.paymentStatus).toBe("REFUNDED");
    expect(after.status).toBe("REFUNDED");
    // A refund of more than the order total cannot even be approved.
    const o2 = await delivered(s);
    const r2 = await createReturn(s.f.tenantId, s.owner, { orderId: o2.orderId, reason: "Wrong size", type: "REFUND", items: [{ orderItemId: o2.shirt.id, qty: 1 }] });
    await fails(approveReturn(s.f.tenantId, s.owner, r2.id, { refundAmount: 999_999 }), "VALIDATION_ERROR", /more than the order total/);
  });

  it("two refunds at once cannot together pay out more than the customer paid", async () => {
    const s = await store("race");
    const o = await delivered(s);
    const total = Number((await order(o.orderId)).totalAmount);
    const ids: string[] = [];
    for (const item of [o.shirt, o.chino]) {
      const r = await createReturn(s.f.tenantId, s.owner, { orderId: o.orderId, reason: "Wrong size", type: "REFUND", items: [{ orderItemId: item.id, qty: 1 }] });
      await approveReturn(s.f.tenantId, s.owner, r.id, { refundAmount: total - 100 });
      await receiveReturn(s.f.tenantId, s.owner, r.id, { restock: false });
      ids.push(r.id);
    }
    const results = await Promise.allSettled(ids.map((id) => refundReturn(s.f.tenantId, s.owner, id, { method: "BKASH_SEND_MONEY", trxId: trx() })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const paid = (await owner.refundLedger.findMany({ where: { orderId: o.orderId } })).reduce((a, r) => a + Number(r.amount), 0);
    expect(paid).toBeLessThanOrEqual(total);
  });

  it("damaged goods are not put back on the shelf", async () => {
    const s = await store("damaged");
    const o = await delivered(s);
    const v = vid(s.f, 0, 1);
    const before = await stock(v);
    const r = await createReturn(s.f.tenantId, s.owner, { orderId: o.orderId, reason: "Damaged or defective", type: "REFUND", items: [{ orderItemId: o.shirt.id, qty: 1 }] });
    await approveReturn(s.f.tenantId, s.owner, r.id);
    await receiveReturn(s.f.tenantId, s.owner, r.id, { restock: false });
    expect(await stock(v)).toBe(before);
    expect((await owner.returnRequest.findUniqueOrThrow({ where: { id: r.id } })).restocked).toBe(false);
  });
});

describe("store credit", () => {
  it("adds to the customer's balance instead of sending money", async () => {
    const s = await store("credit");
    const o = await delivered(s);
    const r = await createReturn(s.f.tenantId, s.owner, { orderId: o.orderId, reason: "Changed my mind", type: "STORE_CREDIT", items: [{ orderItemId: o.chino.id, qty: 1 }] });
    await approveReturn(s.f.tenantId, s.owner, r.id);
    await receiveReturn(s.f.tenantId, s.owner, r.id, { restock: true });
    await refundReturn(s.f.tenantId, s.owner, r.id, { method: "STORE_CREDIT" });
    const c = await owner.customer.findFirstOrThrow({ where: { id: (await order(o.orderId)).customerId! } });
    expect(Number(c.storeCredit)).toBe(1290);
    const ledger = await owner.refundLedger.findFirstOrThrow({ where: { orderId: o.orderId } });
    expect(ledger).toMatchObject({ method: "STORE_CREDIT", trxId: null });
  });
});

describe("an exchange", () => {
  it("sets the replacement aside at approval, and completes when the old parcel is back", async () => {
    const s = await store("exchange");
    const o = await delivered(s);
    const old = vid(s.f, 0, 1);
    const replacement = vid(s.f, 0, 2); // the XL
    const oldBefore = await stock(old);
    const newBefore = await stock(replacement);

    const r = await createReturn(s.f.tenantId, s.owner, { orderId: o.orderId, reason: "Wrong size", type: "EXCHANGE", items: [{ orderItemId: o.shirt.id, qty: 1 }], exchangeVariantId: replacement });
    expect((await listReturns(s.f.tenantId, s.owner))[0]).toMatchObject({ refundAmount: null, exchangeVariantId: replacement });
    expect(await stock(replacement)).toBe(newBefore); // nothing reserved until approved
    await approveReturn(s.f.tenantId, s.owner, r.id);
    expect(await stock(replacement)).toBe(newBefore - 1);
    await receiveReturn(s.f.tenantId, s.owner, r.id, { restock: true });
    expect(await stock(old)).toBe(oldBefore + 1);
    expect(await stock(replacement)).toBe(newBefore - 1);
    expect((await listReturns(s.f.tenantId, s.owner, "done"))[0]).toMatchObject({ status: "EXCHANGED", exchangeLabel: expect.stringContaining("XL") });
    await fails(refundReturn(s.f.tenantId, s.owner, r.id, { method: "STORE_CREDIT" }), "VALIDATION_ERROR", /no refund/);
  });

  it("cannot be approved when the replacement is out of stock, and declining gives the replacement back", async () => {
    const s = await store("exchange2");
    const o = await delivered(s);
    const replacement = vid(s.f, 0, 2);
    await owner.productVariant.update({ where: { id: replacement }, data: { stockQuantity: 0 } });
    const r = await createReturn(s.f.tenantId, s.owner, { orderId: o.orderId, reason: "Wrong size", type: "EXCHANGE", items: [{ orderItemId: o.shirt.id, qty: 1 }], exchangeVariantId: replacement });
    await fails(approveReturn(s.f.tenantId, s.owner, r.id), "INSUFFICIENT_STOCK");
    expect((await owner.returnRequest.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("PENDING");

    await owner.productVariant.update({ where: { id: replacement }, data: { stockQuantity: 5 } });
    await approveReturn(s.f.tenantId, s.owner, r.id);
    expect(await stock(replacement)).toBe(4);
    await declineReturn(s.f.tenantId, s.owner, r.id, "outside the 7-day window");
    expect(await stock(replacement)).toBe(5);
    await fails(declineReturn(s.f.tenantId, s.owner, r.id, "again please"), "VALIDATION_ERROR");
  });

  it("lets the owner turn a refund request into an exchange when approving", async () => {
    const s = await store("switch");
    const o = await delivered(s);
    const replacement = vid(s.f, 0, 2);
    const r = await createReturn(s.f.tenantId, s.owner, { orderId: o.orderId, reason: "Wrong size", type: "REFUND", items: [{ orderItemId: o.shirt.id, qty: 1 }] });
    await approveReturn(s.f.tenantId, s.owner, r.id, { type: "EXCHANGE", exchangeVariantId: replacement });
    expect((await listReturns(s.f.tenantId, s.owner))[0]).toMatchObject({ type: "EXCHANGE", refundAmount: null, status: "APPROVED" });
    expect((await exchangeOptions(s.f.tenantId, s.owner)).some((x) => x.id === replacement)).toBe(true);
  });
});

describe("the returns screen", () => {
  it("counts each tab and the 30-day figures", async () => {
    const s = await store("metrics");
    const a = await delivered(s);
    const b = await delivered(s);
    const c = await delivered(s);
    await delivered(s);
    const r1 = await createReturn(s.f.tenantId, s.owner, { orderId: a.orderId, reason: "Wrong size", type: "REFUND", items: [{ orderItemId: a.shirt.id, qty: 1 }] });
    const r2 = await createReturn(s.f.tenantId, s.owner, { orderId: b.orderId, reason: "Wrong size", type: "REFUND", items: [{ orderItemId: b.shirt.id, qty: 1 }] });
    const r3 = await createReturn(s.f.tenantId, s.owner, { orderId: c.orderId, reason: "Wrong size", type: "REFUND", items: [{ orderItemId: c.shirt.id, qty: 1 }] });
    await approveReturn(s.f.tenantId, s.owner, r2.id);
    await markPickupBooked(s.f.tenantId, s.owner, r2.id);
    await declineReturn(s.f.tenantId, s.owner, r3.id, "too late");
    await approveReturn(s.f.tenantId, s.owner, r1.id);
    await receiveReturn(s.f.tenantId, s.owner, r1.id, { restock: true });
    await refundReturn(s.f.tenantId, s.owner, r1.id, { method: "BKASH_SEND_MONEY", trxId: trx() });
    expect(await returnTabCounts(s.f.tenantId, s.manager)).toEqual({ requested: 0, approved: 0, coming_back: 1, done: 1, declined: 1, all: 3 });
    const m = await getReturnMetrics(s.f.tenantId, s.manager);
    expect(m).toMatchObject({ waiting: 0, comingBack: 1, refunded30Days: 1150 });
    // 2 returns that were not declined, out of 4 delivered orders.
    expect(m.returnRatePercent).toBe(50);
    await fails(returnTabCounts(s.f.tenantId, { ...s.owner, role: "CONTENT_EDITOR" }), "FORBIDDEN");
  });
});
