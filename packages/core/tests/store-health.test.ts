import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import { GRACE_DAYS, READ_ONLY_UNTIL_DAY, listStoreHealth, scoreStore, setEventPublisher, signupStore, type HealthInput, type PlatformActor } from "../src";

const day = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-05T06:00:00Z");
const ago = (d: number) => new Date(NOW.getTime() - d * day);
const ahead = (d: number) => new Date(NOW.getTime() + d * day);

/** A store that is doing fine: on a trial with 10 days left, logged in yesterday, taking orders. */
const base: HealthInput = {
  createdAt: ago(20), status: "TRIAL", isDemo: false, suspendedReason: null, trialEndsAt: ahead(10), subscription: null,
  lastLoginAt: ago(1), orders30d: 12, productCount: 20, smsUsed: 10, smsLimit: 100,
};
const paying = (over: Partial<HealthInput> = {}): HealthInput => ({ ...base, status: "ACTIVE", createdAt: ago(90), subscription: { amount: 499, currentPeriodEnd: ahead(15) }, ...over });
const score = (over: Partial<HealthInput>, from = base) => scoreStore({ ...from, ...over }, NOW);

describe("store health rules (no database)", () => {
  it("calls a busy store healthy", () => {
    expect(score({})).toMatchObject({ health: "HEALTHY", reasons: [], paying: false });
    expect(scoreStore(paying(), NOW)).toMatchObject({ health: "HEALTHY", paying: true });
  });

  it("calls a store in its first week new, unless something is wrong", () => {
    expect(score({ createdAt: ago(2), lastLoginAt: ago(0), orders30d: 0, productCount: 3 }).health).toBe("NEW");
    expect(score({ createdAt: ago(2), trialEndsAt: ahead(1), lastLoginAt: ago(0) }).health).toBe("AT_RISK");
  });

  it("flags a trial that ends in three days or less, and says if there are no orders", () => {
    expect(score({ trialEndsAt: ahead(2) })).toMatchObject({ health: "AT_RISK", reasons: ["Trial ends in 2 days"] });
    expect(score({ trialEndsAt: ahead(2), orders30d: 0 }).reasons[0]).toBe("Trial ends in 2 days and no orders yet");
    expect(score({ trialEndsAt: ahead(5) }).health).toBe("HEALTHY");
  });

  it("flags a paid plan that is about to end", () => {
    expect(scoreStore(paying({ subscription: { amount: 499, currentPeriodEnd: ahead(2) } }), NOW)).toMatchObject({ health: "AT_RISK", reasons: ["Plan ends in 2 days"] });
  });

  it("follows a lapsed plan from late, to read-only, to locked", () => {
    const lapsed = (daysLate: number) => scoreStore(paying({ subscription: { amount: 499, currentPeriodEnd: ago(daysLate) } }), NOW);
    expect(lapsed(1)).toMatchObject({ health: "AT_RISK", reasons: ["Payment is 1 day late"] });
    expect(lapsed(GRACE_DAYS + 1).health).toBe("CHURNING");
    expect(lapsed(READ_ONLY_UNTIL_DAY + 5)).toMatchObject({ health: "CHURNING", reasons: ["Locked: the plan has lapsed"] });
  });

  it("handles a trial that ended without payment", () => {
    expect(score({ trialEndsAt: ago(1) }).reasons[0]).toBe("Trial ended 1 day ago, no payment yet");
    expect(score({ trialEndsAt: ago(READ_ONLY_UNTIL_DAY + 5) }).reasons[0]).toBe("Locked: the trial ended without a payment");
  });

  it("flags a store that has stopped logging in", () => {
    expect(score({ lastLoginAt: ago(10) }).health).toBe("HEALTHY");
    expect(score({ lastLoginAt: ago(20) })).toMatchObject({ health: "AT_RISK", reasons: ["No login for 20 days"], daysSinceLogin: 20 });
    expect(score({ lastLoginAt: ago(35), createdAt: ago(60) })).toMatchObject({ health: "CHURNING", reasons: ["No login for 35 days"] });
  });

  it("does not blame a young store for not logging in for a long time", () => {
    expect(score({ createdAt: ago(8), lastLoginAt: ago(8), orders30d: 0, productCount: 12 }).health).toBe("HEALTHY");
  });

  it("flags a store that never logged in", () => {
    expect(score({ lastLoginAt: null, createdAt: ago(5) }).reasons).toEqual(["Never logged in (signed up 5 days ago)"]);
    expect(score({ lastLoginAt: null, createdAt: ago(1) }).health).toBe("NEW");
  });

  it("flags a paying store with no orders, and a trial store a week in with nothing set up", () => {
    expect(scoreStore(paying({ orders30d: 0 }), NOW).reasons).toEqual(["Paying but no orders in 30 days"]);
    expect(score({ createdAt: ago(8), orders30d: 0, productCount: 3 }).reasons).toEqual(["A week in and no products or orders yet"]);
    expect(score({ createdAt: ago(8), orders30d: 0, productCount: 12 }).health).toBe("HEALTHY");
  });

  it("flags a store that is out of free SMS", () => {
    expect(score({ smsUsed: 100, smsLimit: 100 }).reasons).toEqual(["Out of free SMS this month"]);
    expect(score({ smsUsed: 500, smsLimit: null }).health).toBe("HEALTHY");
  });

  it("lists the worst reason first", () => {
    const r = scoreStore(paying({ lastLoginAt: ago(40), orders30d: 0, smsUsed: 100, smsLimit: 100 }), NOW);
    expect(r.health).toBe("CHURNING");
    expect(r.reasons[0]).toBe("No login for 40 days");
    expect(r.reasons).toHaveLength(3);
  });

  it("never flags a demo store", () => {
    expect(score({ isDemo: true, lastLoginAt: null, orders30d: 0, createdAt: ago(100), trialEndsAt: ago(90) }).health).toBe("HEALTHY");
  });
});

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const boss: PlatformActor = { id: "pu-OWNER", email: "owner@biztrackbd.test", role: "OWNER" };

