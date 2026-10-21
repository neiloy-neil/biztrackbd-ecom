import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, testUrls } from "@biztrackbd/db/testing";
import {
  DEFAULT_FRAUD_CHECKER_ENDPOINT, DomainError, clearFraudCheckerCache, fetchUnifiedCourierFraud, getFraudCheckerConfig, getPlatformFraudConfig, savePlatformFraudConfig,
  testPlatformFraudChecker,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;

const admin = { id: "pa-1", email: "root@biztrack.test", role: "OWNER" as const };
const viewer = { id: "pa-2", email: "viewer@biztrack.test", role: "SUPPORT_AGENT" as never };
const reply = { phone: "01712345678", score: 90, status: "Safe", source: "x", total_parcel: 5, success_parcel: 5, cancel_parcel: 0, unresolved_reports: 0, community_reports: [], response: {} };
const fakeFetch = (calls: { url: string; key: string | null }[]) =>
  (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), key: new Headers(init?.headers).get("X-API-KEY") });
    return new Response(JSON.stringify(reply), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;

beforeAll(async () => {
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
});
beforeEach(async () => {
  delete process.env.FRAUD_CHECKER_API_KEY;
  delete process.env.FRAUD_CHECKER_API_URL;
  await owner.platformConfig.deleteMany({});
  clearFraudCheckerCache();
});
afterAll(async () => {
  await owner?.$disconnect();
  await app?.$disconnect();
});

describe("the fraud checker key lives in platform settings", () => {
  it("has no key in the code: with nothing set it does not call out and answers no data", async () => {
    const calls: { url: string; key: string | null }[] = [];
    expect((await getFraudCheckerConfig()).source).toBe("NONE");
    expect(await fetchUnifiedCourierFraud("01712345678", { fetchImpl: fakeFetch(calls) })).toBeNull();
    expect(calls).toEqual([]);
  });

  it("uses the environment variable when the admin has not set one", async () => {
    process.env.FRAUD_CHECKER_API_KEY = "env-key-0123456789";
    const calls: { url: string; key: string | null }[] = [];
    await fetchUnifiedCourierFraud("01712345678", { fetchImpl: fakeFetch(calls) });
    expect(calls[0]!.key).toBe("env-key-0123456789");
    expect(calls[0]!.url).toBe(DEFAULT_FRAUD_CHECKER_ENDPOINT);
    expect((await getFraudCheckerConfig()).source).toBe("ENV");
  });

  it("the platform admin saves a key and an address; a store connection reads them, and they win over the environment", async () => {
    process.env.FRAUD_CHECKER_API_KEY = "env-key-0123456789";
    await savePlatformFraudConfig(admin, { apiKey: "  saved-key-abcdef0123  ", endpoint: "https://checker.example.com/api/v1/fraud-check" }, { db: owner });
    const cfg = await getFraudCheckerConfig();
    expect(cfg).toMatchObject({ apiKey: "saved-key-abcdef0123", endpoint: "https://checker.example.com/api/v1/fraud-check", source: "DATABASE" });
    const calls: { url: string; key: string | null }[] = [];
    await fetchUnifiedCourierFraud("01712345678", { fetchImpl: fakeFetch(calls), bypassCache: true });
    expect(calls[0]).toEqual({ url: "https://checker.example.com/api/v1/fraud-check", key: "saved-key-abcdef0123" });
    const view = await getPlatformFraudConfig({ db: owner });
    expect(view).toMatchObject({ hasKey: true, source: "DATABASE", updatedBy: "root@biztrack.test" });
    expect(view.maskedKey).toBe("save••••••••0123");
    expect(JSON.stringify(view)).not.toContain("saved-key-abcdef0123");
  });

  it("removing the key falls back to the environment, and the change is on the audit log without the key", async () => {
    process.env.FRAUD_CHECKER_API_KEY = "env-key-0123456789";
    await savePlatformFraudConfig(admin, { apiKey: "saved-key-abcdef0123" }, { db: owner });
    await savePlatformFraudConfig(admin, { apiKey: "" }, { db: owner });
    expect((await getFraudCheckerConfig()).source).toBe("ENV");
    const log = await owner.platformAuditLog.findMany({ where: { action: "PLATFORM_FRAUD_CHECKER_CONFIG_UPDATED" } });
    expect(log.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(log)).not.toContain("saved-key");
  });

  it("refuses an address that is not https, a key that is too short or has spaces, and anyone who is not a platform admin", async () => {
    const fails = async (p: Promise<unknown>) => { const e = await p.then(() => null, (x) => x); expect(e).toBeInstanceOf(DomainError); };
    await fails(savePlatformFraudConfig(admin, { endpoint: "http://checker.example.com/x" }, { db: owner }));
    await fails(savePlatformFraudConfig(admin, { endpoint: "not a url" }, { db: owner }));
    await fails(savePlatformFraudConfig(admin, { apiKey: "short" }, { db: owner }));
    await fails(savePlatformFraudConfig(admin, { apiKey: "has some spaces inside" }, { db: owner }));
    await fails(savePlatformFraudConfig(viewer, { apiKey: "saved-key-abcdef0123" }, { db: owner }));
    expect(await owner.platformConfig.count()).toBe(0);
  });

  it("a store connection can read only the fraud checker settings, nothing else in platform config", async () => {
    await owner.platformConfig.createMany({
      data: [
        { key: "gemini_api_key", value: "secret-gemini", description: "x" }, { key: "sms_api_key", value: "secret-sms", description: "x" },
        { key: "fraud_checker_api_key", value: "fraud-key-0123456789", description: "x" },
      ],
    });
    // a store connection may read only the public rows (contact, SEO; migration 060): none of the secret rows above show up
    expect(await app.platformConfig.findMany()).toEqual([]);
    const read = async (k: string) => (await app.$queryRaw<{ v: string | null }[]>`SELECT platform_config_value(${k}) AS v`)[0]!.v;
    expect(await read("fraud_checker_api_key")).toBe("fraud-key-0123456789");
    expect(await read("gemini_api_key")).toBe("secret-gemini"); // the platform AI key is the other value a store needs
    expect(await read("sms_api_key")).toBeNull();
    expect(await read("uddoktapay_api_key")).toBeNull();
    await expect(app.platformConfig.create({ data: { key: "fraud_checker_api_key", value: "x", description: "x" } })).rejects.toBeTruthy();
  });

  it("the test button reports a working key, a refused key and no key", async () => {
    expect((await testPlatformFraudChecker(undefined, { db: owner })).message).toMatch(/No key/);
    const real = globalThis.fetch;
    try {
      globalThis.fetch = (async () => new Response("{}", { status: 200 })) as typeof fetch;
      expect(await testPlatformFraudChecker("typed-key-0123456789", { db: owner })).toMatchObject({ ok: true });
      globalThis.fetch = (async () => new Response("no", { status: 401 })) as typeof fetch;
      expect(await testPlatformFraudChecker("typed-key-0123456789", { db: owner })).toMatchObject({ ok: false, message: "The service refused this key." });
      globalThis.fetch = (async () => { throw new Error("down"); }) as typeof fetch;
      expect(await testPlatformFraudChecker("typed-key-0123456789", { db: owner })).toMatchObject({ ok: false, message: "Could not reach the service." });
    } finally {
      globalThis.fetch = real;
    }
  });
});
