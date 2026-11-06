import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  DomainError, advanceMethodsAvailable, advanceRuleFrom, computeAdvance, createOrder, expireUnpaidAdvanceOrders, getOrderDetail, isFullPrepayment, listOrders,
  quoteOrder, rejectPayment, savePaymentSettings, setEventPublisher, verifyPayment, type AdvanceRule, type StaffActor,
} from "../src";

const rule = (over: Partial<AdvanceRule> = {}): AdvanceRule => ({ mode: "FIXED", value: 200, minOrder: 0, payVia: "MANUAL", windowHours: 24, ...over });

describe("computeAdvance (pure)", () => {
  it("is zero when off, below the minimum, or for a total of nothing", () => {
    expect(computeAdvance(rule({ mode: "OFF" }), 1000)).toBe(0);
    expect(computeAdvance(rule({ minOrder: 1500 }), 1000)).toBe(0);
    expect(computeAdvance(rule(), 0)).toBe(0);
  });
  it("works out fixed, percentage and whole-order advances, never above the total", () => {
    expect(computeAdvance(rule({ mode: "FIXED", value: 200 }), 1000)).toBe(200);
    expect(computeAdvance(rule({ mode: "FIXED", value: 5000 }), 1000)).toBe(1000);
    expect(computeAdvance(rule({ mode: "PERCENT", value: 30 }), 1000)).toBe(300);
    expect(computeAdvance(rule({ mode: "PERCENT", value: 250 }), 1000)).toBe(1000);
    expect(computeAdvance(rule({ mode: "FULL" }), 1234.5)).toBe(1234.5);
  });
  it("ignores an advance under one taka so it cannot block an order", () => {
    expect(computeAdvance(rule({ mode: "PERCENT", value: 1 }), 50)).toBe(0);
  });
  it("only a whole-order rule prepays in full, and only from its minimum", () => {
    expect(isFullPrepayment(rule({ mode: "FULL", minOrder: 500 }), 600)).toBe(true);
    expect(isFullPrepayment(rule({ mode: "FULL", minOrder: 500 }), 400)).toBe(false);
    expect(isFullPrepayment(rule({ mode: "FIXED" }), 600)).toBe(false);
  });
  it("offers only the ways the store has switched on", () => {
    const all = { bkashReady: true, nagadReady: true, gatewayReady: true };
    expect(advanceMethodsAvailable(rule({ payVia: "MANUAL" }), all)).toEqual(["MANUAL_BKASH", "MANUAL_NAGAD"]);
    expect(advanceMethodsAvailable(rule({ payVia: "GATEWAY" }), all)).toEqual(["GATEWAY_UDDOKTAPAY"]);
    expect(advanceMethodsAvailable(rule({ payVia: "BOTH" }), { ...all, nagadReady: false })).toEqual(["MANUAL_BKASH", "GATEWAY_UDDOKTAPAY"]);
    expect(advanceMethodsAvailable(rule({ payVia: "MANUAL" }), { bkashReady: false, nagadReady: false, gatewayReady: true })).toEqual([]);
  });
  it("falls back to safe values for a store that never set the rule", () => {
    expect(advanceRuleFrom(null).mode).toBe("OFF");
    expect(advanceRuleFrom({ advanceMode: "nonsense", advanceWindowHours: 0 })).toMatchObject({ mode: "OFF", windowHours: 24 });
  });
});

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

const phone = () => `0151${String(1000000 + ++seq).slice(-7)}`;
const trx = () => `AD${Date.now().toString(36).toUpperCase()}${++seq}`.slice(0, 11).padEnd(9, "A");
const key = () => `adv-${Date.now()}-${++seq}`;
const vid = (f: TenantFixture, p = 0, v = 0) => f.products[p]!.variants[v]!.id;

