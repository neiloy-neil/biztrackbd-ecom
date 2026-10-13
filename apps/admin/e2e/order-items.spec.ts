import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { actAs, customerOrders, openOrder, orderIdFromUrl } from "./helpers";

/** Changing what is in an open order: quantity, another item, and the rule for orders the customer already paid. */
test.describe.serial("changing the items of an order", () => {
  let orderId = "";
  let orderNumber = "";

  test.beforeEach(async ({ context }) => {
    await actAs(context, "owner");
  });

  test("the owner changes a quantity and adds another product, and the order, total and timeline follow", async ({ browser, page }) => {
    const r = await customerOrders(browser, { slug: "cotton-socks-3-pack", size: "Free size", pay: "COD" });
    orderNumber = r.orderNumber;
    await openOrder(page, orderNumber, "new");
    orderId = orderIdFromUrl(page.url());
    await expect(page.getByTestId("order-total")).toHaveText("৳ 380");
    await page.getByTestId("change-items").click();
    await expect(page.getByTestId("items-title")).toContainText(orderNumber);
    await page.getByTestId("items-qty").first().fill("2");
    await expect(page.getByTestId("items-subtotal")).toHaveText("৳ 600");
    await page.getByTestId("items-search").fill("linen");
    await page.getByTestId("items-results").getByRole("button").first().click();
    await expect(page.getByTestId("items-line")).toHaveCount(2);
    await page.getByTestId("items-save").click();
    await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`));
    await expect(page.getByTestId("timeline")).toContainText("Items changed");
    await expect(page.getByTestId("timeline")).toContainText("1 to 2");
    await expect(page.getByTestId("items-card")).toContainText("Items (3)");
    // 600 + 850 = 1450 goods; delivery is free over 3000 only, so it is still charged
    await expect(page.getByTestId("order-total")).toHaveText(/৳ 1,?530/);
  });

  test("an item is removed, and the last one cannot be", async ({ page }) => {
    await page.goto(`/orders/${orderId}/items`);
    await expect(page.getByTestId("items-line")).toHaveCount(2);
    await page.getByTestId("items-remove").first().click();
    await expect(page.getByTestId("items-line")).toHaveCount(1);
    await expect(page.getByTestId("items-remove")).toBeDisabled();
    await page.getByTestId("items-save").click();
    await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`));
    await expect(page.getByTestId("items-card")).toContainText("Items (1)");
  });

  test("when the customer has paid, a change that alters the total is refused in plain words", async ({ browser, page }) => {
    const r = await customerOrders(browser, { slug: "linen-shirt-sage", size: "M", pay: "bkash" });
    await openOrder(page, r.orderNumber, "check");
    const id = orderIdFromUrl(page.url());
    await page.goto(`/orders/${id}/items`);
    await page.getByTestId("items-qty").first().fill("2");
    await page.getByTestId("items-save").click();
    await expect(page.getByTestId("items-error")).toContainText("already paid or sent a TrxID");
    // nothing was changed
    await page.goto(`/orders/${id}`);
    await expect(page.getByTestId("items-card")).toContainText("Items (1)");
  });

  test("a shipped order cannot be changed", async ({ page }) => {
    await page.goto(`/orders?tab=shipped`);
    await page.locator('[data-testid="order-row"]:visible a[href^="/orders/"]').first().click();
    await expect(page.getByTestId("order-title")).toBeVisible();
    await expect(page.getByTestId("change-items")).toHaveCount(0);
    const id = orderIdFromUrl(page.url());
    await page.goto(`/orders/${id}/items`);
    await expect(page.getByTestId("items-locked")).toContainText("before the order ships");
  });

  test("the change-items screen is accessible, fits the screen and has big enough tap targets", async ({ page }, info) => {
    await page.goto(`/orders/${orderId}/items`);
    await expect(page.getByTestId("items-editor")).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    if (info.project.name.startsWith("mobile")) {
      const small = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("main a[href], main button, main input, main select")].filter((el) => el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().height < 40).map((el) => el.tagName + " " + Math.round(el.getBoundingClientRect().height)));
      expect(small).toEqual([]);
    }
  });
});
