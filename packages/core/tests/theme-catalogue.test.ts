import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  DomainError, activateTheme, approveThemePurchase, listPendingThemePurchases, listThemeCatalogue, listThemeStore, mergeCatalogue, purchaseExpiry, setEventPublisher,
  signupStore, submitThemePurchase, syncBuiltinThemes, themeAccessFor, updateThemePricing, MONTHLY_THEME_DAYS, type CatalogTheme, type PlatformActor, type StaffActor,
} from "../src";

const day = 24 * 60 * 60 * 1000;
const theme = (over: Partial<CatalogTheme> = {}): CatalogTheme => ({ id: "x", name: "X", blurb: "", audience: "", source: "BUILTIN", status: "PUBLISHED", priceModel: "ONE_TIME", price: 49, includedPlans: [], premium: true, accent: null, background: null, ...over });

describe("theme access rule (no database)", () => {
  const now = new Date("2026-11-04T00:00:00Z");
  it("a free theme is always usable", () => {
    expect(themeAccessFor(theme({ premium: false, priceModel: "FREE", price: 0 }), null, [], now).state).toBe("FREE");
  });
  it("a plan that includes the theme unlocks it without a purchase", () => {
    const t = theme({ includedPlans: ["PRO", "BUSINESS"] });
    expect(themeAccessFor(t, "PRO", [], now).state).toBe("INCLUDED");
    expect(themeAccessFor(t, "STARTER", [], now).state).toBe("LOCKED");
    expect(themeAccessFor(t, null, [], now).state).toBe("LOCKED");
  });
  it("an approved lifetime purchase is owned for good", () => {
    expect(themeAccessFor(theme(), "STARTER", [{ status: "APPROVED", expiresAt: null }], now)).toMatchObject({ state: "OWNED", expiresAt: null });
  });
  it("a monthly purchase is owned until it runs out, then locked and marked expired", () => {
    const t = theme({ priceModel: "MONTHLY" });
    const end = new Date(now.getTime() + 5 * day);
    expect(themeAccessFor(t, "STARTER", [{ status: "APPROVED", expiresAt: end }], now)).toMatchObject({ state: "OWNED", expiresAt: end });
    expect(themeAccessFor(t, "STARTER", [{ status: "APPROVED", expiresAt: new Date(now.getTime() - day) }], now)).toMatchObject({ state: "LOCKED", expired: true });
  });
  it("a waiting payment is pending, a rejected one grants nothing", () => {
    expect(themeAccessFor(theme(), "STARTER", [{ status: "PENDING", expiresAt: null }], now).state).toBe("PENDING");
    expect(themeAccessFor(theme(), "STARTER", [{ status: "REJECTED", expiresAt: null }], now)).toMatchObject({ state: "LOCKED", expired: false });
  });
  it("a renewal made early extends from the current end", () => {
    const from = new Date("2026-11-04T00:00:00Z");
    const end = new Date(from.getTime() + 10 * day);
    expect(purchaseExpiry("MONTHLY", from)!.getTime()).toBe(from.getTime() + MONTHLY_THEME_DAYS * day);
    expect(purchaseExpiry("MONTHLY", from, end)!.getTime()).toBe(end.getTime() + MONTHLY_THEME_DAYS * day);
    expect(purchaseExpiry("ONE_TIME", from)).toBeNull();
  });
  it("falls back to the code's definition and hides archived themes", () => {
    const base = mergeCatalogue([]);
    expect(base.find((t) => t.id === "kapor")).toMatchObject({ premium: false, price: 0 });
    expect(base.find((t) => t.id === "maison")).toMatchObject({ premium: true, price: 49, priceModel: "ONE_TIME" });
    const row = (id: string, over: Record<string, unknown>) => ({ id, name: id, blurb: "", audience: "", source: "BUILTIN", status: "PUBLISHED", priceModel: "FREE", priceBdt: 0, includedPlans: [] as string[], ...over });
    const merged = mergeCatalogue([row("maison", { priceModel: "MONTHLY", priceBdt: 99, includedPlans: ["PRO"] }), row("bindu", { status: "ARCHIVED" })]);
    expect(merged.find((t) => t.id === "maison")).toMatchObject({ priceModel: "MONTHLY", price: 99, includedPlans: ["PRO"], premium: true });
    expect(merged.find((t) => t.id === "bindu")).toBeUndefined();
  });
});

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const boss: PlatformActor = { id: "pu-OWNER", email: "owner@biztrackbd.test", role: "OWNER" };
const trx = () => `TC${Date.now().toString(36).toUpperCase()}${++seq}`.slice(0, 11).padEnd(9, "Z");
async function store(plan: "STARTER" | "PRO" = "STARTER") {
  const n = ++seq;
  const s = await signupStore({ ownerName: "Nusrat Jahan", email: `catalogue${n}@example.test`, phone: `0194${String(2000000 + n).slice(-7)}`, storeName: `Catalogue ${n}`, subdomain: `catalogue${n}shop`, plan, category: "FASHION" } as never);
  const row = await owner.tenantUser.findFirstOrThrow({ where: { tenantId: s.tenantId } });
  return { tenantId: s.tenantId, actor: { userId: row.id, email: row.email, name: row.name, role: "STORE_OWNER" } as StaffActor };
}
const pay = (themeId = "maison") => ({ themeId, provider: "BKASH", senderNumber: "01712345678", trxId: trx() });
const failure = (p: Promise<unknown>) => p.then(() => null, (x) => x as Error);

