import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, withTenant, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  DEMO_TEMPLATES, DomainError, accessState, addDomain, addPeriod, approveSubscriptionPayment, cancelPendingProof, changePlan, checkSubdomain, extendTrial, getBillingOverview, getOverview, getStoreAccess,
  getTenantDetail, listPayments, listPlans, listPlatformAudit, listPublicPlans, listTenants, reactivateTenant, rejectSubscriptionPayment, reviewQuarantine, runBillingLifecycle, scanBrandRisk,
  setEventPublisher, signupStore, statusFor, submitPaymentProof, suspendTenant, updatePlan, type PlatformActor, type PlatformRole, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const DAY = 86_400_000;

const phone = () => `0191${String(1000000 + ++seq).slice(-7)}`;
const trx = () => `SB${Date.now().toString(36).toUpperCase()}${++seq}`.slice(0, 11).padEnd(9, "Z");
const pa = (role: PlatformRole): PlatformActor => ({ id: `pu-${role}`, email: `${role.toLowerCase()}@biztrackbd.test`, role });
const fin = pa("FINANCE"), boss = pa("OWNER"), lead = pa("SUPPORT_LEAD"), support = pa("SUPPORT");
const staff = (tenantId: string, role: StaffActor["role"], email: string): StaffActor => ({ userId: `u-${role}-${tenantId.slice(0, 6)}`, email, name: "Test", role });

async function signup(over: Record<string, unknown> = {}) {
  const n = ++seq;
  const input = { ownerName: "Nusrat Jahan", email: `owner${n}@example.test`, phone: phone(), storeName: `Shop ${n}`, subdomain: `shop${n}x`, plan: "STARTER", ...over };
  const s = await signupStore(input);
  const ownerRow = await owner.tenantUser.findFirstOrThrow({ where: { tenantId: s.tenantId } });
  return { ...s, input, actor: { userId: ownerRow.id, email: ownerRow.email, name: ownerRow.name, role: "STORE_OWNER" } as StaffActor };
}
const fails = async (p: Promise<unknown>, code: string, msg?: RegExp) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  if (msg) expect((e as DomainError).message).toMatch(msg);
};
const proof = (over: Record<string, unknown> = {}) => ({ plan: "PRO", interval: "MONTHLY", provider: "BKASH", senderNumber: "01712345678", trxId: trx(), ...over });
const tenant = (id: string) => owner.tenant.findUniqueOrThrow({ where: { id }, include: { subscription: true } });

beforeAll(async () => {
  process.env.PHONE_TRUST_SALT = "test-salt-test-salt-test-salt-0001";
  process.env.PLATFORM_BKASH_NUMBER = "01800000000";
  process.env.PLATFORM_NAGAD_NUMBER = ""; // .env.local may set one; the test is about bKash only
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  setPlatformPrisma(owner); // the owner role stands in for biztrack_platform: it also sees every store
  await seedPlans(owner);
});
beforeEach(() => setEventPublisher(async () => {}));
afterAll(async () => {
  await app.$disconnect();
  await owner.$disconnect();
});

describe("what a store may do, by date", () => {
  const end = new Date("2026-11-01T00:00:00Z");
  const t = (sub: { amount: number }, extra: object = {}) => ({ status: "ACTIVE" as const, trialEndsAt: end, subscription: { ...sub, currentPeriodEnd: end }, ...extra });
  const at = (days: number) => new Date(end.getTime() + days * DAY);

  it("a trial runs, then grace for 3 days, read-only to day 14, then locked", () => {
    expect(accessState(t({ amount: 0 }), at(-5))).toMatchObject({ state: "TRIAL", daysLeft: 5 });
    expect(accessState(t({ amount: 0 }), at(-0.5))).toMatchObject({ state: "TRIAL", daysLeft: 1 });
    expect(accessState(t({ amount: 0 }), at(0.001))).toMatchObject({ state: "GRACE", overdueDays: 1 });
    expect(accessState(t({ amount: 0 }), at(3))).toMatchObject({ state: "GRACE", overdueDays: 3 });
    expect(accessState(t({ amount: 0 }), at(3.5))).toMatchObject({ state: "READ_ONLY", overdueDays: 4 });
    expect(accessState(t({ amount: 0 }), at(14))).toMatchObject({ state: "READ_ONLY", overdueDays: 14 });
    expect(accessState(t({ amount: 0 }), at(14.1))).toMatchObject({ state: "LOCKED", overdueDays: 15 });
  });

  it("a paid plan is active until its period ends, then follows the same stages", () => {
    expect(accessState(t({ amount: 1499 }), at(-10))).toMatchObject({ state: "ACTIVE", daysLeft: 10 });
    expect(accessState(t({ amount: 1499 }), at(2))).toMatchObject({ state: "GRACE" });
    expect(accessState(t({ amount: 1499 }), at(10))).toMatchObject({ state: "READ_ONLY" });
  });

  it("a platform suspension or a cancelled store is locked at once, whatever the dates say", () => {
    expect(accessState(t({ amount: 1499 }, { suspendedReason: "fraud" }), at(-10))).toMatchObject({ state: "LOCKED", suspendedByPlatform: true });
    expect(accessState(t({ amount: 1499 }, { status: "CANCELLED" }), at(-10))).toMatchObject({ state: "LOCKED" });
  });

  it("demo stores and far-future stores have unlimited days active access", () => {
    expect(accessState({ status: "ACTIVE", trialEndsAt: end, isDemo: true })).toMatchObject({ state: "ACTIVE", daysLeft: null, nextStageAt: null });
    expect(accessState({ status: "ACTIVE", trialEndsAt: new Date("2100-01-01T00:00:00Z") })).toMatchObject({ state: "ACTIVE", daysLeft: null, nextStageAt: null });
  });

  it("with no subscription row it falls back to the trial date", () => {
    expect(accessState({ status: "TRIAL", trialEndsAt: end }, at(-2)).state).toBe("TRIAL");
    expect(accessState({ status: "TRIAL", trialEndsAt: end }, at(5)).state).toBe("READ_ONLY");
  });

  it("maps to the status the storefront router reads", () => {
    expect(statusFor("TRIAL", "TRIAL")).toBe("TRIAL");
    expect(statusFor("GRACE", "ACTIVE")).toBe("PAST_DUE");
    expect(statusFor("READ_ONLY", "PAST_DUE")).toBe("SUSPENDED");
    expect(statusFor("LOCKED", "ACTIVE")).toBe("SUSPENDED");
    expect(statusFor("ACTIVE", "SUSPENDED")).toBe("ACTIVE");
    expect(statusFor("ACTIVE", "CANCELLED")).toBe("CANCELLED");
  });

  it("adds months and years without overflowing the month end", () => {
    expect(addPeriod(new Date("2026-01-31T10:00:00Z"), "MONTHLY").toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addPeriod(new Date("2028-01-31T10:00:00Z"), "MONTHLY").toISOString()).toBe("2028-02-29T10:00:00.000Z");
    expect(addPeriod(new Date("2026-10-10T10:00:00Z"), "MONTHLY").toISOString()).toBe("2026-11-10T10:00:00.000Z");
    expect(addPeriod(new Date("2028-02-29T10:00:00Z"), "YEARLY").toISOString()).toBe("2029-02-28T10:00:00.000Z");
    expect(addPeriod(new Date("2026-12-15T10:00:00Z"), "MONTHLY").toISOString()).toBe("2027-01-15T10:00:00.000Z");
  });
});

