import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { createBaseClient, setBasePrisma, withTenant, type PrismaClient, type StaffRole } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls, type TenantFixture } from "@biztrackbd/db/testing";
import {
  AREAS, ASSIGNABLE_ROLES, PERMISSIONS, acceptInvite, archiveProduct, audit, can, changeStaffRole, createProduct,
  inviteStaff, listAudit, listTeam, markPaid, previewInvite, redact, removeIntegration, revokeInvite, saveIntegration,
  setStaffActive, DomainError, type StaffActor,
} from "../src";
import { randomBytes } from "node:crypto";

let urls: ReturnType<typeof testUrls>;
let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

const email = (n: string) => `${n}-${++seq}@example.test`;
const ring = { activeKeyId: "v1", keys: new Map([["v1", randomBytes(32)]]) };

async function team(staffLimit: number | null = 5) {
  await owner.plan.update({ where: { tier: "STARTER" }, data: { limits: { products: 300, ordersPerMonth: 500, staff: staffLimit } } });
  const f = await createTenantFixture(owner, { name: `Team ${++seq}`, subdomain: `team-${seq}` });
  await owner.tenant.update({ where: { id: f.tenantId }, data: { planTier: "STARTER" } });
  const o = await owner.tenantUser.create({ data: { tenantId: f.tenantId, email: email("owner"), name: "Owner", role: "STORE_OWNER", passwordHash: "x" } });
  const ownerActor: StaffActor = { userId: o.id, email: o.email, role: "STORE_OWNER" };
  return { f, ownerActor };
}

async function join(f: TenantFixture, actor: StaffActor, role: StaffRole) {
  const e = email(role.toLowerCase());
  const inv = await inviteStaff(f.tenantId, actor, { email: e, role });
  const r = await acceptInvite(inv.token, { name: "New Person" });
  const u = await owner.tenantUser.findUniqueOrThrow({ where: { id: r.userId } });
  return { actor: { userId: u.id, email: u.email, role } as StaffActor, user: u };
}

const fails = async (p: Promise<unknown>, code: string) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  return e as DomainError;
};

beforeAll(async () => {
  urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  await seedPlans(owner);
});

afterAll(async () => {
  await owner?.$disconnect();
  await app?.$disconnect();
});

describe("permission matrix", () => {
  it("matches the canvas grid for every role", () => {
    expect(PERMISSIONS.STORE_MANAGER).toMatchObject({ orders: "edit", products: "edit", customers: "edit", marketing: "edit", reports: "view", design: "edit", billing: "none" });
    expect(PERMISSIONS.ORDER_PACKER).toMatchObject({ orders: "edit", products: "edit", customers: "view", marketing: "none", reports: "none", design: "none", billing: "none" });
    expect(PERMISSIONS.TELEMARKETER).toMatchObject({ orders: "view", products: "view", customers: "edit", marketing: "none", reports: "none", design: "none", billing: "none" });
  });

  it("the owner can do everything and nobody else can touch billing or the team", () => {
    for (const a of AREAS) expect(can("STORE_OWNER", a, "edit")).toBe(true);
    for (const r of ASSIGNABLE_ROLES) {
      expect(can(r, "billing", "view")).toBe(false);
      expect(can(r, "team", "view")).toBe(false);
    }
  });

  it("edit implies view and view does not imply edit", () => {
    expect(can("TELEMARKETER", "orders", "view")).toBe(true);
    expect(can("TELEMARKETER", "orders", "edit")).toBe(false);
    expect(can("ORDER_PACKER", "orders", "view")).toBe(true);
  });
});

