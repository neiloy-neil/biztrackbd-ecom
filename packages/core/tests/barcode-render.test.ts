import { describe, expect, it } from "vitest";
import { renderCode128Svg } from "../src";

describe("barcode label text", () => {
  it("never puts markup from the value into the SVG", () => {
    const svg = renderCode128Svg('<img src=x onerror=alert(1)>"&');
    expect(svg).not.toMatch(/<img/i);
    expect(svg).toContain("&lt;IMG");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&quot;");
  });

  it("still draws a normal value as text", () => {
    expect(renderCode128Svg("ab-123")).toContain(">AB-123</text>");
  });
});
