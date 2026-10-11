import { createHmac, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  AuthFailure, acceptInvite, adminCreateUser, checkPassword, decodeClaims, enrollTotp, getUserFromToken, inviteStaff, platformMemberFor, refreshSession, sendEmailCode, setAuthFetch, setEventPublisher,
  signInWithPassword, staffEmailKnown, staffMemberships, verifyEmailCode, verifyTotp, type StaffActor,
} from "../src";

/**
 * A stand-in for the parts of Supabase Auth we use, held in memory. The real service is exercised end to end by the Playwright
 * suite (phase10-auth.spec.ts); this lets every branch run in milliseconds, including outages and rate limits.
 */
interface FakeUser { id: string; email: string; password: string; confirmed: boolean; factors: { id: string; status: string; secret: string }[] }
function fakeSupabase() {
  const users = new Map<string, FakeUser>();
  const tokens = new Map<string, { userId: string; exp: number; aal: "aal1" | "aal2" }>();
  const refresh = new Map<string, string>();
  const codes = new Map<string, string>();
  const state = { down: false, rateLimited: false, calls: [] as string[], revoked: new Set<string>() };
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwt = (u: FakeUser, aal: "aal1" | "aal2", exp: number) => `${b64({ alg: "HS256" })}.${b64({ sub: u.id, email: u.email, exp, aal })}.${createHmac("sha256", "x").update(u.id + exp).digest("base64url")}`;
  const session = (u: FakeUser, aal: "aal1" | "aal2" = "aal1", ttl = 3600) => {
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const access = jwt(u, aal, exp);
    const rt = randomUUID();
    tokens.set(access, { userId: u.id, exp, aal });
    refresh.set(rt, u.id);
    return { access_token: access, refresh_token: rt, expires_at: exp, user: { id: u.id, email: u.email } };
  };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fetchFake = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname + url.search;
    const method = (init?.method ?? "GET").toUpperCase();
    state.calls.push(`${method} ${url.pathname}`);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    const bearer = String((init?.headers as Record<string, string>)?.authorization ?? "").replace(/^Bearer /, "");
    const apikey = (init?.headers as Record<string, string>)?.apikey;
    if (state.down) return json(503, { msg: "down" });
    if (state.rateLimited) return json(429, { error_code: "over_request_rate_limit" });
    const byEmail = (e: string) => [...users.values()].find((u) => u.email === String(e).toLowerCase());
    const who = () => {
      const t = tokens.get(bearer);
      return t && !state.revoked.has(bearer) && t.exp * 1000 > Date.now() ? users.get(t.userId) : undefined;
    };
    if (path.startsWith("/auth/v1/token?grant_type=password")) {
      const u = byEmail(String(body.email));
      if (!u || u.password !== body.password) return json(400, { error_code: "invalid_credentials" });
      if (!u.confirmed) return json(400, { error_code: "email_not_confirmed" });
      return json(200, session(u));
    }
    if (path.startsWith("/auth/v1/token?grant_type=refresh_token")) {
      const id = refresh.get(String(body.refresh_token));
      return id ? json(200, session(users.get(id)!)) : json(400, { error_code: "refresh_token_not_found" });
    }
    if (url.pathname === "/auth/v1/user" && method === "GET") {
      const u = who();
      if (!u) return json(401, { msg: "invalid" });
      return json(200, { id: u.id, email: u.email, email_confirmed_at: u.confirmed ? "2026-01-01" : null, factors: u.factors.map((f) => ({ id: f.id, factor_type: "totp", status: f.status })) });
    }
    if (url.pathname === "/auth/v1/user" && method === "PUT") {
      const u = who();
      if (!u) return json(401, {});
      u.password = String(body.password);
      return json(200, { id: u.id });
    }
    if (url.pathname === "/auth/v1/admin/users" && method === "POST") {
      if (apikey !== "service-key") return json(401, {});
      if (byEmail(String(body.email))) return json(422, { error_code: "email_exists" });
      const u: FakeUser = { id: randomUUID(), email: String(body.email), password: String(body.password), confirmed: Boolean(body.email_confirm), factors: [] };
      users.set(u.id, u);
      return json(200, { id: u.id });
    }
    if (url.pathname.startsWith("/auth/v1/admin/users/") && method === "DELETE") {
      users.delete(decodeURIComponent(url.pathname.split("/").pop()!));
      return json(200, {});
    }
    if (url.pathname === "/auth/v1/otp") {
      codes.set(String(body.email).toLowerCase(), "123456");
      return json(200, {});
    }
    if (url.pathname === "/auth/v1/verify") {
      const email = String(body.email).toLowerCase();
      if (codes.get(email) !== body.token) return json(403, { error_code: "otp_expired" });
      codes.delete(email);
      let u = byEmail(email);
      if (!u) { u = { id: randomUUID(), email, password: randomUUID(), confirmed: true, factors: [] }; users.set(u.id, u); }
      u.confirmed = true;
      return json(200, session(u));
    }
    if (url.pathname === "/auth/v1/factors" && method === "POST") {
      const u = who();
      if (!u) return json(401, {});
      const f = { id: randomUUID(), status: "unverified", secret: "JBSWY3DPEHPK3PXP" };
      u.factors.push(f);
      return json(200, { id: f.id, totp: { secret: f.secret, uri: `otpauth://totp/BizTrackBD:${u.email}?secret=${f.secret}`, qr_code: "data:image/svg+xml;utf-8,<svg/>" } });
    }
    const m = url.pathname.match(/^\/auth\/v1\/factors\/([^/]+)\/(challenge|verify)$/);
    if (m) {
      const u = who();
      const f = u?.factors.find((x) => x.id === m[1]);
      if (!u || !f) return json(401, {});
      if (m[2] === "challenge") return json(200, { id: "ch-1" });
      if (body.code !== "654321") return json(400, { error_code: "mfa_verification_failed" });
      f.status = "verified";
      return json(200, session(u, "aal2"));
    }
    if (url.pathname === "/auth/v1/logout") {
      state.revoked.add(bearer);
      return json(204, {});
    }
    return json(404, { msg: `unhandled ${method} ${path}` });
  }) as typeof fetch;
  return { fetch: fetchFake, users, tokens, state, add: (email: string, password: string, confirmed = true) => { const u: FakeUser = { id: randomUUID(), email: email.toLowerCase(), password, confirmed, factors: [] }; users.set(u.id, u); return u; } };
}

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
let sb = fakeSupabase();
const actor = (tenantId: string): StaffActor => ({ userId: `owner-${tenantId}`, email: "owner@example.test", name: "Owner", role: "STORE_OWNER" });
const fails = async (p: Promise<unknown>, code: string) => {
  const e = await p.then(() => null, (x) => x);
  expect(e).toBeInstanceOf(AuthFailure);
  expect((e as AuthFailure).code).toBe(code);
};

