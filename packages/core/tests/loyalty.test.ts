import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  DomainError, adjustPoints, createOrder, getAccountView, getLoyaltyOverview, getReferralOffer, saveLoyaltySettings, setEventPublisher, setSmsSender, quoteOrder, tierFor, transitionOrder,
  type SmsSender, type StaffActor,
} from "../src";
import { onDelivered } from "../src/loyalty/engine";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const key = () => `loy-${Date.now()}-${++seq}`;
const phone = () => `0141${String(3000000 + ++seq).slice(-7)}`;

class Outbox implements SmsSender {
  sent: { to: string; text: string }[] = [];
  async send(_t: string, to: string, text: string) {
    this.sent.push({ to, text });
  }
}
const sms = new Outbox();

async function store(name: string, opts: { loyalty?: boolean; referral?: boolean } = {}) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 200 });
  await owner.storeSettings.create({ data: { tenantId: f.tenantId, storeName: name, contactPhone: "01712345678", loyaltyEnabled: opts.loyalty ?? true, referralEnabled: opts.referral ?? true } });
  await owner.tenant.update({ where: { id: f.tenantId }, data: { planTier: "BUSINESS" } });
  const mk = (role: StaffActor["role"]): StaffActor => ({ userId: `u-${role}-${seq}`, email: `${role}${seq}@example.test`, name: role, role });
  return { f, owner: mk("STORE_OWNER"), packer: mk("ORDER_PACKER") };
}
type Store = Awaited<ReturnType<typeof store>>;
const vid = (f: TenantFixture) => f.products[0]!.variants[0]!.id;

const place = (f: TenantFixture, ph: string, over: Record<string, unknown> = {}) =>
  createOrder(f.tenantId, {
    idempotencyKey: key(), customer: { name: "Tania Akter", phone: ph }, shipping: { address: `House ${seq}, Road 2, Dhanmondi`, city: "Dhanmondi", district: "Dhaka", division: "Dhaka" },
    items: [{ variantId: vid(f), quantity: 1 }], ...over,
  });
const orderRow = (id: string) => owner.order.findUniqueOrThrow({ where: { id } });
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
/** A customer with some points to spend, signed in (the server vouches for them). */
async function memberWithPoints(S: Store, points: number) {
  const ph = phone();
  const first = await place(S.f, ph);
  await deliver(S.f, first.orderId);
  const customer = await customerOf(S.f, ph);
  await adjustPoints(S.f.tenantId, S.owner, customer.id, points, "test gift");
  return { ph, customerId: customer.id };
}

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

describe("tiers", () => {
  it("follow twelve months of delivered spend", () => {
    expect([0, 4999, 5000, 14999, 15000, 34999, 35000].map((n) => tierFor(n).level)).toEqual(["BRONZE", "BRONZE", "SILVER", "SILVER", "GOLD", "GOLD", "PLATINUM"]);
  });
});

