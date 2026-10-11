import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  DomainError, DraftConflictError, adjustPoints, clearBirthday, createOrder, defaultHomePage, expireInactivePoints, getAccountView, getPublishedPage, hashClient, isModuleOn, listModules, listOrders,
  listPublishedPosts, loadForEdit, parsePublishAt, saveContent, saveDraft, saveLoyaltySettings, sendBirthdayVouchers, setBirthday, setEventPublisher, setModule, setSmsSender, sweepLoyalty,
  transitionOrder, updateShippingAddress, type SmsSender, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const key = () => `p10-${Date.now()}-${++seq}`;
const phone = () => `0151${String(4000000 + ++seq).slice(-7)}`;
const DAY = 86_400_000;

class Outbox implements SmsSender {
  sent: { to: string; text: string }[] = [];
  async send(_t: string, to: string, text: string) {
    this.sent.push({ to, text });
  }
}
const sms = new Outbox();

async function store(name: string, tier: "STARTER" | "PRO" | "BUSINESS" = "BUSINESS", settings: Record<string, unknown> = {}) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 300 });
  await owner.storeSettings.create({ data: { tenantId: f.tenantId, storeName: name, contactPhone: "01712345678", loyaltyEnabled: true, referralEnabled: true, ...settings } });
  await owner.tenant.update({ where: { id: f.tenantId }, data: { planTier: tier } });
  const mk = (role: StaffActor["role"]): StaffActor => ({ userId: `u-${role}-${seq}`, email: `${role}${seq}@example.test`, name: role, role });
  return { f, owner: mk("STORE_OWNER"), editor: mk("CONTENT_EDITOR"), packer: mk("ORDER_PACKER") };
}
type Store = Awaited<ReturnType<typeof store>>;
const vid = (f: TenantFixture) => f.products[0]!.variants[0]!.id;
const place = (f: TenantFixture, ph: string, over: Record<string, unknown> = {}) =>
  createOrder(f.tenantId, {
    idempotencyKey: key(), customer: { name: "Tania Akter", phone: ph }, shipping: { address: `House ${seq}, Road 2, Dhanmondi`, city: "Dhanmondi", district: "Dhaka", division: "Dhaka" },
    items: [{ variantId: vid(f), quantity: 1 }], ...over,
  });
const deliver = async (f: TenantFixture, orderId: string) => {
  for (const to of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const) await transitionOrder(f.tenantId, orderId, to, { type: "MERCHANT" });
};
const customerOf = (f: TenantFixture, ph: string) => owner.customer.findFirstOrThrow({ where: { tenantId: f.tenantId, phone: ph } });
const acct = async (f: TenantFixture, ph: string) => owner.customerLoyaltyAccount.findFirstOrThrow({ where: { customerId: (await customerOf(f, ph)).id } });
const fails = async (p: Promise<unknown>, msg: RegExp, field?: string) => {
  const e = await p.then(() => null, (x) => x);
  expect(e).toBeInstanceOf(DomainError);
  expect((e as DomainError).message).toMatch(msg);
  if (field) expect((e as DomainError).details?.field).toBe(field);
};
/** A member at Gold: one big delivered order. */
async function gold(S: Store, ph = phone()) {
  const o = await place(S.f, ph, { items: [{ variantId: vid(S.f), quantity: 14 }] });
  await deliver(S.f, o.orderId);
  return { ph, customerId: (await customerOf(S.f, ph)).id };
}
const ago = (id: string, days: number) => owner.$executeRaw`UPDATE "LoyaltyTransaction" SET "createdAt" = ${new Date(Date.now() - days * DAY)} WHERE "accountId" = ${id}`;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "bt.test";
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  await seedPlans(owner);
});
beforeEach(() => {
  setEventPublisher(async () => {});
  sms.sent = [];
  setSmsSender(sms);
});
afterAll(async () => {
  await app.$disconnect();
  await owner.$disconnect();
});

