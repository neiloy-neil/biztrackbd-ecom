import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  DomainError, SECTIONS, STORE_PAGE_KINDS, allowedOn, defaultPageFor, requiredFor, sectionsFor, STORE_THEMES, activateTheme, checkDomain, contrast, createLandingPage, createPreviewToken, defaultHomePage, defaultLandingPage, deleteLandingPage, discardDraft, dnsInstruction, getLive, getPreview,
  getBuilderAccess, getPublicLanding, listLandingPages, listVersions, loadForEdit, loadPageData, newSection, normalizeSettings, placeLandingOrder, publish, recheckDomain, rollback, safeImage, safeUrl,
  saveDraft, saveThemeDraft, sectionDef, setDnsResolver, setEventPublisher, setLandingLive, setRoutingSync, setVercelClient, sweepDomains, themeCss, validatePage, validateTheme,
  verifyPreviewToken, updateLandingOffers, landingSlugByCode, editableField, setByPath, getByPath, LANDING_TEMPLATES, landingStats, landingTotals, listLandingLeads, deleteLandingLead, recordLandingView, saveLandingLead, landingTemplate, pageFromTemplate, youtubeId, parseEndsAt, parseOffers, dealDiscount, type DnsResolver, type StaffActor, type VercelDomainClient,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

async function store(name: string, tier: "STARTER" | "PRO" | "BUSINESS" = "PRO") {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 50 });
  await owner.tenant.update({ where: { id: f.tenantId }, data: { planTier: tier } });
  await owner.storeSettings.create({ data: { tenantId: f.tenantId, storeName: name, contactPhone: "01712345678" } });
  const mk = (role: StaffActor["role"], n: string): StaffActor => ({ userId: `u-${n}-${seq}`, email: `${n}${seq}@example.test`, name: n, role });
  return { f, owner: mk("STORE_OWNER", "Nusrat"), content: mk("CONTENT_EDITOR", "Cora"), packer: mk("ORDER_PACKER", "Rubel") };
}
const fails = async (p: Promise<unknown>, code?: string, msg?: RegExp) => {
  const e = await p.then(() => null, (x) => x);
  expect(e).toBeInstanceOf(DomainError);
  if (code) expect((e as DomainError).code).toBe(code);
  if (msg) expect((e as DomainError).message).toMatch(msg);
};

beforeAll(async () => {
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "bt.test";
  process.env.PLATFORM_A_RECORD = "203.0.113.10";
  process.env.PLATFORM_CNAME_TARGET = "cname.bt.test";
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  await seedPlans(owner);
});
beforeEach(() => {
  setEventPublisher(async () => {});
  setRoutingSync(async () => {});
  setDnsResolver(null);
  setVercelClient(null);
});
afterAll(async () => {
  await app.$disconnect();
  await owner.$disconnect();
});

describe("section settings", () => {
  it("every section starts valid with its own defaults", () => {
    for (const d of SECTIONS) expect(() => normalizeSettings(d, {}), d.type).not.toThrow();
    expect(() => validatePage("home", defaultHomePage())).not.toThrow();
    expect(() => validatePage("landing", defaultLandingPage())).not.toThrow();
  });

  it("strips markup from text and trims to the limit", () => {
    const s = normalizeSettings(sectionDef("hero")!, { title: "<script>alert(1)</script>Eid <b>sale</b>" });
    expect(s.title).toBe("alert(1)Eid sale");
    expect(String(normalizeSettings(sectionDef("hero")!, { title: "x".repeat(500) }).title)).toHaveLength(100);
  });

  it("allows https and store links only, never javascript: or data:", () => {
    expect(safeUrl("/search?sale=1")).toBe(true);
    expect(safeUrl("https://example.com/a")).toBe(true);
    expect(safeUrl("")).toBe(true);
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "//evil.example", "http://example.com", "ftp://x.y"]) expect(safeUrl(bad), bad).toBe(false);
    expect(() => normalizeSettings(sectionDef("hero")!, { ctaLink: "javascript:alert(1)" })).toThrow(DomainError);
  });

  it("allows pictures from the store's own uploads or https only", () => {
    expect(safeImage("/media/t1/a.webp")).toBe(true);
    expect(safeImage("https://cdn.example.com/a.jpg")).toBe(true);
    expect(safeImage("javascript:x")).toBe(false);
    expect(safeImage("/media/../etc/passwd")).toBe(false);
    expect(safeImage("/media/a b")).toBe(false);
  });

  it("refuses numbers out of range, unknown choices and bad colours with a plain message", () => {
    expect(() => normalizeSettings(sectionDef("featured-products")!, { limit: 99 })).toThrow(/from 2 to 12/);
    expect(() => normalizeSettings(sectionDef("featured-products")!, { source: "everything" })).toThrow(/choices/);
    expect(() => normalizeSettings(sectionDef("announcement-bar")!, { bgColor: "red" })).toThrow(/colour/);
  });

  it("enforces list sizes", () => {
    const def = sectionDef("lp-benefits")!;
    expect(() => normalizeSettings(def, { items: [] })).toThrow(/at least 1/);
    expect(() => normalizeSettings(def, { items: Array.from({ length: 9 }, () => ({ title: "a", text: "b" })) })).toThrow(/at most 8/);
  });

  it("rejects sections that do not belong on the page, duplicates, bad ids and too many of one kind", () => {
    const home = defaultHomePage();
    expect(() => validatePage("home", { sections: [newSection("lp-hero")] })).toThrow(/not one this page can use/);
    expect(() => validatePage("landing", { sections: [newSection("hero")] })).toThrow(/not one this page can use/);
    const dup = { sections: [home.sections[0], { ...home.sections[1], id: home.sections[0]!.id }] };
    expect(() => validatePage("home", dup)).toThrow(/share the id/);
    expect(() => validatePage("home", { sections: [{ ...home.sections[0], id: "A B" }] })).toThrow(/bad id/);
    expect(() => validatePage("home", { sections: [newSection("trust-strip"), newSection("trust-strip")] })).toThrow(/Only 1/);
    expect(() => validatePage("home", { sections: Array.from({ length: 31 }, () => newSection("rich-text")) })).toThrow(/up to 30/);
    expect(() => validatePage("home", "nope")).toThrow(DomainError);
  });

  it("drops settings the section does not define", () => {
    const s = normalizeSettings(sectionDef("rich-text")!, { heading: "Hi", body: "b", onclick: "alert(1)", __proto__: { x: 1 } });
    expect(Object.keys(s).sort()).toEqual(["body", "bodyBn", "heading", "headingBn"]);
  });
});

describe("theme settings", () => {
  it("accepts the built-in look and writes no CSS for it", () => {
    expect(themeCss(validateTheme({}))).toBe("");
  });

  it("writes only what changed, with button text picked for contrast", () => {
    const css = themeCss(validateTheme({ accent: "#0B5FFF", radius: "round" }));
    expect(css).toContain("--accent:#0B5FFF");
    expect(css).toContain("--radius:18px");
    expect(css).not.toContain("--bg");
    expect(css).toContain("--accent-ink:#FFFFFF");
    expect(themeCss(validateTheme({ accent: "#F6E05E", background: "#1A1410", text: "#FBF8F3" }))).toContain("--accent-ink:#1A1410");
  });

  it("refuses colours that cannot be read", () => {
    expect(() => validateTheme({ text: "#EEEEEE", background: "#FFFFFF" })).toThrow(/hard to read/);
    expect(() => validateTheme({ accent: "#FDFBF6" })).toThrow(/too close/);
    expect(() => validateTheme({ accent: "red" })).toThrow(/colour/);
    expect(() => validateTheme({ radius: "huge" })).toThrow(/choices/);
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
  });

  it("cannot be used to inject CSS", () => {
    expect(() => validateTheme({ accent: "#fff;} body{display:none" })).toThrow(DomainError);
  });
});

