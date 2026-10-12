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

  test("Keep this store: a demo with the visitor's own changes becomes a real free-trial store with them in it", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const sub = `keep-${stamp}`;
    // 1. Start a demo and change something.
    await page.goto(`${MKT}/templates`);
    await page.getByTestId("admin-demo-kapor").click();
    await expect(page.getByTestId("demo-banner")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId("demo-banner")).toContainText("unless you keep it");
    await page.goto(`${ADMIN}/products/new`);
    await expect(page.getByTestId("product-editor")).toBeVisible();
    await page.getByTestId("p-title").fill(`Kept Panjabi ${stamp}`);
    await page.getByTestId("p-price").fill("1750");
    await page.getByTestId("p-stock").fill("12");
    await page.getByTestId("publish").click();
    await expect(page).toHaveURL(/\/products\/[a-z0-9]+\?saved=1/, { timeout: 30_000 });
    // 2. Keep it: the button carries the code to the signup, which says what comes along.
    const keep = await page.getByTestId("demo-keep").getAttribute("href");
    expect(keep).toMatch(/\/start\?from=[0-9a-f-]{36}\./);
    await page.goto(keep!.replace(/^https?:\/\/[^/]+/, MKT));
    await expect(page.getByTestId("keep-note")).toContainText("Your demo store comes with you");
    // 3. Sign up as usual.
    await page.getByTestId("f-ownerName").fill("Nusrat Jahan");
    await page.getByTestId("f-email").fill(`${sub}@example.test`);
    await page.getByTestId("f-phone").fill(`01${3 + (Date.now() % 7)}${String(Date.now() % 100_000_000).padStart(8, "0")}`);
    await page.getByTestId("next").click();
    await page.getByTestId("f-storeName").fill(`Kept Store ${stamp}`);
    await page.getByTestId("next").click();
    await page.getByTestId("f-subdomain").fill(sub);
    await expect(page.getByTestId("address-status")).toContainText("is available");
    await page.getByTestId("next").click();
    await page.getByTestId("next").click();
    await page.getByTestId("create").click();
    await expect(page.getByTestId("kept-done")).toContainText("products", { timeout: 60_000 });
    // 4. The new store has the visitor's product, with its pictures, and the demo's code is spent.
    const rows = await withDb((c) => c.query(`SELECT p.title, (SELECT count(*) FROM "ProductImage" i WHERE i."productId" = p.id)::int AS pics FROM "Product" p JOIN "Tenant" t ON t.id = p."tenantId" WHERE t.subdomain = $1`, [sub]));
    expect(rows.rows.map((r) => r.title)).toContain(`Kept Panjabi ${stamp}`);
    expect(rows.rows.filter((r) => r.pics > 0).length).toBeGreaterThan(3);
    const t = await withDb((c) => c.query(`SELECT "isDemo", status FROM "Tenant" WHERE subdomain = $1`, [sub]));
    expect(t.rows[0]).toMatchObject({ isDemo: false, status: "TRIAL" });
    await page.goto(keep!.replace(/^https?:\/\/[^/]+/, MKT));
    await expect(page.getByTestId("keep-note")).toHaveCount(0);
  });
});
