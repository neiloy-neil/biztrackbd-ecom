import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, resolveHostEntry, resolveTenantByHost, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  DomainError, addDomain, buildTenantRoutes, confirmDomainVerified, dbDirectory, listDomains, removeDomain, setEventPublisher,
  setPrimaryDomain, setRoutingSync, syncTenantRouting, type StaffActor,
} from "../src";

const ROOT = "biztrackbd.test";
let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
let synced: { tenantId: string; removed: string[] }[] = [];
let events: string[] = [];

async function store(name: string, plan: "STARTER" | "PRO" = "PRO") {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}` });
  await owner.tenant.update({ where: { id: f.tenantId }, data: { planTier: plan } });
  const u = await owner.tenantUser.create({ data: { tenantId: f.tenantId, email: `o${seq}@example.test`, name: "O", role: "STORE_OWNER", passwordHash: "x" } });
  const m = await owner.tenantUser.create({ data: { tenantId: f.tenantId, email: `m${seq}@example.test`, name: "M", role: "STORE_MANAGER", passwordHash: "x" } });
  const actor: StaffActor = { userId: u.id, email: u.email, role: "STORE_OWNER" };
  const manager: StaffActor = { userId: m.id, email: m.email, role: "STORE_MANAGER" };
  return { f, actor, manager };
}

const fails = async (p: Promise<unknown>, code: string) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  return e as DomainError;
};

beforeAll(async () => {
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = ROOT;
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  await seedPlans(owner);
});

beforeEach(() => {
  synced = [];
  events = [];
  setRoutingSync(async (tenantId, removed = []) => { synced.push({ tenantId, removed }); });
  setEventPublisher(async (name) => { events.push(name); });
});

afterAll(async () => {
  setEventPublisher(async () => {});
  await owner?.$disconnect();
  await app?.$disconnect();
});

describe("resolving hosts in the database", () => {
  it("finds a store by its exact subdomain only", async () => {
    const { f } = await store("exact");
    const host = `${f.subdomain}.${ROOT}`;
    expect(await resolveHostEntry(host, ROOT)).toMatchObject({ tenantId: f.tenantId, matched: "subdomain", subdomain: f.subdomain, primaryDomain: null });
    expect(await resolveHostEntry(`${f.subdomain}.evil.${ROOT}`, ROOT)).toBeNull();
    expect(await resolveHostEntry(`x.${f.subdomain}.${ROOT}`, ROOT)).toBeNull();
    expect(await resolveHostEntry(`${f.subdomain}.${ROOT}.evil.com`, ROOT)).toBeNull();
    expect(await resolveHostEntry(`${f.subdomain}x.${ROOT}`, ROOT)).toBeNull();
  });

  it("the older tenant lookup no longer matches nested look-alikes either", async () => {
    const { f } = await store("old");
    expect(await resolveTenantByHost(`${f.subdomain}.${ROOT}`, ROOT)).toMatchObject({ id: f.tenantId });
    expect(await resolveTenantByHost(`${f.subdomain}.evil.${ROOT}`, ROOT)).toBeNull();
  });

  it("is not fooled by SQL wildcard characters in the host or root", async () => {
    await store("wild");
    expect(await resolveHostEntry("%.biztrackbd.test", ROOT)).toBeNull();
    expect(await resolveHostEntry("_.biztrackbd.test", ROOT)).toBeNull();
    expect(await resolveHostEntry("wild1.biztrackbd.test", "%")).toBeNull();
  });

  it("an unverified domain routes nothing", async () => {
    const { f, actor } = await store("unver");
    await addDomain(f.tenantId, actor, "unverified-shop.com");
    expect(await resolveHostEntry("unverified-shop.com", ROOT)).toBeNull();
    expect(await resolveHostEntry("www.unverified-shop.com", ROOT)).toBeNull();
  });

  it("a verified domain and its www twin resolve to the store", async () => {
    const { f, actor } = await store("ver");
    await addDomain(f.tenantId, actor, "https://www.Verified-Shop.com/");
    await confirmDomainVerified(f.tenantId, "verified-shop.com");
    expect(await resolveHostEntry("verified-shop.com", ROOT)).toMatchObject({ tenantId: f.tenantId, matched: "custom", primaryDomain: "verified-shop.com" });
    expect(await resolveHostEntry("www.verified-shop.com", ROOT)).toMatchObject({ tenantId: f.tenantId, matched: "custom_www" });
    expect(await resolveHostEntry("evil.verified-shop.com", ROOT)).toBeNull();
    expect(await resolveHostEntry("verified-shop.com.evil.com", ROOT)).toBeNull();
    // the subdomain now also reports the canonical primary domain
    expect(await resolveHostEntry(`${f.subdomain}.${ROOT}`, ROOT)).toMatchObject({ matched: "subdomain", primaryDomain: "verified-shop.com" });
  });

  it("turning off the www redirect stops the www twin resolving", async () => {
    const { f, actor } = await store("nowww");
    const d = await addDomain(f.tenantId, actor, "nowww-shop.com");
    await confirmDomainVerified(f.tenantId, "nowww-shop.com");
    await owner.domain.update({ where: { id: d.id }, data: { redirectWww: false } });
    expect(await resolveHostEntry("www.nowww-shop.com", ROOT)).toBeNull();
    expect(await resolveHostEntry("nowww-shop.com", ROOT)).toMatchObject({ matched: "custom", redirectWww: false });
  });

  it("the database directory returns validated entries with the real status", async () => {
    const { f } = await store("dir");
    await owner.tenant.update({ where: { id: f.tenantId }, data: { status: "SUSPENDED" } });
    const e = await dbDirectory(ROOT).lookup(`${f.subdomain}.${ROOT}`);
    expect(e).toMatchObject({ tenantId: f.tenantId, status: "SUSPENDED", themeId: "kapor" });
    expect(await dbDirectory(ROOT).lookup("nobody.biztrackbd.test")).toBeNull();
  });
});

describe("connecting domains", () => {
  it("needs a plan with custom domains, and the right role", async () => {
    const starter = await store("starter", "STARTER");
    await fails(addDomain(starter.f.tenantId, starter.actor, "starter-shop.com"), "PLAN_FEATURE");
    const pro = await store("role");
    await fails(addDomain(pro.f.tenantId, pro.manager, "role-shop.com"), "FORBIDDEN");
    await fails(listDomains(pro.f.tenantId, pro.manager), "FORBIDDEN");
    expect(await owner.domain.count({ where: { tenantId: pro.f.tenantId } })).toBe(0);
  });

  it("rejects platform addresses and junk with plain messages", async () => {
    const { f, actor } = await store("junk");
    for (const bad of [`${ROOT}`, `evil.${ROOT}`, "shop", "10.0.0.1", "bad domain.com", ""]) {
      await fails(addDomain(f.tenantId, actor, bad), "VALIDATION_ERROR");
    }
  });

  it("records the claim, audits it and announces it", async () => {
    const { f, actor } = await store("claim");
    const d = await addDomain(f.tenantId, actor, "claim-shop.com");
    expect(d).toMatchObject({ domain: "claim-shop.com", verified: false, isPrimary: false });
    expect(events).toContain("domain/registered");
    const log = await owner.auditLog.findFirstOrThrow({ where: { tenantId: f.tenantId, action: "domain.added" } });
    expect(log.details).toEqual({ domain: "claim-shop.com" });
    expect(synced).toHaveLength(0); // unverified: nothing to route
  });

  it("limits how many domains a store can add", async () => {
    const { f, actor } = await store("many");
    for (let i = 0; i < 5; i++) await addDomain(f.tenantId, actor, `many-${i}-shop.com`);
    await fails(addDomain(f.tenantId, actor, "many-6-shop.com"), "VALIDATION_ERROR");
  });

  it("a domain cannot be taken from another store, and the error does not say whose it is", async () => {
    const a = await store("holder");
    const b = await store("seeker");
    await addDomain(a.f.tenantId, a.actor, "contested-shop.com");
    await confirmDomainVerified(a.f.tenantId, "contested-shop.com");
    const e1 = await fails(addDomain(b.f.tenantId, b.actor, "contested-shop.com"), "VALIDATION_ERROR");
    const e2 = await fails(addDomain(a.f.tenantId, a.actor, "contested-shop.com"), "VALIDATION_ERROR");
    expect(e1.message).toBe(e2.message);
    expect(e1.message).not.toContain(a.f.subdomain);
    expect(await owner.domain.count({ where: { domain: "contested-shop.com" } })).toBe(1);
  });

  it("a recent unverified claim holds the name, an old one is released to the next claimant", async () => {
    const a = await store("squatter");
    const b = await store("rightful");
    await addDomain(a.f.tenantId, a.actor, "squatted-shop.com");
    await fails(addDomain(b.f.tenantId, b.actor, "squatted-shop.com"), "VALIDATION_ERROR");
    await owner.domain.updateMany({ where: { domain: "squatted-shop.com" }, data: { createdAt: new Date(Date.now() - 25 * 3_600_000) } });
    await addDomain(b.f.tenantId, b.actor, "squatted-shop.com");
    expect((await owner.domain.findUniqueOrThrow({ where: { domain: "squatted-shop.com" } })).tenantId).toBe(b.f.tenantId);
  });

  it("a verified claim is never released, however old", async () => {
    const a = await store("verified-holder");
    const b = await store("verified-seeker");
    await addDomain(a.f.tenantId, a.actor, "keepme-shop.com");
    await confirmDomainVerified(a.f.tenantId, "keepme-shop.com");
    await owner.domain.updateMany({ where: { domain: "keepme-shop.com" }, data: { createdAt: new Date(Date.now() - 400 * 24 * 3_600_000) } });
    await fails(addDomain(b.f.tenantId, b.actor, "keepme-shop.com"), "VALIDATION_ERROR");
    expect((await owner.domain.findUniqueOrThrow({ where: { domain: "keepme-shop.com" } })).tenantId).toBe(a.f.tenantId);
  });
});

describe("verification, primary domain and removal", () => {
  it("the first verified domain becomes primary and routing is pushed", async () => {
    const { f, actor } = await store("first");
    await addDomain(f.tenantId, actor, "first-a.com");
    await addDomain(f.tenantId, actor, "first-b.com");
    await confirmDomainVerified(f.tenantId, "first-a.com");
    await confirmDomainVerified(f.tenantId, "first-b.com");
    const rows = await listDomains(f.tenantId, actor);
    expect(rows.find((d) => d.domain === "first-a.com")?.isPrimary).toBe(true);
    expect(rows.find((d) => d.domain === "first-b.com")?.isPrimary).toBe(false);
    expect(synced.map((s) => s.tenantId)).toEqual([f.tenantId, f.tenantId]);
    // Confirming again changes nothing in the database but still pushes, which is how a failed edge push is retried.
    await confirmDomainVerified(f.tenantId, "first-a.com");
    expect(synced).toHaveLength(3);
    expect((await listDomains(f.tenantId, actor)).filter((d) => d.isPrimary)).toHaveLength(1);
  });

  it("only verified domains can be primary, and switching leaves exactly one primary", async () => {
    const { f, actor } = await store("switch");
    const a = await addDomain(f.tenantId, actor, "switch-a.com");
    const b = await addDomain(f.tenantId, actor, "switch-b.com");
    await fails(setPrimaryDomain(f.tenantId, actor, b.id), "VALIDATION_ERROR");
    await confirmDomainVerified(f.tenantId, "switch-a.com");
    await confirmDomainVerified(f.tenantId, "switch-b.com");
    await setPrimaryDomain(f.tenantId, actor, b.id);
    const rows = await owner.domain.findMany({ where: { tenantId: f.tenantId } });
    expect(rows.filter((d) => d.isPrimary).map((d) => d.id)).toEqual([b.id]);
    expect(rows.find((d) => d.id === a.id)?.isPrimary).toBe(false);
  });

  it("racing primary changes still leave exactly one, and the database refuses two", async () => {
    const { f, actor } = await store("race");
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const d = await addDomain(f.tenantId, actor, `race-${i}.com`);
      await confirmDomainVerified(f.tenantId, `race-${i}.com`);
      ids.push(d.id);
    }
    await Promise.all(ids.map((id) => setPrimaryDomain(f.tenantId, actor, id)));
    expect(await owner.domain.count({ where: { tenantId: f.tenantId, isPrimary: true } })).toBe(1);
    await expect(owner.domain.updateMany({ where: { tenantId: f.tenantId }, data: { isPrimary: true } })).rejects.toBeTruthy();
  });

  it("removing the primary promotes the oldest remaining verified domain and removes both hosts from the edge", async () => {
    const { f, actor } = await store("remove");
    const a = await addDomain(f.tenantId, actor, "remove-a.com");
    await addDomain(f.tenantId, actor, "remove-b.com");
    await confirmDomainVerified(f.tenantId, "remove-a.com");
    await confirmDomainVerified(f.tenantId, "remove-b.com");
    synced = [];
    await removeDomain(f.tenantId, actor, a.id);
    expect((await owner.domain.findUniqueOrThrow({ where: { domain: "remove-b.com" } })).isPrimary).toBe(true);
    expect(synced).toEqual([{ tenantId: f.tenantId, removed: ["remove-a.com"] }]);
    expect(await resolveHostEntry("remove-a.com", ROOT)).toBeNull();
    expect(await resolveHostEntry("www.remove-a.com", ROOT)).toBeNull();
  });

  it("only the owner role changes domains, and not across stores", async () => {
    const a = await store("own-a");
    const b = await store("own-b");
    const d = await addDomain(a.f.tenantId, a.actor, "own-a-shop.com");
    await fails(removeDomain(a.f.tenantId, a.manager, d.id), "FORBIDDEN");
    await fails(removeDomain(b.f.tenantId, b.actor, d.id), "NOT_FOUND");
    await fails(setPrimaryDomain(b.f.tenantId, b.actor, d.id), "NOT_FOUND");
    expect(await owner.domain.count({ where: { id: d.id } })).toBe(1);
  });

  it("an edge push failure is reported but never fails the change", async () => {
    const { f, actor } = await store("edgefail");
    await addDomain(f.tenantId, actor, "edgefail-shop.com");
    setRoutingSync(async () => { throw new Error("vercel is down"); });
    await confirmDomainVerified(f.tenantId, "edgefail-shop.com");
    expect((await owner.domain.findUniqueOrThrow({ where: { domain: "edgefail-shop.com" } })).verified).toBe(true);
    expect(events).toContain("routing/sync-failed");
    expect(await resolveHostEntry("edgefail-shop.com", ROOT)).toMatchObject({ matched: "custom" });
  });

  it("records the lifecycle in the audit log", async () => {
    const { f, actor } = await store("audited");
    const d = await addDomain(f.tenantId, actor, "audited-shop.com");
    await confirmDomainVerified(f.tenantId, "audited-shop.com");
    await removeDomain(f.tenantId, actor, d.id);
    const actions = (await owner.auditLog.findMany({ where: { tenantId: f.tenantId, action: { startsWith: "domain." } }, orderBy: { createdAt: "asc" } })).map((l) => l.action);
    expect(actions).toEqual(["domain.added", "domain.verified", "domain.removed"]);
  });
});

describe("edge config routes", () => {
  it("lists the subdomain, each verified domain and its www twin, with the primary on every entry", async () => {
    const { f, actor } = await store("routes");
    await addDomain(f.tenantId, actor, "routes-shop.com");
    await addDomain(f.tenantId, actor, "routes-pending.com");
    await confirmDomainVerified(f.tenantId, "routes-shop.com");
    const routes = await buildTenantRoutes(f.tenantId, ROOT);
    expect(Object.keys(routes).sort()).toEqual([`${f.subdomain}.${ROOT}`, "routes-shop.com", "www.routes-shop.com"].sort());
    expect(routes["routes-shop.com"]).toMatchObject({ matched: "custom", primaryDomain: "routes-shop.com" });
    expect(routes["www.routes-shop.com"]).toMatchObject({ matched: "custom_www" });
    expect(routes[`${f.subdomain}.${ROOT}`]).toMatchObject({ matched: "subdomain", primaryDomain: "routes-shop.com" });
  });

  it("syncs through the real client path with a fake fetch, including removals", async () => {
    const { f, actor } = await store("push");
    await addDomain(f.tenantId, actor, "push-shop.com");
    await confirmDomainVerified(f.tenantId, "push-shop.com");
    const sent: { items: { operation: string; key: string }[] }[] = [];
    const fakeFetch = (async (_u: string, init: RequestInit) => { sent.push(JSON.parse(init.body as string)); return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
    const r = await syncTenantRouting(f.tenantId, {
      removed: ["gone-shop.com"], env: { EDGE_CONFIG_ID: "ecfg_1", VERCEL_AUTH_TOKEN: "t", NEXT_PUBLIC_ROOT_DOMAIN: ROOT }, fetchImpl: fakeFetch,
    });
    expect(r.items).toBe(5); // subdomain, push-shop.com, www twin, and the two deletes
    const ops = sent[0]!.items.map((i) => `${i.operation}:${i.key}`).sort();
    expect(ops).toContain("delete:domain:gone-shop.com");
    expect(ops).toContain("delete:domain:www.gone-shop.com");
    expect(ops).toContain("upsert:domain:www.push-shop.com");
  });
});
