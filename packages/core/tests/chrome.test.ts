import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  BUILT_IN_CHROMES,
  DomainError, defaultChrome, discardChromeDraft, getLiveChrome, getPreviewChrome, linkHref, listChromeVersions, loadChromeForEdit, publishChrome, rollbackChrome, saveChromeDraft,
  setEventPublisher, signupStore, validateChrome, type Chrome, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let n = 0;

const actorFor = (userId: string, role: StaffActor["role"] = "STORE_OWNER"): StaffActor => ({ userId, email: "o@example.test", name: "Owner", role });

async function store(plan: "STARTER" | "PRO" | "BUSINESS" = "PRO") {
  const sub = `chr${++n}x${Date.now().toString(36).slice(-5)}`;
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

/** A custom header and footer used across the tests. */
const custom = (): Chrome => ({
  ...defaultChrome(),
  header: { ...defaultChrome().header, logo: "center", search: "icon", sticky: false, announcement: { mode: "custom", text: "Eid sale: 20% off", textBn: "ঈদ ছাড়", link: "/search?sale=1", bgColor: "#8A2855", textColor: "#ffffff" } },
  menu: { auto: false, items: [{ id: "m_new", type: "new", label: "", labelBn: "", ref: "", url: "" }, { id: "m_about", type: "page", label: "About us", labelBn: "আমাদের কথা", ref: "about-us", url: "" }, { id: "m_fb", type: "link", label: "Facebook", labelBn: "", ref: "", url: "https://facebook.com/shop" }] },
  footer: { columns: [{ id: "c_about", type: "about", title: "", titleBn: "", body: "", bodyBn: "", links: [] }, { id: "c_links", type: "links", title: "Quick links", titleBn: "", body: "", bodyBn: "", links: [{ id: "link_1", type: "sale", label: "", labelBn: "", ref: "", url: "" }] }], copyright: "© Shop, all rights reserved", copyrightBn: "" },
});

describe("the header and footer record (docs/47 part C)", () => {
  it("an empty record is today's header and footer, and the default survives a round trip", () => {
    expect(validateChrome({})).toEqual(defaultChrome());
    expect(validateChrome(defaultChrome())).toEqual(defaultChrome());
    expect(defaultChrome().footer.columns.map((c) => c.type)).toEqual(["about", "shop", "help"]);
  });

  it("keeps a custom one as written, with colours in capitals and text as plain text", () => {
    const c = validateChrome(custom());
    expect(c.header.announcement.bgColor).toBe("#8A2855");
    expect(c.header.announcement.textColor).toBe("#FFFFFF");
    expect(c.menu.items.map((i) => linkHref(i))).toEqual(["/search?sort=newest", "/p/about-us", "https://facebook.com/shop"]);
    const dirty = validateChrome({ ...custom(), footer: { ...custom().footer, copyright: "<b>Mine</b><script>alert(1)</script>" } });
    expect(dirty.footer.copyright).not.toMatch(/[<>]/);
  });

  it("refuses what it cannot show safely", () => {
    const c = custom();
    const bad = (patch: Record<string, unknown>) => () => validateChrome({ ...c, ...patch });
    expect(bad({ header: { ...c.header, logo: "diagonal" } })).toThrow(/not one of the choices/);
    expect(bad({ header: { ...c.header, announcement: { ...c.header.announcement, mode: "custom", text: "" } } })).toThrow(/Write the announcement/);
    expect(bad({ header: { ...c.header, announcement: { ...c.header.announcement, bgColor: "red" } } })).toThrow(/colours/);
    expect(bad({ header: { ...c.header, announcement: { ...c.header.announcement, link: "javascript:alert(1)" } } })).toThrow(/https/);
    const menu = (items: unknown[]) => bad({ menu: { auto: false, items } });
    expect(menu([{ id: "x_link", type: "link", label: "Bad", url: "javascript:alert(1)" }])).toThrow(/https/);
    expect(menu([{ id: "x_link", type: "link", label: "Bad", url: "//evil.example" }])).toThrow(/https/);
    expect(menu([{ id: "x_cat", type: "category", label: "", ref: "" }])).toThrow(/choose a category/);
    expect(menu([{ id: "x_cat", type: "category", label: "", ref: "Not A Slug!" }])).toThrow(/choose a category/);
    expect(menu([{ id: "x_page", type: "page", label: "", ref: "about-us" }])).toThrow(/words to show/);
    expect(menu([{ id: "dup_one", type: "new" }, { id: "dup_one", type: "sale" }])).toThrow(/share the id/);
    expect(menu([])).toThrow(/at least one menu item/);
    expect(menu(Array.from({ length: 9 }, (_, i) => ({ id: `item_${i}`, type: "new" })))).toThrow(/at most 8/);
    const col = (id: string, type = "text") => ({ id, type, title: "", titleBn: "", body: "", bodyBn: "", links: [] });
    expect(bad({ footer: { ...c.footer, columns: [] } })).toThrow(/1 to 4 columns/);
    expect(bad({ footer: { ...c.footer, columns: [1, 2, 3, 4, 5].map((i) => col(`col_${i}`)) } })).toThrow(/1 to 4 columns/);
    expect(bad({ footer: { ...c.footer, columns: [col("col_a", "about"), col("col_b", "about")] } })).toThrow(/Only one/);
    expect(bad({ footer: { ...c.footer, columns: [col("col_a", "scripts")] } })).toThrow(/not one of the choices/);
  });
});

describe("saving, publishing and going back", () => {
  it("opens with today's header and footer, saves a draft, and keeps it private until it is published", async () => {
    const s = await store("PRO");
    const first = await loadChromeForEdit(s.tenantId, s.actor);
    // A new store starts with the header and footer of its template, as version 1.
    expect(first).toMatchObject({ isDraft: false, publishedVersion: 1, unpublished: false, editable: true, stamp: null });
    expect(first.chrome).toEqual(BUILT_IN_CHROMES.kapor);
    expect(await getLiveChrome(s.tenantId)).toEqual(BUILT_IN_CHROMES.kapor);

    await saveChromeDraft(s.tenantId, s.actor, custom());
    const drafted = await loadChromeForEdit(s.tenantId, s.actor);
    expect(drafted).toMatchObject({ isDraft: true, unpublished: true });
    expect(drafted.chrome.header.logo).toBe("center");
    // The live store still has the template's; only the editor's preview shows the draft.
    expect(await getLiveChrome(s.tenantId)).toEqual(BUILT_IN_CHROMES.kapor);
    expect((await getPreviewChrome(s.tenantId))!.header.logo).toBe("center");

    const v1 = await publishChrome(s.tenantId, s.actor, "Eid");
    expect(v1).toBe(2);
    expect((await getLiveChrome(s.tenantId))!.menu.items).toHaveLength(3);
    expect((await loadChromeForEdit(s.tenantId, s.actor))).toMatchObject({ isDraft: false, publishedVersion: 2, unpublished: false });
    await fails(publishChrome(s.tenantId, s.actor), "VALIDATION_ERROR", /nothing to publish/);
  });

  it("keeps history, goes back by copying forward, and can throw a draft away", async () => {
    const s = await store("BUSINESS");
    await saveChromeDraft(s.tenantId, s.actor, custom());
    await publishChrome(s.tenantId, s.actor);
    const next = custom();
    next.header.logo = "stacked";
    await saveChromeDraft(s.tenantId, s.actor, next);
    await publishChrome(s.tenantId, s.actor, "Stacked");
    expect((await listChromeVersions(s.tenantId, s.actor)).map((v) => [v.version, v.isLive])).toEqual([[3, true], [2, false], [1, false]]);
    expect((await getLiveChrome(s.tenantId))!.header.logo).toBe("stacked");

    const back = await rollbackChrome(s.tenantId, s.actor, 2);
    expect(back).toBe(4);
    expect((await getLiveChrome(s.tenantId))!.header.logo).toBe("center");
    await fails(rollbackChrome(s.tenantId, s.actor, 99), "NOT_FOUND");

    await saveChromeDraft(s.tenantId, s.actor, next);
    await discardChromeDraft(s.tenantId, s.actor);
    expect((await loadChromeForEdit(s.tenantId, s.actor)).isDraft).toBe(false);
  });

  it("two people cannot silently overwrite each other", async () => {
    const s = await store("PRO");
    const a = await saveChromeDraft(s.tenantId, s.actor, custom(), { stamp: null });
    await fails(saveChromeDraft(s.tenantId, s.actor, custom(), { stamp: null }), undefined, /changed/);
    await saveChromeDraft(s.tenantId, s.actor, custom(), { stamp: a.stamp });
  });

  it("is part of the Pro plan and above, and only people who may edit the design can save", async () => {
    const small = await store("STARTER");
    expect((await loadChromeForEdit(small.tenantId, small.actor)).editable).toBe(false);
    await fails(saveChromeDraft(small.tenantId, small.actor, custom()), undefined, /plan/i);
    const pro = await store("PRO");
    await fails(saveChromeDraft(pro.tenantId, actorFor("u-packer", "ORDER_PACKER"), custom()), "FORBIDDEN");
  });

  it("a store sees only its own header and footer", async () => {
    const a = await store("PRO");
    const b = await store("PRO");
    await saveChromeDraft(a.tenantId, a.actor, custom());
    await publishChrome(a.tenantId, a.actor);
    expect(await getLiveChrome(b.tenantId)).toEqual(BUILT_IN_CHROMES.kapor);
    expect(await getPreviewChrome(b.tenantId)).toEqual(BUILT_IN_CHROMES.kapor);
    expect((await getLiveChrome(a.tenantId))!.header.logo).toBe("center");
  });
});
