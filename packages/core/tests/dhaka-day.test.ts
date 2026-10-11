import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import { createOrder, getDashboard, getSalesReport, setEventPublisher, type StaffActor } from "../src";

/**
 * Bangladesh is UTC+6, so the first six hours of a Dhaka day (00:00 to 06:00) are the last six hours of the previous UTC day.
 * Found in Phase 8: the dashboard and reports converted the stored UTC time in the wrong direction, so an order placed at 02:00
 * in Dhaka was counted on the day before. These tests pin the hours around both midnights, whatever the clock or the database's
 * own time zone setting is.
 */
let owner: PrismaClient, app: PrismaClient;
let n = 0;
const actor = (): StaffActor => ({ userId: "u1", email: "o@example.test", name: "Owner", role: "STORE_OWNER" });

beforeAll(async () => {
  setEventPublisher(async () => {});
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 5);
  setBasePrisma(app);
  await seedPlans(owner);
});
afterAll(async () => {
  await app.$disconnect();
  await owner.$disconnect();
});

async function orderAt(tenantId: string, variantId: string, utc: string) {
  const o = await createOrder(tenantId, {
    idempotencyKey: `dhaka-${Date.now()}-${++n}`, customer: { name: "Tania Akter", phone: `0131${String(2000000 + n).slice(-7)}` },
    shipping: { address: "House 1, Road 1, Dhanmondi", city: "Dhanmondi", district: "Dhaka", division: "Dhaka" }, items: [{ variantId, quantity: 1 }], paymentMethod: "COD",
  });
  await owner.order.update({ where: { id: o.orderId }, data: { createdAt: new Date(utc) } });
  return o;
}

describe("a Dhaka day starts at 18:00 UTC", () => {
  it("counts an order at 02:00 Dhaka (20:00 UTC the evening before) on its own day, in the dashboard and the sales report", async () => {
    const f = await createTenantFixture(owner, { name: "Dhaka Day", subdomain: "dhaka-day", stock: 50 });
    const v = f.products[0]!.variants[0]!.id;
    const early = await orderAt(f.tenantId, v, "2026-10-10T20:00:00Z"); // 2026-10-11 02:00 in Dhaka
    const lateYesterday = await orderAt(f.tenantId, v, "2026-10-10T17:59:00Z"); // 2026-10-10 23:59 in Dhaka
    const evening = await orderAt(f.tenantId, v, "2026-10-11T17:59:00Z"); // 2026-10-11 23:59 in Dhaka
    const nextDay = await orderAt(f.tenantId, v, "2026-10-11T18:00:00Z"); // 2026-10-12 00:00 in Dhaka

    // "now" is 08:00 in Dhaka on 11 October.
    const d = await getDashboard(f.tenantId, actor(), new Date("2026-10-11T02:00:00Z"));
    expect(d.today).toEqual({ orders: 2, sales: early.totalAmount + evening.totalAmount });
    expect(d.yesterday).toEqual({ orders: 1, sales: lateYesterday.totalAmount });
    expect(d.week.days.at(-1)).toMatchObject({ date: "2026-10-11", orders: 2 });

    const r = await getSalesReport(f.tenantId, actor(), { from: "2026-10-11", to: "2026-10-11" });
    expect(r.current.orders).toBe(2);
    expect(r.current.sales).toBe(early.totalAmount + evening.totalAmount);
    const next = await getSalesReport(f.tenantId, actor(), { from: "2026-10-12", to: "2026-10-12" });
    expect(next.current).toMatchObject({ orders: 1, sales: nextDay.totalAmount });
  });

  it("gives the same answer whatever time zone the database session uses", async () => {
    const f = await createTenantFixture(owner, { name: "Dhaka Day 2", subdomain: "dhaka-day-2", stock: 50 });
    const v = f.products[0]!.variants[0]!.id;
    await orderAt(f.tenantId, v, "2026-10-10T20:00:00Z");
    for (const tz of ["UTC", "Asia/Dhaka", "America/Los_Angeles", "Pacific/Kiritimati"]) {
      await owner.$executeRawUnsafe(`ALTER ROLE biztrack_app SET timezone = '${tz}'`);
      // New connections pick the role setting up; use a fresh client.
      const fresh = createBaseClient(testUrls().app, 2);
      setBasePrisma(fresh);
      const r = await getSalesReport(f.tenantId, actor(), { from: "2026-10-11", to: "2026-10-11" });
      expect(r.current.orders, `session time zone ${tz}`).toBe(1);
      await fresh.$disconnect();
    }
    await owner.$executeRawUnsafe(`ALTER ROLE biztrack_app RESET timezone`);
    setBasePrisma(app);
  });
});
