import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, withTenant, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  DomainError, PREMIUM_THEMES, PREMIUM_THEME_PRICE, STORE_THEMES, activateTheme, approveThemePurchase, isFreeThemeId, listPendingThemePurchases, listThemeStore, rejectThemePurchase,
  resolveTemplateForSignup, setEventPublisher, signupStore, submitThemePurchase, type PlatformActor, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const boss: PlatformActor = { id: "pu-OWNER", email: "owner@biztrackbd.test", role: "OWNER" };
const phone = () => `0193${String(1000000 + ++seq).slice(-7)}`;
const trx = () => `TH${Date.now().toString(36).toUpperCase()}${++seq}`.slice(0, 11).padEnd(9, "Z");

async function store() {
  const n = ++seq;
  const s = await signupStore({ ownerName: "Nusrat Jahan", email: `themes${n}@example.test`, phone: phone(), storeName: `Themes ${n}`, subdomain: `themes${n}shop`, plan: "STARTER", category: "FASHION" });
  const row = await owner.tenantUser.findFirstOrThrow({ where: { tenantId: s.tenantId } });
  return { tenantId: s.tenantId, actor: { userId: row.id, email: row.email, name: row.name, role: "STORE_OWNER" } as StaffActor };
}
const pay = (over: Record<string, unknown> = {}) => ({ themeId: "maison", provider: "BKASH", senderNumber: "01712345678", trxId: trx(), ...over });
const fails = async (p: Promise<unknown>, msg: RegExp) => {
  const e = await p.then(() => null, (x) => x);
  expect(e).toBeInstanceOf(DomainError);
  expect((e as DomainError).message).toMatch(msg);
};

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
});
afterAll(async () => {
  await app.$disconnect();
  await owner.$disconnect();
});

describe("premium themes (49 taka, once, for life)", () => {
  it("keeps the premium family out of the free list, signup and templates", async () => {
    expect(PREMIUM_THEMES.length).toBeGreaterThan(0);
    for (const t of PREMIUM_THEMES) {
      expect(isFreeThemeId(t.id)).toBe(false);
      expect(STORE_THEMES.some((f) => f.id === t.id)).toBe(false);
      await expect(resolveTemplateForSignup(t.id)).rejects.toBeInstanceOf(DomainError);
    }
    expect(PREMIUM_THEME_PRICE).toBe(49);
  });

  it("lists every theme with its state, and refuses to apply a premium theme that is not owned", async () => {
    const s = await store();
    const view = await listThemeStore(s.tenantId, s.actor);
    expect(view.price).toBe(49);
    expect(view.themes.filter((t) => !t.premium).every((t) => t.state === "FREE")).toBe(true);
    expect(view.themes.find((t) => t.id === "maison")).toMatchObject({ premium: true, state: "LOCKED", price: 49, active: false });
    await fails(activateTheme(s.tenantId, s.actor, "maison"), /Buy this premium theme/);
    expect(await owner.tenant.findUniqueOrThrow({ where: { id: s.tenantId } })).toMatchObject({ themeId: "kapor" });
    // A free theme is always allowed.
    await activateTheme(s.tenantId, s.actor, "bindu");
  });

  it("checks the payment details, allows one waiting payment per theme and never reuses a TrxID", async () => {
    const s = await store();
    await fails(submitThemePurchase(s.tenantId, s.actor, pay({ themeId: "kapor" })), /free/);
    await fails(submitThemePurchase(s.tenantId, s.actor, pay({ trxId: "bad" })), /does not look right/);
    await fails(submitThemePurchase(s.tenantId, s.actor, pay({ senderNumber: "12" })), /mobile number/);
    const id = trx();
    await submitThemePurchase(s.tenantId, s.actor, pay({ trxId: id }));
    const row = await owner.themePurchase.findFirstOrThrow({ where: { tenantId: s.tenantId } });
    expect(row).toMatchObject({ status: "PENDING", themeId: "maison", trxId: id });
    expect(Number(row.amount)).toBe(49);
    expect((await listThemeStore(s.tenantId, s.actor)).themes.find((t) => t.id === "maison")!.state).toBe("PENDING");
    await fails(submitThemePurchase(s.tenantId, s.actor, pay()), /waiting to be checked/);
    const other = await store();
    await fails(submitThemePurchase(other.tenantId, other.actor, pay({ trxId: id })), /already been used/);
    // Still locked until the platform approves.
    await fails(activateTheme(s.tenantId, s.actor, "maison"), /Buy this premium theme/);
  });

  it("unlocks for good once the platform approves, installs the premium layout, and does not leak to other stores", async () => {
    const s = await store();
    const other = await store();
    await submitThemePurchase(s.tenantId, s.actor, pay());
    const pending = await listPendingThemePurchases(boss, owner);
    const row = pending.find((p) => p.tenantId === s.tenantId)!;
    expect(row).toMatchObject({ themeId: "maison", themeName: "Maison", amount: 49 });
    await approveThemePurchase(boss, row.id, owner);
    await fails(approveThemePurchase(boss, row.id, owner), /already approved/);
    expect((await listThemeStore(s.tenantId, s.actor)).themes.find((t) => t.id === "maison")!.state).toBe("OWNED");

    await activateTheme(s.tenantId, s.actor, "maison");
    expect(await owner.tenant.findUniqueOrThrow({ where: { id: s.tenantId } })).toMatchObject({ themeId: "maison" });
    const home = await owner.themeVersion.findFirstOrThrow({ where: { tenantId: s.tenantId, themeId: "maison", pageKey: "home", state: "PUBLISHED" } });
    const types = (home.sectionsJson as { sections: { type: string }[] }).sections.map((x) => x.type);
    expect(types).toEqual(expect.arrayContaining(["hero", "banner", "featured-products", "trust-strip"]));

    // Switching away and back needs no second payment: it is theirs for life.
    await activateTheme(s.tenantId, s.actor, "kapor");
    await activateTheme(s.tenantId, s.actor, "maison");
    // Another store still has to buy it.
    await fails(activateTheme(other.tenantId, other.actor, "maison"), /Buy this premium theme/);
    await fails(submitThemePurchase(s.tenantId, s.actor, pay()), /already own/);
  });

  it("lets a store try again after a rejection, with the reason shown, and keeps the rejected TrxID used", async () => {
    const s = await store();
    const bad = trx();
    await submitThemePurchase(s.tenantId, s.actor, pay({ trxId: bad }));
    const id = (await owner.themePurchase.findFirstOrThrow({ where: { tenantId: s.tenantId } })).id;
    await fails(rejectThemePurchase(boss, id, "", owner), /Tell the store why/);
    await rejectThemePurchase(boss, id, "TrxID not found in our bKash", owner);
    const view = await listThemeStore(s.tenantId, s.actor);
    expect(view.themes.find((t) => t.id === "maison")).toMatchObject({ state: "LOCKED", lastRejection: "TrxID not found in our bKash" });
    await fails(submitThemePurchase(s.tenantId, s.actor, pay({ trxId: bad })), /already been used/);
    await submitThemePurchase(s.tenantId, s.actor, pay());
  });

  it("does not let a store approve its own purchase", async () => {
    const s = await store();
    await submitThemePurchase(s.tenantId, s.actor, pay());
    const id = (await owner.themePurchase.findFirstOrThrow({ where: { tenantId: s.tenantId } })).id;
    await expect(withTenant(s.tenantId, (tx) => tx.themePurchase.update({ where: { id }, data: { status: "APPROVED" } }))).rejects.toThrow();
    expect((await owner.themePurchase.findUniqueOrThrow({ where: { id } })).status).toBe("PENDING");
  });
});
