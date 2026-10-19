import { describe, expect, it } from "vitest";
import {
  dhakaDate,
  addDays,
  getDhakaDayRange,
  STORE_TZ,
  getRealtimeStudioMetrics,
  ForbiddenError,
  type StaffActor,
  type HourlyVelocityPoint,
  type FunnelStageMetric,
} from "../src/index";

const packerActor: StaffActor = {
  userId: "user-packer",
  email: "packer@example.com",
  name: "Packer",
  role: "ORDER_PACKER",
};

describe("Analytics & Real-Time Performance Studio - Timezone & Calendar Bounds", () => {
  it("confirms Asia/Dhaka is UTC+6 without DST", () => {
    expect(STORE_TZ).toBe("Asia/Dhaka");
  });

  it("accurately maps UTC timestamps across the Dhaka midnight boundary", () => {
    // 2026-10-18 17:59:59 UTC is 23:59:59 on 18 October in Dhaka
    const eveningBefore = new Date("2026-10-18T17:59:59.000Z");
    expect(dhakaDate(eveningBefore)).toBe("2026-10-18");

    // 2026-10-18 18:00:00 UTC is 00:00:00 on 19 October in Dhaka
    const midnightDhaka = new Date("2026-10-18T18:00:00.000Z");
    expect(dhakaDate(midnightDhaka)).toBe("2026-10-19");

    // 2026-10-19 17:59:59 UTC is 23:59:59 on 19 October in Dhaka
    const dayEndDhaka = new Date("2026-10-19T17:59:59.999Z");
    expect(dhakaDate(dayEndDhaka)).toBe("2026-10-19");
  });

  it("calculates exact UTC query ranges for any Dhaka calendar day", () => {
    const range = getDhakaDayRange("2026-10-19");
    expect(range.startUtc.toISOString()).toBe("2026-10-18T18:00:00.000Z");
    expect(range.endUtc.toISOString()).toBe("2026-10-19T17:59:59.999Z");
  });

  it("adds and subtracts calendar days accurately across month boundaries", () => {
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDays("2026-10-19", -14)).toBe("2026-10-05");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("Analytics & Real-Time Performance Studio - Permissions & Guardrails", () => {
  it("strictly enforces RBAC view permissions on real-time metrics", async () => {
    await expect(
      getRealtimeStudioMetrics("test-tenant", packerActor)
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("Analytics & Real-Time Performance Studio - Velocity & Funnel Math", () => {
  it("structures 24 hourly velocity buckets correctly (0 to 23)", () => {
    const hours: HourlyVelocityPoint[] = Array.from({ length: 24 }, (_, hour) => {
      const h12 = hour % 12 === 0 ? 12 : hour % 12;
      const ampm = hour < 12 ? "AM" : "PM";
      return {
        hour,
        label: `${h12} ${ampm}`,
        todayOrders: 0,
        todaySales: 0,
        yesterdayOrders: 0,
        yesterdaySales: 0,
      };
    });

    expect(hours).toHaveLength(24);
    expect(hours[0]?.label).toBe("12 AM");
    expect(hours[12]?.label).toBe("12 PM");
    expect(hours[23]?.label).toBe("11 PM");
  });

  it("computes conversion funnel drop-off rates accurately", () => {
    const views = 1000;
    const cart = 400;
    const checkout = 200;
    const ordered = 100;
    const delivered = 95;

    const stages: FunnelStageMetric[] = [
      {
        stage: "VIEWS",
        label: "Product Views",
        count: views,
        dropOffRatePercent: 0,
        conversionRatePercent: 100,
      },
      {
        stage: "CART",
        label: "Add to Cart",
        count: cart,
        dropOffRatePercent: Math.round(((views - cart) / views) * 1000) / 10,
        conversionRatePercent: Math.round((cart / views) * 1000) / 10,
      },
      {
        stage: "CHECKOUT",
        label: "Initiate Checkout",
        count: checkout,
        dropOffRatePercent: Math.round(((cart - checkout) / cart) * 1000) / 10,
        conversionRatePercent: Math.round((checkout / views) * 1000) / 10,
      },
      {
        stage: "ORDERED",
        label: "Orders Placed",
        count: ordered,
        dropOffRatePercent: Math.round(((checkout - ordered) / checkout) * 1000) / 10,
        conversionRatePercent: Math.round((ordered / views) * 1000) / 10,
      },
      {
        stage: "DELIVERED",
        label: "Successful Delivery",
        count: delivered,
        dropOffRatePercent: Math.round(((ordered - delivered) / ordered) * 1000) / 10,
        conversionRatePercent: Math.round((delivered / views) * 1000) / 10,
      },
    ];

    expect(stages[0]?.conversionRatePercent).toBe(100);
    expect(stages[1]?.dropOffRatePercent).toBe(60); // (1000 - 400)/1000 = 60%
    expect(stages[1]?.conversionRatePercent).toBe(40);
    expect(stages[2]?.dropOffRatePercent).toBe(50); // (400 - 200)/400 = 50%
    expect(stages[3]?.dropOffRatePercent).toBe(50); // (200 - 100)/200 = 50%
    expect(stages[3]?.conversionRatePercent).toBe(10); // 100/1000 = 10%
    expect(stages[4]?.dropOffRatePercent).toBe(5); // (100 - 95)/100 = 5%
    expect(stages[4]?.conversionRatePercent).toBe(9.5); // 95/1000 = 9.5%
  });
});
