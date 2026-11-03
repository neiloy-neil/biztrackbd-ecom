import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRIAL_CAPS, isOnTrial, withTrialCap } from "../src/platform/trial";
import { lookupTrustForPlan } from "../src/fraud/trust";

const DAY = 86_400_000;
const state = {
  tenant: { id: "t1", status: "TRIAL", trialEndsAt: new Date(Date.now() + 5 * DAY), suspendedReason: null as string | null, isDemo: false, planTier: "PRO", siteMode: "ECOMMERCE", timezone: "Asia/Dhaka" },
  sub: null as null | { amount: number; currentPeriodEnd: Date },
  features: {} as Record<string, unknown>,
  lookups: 0,
  networkCalls: 0,
};

const tx = {
  tenant: { findFirstOrThrow: vi.fn(async () => state.tenant) },
  subscription: { findFirst: vi.fn(async () => state.sub) },
  plan: { findUnique: vi.fn(async () => ({ tier: "PRO", name: "Pro", priceMonthlyBdt: 1, priceYearlyBdt: 1, trialDays: 14, isPublic: true, limits: {}, features: state.features })) },
  sitePlan: { findUnique: vi.fn(async () => null) },
  // The trial counter and the cross-store lookup are the only raw queries.
  $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
    const sql = strings.join("?");
    if (sql.includes("fraud_lookups")) return state.lookups >= TRIAL_CAPS.fraudLookups ? [] : [{ v: ++state.lookups }];
    state.networkCalls++;
    return [{ delivered30: 8, delivered90: 0, deliveredOld: 0, failed30: 0, failed90: 0, failedOld: 0, refused60: 0, stores: 3 }];
  }),
};

beforeEach(() => {
  state.tenant = { id: "t1", status: "TRIAL", trialEndsAt: new Date(Date.now() + 5 * DAY), suspendedReason: null, isDemo: false, planTier: "PRO", siteMode: "ECOMMERCE", timezone: "Asia/Dhaka" };
  state.sub = null;
  state.features = {};
  state.lookups = 0;
  state.networkCalls = 0;
});

describe("trial", () => {
  it("a store that has not paid, inside its trial dates, is on trial", async () => {
    expect(await isOnTrial(tx as never)).toBe(true);
  });

  it("a paying store, a lapsed trial and a demo store are not", async () => {
    state.sub = { amount: 1499, currentPeriodEnd: new Date(Date.now() + 20 * DAY) };
    expect(await isOnTrial(tx as never)).toBe(false);
    state.sub = null;
    state.tenant.trialEndsAt = new Date(Date.now() - 2 * DAY);
    expect(await isOnTrial(tx as never)).toBe(false);
    state.tenant.trialEndsAt = new Date(Date.now() + 5 * DAY);
    state.tenant.isDemo = true;
    expect(await isOnTrial(tx as never)).toBe(false);
  });

  it("the trial cap only ever lowers a plan's allowance", () => {
    expect(withTrialCap(1000, true, 20)).toBe(20);
    expect(withTrialCap(null, true, 20)).toBe(20);
    expect(withTrialCap(5, true, 20)).toBe(5);
    expect(withTrialCap(1000, false, 20)).toBe(1000);
    expect(withTrialCap(null, false, 20)).toBeNull();
  });
});

describe("fraud check level", () => {
  it("Starter's basic check never looks at other stores", async () => {
    state.features = { fraud: "basic" };
    state.sub = { amount: 699, currentPeriodEnd: new Date(Date.now() + 20 * DAY) };
    const t = await lookupTrustForPlan(tx as never, "01711111111", true);
    expect(t).toMatchObject({ level: "NEW", delivered: 0 });
    expect(state.networkCalls).toBe(0);
  });

  it("the full check looks across stores for a paying store", async () => {
    state.features = { fraud: "full" };
    state.sub = { amount: 1499, currentPeriodEnd: new Date(Date.now() + 20 * DAY) };
    expect((await lookupTrustForPlan(tx as never, "01711111111", true)).delivered).toBe(8);
  });

  it("a trial gets a few cross-store lookups a month, then falls back to the store's own checks", async () => {
    state.features = { fraud: "full" };
    for (let i = 0; i < TRIAL_CAPS.fraudLookups; i++) expect((await lookupTrustForPlan(tx as never, "01711111111", true)).delivered).toBe(8);
    expect((await lookupTrustForPlan(tx as never, "01711111111", true)).delivered).toBe(0);
    // Looking at an existing flagged order is not a new lookup, so it is not counted against the trial.
    expect((await lookupTrustForPlan(tx as never, "01711111111")).delivered).toBe(8);
  });
});
