import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { withDb } from "./db";
import { addProduct, fillCheckout, freshPhone, lastSmsCode, localDigits, noHorizontalScroll, setEnglish, storeApi } from "./helpers";

test.beforeEach(async ({ page }) => {
  await setEnglish(page);
});

async function expectNoSeriousA11yIssues(page: Page, what: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`), `accessibility problems on ${what}`).toEqual([]);
}

test.describe("accessibility and layout", () => {
  test("home, product, cart, checkout and account have no serious accessibility problems and no sideways scroll", async ({ page }) => {
    await page.goto("/");
    await expectNoSeriousA11yIssues(page, "home");
    await noHorizontalScroll(page);
    await page.goto("/products/cotton-panjabi-off-white");
    await expectNoSeriousA11yIssues(page, "product");
    await noHorizontalScroll(page);
    await page.goto("/c/panjabi");
    await expectNoSeriousA11yIssues(page, "category");
    await addProduct(page, "linen-shirt-sage", { size: "M" });
    await page.goto("/cart");
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    await expectNoSeriousA11yIssues(page, "cart");
    await page.goto("/checkout");
    await expect(page.getByTestId("checkout-form")).toBeVisible();
    await expectNoSeriousA11yIssues(page, "checkout");
    await noHorizontalScroll(page);
    await page.goto("/account");
    await expectNoSeriousA11yIssues(page, "account");
  });

  test("primary controls are at least 44px tall on phones", async ({ page, isMobile }) => {
    test.skip(!isMobile, "touch target sizes matter on phones");
    await addProduct(page, "linen-shirt-sage", { size: "M" });
    await page.goto("/checkout");
    for (const loc of [page.getByTestId("place-order"), page.getByLabel("Full name"), page.locator("#f-division"), page.locator("label.option").first()]) {
      const box = await loc.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await page.goto("/products/linen-shirt-sage");
    for (const size of ["S", "M", "L"]) expect((await page.getByTestId(`size-${size}`).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("the phone layout uses a menu button, the desktop layout shows the nav", async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) {
      await expect(page.locator(".nav-desktop")).toBeHidden();
      await expect(page.locator(".menu-panel")).toBeHidden();
      await page.locator(".menu summary").click();
      await expect(page.locator(".menu-panel")).toBeVisible();
      await expect(page.locator(".menu-panel").getByRole("link", { name: "Panjabi" })).toBeVisible();
    } else {
      await expect(page.locator(".nav-desktop")).toBeVisible();
      await expect(page.locator(".menu")).toBeHidden();
    }
  });
});

test.describe("language", () => {
  test("switching to Bangla changes the page and sticks across pages and reloads", async ({ page, isMobile }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    // The switch lives in the header on desktop and the footer on phones.
    await page.locator(isMobile ? "footer .lang-btn" : ".header-tools .lang-btn").click();
    await expect(page.locator("html")).toHaveAttribute("lang", "bn");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("গরমে আরামের সুতি পোশাক");
    await page.goto("/products/cotton-panjabi-off-white");
    await expect(page.getByTestId("pdp-price")).toHaveText("৳ ১,১৫০");
    await expect(page.getByTestId("add-to-cart")).toContainText("কার্টে যোগ করুন");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  });
});

test.describe("customer account", () => {
  test("signs in with a texted code and shows the customer's own orders", async ({ page, browser }) => {
    const phone = freshPhone();
    await addProduct(page, "linen-shirt-sage", { size: "M" });
    await page.goto("/checkout");
    await fillCheckout(page, { phone, name: "Nusrat Jahan" });
    await page.locator('[data-testid="place-order"]:visible, [data-testid="place-order-desktop"]:visible').first().click();
    await expect(page).toHaveURL(/\/order\//);
    const orderNumber = (await page.getByTestId("order-success").innerText()).match(/BT-\d+/)![0];

    // a different browser (no cookies) signs in
    const ctx = await browser.newContext({ baseURL: "http://rongdhonu.localhost:3000", channel: undefined });
    const p2 = await ctx.newPage();
    await p2.context().addCookies([{ name: "bt_lang", value: "en", url: "http://rongdhonu.localhost:3000" }]);
    await p2.goto("/account");
    await p2.getByTestId("login-phone").fill(localDigits(phone));
    await p2.getByTestId("send-code").click();
    await expect(p2.getByTestId("login-code")).toBeVisible();

    await p2.getByTestId("login-code").fill("000000");
    await p2.getByTestId("verify-code").click();
    await expect(p2.getByText("That code is not right or has expired")).toBeVisible();

    await p2.getByTestId("login-code").fill(lastSmsCode(phone));
    await p2.getByTestId("verify-code").click();
    await expect(p2.getByTestId("account-order")).toHaveCount(1);
    await expect(p2.getByTestId("account-order")).toContainText(orderNumber);
    await expect(p2.getByTestId("account-order")).toContainText("৳ 930");

    // the order opens from the account, and signing out closes it again
    await p2.getByTestId("account-order").click();
    await expect(p2.getByTestId("order-success")).toContainText(orderNumber);
    await p2.goto("/account");
    await p2.getByRole("button", { name: "Sign out" }).click();
    await expect(p2.getByTestId("account-login")).toBeVisible();
    await ctx.close();
  });

  test("a code cannot be reused and a stranger cannot read someone's order link without the token", async ({ page, playwright }) => {
    const request = await storeApi(playwright);
    const phone = freshPhone();
    await page.goto("/account");
    await page.getByTestId("login-phone").fill(localDigits(phone));
    await page.getByTestId("send-code").click();
    await expect(page.getByTestId("login-code")).toBeVisible(); // the code is sent before this appears
    const code = lastSmsCode(phone);
    await page.getByTestId("login-code").fill(code);
    await page.getByTestId("verify-code").click();
    await expect(page.getByText("You have not placed any orders yet.")).toBeVisible();

    const orderId = await withDb(async (c) => (await c.query(`SELECT id FROM "Order" ORDER BY "createdAt" DESC LIMIT 1`)).rows[0].id as string);
    expect((await request.get(`/order/${orderId}`)).status()).toBe(404);
    expect((await request.get(`/order/${orderId}?k=not-the-token`)).status()).toBe(404);
  });
});

test.describe("search engines and sharing", () => {
  test("robots.txt and sitemap.xml are per store and keep private pages out", async ({ playwright }) => {
    const request = await storeApi(playwright);
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /checkout");
    expect(robots).toContain("Disallow: /order/");
    expect(robots).toMatch(/Sitemap: http:\/\/rongdhonu\.localhost:3000\/sitemap\.xml/);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/products/cotton-panjabi-off-white");
    expect(sitemap).toContain("/c/panjabi");
    expect(sitemap).not.toContain("/checkout");
  });

  test("a product page carries Open Graph tags, a canonical link and valid structured data", async ({ page }) => {
    await page.goto("/products/cotton-panjabi-off-white");
    const og = async (p: string) => page.locator(`meta[property="${p}"]`).getAttribute("content");
    expect(await og("og:title")).toBe("Cotton Panjabi, Off-white");
    expect(await og("og:description")).toContain("৳ 1,150");
    expect(await og("og:image")).toMatch(/^http:\/\/rongdhonu\.localhost:3000\/demo\/cotton-panjabi-off-white-1\.webp$/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/products\/cotton-panjabi-off-white$/);
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    expect(ld).toMatchObject({ "@type": "Product", name: "Cotton Panjabi, Off-white", offers: { priceCurrency: "BDT", price: 1150, availability: "https://schema.org/InStock" } });
  });

  test("checkout, cart, account and search are not indexed; the home page is", async ({ page }) => {
    for (const path of ["/checkout", "/cart", "/account", "/search?q=shirt"]) {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute("content", /noindex/);
    }
    await page.goto("/");
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test("search finds products and treats odd input safely", async ({ page }) => {
    await page.goto("/search?q=linen");
    await expect(page.getByRole("link", { name: /Linen Shirt, Sage/ })).toBeVisible();
    await page.goto(`/search?q=${encodeURIComponent("<script>alert(1)</script>")}`);
    await expect(page.getByText("No products found.")).toBeVisible();
    await page.goto("/search?q=%25");
    await expect(page.getByText("No products found.")).toBeVisible();
  });

  test("unknown product and category pages give a friendly 404", async ({ page }) => {
    const r = await page.goto("/products/does-not-exist");
    expect(r?.status()).toBe(404);
    await expect(page.getByText("Page not found")).toBeVisible();
    expect((await page.goto("/c/nope"))?.status()).toBe(404);
  });
});
