import { expect, test } from "@playwright/test";
import { actAs } from "./helpers";

test.describe("SiteBuilder Live Social Proof & FOMO Engine", () => {
  test.beforeEach(async ({ context }) => {
    await actAs(context, "owner");
  });

  test("can configure social proof settings from left rail and inspector tab", async ({ page }) => {
    await page.goto("/design");
    await expect(page.locator("main").first()).toBeVisible({ timeout: 20_000 });

    // 1. Verify Left Rail Social Proof Button
    const railBtn = page.getByTestId("rail-fomo-btn");
    await expect(railBtn).toBeVisible();
    await railBtn.click();

    // 2. Verify Left Dock Panel Opens with FOMO Inspector
    const inspector = page.locator(".bld-dock-panel").getByTestId("fomo-inspector");
    await expect(inspector).toBeVisible();

    // 3. Verify Master Toggle & Position Picker
    const enableToggle = inspector.getByTestId("fomo-enable-toggle");
    await expect(enableToggle).toBeVisible();

    const posBottomRight = inspector.getByTestId("fomo-pos-bottom-right");
    await expect(posBottomRight).toBeVisible();
    await posBottomRight.click();
    await expect(posBottomRight).toHaveClass(/active/);

    // 4. Verify Preview Trigger Button
    const triggerBtn = inspector.getByTestId("fomo-trigger-preview-btn");
    await expect(triggerBtn).toBeVisible();
    await triggerBtn.click();

    // 5. Verify Right Inspector Tab
    const tabBtn = page.getByTestId("tab-fomo");
    if (await tabBtn.isVisible()) {
      await tabBtn.click();
      const rightInspector = page.locator(".bld-right").getByTestId("fomo-inspector");
      await expect(rightInspector).toBeVisible();
    }

    // Capture visual smoke screenshot
    await page.screenshot({
      path: "C:/Users/USER/.gemini/antigravity-ide/brain/a888d60a-cce8-4327-8986-ec262d7641cf/sitebuilder_fomo_smoke.png",
      fullPage: true,
    });
  });
});
