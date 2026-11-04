import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, withTenant, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  DomainError, approveThemePurchase, discountCents, getCatalogueRevenue, listPendingThemePurchases, listThemeBundles, listThemeDiscounts, listThemeStore, processUddoktaPaySubscriptionSuccess, quoteThemeCheckout,
  rejectThemePurchase, saveThemeBundle, saveThemeDiscount, setEventPublisher, setThemeDiscountActive, setUddoktaPayFetchForTests, signupStore, splitCents, startThemeCheckout, submitThemePurchase, type PlatformActor, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const boss: PlatformActor = { id: "pu-OWNER", email: "owner@biztrackbd.test", role: "OWNER" };
const phone = () => `0194${String(1000000 + ++seq).slice(-7)}`;
const trx = () => `DC${Date.now().toString(36).toUpperCase()}${++seq}`.slice(0, 11).padEnd(9, "Z");

async function store() {
  const n = ++seq;
  const s = await signupStore({ ownerName: "Nusrat Jahan", email: `disc${n}@example.test`, phone: phone(), storeName: `Disc ${n}`, subdomain: `disc${n}shop`, plan: "STARTER", category: "FASHION" });
  const row = await owner.tenantUser.findFirstOrThrow({ where: { tenantId: s.tenantId } });
  return { tenantId: s.tenantId, actor: { userId: row.id, email: row.email, name: row.name, role: "STORE_OWNER" } as StaffActor };
}
const pay = (over: Record<string, unknown> = {}) => ({ themeId: "maison", provider: "BKASH", senderNumber: "01712345678", trxId: trx(), ...over });
const fails = async (p: Promise<unknown>, msg: RegExp) => {
  const e = await p.then(() => null, (x) => x);
  expect(e).toBeInstanceOf(DomainError);
  expect((e as DomainError).message).toMatch(msg);
};
const code = (c: string, over: Record<string, unknown> = {}) => saveThemeDiscount(boss, { code: c, kind: "PERCENT", value: 20, ...over }, null, owner);
const used = async (c: string) => (await owner.themeDiscount.findUniqueOrThrow({ where: { code: c } })).usedCount;

describe("discount arithmetic (no database)", () => {
  it("takes a percent or a fixed amount off but never below one taka", () => {
    expect(discountCents(4900, { kind: "PERCENT", value: 20 })).toBe(980);
    expect(discountCents(4900, { kind: "FIXED", value: 10 })).toBe(1000);
    expect(discountCents(4900, { kind: "FIXED", value: 500 })).toBe(4800);
    expect(discountCents(4900, { kind: "PERCENT", value: 99 })).toBe(4800);
    expect(discountCents(100, { kind: "FIXED", value: 50 })).toBe(0);
    expect(discountCents(3333, { kind: "PERCENT", value: 10 })).toBe(333);
  });
  it("splits a price over rows so the parts add up exactly", () => {
    for (const [total, weights] of [[9999, [4900, 4900, 4900]], [10001, [1, 1, 1]], [1, [3, 2]], [14700, [4900, 4900, 4900]]] as const) {
      const parts = splitCents(total, [...weights]);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      expect(parts.every((p) => p >= 0)).toBe(true);
    }
    expect(splitCents(9900, [49, 49])).toEqual([4950, 4950]);
  });
});

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
  setUddoktaPayFetchForTests(undefined);
  await app.$disconnect();
  await owner.$disconnect();
});

