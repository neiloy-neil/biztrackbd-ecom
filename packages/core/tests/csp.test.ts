import { describe, expect, it } from "vitest";
import { buildCspPolicy, createCsp, cspMode, generateNonce } from "../src";

const directive = (policy: string, name: string) => policy.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? "";

describe("nonce CSP", () => {
  it("has a script-src with the nonce and strict-dynamic, and no unsafe-inline for scripts", () => {
    const p = buildCspPolicy("abc123==");
    const script = directive(p, "script-src");
    expect(script).toContain("'nonce-abc123=='");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
    expect(p).toContain("object-src 'none'");
  });

  it("keeps inline styles working (the apps use inline style attributes)", () => {
    expect(directive(buildCspPolicy("n"), "style-src")).toContain("'unsafe-inline'");
  });

  it("allows unsafe-eval only in development", () => {
    expect(directive(buildCspPolicy("n", true), "script-src")).toContain("'unsafe-eval'");
    expect(directive(buildCspPolicy("n", false), "script-src")).not.toContain("'unsafe-eval'");
  });

  it("makes a different unguessable nonce each time", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });

  it("defaults to report-only and enforces only when asked", () => {
    expect(cspMode(undefined)).toBe("report-only");
    expect(cspMode("nonsense")).toBe("report-only");
    expect(cspMode("enforce")).toBe("enforce");
    expect(createCsp({ mode: "report-only" }).headerName).toBe("Content-Security-Policy-Report-Only");
    expect(createCsp({ mode: "enforce" }).headerName).toBe("Content-Security-Policy");
  });

  it("passes the same nonce to the page (request headers) and to the browser (response header)", () => {
    const csp = createCsp({ nonce: "N0nce==", mode: "enforce", dev: false });
    const req = csp.requestHeaders(new Headers({ cookie: "a=b" }));
    expect(req.get("x-nonce")).toBe("N0nce==");
    expect(req.get("content-security-policy")).toContain("'nonce-N0nce=='");
    expect(req.get("cookie")).toBe("a=b");
    const res = csp.apply({ headers: new Headers() });
    expect(res.headers.get("content-security-policy")).toBe(req.get("content-security-policy"));
  });
});