async function store(label: string, plan: "STARTER" | "PRO" = "STARTER") {
  const n = ++seq;
  const s = await signupStore({ ownerName: "Nusrat Jahan", email: `health${n}@example.test`, phone: `0193${String(1000000 + n).slice(-7)}`, storeName: `${label} ${n}`, subdomain: `health${n}shop`, plan, category: "FASHION" } as never);
  return s.tenantId;
}

describe("store health list in the database", () => {
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

  it("puts the stores that need attention first and counts each group", async () => {
    const real = new Date();
    // A trial store that is set up, logs in and has time left.
    const thriving = await store("Thriving");
    await owner.tenant.update({ where: { id: thriving }, data: { createdAt: new Date(real.getTime() - 20 * day), productCount: 12, trialEndsAt: new Date(real.getTime() + 10 * day) } });
    await owner.tenantUser.updateMany({ where: { tenantId: thriving }, data: { lastLoginAt: new Date(real.getTime() - day) } });

    // A paying store that logs in but has taken no orders in a month.
    const paid = await store("Paid quiet");
    await owner.tenant.update({ where: { id: paid }, data: { createdAt: new Date(real.getTime() - 60 * day), productCount: 12 } });
    await owner.subscription.upsert({ where: { tenantId: paid }, create: { tenantId: paid, planTier: "STARTER", status: "ACTIVE", amount: 499, currentPeriodStart: new Date(real.getTime() - 5 * day), currentPeriodEnd: new Date(real.getTime() + 25 * day) }, update: { status: "ACTIVE", amount: 499, currentPeriodEnd: new Date(real.getTime() + 25 * day) } });
    await owner.tenantUser.updateMany({ where: { tenantId: paid }, data: { lastLoginAt: new Date(real.getTime() - day) } });

    const gone = await store("Gone quiet");
    await owner.tenant.update({ where: { id: gone }, data: { createdAt: new Date(real.getTime() - 90 * day) } });
    await owner.tenantUser.updateMany({ where: { tenantId: gone }, data: { lastLoginAt: new Date(real.getTime() - 45 * day) } });

    const fresh = await store("Fresh");
    await owner.tenantUser.updateMany({ where: { tenantId: fresh }, data: { lastLoginAt: real } });

    const v = await listStoreHealth(boss, {}, owner, real);
    const byId = new Map(v.rows.map((r) => [r.tenantId, r]));
    expect(byId.get(thriving)).toMatchObject({ health: "HEALTHY", paying: false, reasons: [] });
    expect(byId.get(paid)).toMatchObject({ health: "AT_RISK", paying: true, reasons: ["Paying but no orders in 30 days"] });
    expect(byId.get(gone)).toMatchObject({ health: "CHURNING" });
    expect(byId.get(gone)!.reasons[0]).toMatch(/No login for 45 days/);
    expect(byId.get(fresh)).toMatchObject({ health: "NEW", paying: false });
    // Worst first.
    const order = v.rows.map((r) => r.health);
    expect(order).toEqual([...order].sort((a, b) => ["CHURNING", "AT_RISK", "NEW", "HEALTHY"].indexOf(a) - ["CHURNING", "AT_RISK", "NEW", "HEALTHY"].indexOf(b)));
    expect(v.counts.all).toBe(v.rows.length);
    expect(v.counts.CHURNING + v.counts.AT_RISK + v.counts.NEW + v.counts.HEALTHY).toBe(v.counts.all);
    expect(v.counts.paying).toBeGreaterThanOrEqual(1);
  });

  it("filters by health, plan and name, and pages the result", async () => {
    const real = new Date();
    const pro = await store("Proshop", "PRO");
    const churn = await listStoreHealth(boss, { health: "CHURNING" }, owner, real);
    expect(churn.rows.length).toBeGreaterThanOrEqual(1);
    expect(churn.rows.every((r) => r.health === "CHURNING")).toBe(true);
    const plan = await listStoreHealth(boss, { plan: "PRO" }, owner, real);
    expect(plan.rows.map((r) => r.tenantId)).toContain(pro);
    expect(plan.rows.every((r) => r.planTier === "PRO")).toBe(true);
    const named = await listStoreHealth(boss, { q: "proshop" }, owner, real);
    expect(named.rows.map((r) => r.name)).toEqual([expect.stringMatching(/^Proshop/)]);
    const paged = await listStoreHealth(boss, { pageSize: 2, page: 2 }, owner, real);
    expect(paged.rows).toHaveLength(2);
    expect(paged.page).toBe(2);
    expect(paged.total).toBeGreaterThan(2);
    const beyond = await listStoreHealth(boss, { pageSize: 2, page: 99 }, owner, real);
    expect(beyond.page).toBe(Math.ceil(beyond.total / 2));
  });

  it("leaves out demo and cancelled stores", async () => {
    const real = new Date();
    const demo = await store("Demo");
    await owner.tenant.update({ where: { id: demo }, data: { isDemo: true } });
    const cancelled = await store("Cancelled");
    await owner.tenant.update({ where: { id: cancelled }, data: { status: "CANCELLED" } });
    const ids = (await listStoreHealth(boss, { pageSize: 500 }, owner, real)).rows.map((r) => r.tenantId);
    expect(ids).not.toContain(demo);
    expect(ids).not.toContain(cancelled);
  });

  it("is open to the support team and closed to anyone without a platform role", async () => {
    await expect(listStoreHealth({ ...boss, role: "SUPPORT" }, {}, owner)).resolves.toBeTruthy();
    await expect(listStoreHealth({ ...boss, role: "NOPE" } as unknown as PlatformActor, {}, owner)).rejects.toThrow();
  });
});