describe("theme catalogue in the database", () => {
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

  it("writes a row for every built-in theme once and never overwrites an edit", async () => {
    expect(await syncBuiltinThemes(owner)).toBeGreaterThanOrEqual(13);
    expect(await syncBuiltinThemes(owner)).toBe(0);
    await updateThemePricing(boss, "maison", { status: "PUBLISHED", priceModel: "ONE_TIME", priceBdt: 79, includedPlans: [] }, owner);
    expect(await syncBuiltinThemes(owner)).toBe(0);
    expect(Number((await owner.theme.findUniqueOrThrow({ where: { id: "maison" } })).priceBdt)).toBe(79);
  });

  it("charges the price the admin set, not a fixed 49", async () => {
    await updateThemePricing(boss, "maison", { status: "PUBLISHED", priceModel: "ONE_TIME", priceBdt: 120, includedPlans: [] }, owner);
    const s = await store();
    expect((await listThemeStore(s.tenantId, s.actor)).themes.find((t) => t.id === "maison")).toMatchObject({ price: 120, priceModel: "ONE_TIME", state: "LOCKED" });
    await submitThemePurchase(s.tenantId, s.actor, pay());
    expect(Number((await owner.themePurchase.findFirstOrThrow({ where: { tenantId: s.tenantId } })).amount)).toBe(120);
  });

  it("includes a theme free for the chosen plans only", async () => {
    await updateThemePricing(boss, "voltedge", { status: "PUBLISHED", priceModel: "ONE_TIME", priceBdt: 49, includedPlans: ["PRO"] }, owner);
    const starter = await store("STARTER");
    const pro = await store("PRO");
    expect((await listThemeStore(starter.tenantId, starter.actor)).themes.find((t) => t.id === "voltedge")!.state).toBe("LOCKED");
    expect((await listThemeStore(pro.tenantId, pro.actor)).themes.find((t) => t.id === "voltedge")!.state).toBe("INCLUDED");
    await activateTheme(pro.tenantId, pro.actor, "voltedge");
    expect(await owner.tenant.findUniqueOrThrow({ where: { id: pro.tenantId } })).toMatchObject({ themeId: "voltedge" });
    const e = await failure(submitThemePurchase(pro.tenantId, pro.actor, pay("voltedge")));
    expect(e).toBeInstanceOf(DomainError);
    expect(e!.message).toMatch(/plan already includes/);
  });

  it("a monthly theme expires, then must be renewed", async () => {
    await updateThemePricing(boss, "lumiere", { status: "PUBLISHED", priceModel: "MONTHLY", priceBdt: 30, includedPlans: [] }, owner);
    const s = await store();
    await submitThemePurchase(s.tenantId, s.actor, pay("lumiere"));
    const first = (await listPendingThemePurchases(boss, owner)).find((p) => p.tenantId === s.tenantId)!;
    await approveThemePurchase(boss, first.id, owner);
    const row = await owner.themePurchase.findUniqueOrThrow({ where: { id: first.id } });
    expect(row.expiresAt).not.toBeNull();
    expect(row.expiresAt!.getTime() - Date.now()).toBeGreaterThan(29 * day);
    expect((await listThemeStore(s.tenantId, s.actor)).themes.find((t) => t.id === "lumiere")).toMatchObject({ state: "OWNED", priceModel: "MONTHLY" });
    await owner.themePurchase.update({ where: { id: first.id }, data: { expiresAt: new Date(Date.now() - day) } });
    expect((await listThemeStore(s.tenantId, s.actor)).themes.find((t) => t.id === "lumiere")).toMatchObject({ state: "LOCKED", expired: true });
    expect((await failure(activateTheme(s.tenantId, s.actor, "lumiere")))!.message).toMatch(/Renew/);
    await submitThemePurchase(s.tenantId, s.actor, pay("lumiere"));
    const again = (await listPendingThemePurchases(boss, owner)).find((p) => p.tenantId === s.tenantId)!;
    await approveThemePurchase(boss, again.id, owner);
    await activateTheme(s.tenantId, s.actor, "lumiere");
  });

  it("hides an archived theme from stores and lists everything to the platform admin", async () => {
    await updateThemePricing(boss, "nakshi", { status: "ARCHIVED", priceModel: "FREE", priceBdt: 0, includedPlans: [] }, owner);
    const s = await store();
    expect((await listThemeStore(s.tenantId, s.actor)).themes.some((t) => t.id === "nakshi")).toBe(false);
    expect((await listThemeCatalogue(boss, owner)).find((t) => t.id === "nakshi")).toMatchObject({ status: "ARCHIVED", saved: true });
  });

  it("rejects bad pricing, unknown themes and staff without the right", async () => {
    expect((await failure(updateThemePricing(boss, "maison", { status: "PUBLISHED", priceModel: "ONE_TIME", priceBdt: 0, includedPlans: [] }, owner)))!.message).toMatch(/at least 1 taka/);
    expect((await failure(updateThemePricing(boss, "nope", { status: "PUBLISHED", priceModel: "FREE", priceBdt: 0, includedPlans: [] }, owner)))!.message).toMatch(/not found/i);
    expect(await failure(updateThemePricing({ ...boss, role: "SUPPORT" } as PlatformActor, "maison", { status: "PUBLISHED", priceModel: "FREE", priceBdt: 0, includedPlans: [] }, owner))).toBeTruthy();
  });
});