async function store(name: string, adv: Record<string, unknown> = {}) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 100 });
  await owner.storeSettings.create({
    data: {
      tenantId: f.tenantId, storeName: name, contactPhone: "01712345678", bkashNumber: "01712345678", nagadNumber: "01812345678", codFee: 40,
      advanceMode: "FIXED", advanceValue: 50, advanceMinOrder: 0, advancePayVia: "MANUAL", advanceWindowHours: 24, ...adv,
    },
  });
  const ownerActor: StaffActor = { userId: `u-own-${seq}`, email: `own${seq}@example.test`, name: "Nusrat", role: "STORE_OWNER" };
  return { f, ownerActor };
}

const place = (f: TenantFixture, over: Record<string, unknown> = {}) =>
  createOrder(f.tenantId, {
    idempotencyKey: key(), customer: { name: "Test Buyer", phone: phone() },
    shipping: { address: "House 4, Road 2, Dhanmondi", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" },
    items: [{ variantId: vid(f), quantity: 1 }], paymentMethod: "COD", ...over,
  });
const bkashAdvance = (over: Record<string, unknown> = {}) => ({ advance: { method: "MANUAL_BKASH", mfs: { senderNumber: "01712345678", trxId: trx() } }, ...over });
const stockOf = async (id: string) => (await owner.productVariant.findUniqueOrThrow({ where: { id } })).stockQuantity;
const rejects = async (p: Promise<unknown>, code: string) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  return e as DomainError;
};

beforeAll(async () => {
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  await seedPlans(owner);
  setEventPublisher(async () => undefined);
});
afterAll(async () => {
  await owner?.$disconnect();
  await app?.$disconnect();
});

