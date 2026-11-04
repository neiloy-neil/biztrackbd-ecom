import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  DomainError, approveModulePurchase, isForSale, listAppStoreCatalog, isModuleActive, listModulePricing, listModuleSales, listPendingModulePurchases, rejectModulePurchase,
  setEventPublisher, setModule, signupStore, submitModulePurchase, updateModulePricing, type PlatformActor, type StaffActor,
} from "../src";

const day = 24 * 60 * 60 * 1000;
const KEY = "wholesale_b2b";

describe("what makes a module for sale", () => {
  it("needs the admin's yes and a real price", () => {
    expect(isForSale({ sellable: true, priceModel: "MONTHLY", price: 99 })).toBe(true);
    expect(isForSale({ sellable: false, priceModel: "MONTHLY", price: 99 })).toBe(false);
    expect(isForSale({ sellable: true, priceModel: "FREE", price: 0 })).toBe(false);
    expect(isForSale({ sellable: true, priceModel: "ONE_TIME", price: 0 })).toBe(false);
  });
});

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const boss: PlatformActor = { id: "pu-OWNER", email: "owner@biztrackbd.test", role: "OWNER" };
const trx = () => `MP${Date.now().toString(36).toUpperCase()}${++seq}`.slice(0, 11).padEnd(9, "Z");
async function store(plan: "STARTER" | "PRO" = "STARTER") {
  const n = ++seq;
  const s = await signupStore({ ownerName: "Nusrat Jahan", email: `modules${n}@example.test`, phone: `0196${String(4000000 + n).slice(-7)}`, storeName: `Modules ${n}`, subdomain: `modules${n}shop`, plan, category: "FASHION" } as never);
  const row = await owner.tenantUser.findFirstOrThrow({ where: { tenantId: s.tenantId } });
  return { tenantId: s.tenantId, actor: { userId: row.id, email: row.email, name: row.name, role: "STORE_OWNER" } as StaffActor };
}
const pay = (moduleKey = KEY) => ({ moduleKey, provider: "BKASH", senderNumber: "01712345678", trxId: trx() });
const failure = (p: Promise<unknown>) => p.then(() => null, (x) => x as Error);
const stateOf = async (s: { tenantId: string; actor: StaffActor }, key = KEY) => (await listModuleSales(s.tenantId, s.actor)).items.find((i) => i.moduleKey === key)!;
const approveLatest = async (tenantId: string) => {
  const p = (await listPendingModulePurchases(boss, owner)).find((x) => x.tenantId === tenantId)!;
  return approveModulePurchase(boss, p.id, owner);
};

