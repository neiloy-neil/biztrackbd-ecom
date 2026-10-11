import { describe, expect, it, vi } from "vitest";
import {
  CachedDirectory, EdgeSyncError, HEADERS, chainDirectories, classifyHost, decideRoute, edgeConfigDirectory, normalizeHost,
  pushRoutes, validateCustomDomain, validateSubdomain, type HostDirectory, type HostEntry,
} from "../src";

const ROOT = "biztrackbd.com";

const entry = (over: Partial<HostEntry> = {}): HostEntry => ({
  tenantId: "tenant-12345678", subdomain: "rongdhonu", themeId: "kapor", locale: "bn-BD", status: "ACTIVE",
  matched: "subdomain", primaryDomain: null, redirectWww: true, ...over,
});

const decide = (host: string | null, e: HostEntry | null, path = "/", search = "") =>
  decideRoute({ host, path, search, rootDomain: ROOT, protocol: "https", entry: e });

describe("normalizeHost", () => {
  it("lowercases and strips one port and one trailing dot", () => {
    expect(normalizeHost("RongDhonu.BizTrackBD.com:3000")).toBe("rongdhonu.biztrackbd.com");
    expect(normalizeHost("shop.com.")).toBe("shop.com");
    expect(normalizeHost("  shop.com  ")).toBe("shop.com");
  });

  it("rejects everything that is not a plain DNS name", () => {
    for (const bad of ["", null, undefined, "127.0.0.1", "[::1]:3000", "a b.com", "a_b.com", "a..com", ".com", "-a.com", "a-.com",
      "münchen.de", "a.com/path", "a.com?x=1", "a@b.com", "x".repeat(64) + ".com", ("a.".repeat(130)) + "com", "a.com\r\nX-Evil: 1", "a.com:99999999"]) {
      expect(normalizeHost(bad as string), String(bad)).toBeNull();
    }
  });

  it("accepts punycode labels and numeric labels in names", () => {
    expect(normalizeHost("xn--mnchen-3ya.de")).toBe("xn--mnchen-3ya.de");
    expect(normalizeHost("123shop.com")).toBe("123shop.com");
  });
});

describe("classifyHost", () => {
  it("recognises the platform site", () => {
    expect(classifyHost("biztrackbd.com", ROOT)).toEqual({ kind: "root" });
    expect(classifyHost("WWW.biztrackbd.com:443", ROOT)).toEqual({ kind: "root" });
  });

  it("recognises a store subdomain, with a dev port on both sides", () => {
    expect(classifyHost("rongdhonu.biztrackbd.com", ROOT)).toEqual({ kind: "subdomain", label: "rongdhonu" });
    expect(classifyHost("rongdhonu.localhost:3000", "localhost:3000")).toEqual({ kind: "subdomain", label: "rongdhonu" });
  });

  it("does not treat nested names or look-alikes as stores", () => {
    expect(classifyHost("rongdhonu.evil.biztrackbd.com", ROOT).kind).toBe("invalid");
    expect(classifyHost("a.b.c.biztrackbd.com", ROOT).kind).toBe("invalid");
    expect(classifyHost("rongdhonu.biztrackbd.com.evil.com", ROOT)).toEqual({ kind: "custom", host: "rongdhonu.biztrackbd.com.evil.com" });
    expect(classifyHost("evilbiztrackbd.com", ROOT)).toEqual({ kind: "custom", host: "evilbiztrackbd.com" });
  });

  it("blocks reserved labels", () => {
    for (const l of ["admin", "api", "www", "app", "mail", "checkout"]) {
      expect(classifyHost(l === "www" ? `www.x.${ROOT}` : `${l}.${ROOT}`, ROOT).kind).toBe(l === "www" ? "invalid" : "reserved");
    }
  });

  it("treats other names as custom domains and bad input as invalid", () => {
    expect(classifyHost("rongdhonufashion.com", ROOT)).toEqual({ kind: "custom", host: "rongdhonufashion.com" });
    expect(classifyHost("", ROOT).kind).toBe("invalid");
    expect(classifyHost("127.0.0.1", ROOT).kind).toBe("invalid");
    expect(classifyHost("a.com", "").kind).toBe("invalid");
  });
});

