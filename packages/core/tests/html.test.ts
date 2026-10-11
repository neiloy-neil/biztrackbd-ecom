import { describe, expect, it } from "vitest";
import { sanitizeProductHtml } from "../src";

describe("sanitizeProductHtml", () => {
  it("keeps ordinary formatting", () => {
    const html = "<p>Soft <strong>handloom</strong> cotton.</p><ul><li>Machine washable</li></ul><h3>Care</h3>";
    expect(sanitizeProductHtml(html)).toBe(html);
  });

  it("removes scripts, handlers, styles and dangerous containers but keeps harmless text", () => {
    const out = sanitizeProductHtml(
      `<p onclick="steal()">Hi</p><script>alert(1)</script><style>body{display:none}</style><iframe src="https://evil.test"></iframe>` +
        `<svg onload="x()"><circle/></svg><object data="x"></object><form action="https://evil.test"><input name="card"></form><p style="position:fixed">Big</p>`,
    );
    expect(out).not.toMatch(/script|onclick|onload|style|iframe|svg|object|form|input|alert|steal/i);
    expect(out).toContain("Hi");
    expect(out).toContain("Big");
  });

  it("blocks javascript:, data: and protocol-relative URLs", () => {
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "//evil.test/x", "vbscript:x"]) {
      const out = sanitizeProductHtml(`<a href="${bad}">link</a>`);
      expect(out, bad).not.toMatch(/href=/);
      expect(out).toContain("link");
    }
    expect(sanitizeProductHtml('<a href="https://shop.test/size">size</a>')).toContain('href="https://shop.test/size"');
    expect(sanitizeProductHtml('<a href="tel:01712345678">call</a>')).toContain("tel:01712345678");
  });

  it("makes links safe to follow", () => {
    const out = sanitizeProductHtml('<a href="https://x.test" target="_blank">x</a>');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('target="_blank"');
  });

  it("only allows https images, lazily loaded", () => {
    expect(sanitizeProductHtml('<img src="https://cdn.test/a.webp" alt="a" onerror="x()">')).toBe('<img src="https://cdn.test/a.webp" alt="a" loading="lazy" />');
    expect(sanitizeProductHtml('<img src="http://cdn.test/a.webp">')).not.toContain("src=");
    expect(sanitizeProductHtml('<img src="javascript:alert(1)">')).not.toContain("src=");
    expect(sanitizeProductHtml('<img src="data:image/svg+xml,<svg onload=alert(1)>">')).not.toContain("src=");
  });

  it("copes with broken markup, empty input and huge input", () => {
    expect(sanitizeProductHtml(null)).toBe("");
    expect(sanitizeProductHtml("")).toBe("");
    expect(sanitizeProductHtml("<p>unclosed <b>bold")).toBe("<p>unclosed <b>bold</b></p>");
    expect(sanitizeProductHtml("<<script>script>alert(1)<</script>/script>")).not.toMatch(/<script/i);
    expect(sanitizeProductHtml("x".repeat(500_000)).length).toBeLessThanOrEqual(100_000);
  });
});
