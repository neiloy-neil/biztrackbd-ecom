import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, withTenant, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  SMS_MIN_PACK, approveSmsPurchase, getSmsBalance, giveBackSmsCredit, listPendingSmsPurchases, rejectSmsPurchase, setEventPublisher, signupStore,
  smsPackPrice, submitSmsPurchase, takeSmsCredit, validatePackSize, type PlatformActor, type StaffActor,
} from "../src";
import { TRIAL_CAPS } from "../src/platform/trial";

const day = 24 * 60 * 60 * 1000;

describe("what an SMS pack costs (no database)", () => {
  it("is 50 paisa an SMS, so 100 SMS is 50 taka", () => {
    expect(smsPackPrice(100)).toBe(50);
    expect(smsPackPrice(500)).toBe(250);
    expect(smsPackPrice(1000)).toBe(500);
  });
  it("starts at 100 and goes up in hundreds", () => {
    expect(() => validatePackSize(100)).not.toThrow();
    expect(() => validatePackSize(300)).not.toThrow();
    expect(() => validatePackSize(99)).toThrow(/smallest pack/);
    expect(() => validatePackSize(0)).toThrow(/smallest pack/);
    expect(() => validatePackSize(150)).toThrow(/hundreds/);
    expect(() => validatePackSize(100.5)).toThrow();
    expect(() => validatePackSize(10_000_000)).toThrow(/more than one pack/);
  });
  it("gives a store on trial 10 SMS", () => {
    expect(TRIAL_CAPS.smsCredits).toBe(10);
    expect(SMS_MIN_PACK).toBe(100);
  });
});

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const boss: PlatformActor = { id: "pu-OWNER", email: "owner@biztrackbd.test", role: "OWNER" };
const trx = () => `SM${Date.now().toString(36).toUpperCase()}${++seq}`.slice(0, 11).padEnd(9, "Z");
const failure = (p: Promise<unknown>) => p.then(() => null, (x) => x as Error);

async function store(plan: "STARTER" | "PRO" = "STARTER", paying = true) {
  const n = ++seq;
  const s = await signupStore({ ownerName: "Nusrat Jahan", email: `sms${n}@example.test`, phone: `0195${String(3000000 + n).slice(-7)}`, storeName: `Sms ${n}`, subdomain: `sms${n}shop`, plan, category: "FASHION" } as never);
  const row = await owner.tenantUser.findFirstOrThrow({ where: { tenantId: s.tenantId } });
  if (paying) {
    const now = Date.now();
    await owner.subscription.upsert({
      where: { tenantId: s.tenantId },
      create: { tenantId: s.tenantId, planTier: plan, status: "ACTIVE", amount: 499, currentPeriodStart: new Date(now - 5 * day), currentPeriodEnd: new Date(now + 25 * day) },
      update: { status: "ACTIVE", amount: 499, currentPeriodStart: new Date(now - 5 * day), currentPeriodEnd: new Date(now + 25 * day) },
    });
  }
  return { tenantId: s.tenantId, actor: { userId: row.id, email: row.email, name: row.name, role: "STORE_OWNER" } as StaffActor };
}
const send = (tenantId: string) => withTenant(tenantId, (tx) => takeSmsCredit(tx, tenantId));
const pay = (quantity: number) => ({ quantity, provider: "BKASH", senderNumber: "01712345678", trxId: trx() });
const approveLatest = async (tenantId: string) => {
  const p = (await listPendingSmsPurchases(boss, owner)).find((x) => x.tenantId === tenantId)!;
  return approveSmsPurchase(boss, p.id, owner);
};