describe("levels set by the store", () => {
  it("use the store's own thresholds and discounts", async () => {
    const S = await store("lv1", "BUSINESS", { vipSilverMin: 1000, vipGoldMin: 2000, vipPlatinumMin: 3000, vipGoldDiscount: 7, vipPlatinumDiscount: 12 });
    const ph = phone();
    const o = await place(S.f, ph, { items: [{ variantId: vid(S.f), quantity: 2 }] }); // 2,300
    await deliver(S.f, o.orderId);
    expect((await acct(S.f, ph)).currentTier).toBe("GOLD");
    const next = await place(S.f, ph, { verifiedCustomerId: (await customerOf(S.f, ph)).id });
    expect(Number((await owner.order.findUniqueOrThrow({ where: { id: next.orderId } })).tierDiscountBdt)).toBe(80.5); // 7% of 1,150
  });

  it("must go up, and the settings screen refuses ones that do not", async () => {
    const S = await store("lv2");
    const base = { enabled: "on", spendPerPoint: 100, pointsPerBlock: 10, bdtPerBlock: 10, maxCartPercent: 30, refereeDiscount: 50, refereeMinCart: 500, referrerReward: 100 };
    await fails(saveLoyaltySettings(S.f.tenantId, S.owner, { ...base, vipSilverMin: 5000, vipGoldMin: 4000, vipPlatinumMin: 9000 }), /must go up/, "vipGoldMin");
    await fails(saveLoyaltySettings(S.f.tenantId, S.owner, { ...base, vipGoldDiscount: 10, vipPlatinumDiscount: 5 }), /at least as much/, "vipPlatinumDiscount");
    await fails(saveLoyaltySettings(S.f.tenantId, S.owner, { ...base, expiryMonths: 99 }), /Months before/);
    await saveLoyaltySettings(S.f.tenantId, S.owner, { ...base, expiryMonths: 12, vipSilverMin: 2000, vipGoldMin: 6000, vipPlatinumMin: 12000, birthdayVoucher: 150 });
    const row = await owner.storeSettings.findFirstOrThrow({ where: { tenantId: S.f.tenantId } });
    expect(row).toMatchObject({ loyaltyExpiryMonths: 12, vipSilverMin: 2000, birthdayVoucherBdt: 150 });
  });
});

describe("points spent on a returned order", () => {
  it("go back to the customer, while the points the order earned are taken away", async () => {
    const S = await store("ret1");
    const ph = phone();
    const first = await place(S.f, ph);
    await deliver(S.f, first.orderId);
    await adjustPoints(S.f.tenantId, S.owner, (await customerOf(S.f, ph)).id, 100, "gift");
    const before = (await acct(S.f, ph)).availablePoints;
    const o = await place(S.f, ph, { redeemPoints: 50, verifiedCustomerId: (await customerOf(S.f, ph)).id });
    expect((await acct(S.f, ph)).availablePoints).toBe(before - 50);
    await deliver(S.f, o.orderId);
    const afterDelivery = (await acct(S.f, ph)).availablePoints;
    await transitionOrder(S.f.tenantId, o.orderId, "RETURNED", { type: "MERCHANT" });
    const earned = (await owner.loyaltyTransaction.findFirstOrThrow({ where: { orderId: o.orderId, type: "EARN_PURCHASE" } })).points;
    expect((await acct(S.f, ph)).availablePoints).toBe(afterDelivery + 50 - earned);
    expect((await owner.loyaltyTransaction.findFirstOrThrow({ where: { orderId: o.orderId, type: "REDEEM_PURCHASE" } })).status).toBe("VOIDED");
  });
});

