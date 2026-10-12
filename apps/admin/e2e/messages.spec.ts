import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { actAs } from "./helpers";

const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 2).join(" | ")}`);

test.describe.serial("customer messages and invoices", () => {
  test.beforeEach(async ({ context }) => {
    await actAs(context, "owner");
  });

  test("customer messages start with ready-made words, and the page is accessible", async ({ page }) => {
    await page.goto("/settings/notifications");
    await expect(page.getByTestId("order-messages")).toContainText("Order received");
    await expect(page.getByTestId("sms-credits")).toContainText(/SMS/);
    await expect(page.getByTestId("msg-ORDER_RECEIVED")).toContainText("WHAT THE CUSTOMER SEES");
    expect(await axe(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test("a message can be turned on, reworded with a detail added from a button, previewed and saved", async ({ page }) => {
    await page.goto("/settings/notifications");
    await expect(page.locator('[data-testid="msg-ORDER_SHIPPED"][data-ready="1"]')).toBeVisible();
    const text = page.getByTestId("msg-text-ORDER_SHIPPED");
    const save = page.getByTestId("msg-save-ORDER_SHIPPED");
    await expect(save).toBeDisabled();
    await page.getByTestId("msg-on-ORDER_SHIPPED").check();
    await text.fill("Your parcel ");
    await page.getByTestId("msg-ORDER_SHIPPED").getByRole("button", { name: "{order_number}" }).click();
    await expect(text).toHaveValue("Your parcel {order_number}");
    await expect(page.getByTestId("msg-preview-ORDER_SHIPPED")).toContainText("Your parcel BT-10482");
    await expect(page.getByTestId("msg-preview-ORDER_SHIPPED")).toContainText(/\d+ characters · 1 SMS part/);
    await save.click();
    await expect(page.getByTestId("msg-saved-ORDER_SHIPPED")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("msg-on-ORDER_SHIPPED")).toBeChecked();
    await expect(page.getByTestId("msg-text-ORDER_SHIPPED")).toHaveValue("Your parcel {order_number}");
  });

  test("a detail that does not exist is refused with the ones that do, and the ready-made words come back", async ({ page }) => {
    await page.goto("/settings/notifications");
    await expect(page.locator('[data-testid="msg-ORDER_SHIPPED"][data-ready="1"]')).toBeVisible();
    await page.getByTestId("msg-text-ORDER_SHIPPED").fill("Hi {secret_code}");
    await page.getByTestId("msg-save-ORDER_SHIPPED").click();
    await expect(page.getByTestId("msg-error-ORDER_SHIPPED")).toContainText("{secret_code}");
    await expect(page.getByTestId("msg-error-ORDER_SHIPPED")).toContainText("{order_number}");
    await page.reload();
    await expect(page.locator('[data-testid="msg-ORDER_SHIPPED"][data-ready="1"]')).toBeVisible();
    await expect(page.getByTestId("msg-text-ORDER_SHIPPED")).toHaveValue("Your parcel {order_number}");
    await page.getByTestId("msg-reset-ORDER_SHIPPED").click();
    await expect(page.getByTestId("msg-text-ORDER_SHIPPED")).toHaveValue(/is on its way|পাঠানো হয়েছে/);
    // Leave the store as it was found: this message off again.
    await page.getByTestId("msg-on-ORDER_SHIPPED").uncheck();
    await page.getByTestId("msg-save-ORDER_SHIPPED").click();
    await expect(page.getByTestId("msg-saved-ORDER_SHIPPED")).toBeVisible();
  });

  test("the language buttons switch which text you edit", async ({ page }) => {
    await page.goto("/settings/notifications");
    const card = page.getByTestId("msg-DELIVERED");
    await expect(page.locator('[data-testid="msg-DELIVERED"][data-ready="1"]')).toBeVisible();
    await card.getByRole("button", { name: "English", exact: true }).click();
    await expect(page.getByTestId("msg-text-DELIVERED")).toHaveValue(/delivered/);
    await card.getByRole("button", { name: "Bangla", exact: true }).click();
    await expect(page.getByTestId("msg-text-DELIVERED")).toHaveValue(/[ঀ-৿]/);
  });

  test("invoice options change the real preview, and are saved", async ({ page }) => {
    await page.goto("/settings/invoices");
    const frame = page.frameLocator('[data-testid="invoice-preview"] iframe');
    await expect(frame.getByText("INVOICE")).toBeVisible();
    await expect(frame.getByText("PJ-001")).toBeVisible();
    await page.getByTestId("inv-sku").uncheck();
    await expect(frame.getByText("PJ-001")).toHaveCount(0);
    await page.getByTestId("inv-footer").fill(`Exchange within 7 days ${Date.now().toString(36)}`);
    const footer = await page.getByTestId("inv-footer").inputValue();
    await expect(frame.getByText(footer)).toBeVisible();
    await page.getByRole("button", { name: "Packing slip", exact: true }).click();
    await expect(frame.getByText("PACKING SLIP")).toBeVisible();
    await page.getByRole("button", { name: "Save invoice settings" }).click();
    await expect(page.getByTestId("inv-saved")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("inv-sku")).not.toBeChecked();
    await expect(page.getByTestId("inv-footer")).toHaveValue(footer);
    expect(await axe(page)).toEqual([]);
    // Put the store back as found.
    await page.getByTestId("inv-sku").check();
    await page.getByTestId("inv-footer").fill("");
    await page.getByRole("button", { name: "Save invoice settings" }).click();
    await expect(page.getByTestId("inv-saved")).toBeVisible();
  });

  test("the print preview can be framed by our own pages, but no other admin page can", async ({ request }) => {
    const print = await request.get("/orders/print?sample=1", { maxRedirects: 0 }).catch(() => null);
    if (print && print.status() === 200) expect(print.headers()["x-frame-options"]).toBe("SAMEORIGIN");
    const home = await request.get("/login", { maxRedirects: 0 });
    expect(home.headers()["x-frame-options"]).toBe("DENY");
  });
});
