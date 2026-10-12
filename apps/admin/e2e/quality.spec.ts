import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { actAs } from "./helpers";

const PAGES = [
  "/",
  "/orders",
  "/orders?tab=check",
  "/orders/new",
  "/products",
  "/products/new",
  "/products/import",
  "/?range=30",
  "/products?view=grid",
  "/inventory",
  "/customers",
  "/marketing/coupons",
  "/reports",
  "/returns",
  "/abandoned",
  "/reviews",
  "/marketing/pixels",
  "/marketing/loyalty",
  "/design",
  "/landing",
  "/content",
  "/content?tab=posts&edit=new",
  "/settings/domains",
  "/fraud",
  "/fraud?tab=blocked",
  "/fraud?tab=check",
  "/finance/cod",
  "/finance/profit",
  "/settings/integrations",
  "/settings/store",
  "/settings/payments",
  "/settings/shipping",
  "/settings/staff",
  "/more",
  "/billing",
];

// Every screen is checked twice: in the light look and in the dark look (Phase 8 dark mode).
for (const theme of ["light", "dark"] as const) test.describe(`every admin screen, ${theme}`, () => {
  test.beforeEach(async ({ context }) => {
    await actAs(context, "owner");
    await context.addCookies([{ name: "bt_theme", value: theme, url: "http://localhost:3001" }]);
  });

  for (const path of PAGES) {
    test(`${path} is accessible, fits the screen and has big enough tap targets`, async ({ page }, info) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator("main, [role=main]").first()).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, "page scrolls sideways").toBeLessThanOrEqual(1);

      if (info.project.name.startsWith("mobile")) {
        const small = await page.evaluate(() => {
          const bad: string[] = [];
          for (const el of document.querySelectorAll<HTMLElement>("a[href], button, input:not([type=hidden]), select, textarea, summary")) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === "hidden") continue;
            if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) continue; // their label is the target
            if (r.height < 40 && !el.closest(".tabs, nav.pager, p, li")) bad.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)}" ${Math.round(r.height)}px`);
          }
          return bad.slice(0, 6);
        });
        expect(small, "tap targets under 40px").toEqual([]);
      }
    });
  }
});

test.describe("who can do what", () => {
  test("a packer can work orders but not payments, reports or team settings", async ({ context, page }) => {
    await actAs(context, "packer");
    expect((await page.goto("/orders"))?.status()).toBe(200);
    for (const blocked of ["/settings/payments", "/settings/staff", "/reports", "/billing"]) {
      await page.goto(blocked);
      await expect(page).toHaveURL(/\/no-access/);
    }
  });

  test("support can look up customers and orders but cannot see payment settings or add products", async ({ context, page }) => {
    await actAs(context, "support");
    expect((await page.goto("/customers"))?.status()).toBe(200);
    await page.goto("/settings/payments");
    await expect(page).toHaveURL(/\/no-access/);
    await page.goto("/products/new");
    await expect(page).toHaveURL(/\/no-access/);
  });
});
