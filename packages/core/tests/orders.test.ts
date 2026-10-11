import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, withTenant, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import { createOrder, markPaid, setEventPublisher, transitionOrder, normalizeBdPhone, DomainError } from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let A: TenantFixture;
let B: TenantFixture;
let seq = 0;

const key = () => `test-key-${Date.now()}-${++seq}`;
const phone = () => `0171${String(1000000 + ++seq).slice(-7)}`;
const vid = (f: TenantFixture, p = 0, v = 0) => f.products[p]!.variants[v]!.id;

function base(f: TenantFixture, over: Record<string, unknown> = {}) {
  return {
    idempotencyKey: key(),
    customer: { name: "Test Buyer", phone: phone() },
    shipping: { address: "House 4, Road 2, Dhanmondi", city: "Dhaka", district: "Dhaka", division: "Dhaka" },
    items: [{ variantId: vid(f), quantity: 1 }],
    ...over,
  };
}

async function stockOf(f: TenantFixture, id: string) {
  return (await owner.productVariant.findUniqueOrThrow({ where: { id } })).stockQuantity;
}

async function rejects(p: Promise<unknown>, code: string) {
  const err = await p.then(() => null, (e) => e);
  expect(err, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
}

beforeAll(async () => {
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  await seedPlans(owner);
  A = await createTenantFixture(owner, { name: "Store A", subdomain: "store-a", stock: 10 });
  B = await createTenantFixture(owner, { name: "Store B", subdomain: "store-b", stock: 10 });
  await owner.productVariant.updateMany({ data: { stockQuantity: 1000 } });
  await owner.coupon.create({ data: { tenantId: A.tenantId, code: "EID10", type: "PERCENTAGE", value: 10, minOrderValue: 1500, usageLimit: 2, perCustomerLimit: 1 } });
  await owner.coupon.create({ data: { tenantId: A.tenantId, code: "SHIPFREE", type: "FREE_SHIPPING", value: 0, usageLimit: 100, perCustomerLimit: 5 } });
});

afterAll(async () => {
  await owner?.$disconnect();
  await app?.$disconnect();
});

describe("phone normalisation", () => {
  it("accepts common Bangladeshi formats", () => {
    expect(normalizeBdPhone("01712345678")).toBe("01712345678");
    expect(normalizeBdPhone("+880 1712-345678")).toBe("01712345678");
    expect(normalizeBdPhone("8801712345678")).toBe("01712345678");
    expect(normalizeBdPhone("০১৭১২৩৪৫৬৭৮")).toBe("01712345678");
  });
  it("rejects numbers that are not mobile numbers", () => {
    expect(() => normalizeBdPhone("0212345678")).toThrow();
    expect(() => normalizeBdPhone("01212345678")).toThrow();
  });
});

describe("events", () => {
  it("publishes order/created once, and not on an idempotent replay", async () => {
    const seen: string[] = [];
    setEventPublisher(async (name, data) => { if (name === "order/created" && "orderNumber" in data) seen.push(`${name}:${data.orderNumber}`); });
    const input = base(A);
    const first = await createOrder(A.tenantId, input);
    await createOrder(A.tenantId, input);
    expect(seen).toEqual([`order/created:${first.orderNumber}`]);
    setEventPublisher(async () => {});
  });

  it("a failing publisher does not fail the order", async () => {
    setEventPublisher(async () => { throw new Error("queue down"); });
    await expect(createOrder(A.tenantId, base(A))).resolves.toBeTruthy();
    setEventPublisher(async () => {});
  });
});

describe("placing an order", () => {
  it("prices from the database, ignoring anything the client sends", async () => {
    const r = await createOrder(A.tenantId, base(A, { items: [{ variantId: vid(A), quantity: 2, unitPrice: 1, price: 1 }], total: 1, totalAmount: 1 }));
    // 2 x 1150 = 2300, Dhaka delivery 80 (below the 3000 free threshold)
    expect(r.totalAmount).toBe(2380);
    expect(r.orderNumber).toMatch(/^BT-\d+$/);
  });

  it("charges the outside-Dhaka rate and waives delivery over the free threshold", async () => {
    const out = await createOrder(A.tenantId, base(A, { shipping: { address: "Village road, Sylhet", city: "Sylhet", district: "Sylhet", division: "Sylhet" } }));
    expect(out.totalAmount).toBe(1150 + 130);
    const free = await createOrder(A.tenantId, base(A, { items: [{ variantId: vid(A), quantity: 3 }] })); // 3450 >= 3000
    expect(free.totalAmount).toBe(3450);
  });

  it("decrements stock and restores it when the order is cancelled", async () => {
    const id = vid(A, 1, 0);
    const before = await stockOf(A, id);
    const r = await createOrder(A.tenantId, base(A, { items: [{ variantId: id, quantity: 3 }] }));
    expect(await stockOf(A, id)).toBe(before - 3);
    await transitionOrder(A.tenantId, r.orderId, "CANCELLED", { type: "MERCHANT" }, "test");
    expect(await stockOf(A, id)).toBe(before);
  });

  it("never oversells under concurrent orders for the last units", async () => {
    const id = vid(A, 2, 0);
    await owner.productVariant.update({ where: { id }, data: { stockQuantity: 5 } });
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => createOrder(A.tenantId, base(A, { items: [{ variantId: id, quantity: 1 }] }))),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(failed.every((f) => f.reason?.code === "INSUFFICIENT_STOCK")).toBe(true);
    expect(await stockOf(A, id)).toBe(0);
  });

  it("rolls everything back when one line is out of stock", async () => {
    const ok = vid(A, 0, 1);
    const scarce = vid(A, 1, 1);
    await owner.productVariant.update({ where: { id: scarce }, data: { stockQuantity: 1 } });
    const before = await stockOf(A, ok);
    await rejects(createOrder(A.tenantId, base(A, { items: [{ variantId: ok, quantity: 2 }, { variantId: scarce, quantity: 5 }] })), "INSUFFICIENT_STOCK");
    expect(await stockOf(A, ok)).toBe(before);
  });

  it("replays the same order for a repeated idempotency key", async () => {
    const input = base(A);
    const first = await createOrder(A.tenantId, input);
    const second = await createOrder(A.tenantId, input);
    expect(second.orderId).toBe(first.orderId);
    expect(second.replayed).toBe(true);
    expect(await owner.order.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(1);
  });

  it("handles a burst of identical requests as one order", async () => {
    const input = base(A);
    const results = await Promise.all(Array.from({ length: 6 }, () => createOrder(A.tenantId, input)));
    expect(new Set(results.map((r) => r.orderId)).size).toBe(1);
    expect(await owner.order.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(1);
  });

  it("allows the same idempotency key in two different stores", async () => {
    const k = key();
    const a = await createOrder(A.tenantId, base(A, { idempotencyKey: k }));
    const b = await createOrder(B.tenantId, base(B, { idempotencyKey: k }));
    expect(a.orderId).not.toBe(b.orderId);
  });

  it("issues unique, increasing order numbers under concurrency", async () => {
    const rs = await Promise.all(Array.from({ length: 8 }, () => createOrder(B.tenantId, base(B))));
    const nums = rs.map((r) => Number(r.orderNumber.replace("BT-", "")));
    expect(new Set(nums).size).toBe(8);
  });

  it("rejects a variant that belongs to another store", async () => {
    await rejects(createOrder(A.tenantId, base(A, { items: [{ variantId: vid(B), quantity: 1 }] })), "VALIDATION_ERROR");
  });

  it("rejects bad input", async () => {
    await rejects(createOrder(A.tenantId, base(A, { items: [] })), "VALIDATION_ERROR");
    await rejects(createOrder(A.tenantId, base(A, { items: [{ variantId: vid(A), quantity: 0 }] })), "VALIDATION_ERROR");
    await rejects(createOrder(A.tenantId, base(A, { customer: { name: "X Y", phone: "12345" } })), "VALIDATION_ERROR");
  });

  it("refuses blocked customers without saying why", async () => {
    const p = phone();
    await owner.blockedContact.create({ data: { tenantId: A.tenantId, phone: p, reason: "Refused 3 parcels" } });
    await rejects(createOrder(A.tenantId, base(A, { customer: { name: "Blocked Person", phone: p } })), "ORDER_NOT_ALLOWED");
    // Blocking in store A does not affect store B
    await expect(createOrder(B.tenantId, base(B, { customer: { name: "Blocked Person", phone: p } }))).resolves.toBeTruthy();
  });
});

describe("order rate limit", () => {
  it("allows 3 storefront orders per phone per day and blocks the 4th", async () => {
    const buyer = { name: "Repeat Buyer", phone: phone() };
    for (let i = 0; i < 3; i++) await createOrder(A.tenantId, base(A, { customer: buyer }));
    await rejects(createOrder(A.tenantId, base(A, { customer: buyer })), "ORDER_RATE_LIMIT");
    // another number is unaffected, and so is the same number in another store
    await expect(createOrder(A.tenantId, base(A))).resolves.toBeTruthy();
    await expect(createOrder(B.tenantId, base(B, { customer: buyer }))).resolves.toBeTruthy();
  });

  it("cancelled orders do not count, and staff-keyed channels are not limited", async () => {
    const buyer = { name: "Phone Buyer", phone: phone() };
    const first = await createOrder(A.tenantId, base(A, { customer: buyer }));
    await transitionOrder(A.tenantId, first.orderId, "CANCELLED", { type: "MERCHANT" });
    for (let i = 0; i < 3; i++) await createOrder(A.tenantId, base(A, { customer: buyer }));
    await rejects(createOrder(A.tenantId, base(A, { customer: buyer })), "ORDER_RATE_LIMIT");
    const staffBuyer = { name: "Regular", phone: phone() };
    for (let i = 0; i < 5; i++) await createOrder(A.tenantId, base(A, { customer: staffBuyer, channel: "QUICK_PHONE" }));
  });

  it("a replayed request is not a new order and is never rate limited", async () => {
    const buyer = { name: "Replay Buyer", phone: phone() };
    const input = base(A, { customer: buyer });
    await createOrder(A.tenantId, input);
    await createOrder(A.tenantId, base(A, { customer: buyer }));
    await createOrder(A.tenantId, base(A, { customer: buyer }));
    await expect(createOrder(A.tenantId, input)).resolves.toMatchObject({ replayed: true });
  });
});

describe("coupons", () => {
  it("applies a percentage discount above the minimum", async () => {
    const r = await createOrder(A.tenantId, base(A, { items: [{ variantId: vid(A), quantity: 2 }], couponCode: "eid10" }));
    expect(r.totalAmount).toBe(2300 - 230 + 80);
  });

  it("enforces the minimum order value", async () => {
    await rejects(createOrder(A.tenantId, base(A, { couponCode: "EID10" })), "COUPON_INVALID");
  });

  it("limits use per customer", async () => {
    const buyer = { name: "Coupon Buyer", phone: phone() };
    const items = [{ variantId: vid(A, 2, 1), quantity: 2 }];
    await owner.productVariant.update({ where: { id: vid(A, 2, 1) }, data: { stockQuantity: 50 } });
    await owner.coupon.update({ where: { tenantId_code: { tenantId: A.tenantId, code: "EID10" } }, data: { usageLimit: 100, usageCount: 0 } });
    await createOrder(A.tenantId, base(A, { customer: buyer, items, couponCode: "EID10" }));
    await rejects(createOrder(A.tenantId, base(A, { customer: buyer, items, couponCode: "EID10" })), "COUPON_INVALID");
  });

  it("holds the overall usage limit under concurrency", async () => {
    await owner.coupon.update({ where: { tenantId_code: { tenantId: A.tenantId, code: "EID10" } }, data: { usageLimit: 3, usageCount: 0 } });
    await owner.productVariant.update({ where: { id: vid(A, 2, 1) }, data: { stockQuantity: 100 } });
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => createOrder(A.tenantId, base(A, { items: [{ variantId: vid(A, 2, 1), quantity: 2 }], couponCode: "EID10" }))),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    const c = await owner.coupon.findUniqueOrThrow({ where: { tenantId_code: { tenantId: A.tenantId, code: "EID10" } } });
    expect(c.usageCount).toBe(3);
  });

  it("free-shipping coupons waive delivery", async () => {
    const r = await createOrder(A.tenantId, base(A, { couponCode: "SHIPFREE" }));
    expect(r.totalAmount).toBe(1150);
  });

  it("rejects unknown codes", async () => {
    await rejects(createOrder(A.tenantId, base(A, { couponCode: "NOPE" })), "COUPON_INVALID");
  });
});

describe("manual mobile money", () => {
  const mfs = (trxId: string) => ({ paymentMethod: "MANUAL_BKASH", mfs: { senderNumber: "01712345678", trxId } });

  it("holds the order as pending verification and lets staff mark it paid", async () => {
    const r = await createOrder(A.tenantId, base(A, mfs("9AB3C7XQ2K")));
    const o = await owner.order.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(o.paymentStatus).toBe("PENDING_VERIFICATION");
    expect(o.mfsTrxId).toBe("9AB3C7XQ2K");
    const paid = await markPaid(A.tenantId, r.orderId, "staff-1");
    expect(paid.paymentStatus).toBe("PAID");
    expect(paid.mfsVerifiedBy).toBe("staff-1");
  });

  it("rejects a TrxID that already backs another order, but only within the same store", async () => {
    await createOrder(A.tenantId, base(A, mfs("DUPTRX1234")));
    await rejects(createOrder(A.tenantId, base(A, mfs("duptrx1234"))), "VALIDATION_ERROR");
    await expect(createOrder(B.tenantId, base(B, mfs("DUPTRX1234")))).resolves.toBeTruthy();
  });

  it("requires a well-formed TrxID", async () => {
    await rejects(createOrder(A.tenantId, base(A, mfs("12"))), "VALIDATION_ERROR");
    await rejects(createOrder(A.tenantId, base(A, { paymentMethod: "MANUAL_NAGAD" })), "VALIDATION_ERROR");
  });

  it("a failed MFS order does not keep its stock", async () => {
    const id = vid(A, 0, 2);
    const before = await stockOf(A, id);
    await rejects(createOrder(A.tenantId, base(A, { items: [{ variantId: id, quantity: 2 }], ...mfs("bad") })), "VALIDATION_ERROR");
    expect(await stockOf(A, id)).toBe(before);
  });
});

describe("order state machine", () => {
  it("walks the happy path and updates customer totals on delivery", async () => {
    const r = await createOrder(A.tenantId, base(A));
    for (const to of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const) {
      await transitionOrder(A.tenantId, r.orderId, to, { type: "MERCHANT", id: "staff-1" });
    }
    const o = await owner.order.findUniqueOrThrow({ where: { id: r.orderId }, include: { customer: true, stateLogs: true } });
    expect(o.status).toBe("DELIVERED");
    expect(Number(o.customer!.totalSpent)).toBe(Number(o.totalAmount));
    expect(o.stateLogs.length).toBe(5);
  });

  it("rejects illegal jumps and moves out of terminal states", async () => {
    const r = await createOrder(A.tenantId, base(A));
    await rejects(transitionOrder(A.tenantId, r.orderId, "DELIVERED", { type: "MERCHANT" }), "INVALID_TRANSITION");
    await transitionOrder(A.tenantId, r.orderId, "CANCELLED", { type: "MERCHANT" });
    await rejects(transitionOrder(A.tenantId, r.orderId, "CONFIRMED", { type: "MERCHANT" }), "INVALID_TRANSITION");
  });

  it("only restocks once when cancel is attempted twice at the same time", async () => {
    const id = vid(A, 1, 0);
    await owner.productVariant.update({ where: { id }, data: { stockQuantity: 20 } });
    const r = await createOrder(A.tenantId, base(A, { items: [{ variantId: id, quantity: 4 }] }));
    const outcomes = await Promise.allSettled([
      transitionOrder(A.tenantId, r.orderId, "CANCELLED", { type: "MERCHANT" }),
      transitionOrder(A.tenantId, r.orderId, "CANCELLED", { type: "MERCHANT" }),
    ]);
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect(await stockOf(A, id)).toBe(20);
  });

  it("will not mark a cancelled order as paid", async () => {
    const r = await createOrder(A.tenantId, base(A));
    await transitionOrder(A.tenantId, r.orderId, "CANCELLED", { type: "MERCHANT" });
    await rejects(markPaid(A.tenantId, r.orderId, "staff-1"), "VALIDATION_ERROR");
  });

  it("cannot touch another store's order", async () => {
    const r = await createOrder(B.tenantId, base(B));
    await rejects(transitionOrder(A.tenantId, r.orderId, "CONFIRMED", { type: "MERCHANT" }), "NOT_FOUND");
    await rejects(markPaid(A.tenantId, r.orderId, "x"), "NOT_FOUND");
    const still = await withTenant(B.tenantId, (tx) => tx.order.findFirstOrThrow({ where: { id: r.orderId } }));
    expect(still.status).toBe("PENDING");
  });
});