describe("a discount code at theme checkout", () => {
  it("shows the discounted price, stores what was charged, and ignores any amount the browser sends", async () => {
    await code("SAVE20");
    const s = await store();
    expect(await quoteThemeCheckout(s.tenantId, s.actor, { themeId: "maison", code: "save20 " })).toMatchObject({ listPrice: 49, discount: 9.8, total: 39.2, code: "SAVE20" });
    await submitThemePurchase(s.tenantId, s.actor, pay({ code: "save20", amount: 1, total: 1, price: 1 }));
    const row = await owner.themePurchase.findFirstOrThrow({ where: { tenantId: s.tenantId } });
    expect(Number(row.amount)).toBe(39.2);
    expect(row).toMatchObject({ discountCode: "SAVE20", status: "PENDING" });
    expect(Number(row.discountAmount)).toBe(9.8);
    expect(await used("SAVE20")).toBe(1);
    expect((await listPendingThemePurchases(boss, owner)).find((p) => p.tenantId === s.tenantId)).toMatchObject({ amount: 39.2, discountCode: "SAVE20" });
  });

  it("refuses codes that are unknown, off, expired, used up or for another theme, and a code that fails leaves the count alone", async () => {
    await code("OFFCODE");
    await code("OLDCODE", { expiresAt: new Date(Date.now() - 1000).toISOString() });
    await code("ONLYVOLT", { themeIds: ["voltedge"] });
    await code("ONCE", { maxUses: 1 });
    await setThemeDiscountActive(boss, (await owner.themeDiscount.findUniqueOrThrow({ where: { code: "OFFCODE" } })).id, false, owner);
    const s = await store();
    await fails(submitThemePurchase(s.tenantId, s.actor, pay({ code: "NOSUCH" })), /not valid/);
    await fails(submitThemePurchase(s.tenantId, s.actor, pay({ code: "OFFCODE" })), /not valid/);
    await fails(submitThemePurchase(s.tenantId, s.actor, pay({ code: "OLDCODE" })), /expired/);
    await fails(submitThemePurchase(s.tenantId, s.actor, pay({ code: "ONLYVOLT" })), /does not work for this theme/);
    await fails(submitThemePurchase(s.tenantId, s.actor, pay({ code: "bad code!" })), /not valid/);
    expect(await owner.themePurchase.count({ where: { tenantId: s.tenantId } })).toBe(0);
    // A limited code works for its own theme.
    expect(await quoteThemeCheckout(s.tenantId, s.actor, { themeId: "voltedge", code: "ONLYVOLT" })).toMatchObject({ total: 39.2 });

    await submitThemePurchase(s.tenantId, s.actor, pay({ code: "ONCE" }));
    const other = await store();
    await fails(submitThemePurchase(other.tenantId, other.actor, pay({ code: "ONCE" })), /used up/);
    expect(await used("ONCE")).toBe(1);
    // The store failing on a taken TrxID gives the use back (same transaction).
    await code("TWICE", { maxUses: 5 });
    const t = trx();
    await submitThemePurchase(other.tenantId, other.actor, pay({ trxId: t }));
    const third = await store();
    await fails(submitThemePurchase(third.tenantId, third.actor, pay({ trxId: t, code: "TWICE" })), /already been used/);
    expect(await used("TWICE")).toBe(0);
  });

  it("gives the use back when the platform rejects the payment, and counts revenue only for what was charged", async () => {
    await code("GIVEBACK", { maxUses: 1 });
    const s = await store();
    await submitThemePurchase(s.tenantId, s.actor, pay({ code: "GIVEBACK" }));
    expect(await used("GIVEBACK")).toBe(1);
    const id = (await owner.themePurchase.findFirstOrThrow({ where: { tenantId: s.tenantId } })).id;
    await rejectThemePurchase(boss, id, "TrxID not found", owner);
    expect(await used("GIVEBACK")).toBe(0);
    const row = (await listThemeDiscounts(boss, owner)).find((d) => d.code === "GIVEBACK")!;
    expect(row).toMatchObject({ usedCount: 0, discountGiven: 0, revenue: 0 });
  });

  it("is never readable or changeable by a store beyond the active rows it needs", async () => {
    await code("PRIVATE1");
    const s = await store();
    const id = (await owner.themeDiscount.findUniqueOrThrow({ where: { code: "PRIVATE1" } })).id;
    await expect(withTenant(s.tenantId, (tx) => tx.themeDiscount.update({ where: { id }, data: { value: 99 } }))).rejects.toThrow();
    await expect(withTenant(s.tenantId, (tx) => tx.themeDiscount.create({ data: { code: "SELFMADE", kind: "PERCENT", value: 99 } }))).rejects.toThrow();
    await expect(withTenant(s.tenantId, (tx) => tx.themeDiscount.update({ where: { id }, data: { usedCount: 0 } }))).rejects.toThrow();
    await setThemeDiscountActive(boss, id, false, owner);
    expect(await withTenant(s.tenantId, (tx) => tx.themeDiscount.findUnique({ where: { id } }))).toBeNull();
  });

  it("validates the code form in the platform admin", async () => {
    await fails(code("x"), /3 to 32/);
    await fails(code("BIGPCT", { value: 100 }), /1 to 99/);
    await fails(code("NOVALUE", { value: 0 }), /more than zero/);
    await fails(code("FREEONE", { themeIds: ["kapor"] }), /not a premium theme/);
    await code("DUPE1");
    await fails(code("dupe1"), /already exists/);
    await expect(saveThemeDiscount({ id: "x", email: "x", role: "SUPPORT" } as never, { code: "NOPE1", kind: "PERCENT", value: 5 }, null, owner)).rejects.toBeInstanceOf(DomainError);
  });
});