describe("drafts, publishing and rollback", () => {
  it("switches visual templates while keeping each template's drafts and history isolated", async () => {
    const s = await store("themes");
    const kapor = defaultHomePage();
    kapor.sections[0]!.settings.title = "Kapor home";
    await saveDraft(s.f.tenantId, s.owner, "home", kapor);
    await publish(s.f.tenantId, s.owner, "home");

    expect(STORE_THEMES.map((theme) => theme.id)).toEqual(["kapor", "gadgetstudio", "mini-bunny", "axionwear", "bindu", "berber"]);
    await activateTheme(s.f.tenantId, s.owner, "axionwear");
    expect(await loadForEdit(s.f.tenantId, s.owner, "home")).toMatchObject({ themeId: "axionwear", publishedVersion: null, theme: { accent: "#D7FF3F", background: "#0B0D0F" } });
    expect(await getLive(s.f.tenantId, "home")).toBeNull();

    const axion = defaultHomePage();
    axion.sections[0]!.settings.title = "Axion home";
    await saveDraft(s.f.tenantId, s.owner, "home", axion);
    await publish(s.f.tenantId, s.owner, "home");
    expect((await getLive(s.f.tenantId, "home"))!).toMatchObject({ themeId: "axionwear", version: 1 });

    await activateTheme(s.f.tenantId, s.owner, "kapor");
    expect((await getLive(s.f.tenantId, "home"))!.page.sections[0]!.settings.title).toBe("Kapor home");
    await fails(activateTheme(s.f.tenantId, s.packer, "bindu"), "FORBIDDEN");
    await fails(activateTheme(s.f.tenantId, s.owner, "unknown"), "VALIDATION_ERROR");
  });

  it("a store that never published has no live layout, and editing starts from the built-in sections", async () => {
    const s = await store("ver1");
    expect(await getLive(s.f.tenantId, "home")).toBeNull();
    const st = await loadForEdit(s.f.tenantId, s.owner, "home");
    expect(st).toMatchObject({ isDraft: false, publishedVersion: null, unpublished: false });
    expect(st.page.sections.map((x) => x.type)).toEqual(["hero", "featured-products", "category-grid", "trust-strip"]);
  });

  it("saving a draft changes the preview but not the live store", async () => {
    const s = await store("ver2");
    const page = defaultHomePage();
    await publish(s.f.tenantId, s.owner, "home").catch(() => null);
    await saveDraft(s.f.tenantId, s.owner, "home", page);
    expect(await publish(s.f.tenantId, s.owner, "home")).toBe(1);
    const edited = structuredClone(page);
    edited.sections[0]!.settings.title = "Fresh headline";
    await saveDraft(s.f.tenantId, s.owner, "home", edited);
    expect((await getLive(s.f.tenantId, "home"))!.page.sections[0]!.settings.title).not.toBe("Fresh headline");
    expect((await getPreview(s.f.tenantId, "home")).page.sections[0]!.settings.title).toBe("Fresh headline");
    expect(await loadForEdit(s.f.tenantId, s.owner, "home")).toMatchObject({ isDraft: true, unpublished: true, publishedVersion: 1 });
  });

  it("publishing numbers the versions and discards the draft", async () => {
    const s = await store("ver3");
    const page = defaultHomePage();
    await saveDraft(s.f.tenantId, s.owner, "home", page);
    expect(await publish(s.f.tenantId, s.owner, "home", "First")).toBe(1);
    page.sections[0]!.settings.title = "Second";
    await saveDraft(s.f.tenantId, s.owner, "home", page);
    expect(await publish(s.f.tenantId, s.owner, "home")).toBe(2);
    expect((await getLive(s.f.tenantId, "home"))!.version).toBe(2);
    expect(await owner.themeVersion.count({ where: { tenantId: s.f.tenantId, state: "DRAFT" } })).toBe(0);
    const vs = await listVersions(s.f.tenantId, s.owner, "home");
    expect(vs.map((v) => [v.version, v.isLive])).toEqual([[2, true], [1, false]]);
    expect(vs[1]!.label).toBe("First");
    await fails(publish(s.f.tenantId, s.owner, "home"), undefined, /nothing to publish/);
  });

  it("rolling back copies an old version forward and keeps history", async () => {
    const s = await store("ver4");
    const page = defaultHomePage();
    for (const t of ["One", "Two", "Three"]) {
      page.sections[0]!.settings.title = t;
      await saveDraft(s.f.tenantId, s.owner, "home", page);
      await publish(s.f.tenantId, s.owner, "home");
    }
    expect(await rollback(s.f.tenantId, s.owner, "home", 1)).toBe(4);
    const live = await getLive(s.f.tenantId, "home");
    expect(live!.version).toBe(4);
    expect(live!.page.sections[0]!.settings.title).toBe("One");
    expect((await listVersions(s.f.tenantId, s.owner, "home")).map((v) => v.version)).toEqual([4, 3, 2, 1]);
    await fails(rollback(s.f.tenantId, s.owner, "home", 99), "NOT_FOUND");
    // And going back can itself be undone.
    expect(await rollback(s.f.tenantId, s.owner, "home", 3)).toBe(5);
    expect((await getLive(s.f.tenantId, "home"))!.page.sections[0]!.settings.title).toBe("Three");
  });

  it("the theme is published with the home page and kept per version", async () => {
    const s = await store("ver5");
    await saveDraft(s.f.tenantId, s.owner, "home", defaultHomePage());
    await publish(s.f.tenantId, s.owner, "home");
    await saveThemeDraft(s.f.tenantId, s.owner, { accent: "#0B5FFF" });
    expect((await getLive(s.f.tenantId, "home"))!.theme.accent).toBe("#8C5A3C");
    expect((await loadForEdit(s.f.tenantId, s.owner, "home")).unpublished).toBe(true);
    await publish(s.f.tenantId, s.owner, "home");
    expect((await getLive(s.f.tenantId, "home"))!.theme.accent).toBe("#0B5FFF");
    await rollback(s.f.tenantId, s.owner, "home", 1);
    expect((await getLive(s.f.tenantId, "home"))!.theme.accent).toBe("#8C5A3C");
  });

  it("discarding a draft returns the editor to what is live", async () => {
    const s = await store("ver6");
    await saveDraft(s.f.tenantId, s.owner, "home", defaultHomePage());
    await publish(s.f.tenantId, s.owner, "home");
    const page = defaultHomePage();
    page.sections[0]!.settings.title = "Unwanted";
    await saveDraft(s.f.tenantId, s.owner, "home", page);
    await discardDraft(s.f.tenantId, s.owner, "home");
    const st = await loadForEdit(s.f.tenantId, s.owner, "home");
    expect(st.isDraft).toBe(false);
    expect(st.page.sections[0]!.settings.title).not.toBe("Unwanted");
  });

  it("refuses an invalid page, so a draft is always publishable", async () => {
    const s = await store("ver7");
    await fails(saveDraft(s.f.tenantId, s.owner, "home", { sections: [{ id: "bad_1", type: "hero", settings: { ctaLink: "javascript:x" } }] }), "VALIDATION_ERROR");
    expect(await owner.themeVersion.count({ where: { tenantId: s.f.tenantId } })).toBe(0);
  });

  it("keeps the newest 30 versions", async () => {
    const s = await store("ver8");
    const page = defaultHomePage();
    for (let i = 0; i < 32; i++) {
      page.sections[0]!.settings.title = `v${i}`;
      await saveDraft(s.f.tenantId, s.owner, "home", page);
      await publish(s.f.tenantId, s.owner, "home");
    }
    const vs = await listVersions(s.f.tenantId, s.owner, "home");
    expect(vs).toHaveLength(30);
    expect(vs[0]!.version).toBe(32);
    expect(vs.at(-1)!.version).toBe(3);
  });

  it("follows permissions: content editors design, packers only look at nothing", async () => {
    const s = await store("ver9");
    await saveDraft(s.f.tenantId, s.content, "home", defaultHomePage());
    await publish(s.f.tenantId, s.content, "home");
    await fails(saveDraft(s.f.tenantId, s.packer, "home", defaultHomePage()), "FORBIDDEN");
    await fails(loadForEdit(s.f.tenantId, s.packer, "home"), "FORBIDDEN");
    await fails(publish(s.f.tenantId, s.packer, "home"), "FORBIDDEN");
  });

  it("one store cannot see or change another's design", async () => {
    const a = await store("isoA");
    const b = await store("isoB");
    const page = defaultHomePage();
    page.sections[0]!.settings.title = "Store A only";
    await saveDraft(a.f.tenantId, a.owner, "home", page);
    await publish(a.f.tenantId, a.owner, "home");
    expect(await getLive(b.f.tenantId, "home")).toBeNull();
    expect((await getPreview(b.f.tenantId, "home")).page.sections[0]!.settings.title).not.toBe("Store A only");
    await fails(loadForEdit(b.f.tenantId, b.owner, "landing:abcdefgh12"), "NOT_FOUND");
  });

  it("rejects page keys that are not pages", async () => {
    const s = await store("ver10");
    await fails(loadForEdit(s.f.tenantId, s.owner, "../../etc"), "VALIDATION_ERROR");
    await fails(loadForEdit(s.f.tenantId, s.owner, "products"), "VALIDATION_ERROR");
    await fails(loadForEdit(s.f.tenantId, s.owner, "landing"), "VALIDATION_ERROR");
    await fails(loadForEdit(s.f.tenantId, s.owner, "cart2"), "VALIDATION_ERROR");
  });
});