beforeAll(async () => {
  process.env.SUPABASE_URL = "https://fake.supabase.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 5);
  setBasePrisma(app);
  setPlatformPrisma(owner);
  await seedPlans(owner);
});
beforeEach(() => {
  setEventPublisher(async () => {});
  sb = fakeSupabase();
  setAuthFetch(sb.fetch);
});
afterEach(() => {
  vi.useRealTimers();
});
afterAll(async () => {
  setAuthFetch(null);
  await app.$disconnect();
  await owner.$disconnect();
});

async function store(name: string) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 5 });
  await owner.tenant.update({ where: { id: f.tenantId }, data: { planTier: "BUSINESS" } });
  return f;
}
const staff = (tenantId: string, email: string, role: "STORE_OWNER" | "STORE_MANAGER" | "ORDER_PACKER" = "STORE_MANAGER", over: Record<string, unknown> = {}) =>
  owner.tenantUser.create({ data: { tenantId, email, name: "Staff", role, passwordHash: "EXTERNAL_AUTH", ...over } });

describe("passwords", () => {
  it("must be long enough and not obviously weak", () => {
    expect(checkPassword("short")).toMatch(/at least 10/);
    expect(checkPassword("1111111111")).toMatch(/too easy/);
    expect(checkPassword("password123")).toMatch(/too easy/);
    expect(checkPassword("a".repeat(80))).toMatch(/at most 72/);
    expect(checkPassword("correct horse battery")).toBeNull();
  });
});