describe("the brand scanner", () => {
  it("flags protected names, as words or inside longer addresses", () => {
    expect(scanBrandRisk("bKash Offers", "x")).toBe("bkash");
    expect(scanBrandRisk("Fashion", "mybkashshop")).toBe("bkash");
    expect(scanBrandRisk("Daraz Outlet", "outlet")).toBe("daraz");
    expect(scanBrandRisk("Cheap Nike Shoes", "shoes")).toBe("nike");
    expect(scanBrandRisk("Bata Shoe Store", "x")).toBe("bata");
  });

  it("does not flag short names that are only part of another word", () => {
    expect(scanBrandRisk("Rongdhonu Fashion", "rongdhonu")).toBeNull();
    expect(scanBrandRisk("Batalion Tailors", "batalion")).toBeNull();
    expect(scanBrandRisk("Nebula Store", "nebula")).toBeNull();
    expect(scanBrandRisk("Rock Shop", "rockshop")).toBeNull(); // "rocket" is not "rock"
  });
});

describe("signing up a store", () => {
  it("creates the store, its owner, its trial, its starting settings and sample products", async () => {
    const s = await signup({ plan: "PRO", tagline: "Handloom from Narayanganj" });
    expect(s.quarantined).toBe(false);
    const t = await tenant(s.tenantId);
    expect(t).toMatchObject({ status: "TRIAL", planTier: "PRO", subdomain: s.subdomain, themeId: "kapor", ownerEmail: s.input.email, productCount: 8 }); // the Kapor template's sample products (docs/38)
    expect(Math.round((t.trialEndsAt.getTime() - t.trialStartsAt.getTime()) / DAY)).toBe(14);
    expect(t.subscription).toMatchObject({ status: "TRIALING", planTier: "PRO" });
    expect(Number(t.subscription!.amount)).toBe(0);
    expect(t.subscription!.currentPeriodEnd.getTime()).toBe(t.trialEndsAt.getTime());
    const users = await owner.tenantUser.findMany({ where: { tenantId: s.tenantId } });
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ role: "STORE_OWNER", passwordHash: "EXTERNAL_AUTH" });
    expect(await owner.storeSettings.findFirstOrThrow({ where: { tenantId: s.tenantId } })).toMatchObject({ storeName: s.input.storeName, tagline: "Handloom from Narayanganj" });
    expect(await owner.shippingZone.count({ where: { tenantId: s.tenantId } })).toBe(2);
    expect(await owner.themeInstall.count({ where: { tenantId: s.tenantId, themeId: "kapor", isActive: true } })).toBe(1);
    const kapor = DEMO_TEMPLATES.find((x) => x.id === "kapor")!;
    expect(await owner.product.count({ where: { tenantId: s.tenantId, status: "ACTIVE" } })).toBe(kapor.products.length);
    expect(await owner.productVariant.count({ where: { tenantId: s.tenantId } })).toBe(kapor.products.reduce((n, p) => n + p.variants.length, 0));
    expect((await owner.auditLog.findFirstOrThrow({ where: { tenantId: s.tenantId } })).action).toBe("store.created");
    // The owner can use the store straight away: access is the trial.
    expect(await getStoreAccess(s.tenantId)).toMatchObject({ state: "TRIAL" });
  });

  it("can start without sample products", async () => {
    const s = await signup({ demoData: false });
    expect((await tenant(s.tenantId)).productCount).toBe(0);
    expect(await owner.product.count({ where: { tenantId: s.tenantId } })).toBe(0);
  });

  it("can start directly on any released storefront template", async () => {
    const s = await signup({ theme: "gadgetstudio", demoData: false });
    expect(await tenant(s.tenantId)).toMatchObject({ themeId: "gadgetstudio" });
    expect(await owner.themeInstall.findFirst({ where: { tenantId: s.tenantId, isActive: true } })).toMatchObject({ themeId: "gadgetstudio" });
  });

  it("will not take an address that is taken, reserved or malformed, and says so", async () => {
    const first = await signup();
    await fails(signupStore({ ownerName: "Other Person", email: "other@example.test", phone: phone(), storeName: "Copy", subdomain: first.subdomain }), "VALIDATION_ERROR", /already taken/);
    await fails(signupStore({ ownerName: "Other Person", email: "other@example.test", phone: phone(), storeName: "Copy", subdomain: first.subdomain.toUpperCase() }), "VALIDATION_ERROR", /already taken/);
    for (const [sub, re] of [["admin", /kept for BizTrackBD/], ["ab", /at least 3/], ["has space", /letters, numbers/], ["-bad", /letters, numbers/], ["a--b", /letters, numbers/]] as const) {
      await fails(signupStore({ ownerName: "Other Person", email: "other@example.test", phone: phone(), storeName: "Copy", subdomain: sub }), "VALIDATION_ERROR", re);
    }
    expect(await checkSubdomain(first.subdomain)).toEqual({ ok: false, reason: "taken" });
    expect(await checkSubdomain("admin")).toEqual({ ok: false, reason: "reserved" });
    expect(await checkSubdomain(`fresh${++seq}shop`)).toMatchObject({ ok: true });
  });

  it("two people racing for one address: exactly one gets it, and nothing is left half-made", async () => {
    const sub = `race${++seq}shop`;
    const before = await owner.tenant.count();
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) => signupStore({ ownerName: "Racer", email: `racer${seq}${i}@example.test`, phone: phone(), storeName: `Race ${i}`, subdomain: sub })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await owner.tenant.count()).toBe(before + 1);
    expect(await owner.tenantUser.count({ where: { tenant: { subdomain: sub } } })).toBe(1);
  });

  it("limits how many stores one email can start", async () => {
    const email = `serial${++seq}@example.test`;
    for (let i = 0; i < 3; i++) await signup({ email, demoData: false });
    await fails(signup({ email, demoData: false }), "VALIDATION_ERROR", /most stores/);
    await signup({ email: email.toUpperCase().replace("@EXAMPLE.TEST", "@example.test") }).catch((e) => expect(e).toBeInstanceOf(DomainError)); // case does not dodge the limit
    expect(await owner.tenant.count({ where: { ownerEmail: email } })).toBe(3);
  });

  it("checks the form", async () => {
    const base = { ownerName: "Nusrat", email: "a@example.test", phone: "01712345678", storeName: "Shop", subdomain: `form${++seq}shop` };
    await fails(signupStore({ ...base, ownerName: "N" }), "VALIDATION_ERROR", /name/);
    await fails(signupStore({ ...base, email: "not-an-email" }), "VALIDATION_ERROR", /email/);
    await fails(signupStore({ ...base, phone: "12345" }), "VALIDATION_ERROR", /mobile number/);
    await fails(signupStore({ ...base, storeName: "" }), "VALIDATION_ERROR");
    await fails(signupStore({ ...base, plan: "ENTERPRISE" }), "VALIDATION_ERROR");
    await fails(signupStore({ ...base, theme: "unknown" }), "VALIDATION_ERROR");
    await fails(signupStore(null), "VALIDATION_ERROR");
    expect(await owner.tenant.count({ where: { subdomain: base.subdomain } })).toBe(0);
  });

  it("flags a store named after a protected brand, which then cannot connect a custom domain until reviewed", async () => {
    const s = await signup({ storeName: "bKash Cashback Shop", plan: "BUSINESS", demoData: false });
    expect(s.quarantined).toBe(true);
    expect((await tenant(s.tenantId)).quarantineReason).toMatch(/bkash/);
    await fails(addDomain(s.tenantId, s.actor, "cashback-shop.com"), "VALIDATION_ERROR", /being reviewed/);
    await fails(reviewQuarantine(support, s.tenantId, "APPROVE", "looked fine"), "FORBIDDEN");
    await reviewQuarantine(lead, s.tenantId, "APPROVE", "Has a bKash agent licence, seen the letter");
    expect((await tenant(s.tenantId)).quarantined).toBe(false);
    await addDomain(s.tenantId, s.actor, "cashback-shop.com");
    await fails(reviewQuarantine(lead, s.tenantId, "APPROVE", "again"), "VALIDATION_ERROR", /not flagged/);
  });

  it("a flagged store can be suspended instead, and is then locked", async () => {
    const s = await signup({ storeName: "Rolex Watches BD", demoData: false });
    await reviewQuarantine(boss, s.tenantId, "SUSPEND", "Sells counterfeits");
    const t = await tenant(s.tenantId);
    expect(t).toMatchObject({ status: "SUSPENDED", quarantined: false });
    expect(t.suspendedReason).toMatch(/Brand review/);
    expect(await getStoreAccess(s.tenantId)).toMatchObject({ state: "LOCKED", suspendedByPlatform: true });
  });

  it("only the signup function can create a store: the app role cannot insert one itself", async () => {
    await expect(app.tenant.create({ data: { name: "Sneaky", subdomain: `sneaky${++seq}`, trialEndsAt: new Date() } })).rejects.toThrow();
  });
});