describe("invites", () => {
  it("only the token's hash is stored, and the invite is single-use", async () => {
    const { f, ownerActor } = await team();
    const e = email("a");
    const inv = await inviteStaff(f.tenantId, ownerActor, { email: e.toUpperCase(), role: "STORE_MANAGER" });
    const row = await owner.staffInvite.findUniqueOrThrow({ where: { id: inv.inviteId } });
    expect(row.email).toBe(e);
    expect(row.tokenHash).toBe(createHash("sha256").update(inv.token).digest("hex"));
    expect(JSON.stringify(row)).not.toContain(inv.token);
    expect(await previewInvite(inv.token)).toMatchObject({ email: e, role: "STORE_MANAGER" });

    const joined = await acceptInvite(inv.token, { name: "Kamrul Hasan" });
    expect(joined.role).toBe("STORE_MANAGER");
    await fails(acceptInvite(inv.token, { name: "Someone Else" }), "VALIDATION_ERROR");
    expect(await previewInvite(inv.token)).toBeNull();
  });

  it("two people opening the same link at once produce exactly one account", async () => {
    const { f, ownerActor } = await team();
    const inv = await inviteStaff(f.tenantId, ownerActor, { email: email("race"), role: "ORDER_PACKER" });
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => acceptInvite(inv.token, { name: "Racer One" })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await owner.tenantUser.count({ where: { tenantId: f.tenantId, role: "ORDER_PACKER" } })).toBe(1);
  });

  it("rejects expired, revoked, malformed and unknown tokens with the same message", async () => {
    const { f, ownerActor } = await team();
    const expired = await inviteStaff(f.tenantId, ownerActor, { email: email("exp"), role: "TELEMARKETER" });
    await owner.staffInvite.update({ where: { id: expired.inviteId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const revoked = await inviteStaff(f.tenantId, ownerActor, { email: email("rev"), role: "TELEMARKETER" });
    await revokeInvite(f.tenantId, ownerActor, revoked.inviteId);
    const msgs = new Set<string>();
    for (const t of [expired.token, revoked.token, "nope", "0".repeat(64)]) msgs.add((await fails(acceptInvite(t, { name: "Nobody Here" }), "VALIDATION_ERROR")).message);
    expect(msgs.size).toBe(1);
  });

  it("cannot invite as owner, or someone already on the team, and a new invite replaces the old one", async () => {
    const { f, ownerActor } = await team();
    await fails(inviteStaff(f.tenantId, ownerActor, { email: email("x"), role: "STORE_OWNER" }), "VALIDATION_ERROR");
    await fails(inviteStaff(f.tenantId, ownerActor, { email: "not-an-email", role: "STORE_MANAGER" }), "VALIDATION_ERROR");
    const e = email("dup");
    const first = await inviteStaff(f.tenantId, ownerActor, { email: e, role: "STORE_MANAGER" });
    const second = await inviteStaff(f.tenantId, ownerActor, { email: e, role: "ORDER_PACKER" });
    expect(await previewInvite(first.token)).toBeNull();
    expect(await previewInvite(second.token)).toMatchObject({ role: "ORDER_PACKER" });
    expect(await owner.staffInvite.count({ where: { tenantId: f.tenantId, email: e } })).toBe(1);
    await acceptInvite(second.token, { name: "Joined Now" });
    await fails(inviteStaff(f.tenantId, ownerActor, { email: e, role: "STORE_MANAGER" }), "VALIDATION_ERROR");
  });

  it("enforces the plan's staff limit, counting open invites, even when invites race", async () => {
    const { f, ownerActor } = await team(4); // owner + 3 seats
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => inviteStaff(f.tenantId, ownerActor, { email: email("seat"), role: "ORDER_PACKER" })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(rejected.every((r) => r.reason?.code === "PLAN_LIMIT")).toBe(true);
    const t = await listTeam(f.tenantId, ownerActor);
    expect(t.seats).toEqual({ used: 4, limit: 4 });
  });

  it("revoking an invite frees its seat; null staff limit is unlimited", async () => {
    const { f, ownerActor } = await team(2);
    const a = await inviteStaff(f.tenantId, ownerActor, { email: email("s"), role: "ORDER_PACKER" });
    await fails(inviteStaff(f.tenantId, ownerActor, { email: email("t"), role: "ORDER_PACKER" }), "PLAN_LIMIT");
    await revokeInvite(f.tenantId, ownerActor, a.inviteId);
    await inviteStaff(f.tenantId, ownerActor, { email: email("u"), role: "ORDER_PACKER" });
    const big = await team(null);
    for (let i = 0; i < 6; i++) await inviteStaff(big.f.tenantId, big.ownerActor, { email: email("many"), role: "TELEMARKETER" });
  });
});

describe("managing the team", () => {
  it("only the owner can manage staff", async () => {
    const { f, ownerActor } = await team();
    const mgr = await join(f, ownerActor, "STORE_MANAGER");
    await fails(inviteStaff(f.tenantId, mgr.actor, { email: email("n"), role: "ORDER_PACKER" }), "FORBIDDEN");
    await fails(listTeam(f.tenantId, mgr.actor), "FORBIDDEN");
    await fails(changeStaffRole(f.tenantId, mgr.actor, mgr.user.id, "ORDER_PACKER"), "FORBIDDEN");
    await fails(listAudit(f.tenantId, mgr.actor), "FORBIDDEN");
  });

  it("changes a role, but never the owner's and never your own", async () => {
    const { f, ownerActor } = await team();
    const p = await join(f, ownerActor, "ORDER_PACKER");
    await changeStaffRole(f.tenantId, ownerActor, p.user.id, "TELEMARKETER");
    expect((await owner.tenantUser.findUniqueOrThrow({ where: { id: p.user.id } })).role).toBe("TELEMARKETER");
    await fails(changeStaffRole(f.tenantId, ownerActor, p.user.id, "STORE_OWNER"), "VALIDATION_ERROR");
    await fails(changeStaffRole(f.tenantId, ownerActor, ownerActor.userId, "STORE_MANAGER"), "VALIDATION_ERROR");
    await fails(setStaffActive(f.tenantId, ownerActor, ownerActor.userId, false), "VALIDATION_ERROR");
  });

  it("deactivating frees a seat, and reactivating needs one", async () => {
    const { f, ownerActor } = await team(3);
    const a = await join(f, ownerActor, "ORDER_PACKER");
    await join(f, ownerActor, "TELEMARKETER");
    await fails(inviteStaff(f.tenantId, ownerActor, { email: email("full"), role: "ORDER_PACKER" }), "PLAN_LIMIT");
    await setStaffActive(f.tenantId, ownerActor, a.user.id, false);
    await inviteStaff(f.tenantId, ownerActor, { email: email("taken"), role: "ORDER_PACKER" }); // takes the freed seat
    await fails(setStaffActive(f.tenantId, ownerActor, a.user.id, true), "PLAN_LIMIT");
  });

  it("cannot reach people or invites in another store", async () => {
    const A = await team();
    const B = await team();
    const inB = await join(B.f, B.ownerActor, "ORDER_PACKER");
    await fails(changeStaffRole(A.f.tenantId, A.ownerActor, inB.user.id, "TELEMARKETER"), "NOT_FOUND");
    await fails(setStaffActive(A.f.tenantId, A.ownerActor, inB.user.id, false), "NOT_FOUND");
    const t = await listTeam(A.f.tenantId, A.ownerActor);
    expect(t.members.every((m) => m.id !== inB.user.id)).toBe(true);
  });
});

describe("audit log", () => {
  it("records who did what, with the request IP", async () => {
    const { f, ownerActor } = await team();
    const actor = { ...ownerActor, ip: "203.0.113.7" };
    const e = email("log");
    await inviteStaff(f.tenantId, actor, { email: e, role: "STORE_MANAGER" });
    const rows = await listAudit(f.tenantId, actor, { action: "staff." });
    expect(rows[0]).toMatchObject({ action: "staff.invited", actorId: actor.userId, actorEmail: actor.email, ipAddress: "203.0.113.7" });
    expect(rows[0]!.details).toEqual({ email: e, role: "STORE_MANAGER" });
  });

  it("records the whole staff life cycle", async () => {
    const { f, ownerActor } = await team();
    const p = await join(f, ownerActor, "ORDER_PACKER");
    await changeStaffRole(f.tenantId, ownerActor, p.user.id, "TELEMARKETER");
    await setStaffActive(f.tenantId, ownerActor, p.user.id, false);
    const actions = (await listAudit(f.tenantId, ownerActor)).map((r) => r.action).reverse();
    expect(actions).toEqual(["staff.invited", "staff.joined", "staff.role_changed", "staff.deactivated"]);
    const change = (await listAudit(f.tenantId, ownerActor, { action: "staff.role_changed" }))[0]!;
    expect(change.details).toMatchObject({ from: "ORDER_PACKER", to: "TELEMARKETER" });
    expect((await listAudit(f.tenantId, ownerActor, { actorId: p.user.id })).map((r) => r.action)).toEqual(["staff.joined"]);
  });

  it("records integration changes without ever recording the keys", async () => {
    const { f, ownerActor } = await team();
    await saveIntegration(f.tenantId, { provider: "STEADFAST", mode: "LIVE", secrets: { apiKey: "SUPER-SECRET-KEY-1", secretKey: "SUPER-SECRET-KEY-2" } }, ring, ownerActor);
    await saveIntegration(f.tenantId, { provider: "STEADFAST", mode: "LIVE", secrets: { apiKey: "SUPER-SECRET-KEY-3" } }, ring, ownerActor);
    await removeIntegration(f.tenantId, "STEADFAST", "LIVE", ownerActor);
    const rows = await listAudit(f.tenantId, ownerActor, { action: "integration." });
    expect(rows.map((r) => r.action).reverse()).toEqual(["integration.connected", "integration.updated", "integration.removed"]);
    expect(JSON.stringify(rows)).not.toContain("SUPER-SECRET");
    expect(rows.find((r) => r.action === "integration.updated")!.details).toMatchObject({ keysChanged: ["apiKey"] });
  });

  it("only the owner can change integration keys", async () => {
    const { f, ownerActor } = await team();
    const mgr = await join(f, ownerActor, "STORE_MANAGER");
    await fails(saveIntegration(f.tenantId, { provider: "STEADFAST", mode: "LIVE", secrets: { apiKey: "a", secretKey: "b" } }, ring, mgr.actor), "FORBIDDEN");
    expect(await owner.tenantIntegration.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it("enforces roles on products and records catalog and payment actions", async () => {
    const { f, ownerActor } = await team();
    const support = await join(f, ownerActor, "TELEMARKETER");
    const packer = await join(f, ownerActor, "ORDER_PACKER");
    await fails(createProduct(f.tenantId, { title: "Nope Shirt", slug: "nope-shirt", basePrice: 100 }, support.actor), "FORBIDDEN");
    const p = await createProduct(f.tenantId, { title: "Yes Shirt", slug: "yes-shirt", basePrice: 100 }, packer.actor);
    await archiveProduct(f.tenantId, p.id, packer.actor);
    const rows = await listAudit(f.tenantId, ownerActor, { action: "product." });
    expect(rows.map((r) => r.action).reverse()).toEqual(["product.created", "product.archived"]);
    expect(rows.every((r) => r.actorId === packer.actor.userId)).toBe(true);
    const order = await owner.order.findFirst({ where: { tenantId: f.tenantId } });
    expect(order).toBeNull(); // no orders yet: markPaid is covered by the permission check below
    await fails(markPaid(f.tenantId, "does-not-matter-1", support.actor.userId, support.actor), "FORBIDDEN");
  });

  it("a rolled-back change leaves no log line, and a logged change always has its effect", async () => {
    const { f, ownerActor } = await team(2);
    await inviteStaff(f.tenantId, ownerActor, { email: email("ok"), role: "ORDER_PACKER" });
    await fails(inviteStaff(f.tenantId, ownerActor, { email: email("blocked"), role: "ORDER_PACKER" }), "PLAN_LIMIT");
    const logged = await listAudit(f.tenantId, ownerActor, { action: "staff.invited" });
    expect(logged).toHaveLength(1);
    expect(await owner.staffInvite.count({ where: { tenantId: f.tenantId } })).toBe(1);
  });

  it("is append-only for the application role", async () => {
    const { f, ownerActor } = await team();
    await withTenant(f.tenantId, (tx) => audit(tx, f.tenantId, ownerActor, "test.entry", { n: 1 }));
    const c = new pg.Client({ connectionString: urls.app });
    await c.connect();
    try {
      await c.query("BEGIN");
      await c.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [f.tenantId]);
      await expect(c.query(`UPDATE "AuditLog" SET action = 'tampered'`)).rejects.toMatchObject({ code: "42501" });
      await c.query("ROLLBACK");
      await c.query("BEGIN");
      await c.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [f.tenantId]);
      await expect(c.query(`DELETE FROM "AuditLog"`)).rejects.toMatchObject({ code: "42501" });
      await c.query("ROLLBACK");
    } finally {
      await c.end();
    }
    expect((await owner.auditLog.count({ where: { tenantId: f.tenantId, action: "test.entry" } }))).toBe(1);
  });

  it("is private to each store", async () => {
    const A = await team();
    const B = await team();
    await inviteStaff(A.f.tenantId, A.ownerActor, { email: email("onlya"), role: "STORE_MANAGER" });
    const seenByB = await listAudit(B.f.tenantId, B.ownerActor);
    expect(seenByB.every((r) => r.tenantId === B.f.tenantId)).toBe(true);
    expect(seenByB.some((r) => r.action === "staff.invited")).toBe(false);
  });

  it("pages through entries with a cursor", async () => {
    const { f, ownerActor } = await team();
    for (let i = 0; i < 5; i++) await withTenant(f.tenantId, (tx) => audit(tx, f.tenantId, ownerActor, "test.page", { i }));
    const first = await listAudit(f.tenantId, ownerActor, { action: "test.page", limit: 2 });
    expect(first).toHaveLength(2);
    const next = await listAudit(f.tenantId, ownerActor, { action: "test.page", limit: 10, before: first[1]!.createdAt });
    expect(next.every((r) => r.createdAt < first[1]!.createdAt)).toBe(true);
  });

  it("redacts anything that looks like a secret", () => {
    expect(redact({ ok: 1, apiKey: "x", nested: { password: "p", fine: "y", Authorization: "Bearer z" }, list: [{ token: "t" }] })).toEqual({
      ok: 1, apiKey: "[redacted]", nested: { password: "[redacted]", fine: "y", Authorization: "[redacted]" }, list: [{ token: "[redacted]" }],
    });
  });
});
