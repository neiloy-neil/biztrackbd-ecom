import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { actAs } from "./helpers";

const stamp = Date.now().toString(36);
const csv = [
  "title,price,stock,sku,status,category,description,compare_at_price",
  `Imp ${stamp} Gamchha,450,12,IMP-${stamp}-1,draft,Imp ${stamp} Cat,Soft & light,550`,
  `Imp ${stamp} Lungi,700,5,IMP-${stamp}-2,active,Imp ${stamp} Cat,,`,
  `Imp ${stamp} Broken,abc,1,,,,,`,
].join("\n");

test.describe.serial("products: import, filter, bulk actions, grid", () => {
  test.beforeEach(async ({ context }) => {
    await actAs(context, "owner");
  });

  test("a CSV adds products, and a bad row is reported by line without stopping the rest", async ({ page }) => {
    await page.goto("/products");
    await page.getByTestId("import-csv").click();
    await expect(page).toHaveURL(/\/products\/import/);
    await page.getByTestId("import-file").setInputFiles({ name: "products.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.getByTestId("import-go").click();
    await expect(page.getByTestId("import-result")).toContainText("2 products added, 1 not added");
    await expect(page.getByTestId("import-failed")).toContainText("Line 4");
    await expect(page.getByTestId("import-failed")).toContainText("Price must be a number above 0");
  });

  test("a file without the needed columns is refused with a plain message", async ({ page }) => {
    await page.goto("/products/import");
    await page.getByTestId("import-file").setInputFiles({ name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from("name,colour\nShirt,red\n") });
    await page.getByTestId("import-go").click();
    await expect(page.getByTestId("import-error")).toContainText("title and price");
  });

  test("the list filters as you type, by category, and counts per tab", async ({ page }) => {
    await page.goto("/products");
    await page.getByRole("searchbox", { name: "Search products" }).fill(`Imp ${stamp}`);
    await expect(page).toHaveURL(/q=Imp/);
    const rows = page.locator('[data-testid="product-row"]:visible');
    await expect(rows).toHaveCount(2);
    await page.getByRole("link", { name: /^Draft/ }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Gamchha");
  });

  test("select all and publish; the products move to Active", async ({ page }) => {
    await page.goto(`/products?tab=draft&q=Imp ${stamp}`);
    await page.getByRole("button", { name: /Select all/ }).click();
    await expect(page.getByTestId("bulk-bar")).toContainText("1 selected");
    await page.getByTestId("bulk-publish").click();
    await expect(page.getByTestId("bulk-msg")).toContainText("1 product published");
    await page.goto(`/products?tab=active&q=Imp ${stamp}`);
    await expect(page.locator('[data-testid="product-row"]:visible')).toHaveCount(2);
  });

  test("the grid layout shows the same products, and is accessible", async ({ page }) => {
    await page.goto(`/products?view=grid&q=Imp ${stamp}`);
    await expect(page.getByTestId("products-grid")).toBeVisible();
    await expect(page.locator('[data-testid="product-row"]:visible')).toHaveCount(2);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 2).join(" | ")}`)).toEqual([]);
  });

  test("archive cleans up the imported products", async ({ page }) => {
    await page.goto(`/products?q=Imp ${stamp}`);
    await page.getByRole("button", { name: /Select all/ }).click();
    await page.getByTestId("bulk-archive").click();
    await expect(page.getByTestId("bulk-msg")).toContainText("2 products archived");
    await expect(page.getByTestId("products-empty")).toBeVisible();
  });

  test("the import page is accessible", async ({ page }) => {
    await page.goto("/products/import");
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
  });
});

test.describe("dashboard: range, comparison and tips", () => {
  test.beforeEach(async ({ context }) => {
    await actAs(context, "owner");
  });

  test("the sales chart switches range and compares with the period before", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("sales-chart")).toContainText("Sales, last 7 days");
    await page.getByTestId("range-30").click();
    await expect(page).toHaveURL(/range=30/);
    await expect(page.getByTestId("sales-chart")).toContainText("Sales, last 30 days");
    await expect(page.getByTestId("sales-chart")).toContainText(/previous 30 days|No earlier period/);
    await expect(page.getByTestId("tips-card")).toBeVisible();
    await page.goto("/?range=999");
    await expect(page.getByTestId("sales-chart")).toContainText("Sales, last 7 days");
  });

  test("the dashboard is accessible and has big enough tap targets on a phone", async ({ page }, info) => {
    await page.goto("/?range=90");
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 2).join(" | ")}`)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    if (info.project.name.startsWith("mobile")) {
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("main a, main button, main input, main select")]
          .filter((el) => el.offsetParent !== null)
          .map((el) => ({ n: el.textContent?.trim().slice(0, 30) ?? "", h: Math.round(el.getBoundingClientRect().height) }))
          .filter((x) => x.h < 40).map((x) => `${x.n} ${x.h}px`).slice(0, 6));
      expect(small, "tap targets under 40px").toEqual([]);
    }
  });
});
