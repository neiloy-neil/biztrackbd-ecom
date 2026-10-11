import { expect, test, type Page } from "@playwright/test";
import { tenantId, withDb } from "./db";
import { STORE, actAs, customerOrders, openOrder, orderIdFromUrl, samplePhoto } from "./helpers";

/**
 * Phase 3 acceptance: an owner can run a day of orders from a phone: verify bKash, pack, print slips, add a product.
 * A real customer places the order on the storefront; the owner handles it in the admin. Runs once per screen width.
 */
test.describe.serial("a day of orders", () => {
  let orderNumber = "";
  let trx = "";
  let orderId = "";

  test.beforeEach(async ({ context }) => {
    await actAs(context, "owner");
  });

  test("a customer pays by bKash and the order shows up waiting for a payment check", async ({ browser, page }) => {
    const r = await customerOrders(browser, { slug: "linen-shirt-sage", size: "M", pay: "bkash" });
    orderNumber = r.orderNumber;
    trx = r.trx!;
    await page.goto("/");
    await expect(page.getByTestId("dash-stats")).toBeVisible();
    await expect(page.getByText("bKash and Nagad payments to check")).toBeVisible();
    await page.goto("/orders?tab=check");
    await expect(page.getByRole("link", { name: orderNumber }).filter({ visible: true }).first()).toBeVisible();
  });

  test("the owner checks the TrxID and amount on one screen, then confirms the payment", async ({ page }) => {
    await openOrder(page, orderNumber, "check");
    orderId = orderIdFromUrl(page.url());
    const pay = page.getByTestId("payment-card");
    await expect(pay).toContainText("bKash");
    await expect(pay.getByTestId("trxid")).toHaveText(trx);
    await expect(pay).toContainText("৳ 930"); // 850 + 80 delivery
    await expect(page.getByTestId("customer-card")).toContainText("Tania Akter");
    await expect(page.getByTestId("delivery-card")).toContainText("House 14, Road 7");
    await page.getByRole("button", { name: /I received it/ }).filter({ visible: true }).first().click();
    await expect(page.locator(".page-head .pill", { hasText: "Paid" })).toBeVisible();
    await expect(page.locator(".page-head .pill", { hasText: "To pack" })).toBeVisible();
    await expect(page.getByTestId("timeline")).toContainText(`Payment confirmed (TrxID ${trx})`);
    await expect(page.getByTestId("timeline")).toContainText("Nusrat Jahan");
  });

  test("it is packed from the list, with several orders selectable at once", async ({ page }) => {
    await page.goto("/orders?tab=to_pack");
    await page.locator(`input[name="ids"][aria-label="Select ${orderNumber}"]:visible`).check();
    await page.getByRole("button", { name: "Mark selected as packed" }).click();
    await expect(page.getByText(/1 marked as packed/)).toBeVisible();
    await page.goto(`/orders/${orderId}`);
    await expect(page.locator(".page-head .pill", { hasText: "Packed" })).toBeVisible();
  });

  test("slips and invoices print at A4, A5 and 80mm thermal", async ({ page }) => {
    await page.goto(`/orders/print?ids=${orderId}&doc=slip&size=thermal`);
    const sheet = page.getByTestId("print-sheet");
    await expect(sheet).toContainText("PACKING SLIP");
    await expect(sheet).toContainText(orderNumber);
    await expect(sheet).toContainText("Tania Akter");
    await expect(sheet).toContainText("Linen Shirt, Sage");
    await expect(sheet).not.toContainText("COLLECT"); // already paid by bKash
    await expect(page.getByRole("button", { name: "Print" })).toBeVisible();
    await page.getByRole("link", { name: "A4" }).click();
    await expect(page).toHaveURL(/size=a4/);
    await page.getByRole("link", { name: "Invoice" }).click();
    await expect(page.getByTestId("print-sheet")).toContainText("INVOICE");
    await expect(page.getByTestId("print-sheet")).toContainText("৳ 930");
    await expect(page.getByTestId("print-sheet")).toContainText(`bKash, TrxID ${trx}`);
    await page.getByRole("link", { name: "Courier label" }).click();
    await expect(page.getByTestId("print-sheet")).toContainText("PREPAID");
    // the printing is noted on the order timeline
    await page.getByRole("button", { name: "Print" }).click().catch(() => undefined);
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByTestId("timeline")).toContainText(/printed/);
  });

  test("it is handed over with a tracking code and marked shipped", async ({ page }) => {
    await page.goto(`/orders/${orderId}`);
    await page.getByText("Deliver it yourself, or book outside this app").click();
    await page.getByLabel(/Tracking code/).fill("RIDER-7");
    await page.getByRole("button", { name: "Hand over and mark shipped" }).click();
    await expect(page.locator(".page-head .pill", { hasText: "Shipped" })).toBeVisible();
    await expect(page.getByTestId("courier-card")).toContainText("RIDER-7");
    await expect(page.getByTestId("timeline")).toContainText("Order shipped: tracking RIDER-7");
  });

  test("a cash on delivery slip says how much to collect", async ({ browser, page }) => {
    const cod = await customerOrders(browser, { slug: "cotton-socks-3-pack", size: "Free size", pay: "COD" });
    await openOrder(page, cod.orderNumber, "new");
    const id = orderIdFromUrl(page.url());
    await page.goto(`/orders/print?ids=${id}&doc=slip&size=a5`);
    await expect(page.getByTestId("print-sheet")).toContainText("COLLECT ৳ 380"); // 300 + 80
  });

  test("a product is added from the phone with a photo, and appears on the store", async ({ page, request }) => {
    await withDb(async (c) => c.query(`DELETE FROM "Product" WHERE slug LIKE 'e2e-%' AND NOT EXISTS (SELECT 1 FROM "OrderItem" WHERE "productId" = "Product".id)`));
    await withDb(async (c) => c.query(`UPDATE "Tenant" SET "productCount" = (SELECT count(*) FROM "Product" WHERE "tenantId" = "Tenant".id AND "deletedAt" IS NULL)`));
    await page.goto("/products");
    await page.getByTestId("add-product").click();
    await expect(page.getByTestId("product-editor")).toBeVisible();
    await page.getByTestId("p-title").fill("E2E Test Gamchha");
    await page.getByTestId("p-price").fill("450");
    await page.getByTestId("p-stock").fill("12");
    await page.getByTestId("p-newcat").fill("Gamchha");
    await page.getByTestId("photo-input").setInputFiles({ name: "front.png", mimeType: "image/png", buffer: await samplePhoto() });
    await expect(page.locator('[data-testid="photos"] img')).toHaveCount(1);
    const src = await page.locator('[data-testid="photos"] img').first().getAttribute("src");
    expect(src).toMatch(/^\/media\/[A-Za-z0-9_-]+\/[0-9a-f-]{36}\.webp$/);
    await page.getByTestId("publish").click();
    await expect(page).toHaveURL(/\/products\/[a-z0-9]+\?saved=1/);
    await expect(page.getByTestId("saved")).toBeVisible();

    await page.goto("/products");
    await expect(page.locator('[data-testid="product-row"]:visible', { hasText: "E2E Test Gamchha" }).first()).toBeVisible();

    // a customer can see it, with the photo served from the store's own address
    const store = await request.get("http://127.0.0.1:3000/products/e2e-test-gamchha", { headers: { Host: "rongdhonu.localhost:3000" } });
    expect(store.status()).toBe(200);
    expect(await store.text()).toContain("E2E Test Gamchha");
    const img = await request.get(`http://127.0.0.1:3000${src}`, { headers: { Host: "rongdhonu.localhost:3000" } });
    expect(img.status()).toBe(200);
    expect(img.headers()["content-type"]).toBe("image/webp");
  });

  test("a phone order is keyed in on the quick desk in seconds, tagged with where it came from", async ({ page }) => {
    await page.goto("/orders/new");
    await page.getByTestId("desk-phone").fill("01712345678");
    await page.getByTestId("desk-name").fill("Phone Customer");
    await page.getByTestId("desk-upazila").selectOption("Mirpur");
    await page.getByTestId("desk-address").fill("House 9, Road 3, Mirpur 10");
    await page.getByRole("button", { name: "Phone call" }).click();
    await page.getByTestId("desk-search").fill("linen");
    await page.getByTestId("desk-results").getByRole("button").first().click();
    await expect(page.getByTestId("desk-line")).toHaveCount(1);
    await expect(page.getByTestId("desk-total")).toHaveText(/৳ 930/);
    await page.getByTestId("desk-create").click();
    await expect(page).toHaveURL(/\/orders\/[a-z0-9]+$/);
    await expect(page.getByTestId("timeline")).toContainText("Order keyed in by Nusrat Jahan (phone)");
    await expect(page.getByTestId("order-total")).toHaveText("৳ 930");
  });

  test("a pasted customer message fills the form with suggestions", async ({ page }) => {
    await page.goto("/orders/new");
    await page.getByTestId("desk-message").fill("Tania Akter, 01712345678, মিরপুর ১০, ব্লক সি রোড ৭ বাসা ১৪। Panjabi L, 1 pcs. COD");
    await page.getByTestId("desk-fill").click();
    await expect(page.getByTestId("desk-phone")).toHaveValue("1712-345678");
    await expect(page.getByTestId("desk-name")).toHaveValue("Tania Akter");
    await expect(page.getByTestId("desk-upazila")).toHaveValue("Mirpur");
    await expect(page.getByTestId("desk-line")).toContainText("Cotton Panjabi, Off-white (L)");
    await expect(page.getByTestId("desk-address")).toHaveValue(/ব্লক সি রোড ৭ বাসা ১৪/);
    await expect(page.getByTestId("desk-known")).toBeVisible(); // Tania has ordered before
  });
});

async function visibleButton(page: Page, name: RegExp | string) {
  return page.getByRole("button", { name }).filter({ visible: true }).first();
}
void visibleButton;
void STORE;
void tenantId;