describe("advance payment at checkout", () => {
  it("asks for the advance and refuses a cash-on-delivery order without it", async () => {
    const { f } = await store("noadv");
    const e = await rejects(place(f), "VALIDATION_ERROR");
    expect(e.details?.field).toBe("advance");
  });

  it("takes the advance by bKash: the order waits for the owner, holds its stock, and has a deadline", async () => {
    const { f } = await store("bk");
    const before = await stockOf(vid(f));
    const r = await place(f, bkashAdvance());
    expect(r.advanceRequired).toBe(50);
    const o = await owner.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(o.paymentMethod).toBe("COD");
    expect(o.status).toBe("PENDING");
    expect(o.paymentStatus).toBe("PENDING_VERIFICATION");
    expect(Number(o.advanceRequiredAmount)).toBe(50);
    expect(Number(o.advancePaidAmount)).toBe(0);
    expect(o.advanceMethod).toBe("MANUAL_BKASH");
    expect(o.mfsTrxId).toBeTruthy();
    const hours = (o.advanceDueAt!.getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThan(24.1);
    expect(await stockOf(vid(f))).toBe(before - 1);
  });

  it("the owner confirming the TrxID confirms the order and leaves the balance for the courier", async () => {
    const { f, ownerActor } = await store("verify");
    const r = await place(f, bkashAdvance());
    await verifyPayment(f.tenantId, ownerActor, r.orderId);
    const o = await owner.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(o.status).toBe("CONFIRMED");
    expect(o.paymentStatus).toBe("PARTIALLY_PAID");
    expect(Number(o.advancePaidAmount)).toBe(50);
    expect(Number(o.balanceDue)).toBe(Number(o.totalAmount) - 50);
    // Confirming twice changes nothing.
    await verifyPayment(f.tenantId, ownerActor, r.orderId);
    const again = await owner.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(Number(again.advancePaidAmount)).toBe(50);
    const detail = await getOrderDetail(f.tenantId, ownerActor, r.orderId);
    expect(detail.advance).toMatchObject({ required: 50, paid: 50 });
  });

  it("a whole-order advance waives the cash-on-delivery fee and leaves nothing to collect", async () => {
    const { f, ownerActor } = await store("full", { advanceMode: "FULL", advanceValue: 0 });
    const r = await place(f, bkashAdvance());
    const o = await owner.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(Number(o.codFee)).toBe(0);
    expect(Number(o.advanceRequiredAmount)).toBe(Number(o.totalAmount));
    await verifyPayment(f.tenantId, ownerActor, r.orderId);
    const paid = await owner.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(paid.paymentStatus).toBe("PAID");
    expect(Number(paid.balanceDue)).toBe(0);
  });

  it("does not ask when the customer already pays the whole order, or the order is under the minimum", async () => {
    const { f } = await store("skip", { advanceMinOrder: 100_000 });
    const small = await place(f);
    expect(small.advanceRequired).toBeUndefined();
    const g = await store("skip2");
    const prepaid = await place(g.f, { paymentMethod: "MANUAL_BKASH", mfs: { senderNumber: "01712345678", trxId: trx() } });
    expect(prepaid.advanceRequired).toBeUndefined();
    const row = await owner.order.findUniqueOrThrow({ where: { id: prepaid.orderId } });
    expect(Number(row.advanceRequiredAmount)).toBe(0);
  });

  it("rejects a reused TrxID, a malformed one, and an online advance when the store only takes bKash/Nagad", async () => {
    const { f } = await store("guards");
    const t = trx();
    await place(f, { advance: { method: "MANUAL_BKASH", mfs: { senderNumber: "01712345678", trxId: t } } });
    await rejects(place(f, { advance: { method: "MANUAL_NAGAD", mfs: { senderNumber: "01712345678", trxId: t.toLowerCase() } } }), "VALIDATION_ERROR");
    await rejects(place(f, { advance: { method: "MANUAL_BKASH", mfs: { senderNumber: "01712345678", trxId: "12" } } }), "VALIDATION_ERROR");
    await rejects(place(f, { advance: { method: "MANUAL_BKASH" } }), "VALIDATION_ERROR");
    await rejects(place(f, { advance: { method: "GATEWAY_UDDOKTAPAY" } }), "VALIDATION_ERROR");
  });

  it("an online advance leaves the order unpaid until the gateway confirms, with no TrxID needed", async () => {
    const { f } = await store("gw", { advancePayVia: "GATEWAY" });
    const r = await place(f, { advance: { method: "GATEWAY_UDDOKTAPAY" } });
    expect(r.advanceMethod).toBe("GATEWAY_UDDOKTAPAY");
    const o = await owner.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(o.paymentStatus).toBe("UNPAID");
    expect(o.mfsTrxId).toBeNull();
    // bKash is not on offer when the store chose online-only.
    await rejects(place(f, bkashAdvance()), "VALIDATION_ERROR");
  });

  it("staff keying in an order are never asked for an advance", async () => {
    const { f } = await store("staff");
    const r = await place(f, { channel: "QUICK_PHONE", createdByUserId: "u1", createdByName: "Staff" });
    expect(r.advanceRequired).toBeUndefined();
  });

  it("shows the customer what is asked before they choose cash on delivery", async () => {
    const { f } = await store("quote");
    const q = await quoteOrder(f.tenantId, { items: [{ variantId: vid(f), quantity: 1 }], district: "Dhaka", paymentMethod: "COD" });
    expect(q.advance.amount).toBe(50);
    expect(q.advance.balance).toBeGreaterThan(0);
    expect(q.advance.full).toBe(false);
    expect(q.advance.payVia).toBe("MANUAL");
  });
});

describe("advance payment expiry", () => {
  const age = (id: string) => owner.order.update({ where: { id }, data: { advanceDueAt: new Date(Date.now() - 3_600_000) } });

  it("cancels an unpaid online advance after its deadline and puts the stock back", async () => {
    const { f } = await store("exp", { advancePayVia: "GATEWAY" });
    const before = await stockOf(vid(f));
    const r = await place(f, { advance: { method: "GATEWAY_UDDOKTAPAY" } });
    expect(await stockOf(vid(f))).toBe(before - 1);
    await age(r.orderId);
    const out = await expireUnpaidAdvanceOrders();
    expect(out.cancelled).toBeGreaterThanOrEqual(1);
    const o = await owner.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(o.status).toBe("CANCELLED");
    expect(await stockOf(vid(f))).toBe(before);
    const ev = await owner.orderEvent.findMany({ where: { orderId: r.orderId, type: "ADVANCE_EXPIRED" } });
    expect(ev).toHaveLength(1);
  });

  it("never cancels an order whose customer already sent a TrxID, or one that is still inside its window", async () => {
    const { f } = await store("keep");
    const paidWaiting = await place(f, bkashAdvance());
    await age(paidWaiting.orderId);
    const gw = await store("keep2", { advancePayVia: "GATEWAY" });
    const inWindow = await place(gw.f, { advance: { method: "GATEWAY_UDDOKTAPAY" } });
    await expireUnpaidAdvanceOrders();
    expect((await owner.order.findUniqueOrThrow({ where: { id: paidWaiting.orderId } })).status).toBe("PENDING");
    expect((await owner.order.findUniqueOrThrow({ where: { id: inWindow.orderId } })).status).toBe("PENDING");
  });

  it("also cancels an order whose advance the owner said never arrived, once its deadline has passed", async () => {
    const { f, ownerActor } = await store("rejected");
    const r = await place(f, bkashAdvance());
    await rejectPayment(f.tenantId, ownerActor, r.orderId, "not in my bKash history");
    await age(r.orderId);
    await expireUnpaidAdvanceOrders();
    expect((await owner.order.findUniqueOrThrow({ where: { id: r.orderId } })).status).toBe("CANCELLED");
  });

  it("lists the order as waiting for its advance", async () => {
    const { f, ownerActor } = await store("list", { advancePayVia: "GATEWAY" });
    const r = await place(f, { advance: { method: "GATEWAY_UDDOKTAPAY" } });
    const rows = (await listOrders(f.tenantId, ownerActor)).rows;
    expect(rows.find((x) => x.id === r.orderId)?.awaitingAdvance).toBe(true);
  });
});

describe("advance payment settings", () => {
  const base = { codEnabled: true, codFee: 0, codMaxAmount: null, bkashEnabled: true, bkashNumber: "01712345678", nagadEnabled: false } as const;

  it("saves a valid rule and refuses nonsense in plain words", async () => {
    const { f, ownerActor } = await store("settings", { advanceMode: "OFF" });
    await savePaymentSettings(f.tenantId, ownerActor, { ...base, advance: { mode: "PERCENT", value: 30, minOrder: 500, payVia: "BOTH", windowHours: 12 } });
    const s = await owner.storeSettings.findFirstOrThrow({ where: { tenantId: f.tenantId } });
    expect(s).toMatchObject({ advanceMode: "PERCENT", advancePayVia: "BOTH", advanceWindowHours: 12 });
    expect(Number(s.advanceValue)).toBe(30);
    await rejects(savePaymentSettings(f.tenantId, ownerActor, { ...base, advance: { mode: "PERCENT", value: 150, minOrder: 0, payVia: "BOTH", windowHours: 12 } }), "VALIDATION_ERROR");
    await rejects(savePaymentSettings(f.tenantId, ownerActor, { ...base, advance: { mode: "FIXED", value: 0, minOrder: 0, payVia: "BOTH", windowHours: 12 } }), "VALIDATION_ERROR");
    await rejects(savePaymentSettings(f.tenantId, ownerActor, { ...base, advance: { mode: "FIXED", value: 100, minOrder: 0, payVia: "BOTH", windowHours: 0 } }), "VALIDATION_ERROR");
    await rejects(savePaymentSettings(f.tenantId, ownerActor, { ...base, codEnabled: false, advance: { mode: "FIXED", value: 100, minOrder: 0, payVia: "MANUAL", windowHours: 24 } }), "VALIDATION_ERROR");
    await rejects(savePaymentSettings(f.tenantId, ownerActor, { ...base, bkashEnabled: false, nagadEnabled: false, advance: { mode: "FIXED", value: 100, minOrder: 0, payVia: "MANUAL", windowHours: 24 } }), "VALIDATION_ERROR");
  });

  it("leaves the rule alone when a save does not mention it", async () => {
    const { f, ownerActor } = await store("keeprule");
    await savePaymentSettings(f.tenantId, ownerActor, { ...base });
    const s = await owner.storeSettings.findFirstOrThrow({ where: { tenantId: f.tenantId } });
    expect(s.advanceMode).toBe("FIXED");
  });
});
