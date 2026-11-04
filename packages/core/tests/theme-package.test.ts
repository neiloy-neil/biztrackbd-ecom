import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  DomainError, STORE_THEMES, ValidationError, applyTemplateToStore, defaultPageFor, getActiveSkin, importTemplateBundle, listThemeCatalogue, listThemeStore, parseTemplateBundle,
  resolveTemplateForSignup, scopeSkinCss, setEventPublisher, signupStore, submitThemePurchase, syncTemplateThemes, templateToFile, updateThemePricing, approveThemePurchase,
  listPendingThemePurchases, getTemplate, type PlatformActor, type StaffActor,
} from "../src";

describe("theme skin CSS rules", () => {
  const ok = (css: string) => scopeSkinCss("aurora", css);
  const bad = (css: string) => { try { scopeSkinCss("aurora", css); return null; } catch (e) { return e instanceof ValidationError ? e.message : String(e); } };

  it("scopes every selector under the theme and keeps declarations", () => {
    expect(ok(".btn{background:#123456;color:#fff}")).toBe('body[data-skin="aurora"] .btn{background:#123456;color:#fff}');
    expect(ok("h1,h2{letter-spacing:-.5px}")).toBe('body[data-skin="aurora"] h1,body[data-skin="aurora"] h2{letter-spacing:-.5px}');
  });
  it("treats body, html and :root as the scope itself", () => {
    expect(ok("body{--accent:#0a7}")).toBe('body[data-skin="aurora"]{--accent:#0a7}');
    expect(ok(":root{--x:1}")).toBe('body[data-skin="aurora"]{--x:1}');
    expect(ok("body .card{border-radius:12px}")).toBe('body[data-skin="aurora"] .card{border-radius:12px}');
  });
  it("allows @media and scopes inside it, but nothing nested deeper", () => {
    expect(ok("@media (max-width:600px){.btn{padding:8px}}")).toBe('@media (max-width:600px){body[data-skin="aurora"] .btn{padding:8px}}');
    expect(bad("@media (max-width:600px){@media (min-width:1px){.a{color:red}}}")).toMatch(/nested/);
  });
  it("drops comments and returns an empty string for nothing", () => {
    expect(ok("/* hello */ ")).toBe("");
    expect(ok("/* x */ .a{color:red}")).toBe('body[data-skin="aurora"] .a{color:red}');
  });
  it.each([
    ["an import", '@import "https://evil.example/x.css";.a{color:red}'],
    ["a font face", "@font-face{font-family:x}"],
    ["url()", ".a{background:url(https://evil.example/p.png)}"],
    ["url() with spaces", ".a{background:URL (x)}"],
    ["image-set", ".a{background:image-set(x 1x)}"],
    ["expression()", ".a{width:expression(alert(1))}"],
    ["a javascript link", ".a{background:javascript:alert(1)}"],
    ["data:", ".a{content:data:text/html}"],
    ["behavior", ".a{behavior:url(x.htc)}"],
    ["a style tag break-out", ".a{color:red}</style><script>alert(1)</script>"],
    ["a backslash escape", ".a{background:u\\72l(x)}"],
    ["position fixed", ".a{position:fixed;top:0}"],
    ["position sticky", ".a{position: sticky}"],
    ["a huge z-index", ".a{z-index:9999}"],
    ["a supports rule", "@supports (display:grid){.a{color:red}}"],
    ["a keyframes rule", "@keyframes x{from{opacity:0}to{opacity:1}}"],
    ["a bad property", ".a{color red}"],
    ["a link in content", '.a::after{content:"https://evil.example"}'],
  ])("refuses %s", (_name, css) => {
    expect(bad(css)).not.toBeNull();
  });
  it("refuses a CSS file over the size limit and a bad theme id", () => {
    expect(bad(`.a{color:red}${" ".repeat(41_000)}`)).toMatch(/too large/);
    expect(() => scopeSkinCss("Bad Id", ".a{color:red}")).toThrow(ValidationError);
  });
  it("cannot be tricked by braces that try to leave the scope", () => {
    expect(bad("a{color:red}} .x{color:blue")).not.toBeNull();
    expect(bad("a{color:red;} b{")).not.toBeNull();
    expect(bad("}.x{color:red}")).not.toBeNull();
  });
});

const file = (over: Record<string, unknown> = {}, skin = ".btn{background:#0a7d5a}") => JSON.stringify({
  format: "biztrack-template", formatVersion: 1, id: "aurora", name: "Aurora", blurb: "A cool theme", audience: "Anyone", baseLook: "kapor",
  settings: STORE_THEMES[0]!.defaults, pages: { home: defaultPageFor("home") }, skin: { css: skin }, ...over,
});

describe("a theme package file", () => {
  it("carries its skin through parse", () => {
    expect(parseTemplateBundle(file()).skinCss).toBe(".btn{background:#0a7d5a}");
    expect(parseTemplateBundle(file({}, "")).skinCss).toBe("");
  });
  it("refuses a file whose CSS is not safe, naming the part", () => {
    expect(() => parseTemplateBundle(file({}, ".a{background:url(x)}"))).toThrow(/skin\.css/);
  });
});

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const boss: PlatformActor = { id: "pu-OWNER", email: "owner@biztrackbd.test", role: "OWNER" };
const trx = () => `TP${Date.now().toString(36).toUpperCase()}${++seq}`.slice(0, 11).padEnd(9, "Z");
async function store() {
  const n = ++seq;
  const s = await signupStore({ ownerName: "Nusrat Jahan", email: `package${n}@example.test`, phone: `0195${String(3000000 + n).slice(-7)}`, storeName: `Package ${n}`, subdomain: `package${n}shop`, plan: "STARTER", category: "FASHION" } as never);
  const row = await owner.tenantUser.findFirstOrThrow({ where: { tenantId: s.tenantId } });
  return { tenantId: s.tenantId, actor: { userId: row.id, email: row.email, name: row.name, role: "STORE_OWNER" } as StaffActor };
}
const failure = (p: Promise<unknown>) => p.then(() => null, (x) => x as Error);

