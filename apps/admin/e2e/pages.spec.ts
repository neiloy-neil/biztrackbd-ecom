import { expect, test, type Browser, type Page } from "@playwright/test";
import { tenantId, withDb } from "./db";
import { STORE, actAs } from "./helpers";

/**
 * Editable product, collection and cart pages (docs/39). The demo store is on Pro, which edits the home page only, so these tests move it
 * to Business for the duration and put it back, along with any layouts they published.
 */
const frameOf = (page: Page) => page.frameLocator('[data-testid="preview-frame"]');
const row = (page: Page, type: string) => page.locator(`[data-testid="section-row"][data-type="${type}"]`);
const saved = (page: Page) => expect(page.getByTestId("design-status")).toHaveAttribute("data-save", "saved", { timeout: 15_000 });
/** On a phone the section list is its own tab; on a computer it is always on screen. */
const layers = async (page: Page) => { const t = page.getByRole("tab", { name: "Sections" }); if (await t.count()) await t.click(); };

async function setPlan(tier: "PRO" | "BUSINESS") {
  await withDb(async (c) => {
    const t = await tenantId();
    await c.query(`UPDATE "Tenant" SET "planTier" = $1 WHERE id = $2`, [tier, t]);
    await c.query(`DELETE FROM "ThemeVersion" WHERE "tenantId" = $1 AND "pageKey" IN ('product', 'collection', 'cart')`, [t]);
  });
}

async function visitor(browser: Browser) {
  const ctx = await browser.newContext({ baseURL: STORE, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addCookies([{ name: "bt_lang", value: "en", url: STORE }]);
  return { ctx, page: await ctx.newPage() };
}

test.describe.serial("product, collection and cart pages in the editor", () => {
  test.beforeAll(async () => setPlan("PRO"));
  test.afterAll(async () => setPlan("PRO"));
  test.beforeEach(async ({ context }) => actAs(context, "owner"));

  test("on the Pro plan the other pages can be looked at but not rearranged", async ({ page }) => {
    await page.goto("/design?page=product");
    await expect(frameOf(page).getByTestId("preview-root")).toBeVisible();
    await expect(page.getByTestId("sections-locked")).toContainText("Business plan");
    await expect(page.getByTestId("add-section")).toHaveCount(0);
    await layers(page);
    await expect(page.getByTestId("section-row")).toHaveCount(3);
    // The home page is still editable on Pro.
    await page.goto("/design");
    await expect(frameOf(page).getByTestId("preview-root")).toBeVisible();
    await layers(page);
    await expect(page.getByTestId("add-section")).toHaveCount(1);
  });

  test("the switcher moves between pages, and each shows a real preview of its own", async ({ page }) => {
    await setPlan("BUSINESS");
    await page.goto("/design");
    await expect(frameOf(page).getByTestId("preview-root")).toBeVisible();
    await page.getByTestId("page-switch").selectOption("product");
    await expect(page).toHaveURL(/\/design\?page=product/);
    await expect(frameOf(page).getByTestId("pdp-price")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("page-switch").selectOption("collection");
    await expect(page).toHaveURL(/page=collection/);
    await expect(frameOf(page).getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
    await expect(frameOf(page).locator(".pcard").first()).toBeVisible();
    await page.getByTestId("page-switch").selectOption("cart");
    await expect(page).toHaveURL(/page=cart/);
    await expect(frameOf(page).getByTestId("cart-sample")).toBeVisible({ timeout: 30_000 });
  });

  test("the product block cannot be hidden or removed, but the page around it can be changed and published", async ({ page, browser }) => {
    await page.goto("/design?page=product");
    await expect(frameOf(page).getByTestId("preview-root")).toBeVisible();
    await layers(page);
    await row(page, "product-main").locator(".bld-pick").click();
    await expect(page.getByRole("button", { name: "Delete this section" })).toHaveCount(0);
    await layers(page);
    await expect(page.getByRole("button", { name: "Hide Product details" })).toBeDisabled();

    // Add a text block and say something in it; the preview follows at once.
    await layers(page);
    await page.getByTestId("add-section").click();
    await page.getByTestId("lib-rich-text").click();
    await page.getByLabel("Heading", { exact: true }).fill("Size guide");
    await page.getByLabel("Text", { exact: true }).fill("Our blazers run true to size.");
    await expect(frameOf(page).getByRole("heading", { name: "Size guide" })).toBeVisible({ timeout: 5000 });
    // Turn off the star rating on the product block.
    await layers(page);
    await row(page, "product-main").locator(".bld-pick").click();
    await page.getByLabel("Show the star rating").uncheck();
    await expect(frameOf(page).locator(".pdp .stars")).toHaveCount(0, { timeout: 5000 });
    await saved(page);
    await page.getByTestId("publish").click();
    await expect(page.getByTestId("design-notice")).toContainText("version 1");

    // A customer's product page now follows the new layout.
    const v = await visitor(browser);
    await v.page.goto("/search");
    const href = await v.page.locator("a.pcard").first().getAttribute("href");
    await v.page.goto(href!);
    await expect(v.page.getByRole("heading", { name: "Size guide" })).toBeVisible();
    await expect(v.page.locator(".pdp .stars")).toHaveCount(0);
    await expect(v.page.getByTestId("pdp-price")).toBeVisible();
    await v.ctx.close();
  });

  test("a store that never edited its collection and cart pages gets the layouts it always had", async ({ browser }) => {
    const v = await visitor(browser);
    await v.page.goto("/search");
    const cat = await v.page.locator('a[href^="/c/"]').first().getAttribute("href").catch(() => null);
    await v.page.goto(cat ?? "/c/shirts");
    await expect(v.page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(v.page.locator(".pcard").first()).toBeVisible();
    await v.page.goto("/cart");
    await expect(v.page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(v.page.getByText(/empty|খালি/i).first()).toBeVisible();
    await v.ctx.close();
  });

  test("each page keeps its own history, separate from the home page", async ({ page }) => {
    await page.goto("/design?page=product");
    await expect(frameOf(page).getByTestId("preview-root")).toBeVisible();
    await page.getByTestId("tab-history").click();
    await expect(page.getByTestId("version-row")).toHaveCount(1);
    await expect(page.getByTestId("version-row").first()).toContainText("Live");
    // The cart page has published nothing, and nothing of the product page's history leaks into it.
    await page.goto("/design?page=cart");
    await expect(frameOf(page).getByTestId("cart-sample")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("tab-history").click();
    await expect(page.getByTestId("version-row")).toHaveCount(0);
  });
});
