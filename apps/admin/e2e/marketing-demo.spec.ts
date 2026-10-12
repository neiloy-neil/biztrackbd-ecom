import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { withDb } from "./db";

const MKT = "http://localhost:3002";
const ADMIN = "http://localhost:3001";

const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 2).join(" | ")}`);

test.describe("Try the admin, from the marketing site", () => {
  test.beforeAll(async () => {
    // Earlier runs count against this machine's per-hour limit; forget who started them.
    await withDb((c) => c.query(`UPDATE "Tenant" SET "demoCreator" = NULL WHERE "demoKind" = 'SESSION'`));
  });

  test("the home page offers it three ways, all pointing at the demo", async ({ page }) => {
    await page.goto(MKT);
    const band = page.getByTestId("demo-admin-band");
    await expect(band).toContainText("nothing to sign up for");
    await expect(page.getByTestId("demo-admin-cta")).toHaveAttribute("href", `${ADMIN}/demo`);
    await expect(page.getByTestId("hero-demo-admin")).toHaveAttribute("href", `${ADMIN}/demo`);
    await expect(page.getByTestId("home-templates").locator('a[href*="/demo/start?template="]').first()).toBeVisible();
  });

  test("the pricing and templates pages offer it too", async ({ page }) => {
    await page.goto(`${MKT}/pricing`);
    await expect(page.getByTestId("pricing-demo-admin")).toHaveAttribute("href", `${ADMIN}/demo`);
    await page.goto(`${MKT}/templates`);
    await expect(page.getByTestId("templates-demo-admin")).toHaveAttribute("href", `${ADMIN}/demo`);
    for (const id of ["kapor", "gadgetstudio", "mini-bunny", "axionwear", "bindu", "berber"]) {
      await expect(page.getByTestId(`admin-demo-${id}`)).toHaveAttribute("href", `${ADMIN}/demo/start?template=${id}`);
      await expect(page.getByTestId(`admin-demo-${id}`)).toHaveAttribute("rel", /nofollow/);
    }
  });

  test("the new buttons keep the pages accessible and on screen", async ({ page }) => {
    for (const path of ["/", "/pricing", "/templates"]) {
      await page.goto(`${MKT}${path}`);
      expect(await axe(page), path).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(1);
    }
  });

  test("one click on a template card opens that store's private admin", async ({ page }) => {
    await page.goto(`${MKT}/templates`);
    await page.getByTestId("admin-demo-kapor").click();
    await expect(page).toHaveURL(new RegExp(`^${ADMIN.replace(/[.]/g, "\\.")}/$`), { timeout: 90_000 });
    await expect(page.getByTestId("demo-banner")).toBeVisible();
    await expect(page.getByTestId("dash-stats")).toBeVisible();
  });

  test("the chooser from the home page lists the six stores", async ({ page }) => {
    await page.goto(MKT);
    await page.getByTestId("demo-admin-cta").click();
    await expect(page).toHaveURL(`${ADMIN}/demo`);
    await expect(page.getByTestId("demo-choices").locator("li")).toHaveCount(6);
  });
});