describe("theme bundles", () => {
  const bundle = (over: Record<string, unknown> = {}) => saveThemeBundle(boss, { id: "duo", name: "Duo pack", themeIds: ["maison", "voltedge"], priceModel: "ONE_TIME", priceBdt: 70, ...over }, owner);

  it("validates what a bundle is made of", async () => {
    await fails(bundle({ themeIds: ["maison"] }), /at least two/);
    await fails(bundle({ themeIds: ["maison", "maison"] }), /two different/);
    await fails(bundle({ themeIds: ["maison", "kapor"] }), /not a premium theme/);
    await fails(bundle({ priceBdt: 0 }), /at least 1 taka/);
    await fails(bundle({ id: "Bad Id!" }), /bundle id/);
    await bundle();
    expect((await listThemeBundles(boss, owner)).find((b) => b.id === "duo")).toMatchObject({ price: 70, listPrice: 98, sold: 0, active: true });
  });

  it("is one payment that unlocks every theme once approved, without counting the money twice", async () => {
    await bundle();
    const s = await store();
    const view = await listThemeStore(s.tenantId, s.actor);
    expect(view.bundles.find((b) => b.id === "duo")).toMatchObject({ price: 70, listPrice: 98, state: "AVAILABLE" });
    await submitThemePurchase(s.tenantId, s.actor, { bundleId: "duo", provider: "BKASH", senderNumber: "01712345678", trxId: trx(), amount: 1 });
    const rows = await owner.themePurchase.findMany({ where: { tenantId: s.tenantId }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.themeId).sort()).toEqual(["maison", "voltedge"]);
    expect(rows.reduce((n, r) => n + Number(r.amount), 0)).toBe(70);
    expect(new Set(rows.map((r) => r.groupId)).size).toBe(1);
    expect(rows.filter((r) => r.leadRow)).toHaveLength(1);
    expect((await listThemeStore(s.tenantId, s.actor)).bundles.find((b) => b.id === "duo")!.state).toBe("PENDING");
    await fails(submitThemePurchase(s.tenantId, s.actor, pay()), /waiting to be checked/);

    const pending = (await listPendingThemePurchases(boss, owner)).filter((p) => p.tenantId === s.tenantId);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ amount: 70, themeName: "Duo pack (bundle of 2)" });
    await approveThemePurchase(boss, pending[0]!.id, owner);
    const after = await listThemeStore(s.tenantId, s.actor);
    expect(after.themes.filter((t) => ["maison", "voltedge"].includes(t.id)).every((t) => t.state === "OWNED")).toBe(true);
    expect(after.bundles.find((b) => b.id === "duo")!.state).toBe("OWNED");
    await fails(submitThemePurchase(s.tenantId, s.actor, { bundleId: "duo", provider: "BKASH", senderNumber: "01712345678", trxId: trx() }), /already have every theme/);
    await fails(approveThemePurchase(boss, rows[1]!.id, owner), /already approved/);

    expect((await listThemeBundles(boss, owner)).find((b) => b.id === "duo")!.sold).toBe(1);
  });

  it("counts the bundle as one order and its price once in the revenue totals", async () => {
    const before = await getCatalogueRevenue(boss, "all", owner);
    await bundle({ id: "trio", name: "Trio", themeIds: ["maison", "voltedge", "lumiere"], priceBdt: 100 });
    const s = await store();
    await submitThemePurchase(s.tenantId, s.actor, { bundleId: "trio", provider: "NAGAD", senderNumber: "01712345678", trxId: trx() });
    const id = (await owner.themePurchase.findFirstOrThrow({ where: { tenantId: s.tenantId, leadRow: true } })).id;
    await approveThemePurchase(boss, id, owner);
    const after = await getCatalogueRevenue(boss, "all", owner);
    expect(after.totals.themes - before.totals.themes).toBe(100);
    expect(after.totals.orders - before.totals.orders).toBe(1);
  });

  it("rejects the whole payment together, keeping the TrxID used", async () => {
    await bundle();
    const s = await store();
    const t = trx();
    await submitThemePurchase(s.tenantId, s.actor, { bundleId: "duo", provider: "BKASH", senderNumber: "01712345678", trxId: t });
    const lead = await owner.themePurchase.findFirstOrThrow({ where: { tenantId: s.tenantId, leadRow: true } });
    await rejectThemePurchase(boss, lead.id, "TrxID not found", owner);
    expect(await owner.themePurchase.count({ where: { tenantId: s.tenantId, status: "REJECTED" } })).toBe(2);
    const view = await listThemeStore(s.tenantId, s.actor);
    expect(view.bundles.find((b) => b.id === "duo")).toMatchObject({ state: "AVAILABLE", lastRejection: "TrxID not found" });
    await fails(submitThemePurchase(s.tenantId, s.actor, { bundleId: "duo", provider: "BKASH", senderNumber: "01712345678", trxId: t }), /already been used/);
  });

  it("takes a code off the bundle price, and only a code that covers every theme in it", async () => {
    await bundle();
    await code("BUNDLE10", { kind: "FIXED", value: 10 });
    await code("MAISONONLY", { themeIds: ["maison"] });
    const s = await store();
    expect(await quoteThemeCheckout(s.tenantId, s.actor, { bundleId: "duo", code: "BUNDLE10" })).toMatchObject({ listPrice: 70, discount: 10, total: 60 });
    await fails(quoteThemeCheckout(s.tenantId, s.actor, { bundleId: "duo", code: "MAISONONLY" }), /does not cover every theme/);
    await submitThemePurchase(s.tenantId, s.actor, { bundleId: "duo", code: "BUNDLE10", provider: "BKASH", senderNumber: "01712345678", trxId: trx() });
    const rows = await owner.themePurchase.findMany({ where: { tenantId: s.tenantId } });
    expect(rows.reduce((n, r) => n + Number(r.amount), 0)).toBe(60);
    expect(rows.reduce((n, r) => n + Number(r.discountAmount), 0)).toBe(10);
    const usage = (await listThemeDiscounts(boss, owner)).find((d) => d.code === "BUNDLE10")!;
    expect(usage).toMatchObject({ usedCount: 1, discountGiven: 10, revenue: 60 });
  });

  it("does not offer a bundle the admin has switched off", async () => {
    await bundle({ id: "hidden", name: "Hidden", themeIds: ["lumiere", "harvest"] });
    await owner.themeBundle.update({ where: { id: "hidden" }, data: { active: false } });
    const s = await store();
    expect((await listThemeStore(s.tenantId, s.actor)).bundles.some((b) => b.id === "hidden")).toBe(false);
    await fails(submitThemePurchase(s.tenantId, s.actor, { bundleId: "hidden", provider: "BKASH", senderNumber: "01712345678", trxId: trx() }), /not available/);
  });
});