describe("the owner's billing screen", () => {
  it("shows the plans from the Plan table, the trial, usage and where to pay", async () => {
    const s = await signup({ plan: "STARTER" });
    const b = await getBillingOverview(s.tenantId, s.actor);
    expect(b.plans.map((p) => p.tier)).toEqual(["STARTER", "PRO", "BUSINESS"]);
    expect(b.plans[1]).toMatchObject({ name: "Pro", priceMonthly: 1499, priceYearly: 14990, yearlyMonthsFree: 2 });
    expect(b.access).toMatchObject({ state: "TRIAL", daysLeft: 14 });
    expect(b.usage.products.used).toBe(8);
    expect(b.payTo).toEqual([{ provider: "BKASH", number: "01800000000", kind: "MERCHANT" }]);
    expect(b.pending).toBeNull();
    expect(b.subscription).toMatchObject({ tier: "STARTER", amount: 0 });
    expect((await listPublicPlans()).length).toBe(3);
  });

  it("takes a payment proof for the plan's real price, whatever the browser says", async () => {
    const s = await signup();
    const p = await submitPaymentProof(s.tenantId, s.actor, { ...proof({ plan: "PRO", interval: "YEARLY" }), amount: 1 });
    expect(p).toMatchObject({ planTier: "PRO", interval: "YEARLY", amount: 14990, status: "PENDING" });
    expect((await getBillingOverview(s.tenantId, s.actor)).pending?.id).toBe(p.id);
    expect(await owner.auditLog.count({ where: { tenantId: s.tenantId, action: "billing.proof_submitted" } })).toBe(1);
  });

  it("allows one waiting payment at a time, and the owner can take it back", async () => {
    const s = await signup();
    const p = await submitPaymentProof(s.tenantId, s.actor, proof());
    await fails(submitPaymentProof(s.tenantId, s.actor, proof()), "VALIDATION_ERROR", /already have a payment/);
    await cancelPendingProof(s.tenantId, s.actor, p.id);
    await submitPaymentProof(s.tenantId, s.actor, proof());
  });

  it("refuses a bad TrxID or number, and a TrxID used before, anywhere, with the same words", async () => {
    const a = await signup();
    const b = await signup();
    await fails(submitPaymentProof(a.tenantId, a.actor, proof({ trxId: "abc" })), "VALIDATION_ERROR", /does not look right/);
    await fails(submitPaymentProof(a.tenantId, a.actor, proof({ senderNumber: "123" })), "VALIDATION_ERROR", /number you sent/);
    await fails(submitPaymentProof(a.tenantId, a.actor, proof({ plan: "ENTERPRISE" })), "VALIDATION_ERROR");
    const used = trx();
    await submitPaymentProof(a.tenantId, a.actor, proof({ trxId: used.toLowerCase() })); // stored upper-case
    await fails(submitPaymentProof(b.tenantId, b.actor, proof({ trxId: used })), "VALIDATION_ERROR", /already been used/);
    expect(await owner.paymentProof.count({ where: { tenantId: b.tenantId } })).toBe(0);
  });

  it("is for people with billing access only, and a store cannot approve its own payment", async () => {
    const s = await signup();
    const manager = staff(s.tenantId, "STORE_MANAGER", "m@example.test");
    await fails(submitPaymentProof(s.tenantId, manager, proof()), "FORBIDDEN");
    await expect(getBillingOverview(s.tenantId, manager)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const p = await submitPaymentProof(s.tenantId, s.actor, proof());
    // The database refuses it too, not only the code.
    await expect(withTenant(s.tenantId, (tx) => tx.paymentProof.update({ where: { id: p.id }, data: { status: "APPROVED" } }))).rejects.toThrow(/permission denied/i);
    await expect(withTenant(s.tenantId, (tx) => tx.subscription.update({ where: { tenantId: s.tenantId }, data: { planTier: "BUSINESS" } }))).rejects.toThrow(/permission denied/i);
  });

  it("one store cannot see or cancel another store's payment", async () => {
    const a = await signup();
    const b = await signup();
    const p = await submitPaymentProof(a.tenantId, a.actor, proof());
    expect((await getBillingOverview(b.tenantId, b.actor)).proofs).toHaveLength(0);
    await fails(cancelPendingProof(b.tenantId, b.actor, p.id), "VALIDATION_ERROR");
    expect(await owner.paymentProof.count({ where: { id: p.id } })).toBe(1);
  });
});

describe("the platform approves a payment", () => {
  it("a stranger signs up, pays, and the store moves from trial to Pro", async () => {
    const s = await signup({ plan: "STARTER" });
    const p = await submitPaymentProof(s.tenantId, s.actor, proof({ plan: "PRO" }));
    const rows = await listPayments(fin);
    expect(rows.find((r) => r.id === p.id)).toMatchObject({ storeName: s.input.storeName, plan: "PRO", amount: 1499, trxId: p.trxId, status: "PENDING" });

    const now = new Date();
    const done = await approveSubscriptionPayment(fin, p.id, { now });
    expect(done).toMatchObject({ tenantId: s.tenantId, plan: "PRO", interval: "MONTHLY" });
    expect(done.periodEnd.getTime()).toBe(addPeriod(now, "MONTHLY").getTime());
    const t = await tenant(s.tenantId);
    expect(t).toMatchObject({ status: "ACTIVE", planTier: "PRO" });
    expect(t.subscription).toMatchObject({ status: "ACTIVE", planTier: "PRO", interval: "MONTHLY", gateway: "MANUAL_MFS" });
    expect(Number(t.subscription!.amount)).toBe(1499);
    const row = await owner.paymentProof.findUniqueOrThrow({ where: { id: p.id } });
    expect(row).toMatchObject({ status: "APPROVED", approvedBy: fin.id });
    expect(row.appliedTo!.getTime()).toBe(done.periodEnd.getTime());
    expect(await getStoreAccess(s.tenantId)).toMatchObject({ state: "ACTIVE", daysLeft: Math.round((done.periodEnd.getTime() - Date.now()) / DAY) });
    expect((await getBillingOverview(s.tenantId, s.actor)).tier).toBe("PRO");
    const log = await owner.platformAuditLog.findFirstOrThrow({ where: { tenantId: s.tenantId, action: "PAYMENT_APPROVED" } });
    expect(log).toMatchObject({ actorId: fin.id });
    // Pro features switch on: courier booking is a Pro feature.
    const plan = await owner.plan.findUniqueOrThrow({ where: { tier: "PRO" } });
    expect((plan.features as Record<string, unknown>).courierBooking).toBe("auto");
  });

  it("two approvers clicking at once approve it once", async () => {
    const s = await signup();
    const p = await submitPaymentProof(s.tenantId, s.actor, proof());
    const res = await Promise.allSettled([approveSubscriptionPayment(fin, p.id), approveSubscriptionPayment(boss, p.id), approveSubscriptionPayment(fin, p.id)]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await owner.platformAuditLog.count({ where: { tenantId: s.tenantId, action: "PAYMENT_APPROVED" } })).toBe(1);
    await fails(approveSubscriptionPayment(fin, p.id), "VALIDATION_ERROR", /already approved/);
  });

  it("paying the same plan again before it ends adds a period; changing plan starts fresh", async () => {
    const s = await signup({ plan: "STARTER" });
    const t0 = new Date("2026-10-01T06:00:00Z");
    const p1 = await submitPaymentProof(s.tenantId, s.actor, proof({ plan: "PRO" }));
    const a1 = await approveSubscriptionPayment(fin, p1.id, { now: t0 });
    const p2 = await submitPaymentProof(s.tenantId, s.actor, proof({ plan: "PRO" }));
    const a2 = await approveSubscriptionPayment(fin, p2.id, { now: new Date("2026-10-15T06:00:00Z") });
    expect(a2.periodStart.getTime()).toBe(a1.periodEnd.getTime());
    expect(a2.periodEnd.toISOString()).toBe("2026-12-01T06:00:00.000Z");
    const p3 = await submitPaymentProof(s.tenantId, s.actor, proof({ plan: "BUSINESS", interval: "YEARLY" }));
    const a3 = await approveSubscriptionPayment(fin, p3.id, { now: new Date("2026-10-20T06:00:00Z") });
    expect(a3.periodStart.toISOString()).toBe("2026-10-20T06:00:00.000Z");
    expect(a3.periodEnd.toISOString()).toBe("2027-10-20T06:00:00.000Z");
    expect((await tenant(s.tenantId)).planTier).toBe("BUSINESS");
  });

  it("a rejected payment says why, keeps the TrxID on file, and changes nothing", async () => {
    const s = await signup();
    const p = await submitPaymentProof(s.tenantId, s.actor, proof());
    await fails(rejectSubscriptionPayment(fin, p.id, " "), "VALIDATION_ERROR");
    await rejectSubscriptionPayment(fin, p.id, "TrxID not found in our bKash");
    const row = await owner.paymentProof.findUniqueOrThrow({ where: { id: p.id } });
    expect(row).toMatchObject({ status: "REJECTED", rejectionReason: "TrxID not found in our bKash" });
    expect((await tenant(s.tenantId)).status).toBe("TRIAL");
    // The owner sees the reason and may submit again, but not with the same TrxID.
    expect((await getBillingOverview(s.tenantId, s.actor)).proofs[0]).toMatchObject({ status: "REJECTED", rejectionReason: "TrxID not found in our bKash" });
    await fails(submitPaymentProof(s.tenantId, s.actor, proof({ trxId: p.trxId })), "VALIDATION_ERROR", /already been used/);
    await submitPaymentProof(s.tenantId, s.actor, proof());
    await fails(approveSubscriptionPayment(fin, p.id), "VALIDATION_ERROR", /already rejected/);
  });

  it("flags a sender number that has paid for other stores", async () => {
    const a = await signup();
    const b = await signup();
    const same = "01755555555";
    await submitPaymentProof(a.tenantId, a.actor, proof({ senderNumber: same }));
    const pb = await submitPaymentProof(b.tenantId, b.actor, proof({ senderNumber: same }));
    expect((await listPayments(fin)).find((r) => r.id === pb.id)!.senderSeenOnOtherStores).toBe(1);
  });

  it("is limited by role", async () => {
    const s = await signup();
    const p = await submitPaymentProof(s.tenantId, s.actor, proof());
    await fails(approveSubscriptionPayment(support, p.id), "FORBIDDEN");
    await fails(approveSubscriptionPayment(lead, p.id), "FORBIDDEN"); // can look, cannot approve
    await fails(rejectSubscriptionPayment(support, p.id, "no"), "FORBIDDEN");
    await expect(listPayments(support)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await listPayments(lead)).length).toBeGreaterThan(0);
    await approveSubscriptionPayment(boss, p.id);
    await fails(approveSubscriptionPayment(fin, "nope"), "NOT_FOUND");
  });
});