describe("points that expire", () => {
  it("do nothing when the store has no expiry", async () => {
    const S = await store("ex0");
    const ph = phone();
    await deliver(S.f, (await place(S.f, ph)).orderId);
    await ago((await acct(S.f, ph)).id, 900);
    expect(await expireInactivePoints(S.f.tenantId)).toEqual({ expired: 0, points: 0, warned: 0 });
    expect((await acct(S.f, ph)).availablePoints).toBeGreaterThan(0);
  });

  it("take the balance of someone who has been inactive too long, once, and keep it in the history", async () => {
    const S = await store("ex1", "BUSINESS", { loyaltyExpiryMonths: 6 });
    const stale = phone(), fresh = phone();
    await deliver(S.f, (await place(S.f, stale)).orderId);
    await deliver(S.f, (await place(S.f, fresh)).orderId);
    const staleAcct = await acct(S.f, stale);
    await ago(staleAcct.id, 400);
    await owner.order.updateMany({ where: { customerPhone: stale }, data: { deliveredAt: new Date(Date.now() - 400 * DAY) } });
    const had = staleAcct.availablePoints;
    const r = await expireInactivePoints(S.f.tenantId);
    expect(r).toMatchObject({ expired: 1, points: had });
    expect((await acct(S.f, stale)).availablePoints).toBe(0);
    expect((await acct(S.f, fresh)).availablePoints).toBeGreaterThan(0);
    expect(await owner.loyaltyTransaction.findFirstOrThrow({ where: { accountId: staleAcct.id, type: "EXPIRED" } })).toMatchObject({ points: -had, status: "CONFIRMED" });
    expect(await expireInactivePoints(S.f.tenantId)).toMatchObject({ expired: 0 });
  });

  it("warn once, about two weeks before, and a new order starts the clock again", async () => {
    const S = await store("ex2", "BUSINESS", { loyaltyExpiryMonths: 6 });
    const ph = phone();
    await deliver(S.f, (await place(S.f, ph)).orderId);
    const a = await acct(S.f, ph);
    await ago(a.id, 6 * 30.4375 - 7); // a week from the deadline
    sms.sent = [];
    expect(await expireInactivePoints(S.f.tenantId)).toMatchObject({ expired: 0, warned: 1 });
    expect(sms.sent.filter((m) => m.to === ph)).toHaveLength(1);
    expect(await expireInactivePoints(S.f.tenantId)).toMatchObject({ warned: 0 });
    expect(sms.sent.filter((m) => m.to === ph)).toHaveLength(1);
    // A fresh order: nothing expires.
    await place(S.f, ph);
    await ago(a.id, 6 * 30.4375 + 5).then(() => owner.loyaltyTransaction.updateMany({ where: { accountId: a.id, orderId: { not: null }, status: "PENDING" }, data: { createdAt: new Date() } }));
    expect(await expireInactivePoints(S.f.tenantId)).toMatchObject({ expired: 0 });
  });

  it("are left alone when the plan does not include the module", async () => {
    const S = await store("ex3", "STARTER", { loyaltyExpiryMonths: 1 });
    const ph = phone();
    await deliver(S.f, (await place(S.f, ph)).orderId);
    expect(await owner.customerLoyaltyAccount.count({ where: { tenantId: S.f.tenantId } })).toBe(0);
  });

  it("run for every store from the daily job, one failure not stopping the rest", async () => {
    const S = await store("ex4", "BUSINESS", { loyaltyExpiryMonths: 3 });
    const ph = phone();
    await deliver(S.f, (await place(S.f, ph)).orderId);
    await ago((await acct(S.f, ph)).id, 300);
    await owner.order.updateMany({ where: { customerPhone: ph }, data: { deliveredAt: new Date(Date.now() - 300 * DAY) } });
    const r = await sweepLoyalty();
    expect(r.expired).toBeGreaterThanOrEqual(1);
    expect(r.failed).toBe(0);
  });
});

