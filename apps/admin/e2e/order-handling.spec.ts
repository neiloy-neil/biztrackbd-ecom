import { expect, test } from "@playwright/test";
import { actAs, customerOrders, openOrder, orderIdFromUrl } from "./helpers";

/** Labels, the call note, confirming and cancelling many orders at once, and the orders spreadsheet. */
test.describe.serial("handling orders", () => {
  let orderNumber = "";
  let orderId = "";
  const label = `gift${Date.now().toString(36).slice(-4)}`;

  test.beforeEach(async ({ context }) => {
    await actAs(context, "owner");
  });

  test("a label and a call note go on an order and show on the list, the banner and the packing slip", async ({ browser, page }) => {
    const r = await customerOrders(browser, { slug: "cotton-socks-3-pack", size: "Free size", pay: "COD" });
    orderNumber = r.orderNumber;
    await openOrder(page, orderNumber, "new");
    orderId = orderIdFromUrl(page.url());
    await page.getByTestId("labels-input").fill(`${label}, call first`);
    await page.getByRole("button", { name: "Save labels" }).click();
    await expect(page.getByTestId("timeline")).toContainText(`Labels: ${label}, call first`);
    await page.getByTestId("call-note-input").fill("Said deliver after 6pm");
    await page.getByRole("button", { name: "Save call note" }).click();
    await expect(page.getByTestId("call-note-banner")).toContainText("Said deliver after 6pm");

    await page.goto(`/orders?tag=${encodeURIComponent(label)}`);
    const row = page.locator('[data-testid="order-row"]:visible').first();
    await expect(row).toContainText(orderNumber);
    await expect(row.getByTestId("order-tag").first()).toHaveText(label);
    await expect(page.locator('[data-testid="order-row"]:visible')).toHaveCount(1);

    await page.goto(`/orders/print?ids=${orderId}&doc=slip&size=a5`);
    await expect(page.getByTestId("print-sheet")).toContainText("Said deliver after 6pm");
    await expect(page.getByTestId("print-sheet")).toContainText(`Labels: ${label}, call first`);
  });

  test("the spreadsheet follows the filters and carries the labels and call note", async ({ page }) => {
    const res = await page.request.get(`/orders/export?tag=${encodeURIComponent(label)}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    const text = await res.text();
    const lines = text.replace(/^\uFEFF/, "").split("\r\n");
    expect(lines[0]).toContain('"Order"');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(orderNumber);
    expect(lines[1]).toContain("Said deliver after 6pm");
    // the screen offers the same download with the current filters
    await page.goto(`/orders?tag=${encodeURIComponent(label)}`);
    await expect(page.getByTestId("export-orders")).toHaveAttribute("href", new RegExp(`tag=${label}`));
  });

  test("support staff can read the call note", async ({ context, page }) => {
    await actAs(context, "support");
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByTestId("call-note-banner")).toContainText("Said deliver after 6pm");
  });

  test("several orders are confirmed at once from the list", async ({ browser, page }) => {
    const a = await customerOrders(browser, { slug: "cotton-socks-3-pack", size: "Free size", pay: "COD" });
    const b = await customerOrders(browser, { slug: "cotton-socks-3-pack", size: "Free size", pay: "COD" });
    await page.goto("/orders?tab=new");
    for (const n of [a.orderNumber, b.orderNumber]) await page.locator(`input[name="ids"][aria-label="Select ${n}"]:visible`).check();
    await page.getByTestId("bulk-confirm").click();
    await expect(page.getByTestId("status-msg")).toContainText("2 confirmed");
    await page.goto("/orders?tab=to_pack");
    await expect(page.locator(`a:has-text("${a.orderNumber}"):visible`).first()).toBeVisible();
    await expect(page.locator(`a:has-text("${b.orderNumber}"):visible`).first()).toBeVisible();
  });

  test("cancelling many needs a reason, then cancels them and says so", async ({ browser, page }) => {
    const a = await customerOrders(browser, { slug: "cotton-socks-3-pack", size: "Free size", pay: "COD" });
    await page.goto("/orders?tab=new");
    await page.locator(`input[name="ids"][aria-label="Select ${a.orderNumber}"]:visible`).check();
    await page.getByTestId("bulk-cancel").click();
    await expect(page.getByText(/Say briefly why you are cancelling/)).toBeVisible();
    await page.locator(`input[name="ids"][aria-label="Select ${a.orderNumber}"]:visible`).check();
    await page.getByTestId("bulk-reason").fill("Fake order");
    await page.getByTestId("bulk-cancel").click();
    await expect(page.getByTestId("status-msg")).toContainText("1 cancelled");
    await page.goto("/orders?tab=cancelled");
    await expect(page.locator(`a:has-text("${a.orderNumber}"):visible`).first()).toBeVisible();
  });

  test("the owner texts the customer from the order, and the words are on the timeline", async ({ page }) => {
    await page.goto(`/orders/${orderId}`);
    const words = `Your parcel goes out tomorrow ${Date.now().toString(36)}`;
    await page.getByTestId("message-text").fill(words);
    await page.getByTestId("message-send").click();
    await expect(page.getByTestId("timeline")).toContainText(`SMS to customer: ${words}`);
    await expect(page.getByTestId("timeline")).toContainText("Nusrat Jahan");
  });
});
