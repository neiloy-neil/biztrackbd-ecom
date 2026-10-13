import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  DomainError, STORE_THEMES, applyTemplateToStore, applyTemplateUpdate, defaultHomePage, getLive, getTemplate, listPublishedTemplates, listTemplatesForStaff, loadForEdit, newSection, publish,
  publishTemplateFromStore, saveDraft, setEventPublisher, setTemplateStatus, signupStore, templateUpdateAvailable, type PageJson, type PlatformActor, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let n = 0;

const boss: PlatformActor = { id: "pa-owner", email: "boss@example.test", role: "OWNER" };
const accountant: PlatformActor = { id: "pa-fin", email: "fin@example.test", role: "FINANCE" };
const actorFor = (userId: string): StaffActor => ({ userId, email: "o@example.test", name: "Owner", role: "STORE_OWNER" });

async function store(theme = "kapor", plan: "STARTER" | "PRO" | "BUSINESS" = "BUSINESS") {
  const sub = `tpl${++n}x${Date.now().toString(36).slice(-5)}`;
  const s = await signupStore({ ownerName: "Nusrat Jahan", email: `${sub}@example.test`, phone: "01712345678", storeName: `Shop ${sub}`, subdomain: sub, plan, theme, demoData: false });
  const user = await owner.tenantUser.findFirstOrThrow({ where: { tenantId: s.tenantId, role: "STORE_OWNER" } });
  return { tenantId: s.tenantId, actor: actorFor(user.id) };
}

/** A workshop store whose home page has an extra section, published, so a template taken from it differs from the original. */
async function workshop(extra = "banner") {
  const w = await store("kapor");
  const home: PageJson = defaultHomePage();
  home.sections.push(newSection(extra));
  await saveDraft(w.tenantId, w.actor, "home", home, { accent: "#8A2855", background: "#FFF9F7", text: "#321E28", radius: "round", font: "serif" });
  await publish(w.tenantId, w.actor, "home");
  return { ...w, home };
}

beforeAll(async () => {
  process.env.PHONE_TRUST_SALT = "test-salt-test-salt-test-salt-0001";
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "biztrack.test";
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  setPlatformPrisma(owner);
  await seedPlans(owner);
});
beforeEach(() => setEventPublisher(async () => {}));
afterAll(async () => {
  await app.$disconnect();
  await owner.$disconnect();
});

const fails = async (p: Promise<unknown>, code?: string, msg?: RegExp) => {
  const e = await p.then(() => null, (x) => x);
  expect(e).toBeInstanceOf(DomainError);
  if (code) expect((e as DomainError).code).toBe(code);
  if (msg) expect((e as DomainError).message).toMatch(msg);
};