describe("paid add-on modules", () => {
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

  it("lists every built add-on to the admin, none for sale until priced", async () => {
    const rows = await listModulePricing(boss, owner);
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.find((r) => r.moduleKey === KEY)).toMatchObject({ sellable: false, price: 0, saved: false });
    expect(rows.some((r) => r.moduleKey === "bespoke")).toBe(false);
  });

  it("checks the pricing form", async () => {
    expect((await failure(updateModulePricing(boss, KEY, { priceModel: "FREE", priceBdt: 0, sellable: true }, owner)))!.message).toMatch(/at least 1 taka/);
    expect((await failure(updateModulePricing(boss, "nope", { priceModel: "MONTHLY", priceBdt: 99, sellable: true }, owner)))!.message).toMatch(/not found/i);
    expect(await failure(updateModulePricing({ ...boss, role: "SUPPORT" } as PlatformActor, KEY, { priceModel: "MONTHLY", priceBdt: 99, sellable: true }, owner))).toBeTruthy();
  });

  it("a module that is not for sale cannot be bought", async () => {
    const s = await store();
    expect(await stateOf(s)).toMatchObject({ state: "NOT_FOR_SALE" });
    const e = await failure(submitModulePurchase(s.tenantId, s.actor, pay()));
    expect(e).toBeInstanceOf(DomainError);
    expect(e!.message).toMatch(/not for sale/);
  });

  it("a monthly module is bought, switches on, runs out and can be renewed", async () => {
    await updateModulePricing(boss, KEY, { priceModel: "MONTHLY", priceBdt: 199, sellable: true }, owner);
    const s = await store();
    expect(await isModuleActive(s.tenantId, KEY)).toBe(false);
    expect(await stateOf(s)).toMatchObject({ state: "FOR_SALE", price: 199, priceModel: "MONTHLY" });

    await submitModulePurchase(s.tenantId, s.actor, pay());
    expect(Number((await owner.modulePurchase.findFirstOrThrow({ where: { tenantId: s.tenantId } })).amount)).toBe(199);
    expect(await stateOf(s)).toMatchObject({ state: "PENDING" });
    expect((await failure(submitModulePurchase(s.tenantId, s.actor, pay())))!.message).toMatch(/waiting to be checked/);
    expect(await isModuleActive(s.tenantId, KEY)).toBe(false);

    const done = await approveLatest(s.tenantId);
    expect(done.expiresAt!.getTime() - Date.now()).toBeGreaterThan(29 * day);
    expect(await isModuleActive(s.tenantId, KEY)).toBe(true);
    expect(await stateOf(s)).toMatchObject({ state: "OWNED" });
    expect(await owner.tenantModule.findFirstOrThrow({ where: { tenantId: s.tenantId, moduleKey: KEY } })).toMatchObject({ isEnabled: true, source: "PURCHASE" });
    // The apps screen shows it as active, not locked, even though the plan includes no add-ons.
    const apps = await listAppStoreCatalog(s.tenantId, s.actor);
    expect(apps.apps.find((a) => a.key === KEY)).toMatchObject({ status: "ACTIVE", enabled: true });
    expect(apps.usedAddons).toBe(0);

    // Renewing early is allowed and extends from the current end.
    await submitModulePurchase(s.tenantId, s.actor, pay());
    const before = done.expiresAt!.getTime();
    const again = await approveLatest(s.tenantId);
    expect(again.expiresAt!.getTime()).toBeGreaterThanOrEqual(before + 29 * day);

    // Let it run out: the module switches off everywhere with nothing to sweep.
    await owner.tenantModule.update({ where: { tenantId_moduleKey: { tenantId: s.tenantId, moduleKey: KEY } }, data: { expiresAt: new Date(Date.now() - day) } });
    expect(await isModuleActive(s.tenantId, KEY)).toBe(false);
    expect(await stateOf(s)).toMatchObject({ state: "FOR_SALE", expired: true });
    // And it can be bought again.
    await submitModulePurchase(s.tenantId, s.actor, pay());
    await approveLatest(s.tenantId);
    expect(await isModuleActive(s.tenantId, KEY)).toBe(true);
  });

  it("a one-time module stays on for good and cannot be bought twice", async () => {
    await updateModulePricing(boss, "loyalty", { priceModel: "ONE_TIME", priceBdt: 499, sellable: true }, owner);
    const s = await store();
    await submitModulePurchase(s.tenantId, s.actor, pay("loyalty"));
    const done = await approveLatest(s.tenantId);
    expect(done.expiresAt).toBeNull();
    expect(await isModuleActive(s.tenantId, "loyalty")).toBe(true);
    expect((await failure(submitModulePurchase(s.tenantId, s.actor, pay("loyalty"))))!.message).toMatch(/already have/);
  });

  it("the owner can switch a bought module off and on again on a plan that does not include it", async () => {
    const s = await store();
    await submitModulePurchase(s.tenantId, s.actor, pay());
    await approveLatest(s.tenantId);
    await setModule(s.tenantId, s.actor, KEY, false);
    expect(await isModuleActive(s.tenantId, KEY)).toBe(false);
    await setModule(s.tenantId, s.actor, KEY, true);
    expect(await isModuleActive(s.tenantId, KEY)).toBe(true);
    // A module that was never bought still cannot be switched on.
    const other = await store();
    expect((await failure(setModule(other.tenantId, other.actor, KEY, true)))!.message).toMatch(/not included in your plan/);
  });

  it("a plan that already includes modules cannot buy them", async () => {
    const pro = await store("PRO");
    expect(await stateOf(pro)).toMatchObject({ state: "INCLUDED" });
    expect((await failure(submitModulePurchase(pro.tenantId, pro.actor, pay())))!.message).toMatch(/plan already includes/);
  });

  it("checks the payment details, never reuses a TrxID, and shows a rejection reason", async () => {
    const s = await store();
    const bad = async (over: Record<string, unknown>) => (await failure(submitModulePurchase(s.tenantId, s.actor, { ...pay(), ...over })))!.message;
    expect(await bad({ trxId: "bad" })).toMatch(/does not look right/);
    expect(await bad({ senderNumber: "12" })).toMatch(/mobile number/);
    expect(await bad({ moduleKey: "bespoke" })).toMatch(/cannot be bought/);
    const id = trx();
    await submitModulePurchase(s.tenantId, s.actor, { ...pay(), trxId: id });
    const other = await store();
    expect((await failure(submitModulePurchase(other.tenantId, other.actor, { ...pay(), trxId: id })))!.message).toMatch(/already been used/);
    const row = await owner.modulePurchase.findFirstOrThrow({ where: { tenantId: s.tenantId } });
    expect((await failure(rejectModulePurchase(boss, row.id, "", owner)))!.message).toMatch(/Tell the store why/);
    await rejectModulePurchase(boss, row.id, "TrxID not found in our bKash", owner);
    expect((await failure(approveModulePurchase(boss, row.id, owner)))!.message).toMatch(/already rejected/);
    expect(await stateOf(s)).toMatchObject({ state: "FOR_SALE", lastRejection: "TrxID not found in our bKash" });
    expect(await isModuleActive(s.tenantId, KEY)).toBe(false);
  });

  it("a store cannot approve its own purchase or read another store's", async () => {
    const a = await store();
    const b = await store();
    await submitModulePurchase(a.tenantId, a.actor, pay());
    const { withTenant } = await import("@biztrackbd/db");
    const seenByB = await withTenant(b.tenantId, (tx) => tx.modulePurchase.count());
    expect(seenByB).toBe(0);
    const e = await withTenant(a.tenantId, (tx) => tx.modulePurchase.updateMany({ data: { status: "APPROVED" } })).then(() => null, (x) => x as Error);
    expect(e).not.toBeNull();
  });
});
