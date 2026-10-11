import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  DomainError, addressLooksIncomplete, blockPhone, computeTrust, createOrder, getFraudOverview, listBlocked, listFlaggedOrders, lookupPhone, phoneHash,
  releaseHold, holdOrder, setEventPublisher, transitionOrder, unblockPhone, type StaffActor, type TrustCounts,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

const phone = () => `0161${String(1000000 + ++seq).slice(-7)}`;
const key = () => `frd-${Date.now()}-${++seq}`;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const counts = (over: Partial<TrustCounts>): TrustCounts => ({ delivered30: 0, delivered90: 0, deliveredOld: 0, failed30: 0, failed90: 0, failedOld: 0, refused60: 0, stores: 1, ...over });

async function store(name: string) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 100 });
  await owner.storeSettings.create({ data: { tenantId: f.tenantId, storeName: name, contactPhone: "01712345678", bkashNumber: "01712345678", nagadNumber: "01812345678" } });
  const mk = (role: StaffActor["role"], n: string): StaffActor => ({ userId: `u-${n}-${seq}`, email: `${n}${seq}@example.test`, name: n, role });
  return { f, owner: mk("STORE_OWNER", "Nusrat"), manager: mk("STORE_MANAGER", "Kamrul"), packer: mk("ORDER_PACKER", "Rubel"), support: mk("TELEMARKETER", "Sumaiya") };
}
type Store = Awaited<ReturnType<typeof store>>;

