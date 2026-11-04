import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import { getCatalogueRevenue, isRevenueRange, lastMonths, monthKey, rangeStart, setEventPublisher, signupStore, type PlatformActor } from "../src";

const day = 24 * 60 * 60 * 1000;

describe("revenue dates (no database)", () => {
  it("counts a month in Bangladesh time", () => {
    // 20:00 UTC on 30 November is 02:00 on 1 December in Dhaka.
    expect(monthKey(new Date("2026-11-30T20:00:00Z"))).toBe("2026-12");
    expect(monthKey(new Date("2026-11-30T17:59:00Z"))).toBe("2026-11");
  });
  it("lists the last months oldest first and crosses a year", () => {
    expect(lastMonths(3, new Date("2026-01-15T00:00:00Z"))).toEqual(["2025-11", "2025-12", "2026-01"]);
    expect(lastMonths(12, new Date("2026-11-04T00:00:00Z"))).toHaveLength(12);
    expect(lastMonths(12, new Date("2026-11-04T00:00:00Z"))[11]).toBe("2026-11");
  });
  it("knows the ranges", () => {
    const now = new Date("2026-11-04T00:00:00Z");
    expect(rangeStart("30d", now)!.getTime()).toBe(now.getTime() - 30 * day);
    expect(rangeStart("all", now)).toBeNull();
    expect(isRevenueRange("90d")).toBe(true);
    expect(isRevenueRange("week")).toBe(false);
  });
});

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const boss: PlatformActor = { id: "pu-OWNER", email: "owner@biztrackbd.test", role: "OWNER" };
const NOW = new Date("2026-11-04T06:00:00Z");

async function tenant(label: string) {
  const n = ++seq;
  const s = await signupStore({ ownerName: "Nusrat Jahan", email: `revenue${n}@example.test`, phone: `0197${String(5000000 + n).slice(-7)}`, storeName: `Revenue ${label}`, subdomain: `revenue${n}shop`, plan: "STARTER", category: "FASHION" } as never);
  return s.tenantId;
}
const theme = (tenantId: string, themeId: string, amount: number, at: Date, over: Record<string, unknown> = {}) =>
  owner.themePurchase.create({ data: { tenantId, themeId, amount, mfsProvider: "BKASH", senderNumber: "01712345678", trxId: `RT${++seq}X${Math.random().toString(36).slice(2, 8).toUpperCase()}`, status: "APPROVED", approvedAt: at, ...over } as never });
const mod = (tenantId: string, moduleKey: string, amount: number, at: Date, over: Record<string, unknown> = {}) =>
  owner.modulePurchase.create({ data: { tenantId, moduleKey, amount, mfsProvider: "NAGAD", senderNumber: "01712345678", trxId: `RM${++seq}X${Math.random().toString(36).slice(2, 8).toUpperCase()}`, status: "APPROVED", approvedAt: at, ...over } as never });