describe("signing in", () => {
  it("returns tokens for the right password, with the email lowercased", async () => {
    const u = sb.add("Nusrat@Example.com", "correct horse battery");
    const t = await signInWithPassword("  NUSRAT@example.com ", "correct horse battery");
    expect(t).toMatchObject({ userId: u.id, email: "nusrat@example.com", aal: "aal1" });
    expect(decodeClaims(t.accessToken).exp).toBe(t.expiresAt);
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    sb.add("a@example.com", "correct horse battery");
    const wrong = await signInWithPassword("a@example.com", "not the password").then(() => null, (e: AuthFailure) => e);
    const unknown = await signInWithPassword("nobody@example.com", "whatever whatever").then(() => null, (e: AuthFailure) => e);
    expect(wrong?.code).toBe("INVALID_CREDENTIALS");
    expect(unknown?.code).toBe("INVALID_CREDENTIALS");
    expect(wrong?.message).toBe(unknown?.message);
  });

  it("says when the email is not confirmed, when it is rate limited, and when Supabase is down", async () => {
    sb.add("u@example.com", "correct horse battery", false);
    await fails(signInWithPassword("u@example.com", "correct horse battery"), "EMAIL_NOT_CONFIRMED");
    sb.state.rateLimited = true;
    await fails(signInWithPassword("u@example.com", "correct horse battery"), "RATE_LIMITED");
    sb.state.rateLimited = false;
    sb.state.down = true;
    await fails(signInWithPassword("u@example.com", "correct horse battery"), "UNAVAILABLE");
    setAuthFetch((async () => { throw new Error("network"); }) as typeof fetch);
    await fails(signInWithPassword("u@example.com", "x"), "UNAVAILABLE");
  });

  it("refreshes a session, and refuses an unknown refresh token", async () => {
    sb.add("r@example.com", "correct horse battery");
    const t = await signInWithPassword("r@example.com", "correct horse battery");
    expect((await refreshSession(t.refreshToken)).userId).toBe(t.userId);
    await fails(refreshSession("nope"), "EXPIRED");
  });
});

describe("checking a token", () => {
  it("finds the user, remembers the answer for 30 seconds, then asks again so a revoked session stops working", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    sb.add("c@example.com", "correct horse battery");
    const t = await signInWithPassword("c@example.com", "correct horse battery");
    const before = sb.state.calls.length;
    expect((await getUserFromToken(t.accessToken))?.email).toBe("c@example.com");
    await getUserFromToken(t.accessToken);
    expect(sb.state.calls.length - before).toBe(1);
    sb.state.revoked.add(t.accessToken);
    expect(await getUserFromToken(t.accessToken)).not.toBeNull(); // still inside the 30 seconds
    vi.setSystemTime(Date.now() + 31_000);
    expect(await getUserFromToken(t.accessToken)).toBeNull();
  });

  it("refuses an expired, forged or empty token without bothering Supabase for the expired one", async () => {
    const u = sb.add("e@example.com", "correct horse battery");
    const expired = `x.${Buffer.from(JSON.stringify({ sub: u.id, exp: 1 })).toString("base64url")}.y`;
    const before = sb.state.calls.length;
    expect(await getUserFromToken(expired)).toBeNull();
    expect(sb.state.calls.length).toBe(before);
    expect(await getUserFromToken("garbage")).toBeNull();
    expect(await getUserFromToken("")).toBeNull();
  });
});

