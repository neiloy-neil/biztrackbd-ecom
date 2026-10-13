import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { DEMO, withDb } from "./db";
import { STORE, actAs, freshPhone } from "./helpers";

const OUTBOX = resolve(process.cwd(), "e2e/.admin-sms.jsonl");
const outbox = () => { try { return readFileSync(OUTBOX, "utf8"); } catch { return ""; } };
const stamp = Date.now().toString(36).slice(-5);

test.describe.serial("categories, customer import, inbox and back in stock", () => {
  test.beforeEach(async ({ context }) => {
    await actAs(context, "owner");
  });

  test("the owner makes a category and a sub-category with a picture, renames one, and deletes one", async ({ page }) => {
    await page.goto("/products/categories");
    await page.getByTestId("new-category").click();
    await page.getByTestId("category-name").fill(`Eid Wear ${stamp}`);
    await page.getByTestId("category-save").click();
    await expect(page.getByTestId("category-saved")).toBeVisible();
    await page.getByTestId("new-category").click();
    await page.getByTestId("category-name").fill(`Panjabi ${stamp}`);
    await page.getByTestId("category-parent").selectOption({ label: `Eid Wear ${stamp}` });
    await page.getByTestId("category-save").click();
    const rows = page.getByTestId("category-row");
    await expect(rows.filter({ hasText: `Panjabi ${stamp}` })).toContainText("↳");
    // a sub-category cannot be given a sub-category of its own
    await rows.filter({ hasText: `Eid Wear ${stamp}` }).getByRole("link", { name: "Edit" }).click();
    await expect(page.getByTestId("category-parent")).toBeDisabled();
    await page.getByTestId("category-name").fill(`Eid Collection ${stamp}`);
    await page.getByTestId("category-save").click();
    await expect(rows.filter({ hasText: `Eid Collection ${stamp}` })).toBeVisible();
    await rows.filter({ hasText: `Panjabi ${stamp}` }).getByRole("button", { name: /Delete/ }).click();
    await expect(rows.filter({ hasText: `Panjabi ${stamp}` })).toHaveCount(0);
    await rows.filter({ hasText: `Eid Collection ${stamp}` }).getByRole("button", { name: /Delete/ }).click();
    await expect(rows.filter({ hasText: `Eid Collection ${stamp}` })).toHaveCount(0);
  });

  test("a category cover picture uploads and shows", async ({ page }) => {
    await page.goto("/products/categories?new=1");
    await page.getByTestId("category-name").fill(`Gamchha ${stamp}`);
    const sharp = (await import("sharp")).default;
    const png = await sharp({ create: { width: 800, height: 800, channels: 3, background: "#C9B79C" } }).png().toBuffer();
    await page.getByTestId("category-image-input").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
    await expect(page.getByTestId("category-image")).toHaveAttribute("src", /^\/media\//);
    await page.getByTestId("category-save").click();
    await expect(page.getByTestId("category-saved")).toBeVisible();
    await page.getByTestId("category-row").filter({ hasText: `Gamchha ${stamp}` }).getByRole("button", { name: /Delete/ }).click();
  });

  test("the owner imports customers from a file, sees the result, and nobody is added twice", async ({ page }) => {
    const ph = freshPhone();
    const csv = `Name,Phone,Email,Tags,Notes\r\nImport Person ${stamp},${ph},imp${stamp}@example.com,"eid; vip",Likes a call\r\nBad Row,12345,,,\r\n`;
    await page.goto("/customers");
    await page.getByTestId("import-customers").click();
    await page.getByTestId("cimport-file").setInputFiles({ name: "customers.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.getByTestId("cimport-go").click();
    await expect(page.getByTestId("cimport-result")).toContainText("1 new customer added");
    await expect(page.getByTestId("cimport-failed")).toContainText("Line 3");
    await page.getByTestId("cimport-file").setInputFiles({ name: "customers.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.getByTestId("cimport-go").click();
    await expect(page.getByTestId("cimport-result")).toContainText("0 new customers added");
    await page.goto(`/customers?q=${encodeURIComponent(`Import Person ${stamp}`)}`);
    await expect(page.getByText(`Import Person ${stamp}`).filter({ visible: true }).first()).toBeVisible();
    const n = await withDb(async (c) => Number((await c.query(`SELECT count(*)::int AS n FROM "Customer" WHERE phone = $1`, [ph])).rows[0].n));
    expect(n).toBe(1);
  });

  test("a shopper writes on the contact page, the owner answers by SMS, and it moves to answered", async ({ browser, page }) => {
    const ph = freshPhone();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.addCookies([{ name: "bt_lang", value: "en", url: STORE }]);
    const shop = await ctx.newPage();
    await shop.goto(`${STORE}/contact`);
    const axe = await new AxeBuilder({ page: shop }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    await shop.getByTestId("contact-name").fill("Tania Akter");
    await shop.getByTestId("contact-phone").fill("123");
    await shop.getByTestId("contact-message").fill(`Do you have the panjabi in XL? ${stamp}`);
    await shop.getByTestId("contact-send").click();
    await expect(shop.getByTestId("contact-error")).toContainText("valid mobile");
    await shop.getByTestId("contact-phone").fill(ph);
    await shop.getByTestId("contact-send").click();
    await expect(shop.getByTestId("contact-done")).toBeVisible();
    await ctx.close();

    await page.goto("/inbox");
    const row = page.getByTestId("inbox-row").filter({ hasText: stamp });
    await expect(row).toContainText("Tania Akter");
    await row.getByTestId("inbox-reply-text").fill("Yes, XL is in stock. Order any time.");
    await row.getByTestId("inbox-reply-send").click();
    await expect(page.getByTestId("inbox-replied")).toBeVisible();
    await page.goto("/inbox?tab=replied");
    await expect(page.getByTestId("inbox-row").filter({ hasText: stamp })).toContainText("Yes, XL is in stock");
    await expect.poll(() => outbox()).toContain("Yes, XL is in stock. Order any time.");
  });

  test("a shopper asks to be told when a sold-out item is back, and is told when the owner adds stock", async ({ browser, page }) => {
    const ph = freshPhone();
    const v = await withDb(async (c) => {
      const r = await c.query(`SELECT v.id, v.sku FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId" JOIN "Tenant" t ON t.id = v."tenantId" WHERE t.subdomain = $1 AND p.slug = 'cotton-socks-3-pack' LIMIT 1`, [DEMO]);
      await c.query(`UPDATE "ProductVariant" SET "stockQuantity" = 0 WHERE id = $1`, [r.rows[0].id]);
      await c.query(`DELETE FROM "StockAlert" WHERE "variantId" = $1`, [r.rows[0].id]);
      return r.rows[0] as { id: string; sku: string | null };
    });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.addCookies([{ name: "bt_lang", value: "en", url: STORE }]);
    const shop = await ctx.newPage();
    await shop.goto(`${STORE}/products/cotton-socks-3-pack`);
    await expect(shop.getByTestId("notify-me")).toBeVisible();
    await shop.getByTestId("notify-phone").fill("abc");
    await shop.getByTestId("notify-go").click();
    await expect(shop.getByTestId("notify-notice")).toContainText("valid mobile");
    await shop.getByTestId("notify-phone").fill(ph);
    await shop.getByTestId("notify-go").click();
    await expect(shop.getByTestId("notify-notice")).toContainText("We will send you an SMS");
    await shop.getByTestId("notify-go").click();
    await expect(shop.getByTestId("notify-notice")).toContainText("already on the list");
    await ctx.close();

    await page.goto("/inventory/alerts");
    await expect(page.getByTestId("alert-row").filter({ hasText: "Cotton Socks" })).toContainText("1 person waiting");

    // the owner adds stock from the inventory screen
    await page.goto("/inventory?q=Cotton%20Socks");
    const key = v.sku ?? v.id;
    const mine = page.locator('[data-testid="inv-row"]:visible', { has: page.getByTestId(`adjust-${key}`) });
    await mine.getByTestId(`adjust-${key}`).click();
    await page.getByTestId("adjust-amount").fill("5");
    await page.getByRole("button", { name: "Save change" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await expect.poll(() => outbox()).toContain(ph);
    expect(outbox()).toMatch(/back in stock|আবার স্টকে/);
    await page.goto("/inventory/alerts");
    await expect(page.getByTestId("alert-row").filter({ hasText: "Cotton Socks" })).toHaveCount(0);
  });

  test("the new admin screens are accessible and fit the phone", async ({ page }, info) => {
    for (const path of ["/products/categories", "/products/categories?new=1", "/customers/import", "/inbox", "/inventory/alerts"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(axe.violations.map((v) => `${path} ${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(1);
      if (info.project.name.startsWith("mobile")) {
        const small = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("main a[href], main button, main input:not([type=hidden]):not([type=file]):not([type=checkbox]), main select")].filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.height < 40 && !el.closest("p, li, .tabs, nav.pager"); }).map((el) => `${el.tagName} ${(el.textContent ?? "").trim().slice(0, 20)} ${Math.round(el.getBoundingClientRect().height)}`));
        expect(small, path).toEqual([]);
      }
    }
  });

  test("support can read the inbox and the alerts but not change categories", async ({ context, page }) => {
    await actAs(context, "support");
    expect((await page.goto("/inbox"))?.status()).toBe(200);
    expect((await page.goto("/inventory/alerts"))?.status()).toBe(200);
    await page.goto("/products/categories");
    await expect(page.getByTestId("new-category")).toHaveCount(0);
  });
});
