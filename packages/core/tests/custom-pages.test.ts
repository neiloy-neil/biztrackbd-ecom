import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  CUSTOM_PAGE_TEMPLATES, DomainError, createCustomPage, customKey, customPageIdBySlug, deleteCustomPage, getPreview, getPublicCustomPage, getPublishedPage, listContent, listCustomPages,
  listFooterPages, listVersions, loadForEdit, newSection, publish, saveContent, saveDraft, sectionsFor, setCustomPageLive, setEventPublisher, signupStore, updateCustomPage, validatePage,
  type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let n = 0;

const actorFor = (userId: string, role: StaffActor["role"] = "STORE_OWNER"): StaffActor => ({ userId, email: "o@example.test", name: "Owner", role });

async function store(plan: "STARTER" | "PRO" | "BUSINESS" = "PRO") {
  const sub = `cpg${++n}x${Date.now().toString(36).slice(-5)}`;
  const s = await signupStore({ ownerName: "Nusrat Jahan", email: `${sub}@example.test`, phone: "01712345678", storeName: `Shop ${sub}`, subdomain: sub, plan, theme: "kapor", demoData: false });
  const user = await owner.tenantUser.findFirstOrThrow({ where: { tenantId: s.tenantId, role: "STORE_OWNER" } });
  return { tenantId: s.tenantId, actor: actorFor(user.id) };
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

describe("pages built from sections (docs/47 part D)", () => {
  it("every starting layout is valid, in both languages, with no contact detail typed into it", () => {
    expect(CUSTOM_PAGE_TEMPLATES.map((t) => t.id)).toEqual(["blank", "about", "contact", "size-guide", "delivery"]);
    for (const t of CUSTOM_PAGE_TEMPLATES) {
      const page = t.build();
      expect(() => validatePage("custom", page), t.id).not.toThrow();
      const hero = page.sections[0]!;
      expect(String(hero.settings.titleBn ?? ""), t.id).not.toBe("");
    }
    // The contact block takes the store's own details, so nothing in a layout can carry a phone number or address.
    const contact = CUSTOM_PAGE_TEMPLATES.find((t) => t.id === "contact")!.build();
    expect(JSON.stringify(contact)).not.toMatch(/01\d{9}/);
    expect(sectionsFor("custom").map((d) => d.type)).toContain("contact-block");
  });

  it("is created hidden from a template, opens with that layout, and goes live only after it is published", async () => {
    const s = await store("PRO");
    const made = await createCustomPage(s.tenantId, s.actor, { title: "About us", templateId: "about" });
    const [row] = await listCustomPages(s.tenantId, s.actor);
    expect(row).toMatchObject({ title: "About us", slug: "about-us", isPublished: false, pageKey: customKey(made.id) });
    const state = await loadForEdit(s.tenantId, s.actor, made.pageKey);
    expect(state.kind).toBe("custom");
    expect(state.page.sections.map((x) => x.type)).toEqual(CUSTOM_PAGE_TEMPLATES[1]!.build().sections.map((x) => x.type));

    expect(await getPublicCustomPage(s.tenantId, "about-us")).toBeNull();
    await fails(setCustomPageLive(s.tenantId, s.actor, made.id, true), "VALIDATION_ERROR", /Publish the page/);

    const edited = { ...state.page, sections: [...state.page.sections, newSection("lp-faq")] };
    await saveDraft(s.tenantId, s.actor, made.pageKey, edited);
    // The draft is visible to the editor's preview only.
    expect(await getPublicCustomPage(s.tenantId, "about-us")).toBeNull();
    expect((await getPreview(s.tenantId, made.pageKey)).page.sections).toHaveLength(edited.sections.length);
    const v = await publish(s.tenantId, s.actor, made.pageKey, "First");
    expect(v).toBe(1);
    const live = await getPublicCustomPage(s.tenantId, "about-us");
    expect(live!.page.sections).toHaveLength(edited.sections.length);
    expect((await listVersions(s.tenantId, s.actor, made.pageKey))[0]).toMatchObject({ version: 1, isLive: true });
    expect((await listFooterPages(s.tenantId)).map((p) => p.slug)).toContain("about-us");

    await setCustomPageLive(s.tenantId, s.actor, made.id, false);
    expect(await getPublicCustomPage(s.tenantId, "about-us")).toBeNull();
    expect((await getPublicCustomPage(s.tenantId, "about-us", { page: edited }))!.title).toBe("About us");
    expect(await customPageIdBySlug(s.tenantId, "about-us")).toBe(made.id);
  });

  it("shares its address space with ordinary pages, and keeps the two lists apart", async () => {
    const s = await store("PRO");
    await saveContent(s.tenantId, s.actor, "page", null, { title: "Delivery policy", slug: "delivery", body: "We deliver in 2 days.", isPublished: true });
    await fails(createCustomPage(s.tenantId, s.actor, { title: "Delivery", slug: "delivery" }), "VALIDATION_ERROR", /already have/);
    await fails(createCustomPage(s.tenantId, s.actor, { title: "Api", slug: "api" }), "VALIDATION_ERROR");
    await fails(createCustomPage(s.tenantId, s.actor, { title: "Bad", slug: "Has Spaces!" }), "VALIDATION_ERROR");
    await createCustomPage(s.tenantId, s.actor, { title: "Contact", templateId: "contact" });
    expect((await listCustomPages(s.tenantId, s.actor)).map((p) => p.slug)).toEqual(["contact"]);
    expect((await listContent(s.tenantId, s.actor, "page")).map((p) => p.slug)).toEqual(["delivery"]);
    expect(await getPublishedPage(s.tenantId, "delivery")).not.toBeNull();
    expect(await getPublicCustomPage(s.tenantId, "delivery")).toBeNull();
  });

  it("counts against the plan, and a plan can only be edited by people who may edit the design", async () => {
    const s = await store("STARTER");
    for (const t of ["One page", "Two pages", "Three pages"]) await createCustomPage(s.tenantId, s.actor, { title: t });
    await fails(createCustomPage(s.tenantId, s.actor, { title: "Four pages" }), "PLAN_LIMIT");
    const pro = await store("PRO");
    await fails(createCustomPage(pro.tenantId, actorFor("u-packer", "ORDER_PACKER"), { title: "Nope" }), "FORBIDDEN");
  });

  it("keeps search text plain, and deleting removes the page and its history", async () => {
    const s = await store("BUSINESS");
    const made = await createCustomPage(s.tenantId, s.actor, { title: "Size guide", templateId: "size-guide" });
    await updateCustomPage(s.tenantId, s.actor, made.id, { title: "Sizes", seoTitle: "<b>Sizes</b> guide", seoDescription: "Find <i>your</i> size" });
    const [row] = await listCustomPages(s.tenantId, s.actor);
    expect(row).toMatchObject({ title: "Sizes", seoTitle: "Sizes guide", seoDescription: "Find your size" });
    await saveDraft(s.tenantId, s.actor, made.pageKey, (await loadForEdit(s.tenantId, s.actor, made.pageKey)).page);
    await publish(s.tenantId, s.actor, made.pageKey);
    await deleteCustomPage(s.tenantId, s.actor, made.id);
    expect(await listCustomPages(s.tenantId, s.actor)).toHaveLength(0);
    expect(await owner.themeVersion.count({ where: { pageKey: made.pageKey } })).toBe(0);
    await fails(loadForEdit(s.tenantId, s.actor, made.pageKey), "NOT_FOUND");
  });

  it("a store sees only its own pages", async () => {
    const a = await store("PRO");
    const b = await store("PRO");
    await createCustomPage(a.tenantId, a.actor, { title: "About us" });
    expect(await listCustomPages(b.tenantId, b.actor)).toHaveLength(0);
    expect(await customPageIdBySlug(b.tenantId, "about-us")).toBeNull();
  });
});