describe("store controls", () => {
  it("suspending locks the store at once; reactivating brings back exactly what the dates allow", async () => {
    const s = await signup();
    await fails(suspendTenant(fin, s.tenantId, "because"), "FORBIDDEN");
    await fails(suspendTenant(lead, s.tenantId, "no"), "VALIDATION_ERROR");
    await suspendTenant(lead, s.tenantId, "Customers report fake products");
    expect(await tenant(s.tenantId)).toMatchObject({ status: "SUSPENDED", suspendedReason: "Customers report fake products" });
    expect(await getStoreAccess(s.tenantId)).toMatchObject({ state: "LOCKED", suspendedByPlatform: true });
    await reactivateTenant(lead, s.tenantId);
    expect(await tenant(s.tenantId)).toMatchObject({ status: "TRIAL", suspendedReason: null });
    await fails(reactivateTenant(lead, s.tenantId), "VALIDATION_ERROR", /not suspended by the platform/);
    // An unpaid store that was also suspended does not come back open.
    await owner.tenant.update({ where: { id: s.tenantId }, data: { trialEndsAt: new Date(Date.now() - 20 * DAY) } });
    await owner.subscription.update({ where: { tenantId: s.tenantId }, data: { currentPeriodEnd: new Date(Date.now() - 20 * DAY) } });
    await suspendTenant(boss, s.tenantId, "Chargeback abuse");
    await reactivateTenant(boss, s.tenantId);
    expect((await getStoreAccess(s.tenantId)).state).toBe("LOCKED");
    expect((await tenant(s.tenantId)).status).toBe("SUSPENDED");
  });

  it("a payment approved for a platform-suspended store pays the bill but does not lift the suspension", async () => {
    const s = await signup();
    await suspendTenant(boss, s.tenantId, "Under investigation");
    const p = await submitPaymentProof(s.tenantId, s.actor, proof());
    await approveSubscriptionPayment(fin, p.id);
    expect(await tenant(s.tenantId)).toMatchObject({ status: "SUSPENDED", planTier: "PRO" });
    expect((await getStoreAccess(s.tenantId)).state).toBe("LOCKED");
  });

  it("extends a trial, from today if it has already run out", async () => {
    const s = await signup();
    await fails(extendTrial(support, s.tenantId, 7), "FORBIDDEN");
    await fails(extendTrial(lead, s.tenantId, 0), "VALIDATION_ERROR");
    await fails(extendTrial(lead, s.tenantId, 61), "VALIDATION_ERROR");
    const before = (await tenant(s.tenantId)).trialEndsAt;
    const end = await extendTrial(lead, s.tenantId, 7);
    expect(end.getTime()).toBe(before.getTime() + 7 * DAY);
    expect((await tenant(s.tenantId)).subscription!.currentPeriodEnd.getTime()).toBe(end.getTime());
    // Lapsed and swept to locked: an extension gives the full days from now and opens the store again.
    await owner.tenant.update({ where: { id: s.tenantId }, data: { trialEndsAt: new Date(Date.now() - 30 * DAY), status: "SUSPENDED" } });
    await owner.subscription.update({ where: { tenantId: s.tenantId }, data: { currentPeriodEnd: new Date(Date.now() - 30 * DAY), status: "UNPAID" } });
    const end2 = await extendTrial(lead, s.tenantId, 5);
    expect(Math.round((end2.getTime() - Date.now()) / DAY)).toBe(5);
    expect(await tenant(s.tenantId)).toMatchObject({ status: "TRIAL" });
    expect((await getStoreAccess(s.tenantId)).state).toBe("TRIAL");
  });

  it("will not extend the trial of a store that is paying", async () => {
    const s = await signup();
    await approveSubscriptionPayment(fin, (await submitPaymentProof(s.tenantId, s.actor, proof())).id);
    await fails(extendTrial(boss, s.tenantId, 7), "VALIDATION_ERROR", /is paying/);
  });

  it("changes a plan by hand and records it", async () => {
    const s = await signup({ plan: "STARTER" });
    await changePlan(fin, s.tenantId, "BUSINESS");
    expect(await tenant(s.tenantId)).toMatchObject({ planTier: "BUSINESS", subscription: expect.objectContaining({ planTier: "BUSINESS" }) });
    await fails(changePlan(support, s.tenantId, "PRO"), "FORBIDDEN");
    await fails(changePlan(boss, s.tenantId, "ENTERPRISE" as never), "VALIDATION_ERROR");
    await fails(changePlan(boss, "no-such-store", "PRO"), "NOT_FOUND");
    expect((await owner.platformAuditLog.findFirstOrThrow({ where: { tenantId: s.tenantId, action: "PLAN_CHANGED" } })).details).toMatchObject({ from: "STARTER", to: "BUSINESS" });
  });
});