describe("live data for sections", () => {
  it("reads only what the page's grids ask for, from the database", async () => {
    const s = await store("data1");
    const page = validatePage("home", defaultHomePage());
    const data = await loadPageData(s.f.tenantId, page);
    expect(Object.keys(data.products)).toEqual(["new"]);
    expect(data.products.new!.length).toBeGreaterThan(0);
    expect(data.categories.length).toBeGreaterThanOrEqual(0);
  });

  it("loads every kind of grid for the editor preview, so edits show without another request", async () => {
    const s = await store("data2");
    const data = await loadPageData(s.f.tenantId, validatePage("home", defaultHomePage()), { everything: true });
    expect(Object.keys(data.products)).toEqual(expect.arrayContaining(["new", "sale", "featured"]));
  });

  it("ignores disabled sections", async () => {
    const s = await store("data3");
    const page = defaultHomePage();
    for (const x of page.sections) x.disabled = true;
    expect(await loadPageData(s.f.tenantId, validatePage("home", page))).toEqual({ products: {}, categories: [] });
  });
});

describe("preview tokens", () => {
  it("verify for the store they were issued to", () => {
    const t = createPreviewToken("t_abc");
    expect(verifyPreviewToken(t)).toBe("t_abc");
  });
  it("fail when tampered with, forged, expired or empty", () => {
    const t = createPreviewToken("t_abc");
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ t: "t_other", e: Date.now() + 1e6 })).toString("base64url");
    expect(verifyPreviewToken(`${forged}.${sig}`)).toBeNull();
    expect(verifyPreviewToken(`${body}.${sig}x`)).toBeNull();
    expect(verifyPreviewToken(t, Date.now() + 3 * 3600_000)).toBeNull();
    expect(verifyPreviewToken("")).toBeNull();
    expect(verifyPreviewToken(undefined)).toBeNull();
    expect(verifyPreviewToken("garbage")).toBeNull();
  });
});