describe("which stores an account may work in", () => {
  it("ties a staff row to the account on first sign-in, by confirmed email", async () => {
    const f = await store("mem1");
    const u = sb.add("Kamrul@Example.com", "correct horse battery");
    await staff(f.tenantId, "kamrul@example.com");
    const rows = await staffMemberships({ id: u.id, email: u.email, emailConfirmed: true });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tenantId: f.tenantId, role: "STORE_MANAGER", isActive: true });
    expect((await owner.tenantUser.findFirstOrThrow({ where: { tenantId: f.tenantId, email: "kamrul@example.com" } })).authUserId).toBe(u.id);
  });

  it("never ties anything for an unconfirmed email", async () => {
    const f = await store("mem2");
    await staff(f.tenantId, "victim@example.com");
    expect(await staffMemberships({ id: randomUUID(), email: "victim@example.com", emailConfirmed: false })).toEqual([]);
    expect((await owner.tenantUser.findFirstOrThrow({ where: { tenantId: f.tenantId, email: "victim@example.com" } })).authUserId).toBeNull();
  });

  it("does not let a second account with the same email take over a row that is already tied", async () => {
    const f = await store("mem3");
    await staff(f.tenantId, "twin@example.com");
    expect(await staffMemberships({ id: "first-account-id", email: "twin@example.com", emailConfirmed: true })).toHaveLength(1);
    expect(await staffMemberships({ id: "second-account-id", email: "twin@example.com", emailConfirmed: true })).toEqual([]);
    expect(await staffMemberships({ id: "first-account-id", email: "twin@example.com", emailConfirmed: true })).toHaveLength(1);
  });

  it("lists every store the person works in, and reports a deactivated account as inactive", async () => {
    const a = await store("mem4a");
    const b = await store("mem4b");
    await staff(a.tenantId, "multi@example.com", "STORE_OWNER");
    await staff(b.tenantId, "multi@example.com", "ORDER_PACKER", { isActive: false });
    const rows = await staffMemberships({ id: "multi-id", email: "multi@example.com", emailConfirmed: true });
    expect(rows.map((r) => [r.tenantId, r.role, r.isActive]).sort()).toEqual([[a.tenantId, "STORE_OWNER", true], [b.tenantId, "ORDER_PACKER", false]].sort());
  });

  it("is only about the account asking: someone else's rows stay out", async () => {
    const f = await store("mem5");
    await staff(f.tenantId, "private@example.com");
    expect(await staffMemberships({ id: "stranger-id", email: "stranger@example.com", emailConfirmed: true })).toEqual([]);
  });

  it("knows whether an address is on a team, for deciding whether to send a code", async () => {
    const f = await store("mem6");
    await staff(f.tenantId, "known@example.com");
    await staff(f.tenantId, "left@example.com", "STORE_MANAGER", { isActive: false });
    expect(await staffEmailKnown("KNOWN@example.com")).toBe(true);
    expect(await staffEmailKnown("left@example.com")).toBe(false);
    expect(await staffEmailKnown("nobody@example.com")).toBe(false);
  });

  it("ties a platform team member by confirmed email, once", async () => {
    await owner.platformUser.create({ data: { email: "boss@biztrackbd.example", name: "Boss", role: "OWNER" } });
    expect(await platformMemberFor({ id: "p1", email: "boss@biztrackbd.example", emailConfirmed: false })).toBeNull();
    expect(await platformMemberFor({ id: "p1", email: "BOSS@biztrackbd.example", emailConfirmed: true })).toMatchObject({ role: "OWNER", isActive: true });
    expect(await platformMemberFor({ id: "p2", email: "boss@biztrackbd.example", emailConfirmed: true })).toBeNull();
    expect(await platformMemberFor({ id: "p1", email: "boss@biztrackbd.example", emailConfirmed: true })).not.toBeNull();
  });
});