describe("store templates published without a deploy (docs/46 stage 5)", () => {
  it("starts with the six originals, and a store made from one remembers it", async () => {
    const list = await listPublishedTemplates();
    expect(list.map((t) => t.id)).toEqual(STORE_THEMES.map((t) => t.id));
    expect(list.every((t) => t.builtIn && t.pages === null)).toBe(true);
    const s = await store("berber");
    const t = await owner.tenant.findUniqueOrThrow({ where: { id: s.tenantId } });
    expect(t).toMatchObject({ themeId: "berber", templateId: "berber", templateVersion: 1 });
  });

  it("publishes a workshop store's live design as a template that stores can start from", async () => {
    const w = await workshop();
    const info = await publishTemplateFromStore(boss, { tenantId: w.tenantId, id: "Eid-Kapor", name: "Eid Kapor", blurb: "Festive fashion", category: "fashion", tags: ["Eid", "Panjabi"] });
    expect(info).toMatchObject({ id: "eid-kapor", version: 1, status: "PUBLISHED", baseLook: "kapor", builtIn: false, category: "fashion" });
    expect(info.settings).toMatchObject({ accent: "#8A2855", radius: "round", font: "serif" });
    expect(info.pages!.home!.sections.map((s) => s.type)).toContain("banner");
    expect(Object.keys(info.pages!).sort()).toEqual(["cart", "collection", "home", "product"]);
    expect((await getTemplate("eid-kapor"))!.name).toBe("Eid Kapor");

    // A new store started from it gets that design live from the first moment, and remembers where it came from.
    const s = await store("eid-kapor");
    const t = await owner.tenant.findUniqueOrThrow({ where: { id: s.tenantId } });
    expect(t).toMatchObject({ themeId: "kapor", templateId: "eid-kapor", templateVersion: 1 });
    const live = await getLive(s.tenantId, "home");
    expect(live!.page.sections.map((x) => x.type)).toEqual(info.pages!.home!.sections.map((x) => x.type));
    expect(live!.theme).toMatchObject({ accent: "#8A2855", font: "serif" });
  });

  it("refuses an unknown template, a bad id, a demo store, and anyone but the owner role", async () => {
    await fails(signupStore({ ownerName: "Nusrat Jahan", email: "nope@example.test", phone: "01712345678", storeName: "Nope", subdomain: `nope${Date.now().toString(36)}`, plan: "PRO", theme: "no-such-template" }), "VALIDATION_ERROR", /template/);
    const w = await store();
    await fails(publishTemplateFromStore(boss, { tenantId: w.tenantId, id: "Bad Id!", name: "Bad" }), "VALIDATION_ERROR", /small letters/);
    await fails(publishTemplateFromStore(boss, { tenantId: "nope", id: "ghost-template", name: "Ghost" }), "NOT_FOUND");
    await fails(publishTemplateFromStore(accountant, { tenantId: w.tenantId, id: "fin-template", name: "Fin" }), "FORBIDDEN");
    await owner.tenant.update({ where: { id: w.tenantId }, data: { demoKind: "SESSION" } });
    await fails(publishTemplateFromStore(boss, { tenantId: w.tenantId, id: "demo-template", name: "Demo" }), "VALIDATION_ERROR", /demo/);
  });

  it("a draft is private, an archived template is hidden from new stores, and a hidden original comes back when shown again", async () => {
    const w = await workshop("rich-text");
    await publishTemplateFromStore(boss, { tenantId: w.tenantId, id: "quiet-one", name: "Quiet One" });
    await setTemplateStatus(boss, "quiet-one", "DRAFT");
    expect((await listPublishedTemplates()).some((t) => t.id === "quiet-one")).toBe(false);
    await setTemplateStatus(boss, "quiet-one", "PUBLISHED");
    expect((await listPublishedTemplates()).some((t) => t.id === "quiet-one")).toBe(true);
    await setTemplateStatus(boss, "quiet-one", "ARCHIVED");
    expect((await listPublishedTemplates()).some((t) => t.id === "quiet-one")).toBe(false);
    await fails(signupStore({ ownerName: "Nusrat Jahan", email: "arch@example.test", phone: "01712345678", storeName: "Arch", subdomain: `arch${Date.now().toString(36)}`, plan: "PRO", theme: "quiet-one" }), "VALIDATION_ERROR", /template/);

    await setTemplateStatus(boss, "bindu", "ARCHIVED");
    expect((await listPublishedTemplates()).some((t) => t.id === "bindu")).toBe(false);
    await setTemplateStatus(boss, "bindu", "PUBLISHED");
    expect((await listPublishedTemplates()).some((t) => t.id === "bindu")).toBe(true);
    await fails(setTemplateStatus(boss, "no-such", "ARCHIVED"), "NOT_FOUND");
    await fails(setTemplateStatus(accountant, "bindu", "ARCHIVED"), "FORBIDDEN");
  });

  it("a newer version is offered to stores using it, applied as drafts, and never goes live by itself", async () => {
    const w = await workshop();
    await publishTemplateFromStore(boss, { tenantId: w.tenantId, id: "lively", name: "Lively" });
    const s = await store("lively");
    expect(await templateUpdateAvailable(s.tenantId)).toBeNull();

    // The workshop changes its home page and publishes version 2.
    const home: PageJson = { ...w.home, sections: [...w.home.sections, newSection("rich-text")] };
    await saveDraft(w.tenantId, w.actor, "home", home);
    await publish(w.tenantId, w.actor, "home");
    const v2 = await publishTemplateFromStore(boss, { tenantId: w.tenantId, id: "lively", name: "Lively" });
    expect(v2.version).toBe(2);

    expect(await templateUpdateAvailable(s.tenantId)).toEqual({ id: "lively", name: "Lively", have: 1, latest: 2 });
    const liveBefore = (await getLive(s.tenantId, "home"))!.page.sections.length;
    const r = await applyTemplateUpdate(s.tenantId, s.actor);
    expect(r.version).toBe(2);
    expect(r.pages).toContain("home");
    // Nothing live changed; the new layout waits in the editor as a draft.
    expect((await getLive(s.tenantId, "home"))!.page.sections.length).toBe(liveBefore);
    const state = await loadForEdit(s.tenantId, s.actor, "home");
    expect(state.isDraft).toBe(true);
    expect(state.page.sections.length).toBe(home.sections.length);
    expect(await templateUpdateAvailable(s.tenantId)).toBeNull();
    await fails(applyTemplateUpdate(s.tenantId, s.actor), "VALIDATION_ERROR", /no newer/);
    await publish(s.tenantId, s.actor, "home");
    expect((await getLive(s.tenantId, "home"))!.page.sections.length).toBe(home.sections.length);
  });

  it("a store whose plan only restyles takes the colours of a newer version, not its sections", async () => {
    const w = await workshop();
    await publishTemplateFromStore(boss, { tenantId: w.tenantId, id: "plan-gate", name: "Plan Gate" });
    const s = await store("plan-gate", "STARTER");
    const before = (await getLive(s.tenantId, "home"))!;
    const home: PageJson = { ...w.home, sections: [...w.home.sections, newSection("rich-text")] };
    await saveDraft(w.tenantId, w.actor, "home", home, { accent: "#155EEF", background: "#F6F8FC", text: "#1A1A2E", radius: "soft", font: "sans" });
    await publish(w.tenantId, w.actor, "home");
    await publishTemplateFromStore(boss, { tenantId: w.tenantId, id: "plan-gate", name: "Plan Gate" });
    const r = await applyTemplateUpdate(s.tenantId, s.actor);
    expect(r.pages).toEqual(["home"]);
    const state = await loadForEdit(s.tenantId, s.actor, "home");
    expect(state.page.sections.map((x) => x.type)).toEqual(before.page.sections.map((x) => x.type));
    expect(state.theme.accent).toBe("#155EEF");
  });

  it("a store can move to another template: layouts and style land in the drafts, content stays, and the look changes only when the template needs another one", async () => {
    const w = await workshop();
    await publishTemplateFromStore(boss, { tenantId: w.tenantId, id: "switch-kapor", name: "Switch Kapor" });
    const s = await store("kapor");
    // A store started from an original template has published nothing yet: it shows the built-in layouts.
    expect(await getLive(s.tenantId, "home")).toBeNull();

    // Same look: only drafts change; keeping the cart leaves its layout alone.
    const r = await applyTemplateToStore(s.tenantId, s.actor, "switch-kapor", ["cart"]);
    expect(r).toMatchObject({ lookChanged: false, version: 1 });
    expect(r.pages).toEqual(expect.arrayContaining(["home", "product", "collection"]));
    expect(r.pages).not.toContain("cart");
    expect(await getLive(s.tenantId, "home")).toBeNull();
    expect((await loadForEdit(s.tenantId, s.actor, "home")).isDraft).toBe(true);
    expect((await loadForEdit(s.tenantId, s.actor, "cart")).isDraft).toBe(false);
    expect(await owner.tenant.findUniqueOrThrow({ where: { id: s.tenantId } })).toMatchObject({ themeId: "kapor", templateId: "switch-kapor", templateVersion: 1 });

    // Another look: the look switches at once and the new look's pages start from its own layouts, with the template in the drafts.
    const r2 = await applyTemplateToStore(s.tenantId, s.actor, "berber");
    expect(r2.lookChanged).toBe(true);
    expect(await owner.tenant.findUniqueOrThrow({ where: { id: s.tenantId } })).toMatchObject({ themeId: "berber", templateId: "berber" });
    expect(await getLive(s.tenantId, "home")).toBeNull();
    expect((await loadForEdit(s.tenantId, s.actor, "home"))).toMatchObject({ isDraft: true, themeId: "berber" });
    // Their products and content are untouched by any of it.
    const products = await owner.product.count({ where: { tenantId: s.tenantId } });
    await applyTemplateToStore(s.tenantId, s.actor, "kapor");
    expect(await owner.product.count({ where: { tenantId: s.tenantId } })).toBe(products);

    await fails(applyTemplateToStore(s.tenantId, s.actor, "no-such-template"), "VALIDATION_ERROR", /available/);
    await fails(applyTemplateToStore(s.tenantId, { ...s.actor, role: "ORDER_PACKER" }, "kapor"), "FORBIDDEN");
  });

  it("a store whose plan only restyles takes a new template's colours and keeps its own sections", async () => {
    const w = await workshop();
    await publishTemplateFromStore(boss, { tenantId: w.tenantId, id: "style-only", name: "Style Only" });
    const s = await store("kapor", "STARTER");
    const before = (await loadForEdit(s.tenantId, s.actor, "home")).page.sections.map((x) => x.type);
    const r = await applyTemplateToStore(s.tenantId, s.actor, "style-only");
    expect(r.pages).toEqual(["home"]);
    const state = await loadForEdit(s.tenantId, s.actor, "home");
    expect(state.page.sections.map((x) => x.type)).toEqual(before);
    expect(state.theme.accent).toBe("#8A2855");
  });

  it("replacing an original: stores made from it are offered the new version, and staff see how many use each template", async () => {
    const before = await store("gadgetstudio");
    const w = await workshop();
    const info = await publishTemplateFromStore(boss, { tenantId: w.tenantId, id: "gadgetstudio", name: "Gadget Studio" });
    expect(info.version).toBe(2); // the original is version 1
    expect((await listPublishedTemplates()).find((t) => t.id === "gadgetstudio")!.builtIn).toBe(false);
    expect(await templateUpdateAvailable(before.tenantId)).toMatchObject({ id: "gadgetstudio", have: 1, latest: 2 });
    const rows = await listTemplatesForStaff(boss);
    const row = rows.find((r) => r.id === "gadgetstudio")!;
    expect(row.saved).toBe(true);
    expect(row.storesUsing).toBeGreaterThanOrEqual(1);
    expect(rows.find((r) => r.id === "kapor")!.saved).toBe(false);
    await expect(listTemplatesForStaff({ ...boss, role: "SUPPORT" })).rejects.toBeInstanceOf(DomainError);
  });
});
