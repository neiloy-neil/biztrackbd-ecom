import { expect, test } from "@playwright/test";
import { tenantId, withDb } from "./db";
import { STORE, actAs } from "./helpers";

/**
 * Phase 10: the screens that close the known gaps of Phases 7 to 9 (the sign-in itself is tested against the real service in
 * e2e-real): the loyalty settings for levels, expiry and birthday, the Apps page, a scheduled post, and two people editing one design.
 */
test.describe.serial("phase 10: closing the known gaps", () => {
  test.beforeAll(async () => {
    await withDb(async (c) => {
      const t = await tenantId();
      await c.query(`DELETE FROM "BlogPost" WHERE "tenantId" = $1 AND slug LIKE 'e2e-%'`, [t]);
      await c.query(`DELETE FROM "TenantModule" WHERE "tenantId" = $1`, [t]).catch(() => undefined);
    });
  });
  test.afterAll(async () => {
    await withDb(async (c) => {
      const t = await tenantId();
      await c.query(`DELETE FROM "BlogPost" WHERE "tenantId" = $1 AND slug LIKE 'e2e-%'`, [t]);
      await c.query(
        `UPDATE "StoreSettings" SET "loyaltyExpiryMonths" = 0, "vipSilverMin" = 5000, "vipGoldMin" = 15000, "vipPlatinumMin" = 35000, "vipGoldDiscount" = 5, "vipPlatinumDiscount" = 10, "birthdayVoucherBdt" = 100 WHERE "tenantId" = $1`,
        [t],
      );
    });
  });
  test.beforeEach(async ({ context }) => actAs(context, "owner"));

  test("the owner sets the VIP levels, expiry and birthday voucher, and levels that do not go up are refused", async ({ page }) => {
    await page.goto("/marketing/loyalty");
    await page.getByLabel("Silver from (৳ delivered in 12 months)").fill("9000");
    await page.getByLabel("Gold from (৳)").fill("4000");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByTestId("loyalty-error")).toContainText("must go up");

    await page.getByLabel("Silver from (৳ delivered in 12 months)").fill("2000");
    await page.getByLabel("Gold from (৳)").fill("6000");
    await page.getByLabel("Platinum from (৳)").fill("12000");
    await page.getByLabel("Gold takes this % off every order").fill("7");
    await page.getByLabel(/Points expire after this many months/).fill("12");
    await page.getByLabel(/Birthday voucher for Silver/).fill("150");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();
    await expect(page.getByLabel("Gold from (৳)")).toHaveValue("6000");
    await expect(page.getByLabel(/Points expire after this many months/)).toHaveValue("12");
    const row = await withDb(async (c) => (await c.query(`SELECT "vipSilverMin", "vipGoldDiscount", "loyaltyExpiryMonths", "birthdayVoucherBdt" FROM "StoreSettings" WHERE "tenantId" = $1`, [await tenantId()])).rows[0]);
    expect(row).toMatchObject({ vipSilverMin: 2000, vipGoldDiscount: 7, loyaltyExpiryMonths: 12, birthdayVoucherBdt: 150 });
  });

  test("the Apps page lists what is built, and the owner switches loyalty off and on", async ({ page }) => {
    await page.goto("/settings/apps");
    const loyalty = page.getByTestId("app-loyalty");
    await expect(loyalty).toContainText("Loyalty, VIP levels and referrals");
    await expect(loyalty).toContainText("On");
    await expect(page.getByTestId("app-wholesale")).toContainText("Not available yet");
    await expect(page.getByTestId("app-wholesale").getByRole("button")).toHaveCount(0);
    await loyalty.getByRole("button", { name: "Switch off" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await expect(page.getByTestId("app-loyalty")).toContainText("Off");
    await page.getByTestId("app-loyalty").getByRole("button", { name: "Switch on" }).click();
    await expect(page.getByTestId("app-loyalty")).toContainText("On");
  });

  test("staff without billing access cannot open the Apps page", async ({ page, context }) => {
    await actAs(context, "packer");
    await page.goto("/settings/apps");
    await expect(page).toHaveURL(/\/no-access/);
  });

  test("a post scheduled for later is marked Scheduled and stays hidden from readers", async ({ page, browser }) => {
    const later = new Date(Date.now() + 3 * 86_400_000 + 6 * 3600_000).toISOString().slice(0, 16);
    await page.goto("/content?tab=posts&edit=new");
    await page.getByLabel("Title").fill("E2E Eid collection");
    await page.getByLabel("Web address (optional)").fill("e2e-eid-collection");
    await page.getByLabel("Text").fill("Coming soon.");
    await page.getByLabel("Visible to customers").check();
    await page.getByLabel("Show it from (optional)").fill(later);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("content-status")).toHaveText("Scheduled");

    const ctx = await browser.newContext({ baseURL: STORE });
    const v = await ctx.newPage();
    expect((await v.goto("/blog/e2e-eid-collection"))?.status()).toBe(404);

    // The time arrives: nobody does anything, and it is there.
    await withDb(async (c) => c.query(`UPDATE "BlogPost" SET "publishAt" = (now() at time zone 'utc') - interval '1 day' WHERE "tenantId" = $1 AND slug = 'e2e-eid-collection'`, [await tenantId()]));
    expect((await v.goto("/blog/e2e-eid-collection"))?.status()).toBe(200);
    await page.reload();
    await expect(page.getByTestId("content-status")).toHaveText("Published");
    await ctx.close();
  });

  test("a second person saving the same design is told, and can load theirs or keep their own", async ({ page }) => {
    await page.goto("/design");
    await page.getByTestId("tab-theme").click();
    // Make a first change so a draft (and its stamp) exists, and wait for it to save.
    const colour = page.locator('input[type="color"]').first();
    await colour.fill("#aa3366");
    await expect(page.getByText("Draft saved. Not published yet.")).toBeVisible();

    // Someone else saves the draft behind this person's back.
    await withDb(async (c) => c.query(`UPDATE "ThemeVersion" SET "updatedAt" = (now() at time zone 'utc') + interval '1 minute' WHERE "tenantId" = $1 AND "pageKey" = 'home' AND state = 'DRAFT'`, [await tenantId()]));

    await colour.fill("#336699");
    await expect(page.getByTestId("design-conflict")).toBeVisible();
    await expect(page.getByTestId("design-conflict")).toContainText("Someone else changed this page");

    await page.getByTestId("conflict-mine").click();
    await expect(page.getByTestId("design-conflict")).toHaveCount(0);
    await expect(page.getByText("Draft saved. Not published yet.")).toBeVisible();

    // Once more, and this time take theirs.
    await withDb(async (c) => c.query(`UPDATE "ThemeVersion" SET "updatedAt" = (now() at time zone 'utc') + interval '2 minute' WHERE "tenantId" = $1 AND "pageKey" = 'home' AND state = 'DRAFT'`, [await tenantId()]));
    await colour.fill("#119955");
    await expect(page.getByTestId("design-conflict")).toBeVisible();
    await page.getByTestId("conflict-theirs").click();
    await expect(page.getByTestId("design-conflict")).toHaveCount(0);
    // Leave the store as it was.
    await withDb(async (c) => c.query(`DELETE FROM "ThemeVersion" WHERE "tenantId" = $1 AND "pageKey" = 'home' AND state = 'DRAFT'`, [await tenantId()]));
  });
});