describe("two-factor codes", () => {
  it("enrolls an authenticator, checks a code, and moves the session to level 2", async () => {
    sb.add("m@example.com", "correct horse battery");
    const t = await signInWithPassword("m@example.com", "correct horse battery");
    const e = await enrollTotp(t.accessToken, "Phone");
    expect(e.secret).toBe("JBSWY3DPEHPK3PXP");
    expect(e.uri).toMatch(/^otpauth:\/\//);
    await fails(verifyTotp(t.accessToken, e.factorId, "000000"), "INVALID_CODE");
    await fails(verifyTotp(t.accessToken, e.factorId, "12ab"), "INVALID_CODE");
    const t2 = await verifyTotp(t.accessToken, e.factorId, "654321");
    expect(t2.aal).toBe("aal2");
    expect((await getUserFromToken(t2.accessToken))?.factors).toEqual([expect.objectContaining({ status: "verified" })]);
  });
});

describe("making an account for a person who proved their email", () => {
  it("sends a code, accepts it once, and gives a session", async () => {
    await sendEmailCode("New@Example.com");
    await fails(verifyEmailCode("new@example.com", "111111"), "INVALID_CODE");
    const t = await verifyEmailCode("new@example.com", "123456");
    expect(t.email).toBe("new@example.com");
    await fails(verifyEmailCode("new@example.com", "123456"), "INVALID_CODE");
  });
});

describe("joining a store from an invite", () => {
  async function invited(email: string) {
    const f = await store("inv");
    const inv = await inviteStaff(f.tenantId, actor(f.tenantId), { email, role: "STORE_MANAGER" });
    return { f, token: inv.token };
  }

  it("creates a confirmed account with the chosen password and ties it to the new staff row", async () => {
    const { f, token } = await invited("joiner@example.com");
    await acceptInvite(token, { name: "Joiner", password: "correct horse battery" });
    const u = [...sb.users.values()].find((x) => x.email === "joiner@example.com")!;
    expect(u.confirmed).toBe(true);
    const row = await owner.tenantUser.findFirstOrThrow({ where: { tenantId: f.tenantId, email: "joiner@example.com" } });
    expect(row.authUserId).toBe(u.id);
    expect((await signInWithPassword("joiner@example.com", "correct horse battery")).userId).toBe(u.id);
  });

  it("refuses a weak password with a message for the password field, and uses up nothing", async () => {
    const { token } = await invited("weak@example.com");
    const e = await acceptInvite(token, { name: "Weak", password: "short" }).then(() => null, (x) => x);
    expect(e.message).toMatch(/at least 10/);
    expect(e.details?.field).toBe("password");
    await acceptInvite(token, { name: "Weak", password: "correct horse battery" });
  });

  it("makes someone who already has an account prove it with that account's password, and never replaces it", async () => {
    const existing = sb.add("both@example.com", "their own long password");
    const { token } = await invited("both@example.com");
    const e = await acceptInvite(token, { name: "Both", password: "an attacker chosen password" }).then(() => null, (x) => x);
    expect(e.message).toMatch(/already an account/);
    expect(existing.password).toBe("their own long password");
    await acceptInvite(token, { name: "Both", password: "their own long password" });
    expect([...sb.users.values()].filter((x) => x.email === "both@example.com")).toHaveLength(1);
  });

  it("does not leave a new account behind when the invite was taken by someone else", async () => {
    const { token } = await invited("race@example.com");
    const results = await Promise.allSettled([1, 2, 3].map(() => acceptInvite(token, { name: "Racer", password: "correct horse battery" })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect([...sb.users.values()].filter((x) => x.email === "race@example.com").length).toBeLessThanOrEqual(1);
  });

  it("still works without a password (the development path), leaving the row to be tied at first sign-in", async () => {
    const { f, token } = await invited("legacy@example.com");
    await acceptInvite(token, { name: "Legacy" });
    expect((await owner.tenantUser.findFirstOrThrow({ where: { tenantId: f.tenantId, email: "legacy@example.com" } })).authUserId).toBeNull();
    expect(sb.users.size).toBe(0);
  });
});

describe("making accounts", () => {
  it("refuses a duplicate email and a weak password", async () => {
    await adminCreateUser("dup@example.com", "correct horse battery", { confirmed: true });
    await fails(adminCreateUser("DUP@example.com", "another long password", { confirmed: true }), "EXISTS");
    await fails(adminCreateUser("x@example.com", "short", { confirmed: true }), "WEAK_PASSWORD");
  });
});