describe("SMS allowance and packs", () => {
  beforeAll(async () => {
    process.env.PHONE_TRUST_SALT = "test-salt-test-salt-test-salt-0001";
    const urls = testUrls();
    await resetDatabase(urls.direct);
    owner = createOwnerClient(urls.direct);
    app = createBaseClient(urls.app, 10);
    setBasePrisma(app);
    setPlatformPrisma(owner);
    await seedPlans(owner);
    setEventPublisher(async () => {});
  }, 120_000);
  afterAll(async () => { await app.$disconnect(); await owner.$disconnect(); });

  it("seeds Starter at 100 and Pro at 500 SMS a month", async () => {
    const plans = await owner.plan.findMany({ where: { tier: { in: ["STARTER", "PRO"] } } });
    const of = (t: string) => (plans.find((p) => p.tier === t)!.limits as Record<string, unknown>).smsCredits;
    expect(of("STARTER")).toBe(100);
    expect(of("PRO")).toBe(500);
  });

  it("stops a store on its free trial at 10 SMS, and does not let it spend bought SMS", async () => {
    const t = await store("PRO", false);
    const b = await getSmsBalance(t.tenantId, t.actor);
    expect(b).toMatchObject({ onTrial: true, monthlyLimit: 10, canBuy: false });
    for (let i = 0; i < 10; i++) expect(await send(t.tenantId)).toBe("monthly");
    expect(await send(t.tenantId)).toBeNull();
    // Even with bought SMS on the books, a trial store is held to its cap.
    await owner.usageCounter.create({ data: { tenantId: t.tenantId, metric: "sms_prepaid", periodStart: new Date("1970-01-01"), value: 50 } });
    expect(await send(t.tenantId)).toBeNull();
    expect((await getSmsBalance(t.tenantId, t.actor)).monthlyLeft).toBe(0);
  });

  it("will not sell a pack to a store still on its trial", async () => {
    const t = await store("STARTER", false);
    expect((await failure(submitSmsPurchase(t.tenantId, t.actor, pay(100))))!.message).toMatch(/once you pay for a plan/);
  });

  it("gives a paying Starter store 100 SMS a month and stops at 100 until it buys more", async () => {
    const t = await store("STARTER");
    expect(await getSmsBalance(t.tenantId, t.actor)).toMatchObject({ onTrial: false, monthlyLimit: 100, canBuy: true, prepaid: 0 });
    for (let i = 0; i < 100; i++) expect(await send(t.tenantId)).toBe("monthly");
    expect(await send(t.tenantId)).toBeNull();
    expect((await getSmsBalance(t.tenantId, t.actor)).totalLeft).toBe(0);
  });

  it("gives a paying Pro store 500 SMS a month", async () => {
    const t = await store("PRO");
    expect((await getSmsBalance(t.tenantId, t.actor)).monthlyLimit).toBe(500);
  });

  it("sells a pack at 50 paisa an SMS, adds it on approval, and spends it only after the monthly SMS", async () => {
    const t = await store("STARTER");
    for (let i = 0; i < 100; i++) await send(t.tenantId);
    await submitSmsPurchase(t.tenantId, t.actor, pay(100));
    const waiting = (await listPendingSmsPurchases(boss, owner)).find((x) => x.tenantId === t.tenantId)!;
    expect(waiting).toMatchObject({ quantity: 100, amount: 50 });
    expect((await getSmsBalance(t.tenantId, t.actor)).waiting).toEqual({ quantity: 100, amount: 50 });
    // Nothing is added until the platform checks the payment.
    expect(await send(t.tenantId)).toBeNull();
    expect(await approveLatest(t.tenantId)).toMatchObject({ quantity: 100, balance: 100 });
    for (let i = 0; i < 100; i++) expect(await send(t.tenantId)).toBe("prepaid");
    expect(await send(t.tenantId)).toBeNull();
    expect((await getSmsBalance(t.tenantId, t.actor)).prepaid).toBe(0);
  });

  it("uses the monthly SMS first and keeps the bought ones for later", async () => {
    const t = await store("STARTER");
    await submitSmsPurchase(t.tenantId, t.actor, pay(200));
    await approveLatest(t.tenantId);
    expect(await send(t.tenantId)).toBe("monthly");
    const b = await getSmsBalance(t.tenantId, t.actor);
    expect(b).toMatchObject({ prepaid: 200, monthlyLeft: 99, totalLeft: 299 });
  });

  it("adds a second pack on top of the first, and the bought SMS carry into a new month", async () => {
    const t = await store("STARTER");
    await submitSmsPurchase(t.tenantId, t.actor, pay(100));
    await approveLatest(t.tenantId);
    await submitSmsPurchase(t.tenantId, t.actor, pay(300));
    expect(await approveLatest(t.tenantId)).toMatchObject({ balance: 400 });
    // Next month the free allowance starts again and the bought SMS are still there.
    const nextMonth = new Date(Date.now() + 40 * day);
    await owner.subscription.update({ where: { tenantId: t.tenantId }, data: { currentPeriodEnd: new Date(nextMonth.getTime() + 20 * day) } });
    const taken = await withTenant(t.tenantId, (tx) => takeSmsCredit(tx, t.tenantId, nextMonth));
    expect(taken).toBe("monthly");
    expect((await getSmsBalance(t.tenantId, t.actor, nextMonth)).prepaid).toBe(400);
  });

  it("gives a credit back to the place it came from when a send fails", async () => {
    const t = await store("STARTER");
    for (let i = 0; i < 100; i++) await send(t.tenantId);
    await submitSmsPurchase(t.tenantId, t.actor, pay(100));
    await approveLatest(t.tenantId);
    expect(await send(t.tenantId)).toBe("prepaid");
    await withTenant(t.tenantId, (tx) => giveBackSmsCredit(tx, t.tenantId, "prepaid"));
    expect((await getSmsBalance(t.tenantId, t.actor)).prepaid).toBe(100);
    await withTenant(t.tenantId, (tx) => giveBackSmsCredit(tx, t.tenantId, "monthly"));
    expect((await getSmsBalance(t.tenantId, t.actor)).monthlyUsed).toBe(99);
  });

  it("does not let two sends spend the last bought SMS", async () => {
    const t = await store("STARTER");
    for (let i = 0; i < 100; i++) await send(t.tenantId);
    await submitSmsPurchase(t.tenantId, t.actor, pay(100));
    await approveLatest(t.tenantId);
    const results = await Promise.all(Array.from({ length: 130 }, () => send(t.tenantId)));
    expect(results.filter((r) => r === "prepaid")).toHaveLength(100);
    expect(results.filter((r) => r === null)).toHaveLength(30);
  });

  it("checks the form and the platform's decision", async () => {
    const t = await store("STARTER");
    const bad = async (over: Record<string, unknown>) => (await failure(submitSmsPurchase(t.tenantId, t.actor, { ...pay(100), ...over })))!.message;
    expect(await bad({ quantity: 50 })).toMatch(/smallest pack/);
    expect(await bad({ quantity: 150 })).toMatch(/hundreds/);
    expect(await bad({ trxId: "abc" })).toMatch(/does not look right/);
    expect(await bad({ senderNumber: "123" })).toMatch(/mobile number/);
    const id = trx();
    await submitSmsPurchase(t.tenantId, t.actor, { ...pay(100), trxId: id });
    expect((await failure(submitSmsPurchase(t.tenantId, t.actor, pay(100))))!.message).toMatch(/waiting to be checked/);
    const other = await store("STARTER");
    expect((await failure(submitSmsPurchase(other.tenantId, other.actor, { ...pay(100), trxId: id })))!.message).toMatch(/already been used/);
    const row = (await listPendingSmsPurchases(boss, owner)).find((x) => x.tenantId === t.tenantId)!;
    expect((await failure(rejectSmsPurchase(boss, row.id, "", owner)))!.message).toMatch(/Tell the store why/);
    expect(await failure(rejectSmsPurchase({ ...boss, role: "SUPPORT" } as PlatformActor, row.id, "TrxID not found", owner))).toBeTruthy();
    await rejectSmsPurchase(boss, row.id, "TrxID not found in our bKash", owner);
    expect((await failure(approveSmsPurchase(boss, row.id, owner)))!.message).toMatch(/already rejected/);
    const b = await getSmsBalance(t.tenantId, t.actor);
    expect(b).toMatchObject({ prepaid: 0, waiting: null, lastRejection: "TrxID not found in our bKash" });
  });

  it("will not add the same payment twice", async () => {
    const t = await store("STARTER");
    await submitSmsPurchase(t.tenantId, t.actor, pay(100));
    const row = (await listPendingSmsPurchases(boss, owner)).find((x) => x.tenantId === t.tenantId)!;
    await approveSmsPurchase(boss, row.id, owner);
    expect((await failure(approveSmsPurchase(boss, row.id, owner)))!.message).toMatch(/already approved/);
    expect((await getSmsBalance(t.tenantId, t.actor)).prepaid).toBe(100);
  });
});
