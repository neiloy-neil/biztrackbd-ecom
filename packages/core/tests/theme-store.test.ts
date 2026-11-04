import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, withTenant, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  DomainError, PREMIUM_THEMES, PREMIUM_THEME_PRICE, STORE_THEMES, activateTheme, approveThemePurchase, isFreeThemeId, listPendingThemePurchases, listThemeStore, rejectThemePurchase,
  processUddoktaPaySubscriptionSuccess, resolveTemplateForSignup, setEventPublisher, setUddoktaPayFetchForTests, signupStore, startThemeCheckout, submitThemePurchase, type PlatformActor, type StaffActor,
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
  describe("paying online with UddoktaPay", () => {
    const ctx = { adminOrigin: "http://localhost:3001", platformOrigin: "http://localhost:3003" };
    let charged: Record<string, unknown> | null = null;
    const gateway = (verify: Record<string, unknown>) => setUddoktaPayFetchForTests((async (url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      if (String(url).endsWith("/api/checkout-v2")) {
        charged = body;
        return new Response(JSON.stringify({ status: true, payment_url: "https://pay.example.test/invoice/INV1" }), { status: 200 });
      }
      return new Response(JSON.stringify({ status: "COMPLETED", invoice_id: body.invoice_id, payment_method: "bkash", sender_number: "01712345678", ...verify }), { status: 200 });
    }) as unknown as typeof fetch);
    afterAll(() => setUddoktaPayFetchForTests(undefined));

    it("charges the theme price (never a browser amount) and carries what was bought in the charge", async () => {
      gateway({});
      const s = await store();
      const r = await startThemeCheckout(s.tenantId, s.actor, "maison", ctx);
      expect(r.paymentUrl).toContain("pay.example.test");
      expect(charged).toMatchObject({ amount: "49", metadata: { tenantId: s.tenantId, themeId: "maison", type: "theme" }, webhook_url: "http://localhost:3003/api/webhooks/uddoktapay", redirect_url: "http://localhost:3001/api/themes/uddoktapay/callback" });
      await fails(startThemeCheckout(s.tenantId, s.actor, "kapor", ctx), /free/);
    });

    it("unlocks the theme at once when the gateway says completed, once however often it is reported", async () => {
      const s = await store();
      const meta = { tenantId: s.tenantId, themeId: "maison", type: "theme" };
      gateway({ amount: "49", transaction_id: "ONLINETRX01", metadata: meta });
      expect(await processUddoktaPaySubscriptionSuccess("INV-A1")).toMatchObject({ ok: true, tenantId: s.tenantId, plan: "maison" });
      await processUddoktaPaySubscriptionSuccess("INV-A1");
      expect(await owner.themePurchase.count({ where: { tenantId: s.tenantId, themeId: "maison", status: "APPROVED" } })).toBe(1);
      expect((await listThemeStore(s.tenantId, s.actor)).themes.find((t) => t.id === "maison")!.state).toBe("OWNED");
      await activateTheme(s.tenantId, s.actor, "maison");
      await fails(startThemeCheckout(s.tenantId, s.actor, "maison", ctx), /already own/);
    });

    it("does not unlock on a pending payment, an amount that is too low, or an unknown theme", async () => {
      const s = await store();
      const meta = { tenantId: s.tenantId, themeId: "maison", type: "theme" };
      gateway({ status: "PENDING", amount: "49", transaction_id: "ONLINETRX02", metadata: meta });
      expect(await processUddoktaPaySubscriptionSuccess("INV-B1")).toMatchObject({ ok: false });
      gateway({ amount: "1", transaction_id: "ONLINETRX03", metadata: meta });
      await expect(processUddoktaPaySubscriptionSuccess("INV-B2")).rejects.toThrow(/less than the theme price/);
      gateway({ amount: "49", transaction_id: "ONLINETRX04", metadata: { ...meta, themeId: "kapor" } });
      await expect(processUddoktaPaySubscriptionSuccess("INV-B3")).rejects.toThrow(/not a premium theme/);
      expect(await owner.themePurchase.count({ where: { tenantId: s.tenantId, status: "APPROVED" } })).toBe(0);
    });
  });
});