describe("landing pages", () => {
  async function landingStore(name: string) {
    const s = await store(name);
    const lp = await createLandingPage(s.f.tenantId, s.owner, { title: "Eid Panjabi", productId: s.f.products[0]!.id });
    return { s, ...lp };
  }

  it("is created hidden, with a clean address, and cannot go live before it is published", async () => {
    const { s, id, pageKey } = await landingStore("lp1");
    const [row] = await listLandingPages(s.f.tenantId, s.owner);
    expect(row).toMatchObject({ slug: "eid-panjabi", isPublished: false, pageKey });
    expect(await getPublicLanding(s.f.tenantId, "eid-panjabi")).toBeNull();
    await fails(setLandingLive(s.f.tenantId, s.owner, id, true), "VALIDATION_ERROR", /Publish the page/);
  });

  it("goes live when published from the editor and can be taken down", async () => {
    const { s, id, pageKey } = await landingStore("lp2");
    await saveDraft(s.f.tenantId, s.owner, pageKey, defaultLandingPage());
    expect(await getPublicLanding(s.f.tenantId, "eid-panjabi")).toBeNull();
    await publish(s.f.tenantId, s.owner, pageKey);
    const live = await getPublicLanding(s.f.tenantId, "eid-panjabi");
    expect(live!.product.id).toBe(s.f.products[0]!.id);
    await setLandingLive(s.f.tenantId, s.owner, id, false);
    expect(await getPublicLanding(s.f.tenantId, "eid-panjabi")).toBeNull();
    await setLandingLive(s.f.tenantId, s.owner, id, true);
    expect(await getPublicLanding(s.f.tenantId, "eid-panjabi")).not.toBeNull();
  });

  it("shows the draft to a preview without making the page live", async () => {
    const { s, pageKey } = await landingStore("lp3");
    const page = defaultLandingPage();
    await saveDraft(s.f.tenantId, s.owner, pageKey, page);
    const p = await getPublicLanding(s.f.tenantId, "eid-panjabi", { page });
    expect(p).not.toBeNull();
    expect(await getPublicLanding(s.f.tenantId, "eid-panjabi")).toBeNull();
  });

  it("rejects bad addresses, duplicates and missing products", async () => {
    const { s } = await landingStore("lp4");
    await fails(createLandingPage(s.f.tenantId, s.owner, { title: "Again", slug: "eid-panjabi", productId: s.f.products[0]!.id }), "VALIDATION_ERROR", /already have/);
    await fails(createLandingPage(s.f.tenantId, s.owner, { title: "Bad", slug: "Has Spaces!", productId: s.f.products[0]!.id }), "VALIDATION_ERROR");
    await fails(createLandingPage(s.f.tenantId, s.owner, { title: "Api", slug: "api", productId: s.f.products[0]!.id }), "VALIDATION_ERROR");
    await fails(createLandingPage(s.f.tenantId, s.owner, { title: "Ghost", productId: "nope" }), "VALIDATION_ERROR", /product/);
    await fails(createLandingPage(s.f.tenantId, s.packer, { title: "Nope", productId: s.f.products[0]!.id }), "FORBIDDEN");
  });

  it("takes a cash on delivery order priced from the database and marks its channel", async () => {
    const { s, pageKey } = await landingStore("lp5");
    await saveDraft(s.f.tenantId, s.owner, pageKey, defaultLandingPage());
    await publish(s.f.tenantId, s.owner, pageKey);
    const variantId = s.f.products[0]!.variants[0]!.id;
    const o = await placeLandingOrder(s.f.tenantId, "eid-panjabi", { idempotencyKey: `lp-${Date.now()}-1`, variantId, quantity: 2, name: "Tania Akter", phone: "01712345601", address: "House 4, Road 2, Dhanmondi", district: "Dhaka", division: "Dhaka" });
    const row = await owner.order.findUniqueOrThrow({ where: { id: o.orderId } });
    expect(row).toMatchObject({ channel: "LANDING_PAGE", paymentMethod: "COD", utmSource: "landing:eid-panjabi" });
    expect(Number(row.totalAmount)).toBeGreaterThan(0);
  });

  it("will not order a variant of some other product through the page", async () => {
    const { s, pageKey } = await landingStore("lp6");
    await saveDraft(s.f.tenantId, s.owner, pageKey, defaultLandingPage());
    await publish(s.f.tenantId, s.owner, pageKey);
    const other = s.f.products[1]!.variants[0]!.id;
    await fails(placeLandingOrder(s.f.tenantId, "eid-panjabi", { idempotencyKey: `lp-${Date.now()}-2`, variantId: other, quantity: 1, name: "Tania Akter", phone: "01712345602", address: "House 4, Road 2, Dhanmondi", district: "Dhaka", division: "Dhaka" }), "VALIDATION_ERROR", /options/);
  });

  describe("editing text and pictures on the page (docs/46 stage 4)", () => {
    const hero = () => sectionDef("lp-hero")!;
    const benefits = () => sectionDef("lp-benefits")!;

    it("only lets the page change plain text fields of the section's own definition", () => {
      expect(editableField(hero(), "headline")?.type).toBe("text");
      expect(editableField(hero(), "subhead")?.type).toBe("textarea");
      expect(editableField(hero(), "headlineBn")?.bn).toBe(true);
      expect(editableField(hero(), "image")).toBeNull(); // a picture is not text
      expect(editableField(hero(), "image", ["image"])?.type).toBe("image");
      expect(editableField(hero(), "ctaLink")).toBeNull();
      expect(editableField(hero(), "nope")).toBeNull();
      expect(editableField(benefits(), "items.2.title")?.type).toBe("text");
      expect(editableField(benefits(), "items.2.nope")).toBeNull();
      expect(editableField(benefits(), "other.2.title")).toBeNull();
    });

    it("refuses paths that could reach anything else", () => {
      for (const bad of ["__proto__", "constructor", "headline.x", "items.x.title", "items.1.title.z", "items.123.title", "../x", "items..title", "", " headline"]) {
        expect(editableField(benefits(), bad), bad).toBeNull();
        expect(editableField(hero(), bad), bad).toBeNull();
      }
    });

    it("changes one value and leaves the rest alone, without touching the original", () => {
      const s = { headline: "A", items: [{ title: "x", text: "1" }, { title: "y", text: "2" }] };
      const a = setByPath(s, "headline", "B");
      expect(a.headline).toBe("B");
      expect(s.headline).toBe("A");
      const b = setByPath(s, "items.1.title", "Z");
      expect(getByPath(b, "items.1.title")).toBe("Z");
      expect(getByPath(b, "items.0.title")).toBe("x");
      expect(getByPath(s, "items.1.title")).toBe("y");
      expect(setByPath(s, "items.5.title", "Q")).toEqual(s);
    });
  });

  describe("sections and templates (docs/46 stage 2)", () => {
    it("reads a YouTube address only when it really is one, and returns just the id", () => {
      expect(youtubeId("https://www.youtube.com/watch?v=yx0ody0GGWY&t=3")).toBe("yx0ody0GGWY");
      expect(youtubeId("https://youtu.be/yx0ody0GGWY?si=abc")).toBe("yx0ody0GGWY");
      expect(youtubeId("https://youtube.com/embed/yx0ody0GGWY")).toBe("yx0ody0GGWY");
      expect(youtubeId("https://www.youtube.com/shorts/yx0ody0GGWY")).toBe("yx0ody0GGWY");
      expect(youtubeId("http://youtu.be/yx0ody0GGWY")).toBeNull();
      expect(youtubeId("https://evil.example/watch?v=yx0ody0GGWY")).toBeNull();
      expect(youtubeId("https://youtube.com.evil.example/watch?v=yx0ody0GGWY")).toBeNull();
      expect(youtubeId("https://youtu.be/short")).toBeNull();
      expect(youtubeId('https://youtu.be/yx0ody0GGWY"onload="x')).toBeNull();
      expect(youtubeId("javascript:alert(1)")).toBeNull();
    });

    it("turns an end date into Bangladesh time and refuses dates that are not real", () => {
      expect(parseEndsAt("2026-12-20 23:59")!.toISOString()).toBe("2026-12-20T17:59:00.000Z");
      expect(parseEndsAt("2026-12-20")!.toISOString()).toBe("2026-12-20T17:59:00.000Z");
      expect(parseEndsAt("2026-02-30")).toBeNull();
      expect(parseEndsAt("20-12-2026")).toBeNull();
      expect(parseEndsAt("2026-12-20 25:00")).toBeNull();
    });

    it("the video and countdown sections refuse values they cannot show", () => {
      const video = sectionDef("lp-video")!;
      expect(() => normalizeSettings(video, { videoUrl: "https://example.com/video" })).toThrow(/YouTube/);
      expect(normalizeSettings(video, { videoUrl: "" }).videoUrl).toBe("");
      expect(normalizeSettings(video, { videoUrl: "https://youtu.be/yx0ody0GGWY" }).videoUrl).toBe("https://youtu.be/yx0ody0GGWY");
      const clock = sectionDef("lp-countdown")!;
      expect(() => normalizeSettings(clock, { endsAt: "soon" })).toThrow(/date and time/);
      expect(normalizeSettings(clock, {}).endsAt).toBe("");
    });

    it("ships ten templates that all validate, with no invented customer words and a hidden countdown", () => {
      expect(LANDING_TEMPLATES).toHaveLength(10);
      expect(new Set(LANDING_TEMPLATES.map((t) => t.id)).size).toBe(10);
      for (const t of LANDING_TEMPLATES) {
        expect(() => validatePage("landing", t.page), t.id).not.toThrow();
        const types = t.page.sections.map((x) => x.type);
        expect(types, t.id).toContain("lp-order-form");
        expect(types, t.id).toContain("lp-hero");
        expect(types, t.id).not.toContain("lp-reviews");
        for (const x of t.page.sections) {
          if (x.type === "lp-countdown") expect(x.settings.endsAt).toBe("");
          if (x.type === "lp-video") expect(x.settings.videoUrl).toBe("");
        }
        // Every starting line has its Bangla twin, so a Bangla visitor never sees English by accident.
        const hero = t.page.sections.find((x) => x.type === "lp-hero")!;
        expect(String(hero.settings.headlineBn), t.id).not.toBe("");
      }
    });

    it("a page made from a template opens with that template's layout, with its own section ids", async () => {
      const s = await store("lpt1");
      const lp = await createLandingPage(s.f.tenantId, s.owner, { title: "Honey", productId: s.f.products[0]!.id, templateId: "food" });
      const state = await loadForEdit(s.f.tenantId, s.owner, lp.pageKey);
      expect(state.page.sections.map((x) => x.type)).toEqual(landingTemplate("food")!.page.sections.map((x) => x.type));
      const a = pageFromTemplate("food")!;
      const b = pageFromTemplate("food")!;
      expect(a.sections[0]!.id).not.toBe(b.sections[0]!.id);
      expect(pageFromTemplate("nope")).toBeNull();
      const plain = await createLandingPage(s.f.tenantId, s.owner, { title: "Plain", productId: s.f.products[0]!.id });
      expect((await loadForEdit(s.f.tenantId, s.owner, plain.pageKey)).page.sections.map((x) => x.type)).toEqual(defaultLandingPage().sections.map((x) => x.type));
    });
  });

  describe("views, orders, sources and leads (docs/46 stage 3)", () => {
    const ship = { name: "Tania Akter", address: "House 4, Road 2, Dhanmondi", district: "Dhaka", division: "Dhaka" };
    async function liveStore(name: string) {
      const { s, id, pageKey } = await landingStore(name);
      return { s, id, pageKey };
    }
    async function goLive(s: Awaited<ReturnType<typeof store>>, pageKey: string) {
      await saveDraft(s.f.tenantId, s.owner, pageKey, defaultLandingPage());
      await publish(s.f.tenantId, s.owner, pageKey);
    }

    it("counts views of a live page only, per day, without identifying anyone", async () => {
      const { s, id, pageKey } = await liveStore("lps1");
      await recordLandingView(s.f.tenantId, "eid-panjabi");
      expect((await landingStats(s.f.tenantId, s.owner, id)).views).toBe(0);
      await goLive(s, pageKey);
      await recordLandingView(s.f.tenantId, "eid-panjabi");
      await recordLandingView(s.f.tenantId, "eid-panjabi");
      await recordLandingView(s.f.tenantId, "no-such-page");
      const st = await landingStats(s.f.tenantId, s.owner, id);
      expect(st).toMatchObject({ views: 2, orders: 0, conversion: 0 });
      expect(st.perDay).toHaveLength(1);
      expect((await landingTotals(s.f.tenantId, s.owner, [id])).get(id)).toEqual({ views: 2, orders: 0 });
    });

    it("an order from the page is counted once, remembers its page and source, and marks the lead as ordered", async () => {
      const { s, id, pageKey } = await liveStore("lps2");
      await goLive(s, pageKey);
      await recordLandingView(s.f.tenantId, "eid-panjabi");
      expect(await saveLandingLead(s.f.tenantId, "eid-panjabi", { name: "Tania Akter", phone: "01712345621", offerLabel: "1 piece", utmSource: "facebook" })).toBe(true);
      const variantId = s.f.products[0]!.variants[0]!.id;
      const input = { idempotencyKey: `lps-${Date.now()}-1`, variantId, quantity: 1, phone: "01712345621", utmSource: "facebook", utmCampaign: "eid", utmMedium: "paid", ...ship };
      const o = await placeLandingOrder(s.f.tenantId, "eid-panjabi", input);
      await placeLandingOrder(s.f.tenantId, "eid-panjabi", input); // the same order sent twice
      const row = await owner.order.findUniqueOrThrow({ where: { id: o.orderId } });
      expect(row).toMatchObject({ landingPageId: id, utmSource: "facebook", utmCampaign: "eid", utmMedium: "paid" });
      const st = await landingStats(s.f.tenantId, s.owner, id);
      expect(st).toMatchObject({ views: 1, orders: 1, conversion: 100, leads: 0 });
      expect(st.sources).toEqual([{ source: "facebook", campaign: "eid", orders: 1 }]);
      const leads = await listLandingLeads(s.f.tenantId, s.owner, id);
      expect(leads).toHaveLength(1);
      expect(leads[0]).toMatchObject({ phone: "01712345621", status: "ORDERED", offerLabel: "1 piece" });
    });

    it("keeps one lead per number, ignores bad numbers and names, never reopens an ordered lead, and removes old ones", async () => {
      const { s, id, pageKey } = await liveStore("lps3");
      await goLive(s, pageKey);
      const save = (name: string, phone: string) => saveLandingLead(s.f.tenantId, "eid-panjabi", { name, phone });
      expect(await save("A", "01712345622")).toBe(false);
      expect(await save("Rina Akter", "12345")).toBe(false);
      expect(await save("Rina Akter", "01712345622")).toBe(true);
      expect(await save("Rina A.", "+8801712345622")).toBe(true);
      expect(await listLandingLeads(s.f.tenantId, s.owner, id)).toHaveLength(1);
      expect((await listLandingLeads(s.f.tenantId, s.owner, id))[0]!.name).toBe("Rina A.");
      expect(await saveLandingLead(s.f.tenantId, "no-such-page", { name: "Rina Akter", phone: "01712345623" })).toBe(false);
      await owner.landingLead.updateMany({ where: { landingPageId: id }, data: { createdAt: new Date(Date.now() - 31 * 86_400_000) } });
      await save("Karim Uddin", "01712345624");
      const left = await listLandingLeads(s.f.tenantId, s.owner, id);
      expect(left.map((l) => l.phone)).toEqual(["01712345624"]);
    });

    it("another store sees none of it, and the right people can remove a lead", async () => {
      const a = await liveStore("lps4");
      await goLive(a.s, a.pageKey);
      await saveLandingLead(a.s.f.tenantId, "eid-panjabi", { name: "Rina Akter", phone: "01712345625" });
      const b = await liveStore("lps5");
      await goLive(b.s, b.pageKey);
      expect(await listLandingLeads(b.s.f.tenantId, b.s.owner, b.id)).toHaveLength(0);
      const [lead] = await listLandingLeads(a.s.f.tenantId, a.s.owner, a.id);
      await fails(deleteLandingLead(b.s.f.tenantId, b.s.owner, lead!.id), "VALIDATION_ERROR");
      await fails(deleteLandingLead(a.s.f.tenantId, a.s.packer, lead!.id), "FORBIDDEN");
      await deleteLandingLead(a.s.f.tenantId, a.s.owner, lead!.id);
      expect(await listLandingLeads(a.s.f.tenantId, a.s.owner, a.id)).toHaveLength(0);
    });
  });

  describe("offers (docs/46)", () => {
    const ship = { name: "Tania Akter", address: "House 4, Road 2, Dhanmondi", district: "Dhaka", division: "Dhaka" };
    async function offerStore(name: string) {
      const { s, id, pageKey } = await landingStore(name);
      await saveDraft(s.f.tenantId, s.owner, pageKey, defaultLandingPage());
      await publish(s.f.tenantId, s.owner, pageKey);
      const [p0, p1] = s.f.products;
      await updateLandingOffers(s.f.tenantId, s.owner, id, {
        options: [
          { id: "o1", label: "1 piece", productId: p0!.id },
          { id: "o2", label: "2 pieces", productId: p0!.id, quantity: 2, deal: { kind: "amount", value: 100 } },
          { id: "o3", label: "The other one", productId: p1!.id, deal: { kind: "percent", value: 10 } },
        ],
        bump: { productId: p1!.id, variantId: p1!.variants[0]!.id, label: "Add the other", percentOff: 50 },
      });
      return { s, id, pageKey, p0: p0!, p1: p1! };
    }

    it("shows the options and the bump from the database", async () => {
      const { s, p0 } = await offerStore("lpo1");
      const live = await getPublicLanding(s.f.tenantId, "eid-panjabi");
      expect(live!.options.map((o) => o.id)).toEqual(["o1", "o2", "o3"]);
      expect(live!.options[1]).toMatchObject({ quantity: 2, deal: { kind: "amount", value: 100 } });
      expect(live!.options[0]!.variants[0]!.price).toBe(p0.variants[0]!.price);
      expect(live!.bump).toMatchObject({ label: "Add the other", percentOff: 50 });
    });

    it("prices a bundle and the bump from the database, never from the page", async () => {
      const { s, p0, p1 } = await offerStore("lpo2");
      const o = await placeLandingOrder(s.f.tenantId, "eid-panjabi", { idempotencyKey: `lpo-${Date.now()}-1`, optionId: "o2", variantId: p0.variants[0]!.id, quantity: 1, bump: true, phone: "01712345611", ...ship });
      const row = await owner.order.findUniqueOrThrow({ where: { id: o.orderId } });
      const bumpPrice = p1.variants[0]!.price;
      expect(Number(row.subtotalAmount)).toBe(p0.variants[0]!.price * 2 + bumpPrice);
      expect(Number(row.discountAmount)).toBe(100 + bumpPrice / 2);
    });

    it("applies a percentage deal to the chosen product only", async () => {
      const { s, p1 } = await offerStore("lpo3");
      const o = await placeLandingOrder(s.f.tenantId, "eid-panjabi", { idempotencyKey: `lpo-${Date.now()}-2`, optionId: "o3", variantId: p1.variants[0]!.id, quantity: 2, phone: "01712345612", ...ship });
      const row = await owner.order.findUniqueOrThrow({ where: { id: o.orderId } });
      expect(Number(row.discountAmount)).toBe(Math.round(p1.variants[0]!.price * 2 * 10) / 100);
    });

    it("will not mix an option with another option's product, ask for a bump that is not offered, or point at foreign goods", async () => {
      const { s, id, p0, p1 } = await offerStore("lpo4");
      await fails(placeLandingOrder(s.f.tenantId, "eid-panjabi", { idempotencyKey: `lpo-${Date.now()}-3`, optionId: "o3", variantId: p0.variants[0]!.id, quantity: 1, phone: "01712345613", ...ship }), "VALIDATION_ERROR", /options/);
      await fails(placeLandingOrder(s.f.tenantId, "eid-panjabi", { idempotencyKey: `lpo-${Date.now()}-4`, optionId: "zzz", variantId: p0.variants[0]!.id, quantity: 1, phone: "01712345614", ...ship }), "VALIDATION_ERROR", /offers/);
      const other = await store("lpo4b");
      await fails(updateLandingOffers(s.f.tenantId, s.owner, id, { options: [{ id: "o1", label: "x", productId: other.f.products[0]!.id }] }), "VALIDATION_ERROR", /not on sale/);
      await fails(updateLandingOffers(s.f.tenantId, s.owner, id, { options: [{ id: "o1", label: "x", productId: p0.id }], bump: { productId: p1.id, variantId: p0.variants[0]!.id, label: "y", percentOff: 0 } }), "VALIDATION_ERROR", /extra item/);
      await fails(updateLandingOffers(s.f.tenantId, s.packer, id, { options: [{ id: "o1", label: "x", productId: p0.id }] }), "FORBIDDEN");
    });

    it("a page with no saved offers sells its one product, and every page has a short code that finds it", async () => {
      const { s, id } = await landingStore("lpo5");
      const [row] = await listLandingPages(s.f.tenantId, s.owner);
      expect(row!.offers.options).toHaveLength(1);
      expect(row!.shortCode).toMatch(/^[a-z0-9]{7}$/);
      expect(await landingSlugByCode(s.f.tenantId, row!.shortCode!)).toBe("eid-panjabi");
      expect(await landingSlugByCode(s.f.tenantId, "nothere")).toBeNull();
      expect(id).toBeTruthy();
    });

    it("validates the deal arithmetic", () => {
      expect(dealDiscount({ kind: "percent", value: 25 }, 1000)).toBe(250);
      expect(dealDiscount({ kind: "amount", value: 5000 }, 1000)).toBe(1000);
      expect(dealDiscount({ kind: "none", value: 0 }, 1000)).toBe(0);
      expect(() => parseOffers({ options: [] })).toThrow();
      expect(() => parseOffers({ options: [{ id: "a", label: "x", productId: "12345678" }, { id: "a", label: "y", productId: "12345678" }] })).toThrow(/same id/);
    });
  });

  it("does not take an order while the page is not live", async () => {
    const { s } = await landingStore("lp7");
    await fails(placeLandingOrder(s.f.tenantId, "eid-panjabi", { idempotencyKey: `lp-${Date.now()}-3`, variantId: s.f.products[0]!.variants[0]!.id, quantity: 1, name: "Tania Akter", phone: "01712345603", address: "House 4, Road 2, Dhanmondi", district: "Dhaka", division: "Dhaka" }), "NOT_FOUND");
  });

  it("a retried submit does not create a second order", async () => {
    const { s, pageKey } = await landingStore("lp8");
    await saveDraft(s.f.tenantId, s.owner, pageKey, defaultLandingPage());
    await publish(s.f.tenantId, s.owner, pageKey);
    const input = { idempotencyKey: `lp-${Date.now()}-4`, variantId: s.f.products[0]!.variants[0]!.id, quantity: 1, name: "Tania Akter", phone: "01712345604", address: "House 4, Road 2, Dhanmondi", district: "Dhaka", division: "Dhaka" };
    const a = await placeLandingOrder(s.f.tenantId, "eid-panjabi", input);
    const b = await placeLandingOrder(s.f.tenantId, "eid-panjabi", input);
    expect(b.orderId).toBe(a.orderId);
  });

  it("deleting a page removes its versions, and another store's page is untouchable", async () => {
    const { s, id, pageKey } = await landingStore("lp9");
    const other = await store("lp9b");
    await saveDraft(s.f.tenantId, s.owner, pageKey, defaultLandingPage());
    await fails(deleteLandingPage(other.f.tenantId, other.owner, id), "NOT_FOUND");
    await deleteLandingPage(s.f.tenantId, s.owner, id);
    expect(await owner.themeVersion.count({ where: { tenantId: s.f.tenantId } })).toBe(0);
    expect(await listLandingPages(s.f.tenantId, s.owner)).toHaveLength(0);
  });
});

