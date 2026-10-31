import { describe, expect, it } from "vitest";
import { accessState, statusFor, addPeriod } from "../src/platform/lifecycle";

describe("accessState and lifecycle logic", () => {
  const DAY = 86_400_000;
  const end = new Date("2026-11-01T00:00:00Z");
  const t = (sub: { amount: number }, extra: object = {}) => ({
    status: "ACTIVE" as const,
    trialEndsAt: end,
    subscription: { ...sub, currentPeriodEnd: end },
    ...extra,
  });
  const at = (days: number) => new Date(end.getTime() + days * DAY);

  it("normal trial runs, then grace for 3 days, read-only to day 14, then locked", () => {
    expect(accessState(t({ amount: 0 }), at(-5))).toMatchObject({ state: "TRIAL", daysLeft: 5 });
    expect(accessState(t({ amount: 0 }), at(-0.5))).toMatchObject({ state: "TRIAL", daysLeft: 1 });
    expect(accessState(t({ amount: 0 }), at(0.001))).toMatchObject({ state: "GRACE", overdueDays: 1 });
    expect(accessState(t({ amount: 0 }), at(3))).toMatchObject({ state: "GRACE", overdueDays: 3 });
    expect(accessState(t({ amount: 0 }), at(3.5))).toMatchObject({ state: "READ_ONLY", overdueDays: 4 });
    expect(accessState(t({ amount: 0 }), at(14))).toMatchObject({ state: "READ_ONLY", overdueDays: 14 });
    expect(accessState(t({ amount: 0 }), at(14.1))).toMatchObject({ state: "LOCKED", overdueDays: 15 });
  });

  it("demo stores and far-future stores have unlimited days active access", () => {
    // 1. isDemo: true returns state: "ACTIVE" and daysLeft: null
    expect(accessState({ status: "ACTIVE", trialEndsAt: end, isDemo: true })).toMatchObject({
      state: "ACTIVE",
      daysLeft: null,
      nextStageAt: null,
    });

    // 2. trialEndsAt in year 2100 (far-future) returns state: "ACTIVE" and daysLeft: null
    expect(accessState({ status: "ACTIVE", trialEndsAt: new Date("2100-01-01T00:00:00Z") })).toMatchObject({
      state: "ACTIVE",
      daysLeft: null,
      nextStageAt: null,
    });

    // 3. Even with trial status in database, demo stores have unlimited active access
    expect(accessState({ status: "TRIAL", trialEndsAt: new Date("2100-01-01T00:00:00Z"), isDemo: true })).toMatchObject({
      state: "ACTIVE",
      daysLeft: null,
      nextStageAt: null,
    });
  });

  it("paid plans are active until their period ends", () => {
    expect(accessState(t({ amount: 1499 }), at(-10))).toMatchObject({ state: "ACTIVE", daysLeft: 10 });
    expect(accessState(t({ amount: 1499 }), at(2))).toMatchObject({ state: "GRACE" });
    expect(accessState(t({ amount: 1499 }), at(10))).toMatchObject({ state: "READ_ONLY" });
  });

  it("platform suspension or cancelled store is locked at once", () => {
    expect(accessState(t({ amount: 1499 }, { suspendedReason: "fraud" }), at(-10))).toMatchObject({ state: "LOCKED", suspendedByPlatform: true });
    expect(accessState(t({ amount: 1499 }, { status: "CANCELLED" }), at(-10))).toMatchObject({ state: "LOCKED" });
  });

  it("maps to the status the storefront router reads", () => {
    expect(statusFor("TRIAL", "TRIAL")).toBe("TRIAL");
    expect(statusFor("GRACE", "ACTIVE")).toBe("PAST_DUE");
    expect(statusFor("READ_ONLY", "PAST_DUE")).toBe("SUSPENDED");
    expect(statusFor("LOCKED", "ACTIVE")).toBe("SUSPENDED");
    expect(statusFor("ACTIVE", "SUSPENDED")).toBe("ACTIVE");
    expect(statusFor("ACTIVE", "CANCELLED")).toBe("CANCELLED");
  });

  it("adds months and years correctly", () => {
    const jan31 = new Date("2026-01-31T00:00:00Z");
    const feb = addPeriod(jan31, "MONTHLY");
    expect(feb.getUTCMonth()).toBe(1); // Feb
    expect(feb.getUTCDate()).toBe(28); // 2026 is not a leap year
  });
});