describe("earning points", () => {
  it("does nothing while the program is off", async () => {
    const S = await store("off", { loyalty: false, referral: false });
    const ph = phone();
    const o = await place(S.f, ph);
    await deliver(S.f, o.orderId);
    expect(await owner.customerLoyaltyAccount.count({ where: { tenantId: S.f.tenantId } })).toBe(0);
  });

  it("writes pending points when the order is placed and unlocks them when it is delivered, once", async () => {
    const S = await store("earn");
    const ph = phone();
    const o = await place(S.f, ph);
    expect(await acct(S.f, ph)).toMatchObject({ pendingPoints: 11, availablePoints: 0 }); // 1150 / 100, rounded down
    expect(await owner.loyaltyTransaction.findFirstOrThrow({ where: { orderId: o.orderId } })).toMatchObject({ points: 11, status: "PENDING", type: "EARN_PURCHASE" });
    await deliver(S.f, o.orderId);
    expect(await acct(S.f, ph)).toMatchObject({ pendingPoints: 0, availablePoints: 11, lifetimePoints: 11 });
    // Running the delivery step again (a retried webhook) credits nothing more.
    await owner.$transaction(async () => undefined);
    const again = await app.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${S.f.tenantId}, true)`;
      return onDelivered(tx as never, S.f.tenantId, o.orderId);
    });
    expect(again).toEqual([]);
    expect(await acct(S.f, ph)).toMatchObject({ availablePoints: 11, lifetimePoints: 11 });
  });

  it("voids pending points when the order is cancelled", async () => {
    const S = await store("cancel");
    const ph = phone();
    const o = await place(S.f, ph);
    await transitionOrder(S.f.tenantId, o.orderId, "CANCELLED", { type: "MERCHANT" });
    expect(await acct(S.f, ph)).toMatchObject({ pendingPoints: 0, availablePoints: 0 });
    expect((await owner.loyaltyTransaction.findFirstOrThrow({ where: { orderId: o.orderId } })).status).toBe("VOIDED");
  });

  it("takes the points back when a delivered order is returned", async () => {
    const S = await store("return");
    const ph = phone();
    const o = await place(S.f, ph);
    await deliver(S.f, o.orderId);
    await transitionOrder(S.f.tenantId, o.orderId, "RETURNED", { type: "MERCHANT" });
    expect(await acct(S.f, ph)).toMatchObject({ availablePoints: 0, lifetimePoints: 0 });
  });
});

describe("spending points", () => {
  it("needs a signed-in customer: a typed phone number is not proof", async () => {
    const S = await store("signin");
    const m = await memberWithPoints(S, 100);
    await fails(place(S.f, m.ph, { redeemPoints: 50 }), /Sign in/, "points");
    expect((await acct(S.f, m.ph)).availablePoints).toBe(111);
  });

  it("takes whole blocks off the price and off the balance, and the order total follows", async () => {
    const S = await store("spend");
    const m = await memberWithPoints(S, 100); // 11 earned + 100 gift
    const o = await place(S.f, m.ph, { redeemPoints: 50, verifiedCustomerId: m.customerId });
    const row = await orderRow(o.orderId);
    expect(Number(row.loyaltyDiscountBdt)).toBe(50);
    expect(row.loyaltyPointsUsed).toBe(50);
    expect(Number(row.totalAmount)).toBe(1150 - 50 + 80);
    expect((await acct(S.f, m.ph)).availablePoints).toBe(61);
    expect(await owner.loyaltyTransaction.findFirstOrThrow({ where: { orderId: o.orderId, type: "REDEEM_PURCHASE" } })).toMatchObject({ points: -50, status: "CONFIRMED" });
  });

  it("gives the points back if the order is cancelled", async () => {
    const S = await store("refund");
    const m = await memberWithPoints(S, 100);
    const o = await place(S.f, m.ph, { redeemPoints: 50, verifiedCustomerId: m.customerId });
    await transitionOrder(S.f.tenantId, o.orderId, "CANCELLED", { type: "MERCHANT" });
    expect((await acct(S.f, m.ph)).availablePoints).toBe(111);
  });

  it("refuses more than the balance, odd amounts, and more than the share of the cart the store allows", async () => {
    const S = await store("limits");
    const m = await memberWithPoints(S, 5000);
    await fails(place(S.f, m.ph, { redeemPoints: 55, verifiedCustomerId: m.customerId }), /blocks of 10/, "points");
    await fails(place(S.f, m.ph, { redeemPoints: 10_000, verifiedCustomerId: m.customerId }), /do not have that many/, "points");
    // 30% of 1150 is 345 taka, which is 340 points.
    await fails(place(S.f, m.ph, { redeemPoints: 350, verifiedCustomerId: m.customerId }), /up to 340 points/, "points");
    const ok = await place(S.f, m.ph, { redeemPoints: 340, verifiedCustomerId: m.customerId });
    expect(Number((await orderRow(ok.orderId)).loyaltyDiscountBdt)).toBe(340);
  });

  it("cannot be spent twice by two orders at the same moment", async () => {
    const S = await store("race");
    const m = await memberWithPoints(S, 89); // 11 + 89 = 100 points
    const results = await Promise.allSettled([1, 2, 3, 4].map(() => place(S.f, m.ph, { redeemPoints: 100, verifiedCustomerId: m.customerId, items: [{ variantId: vid(S.f), quantity: 3 }] })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const a = await acct(S.f, m.ph);
    expect(a.availablePoints).toBe(0);
    expect(await owner.loyaltyTransaction.count({ where: { accountId: a.id, type: "REDEEM_PURCHASE" } })).toBe(1);
  });

  it("is refused for another store's customer id", async () => {
    const A = await store("isoA");
    const B = await store("isoB");
    const m = await memberWithPoints(A, 100);
    await fails(place(B.f, m.ph, { redeemPoints: 50, verifiedCustomerId: m.customerId }), /Sign in/);
  });
});

describe("VIP tiers in practice", () => {
  it("upgrade on delivery, tell the customer, pay more points, and take money off the next order", async () => {
    const S = await store("vip");
    const ph = phone();
    const big = await place(S.f, ph, { items: [{ variantId: vid(S.f), quantity: 14 }] }); // 16,100: Gold
    await deliver(S.f, big.orderId);
    const a = await acct(S.f, ph);
    expect(a).toMatchObject({ currentTier: "GOLD" });
    expect(Number(a.rollingSpend12m)).toBe(16100);
    expect(sms.sent.some((m) => m.to === ph && /Gold/.test(m.text))).toBe(true);

    const customerId = (await customerOf(S.f, ph)).id;
    // Signed in: 5% off the goods, and 1.5x points on what is paid.
    const next = await place(S.f, ph, { verifiedCustomerId: customerId });
    const row = await orderRow(next.orderId);
    expect(Number(row.tierDiscountBdt)).toBe(57.5);
    expect(Number(row.totalAmount)).toBe(1150 - 57.5 + 80);
    const earn = await owner.loyaltyTransaction.findFirstOrThrow({ where: { orderId: next.orderId, type: "EARN_PURCHASE" } });
    expect(earn.points).toBe(Math.floor((1092.5 / 100) * 1.5));

    // Not signed in: the same phone number gets no VIP discount.
    const guest = await place(S.f, ph);
    expect(Number((await orderRow(guest.orderId)).tierDiscountBdt)).toBe(0);
  });

  it("make delivery free for Platinum", async () => {
    const S = await store("plat");
    const ph = phone();
    const huge = await place(S.f, ph, { items: [{ variantId: vid(S.f), quantity: 31 }], shipping: { address: "House 9, Road 1", city: "Mirpur", district: "Sylhet", division: "Sylhet" } });
    await deliver(S.f, huge.orderId);
    expect((await acct(S.f, ph)).currentTier).toBe("PLATINUM");
    const cid = (await customerOf(S.f, ph)).id;
    const o = await place(S.f, ph, { verifiedCustomerId: cid, shipping: { address: "House 9, Road 1", city: "Mirpur", district: "Sylhet", division: "Sylhet" } });
    expect(Number((await orderRow(o.orderId)).deliveryCharge)).toBe(0);
  });

  it("drop back when a big order is returned", async () => {
    const S = await store("drop");
    const ph = phone();
    const big = await place(S.f, ph, { items: [{ variantId: vid(S.f), quantity: 14 }] });
    await deliver(S.f, big.orderId);
    expect((await acct(S.f, ph)).currentTier).toBe("GOLD");
    await transitionOrder(S.f.tenantId, big.orderId, "RETURNED", { type: "MERCHANT" });
    expect((await acct(S.f, ph)).currentTier).toBe("BRONZE");
  });
});

describe("referrals", () => {
  async function referrer(S: Store) {
    const ph = phone();
    const o = await place(S.f, ph);
    await deliver(S.f, o.orderId);
    const a = await acct(S.f, ph);
    return { ph, code: a.referralCode, accountId: a.id };
  }

  it("give a friend's first order a discount, and the referrer points only once it is delivered", async () => {
    const S = await store("ref1");
    const r = await referrer(S);
    expect(r.code).toMatch(/^REF-[A-Z]+-[A-Z2-9]{3}$/);
    const friend = phone();
    const o = await place(S.f, friend, { referralCode: r.code, shipping: { address: "Flat 5, Road 8, Gulshan", city: "Gulshan", district: "Dhaka", division: "Dhaka" } });
    const row = await orderRow(o.orderId);
    expect(Number(row.referralDiscountBdt)).toBe(50);
    expect(row.referralCode).toBe(r.code);
    expect((await owner.customerReferral.findFirstOrThrow({ where: { refereePhone: friend } })).isDelivered).toBe(false);
    const before = (await acct(S.f, r.ph)).availablePoints;
    await deliver(S.f, o.orderId);
    expect((await acct(S.f, r.ph)).availablePoints).toBe(before + 100);
    expect(sms.sent.some((m) => m.to === r.ph && /100/.test(m.text))).toBe(true);
    expect((await owner.customerReferral.findFirstOrThrow({ where: { refereePhone: friend } })).isDelivered).toBe(true);
  });

  it("are not for your own code, an existing customer, the same address, a second time, or a small cart", async () => {
    const S = await store("ref2");
    const r = await referrer(S);
    await fails(place(S.f, r.ph, { referralCode: r.code }), /own referral code/, "referral");
    const regular = phone();
    await deliver(S.f, (await place(S.f, regular)).orderId);
    await fails(place(S.f, regular, { referralCode: r.code }), /first order only/, "referral");
    const lastReferrerOrder = await owner.order.findFirstOrThrow({ where: { customerPhone: r.ph } });
    await fails(place(S.f, phone(), { referralCode: r.code, shipping: { address: lastReferrerOrder.shippingAddress, city: "Dhanmondi", district: "Dhaka", division: "Dhaka" } }), /new customer at a new address/, "referral");
    await fails(place(S.f, phone(), { referralCode: "REF-NOBODY-AAA" }), /not found/, "referral");
    await fails(place(S.f, phone(), { referralCode: "nonsense" }), /does not look right/, "referral");
    const friend = phone();
    const addr = { address: "Flat 5, Road 8, Gulshan", city: "Gulshan", district: "Dhaka", division: "Dhaka" };
    await place(S.f, friend, { referralCode: r.code, shipping: addr });
    await fails(place(S.f, friend, { referralCode: r.code, shipping: addr }), /first order only/, "referral");
  });

  it("do nothing for the referrer when the friend's order is cancelled, and the friend may use the offer again", async () => {
    const S = await store("ref3");
    const r = await referrer(S);
    const friend = phone();
    const addr = { address: "Flat 6, Road 8, Gulshan", city: "Gulshan", district: "Dhaka", division: "Dhaka" };
    const o = await place(S.f, friend, { referralCode: r.code, shipping: addr });
    await transitionOrder(S.f.tenantId, o.orderId, "CANCELLED", { type: "MERCHANT" });
    const before = (await acct(S.f, r.ph)).availablePoints;
    expect(await owner.customerReferral.count({ where: { refereePhone: friend } })).toBe(0);
    const again = await place(S.f, friend, { referralCode: r.code, shipping: addr });
    expect(Number((await orderRow(again.orderId)).referralDiscountBdt)).toBe(50);
    expect((await acct(S.f, r.ph)).availablePoints).toBe(before);
  });

  it("take the reward back if the friend's parcel is returned", async () => {
    const S = await store("ref4");
    const r = await referrer(S);
    const friend = phone();
    const o = await place(S.f, friend, { referralCode: r.code, shipping: { address: "Flat 7, Road 8, Gulshan", city: "Gulshan", district: "Dhaka", division: "Dhaka" } });
    await deliver(S.f, o.orderId);
    const credited = (await acct(S.f, r.ph)).availablePoints;
    await transitionOrder(S.f.tenantId, o.orderId, "RETURNED", { type: "MERCHANT" });
    expect((await acct(S.f, r.ph)).availablePoints).toBe(credited - 100);
  });

  it("show the friend who invited them, without revealing anything else, and only when the program is on", async () => {
    const S = await store("ref5");
    const r = await referrer(S);
    expect(await getReferralOffer(S.f.tenantId, r.code)).toMatchObject({ referrerName: "Tania", discount: 50, minCart: 500 });
    expect(await getReferralOffer(S.f.tenantId, "REF-NOBODY-AAA")).toBeNull();
    const B = await store("ref5b");
    expect(await getReferralOffer(B.f.tenantId, r.code)).toBeNull();
    await owner.storeSettings.update({ where: { tenantId: S.f.tenantId }, data: { referralEnabled: false } });
    expect(await getReferralOffer(S.f.tenantId, r.code)).toBeNull();
  });
});

describe("the quote matches the order", () => {
  it("prices member discounts, points and a referral the same way the order does", async () => {
    const S = await store("quote");
    const m = await memberWithPoints(S, 100);
    const items = [{ variantId: vid(S.f), quantity: 2 }];
    const q = await quoteOrder(S.f.tenantId, { items, district: "Dhaka", phone: m.ph, verifiedCustomerId: m.customerId, redeemPoints: 60 });
    expect(q.loyalty).toMatchObject({ pointsUsed: 60, pointsDiscount: 60, available: 111 });
    const o = await place(S.f, m.ph, { items, redeemPoints: 60, verifiedCustomerId: m.customerId });
    expect(Number((await orderRow(o.orderId)).totalAmount)).toBe(q.total);
    const bad = await quoteOrder(S.f.tenantId, { items, district: "Dhaka", phone: phone(), redeemPoints: 60 });
    expect(bad.loyalty.pointsError).toMatch(/Sign in/);
    expect(bad.loyalty.pointsDiscount).toBe(0);
  });
});

describe("the owner's controls", () => {
  it("validates settings, audits the change, and applies it to the next order", async () => {
    const S = await store("cfg");
    await fails(saveLoyaltySettings(S.f.tenantId, S.owner, { enabled: "on", spendPerPoint: 0, pointsPerBlock: 10, bdtPerBlock: 10, maxCartPercent: 30, refereeDiscount: 50, refereeMinCart: 500, referrerReward: 100 }), /Spend per point/);
    await fails(saveLoyaltySettings(S.f.tenantId, S.packer, { enabled: "on", spendPerPoint: 50, pointsPerBlock: 10, bdtPerBlock: 10, maxCartPercent: 30, refereeDiscount: 50, refereeMinCart: 500, referrerReward: 100 }), /access/);
    await saveLoyaltySettings(S.f.tenantId, S.owner, { enabled: "on", referralEnabled: "on", spendPerPoint: 50, pointsPerBlock: 10, bdtPerBlock: 10, maxCartPercent: 30, refereeDiscount: 50, refereeMinCart: 500, referrerReward: 100 });
    const ph = phone();
    await place(S.f, ph);
    expect((await acct(S.f, ph)).pendingPoints).toBe(23); // 1150 / 50
    expect(await owner.auditLog.count({ where: { tenantId: S.f.tenantId, action: "loyalty.settings_changed" } })).toBe(1);
  });

  it("corrects a balance with a reason, never below zero, and keeps the ledger", async () => {
    const S = await store("adj");
    const ph = phone();
    await deliver(S.f, (await place(S.f, ph)).orderId);
    const cid = (await customerOf(S.f, ph)).id;
    await adjustPoints(S.f.tenantId, S.owner, cid, 40, "Apology for a late parcel");
    expect((await acct(S.f, ph)).availablePoints).toBe(51);
    await fails(adjustPoints(S.f.tenantId, S.owner, cid, -500, "Too many"), /only 51/);
    await fails(adjustPoints(S.f.tenantId, S.owner, cid, 10, ""), /reason/);
    await fails(adjustPoints(S.f.tenantId, S.packer, cid, 10, "No access"), /access/);
    await adjustPoints(S.f.tenantId, S.owner, cid, -51, "Reset");
    expect((await acct(S.f, ph)).availablePoints).toBe(0);
    expect(await owner.loyaltyTransaction.count({ where: { type: "MANUAL_ADJUSTMENT", account: { customerId: cid } } })).toBe(2);
  });

  it("shows the overview, the leaderboard and a customer's own account", async () => {
    const S = await store("view");
    const ph = phone();
    await deliver(S.f, (await place(S.f, ph, { items: [{ variantId: vid(S.f), quantity: 5 }] })).orderId); // 5,750 with free delivery over 3,000: Silver
    const ov = await getLoyaltyOverview(S.f.tenantId, S.owner);
    expect(ov.accounts).toBe(1);
    expect(ov.tiers.find((t) => t.level === "SILVER")!.customers).toBe(1);
    expect(ov.leaderboard[0]).toMatchObject({ phone: ph, tier: "SILVER", spend12m: 5750 });
    const v = await getAccountView(S.f.tenantId, (await customerOf(S.f, ph)).id);
    expect(v!.tier.level).toBe("SILVER");
    expect(v!.next).toMatchObject({ remainingBdt: 15000 - 5750 });
    expect(v!.ledger[0]!.type).toBe("EARN_PURCHASE");
  });

  it("sees nothing of another store", async () => {
    const A = await store("viewA");
    const B = await store("viewB");
    await deliver(A.f, (await place(A.f, phone())).orderId);
    expect((await getLoyaltyOverview(B.f.tenantId, B.owner)).accounts).toBe(0);
  });
});

describe("the ledger cannot be rewritten", () => {
  it("refuses to change points, kind, account or order, and the app cannot delete rows", async () => {
    const S = await store("ledger");
    const o = await place(S.f, phone());
    const tx = await owner.loyaltyTransaction.findFirstOrThrow({ where: { orderId: o.orderId } });
    await expect(owner.loyaltyTransaction.update({ where: { id: tx.id }, data: { points: 9999 } })).rejects.toThrow(/cannot change/);
    await expect(owner.loyaltyTransaction.update({ where: { id: tx.id }, data: { type: "TIER_BONUS" } })).rejects.toThrow(/cannot change/);
    await expect(app.$transaction(async (t) => {
      await t.$executeRaw`SELECT set_config('app.current_tenant_id', ${S.f.tenantId}, true)`;
      await t.$executeRaw`DELETE FROM "LoyaltyTransaction" WHERE "id" = ${tx.id}`;
    })).rejects.toThrow(/permission denied/);
    // Only the status and the note may change.
    await owner.loyaltyTransaction.update({ where: { id: tx.id }, data: { status: "VOIDED", description: "x" } });
  });

  it("allows one earn per order and no more", async () => {
    const S = await store("once");
    const o = await place(S.f, phone());
    const tx = await owner.loyaltyTransaction.findFirstOrThrow({ where: { orderId: o.orderId } });
    await expect(owner.loyaltyTransaction.create({ data: { tenantId: S.f.tenantId, accountId: tx.accountId, orderId: o.orderId, points: 5, type: "EARN_PURCHASE", status: "CONFIRMED", description: "again" } })).rejects.toThrow(/Unique/);
  });
});
