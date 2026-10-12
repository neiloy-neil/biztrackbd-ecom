import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { DEMO, withDb } from "./db";
import { STORE } from "./helpers";

// An owner who pauses orders: customers still browse, see why, and are not left at a checkout that cannot work.
test.describe.serial("a paused store", () => {
  test.afterAll(async () => {
    await withDb((c) => c.query(`UPDATE "StoreSettings" SET "ordersPaused" = false WHERE "tenantId" = (SELECT id FROM "Tenant" WHERE subdomain = $1)`, [DEMO]));
  });

  test("browsing works and a strip says orders are paused", async ({ page }) => {
    await withDb((c) => c.query(`UPDATE "StoreSettings" SET "ordersPaused" = true WHERE "tenantId" = (SELECT id FROM "Tenant" WHERE subdomain = $1)`, [DEMO]));
    await page.goto(`${STORE}/`);
    await expect(page.getByTestId("paused-banner")).toContainText(/orders are paused|অর্ডার বন্ধ/);
    await expect(page.locator("main")).toBeVisible();
  });

  test("checkout shows the short-break notice with ways to reach the owner, and is accessible", async ({ page }) => {
    await page.goto(`${STORE}/checkout`);
    const card = page.getByTestId("paused-card");
    await expect(card).toBeVisible();
    await expect(card.getByRole("link").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /place order|অর্ডার করুন|অর্ডার দিন/i })).toHaveCount(0);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
  });

  test("reopening the store brings the checkout back", async ({ page }) => {
    await withDb((c) => c.query(`UPDATE "StoreSettings" SET "ordersPaused" = false WHERE "tenantId" = (SELECT id FROM "Tenant" WHERE subdomain = $1)`, [DEMO]));
    await page.goto(`${STORE}/checkout`);
    await expect(page.getByTestId("paused-card")).toHaveCount(0);
    await expect(page.getByTestId("paused-banner")).toHaveCount(0);
  });
});