describe("uploaded themes in the database", () => {
  beforeAll(async () => {
    process.env.PHONE_TRUST_SALT = "test-salt-test-salt-test-salt-0001";
    const urls = testUrls();
    await resetDatabase(urls.direct);
    owner = createOwnerClient(urls.direct);
    app = createBaseClient(urls.app, 10);
    setBasePrisma(app);
    setPlatformPrisma(owner);
    await seedPlans(owner);
    setEventPublisher(async () => {});
  }, 120_000);
  afterAll(async () => { await app.$disconnect(); await owner.$disconnect(); });

  it("an upload becomes a free catalogue theme that the admin can then price", async () => {
    const r = await importTemplateBundle(boss, file(), { publish: true }, owner);
    expect(r.template.skinCss).toBe(".btn{background:#0a7d5a}");
    const row = await owner.theme.findUniqueOrThrow({ where: { id: "aurora" } });
    expect(row).toMatchObject({ source: "PACKAGE", status: "PUBLISHED", priceModel: "FREE" });
    expect((await listThemeCatalogue(boss, owner)).find((t) => t.id === "aurora")).toMatchObject({ source: "PACKAGE", premium: false });
    await updateThemePricing(boss, "aurora", { status: "PUBLISHED", priceModel: "ONE_TIME", priceBdt: 99, includedPlans: [] }, owner);
    // Uploading a new version keeps the price the admin set.
    await importTemplateBundle(boss, file({ name: "Aurora 2" }), { publish: true }, owner);
    expect(await owner.theme.findUniqueOrThrow({ where: { id: "aurora" } })).toMatchObject({ name: "Aurora 2", priceModel: "ONE_TIME" });
    expect(Number((await owner.theme.findUniqueOrThrow({ where: { id: "aurora" } })).priceBdt)).toBe(99);
  });

  it("round-trips the skin through download and upload", async () => {
    const t = (await getTemplate("aurora", owner))!;
    expect(parseTemplateBundle(templateToFile(t)).skinCss).toBe(".btn{background:#0a7d5a}");
  });

  it("a paid uploaded theme needs a purchase to apply, and is not handed out at signup", async () => {
    const s = await store();
    const view = await listThemeStore(s.tenantId, s.actor);
    expect(view.themes.find((t) => t.id === "aurora")).toMatchObject({ premium: true, price: 99, state: "LOCKED" });
    const e = await failure(applyTemplateToStore(s.tenantId, s.actor, "aurora", [], true, "publish"));
    expect(e).toBeInstanceOf(DomainError);
    expect(e!.message).toMatch(/Buy this theme first/);
    expect((await failure(resolveTemplateForSignup("aurora", owner)))!.message).toMatch(/paid theme/);

    await submitThemePurchase(s.tenantId, s.actor, { themeId: "aurora", provider: "BKASH", senderNumber: "01712345678", trxId: trx() });
    const pending = (await listPendingThemePurchases(boss, owner)).find((p) => p.tenantId === s.tenantId)!;
    await approveThemePurchase(boss, pending.id, owner);
    const done = await applyTemplateToStore(s.tenantId, s.actor, "aurora", [], true, "publish");
    expect(done.pages).toContain("home");
    expect(await owner.tenant.findUniqueOrThrow({ where: { id: s.tenantId } })).toMatchObject({ templateId: "aurora", themeId: "kapor" });
  });

  it("serves the skin only to a store that uses the theme, scoped and checked", async () => {
    const s = await store();
    expect(await getActiveSkin(s.tenantId, owner)).toBeNull();
    // The answer is cached for a minute, so each case below asks about a store that has not been looked at yet.
    const fresh = await store();
    await owner.tenant.update({ where: { id: fresh.tenantId }, data: { templateId: "aurora" } });
    const got = await getActiveSkin(fresh.tenantId, owner);
    expect(got).toEqual({ id: "aurora", css: 'body[data-skin="aurora"] .btn{background:#0a7d5a}' });
    // A store that moved to another look does not wear the skin.
    const moved = await store();
    await owner.tenant.update({ where: { id: moved.tenantId }, data: { templateId: "aurora", themeId: "bindu" } });
    expect(await getActiveSkin(moved.tenantId, owner)).toBeNull();
  });

  it("hiding the theme in the pricing form stops it being applied", async () => {
    const s = await store();
    await updateThemePricing(boss, "aurora", { status: "ARCHIVED", priceModel: "FREE", priceBdt: 0, includedPlans: [] }, owner);
    expect((await failure(applyTemplateToStore(s.tenantId, s.actor, "aurora", [], true, "publish")))!.message).toMatch(/not available/);
    expect((await listThemeStore(s.tenantId, s.actor)).themes.some((t) => t.id === "aurora")).toBe(false);
  });

  it("backfills a catalogue row for a template uploaded before the catalogue existed", async () => {
    await owner.theme.deleteMany({ where: { id: "aurora" } });
    expect(await syncTemplateThemes(owner)).toBeGreaterThanOrEqual(1);
    expect(await owner.theme.findUniqueOrThrow({ where: { id: "aurora" } })).toMatchObject({ source: "PACKAGE" });
    expect(await syncTemplateThemes(owner)).toBe(0);
  });
});