describe("plan limits", () => {
  it("Starter can restyle the store but not rearrange its home page", async () => {
    const s = await store("plan1", "STARTER");
    expect(await getBuilderAccess(s.f.tenantId)).toEqual({ tier: "settings", sectionsEditable: false, allPagesEditable: false });
    // Colours and style: allowed, and publishable.
    await saveThemeDraft(s.f.tenantId, s.owner, { accent: "#0B5FFF" });
    await saveDraft(s.f.tenantId, s.owner, "home", defaultHomePage(), { accent: "#0B5FFF" });
    await publish(s.f.tenantId, s.owner, "home");
    expect((await getLive(s.f.tenantId, "home"))!.theme.accent).toBe("#0B5FFF");
    // Sections: not allowed.
    const changed = defaultHomePage();
    changed.sections.reverse();
    await fails(saveDraft(s.f.tenantId, s.owner, "home", changed), "PLAN_FEATURE");
    const extra = defaultHomePage();
    extra.sections.push(newSection("rich-text"));
    await fails(saveDraft(s.f.tenantId, s.owner, "home", extra), "PLAN_FEATURE");
  });

  it("Pro and Business can edit home sections", async () => {
    for (const tier of ["PRO", "BUSINESS"] as const) {
      const s = await store(`plan2${tier}`, tier);
      expect((await getBuilderAccess(s.f.tenantId)).sectionsEditable).toBe(true);
      const p = defaultHomePage();
      p.sections.push(newSection("rich-text"));
      await saveDraft(s.f.tenantId, s.owner, "home", p);
    }
  });

  it("limits landing pages to what the plan allows", async () => {
    const s = await store("plan3", "STARTER");
    for (let i = 0; i < 3; i++) await createLandingPage(s.f.tenantId, s.owner, { title: `Page ${i + 1}`, productId: s.f.products[0]!.id });
    await fails(createLandingPage(s.f.tenantId, s.owner, { title: "Page 4", productId: s.f.products[0]!.id }), "PLAN_LIMIT", /3 landing pages/);
    const b = await store("plan4", "BUSINESS");
    for (let i = 0; i < 4; i++) await createLandingPage(b.f.tenantId, b.owner, { title: `Page ${i + 1}`, productId: b.f.products[0]!.id });
  });
});