describe("catalogue revenue in the database", () => {
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

  it("is empty before any sale", async () => {
    const r = await getCatalogueRevenue(boss, "all", owner, NOW);
    expect(r.totals).toEqual({ themes: 0, modules: 0, total: 0, orders: 0 });
    expect(r.byTheme).toEqual([]);
    expect(r.byMonth).toHaveLength(12);
    expect(r.pending).toEqual({ count: 0, amount: 0 });
  });

  it("adds approved sales per theme and module, and leaves out waiting and rejected ones", async () => {
    const a = await tenant("A");
    const b = await tenant("B");
    await theme(a, "maison", 49, new Date(NOW.getTime() - 2 * day));
    await theme(b, "maison", 49, new Date(NOW.getTime() - 3 * day));
    await theme(a, "voltedge", 120, new Date(NOW.getTime() - 10 * day));
    await theme(a, "lumiere", 49, new Date(NOW.getTime() - 1 * day), { status: "PENDING", approvedAt: null });
    await theme(b, "harvest", 49, new Date(NOW.getTime() - 1 * day), { status: "REJECTED" });
    await mod(a, "wholesale_b2b", 199, new Date(NOW.getTime() - 5 * day), { expiresAt: new Date(NOW.getTime() + 20 * day) });
    await mod(b, "loyalty", 499, new Date(NOW.getTime() - 40 * day));
    await mod(b, "ai_suite", 99, new Date(NOW.getTime() - 1 * day), { status: "PENDING", approvedAt: null });

    const all = await getCatalogueRevenue(boss, "all", owner, NOW);
    expect(all.totals).toEqual({ themes: 218, modules: 698, total: 916, orders: 5 });
    expect(all.pending).toEqual({ count: 2, amount: 148 });
    expect(all.byTheme.map((t) => [t.id, t.revenue, t.orders, t.stores])).toEqual([["voltedge", 120, 1, 1], ["maison", 98, 2, 2]]);
    expect(all.byTheme[0]!.name).toBe("Voltedge");
    expect(all.byModule.map((m) => [m.id, m.revenue])).toEqual([["loyalty", 499], ["wholesale_b2b", 199]]);

    // A shorter range drops the older sales.
    const month = await getCatalogueRevenue(boss, "30d", owner, NOW);
    expect(month.totals).toEqual({ themes: 218, modules: 199, total: 417, orders: 4 });
    expect(month.byModule.map((m) => m.id)).toEqual(["wholesale_b2b"]);
    expect(month.recent[0]!.at.getTime()).toBeGreaterThan(month.recent[3]!.at.getTime());
    expect(month.recent).toHaveLength(4);
  });

  it("buckets sales by Bangladesh month for the chart, whatever the range", async () => {
    const c = await tenant("C");
    // 20:00 UTC on 31 October is already 1 November in Dhaka.
    await theme(c, "bazaar", 60, new Date("2026-10-31T20:00:00Z"));
    const r = await getCatalogueRevenue(boss, "30d", owner, NOW);
    const at = (m: string) => r.byMonth.find((x) => x.month === m)!;
    expect(at("2026-11")).toMatchObject({ themes: 158, modules: 0, total: 158 });
    expect(at("2026-10")).toMatchObject({ themes: 120, modules: 199, total: 319 });
    expect(at("2026-09")).toMatchObject({ themes: 0, modules: 499, total: 499 });
    expect(r.byMonth[11]!.month).toBe("2026-11");
    // The same 60 taka is counted once.
    const sum = r.byMonth.reduce((n, m) => n + m.total, 0);
    const all = await getCatalogueRevenue(boss, "all", owner, NOW);
    expect(sum).toBe(all.totals.total);
  });

  it("counts monthly items that are paid up right now", async () => {
    const d = await tenant("D");
    await theme(d, "nakshi", 30, new Date(NOW.getTime() - day), { expiresAt: new Date(NOW.getTime() + 10 * day) });
    await theme(d, "bindu", 30, new Date(NOW.getTime() - 40 * day), { expiresAt: new Date(NOW.getTime() - 10 * day) });
    await owner.tenantModule.create({ data: { tenantId: d, moduleKey: "ai_suite", isEnabled: true, source: "PURCHASE", expiresAt: new Date(NOW.getTime() + 5 * day) } });
    await owner.tenantModule.create({ data: { tenantId: d, moduleKey: "pos_barcode", isEnabled: true, source: "PURCHASE", expiresAt: new Date(NOW.getTime() - day) } });
    const r = await getCatalogueRevenue(boss, "all", owner, NOW);
    expect(r.active.monthlyThemes).toBeGreaterThanOrEqual(1);
    expect(r.active.monthlyModules).toBeGreaterThanOrEqual(1);
    const noExpired = await owner.tenantModule.count({ where: { source: "PURCHASE", expiresAt: { gt: NOW } } });
    expect(r.active.monthlyModules).toBe(noExpired);
  });

  it("is for people who can see payments only", async () => {
    await expect(getCatalogueRevenue({ ...boss, role: "SUPPORT" }, "30d", owner, NOW)).rejects.toThrow();
    await expect(getCatalogueRevenue({ ...boss, role: "FINANCE" }, "30d", owner, NOW)).resolves.toBeTruthy();
  });
});