describe("plans", () => {
  it("are edited in the table, validated, audited, and apply at once", async () => {
    const before = await listPlans(boss);
    expect(before.find((p) => p.tier === "STARTER")).toMatchObject({ priceMonthly: 699 });
    await fails(updatePlan(fin, "STARTER", { priceMonthlyBdt: 1 }), "FORBIDDEN");
    await fails(updatePlan(boss, "STARTER", { priceMonthlyBdt: -5 }), "VALIDATION_ERROR");
    await fails(updatePlan(boss, "STARTER", { trialDays: 90 }), "VALIDATION_ERROR");
    await fails(updatePlan(boss, "STARTER", { limits: { products: -1 } }), "VALIDATION_ERROR");
    await fails(updatePlan(boss, "NOPE", { trialDays: 7 }), "NOT_FOUND");
    await updatePlan(boss, "STARTER", { priceMonthlyBdt: 799, limits: { products: 350, storageGb: null } });
    const after = (await listPublicPlans()).find((p) => p.tier === "STARTER")!;
    expect(after).toMatchObject({ priceMonthly: 799 });
    expect(after.limits).toMatchObject({ products: 350, storageGb: null, ordersPerMonth: 500 });
    // New proofs use the new price.
    const s = await signup();
    expect((await submitPaymentProof(s.tenantId, s.actor, proof({ plan: "STARTER" }))).amount).toBe(799);
    expect((await owner.platformAuditLog.findFirstOrThrow({ where: { action: "PLAN_EDITED" } })).details).toMatchObject({ tier: "STARTER" });
    await updatePlan(boss, "STARTER", { priceMonthlyBdt: 699, limits: { products: 300, storageGb: 5 } });
    // A hidden plan leaves the public list.
    await updatePlan(boss, "BUSINESS", { isPublic: false });
    expect((await listPublicPlans()).map((p) => p.tier)).toEqual(["STARTER", "PRO"]);
    await fails(signupStore({ ownerName: "Nusrat", email: `h${++seq}@example.test`, phone: phone(), storeName: "Hidden", subdomain: `hidden${seq}x`, plan: "BUSINESS" }), "VALIDATION_ERROR", /plan/);
    await updatePlan(boss, "BUSINESS", { isPublic: true });
  });
});