describe("connecting a domain", () => {
  class FakeDns implements DnsResolver {
    a = new Map<string, string[]>();
    cname = new Map<string, string[]>();
    async resolve4(h: string) {
      const v = this.a.get(h);
      if (!v) throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
      return v;
    }
    async resolveCname(h: string) {
      const v = this.cname.get(h);
      if (!v) throw Object.assign(new Error("ENODATA"), { code: "ENODATA" });
      return v;
    }
  }
  class FakeVercel implements VercelDomainClient {
    added: string[] = [];
    configured = false;
    ssl: "pending" | "issued" | "failed" = "pending";
    down = false;
    async add(d: string) {
      if (this.down) throw new Error("vercel down");
      this.added.push(d);
    }
    async status() {
      if (this.down) throw new Error("vercel down");
      return { configured: this.configured, ssl: this.ssl };
    }
    async remove() {}
  }
  const dns = new FakeDns();
  const vercel = new FakeVercel();

  async function withDomain(name: string, domain: string) {
    const s = await store(name);
    await owner.domain.create({ data: { tenantId: s.f.tenantId, domain, dnsNote: "Waiting for your DNS records" } });
    return s;
  }
  beforeEach(() => {
    dns.a.clear();
    dns.cname.clear();
    Object.assign(vercel, { added: [], configured: false, ssl: "pending", down: false });
    setDnsResolver(dns);
    setVercelClient(vercel);
  });

  it("tells the owner exactly which record to create", () => {
    expect(dnsInstruction("shop.example.com")).toMatchObject({ kind: "CNAME", name: "shop", value: "cname.bt.test" });
    expect(dnsInstruction("example.com")).toMatchObject({ kind: "A", name: "@", value: "203.0.113.10" });
    expect(dnsInstruction("example.com.bd")).toMatchObject({ kind: "A" });
    expect(dnsInstruction("shop.example.com.bd")).toMatchObject({ kind: "CNAME", name: "shop" });
    expect(dnsInstruction("shop.example.com").steps.length).toBeGreaterThan(3);
  });

  it("waits while there is no record, and says so in words", async () => {
    const s = await withDomain("dom1", "wait.example.com");
    const r = await checkDomain(s.f.tenantId, "wait.example.com");
    expect(r).toMatchObject({ dnsStatus: "waiting", connected: false });
    expect(r.note).toMatch(/cname\.bt\.test/);
    expect(vercel.added).toEqual([]);
  });

  it("names the wrong record it found", async () => {
    const s = await withDomain("dom2", "wrong.example.com");
    dns.a.set("wrong.example.com", ["198.51.100.7"]);
    const r = await checkDomain(s.f.tenantId, "wrong.example.com");
    expect(r.dnsStatus).toBe("wrong_record");
    expect(r.note).toMatch(/198\.51\.100\.7/);
    expect(vercel.added).toEqual([]);
  });

  it("reaches Connected by itself once the record is right and Vercel is ready", async () => {
    const s = await withDomain("dom3", "shop.example.com");
    dns.cname.set("shop.example.com", ["cname.bt.test."]);
    vercel.configured = true;
    vercel.ssl = "issued";
    const r = await checkDomain(s.f.tenantId, "shop.example.com");
    expect(r).toMatchObject({ dnsStatus: "verified", connected: true, ssl: "issued" });
    const row = await owner.domain.findFirstOrThrow({ where: { domain: "shop.example.com" } });
    expect(row).toMatchObject({ verified: true, isPrimary: true, dnsStatus: "verified", sslStatus: "issued" });
    expect(vercel.added).toEqual(["shop.example.com"]);
  });

  it("shows 'record found, getting the certificate' while Vercel is still working", async () => {
    const s = await withDomain("dom4", "soon.example.com");
    dns.cname.set("soon.example.com", ["cname.bt.test"]);
    const r = await checkDomain(s.f.tenantId, "soon.example.com");
    expect(r).toMatchObject({ dnsStatus: "found", connected: false });
    expect(r.note).toMatch(/certificate/);
    expect((await owner.domain.findFirstOrThrow({ where: { domain: "soon.example.com" } })).verified).toBe(false);
  });

  it("an apex domain needs the A record", async () => {
    const s = await withDomain("dom5", "apexshop.com");
    dns.a.set("apexshop.com", ["203.0.113.10"]);
    vercel.configured = true;
    vercel.ssl = "issued";
    expect((await checkDomain(s.f.tenantId, "apexshop.com")).connected).toBe(true);
  });

  it("survives a Vercel outage without losing the domain, and finishes on the next check", async () => {
    const s = await withDomain("dom6", "retry.example.com");
    dns.cname.set("retry.example.com", ["cname.bt.test"]);
    vercel.down = true;
    const r = await checkDomain(s.f.tenantId, "retry.example.com");
    expect(r).toMatchObject({ dnsStatus: "found", connected: false });
    expect(r.note).toMatch(/try again/);
    vercel.down = false;
    vercel.configured = true;
    vercel.ssl = "issued";
    expect((await checkDomain(s.f.tenantId, "retry.example.com")).connected).toBe(true);
  });

  it("checking again after it is connected changes nothing", async () => {
    const s = await withDomain("dom7", "twice.example.com");
    dns.cname.set("twice.example.com", ["cname.bt.test"]);
    vercel.configured = true;
    vercel.ssl = "issued";
    await checkDomain(s.f.tenantId, "twice.example.com");
    await checkDomain(s.f.tenantId, "twice.example.com");
    expect(await owner.auditLog.count({ where: { tenantId: s.f.tenantId, action: "domain.verified" } })).toBe(1);
  });

  it("a connected domain whose record is removed is reported, not silently kept", async () => {
    const s = await withDomain("dom8", "moved.example.com");
    dns.cname.set("moved.example.com", ["cname.bt.test"]);
    vercel.configured = true;
    vercel.ssl = "issued";
    await checkDomain(s.f.tenantId, "moved.example.com");
    dns.cname.clear();
    dns.a.set("moved.example.com", ["198.51.100.9"]);
    await checkDomain(s.f.tenantId, "moved.example.com");
    expect((await owner.domain.findFirstOrThrow({ where: { domain: "moved.example.com" } })).dnsStatus).toBe("wrong_record");
  });

  it("the owner's 'check now' is limited to once every 15 seconds", async () => {
    const s = await withDomain("dom9", "rate.example.com");
    const row = await owner.domain.findFirstOrThrow({ where: { domain: "rate.example.com" } });
    await recheckDomain(s.f.tenantId, s.owner, row.id);
    dns.cname.set("rate.example.com", ["cname.bt.test"]);
    vercel.configured = true;
    vercel.ssl = "issued";
    // Within 15 seconds the stored answer is returned and DNS is not asked again.
    expect((await recheckDomain(s.f.tenantId, s.owner, row.id)).connected).toBe(false);
    await owner.domain.update({ where: { id: row.id }, data: { lastCheckedAt: new Date(Date.now() - 60_000) } });
    expect((await recheckDomain(s.f.tenantId, s.owner, row.id)).connected).toBe(true);
    await fails(recheckDomain(s.f.tenantId, s.packer, row.id), "FORBIDDEN");
  });

  it("the sweep checks every connecting domain and one failure does not stop the rest", async () => {
    const a = await withDomain("dom10a", "sweepa.example.com");
    const b = await withDomain("dom10b", "sweepb.example.com");
    dns.cname.set("sweepa.example.com", ["cname.bt.test"]);
    dns.cname.set("sweepb.example.com", ["cname.bt.test"]);
    vercel.configured = true;
    vercel.ssl = "issued";
    const res = await sweepDomains();
    expect(res.checked).toBeGreaterThanOrEqual(2);
    expect((await owner.domain.findFirstOrThrow({ where: { domain: "sweepa.example.com" } })).verified).toBe(true);
    expect((await owner.domain.findFirstOrThrow({ where: { domain: "sweepb.example.com" } })).verified).toBe(true);
    void a; void b;
    // Just checked: not looked at again for two minutes.
    expect((await sweepDomains()).connected).toBe(0);
  });

  it("another store cannot check or see a domain it does not own", async () => {
    await withDomain("dom11", "private.example.com");
    const other = await store("dom11b");
    await fails(checkDomain(other.f.tenantId, "private.example.com"), "NOT_FOUND");
  });
});

