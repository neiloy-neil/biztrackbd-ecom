import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import { CATEGORY_THEMES, DEMO_TEMPLATES, isThemeId, setEventPublisher, signupStore, themeDefinition } from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

const phone = () => `0192${String(1000000 + ++seq).slice(-7)}`;
async function signup(over: Record<string, unknown>) {
  const n = ++seq;
  return signupStore({ ownerName: "Nusrat Jahan", email: `theme${n}@example.test`, phone: phone(), storeName: `Theme ${n}`, subdomain: `theme${n}shop`, plan: "STARTER", ...over });
}

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
});
afterAll(async () => {
  await app.$disconnect();
  await owner.$disconnect();
});

const themeOf = async (tenantId: string) => {
  const t = await owner.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const install = await owner.themeInstall.findFirstOrThrow({ where: { tenantId, isActive: true } });
  return { themeId: t.themeId, templateId: t.templateId, installed: install.themeId, rendered: themeDefinition(t.themeId).id, products: await owner.product.count({ where: { tenantId } }) };
};

describe("the theme a new store starts on follows its category", () => {
  it("has a real, installed theme for every category the wizard offers", () => {
    for (const [category, theme] of Object.entries(CATEGORY_THEMES)) expect(isThemeId(theme), `${category} -> ${theme}`).toBe(true);
    // Every category has a look of its own; nobody is lumped onto Kapor.
    expect(new Set(Object.values(CATEGORY_THEMES)).size).toBe(Object.keys(CATEGORY_THEMES).length);
  });

  for (const category of Object.keys(CATEGORY_THEMES) as (keyof typeof CATEGORY_THEMES)[]) {
    it(`${category}: lands on ${CATEGORY_THEMES[category]} with no theme sent, and with the wizard's theme sent`, async () => {
      for (const sent of [{}, { theme: "" }, { theme: CATEGORY_THEMES[category] }]) {
        const s = await signup({ category, ...sent });
        const got = await themeOf(s.tenantId);
        expect(got, JSON.stringify(sent)).toMatchObject({ themeId: CATEGORY_THEMES[category], installed: CATEGORY_THEMES[category], rendered: CATEGORY_THEMES[category], templateId: CATEGORY_THEMES[category] });
        expect(got.products).toBeGreaterThan(0);
      }
    });
  }

  it("keeps a theme chosen on purpose, and its sample products follow that theme", async () => {
    const s = await signup({ category: "BEAUTY", theme: "gadgetstudio" });
    const got = await themeOf(s.tenantId);
    expect(got).toMatchObject({ themeId: "gadgetstudio", rendered: "gadgetstudio" });
    const titles = (await owner.product.findMany({ where: { tenantId: s.tenantId }, select: { title: true } })).map((p) => p.title);
    const gadget = DEMO_TEMPLATES.find((t) => t.id === "gadgetstudio")!;
    expect(titles.some((t) => gadget.products.some((p) => p.title === t))).toBe(true);
  });

  it("refuses a theme that does not exist instead of quietly using Kapor", async () => {
    await expect(signup({ category: "GROCERY", theme: "no-such-theme" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