describe("finding stores and reading the numbers", () => {
  it("searches by name, subdomain, owner email, owner phone and domain, and filters by state", async () => {
    const a = await signup({ storeName: "Zebra Threads", plan: "BUSINESS", demoData: false });
    const b = await signup({ storeName: "Quiet Corner", demoData: false });
    await owner.domain.create({ data: { tenantId: a.tenantId, domain: "zebrathreads.example", verified: true, isPrimary: true } });
    const by = async (q: string) => (await listTenants(support, { q })).rows.map((r) => r.id);
    expect(await by("zebra thr")).toEqual([a.tenantId]);
    expect(await by(a.subdomain)).toEqual([a.tenantId]);
    expect(await by(a.input.email.toUpperCase())).toEqual([a.tenantId]);
    expect(await by(b.input.phone.slice(3))).toEqual([b.tenantId]);
    expect(await by("zebrathreads.example")).toEqual([a.tenantId]);
    expect(await by("no-such-store-anywhere")).toEqual([]);

    await approveSubscriptionPayment(fin, (await submitPaymentProof(a.tenantId, a.actor, proof({ plan: "BUSINESS" }))).id);
    const ids = async (filter: "trial" | "paying") => (await listTenants(support, { filter, pageSize: 500 })).rows.map((r) => r.id);
    expect(await ids("paying")).toContain(a.tenantId);
    expect(await ids("paying")).not.toContain(b.tenantId);
    expect(await ids("trial")).toContain(b.tenantId);
    expect((await listTenants(support, { pageSize: 2, page: 1 })).rows).toHaveLength(2);
  });

  it("shows one store in detail: usage, domains, payments, and what the platform did to it", async () => {
    const s = await signup({ plan: "PRO" });
    await approveSubscriptionPayment(fin, (await submitPaymentProof(s.tenantId, s.actor, proof())).id);
    await suspendTenant(boss, s.tenantId, "Temporary hold for a check");
    const d = await getTenantDetail(support, s.tenantId);
    expect(d).toMatchObject({ name: s.input.storeName, tier: "PRO", usage: { products: 8, staff: 1 }, suspendedReason: "Temporary hold for a check" });
    expect(d.proofs).toHaveLength(1);
    expect(d.audit.map((a) => a.action)).toEqual(expect.arrayContaining(["PAYMENT_APPROVED", "TENANT_SUSPENDED"]));
    await fails(getTenantDetail(support, "nope"), "NOT_FOUND");
  });

  it("totals the platform: monthly revenue, paying stores, trials, waiting payments", async () => {
    const o1 = await getOverview(boss);
    const s = await signup({ plan: "STARTER", demoData: false });
    const y = await signup({ plan: "STARTER", demoData: false });
    await approveSubscriptionPayment(fin, (await submitPaymentProof(s.tenantId, s.actor, proof({ plan: "PRO" }))).id);
    await approveSubscriptionPayment(fin, (await submitPaymentProof(y.tenantId, y.actor, proof({ plan: "PRO", interval: "YEARLY" }))).id);
    const waiting = await signup({ demoData: false });
    await submitPaymentProof(waiting.tenantId, waiting.actor, proof({ plan: "BUSINESS" }));
    const o2 = await getOverview(boss);
    expect(o2.payingStores - o1.payingStores).toBe(2);
    expect(Math.round((o2.mrr - o1.mrr) * 100)).toBe(Math.round((1499 + 14990 / 12) * 100));
    expect(o2.arr).toBeCloseTo(o2.mrr * 12, 1);
    expect(o2.activeTrials - o1.activeTrials).toBe(1);
    expect(o2.pendingPayments.count - o1.pendingPayments.count).toBe(1);
    expect(o2.pendingPayments.amount - o1.pendingPayments.amount).toBe(3499);
    expect(o2.signups).toHaveLength(14);
    expect(o2.signups[13]!.count).toBeGreaterThanOrEqual(3);
    expect(o2.trialToPaidPercent).not.toBeNull();
  });

  it("keeps the audit trail for those allowed to see it", async () => {
    const s = await signup();
    await changePlan(boss, s.tenantId, "PRO");
    expect((await listPlatformAudit(fin, { tenantId: s.tenantId })).map((a) => a.action)).toEqual(["PLAN_CHANGED"]);
    expect((await listPlatformAudit(boss, { action: "PLAN_CHANGED" })).length).toBeGreaterThan(0);
    await expect(listPlatformAudit(support)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listPlatformAudit(lead)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("the daily sweep", () => {
  /** A store whose trial ended `days` ago. */
  async function lapsed(days: number) {
    const s = await signup({ demoData: false });
    const end = new Date(Date.now() - days * DAY);
    await owner.tenant.update({ where: { id: s.tenantId }, data: { trialEndsAt: end } });
    await owner.subscription.update({ where: { tenantId: s.tenantId }, data: { currentPeriodEnd: end } });
    return s;
  }
  const status = async (id: string) => (await tenant(id)).status;

  it("moves a store through grace, read-only and locked as the days pass, and does it only once", async () => {
    const day2 = await lapsed(2 - 0.5);
    const day5 = await lapsed(5 - 0.5);
    const day20 = await lapsed(20);
    const fresh = await signup({ demoData: false });
    const r = await runBillingLifecycle();
    expect(r.changed).toBeGreaterThanOrEqual(3);
    expect(await status(day2.tenantId)).toBe("PAST_DUE");
    expect(await status(day5.tenantId)).toBe("SUSPENDED");
    expect(await status(day20.tenantId)).toBe("SUSPENDED");
    expect(await status(fresh.tenantId)).toBe("TRIAL");
    expect((await tenant(day2.tenantId)).subscription!.status).toBe("PAST_DUE");
    expect((await tenant(day5.tenantId)).subscription!.status).toBe("UNPAID");
    expect((await getStoreAccess(day2.tenantId)).state).toBe("GRACE");
    expect((await getStoreAccess(day5.tenantId)).state).toBe("READ_ONLY");
    expect((await getStoreAccess(day20.tenantId)).state).toBe("LOCKED");
    const again = await runBillingLifecycle();
    expect(again.changed).toBe(0);
    expect(await owner.platformAuditLog.count({ where: { tenantId: day5.tenantId, action: "STATUS_CHANGED", actorId: "SYSTEM" } })).toBe(1);
  });

  it("a payment brings a lapsed store straight back", async () => {
    const s = await lapsed(8);
    await runBillingLifecycle();
    expect(await status(s.tenantId)).toBe("SUSPENDED");
    await approveSubscriptionPayment(fin, (await submitPaymentProof(s.tenantId, s.actor, proof())).id);
    expect(await status(s.tenantId)).toBe("ACTIVE");
    expect((await getStoreAccess(s.tenantId)).state).toBe("ACTIVE");
    expect((await runBillingLifecycle()).changed).toBe(0);
  });

  it("leaves platform-suspended and cancelled stores alone", async () => {
    const a = await lapsed(30);
    await suspendTenant(boss, a.tenantId, "Under investigation");
    const b = await lapsed(30);
    await owner.tenant.update({ where: { id: b.tenantId }, data: { status: "CANCELLED" } });
    await runBillingLifecycle();
    expect(await owner.platformAuditLog.count({ where: { tenantId: a.tenantId, action: "STATUS_CHANGED" } })).toBe(0);
    expect(await status(b.tenantId)).toBe("CANCELLED");
  });

  it("publishes a reminder on the days that matter, and not on other days", async () => {
    const seen: { tenantId: string; kind: string }[] = [];
    setEventPublisher(async (name, data) => { if (name === "billing/reminder") seen.push(data as never); });
    const ending = await signup({ demoData: false });
    const end = new Date(Date.now() + 2.5 * DAY);
    await owner.tenant.update({ where: { id: ending.tenantId }, data: { trialEndsAt: end } });
    await owner.subscription.update({ where: { tenantId: ending.tenantId }, data: { currentPeriodEnd: end } });
    const overdue1 = await lapsed(0.5);
    const overdue4 = await lapsed(3.5);
    const overdue15 = await lapsed(14.5);
    const quiet = await lapsed(8);
    await runBillingLifecycle();
    const kind = (id: string) => seen.filter((e) => e.tenantId === id).map((e) => e.kind);
    expect(kind(ending.tenantId)).toEqual(["TRIAL_ENDING"]);
    expect(kind(overdue1.tenantId)).toEqual(["PAYMENT_OVERDUE"]);
    expect(kind(overdue4.tenantId)).toEqual(["READ_ONLY_STARTED"]);
    expect(kind(overdue15.tenantId)).toEqual(["LOCKED"]);
    expect(kind(quiet.tenantId)).toEqual([]);
  });
});