describe("product, collection and cart pages (docs/39)", () => {
  it("each starts from the layout the storefront has always shown, and every default is valid", () => {
    for (const kind of STORE_PAGE_KINDS) expect(() => validatePage(kind, defaultPageFor(kind)), kind).not.toThrow();
    expect(defaultPageFor("product").sections.map((x) => x.type)).toEqual(["product-main", "product-reviews", "product-related"]);
    expect(defaultPageFor("collection").sections.map((x) => x.type)).toEqual(["collection-header", "collection-products"]);
    expect(defaultPageFor("cart").sections.map((x) => x.type)).toEqual(["cart-main"]);
  });

  it("each page has one block it cannot lose, and offers the right sections", () => {
    expect(requiredFor("product")).toEqual(["product-main"]);
    expect(requiredFor("collection")).toEqual(["collection-products"]);
    expect(requiredFor("cart")).toEqual(["cart-main"]);
    expect(requiredFor("home")).toEqual([]);
    // The product block belongs on the product page only; generic sections can be used around the blocks.
    expect(allowedOn(sectionDef("product-main")!, "cart")).toBe(false);
    expect(allowedOn(sectionDef("banner")!, "cart")).toBe(true);
    expect(allowedOn(sectionDef("hero")!, "product")).toBe(false);
    expect(sectionsFor("cart").map((d) => d.type)).toEqual(expect.arrayContaining(["cart-main", "banner", "rich-text", "trust-strip", "featured-products"]));
    expect(sectionsFor("cart").map((d) => d.type)).not.toContain("product-main");
  });

  it("refuses a page that loses or hides its required block, or has a section that is not for it", () => {
    const noMain = defaultPageFor("product");
    noMain.sections = noMain.sections.filter((x) => x.type !== "product-main");
    expect(() => validatePage("product", noMain)).toThrow(/needs the "Product details" section/);
    const hidden = defaultPageFor("cart");
    hidden.sections[0]!.disabled = true;
    expect(() => validatePage("cart", hidden)).toThrow(/cannot be hidden/);
    const wrong = defaultPageFor("collection");
    wrong.sections.push(newSection("hero"));
    expect(() => validatePage("collection", wrong)).toThrow(/not one this page can use/);
    const two = defaultPageFor("cart");
    two.sections.push(newSection("cart-main"));
    expect(() => validatePage("cart", two)).toThrow(/Only 1/);
  });

  it("a Business store edits, previews and publishes each page, and the live lookup is empty until it does", async () => {
    const s = await store("pg1", "BUSINESS");
    expect((await getBuilderAccess(s.f.tenantId)).allPagesEditable).toBe(true);
    for (const kind of ["product", "collection", "cart"] as const) {
      expect(await getLive(s.f.tenantId, kind)).toBeNull();
      const start = await loadForEdit(s.f.tenantId, s.owner, kind);
      expect(start.kind).toBe(kind);
      expect(start.page.sections.map((x) => x.type)).toEqual(defaultPageFor(kind).sections.map((x) => x.type));
      const edited = structuredClone(start.page);
      edited.sections.push(newSection("rich-text"));
      await saveDraft(s.f.tenantId, s.owner, kind, edited);
      expect(await getLive(s.f.tenantId, kind)).toBeNull(); // a draft is not live
      expect(await publish(s.f.tenantId, s.owner, kind, "Test")).toBe(1);
      expect((await getLive(s.f.tenantId, kind))!.page.sections.map((x) => x.type)).toContain("rich-text");
    }
    // Pages are independent: the home page was never touched.
    expect(await getLive(s.f.tenantId, "home")).toBeNull();
    expect((await listVersions(s.f.tenantId, s.owner, "cart")).length).toBe(1);
  });

  it("only the Business plan can rearrange them; Pro can edit the home page but sees the others as they are", async () => {
    const pro = await store("pg2", "PRO");
    expect(await getBuilderAccess(pro.f.tenantId)).toMatchObject({ sectionsEditable: true, allPagesEditable: false });
    const p = defaultPageFor("product");
    p.sections.push(newSection("rich-text"));
    await fails(saveDraft(pro.f.tenantId, pro.owner, "product", p), "PLAN_FEATURE");
    // Saving the layout as it already is stays allowed (the editor autosaves on open), and the home page is still editable.
    await saveDraft(pro.f.tenantId, pro.owner, "product", defaultPageFor("product"));
    const h = defaultHomePage();
    h.sections.push(newSection("rich-text"));
    await saveDraft(pro.f.tenantId, pro.owner, "home", h);
  });

  it("a content editor can design these pages; a packer cannot", async () => {
    const s = await store("pg3", "BUSINESS");
    await saveDraft(s.f.tenantId, s.content, "cart", defaultPageFor("cart"));
    await fails(saveDraft(s.f.tenantId, s.packer, "cart", defaultPageFor("cart")), "FORBIDDEN");
  });

  it("rolling back works per page and does not disturb the theme", async () => {
    const s = await store("pg4", "BUSINESS");
    const v1 = structuredClone(defaultPageFor("product"));
    await saveDraft(s.f.tenantId, s.owner, "product", v1);
    await publish(s.f.tenantId, s.owner, "product");
    const v2 = structuredClone(v1);
    v2.sections.push(newSection("trust-strip"));
    await saveDraft(s.f.tenantId, s.owner, "product", v2);
    await publish(s.f.tenantId, s.owner, "product");
    expect(await rollback(s.f.tenantId, s.owner, "product", 1)).toBe(3);
    expect((await getLive(s.f.tenantId, "product"))!.page.sections.map((x) => x.type)).not.toContain("trust-strip");
  });
});