describe("paying online with a code or a bundle", () => {
  const ctx = { adminOrigin: "http://localhost:3001", platformOrigin: "http://localhost:3003" };
  let charged: Record<string, unknown> | null = null;
  const gateway = (verify: Record<string, unknown>) => setUddoktaPayFetchForTests((async (url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    if (String(url).endsWith("/api/checkout-v2")) { charged = body; return new Response(JSON.stringify({ status: true, payment_url: "https://pay.example.test/invoice/INV1" }), { status: 200 }); }
    return new Response(JSON.stringify({ status: "COMPLETED", invoice_id: body.invoice_id, payment_method: "bkash", sender_number: "01712345678", ...verify }), { status: 200 });
  }) as unknown as typeof fetch);

  it("charges the discounted price and accepts exactly that amount, not less", async () => {
    await code("ONLINE20");
    gateway({});
    const s = await store();
    await startThemeCheckout(s.tenantId, s.actor, "maison", ctx, { code: "online20" });
    expect(charged).toMatchObject({ amount: "39.2", metadata: { tenantId: s.tenantId, themeId: "maison", type: "theme", code: "ONLINE20" } });
    const meta = { tenantId: s.tenantId, themeId: "maison", type: "theme", code: "ONLINE20" };
    gateway({ amount: "39.2", transaction_id: "ONLDISC001", metadata: meta });
    expect(await processUddoktaPaySubscriptionSuccess("INV-D1")).toMatchObject({ ok: true, tenantId: s.tenantId });
    await processUddoktaPaySubscriptionSuccess("INV-D1");
    const rows = await owner.themePurchase.findMany({ where: { tenantId: s.tenantId } });
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]!.amount)).toBe(39.2);
    expect(await used("ONLINE20")).toBe(1);

    const t = await store();
    gateway({ amount: "39.19", transaction_id: "ONLDISC002", metadata: { ...meta, tenantId: t.tenantId } });
    await expect(processUddoktaPaySubscriptionSuccess("INV-D2")).rejects.toThrow(/less than the theme price/);
    // Paying the full price with the code left out is fine; paying the discounted price WITHOUT a code in the charge is not.
    gateway({ amount: "39.2", transaction_id: "ONLDISC003", metadata: { tenantId: t.tenantId, themeId: "maison", type: "theme" } });
    await expect(processUddoktaPaySubscriptionSuccess("INV-D3")).rejects.toThrow(/less than the theme price/);
    expect(await owner.themePurchase.count({ where: { tenantId: t.tenantId } })).toBe(0);
  });

  it("still honours a payment whose code ran out while the owner was paying", async () => {
    await code("RACE1", { maxUses: 1 });
    const s = await store();
    const meta = { tenantId: s.tenantId, themeId: "maison", type: "theme", code: "RACE1" };
    await owner.themeDiscount.update({ where: { code: "RACE1" }, data: { usedCount: 1 } });
    gateway({ amount: "39.2", transaction_id: "ONLRACE001", metadata: meta });
    expect(await processUddoktaPaySubscriptionSuccess("INV-R1")).toMatchObject({ ok: true });
    expect(await owner.themePurchase.count({ where: { tenantId: s.tenantId, status: "APPROVED" } })).toBe(1);
    // But a new checkout with the used-up code is refused up front.
    await fails(startThemeCheckout(s.tenantId, s.actor, "voltedge", ctx, { code: "RACE1" }), /used up/);
  });

  it("buys a bundle online: one charge at the bundle price, one row per theme, once however often it is reported", async () => {
    await saveThemeBundle(boss, { id: "onlinepack", name: "Online pack", themeIds: ["lumiere", "harvest"], priceModel: "ONE_TIME", priceBdt: 60 }, owner);
    gateway({});
    const s = await store();
    await startThemeCheckout(s.tenantId, s.actor, "", ctx, { bundleId: "onlinepack" });
    expect(charged).toMatchObject({ amount: "60", metadata: { tenantId: s.tenantId, bundleId: "onlinepack", type: "theme" } });
    const meta = { tenantId: s.tenantId, bundleId: "onlinepack", type: "theme" };
    gateway({ amount: "59", transaction_id: "ONLBUND001", metadata: meta });
    await expect(processUddoktaPaySubscriptionSuccess("INV-B1")).rejects.toThrow(/less than the bundle price/);
    gateway({ amount: "60", transaction_id: "ONLBUND002", metadata: meta });
    expect(await processUddoktaPaySubscriptionSuccess("INV-B2")).toMatchObject({ ok: true, plan: "onlinepack" });
    await processUddoktaPaySubscriptionSuccess("INV-B2");
    const rows = await owner.themePurchase.findMany({ where: { tenantId: s.tenantId, status: "APPROVED" } });
    expect(rows.map((r) => r.themeId).sort()).toEqual(["harvest", "lumiere"]);
    expect(rows.reduce((n, r) => n + Number(r.amount), 0)).toBe(60);
    const view = await listThemeStore(s.tenantId, s.actor);
    expect(view.themes.filter((t) => ["lumiere", "harvest"].includes(t.id)).every((t) => t.state === "OWNED")).toBe(true);
    await fails(startThemeCheckout(s.tenantId, s.actor, "", ctx, { bundleId: "onlinepack" }), /already have every theme/);
  });
});
