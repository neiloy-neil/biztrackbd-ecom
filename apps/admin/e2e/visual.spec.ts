import { expect, test } from "@playwright/test";
import { actAs } from "./helpers";

/**
 * Visual regression: screenshots of screens whose content is fixed (settings, the editor shell), compared with the saved
 * baselines in e2e/visual.spec.ts-snapshots. A change that moves, resizes or recolours anything fails with a picture of the
 * difference. After a change you MEANT to make, review the pictures, then run:  pnpm exec playwright test visual --update-snapshots
 *
 * Honest limit: these baselines are the screens as built in Phase 8, not the design canvas. The canvas boards (design/canvas) use
 * invented sample data, so a pixel comparison against them is not meaningful; they remain the reference for a human review.
 * Pictures are taken on Windows with Chrome; fonts and anti-aliasing differ slightly on other systems, so baselines are per platform.
 */
const SCREENS: { path: string; name: string; light?: boolean }[] = [
  { path: "/settings/payments", name: "payments" },
  { path: "/settings/shipping", name: "shipping" },
  { path: "/settings/store", name: "store" },
  { path: "/settings/staff", name: "team" },
  { path: "/settings/domains", name: "domains" },
  { path: "/more", name: "more" },
  { path: "/design", name: "design" },
];

for (const theme of ["light", "dark"] as const) {
  test.describe(`visual baselines, ${theme}`, () => {
    test.beforeEach(async ({ context }) => {
      await actAs(context, "owner");
      await context.addCookies([{ name: "bt_theme", value: theme, url: "http://localhost:3001" }]);
    });

    for (const s of SCREENS) {
      test(`${s.name} looks the same as its baseline`, async ({ page }) => {
        await page.goto(s.path);
        await expect(page.locator("main").first()).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        if (s.name === "design") await expect(page.frameLocator('[data-testid="preview-frame"]').getByTestId("preview-root")).toBeVisible();
        await expect(page).toHaveScreenshot(`${s.name}-${theme}.png`, {
          fullPage: true,
          animations: "disabled",
          maxDiffPixelRatio: 0.012,
          // Numbers and live pictures that change between runs are painted over, so the layout around them is still compared.
          mask: [page.locator(".count, .nav-badge, .store-chip, [data-testid=preview-frame], [data-testid=billing-banner], time, .who")],
        });
      });
    }
  });
}
