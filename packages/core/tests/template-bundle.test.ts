import { describe, expect, it } from "vitest";
import { BUSINESS_TEMPLATES, STORE_THEMES, ValidationError, defaultPageFor, exportTemplateBundle, parseTemplateBundle, STORE_PAGE_KINDS } from "../src";

const storeFile = (over: Record<string, unknown> = {}) => JSON.stringify({
  format: "biztrack-template", formatVersion: 1, id: "eid-kapor", name: "Eid Kapor", baseLook: "kapor",
  settings: STORE_THEMES[0]!.defaults, pages: { home: defaultPageFor("home") }, ...over,
});

describe("template file", () => {
  it("reads a store template and fills the defaults", () => {
    const b = parseTemplateBundle(storeFile());
    expect(b).toMatchObject({ id: "eid-kapor", siteMode: "ECOMMERCE", category: "other", tags: [], chrome: null, customPages: [] });
    expect(b.pages.home?.sections.length).toBeGreaterThan(0);
  });

  it("round-trips a built-in business template through export and parse", () => {
    const t = BUSINESS_TEMPLATES[0]!;
    const file = exportTemplateBundle({
      id: t.id, name: t.name, blurb: t.blurb, audience: t.audience, category: "other", tags: t.tags.slice(0, 4), moduleLabel: null, baseLook: t.baseLook,
      siteMode: t.siteMode, vertical: t.vertical, previews: { desktop: "https://example.com/d.webp" }, settings: t.settings,
      pages: Object.fromEntries(STORE_PAGE_KINDS.map((k) => [k, t.pages[k] ?? defaultPageFor(k)])), chrome: t.chrome, customPages: t.customPages,
    });
    const b = parseTemplateBundle(file);
    expect(b.siteMode).toBe(t.siteMode);
    expect(b.vertical).toBe(t.vertical);
    expect(b.customPages.map((c) => c.slug)).toEqual(t.customPages.map((c) => c.slug));
    expect(b.previews.desktop).toBe("https://example.com/d.webp");
  });

  it.each([
    ["not JSON", "{oops", /not valid JSON/],
    ["wrong format", storeFile({ format: "other" }), /format/],
    ["bad id", storeFile({ id: "Eid Kapor!" }), /id/],
    ["unknown look", storeFile({ baseLook: "nope" }), /baseLook/],
    ["no home page", storeFile({ pages: {} }), /pages\.home/],
    ["unknown page kind", storeFile({ pages: { home: defaultPageFor("home"), blog: {} } }), /pages\.blog/],
    ["bad colour", storeFile({ settings: { ...STORE_THEMES[0]!.defaults, accent: "javascript:1" } }), /settings/],
    ["http preview", storeFile({ previews: { desktop: "http://example.com/a.png" } }), /https/],
    ["business without vertical", storeFile({ siteMode: "PORTFOLIO" }), /vertical/],
    ["store with vertical", storeFile({ vertical: "RESTAURANT" }), /vertical/],
    ["bad section", storeFile({ pages: { home: { sections: [{ id: "a", type: "nope", settings: {} }] } } }), /pages\.home/],
  ])("rejects %s", (_n, text, re) => {
    expect(() => parseTemplateBundle(text)).toThrow(ValidationError);
    expect(() => parseTemplateBundle(text)).toThrow(re);
  });

  it("rejects a file over 1 MB", () => {
    expect(() => parseTemplateBundle(" ".repeat(1_000_001))).toThrow(/too large/);
  });
});
