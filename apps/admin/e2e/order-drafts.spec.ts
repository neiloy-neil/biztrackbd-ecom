import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { STORE, actAs, freshPhone } from "./helpers";

/** The owner sets up an order on the quick desk, sends the customer a link, and the customer places it. */
async function fillDesk(page: Page, phone: string) {
  await page.goto("/orders/new");
  await page.getByTestId("desk-phone").fill(phone.slice(1));
  await page.getByTestId("desk-name").fill("Draft Customer");
  await page.getByTestId("desk-upazila").selectOption("Mirpur");
  await page.getByTestId("desk-address").fill("House 21, Road 5, Mirpur 10");
  await page.getByTestId("desk-search").fill("socks");
  await page.getByTestId("desk-results").getByRole("button").first().click();
  await expect(page.getByTestId("desk-line")).toHaveCount(1);
}

test.describe.serial("draft orders", () => {
  let link = "";
  let phone = "";

  test.beforeEach(async ({ context }) => {
    await actAs(context, "owner");
  });

  test("the owner saves a draft on the quick desk and gets a link; no order is made yet", async ({ page }) => {
    phone = freshPhone();
    await fillDesk(page, phone);
    await page.getByTestId("desk-draft").click();
    await expect(page.getByTestId("desk-draft-done")).toBeVisible();
    link = await page.getByTestId("desk-draft-link").inputValue();
    expect(link).toMatch(/\/draft\/[A-Za-z0-9_-]{12}$/);
    await page.goto("/orders/drafts");
    const row = page.getByTestId("draft-row").first();
    await expect(row).toContainText("Draft Customer");
    await expect(row).toContainText("Waiting for the customer");
    // nothing was ordered for this phone
    await page.goto(`/orders?q=${phone.slice(-8)}`);
    await expect(page.getByTestId("orders-empty")).toBeVisible();
  });

  test("the customer opens the link, checks it and places it with cash on delivery", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.addCookies([{ name: "bt_lang", value: "en", url: STORE }]);
    const page = await ctx.newPage();
    await page.goto(link);
    await expect(page.getByTestId("draft-page")).toContainText("Please check your order");
    await expect(page.getByTestId("draft-page")).toContainText("Draft Customer");
    await expect(page.getByTestId("draft-line")).toHaveCount(1);
    await expect(page.getByTestId("draft-total")).toContainText("380");
    await page.getByTestId("draft-place").click();
    await expect(page).toHaveURL(/\/order\//);
    await expect(page.getByTestId("order-success")).toContainText(/BT-\d+/);
    // the link now leads to the order, and placing it again makes no second order
    await page.goto(link);
    await expect(page).toHaveURL(/\/order\//);
    await ctx.close();
  });

  test("the owner sees it placed, with a note on the order saying where it came from", async ({ page }) => {
    await page.goto(`/orders?q=${phone.slice(-8)}`);
    await expect(page.locator('[data-testid="order-row"]:visible')).toHaveCount(1);
    await page.locator('[data-testid="order-row"]:visible a[href^="/orders/"]').first().click();
    await expect(page.getByTestId("timeline")).toContainText("Placed from the order link");
    await page.goto("/orders/drafts");
    await expect(page.getByTestId("draft-row").first()).toContainText("Placed");
    await expect(page.getByTestId("draft-row").first().getByRole("link", { name: "Open the order" })).toBeVisible();
  });

  test("a cancelled draft's link says so in plain words", async ({ page, browser }) => {
    await fillDesk(page, freshPhone());
    await page.getByTestId("desk-draft").click();
    const other = await page.getByTestId("desk-draft-link").inputValue();
    await page.goto("/orders/drafts");
    await page.getByTestId("draft-row").first().getByRole("button", { name: "Cancel it" }).click();
    await expect(page.getByTestId("draft-row").first()).toContainText("Cancelled");
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "bt_lang", value: "en", url: STORE }]);
    const c = await ctx.newPage();
    await c.goto(other);
    await expect(c.getByTestId("draft-gone")).toContainText("cancelled");
    await c.goto(`${STORE}/draft/AAAAAAAAAAAA`);
    await expect(c.getByTestId("draft-gone")).toContainText("not valid");
    await ctx.close();
  });
});