const vid = (f: TenantFixture, p = 0, v = 0) => f.products[p]!.variants[v]!.id;
const place = (f: TenantFixture, over: Record<string, unknown> = {}) =>
  createOrder(f.tenantId, {
    idempotencyKey: key(), customer: { name: "Test Buyer", phone: phone() },
    shipping: { address: "House 4, Road 2, Dhanmondi", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" },
    items: [{ variantId: vid(f), quantity: 1 }], ...over,
  });
const merchant = (s: Store) => ({ type: "MERCHANT" as const, id: s.owner.userId, name: "Nusrat" });
const row = (id: string) => owner.order.findUniqueOrThrow({ where: { id } });
const fails = async (p: Promise<unknown>, code: string) => {
  const e = await p.then(() => null, (x) => x);
  expect(e).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
};

/** What other stores have already recorded about a number: the way a real history gets there. */
async function seedHistory(phoneNo: string, outcomes: { kind: "DELIVERED" | "RETURNED" | "REFUSED"; daysAgo: number }[]) {
  for (const [i, o] of outcomes.entries()) {
    await owner.$executeRaw`SELECT phone_trust_record(${phoneHash(phoneNo)}, ${sha(`seed:${phoneNo}:${i}`)}, ${sha(`store:${i % 3}`)}, ${o.kind}, ${new Date(Date.now() - o.daysAgo * 86_400_000)}::timestamptz)`;
  }
}

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

describe("the trust score", () => {
  it("a number nobody has shipped to is new, not risky", () => {
    expect(computeTrust(counts({}))).toMatchObject({ level: "NEW", score: null });
  });

  it("follows the doc's bands: above 75 trusted, 50 to 75 medium, below 50 high", () => {
    expect(computeTrust(counts({ delivered30: 14, failed30: 1 }))).toMatchObject({ level: "TRUSTED", score: 93 });
    expect(computeTrust(counts({ delivered30: 3, failed30: 1 }))).toMatchObject({ level: "MEDIUM", score: 75 });
    expect(computeTrust(counts({ delivered30: 5, failed30: 5 }))).toMatchObject({ level: "MEDIUM", score: 50 });
    expect(computeTrust(counts({ delivered30: 2, failed30: 3 }))).toMatchObject({ level: "HIGH", score: 40 });
  });

  it("weights recent parcels more than old ones", () => {
    const recentBad = computeTrust(counts({ delivered90: 4, failed30: 2 }));
    const oldBad = computeTrust(counts({ delivered30: 4, failedOld: 2 }));
    expect(oldBad.score!).toBeGreaterThan(recentBad.score!);
    // 4 delivered at 0.8 against 2 failed at 1.0: 3.2 / 5.2.
    expect(recentBad.score).toBe(Math.round((3.2 / 5.2) * 100));
  });

  it("takes 10 points off for each door refusal in the last 60 days, and never leaves 0 to 100", () => {
    expect(computeTrust(counts({ delivered30: 9, failed30: 1, refused60: 1 })).score).toBe(80);
    expect(computeTrust(counts({ delivered30: 1, failed30: 9, refused60: 9 })).score).toBe(0);
    expect(computeTrust(counts({ delivered30: 5 })).score).toBe(100);
  });

  it("one bad parcel alone is not enough to call someone high risk", () => {
    expect(computeTrust(counts({ failed30: 1 }))).toMatchObject({ level: "MEDIUM", score: 0 });
    expect(computeTrust(counts({ failed30: 2 }))).toMatchObject({ level: "HIGH", score: 0 });
  });
});

describe("the shared record", () => {
  it("is built from delivered and returned parcels in every store, keyed by a hash", async () => {
    const a = await store("trustA");
    const b = await store("trustB");
    const buyer = phone();
    const o1 = await place(a.f, { customer: { name: "Rahat", phone: buyer } });
    await transitionOrder(a.f.tenantId, o1.orderId, "CONFIRMED", merchant(a));
    await transitionOrder(a.f.tenantId, o1.orderId, "PROCESSING", merchant(a));
    await transitionOrder(a.f.tenantId, o1.orderId, "SHIPPED", merchant(a));
    await transitionOrder(a.f.tenantId, o1.orderId, "DELIVERED", merchant(a));

    const o2 = await place(b.f, { customer: { name: "R. Rahman", phone: buyer }, shipping: { address: "Flat 5B, Road 9, Mirpur", city: "Mirpur", district: "Dhaka", division: "Dhaka" } });
    for (const to of ["CONFIRMED", "PROCESSING", "SHIPPED"] as const) await transitionOrder(b.f.tenantId, o2.orderId, to, merchant(b));
    await transitionOrder(b.f.tenantId, o2.orderId, "RETURNED", merchant(b), "refused", { refused: true });

    // Store B can see the counts for the number, not store A's order.
    const seen = await lookupPhone(b.f.tenantId, b.owner, buyer);
    expect(seen.network).toMatchObject({ delivered: 1, failed: 1, refused: 1, stores: 2, level: "HIGH", score: 40 });
    expect(seen.here).toMatchObject({ orders: 1, returned: 1, delivered: 0 });

    // What is stored: a hash, an order hash, a store hash, an outcome and a time. Nothing that names a person or a store.
    const stored = await owner.phoneTrustEvent.findMany({ where: { phoneHash: phoneHash(buyer) } });
    expect(stored).toHaveLength(2);
    const dump = JSON.stringify(stored);
    for (const secret of [buyer, "Rahat", "Rahman", "Dhanmondi", "Mirpur", a.f.tenantId, b.f.tenantId, o1.orderId, o2.orderId]) expect(dump).not.toContain(secret);
    expect(await owner.phoneTrustStat.findUniqueOrThrow({ where: { phoneHash: phoneHash(buyer) } })).toMatchObject({ delivered: 1, refused: 1, returned: 0, storesSeen: 2 });
  });

  it("is invisible to the app role except through the two functions", async () => {
    await expect(app.$queryRaw`SELECT 1 FROM "PhoneTrustEvent" LIMIT 1`).rejects.toThrow(/permission denied/i);
    await expect(app.$queryRaw`SELECT 1 FROM "PhoneTrustStat" LIMIT 1`).rejects.toThrow(/permission denied/i);
    await expect(app.$executeRaw`INSERT INTO "PhoneTrustEvent" VALUES ('x','y','z','DELIVERED', now())`).rejects.toThrow(/permission denied/i);
    // The functions refuse malformed input.
    await expect(app.$executeRaw`SELECT phone_trust_record('short', 'short', 'short', 'DELIVERED', now())`).rejects.toThrow();
    await expect(app.$executeRaw`SELECT phone_trust_record(${sha("a")}, ${sha("b")}, ${sha("c")}, 'HACKED', now())`).rejects.toThrow();
  });

  it("keeps one outcome per order and corrects it if the parcel later comes back", async () => {
    const s = await store("correct");
    const buyer = phone();
    const o = await place(s.f, { customer: { name: "Xavi", phone: buyer } });
    for (const to of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const) await transitionOrder(s.f.tenantId, o.orderId, to, merchant(s));
    expect((await lookupPhone(s.f.tenantId, s.owner, buyer)).network).toMatchObject({ delivered: 1, failed: 0 });
    await transitionOrder(s.f.tenantId, o.orderId, "RETURNED", merchant(s), "courier correction");
    expect((await lookupPhone(s.f.tenantId, s.owner, buyer)).network).toMatchObject({ delivered: 0, failed: 1 });
    expect(await owner.phoneTrustEvent.count({ where: { phoneHash: phoneHash(buyer) } })).toBe(1);
    expect((await row(o.orderId)).trustRecorded).toBe("RETURNED");
  });

  it("does not record anything for orders that never shipped", async () => {
    const s = await store("cancelled");
    const buyer = phone();
    const o = await place(s.f, { customer: { name: "Xavi", phone: buyer } });
    await transitionOrder(s.f.tenantId, o.orderId, "CANCELLED", merchant(s));
    expect(await owner.phoneTrustEvent.count({ where: { phoneHash: phoneHash(buyer) } })).toBe(0);
  });

  it("looks a number up for staff, but not for a role that cannot see orders", async () => {
    const s = await store("lookup");
    const r = await lookupPhone(s.f.tenantId, s.support, "+88 0161-5550000");
    expect(r.phone).toBe("01615550000");
    expect(r.network.level).toBe("NEW");
    await expect(lookupPhone(s.f.tenantId, s.owner, "12345")).rejects.toThrow(/valid Bangladeshi mobile/);
    await expect(lookupPhone(s.f.tenantId, { ...s.owner, role: "CONTENT_EDITOR" }, "01615550000")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("scoring a new order", () => {
  it("a first-time buyer is processed normally", async () => {
    const s = await store("firsttime");
    const o = await place(s.f);
    const r = await row(o.orderId);
    expect(r).toMatchObject({ fraudRiskLevel: "LOW", fraudTrustScore: 85, fraudReview: null });
    expect(r.fraudFlags).toEqual(["FIRST_TIME_BUYER"]);
  });

  it("a trusted number scores from its history", async () => {
    const s = await store("trusted");
    const buyer = phone();
    await seedHistory(buyer, [...Array.from({ length: 9 }, () => ({ kind: "DELIVERED" as const, daysAgo: 10 })), { kind: "RETURNED" as const, daysAgo: 20 }]);
    const r = await row((await place(s.f, { customer: { name: "Aziz", phone: buyer } })).orderId);
    expect(r).toMatchObject({ fraudRiskLevel: "LOW", fraudTrustScore: 90, fraudReview: null });
    expect(r.fraudFlags).toEqual([]);
  });

  it("holds a cash-on-delivery order from a number with a poor record", async () => {
    const s = await store("holdme");
    const buyer = phone();
    await seedHistory(buyer, [{ kind: "DELIVERED", daysAgo: 5 }, { kind: "REFUSED", daysAgo: 6 }, { kind: "REFUSED", daysAgo: 12 }, { kind: "RETURNED", daysAgo: 15 }]);
    const o = await place(s.f, { customer: { name: "Aziz", phone: buyer } });
    const r = await row(o.orderId);
    expect(r.fraudRiskLevel).toBe("HIGH");
    expect(r.fraudReview).toBe("HELD");
    expect(r.fraudTrustScore).toBeLessThan(50);
    expect(r.fraudFlags).toContain("LOW_DELIVERY_SUCCESS");
    expect((await owner.orderEvent.findMany({ where: { orderId: o.orderId, type: "FRAUD" } })).length).toBe(1);

    const held = await listFlaggedOrders(s.f.tenantId, s.owner, "held");
    expect(held.map((h) => h.id)).toContain(o.orderId);
    expect(held[0]!.flags.map((f) => f.label)).toContain("Low delivery success across stores");
    expect((await getFraudOverview(s.f.tenantId, s.owner)).held).toBe(1);
  });

  it("scores but does not hold prepaid orders or orders a staff member keyed in after a call", async () => {
    const s = await store("noholds");
    const buyer = phone();
    await seedHistory(buyer, [{ kind: "REFUSED", daysAgo: 3 }, { kind: "REFUSED", daysAgo: 9 }, { kind: "RETURNED", daysAgo: 12 }]);
    const staff = await place(s.f, { customer: { name: "Aziz", phone: buyer }, channel: "QUICK_PHONE", createdByUserId: s.owner.userId, createdByName: "Nusrat" });
    expect(await row(staff.orderId)).toMatchObject({ fraudRiskLevel: "HIGH", fraudReview: null });
    const trxId = `TX${Date.now().toString(36).toUpperCase()}${++seq}`.slice(0, 11).padEnd(9, "A");
    const prepaid = await place(s.f, { customer: { name: "Aziz", phone: buyer }, paymentMethod: "MANUAL_BKASH", mfs: { senderNumber: "01712345678", trxId } });
    expect(await row(prepaid.orderId)).toMatchObject({ fraudRiskLevel: "HIGH", fraudReview: null });
  });

  it("flags a big cash-on-delivery order from a new number, and a half-written address", async () => {
    const s = await store("flags");
    const big = await place(s.f, { items: [{ variantId: vid(s.f, 2), quantity: 5 }] }); // 5 x 1290 plus delivery, over 5000
    expect((await row(big.orderId)).fraudFlags).toContain("HIGH_VALUE_COD_NEW_NUMBER");
    expect((await row(big.orderId)).fraudTrustScore).toBe(75);
    expect((await row(big.orderId)).fraudRiskLevel).toBe("MEDIUM");
    const vague = await place(s.f, { shipping: { address: "Dhaka", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" } });
    expect((await row(vague.orderId)).fraudFlags).toContain("ADDRESS_INCOMPLETE");
    // Prepaid is not a cash risk.
    const trxId = `TX${Date.now().toString(36).toUpperCase()}${++seq}`.slice(0, 11).padEnd(9, "A");
    const paid = await place(s.f, { items: [{ variantId: vid(s.f, 2), quantity: 5 }], paymentMethod: "MANUAL_BKASH", mfs: { senderNumber: "01712345678", trxId } });
    expect((await row(paid.orderId)).fraudFlags).not.toContain("HIGH_VALUE_COD_NEW_NUMBER");
  });

  it("notices one number used for different districts within a month", async () => {
    const s = await store("multi");
    const buyer = phone();
    await place(s.f, { customer: { name: "Aziz", phone: buyer } });
    const second = await place(s.f, { customer: { name: "Aziz", phone: buyer }, shipping: { address: "Road 3, House 9, Agrabad", city: "Kotwali", district: "Chattogram", division: "Chattogram" } });
    expect((await row(second.orderId)).fraudFlags).toContain("PHONE_MULTIPLE_ADDRESSES");
  });

  it("recognises incomplete addresses", () => {
    expect(addressLooksIncomplete("Dhaka")).toBe(true);
    expect(addressLooksIncomplete("near bazar")).toBe(true);
    expect(addressLooksIncomplete("House 12, Road 5")).toBe(false);
    expect(addressLooksIncomplete("Beside the big mosque, Dhanmondi")).toBe(false);
  });
});

describe("the owner's controls", () => {
  it("release and re-hold are recorded and need permission", async () => {
    const s = await store("controls");
    const buyer = phone();
    await seedHistory(buyer, [{ kind: "REFUSED", daysAgo: 3 }, { kind: "REFUSED", daysAgo: 9 }, { kind: "RETURNED", daysAgo: 12 }]);
    const o = await place(s.f, { customer: { name: "Aziz", phone: buyer } });
    await fails(releaseHold(s.f.tenantId, s.support, o.orderId), "FORBIDDEN");
    await releaseHold(s.f.tenantId, s.manager, o.orderId, "called, wants it");
    expect((await row(o.orderId)).fraudReview).toBe("CLEARED");
    expect((await listFlaggedOrders(s.f.tenantId, s.owner, "held")).map((h) => h.id)).not.toContain(o.orderId);
    expect((await listFlaggedOrders(s.f.tenantId, s.owner, "watch")).map((h) => h.id)).toContain(o.orderId);
    await holdOrder(s.f.tenantId, s.owner, o.orderId, "second thoughts");
    expect((await row(o.orderId)).fraudReview).toBe("HELD");
    const actions = (await owner.auditLog.findMany({ where: { tenantId: s.f.tenantId }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["fraud.hold_released", "fraud.held"]);
    // A shipped order cannot be put on hold.
    await transitionOrder(s.f.tenantId, o.orderId, "CANCELLED", merchant(s));
    await fails(holdOrder(s.f.tenantId, s.owner, o.orderId), "VALIDATION_ERROR");
  });

  it("a blocked number cannot order, in that store only, until unblocked", async () => {
    const a = await store("blockA");
    const b = await store("blockB");
    const bad = phone();
    await fails(blockPhone(a.f.tenantId, a.packer, bad, "refused 3 parcels"), "FORBIDDEN");
    await blockPhone(a.f.tenantId, a.owner, bad, "refused 3 parcels");
    await fails(place(a.f, { customer: { name: "Xavi", phone: bad } }), "ORDER_NOT_ALLOWED");
    await place(b.f, { customer: { name: "Xavi", phone: bad } }); // other stores are unaffected
    const list = await listBlocked(a.f.tenantId, a.support);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ phone: bad, reason: "refused 3 parcels" });
    expect(await listBlocked(b.f.tenantId, b.owner)).toHaveLength(0);
    await unblockPhone(a.f.tenantId, a.owner, list[0]!.id);
    await place(a.f, { customer: { name: "Xavi", phone: bad } });
  });

  it("validates the number and the reason, and cannot unblock another store's entry", async () => {
    const a = await store("blockval");
    const b = await store("blockval2");
    await expect(blockPhone(a.f.tenantId, a.owner, "123", "reason here")).rejects.toThrow(/valid Bangladeshi/);
    await expect(blockPhone(a.f.tenantId, a.owner, phone(), " ")).rejects.toThrow(/briefly why/);
    await blockPhone(a.f.tenantId, a.owner, phone(), "spam orders");
    const entry = (await listBlocked(a.f.tenantId, a.owner))[0]!;
    await fails(unblockPhone(b.f.tenantId, b.owner, entry.id), "NOT_FOUND");
  });
});
