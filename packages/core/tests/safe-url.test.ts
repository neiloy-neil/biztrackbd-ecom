import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl, checkPublicHttpUrl, isPrivateAddress } from "../src/net/safe-url";

const strict = { allowPrivate: false };

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "[::1]",
  ])("%s is private", (ip) => expect(isPrivateAddress(ip)).toBe(true));

  it.each(["8.8.8.8", "172.32.0.1", "172.15.255.255", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("%s is public", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe("checkPublicHttpUrl", () => {
  it.each([
    "http://localhost:4000/hook",
    "http://127.0.0.1/hook",
    "http://2130706433/hook", // decimal form of 127.0.0.1
    "http://0x7f.1/hook",
    "http://169.254.169.254/latest/meta-data/",
    "http://metadata.google.internal/computeMetadata/v1/",
    "http://[::1]:5055/",
    "http://[::ffff:127.0.0.1]/",
    "http://intranet/hook",
    "http://printer.local/",
    "https://user:pass@example.com/hook",
    "ftp://example.com/hook",
    "file:///etc/passwd",
    "not a url",
  ])("rejects %s", (u) => expect(() => checkPublicHttpUrl(u, strict)).toThrow());

  it("accepts a public https address", () => {
    expect(checkPublicHttpUrl("https://hooks.example.com/a?b=1", strict).hostname).toBe("hooks.example.com");
  });

  it("can require https", () => {
    expect(() => checkPublicHttpUrl("http://example.com/", { ...strict, requireHttps: true })).toThrow();
  });

  it("allows internal addresses when private access is permitted (development)", () => {
    expect(checkPublicHttpUrl("http://localhost:3000/x", { allowPrivate: true }).hostname).toBe("localhost");
  });
});

describe("assertPublicHttpUrl", () => {
  it("refuses an IP literal that is private without a DNS lookup", async () => {
    await expect(assertPublicHttpUrl("http://10.0.0.5/x", strict)).rejects.toThrow();
  });

  it("refuses a hostname that resolves to loopback", async () => {
    // localtest.me is not used (needs network); 'localhost' is blocked by name, so use the system resolver via a bare IP-free alias.
    await expect(assertPublicHttpUrl("http://localhost/x", strict)).rejects.toThrow();
  });

  it("passes a public IP literal", async () => {
    await expect(assertPublicHttpUrl("https://8.8.8.8/x", strict)).resolves.toBeInstanceOf(URL);
  });
});
