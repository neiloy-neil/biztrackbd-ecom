import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createBaseClient, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, testUrls } from "@biztrackbd/db/testing";
import { consumeRateLimit, purgeExpiredRateLimits, rateLimitKey, type RateLimitDb } from "../src";

const urls = testUrls();
let owner: PrismaClient;
// Two separate clients stand in for two serverless instances: they share nothing but the database.
let instanceA: PrismaClient;
let instanceB: PrismaClient;
const asDb = (c: PrismaClient) => c as unknown as RateLimitDb;

beforeAll(async () => {
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  instanceA = createBaseClient(urls.app, 2);
  instanceB = createBaseClient(urls.app, 2);
}, 120_000);
afterAll(async () => {
  await Promise.all([owner.$disconnect(), instanceA.$disconnect(), instanceB.$disconnect()]);
});

describe("shared rate limit (Postgres)", () => {
  const T0 = Date.UTC(2026, 10, 4, 12, 0, 0);

  it("holds the limit across separate instances", async () => {
    const opts = { scope: "contact", subject: "203.0.113.7", limit: 5, windowMs: 600_000, now: T0 };
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await consumeRateLimit({ ...opts, db: asDb(i % 2 ? instanceA : instanceB) }));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, true, true, false]);
    expect(results.every((r) => !r.degraded)).toBe(true);
  });

  it("is atomic under concurrent requests", async () => {
    const r = await Promise.all(Array.from({ length: 20 }, (_, i) =>
      consumeRateLimit({ scope: "burst", subject: "198.51.100.1", limit: 5, windowMs: 60_000, now: T0, db: asDb(i % 2 ? instanceA : instanceB) })));
    expect(r.filter((x) => x.allowed)).toHaveLength(5);
    expect(new Set(r.map((x) => x.count)).size).toBe(20);
  });

  it("starts a fresh count in the next window", async () => {
    const base = { scope: "roll", subject: "192.0.2.9", limit: 1, windowMs: 60_000, db: asDb(instanceA) };
    expect((await consumeRateLimit({ ...base, now: T0 })).allowed).toBe(true);
    expect((await consumeRateLimit({ ...base, now: T0 + 1000 })).allowed).toBe(false);
    expect((await consumeRateLimit({ ...base, now: T0 + 60_000 })).allowed).toBe(true);
  });

  it("keeps scopes and subjects apart", async () => {
    const base = { limit: 1, windowMs: 60_000, now: T0, db: asDb(instanceA) };
    expect((await consumeRateLimit({ ...base, scope: "a", subject: "x" })).allowed).toBe(true);
    expect((await consumeRateLimit({ ...base, scope: "b", subject: "x" })).allowed).toBe(true);
    expect((await consumeRateLimit({ ...base, scope: "a", subject: "y" })).allowed).toBe(true);
  });

  it("never stores a raw IP", async () => {
    const rows = await owner.$queryRawUnsafe<{ key: string }[]>(`SELECT "key" FROM "RateLimitBucket"`);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.key).toMatch(/^[0-9a-f]{64}$/);
      expect(r.key).not.toContain("203.0.113");
    }
    expect(rows.map((r) => r.key)).toContain(rateLimitKey("contact", "203.0.113.7"));
    expect(rateLimitKey("contact", "203.0.113.7")).not.toBe(rateLimitKey("contact", "203.0.113.8"));
  });

  it("purges counters whose window ended over an hour ago, and only those", async () => {
    await consumeRateLimit({ scope: "old", subject: "old", limit: 1, windowMs: 60_000, now: T0 - 3 * 3600_000, db: asDb(instanceA) });
    const before = await owner.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::bigint AS n FROM "RateLimitBucket"`);
    const removed = await purgeExpiredRateLimits({ db: asDb(instanceA), now: T0 });
    const after = await owner.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::bigint AS n FROM "RateLimitBucket"`);
    expect(removed).toBe(1);
    expect(Number(before[0]!.n) - Number(after[0]!.n)).toBe(1);
    // The current windows survive.
    expect(Number(after[0]!.n)).toBeGreaterThan(0);
  });

  it("fails open and logs when the database is unreachable", async () => {
    const broken: RateLimitDb = { $queryRaw: () => Promise.reject(new Error("connection refused")), $executeRaw: () => Promise.reject(new Error("connection refused")) };
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await consumeRateLimit({ scope: "down", subject: "203.0.113.50", limit: 5, windowMs: 60_000, now: T0, db: broken });
    expect(r).toMatchObject({ allowed: true, degraded: true });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("failing open"), "connection refused");
    // The log line never contains the address.
    expect(JSON.stringify(log.mock.calls)).not.toContain("203.0.113.50");
    log.mockRestore();
  });
});
