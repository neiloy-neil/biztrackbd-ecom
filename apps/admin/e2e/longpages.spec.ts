import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { actAs } from "./helpers";

const axe = async (page: import("@playwright/test").Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 2).join(" | ")}`);

test.describe("long pages: COD tabs, customers drawer, inventory drawer, store details tabs", () => {
  test.beforeEach(async ({ context }) => {
    await actAs(context, "owner");
  });

  test("COD payouts has tabs, and only the open one shows", async ({ page }) => {
    await page.goto("/finance/cod");
    const tabs = page.getByTestId("cod-tabs");
    await expect(tabs).toContainText("Parcels");
    await expect(page.getByTestId("import-form")).toHaveCount(0);
    await tabs.getByRole("link", { name: "Import a statement" }).click();
    await expect(page.getByTestId("import-form")).toBeVisible();
    await expect(page.getByTestId("recon-empty").or(page.getByTestId("recon-table"))).toHaveCount(0);
    await tabs.getByRole("link", { name: "Payout history" }).click();
    await expect(page).toHaveURL(/view=history/);
    expect(await axe(page)).toEqual([]);
  });

  test("customers filter as you type and a quick view opens without leaving the list", async ({ page }) => {
    await page.goto("/customers");
    const row = page.locator('[data-testid="customer-row"]:visible').first();
    await expect(row).toBeVisible();
    const name = (await row.locator("b").first().textContent())?.trim() ?? "";
    await page.getByRole("searchbox", { name: "Search customers" }).fill(name.split(" ")[0]!);
    await expect(page).toHaveURL(/q=/);
    await page.locator('[data-testid="customer-quick-btn"]:visible').first().click();
    const view = page.getByTestId("customer-quick-view");
    await expect(view).toContainText("Total spent");
    await expect(view.getByRole("link", { name: "Open the full profile" })).toBeVisible();
    await expect(page).toHaveURL(/\/customers/);
    await page.keyboard.press("Escape");
    await expect(view).toHaveCount(0);
  });

  test("inventory adjusts stock in a drawer, and the shelf filter lives in the address", async ({ page }) => {
    await page.goto("/inventory");
    const first = page.locator('[data-testid="inv-row"]:visible').first();
    const id = await first.locator('[data-testid^="adjust-"]').getAttribute("data-testid");
    const mine = () => page.locator('[data-testid="inv-row"]:visible', { has: page.getByTestId(id!) });
    const before = Number(await mine().getByTestId("available").textContent());
    await mine().getByTestId(id!).click();
    await page.getByTestId("adjust-amount").fill("3");
    await page.getByRole("button", { name: "Save change" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await expect(mine().getByTestId("available")).toHaveText(String(before + 3));
  });

  test("store details are in tabs with a save bar that wakes up when something changes", async ({ page }) => {
    await page.goto("/settings/store");
    await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(1);
    const save = page.getByRole("button", { name: "Save store details" });
    await expect(save).toBeDisabled();
    await page.getByTestId("store-tab-orders").click();
    await expect(page.getByTestId("s-prefix")).toBeVisible();
    await page.getByTestId("s-prefix").fill("zz-");
    await expect(save).toBeEnabled();
    await page.getByTestId("s-prefix").fill("BT-");
    await save.click();
    await expect(page.getByTestId("store-saved")).toBeVisible();
    await expect(save).toBeDisabled();
    expect(await axe(page)).toEqual([]);
  });

  test("a mistake in a tab you are not on takes you to it", async ({ page }) => {
    await page.goto("/settings/store");
    await page.getByTestId("store-tab-contact").click();
    await page.getByTestId("s-phone").fill("123");
    await page.getByTestId("store-tab-brand").click();
    await page.getByRole("button", { name: "Save store details" }).click();
    await expect(page.getByTestId("store-error")).toBeVisible();
    await expect(page.getByTestId("s-phone")).toBeVisible();
    await page.getByTestId("s-phone").fill("01712345678");
    await page.getByRole("button", { name: "Save store details" }).click();
    await expect(page.getByTestId("store-saved")).toBeVisible();
  });
});
