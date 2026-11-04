import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ValidationError } from "../src/errors";
import { resolvePinned, safeFetch, type Resolver } from "../src/net/pinned-fetch";

// A real HTTP server on 127.0.0.1 stands in for "the public address the check approved". Real loopback is blocked by the default guard, so
// these tests pass their own predicate: only 127.0.0.1 counts as public. Hostnames below do not exist in DNS, so any second
// resolution by the connection itself would fail with ENOTFOUND instead of reaching the server.
const PUBLIC = "127.0.0.1";
const allowed = (a: string) => a === PUBLIC;

let server: http.Server;
let port: number;
const seen: { host?: string; url?: string; body: string }[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ host: req.headers.host, url: req.url, body });
      if (req.url === "/redirect-internal") { res.writeHead(302, { location: "http://evil.example.test:" + port + "/secret" }); res.end(); return; }
      if (req.url === "/redirect-ok") { res.writeHead(302, { location: "/final" }); res.end(); return; }
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("hello " + req.url);
    });
  });
  await new Promise<void>((r) => server.listen(0, PUBLIC, r));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const fixed = (address = PUBLIC): Resolver => async () => [{ address, family: 4 }];
const opts = (resolve: Resolver, extra = {}) => ({ allowPrivate: false, resolve, isAddressAllowed: allowed, ...extra });

describe("safeFetch", () => {
  it("connects to the checked address and keeps the hostname in the Host header", async () => {
    const resolve = vi.fn(fixed());
    const res = await safeFetch(`http://shop.example.test:${port}/hook?x=1`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"a":1}' }, opts(resolve));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("hello /hook?x=1");
    expect(resolve).toHaveBeenCalledTimes(1);
    const last = seen.at(-1)!;
    expect(last.host).toBe(`shop.example.test:${port}`);
    expect(last.body).toBe('{"a":1}');
  });

  it("defeats DNS rebinding: the resolver answers differently on a second call, but there is no second call", async () => {
    // First answer is the approved address; any later answer is an internal address the attacker wants us to reach.
    const resolve = vi.fn<Resolver>()
      .mockResolvedValueOnce([{ address: PUBLIC, family: 4 }])
      .mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);
    const before = seen.length;
    const res = await safeFetch(`http://rebind.example.test:${port}/ok`, {}, opts(resolve));
    expect(res.status).toBe(200);
    expect(resolve).toHaveBeenCalledTimes(1); // resolved once, and the connection did not resolve the name again
    expect(seen.length).toBe(before + 1);
  });

  it("refuses when the one answer is internal, and never connects", async () => {
    const before = seen.length;
    await expect(safeFetch(`http://internal.example.test:${port}/`, {}, opts(fixed("169.254.169.254")))).rejects.toBeInstanceOf(ValidationError);
    await expect(safeFetch(`http://internal.example.test:${port}/`, {}, { allowPrivate: false, resolve: fixed("10.0.0.5") })).rejects.toBeInstanceOf(ValidationError);
    expect(seen.length).toBe(before);
  });

  it("refuses when ANY of several answers is internal (multi-record rebinding)", async () => {
    const resolve: Resolver = async () => [{ address: PUBLIC, family: 4 }, { address: "10.0.0.5", family: 4 }];
    await expect(safeFetch(`http://mixed.example.test:${port}/`, {}, opts(resolve))).rejects.toThrow(/public address/);
  });

  it("refuses a hostname that does not resolve", async () => {
    const resolve: Resolver = async () => { throw new Error("ENOTFOUND"); };
    await expect(safeFetch(`http://gone.example.test:${port}/`, {}, opts(resolve))).rejects.toThrow(/could not be resolved/);
  });

  it("does not follow redirects by default; the 3xx is returned", async () => {
    const before = seen.length;
    const res = await safeFetch(`http://shop.example.test:${port}/redirect-internal`, {}, opts(fixed()));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("evil.example.test");
    expect(seen.length).toBe(before + 1);
  });

  it("when following redirects, checks and pins each target (an internal target is refused)", async () => {
    const resolve = vi.fn<Resolver>(async (host) => [{ address: host === "evil.example.test" ? "169.254.169.254" : PUBLIC, family: 4 }]);
    const before = seen.length;
    await expect(safeFetch(`http://shop.example.test:${port}/redirect-internal`, {}, opts(resolve, { maxRedirects: 3 }))).rejects.toThrow(/public address/);
    expect(resolve.mock.calls.map((c) => c[0])).toEqual(["shop.example.test", "evil.example.test"]);
    expect(seen.length).toBe(before + 1); // the first hop only; the internal target was never contacted
  });

  it("follows a safe redirect to the final page", async () => {
    const res = await safeFetch(`http://shop.example.test:${port}/redirect-ok`, {}, opts(fixed(), { maxRedirects: 2 }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("hello /final");
  });

  it("does not follow redirects for a POST even when allowed", async () => {
    const res = await safeFetch(`http://shop.example.test:${port}/redirect-ok`, { method: "POST", body: "{}" }, opts(fixed(), { maxRedirects: 2 }));
    expect(res.status).toBe(302);
  });

  it("honours the abort signal", async () => {
    const ctl = new AbortController();
    ctl.abort();
    await expect(safeFetch(`http://shop.example.test:${port}/`, { signal: ctl.signal }, opts(fixed()))).rejects.toThrow();
  });

  it("outside production (allowPrivate) it is a plain fetch with redirects off", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("x"));
    await safeFetch("http://localhost:9/x", { method: "POST" }, { allowPrivate: true });
    expect(spy).toHaveBeenCalledWith("http://localhost:9/x", expect.objectContaining({ redirect: "manual" }));
    spy.mockRestore();
  });
});

describe("resolvePinned", () => {
  it("accepts a public IP literal without resolving and refuses a private one", async () => {
    const resolve = vi.fn<Resolver>();
    expect((await resolvePinned("93.184.216.34", { resolve })).address).toBe("93.184.216.34");
    await expect(resolvePinned("169.254.169.254", { resolve })).rejects.toBeInstanceOf(ValidationError);
    await expect(resolvePinned("[::1]", { resolve })).rejects.toBeInstanceOf(ValidationError);
    expect(resolve).not.toHaveBeenCalled();
  });
});
