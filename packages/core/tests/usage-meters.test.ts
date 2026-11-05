import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, withTenant, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import { getUsageMeters, meterState, setEventPublisher, signupStore, takeSmsCredit, type StaffActor } from "../src";

describe("meter states (no database)", () => {
  it("warns at 80 percent and stops at the limit", () => {
    expect(meterState(79, 100)).toBe("ok");
    expect(meterState(80, 100)).toBe("warning");
    expect(meterState(100, 100)).toBe("at_limit");
    expect(meterState(5000, null)).toBe("unlimited");
  });
});

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const day = 24 * 60 * 60 * 1000;

async function store(plan: "STARTER" | "PRO" = "STARTER", paying = true) {
  const n = ++seq;
  const s = await signupStore({ ownerName: "Nusrat Jahan", email: `meters${n}@example.test`, phone: `0194${String(2000000 + n).slice(-7)}`, storeName: `Meters ${n}`, subdomain: `meters${n}shop`, plan, category: "FASHION" } as never);
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
const row = (m: Awaited<ReturnType<typeof getUsageMeters>>, key: string) => m.rows.find((r) => r.key === key)!;
const sendSms = (tenantId: string, times: number) => withTenant(tenantId, async (tx) => { for (let i = 0; i < times; i++) await takeSmsCredit(tx, tenantId); });

describe("usage meters", () => {
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

  it("lists every metered item with the plan's limits and nothing to worry about on a new store", async () => {
    const t = await store("STARTER");
    const m = await getUsageMeters(t.tenantId, t.actor);
    expect(m.rows.map((r) => r.key)).toEqual(["products", "orders", "staff", "storage", "sms", "ai"]);
    expect(row(m, "products")).toMatchObject({ limit: 300, state: "ok" });
    expect(row(m, "staff")).toMatchObject({ used: 1, limit: 2 });
    expect(row(m, "storage")).toMatchObject({ used: 0, limit: 5 * 1024, unit: "MB" });
    expect(row(m, "sms")).toMatchObject({ used: 0, limit: 100 });
    expect(row(m, "ai")).toMatchObject({ used: 0, limit: 50 });
    expect(m.attention).toEqual([]);
    expect(m.onTrial).toBe(false);
  });

  it("warns on SMS at 80 and points to buying more, then flags it empty at 100", async () => {
    const t = await store("STARTER");
    await sendSms(t.tenantId, 85);
    let m = await getUsageMeters(t.tenantId, t.actor);
    expect(row(m, "sms")).toMatchObject({ used: 85, state: "warning", action: { label: "Buy SMS", href: "/settings/notifications" } });
    expect(m.attention.map((r) => r.key)).toEqual(["sms"]);
    await sendSms(t.tenantId, 15);
    m = await getUsageMeters(t.tenantId, t.actor);
    expect(row(m, "sms")).toMatchObject({ state: "at_limit" });
    expect(row(m, "sms").note).toMatch(/out of SMS/);
  });

  it("does not call a store out of SMS while it still has bought ones", async () => {
    const t = await store("STARTER");
    await owner.usageCounter.create({ data: { tenantId: t.tenantId, metric: "sms_prepaid", periodStart: new Date("1970-01-01"), value: 200 } });
    await sendSms(t.tenantId, 100);
    const m = await getUsageMeters(t.tenantId, t.actor);
    expect(row(m, "sms").state).toBe("ok");
    expect(row(m, "sms").note).toBeNull();
    expect(m.attention).toEqual([]);
  });

  it("holds a trial store to 10 SMS and 15 AI drafts and sends it to pick a plan", async () => {
    const t = await store("PRO", false);
    await sendSms(t.tenantId, 10);
    const m = await getUsageMeters(t.tenantId, t.actor);
    expect(m.onTrial).toBe(true);
    expect(row(m, "sms")).toMatchObject({ limit: 10, state: "at_limit", action: { label: "Choose a plan", href: "/billing" } });
    expect(row(m, "ai").limit).toBe(15);
  });

  it("warns when photo storage is nearly full and when the staff places are used up", async () => {
    const t = await store("STARTER");
    await owner.tenant.update({ where: { id: t.tenantId }, data: { storageBytesUsed: BigInt(Math.floor(5 * 1024 ** 3 * 0.9)) } });
    await owner.tenantUser.create({ data: { tenantId: t.tenantId, email: `extra${++seq}@example.test`, name: "Second", role: "STORE_MANAGER", passwordHash: "x" } as never });
    const m = await getUsageMeters(t.tenantId, t.actor);
    expect(row(m, "storage")).toMatchObject({ state: "warning", percent: 90 });
    expect(row(m, "staff")).toMatchObject({ used: 2, limit: 2, state: "at_limit" });
    // Worst first.
    expect(m.attention[0]!.key).toBe("staff");
    expect(m.attention.map((r) => r.key)).toEqual(["staff", "storage"]);
  });

  it("is for people who can see billing only", async () => {
    const t = await store("STARTER");
    await expect(getUsageMeters(t.tenantId, { ...t.actor, role: "ORDER_PACKER" } as StaffActor)).rejects.toThrow();
  });
});