describe("validateSubdomain", () => {
  it("accepts good names and rejects reserved, short, long and malformed ones", () => {
    expect(validateSubdomain(" Rongdhonu ")).toEqual({ ok: true, label: "rongdhonu" });
    expect(validateSubdomain("my-shop-2")).toMatchObject({ ok: true });
    expect(validateSubdomain("ab")).toEqual({ ok: false, reason: "too_short" });
    expect(validateSubdomain("a".repeat(41))).toEqual({ ok: false, reason: "too_long" });
    expect(validateSubdomain("admin")).toEqual({ ok: false, reason: "reserved" });
    for (const bad of ["-shop", "shop-", "my shop", "my_shop", "shop.com", "sh--op", "দোকান"]) expect(validateSubdomain(bad), bad).toMatchObject({ ok: false });
  });
});

describe("validateCustomDomain", () => {
  it("normalises what people paste", () => {
    expect(validateCustomDomain("https://www.RongdhonuFashion.com/shop?x=1", ROOT)).toEqual({ ok: true, domain: "rongdhonufashion.com" });
    expect(validateCustomDomain("shop.com.bd", ROOT)).toEqual({ ok: true, domain: "shop.com.bd" });
    expect(validateCustomDomain("shop.example.co", ROOT)).toEqual({ ok: true, domain: "shop.example.co" });
  });

  it("rejects platform addresses, bare words, IPs and junk", () => {
    expect(validateCustomDomain("biztrackbd.com", ROOT)).toEqual({ ok: false, reason: "platform_domain" });
    expect(validateCustomDomain("evil.biztrackbd.com", ROOT)).toEqual({ ok: false, reason: "platform_domain" });
    expect(validateCustomDomain("www.biztrackbd.com", ROOT)).toEqual({ ok: false, reason: "platform_domain" });
    expect(validateCustomDomain("localhost", ROOT)).toEqual({ ok: false, reason: "needs_tld" });
    expect(validateCustomDomain("shop", ROOT)).toEqual({ ok: false, reason: "needs_tld" });
    expect(validateCustomDomain("10.0.0.1", ROOT)).toEqual({ ok: false, reason: "invalid" });
    expect(validateCustomDomain("shop.123", ROOT)).toEqual({ ok: false, reason: "invalid" });
    expect(validateCustomDomain("bad domain.com", ROOT)).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("decideRoute", () => {
  it("sends the platform host to the marketing site", () => {
    expect(decide("biztrackbd.com", null)).toEqual({ action: "marketing" });
    expect(decide("www.biztrackbd.com", null)).toEqual({ action: "marketing" });
  });

  it("404s unknown, reserved, nested and malformed hosts, and never serves a default store", () => {
    expect(decide("nobody.biztrackbd.com", null).action).toBe("not_found");
    expect(decide("admin.biztrackbd.com", entry()).action).toBe("not_found");
    expect(decide("rongdhonu.evil.biztrackbd.com", entry()).action).toBe("not_found");
    expect(decide(null, entry()).action).toBe("not_found");
    expect(decide("127.0.0.1", entry()).action).toBe("not_found");
    expect(decide("unknown-shop.com", null).action).toBe("not_found");
  });

  it("serves an active store with trusted context headers", () => {
    const d = decide("rongdhonu.biztrackbd.com", entry());
    expect(d).toEqual({
      action: "serve",
      headers: {
        [HEADERS.tenantId]: "tenant-12345678", [HEADERS.subdomain]: "rongdhonu", [HEADERS.theme]: "kapor",
        [HEADERS.locale]: "bn-BD", [HEADERS.status]: "ACTIVE", [HEADERS.route]: "store",
      },
    });
  });

  it("keeps serving trial and past-due stores, and takes suspended and cancelled ones offline", () => {
    expect(decide("rongdhonu.biztrackbd.com", entry({ status: "TRIAL" })).action).toBe("serve");
    expect(decide("rongdhonu.biztrackbd.com", entry({ status: "PAST_DUE" })).action).toBe("serve");
    for (const status of ["SUSPENDED", "CANCELLED"] as const) {
      const d = decide("rongdhonu.biztrackbd.com", entry({ status }));
      expect(d.action).toBe("offline");
      expect((d as { headers: Record<string, string> }).headers[HEADERS.route]).toBe("offline");
    }
  });

  it("redirects www to the apex with a 308, keeping path and query", () => {
    const d = decide("www.shop.com", entry({ matched: "custom_www" }), "/products/panjabi", "?color=white&utm_source=fb");
    expect(d).toEqual({ action: "redirect", status: 308, location: "https://shop.com/products/panjabi?color=white&utm_source=fb" });
  });

  it("redirects the subdomain and secondary domains to the primary domain", () => {
    const primary = entry({ primaryDomain: "shop.com" });
    expect(decide("rongdhonu.biztrackbd.com", primary, "/cart")).toEqual({ action: "redirect", status: 308, location: "https://shop.com/cart" });
    expect(decide("other.com", { ...primary, matched: "custom" }, "/")).toEqual({ action: "redirect", status: 308, location: "https://shop.com/" });
    expect(decide("www.other.com", { ...primary, matched: "custom_www" }, "/x")).toMatchObject({ location: "https://shop.com/x" });
  });

  it("serves the primary domain itself without redirecting", () => {
    expect(decide("shop.com", entry({ matched: "custom", primaryDomain: "shop.com" })).action).toBe("serve");
  });

  it("redirect targets come from the directory only, so a hostile path or host cannot make an open redirect", () => {
    const d = decide("rongdhonu.biztrackbd.com", entry({ primaryDomain: "shop.com" }), "//evil.com/x", "");
    expect(d).toMatchObject({ action: "redirect" });
    expect(new URL((d as { location: string }).location).host).toBe("shop.com");
    const e = decide("www.shop.com", entry({ matched: "custom_www" }), "https://evil.com", "");
    expect(new URL((e as { location: string }).location).host).toBe("shop.com");
  });

  it("an offline store still honours the canonical redirect first", () => {
    expect(decide("rongdhonu.biztrackbd.com", entry({ status: "SUSPENDED", primaryDomain: "shop.com" })).action).toBe("redirect");
  });
});

describe("CachedDirectory", () => {
  const counting = (answer: (h: string) => HostEntry | null, delay = 0) => {
    const calls: string[] = [];
    const dir: HostDirectory = {
      async lookup(h) {
        calls.push(h);
        if (delay) await new Promise((r) => setTimeout(r, delay));
        return answer(h);
      },
    };
    return { dir, calls };
  };

  it("answers repeat lookups from memory until the entry expires", async () => {
    let t = 1000;
    const { dir, calls } = counting(() => entry());
    const c = new CachedDirectory(dir, { ttlMs: 15_000, now: () => t });
    await c.lookup("rongdhonu.biztrackbd.com");
    await c.lookup("RONGDHONU.biztrackbd.com:443");
    expect(calls).toHaveLength(1);
    t += 15_001;
    await c.lookup("rongdhonu.biztrackbd.com");
    expect(calls).toHaveLength(2);
  });

  it("remembers misses for a shorter time", async () => {
    let t = 0;
    const { dir, calls } = counting(() => null);
    const c = new CachedDirectory(dir, { ttlMs: 15_000, negativeTtlMs: 5_000, now: () => t });
    await c.lookup("nope.biztrackbd.com");
    await c.lookup("nope.biztrackbd.com");
    expect(calls).toHaveLength(1);
    t += 5_001;
    await c.lookup("nope.biztrackbd.com");
    expect(calls).toHaveLength(2);
  });

  it("makes one lookup for a burst of simultaneous requests", async () => {
    const { dir, calls } = counting(() => entry(), 20);
    const c = new CachedDirectory(dir);
    const results = await Promise.all(Array.from({ length: 50 }, () => c.lookup("rongdhonu.biztrackbd.com")));
    expect(calls).toHaveLength(1);
    expect(results.every((r) => r?.tenantId === "tenant-12345678")).toBe(true);
  });

  it("serves a stale entry if the source fails, but not forever, and never invents one", async () => {
    let t = 0;
    let fail = false;
    const dir: HostDirectory = { lookup: async () => { if (fail) throw new Error("db down"); return entry(); } };
    const c = new CachedDirectory(dir, { ttlMs: 1000, staleIfErrorMs: 60_000, now: () => t });
    await c.lookup("rongdhonu.biztrackbd.com");
    fail = true;
    t += 5_000;
    expect((await c.lookup("rongdhonu.biztrackbd.com"))?.subdomain).toBe("rongdhonu");
    t += 120_000;
    await expect(c.lookup("rongdhonu.biztrackbd.com")).rejects.toThrow("db down");
    await expect(c.lookup("never-seen.biztrackbd.com")).rejects.toThrow("db down");
  });

  it("can forget one host or all of them, and is bounded", async () => {
    const { dir, calls } = counting(() => entry());
    const c = new CachedDirectory(dir, { maxEntries: 3 });
    for (const h of ["a.x.com", "b.x.com", "c.x.com", "d.x.com"]) await c.lookup(h);
    expect(c.size).toBe(3);
    await c.lookup("d.x.com");
    expect(calls).toHaveLength(4);
    c.invalidate("d.x.com");
    await c.lookup("d.x.com");
    expect(calls).toHaveLength(5);
    c.invalidate();
    expect(c.size).toBe(0);
  });

  it("ignores garbage hostnames without calling the source", async () => {
    const { dir, calls } = counting(() => entry());
    expect(await new CachedDirectory(dir).lookup("bad host!")).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe("edge config directory and chain", () => {
  it("reads and validates entries, treating bad data as a miss", async () => {
    const store: Record<string, unknown> = { "domain:good.com": entry({ matched: "custom" }), "domain:bad.com": { tenantId: 5 } };
    const d = edgeConfigDirectory(async (k) => store[k]);
    expect((await d.lookup("good.com"))?.matched).toBe("custom");
    expect(await d.lookup("bad.com")).toBeNull();
    expect(await d.lookup("absent.com")).toBeNull();
  });

  it("falls through to the next directory on a miss or an error", async () => {
    const down: HostDirectory = { lookup: async () => { throw new Error("edge down"); } };
    const empty: HostDirectory = { lookup: async () => null };
    const db: HostDirectory = { lookup: async () => entry() };
    expect((await chainDirectories(down, empty, db).lookup("x.com"))?.tenantId).toBe("tenant-12345678");
    expect(await chainDirectories(empty, empty).lookup("x.com")).toBeNull();
    await expect(chainDirectories(down, down).lookup("x.com")).rejects.toThrow("edge down");
  });
});

describe("pushRoutes (Edge Config)", () => {
  const env = { EDGE_CONFIG_ID: "ecfg_abc123", VERCEL_AUTH_TOKEN: "tok-SECRET-123", VERCEL_TEAM_ID: "team_9" };

  it("does nothing when Edge Config is not configured", async () => {
    const f = vi.fn();
    expect(await pushRoutes({ upsert: { "a.com": entry() }, remove: [] }, {}, f as unknown as typeof fetch)).toEqual({ skipped: true, items: 0 });
    expect(f).not.toHaveBeenCalled();
  });

  it("sends one PATCH with upserts and deletes in Vercel's documented shape", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    const r = await pushRoutes({ upsert: { "shop.com": entry({ matched: "custom" }) }, remove: ["old.com"] }, env, f as unknown as typeof fetch);
    expect(r).toEqual({ skipped: false, items: 2 });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.vercel.com/v1/edge-config/ecfg_abc123/items?teamId=team_9");
    expect(init.method).toBe("PATCH");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-SECRET-123");
    const body = JSON.parse(init.body as string);
    expect(body.items).toEqual([
      { operation: "upsert", key: "domain:shop.com", value: expect.objectContaining({ matched: "custom" }) },
      { operation: "delete", key: "domain:old.com" },
    ]);
  });

  it("raises a clear error without leaking the token or response body", async () => {
    const f = vi.fn(async () => new Response("Bearer tok-SECRET-123 invalid", { status: 403 }));
    const err = await pushRoutes({ upsert: { "a.com": entry() }, remove: [] }, env, f as unknown as typeof fetch).then(() => null, (e) => e);
    expect(err).toBeInstanceOf(EdgeSyncError);
    expect(err.status).toBe(403);
    expect(err.message).not.toContain("SECRET");
  });

  it("skips the network call when there is nothing to send", async () => {
    const f = vi.fn();
    expect(await pushRoutes({ upsert: {}, remove: [] }, env, f as unknown as typeof fetch)).toEqual({ skipped: false, items: 0 });
    expect(f).not.toHaveBeenCalled();
  });
});