describe("birthday vouchers", () => {
  const at = (month: number, day: number, year = 2027) => new Date(Date.UTC(year, month - 1, day, 4, 0, 0)); // 10:00 in Dhaka
  async function silver(S: Store, month: number, day: number) {
    const ph = phone();
    await deliver(S.f, (await place(S.f, ph, { items: [{ variantId: vid(S.f), quantity: 5 }] })).orderId);
    const customerId = (await customerOf(S.f, ph)).id;
    await owner.customer.update({ where: { id: customerId }, data: { birthMonth: month, birthDay: day } });
    return { ph, customerId };
  }

  it("go to a Silver-or-higher member on the day, once a year, as a one-use coupon, with a message", async () => {
    const S = await store("bd1");
    const m = await silver(S, 3, 14);
    expect(await sendBirthdayVouchers(S.f.tenantId, at(3, 13))).toBe(0);
    expect(await sendBirthdayVouchers(S.f.tenantId, at(3, 14))).toBe(1);
    const c = await owner.coupon.findFirstOrThrow({ where: { tenantId: S.f.tenantId, code: { startsWith: "BDAY-" } } });
    expect(c).toMatchObject({ type: "FIXED_AMOUNT", usageLimit: 1, perCustomerLimit: 1, isActive: true });
    expect(Number(c.value)).toBe(100);
    expect(c.expiresAt!.getTime() - c.startsAt.getTime()).toBeGreaterThan(13 * DAY);
    expect(sms.sent.some((x) => x.to === m.ph && x.text.includes(c.code))).toBe(true);
    // The job running again the same day, or later that year, sends nothing.
    expect(await sendBirthdayVouchers(S.f.tenantId, at(3, 14))).toBe(0);
    expect(await sendBirthdayVouchers(S.f.tenantId, at(3, 14, 2028))).toBe(1);
  });

  it("skip a Bronze member, a store with the voucher off, and someone with no birthday", async () => {
    const S = await store("bd2");
    const ph = phone();
    await place(S.f, ph);
    await owner.customer.update({ where: { id: (await customerOf(S.f, ph)).id }, data: { birthMonth: 5, birthDay: 5 } });
    expect(await sendBirthdayVouchers(S.f.tenantId, at(5, 5))).toBe(0);
    const O = await store("bd3", "BUSINESS", { birthdayVoucherBdt: 0 });
    await silver(O, 6, 6);
    expect(await sendBirthdayVouchers(O.f.tenantId, at(6, 6))).toBe(0);
    const N = await store("bd4");
    const ph2 = phone();
    await deliver(N.f, (await place(N.f, ph2, { items: [{ variantId: vid(N.f), quantity: 5 }] })).orderId);
    expect(await sendBirthdayVouchers(N.f.tenantId, at(7, 7))).toBe(0);
  });

  it("treat 29 February as the 28th in a year without one", async () => {
    const S = await store("bd5");
    await silver(S, 2, 29);
    expect(await sendBirthdayVouchers(S.f.tenantId, at(2, 28, 2027))).toBe(1);
  });

  it("are two runs at once, still one voucher", async () => {
    const S = await store("bd6");
    await silver(S, 8, 8);
    const r = await Promise.all([sendBirthdayVouchers(S.f.tenantId, at(8, 8)), sendBirthdayVouchers(S.f.tenantId, at(8, 8)), sendBirthdayVouchers(S.f.tenantId, at(8, 8))]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("need a real date, can be given once by the customer, and cleared by staff", async () => {
    const S = await store("bd7");
    const ph = phone();
    await place(S.f, ph);
    const cid = (await customerOf(S.f, ph)).id;
    await fails(setBirthday(S.f.tenantId, cid, 2, 30), /real date/);
    await fails(setBirthday(S.f.tenantId, cid, 13, 1), /real date/);
    await setBirthday(S.f.tenantId, cid, 2, 29);
    await fails(setBirthday(S.f.tenantId, cid, 3, 3), /already saved/);
    expect((await getAccountView(S.f.tenantId, cid))!.birth).toEqual({ month: 2, day: 29 });
    await fails(clearBirthday(S.f.tenantId, S.packer, cid), /access/);
    await clearBirthday(S.f.tenantId, S.owner, cid);
    await setBirthday(S.f.tenantId, cid, 4, 4);
  });
});

describe("priority packing", () => {
  it("marks a Gold member's order and puts it first on the to-pack list", async () => {
    const S = await store("pp1");
    const g = await gold(S);
    const plain = await place(S.f, phone());
    await transitionOrder(S.f.tenantId, plain.orderId, "CONFIRMED", { type: "MERCHANT" });
    const vip = await place(S.f, g.ph);
    await transitionOrder(S.f.tenantId, vip.orderId, "CONFIRMED", { type: "MERCHANT" });
    expect((await owner.order.findUniqueOrThrow({ where: { id: vip.orderId } })).priorityPacking).toBe(true);
    expect((await owner.order.findUniqueOrThrow({ where: { id: plain.orderId } })).priorityPacking).toBe(false);
    const list = await listOrders(S.f.tenantId, S.owner, { tab: "to_pack" });
    expect(list.rows.map((r) => r.id)).toEqual([vip.orderId, plain.orderId]);
    expect(list.rows[0]!.priority).toBe(true);
  });
});

describe("a friend on the referrer's own connection", () => {
  it("is refused, while a friend on another connection is not", async () => {
    const S = await store("cn1");
    const ph = phone();
    const home = hashClient("203.0.113.5")!;
    await deliver(S.f, (await place(S.f, ph, { clientHash: home })).orderId);
    const code = (await acct(S.f, ph)).referralCode;
    const addr = { address: "Flat 5, Road 8, Gulshan", city: "Gulshan", district: "Dhaka", division: "Dhaka" };
    await fails(place(S.f, phone(), { referralCode: code, clientHash: home, shipping: addr }), /same connection/, "referral");
    const ok = await place(S.f, phone(), { referralCode: code, clientHash: hashClient("198.51.100.9"), shipping: addr });
    expect(Number((await owner.order.findUniqueOrThrow({ where: { id: ok.orderId } })).referralDiscountBdt)).toBe(50);
  });

  it("is hashed with a key, stable, and never the address itself", () => {
    const h = hashClient("203.0.113.5")!;
    expect(h).toMatch(/^[a-f0-9]{32}$/);
    expect(h).toBe(hashClient("203.0.113.5"));
    expect(h).not.toContain("203");
    expect(hashClient("203.0.113.6")).not.toBe(h);
    expect(hashClient(null)).toBeUndefined();
  });
});

describe("free delivery that was earned", () => {
  it("stays free when the address is changed to another district", async () => {
    const S = await store("fd1", "BUSINESS", { vipPlatinumMin: 3000, vipGoldMin: 2000, vipSilverMin: 1000 });
    const ph = phone();
    await deliver(S.f, (await place(S.f, ph, { items: [{ variantId: vid(S.f), quantity: 4 }] })).orderId);
    expect((await acct(S.f, ph)).currentTier).toBe("PLATINUM");
    const o = await place(S.f, ph, { verifiedCustomerId: (await customerOf(S.f, ph)).id });
    let row = await owner.order.findUniqueOrThrow({ where: { id: o.orderId } });
    expect(row.deliveryWaived).toBe(true);
    expect(Number(row.deliveryCharge)).toBe(0);
    await updateShippingAddress(S.f.tenantId, S.owner, o.orderId, { line: "House 1, Road 2, Zindabazar", area: "Sylhet Sadar", district: "Sylhet", division: "Sylhet" });
    row = await owner.order.findUniqueOrThrow({ where: { id: o.orderId } });
    expect(Number(row.deliveryCharge)).toBe(0);
    // A normal order changes price with the district, as before.
    const plain = await place(S.f, phone());
    expect((await owner.order.findUniqueOrThrow({ where: { id: plain.orderId } })).deliveryWaived).toBe(false);
  });
});

describe("pages and posts that are scheduled", () => {
  it("read a date in Bangladesh time and refuse nonsense", () => {
    expect(parsePublishAt("2026-12-01T09:00")!.toISOString()).toBe("2026-12-01T03:00:00.000Z");
    expect(parsePublishAt("")).toBeNull();
    expect(parsePublishAt(undefined)).toBeNull();
    expect(() => parsePublishAt("tomorrow")).toThrow(/date and time/);
    expect(() => parsePublishAt("2026-13-45T99:99")).toThrow(/date and time/);
  });

  it("stay hidden until their time, then appear without anyone doing anything", async () => {
    const S = await store("sc1");
    const soon = new Date(Date.now() + 2 * DAY).toISOString().slice(0, 16);
    const { id } = await saveContent(S.f.tenantId, S.owner, "page", null, { title: "Eid hours", body: "Open late.", isPublished: true, publishAt: new Date(Date.now() + 2 * DAY + 6 * 3600_000).toISOString().slice(0, 16) });
    void soon;
    expect(await getPublishedPage(S.f.tenantId, "eid-hours")).toBeNull();
    await owner.page.update({ where: { id }, data: { publishAt: new Date(Date.now() - 60_000) } });
    expect(await getPublishedPage(S.f.tenantId, "eid-hours")).toMatchObject({ title: "Eid hours" });
    // Switched off beats the schedule.
    await owner.page.update({ where: { id }, data: { isPublished: false } });
    expect(await getPublishedPage(S.f.tenantId, "eid-hours")).toBeNull();
  });

  it("apply to blog posts and the list too", async () => {
    const S = await store("sc2");
    const future = new Date(Date.now() + 3 * DAY + 6 * 3600_000).toISOString().slice(0, 16);
    await saveContent(S.f.tenantId, S.owner, "post", null, { title: "Later", body: "x", isPublished: true, publishAt: future });
    await saveContent(S.f.tenantId, S.owner, "post", null, { title: "Now", body: "x", isPublished: true });
    expect((await listPublishedPosts(S.f.tenantId)).items.map((p) => p.slug)).toEqual(["now"]);
  });
});

describe("two people editing one page", () => {
  const home = () => defaultHomePage();

  it("get a stamp with the draft, and a save from the latest stamp goes through", async () => {
    const S = await store("dc1", "PRO");
    expect((await loadForEdit(S.f.tenantId, S.owner, "home")).stamp).toBeNull();
    const a = await saveDraft(S.f.tenantId, S.owner, "home", home(), undefined, { stamp: null });
    expect((await loadForEdit(S.f.tenantId, S.owner, "home")).stamp).toBe(a.stamp);
    const b = await saveDraft(S.f.tenantId, S.owner, "home", home(), undefined, { stamp: a.stamp });
    expect(b.stamp).not.toBe(a.stamp);
  });

  it("refuse a save made from an older stamp, and say what the newest is", async () => {
    const S = await store("dc2", "PRO");
    const first = await saveDraft(S.f.tenantId, S.owner, "home", home(), undefined, { stamp: null });
    const theirs = await saveDraft(S.f.tenantId, S.editor, "home", home(), undefined, { stamp: first.stamp });
    const e = await saveDraft(S.f.tenantId, S.owner, "home", home(), undefined, { stamp: first.stamp }).then(() => null, (x) => x);
    expect(e).toBeInstanceOf(DraftConflictError);
    expect((e as DraftConflictError).code).toBe("DRAFT_CONFLICT");
    expect((e as DraftConflictError).stamp).toBe(theirs.stamp);
    // Choosing to keep their own work: save again from the stamp the refusal named.
    await saveDraft(S.f.tenantId, S.owner, "home", home(), undefined, { stamp: (e as DraftConflictError).stamp });
  });

  it("refuse a save when a draft appeared, or vanished, since the page was opened", async () => {
    const S = await store("dc3", "PRO");
    await saveDraft(S.f.tenantId, S.editor, "home", home());
    await expect(saveDraft(S.f.tenantId, S.owner, "home", home(), undefined, { stamp: null })).rejects.toBeInstanceOf(DraftConflictError);
    const T = await store("dc4", "PRO");
    await expect(saveDraft(T.f.tenantId, T.owner, "home", home(), undefined, { stamp: "2026-01-01T00:00:00.000Z" })).rejects.toBeInstanceOf(DraftConflictError);
  });

  it("let exactly one of several saves made from the same stamp through", async () => {
    const S = await store("dc5", "PRO");
    const first = await saveDraft(S.f.tenantId, S.owner, "home", home(), undefined, { stamp: null });
    const results = await Promise.allSettled([1, 2, 3, 4].map(() => saveDraft(S.f.tenantId, S.owner, "home", home(), undefined, { stamp: first.stamp })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected" && r.reason instanceof DraftConflictError)).toHaveLength(3);
  });

  it("still save without a stamp, as before (the editor of an older tab, scripts, tests)", async () => {
    const S = await store("dc6", "PRO");
    await saveDraft(S.f.tenantId, S.owner, "home", home());
    await saveDraft(S.f.tenantId, S.owner, "home", home());
  });
});

describe("optional modules", () => {
  it("are listed with what is built, and the plan decides whether any can be used", async () => {
    const S = await store("md1", "STARTER");
    const l = await listModules(S.f.tenantId, S.owner);
    expect(l.allowance).toBe(0);
    expect(l.modules.find((m) => m.key === "loyalty")).toMatchObject({ enabled: false, blocked: "Not included in your plan" });
    expect(l.modules.find((m) => m.key === "wholesale")).toMatchObject({ enabled: false, blocked: "Not available yet" });
    await fails(setModule(S.f.tenantId, S.owner, "loyalty", true), /not included in your plan/i);
    await fails(setModule(S.f.tenantId, S.owner, "wholesale", true), /not available yet/);
    await fails(setModule(S.f.tenantId, S.owner, "nonsense", true), /Unknown/);
  });

  it("switch loyalty off and on for a store whose plan includes them, and the program follows", async () => {
    const S = await store("md2", "PRO");
    expect((await listModules(S.f.tenantId, S.owner)).modules.find((m) => m.key === "loyalty")).toMatchObject({ enabled: true, blocked: null });
    const ph = phone();
    await place(S.f, ph);
    expect(await owner.customerLoyaltyAccount.count({ where: { tenantId: S.f.tenantId } })).toBe(1);
    await setModule(S.f.tenantId, S.owner, "loyalty", false);
    await place(S.f, phone());
    expect(await owner.customerLoyaltyAccount.count({ where: { tenantId: S.f.tenantId } })).toBe(1); // no second account made
    expect(await owner.auditLog.count({ where: { tenantId: S.f.tenantId, action: "module.disabled" } })).toBe(1);
    await setModule(S.f.tenantId, S.owner, "loyalty", true);
    await place(S.f, phone());
    expect(await owner.customerLoyaltyAccount.count({ where: { tenantId: S.f.tenantId } })).toBe(2);
    await fails(setModule(S.f.tenantId, S.packer, "loyalty", false), /access/);
  });

  it("are checked from the database, so a store without the plan never gets the feature", async () => {
    const S = await store("md3", "STARTER");
    const on = await app.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${S.f.tenantId}, true)`;
      return isModuleOn(tx as never, "loyalty");
    });
    expect(on).toBe(false);
  });
});
