import { expect, test, type Page } from "@playwright/test";
import { withDb } from "./db";
import { addProduct, fillCheckout, freshPhone, noHorizontalScroll, setEnglish } from "./helpers";

test.beforeEach(async ({ page }) => {
  await setEnglish(page);
});

/** The submit button differs by layout: sticky bar on phones, in the summary column on desktop. */
const placeOrder = (page: Page) => page.locator('[data-testid="place-order"]:visible, [data-testid="place-order-desktop"]:visible').first();

test.describe("Cash on delivery checkout", () => {
  test("a customer can browse, add to cart and place an order inside Dhaka", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Cotton that stays cool");
    await noHorizontalScroll(page);

    await page.getByRole("link", { name: /Cotton Panjabi, Off-white/ }).first().click();
    await expect(page.getByTestId("pdp-price")).toHaveText("৳ 1,150");
    await page.getByTestId("size-L").click();
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await page.goto("/cart");
    await expect(page.getByTestId("cart-subtotal")).toHaveText("৳ 1,150");
    await page.getByTestId("go-checkout").click();
    await expect(page).toHaveURL(/\/checkout$/);

    const phone = freshPhone();
    await fillCheckout(page, { phone });
    await expect(page.getByTestId("delivery-option")).toContainText("Inside Dhaka city");
    await expect(page.getByTestId("delivery-option")).toContainText("Arrives in 1 to 2 days");
    await expect(page.getByTestId("delivery-option")).toContainText("৳ 80");
    await noHorizontalScroll(page);

    await placeOrder(page).click();
    await expect(page).toHaveURL(/\/order\/[a-z0-9]+\?k=/);
    const success = page.getByTestId("order-success");
    await expect(success).toContainText("Thank you, Tania");
    await expect(success).toContainText(/BT-\d+/);
    await expect(success).toContainText("Pay ৳ 1,230 in cash when it arrives");
    await expect(success).toContainText("Cotton Panjabi, Off-white");
    await expect(page.getByTestId("cart-count")).toHaveCount(0); // cart emptied

    // The order really exists, with the price the server computed.
    const row = await withDb(async (c) => (await c.query(`SELECT "totalAmount", "deliveryCharge", status, "customerPhone", "shippingCity" FROM "Order" WHERE "customerPhone" = $1`, [phone])).rows[0]);
    expect(Number(row.totalAmount)).toBe(1230);
    expect(Number(row.deliveryCharge)).toBe(80);
    expect(row.status).toBe("PENDING");
    expect(row.shippingCity).toBe("Mirpur");
  });

  test("delivery outside Dhaka costs more and free delivery applies over the threshold", async ({ page }) => {
    await addProduct(page, "slim-chino-navy", { size: "32" });
    await page.goto("/checkout");
    await fillCheckout(page, { phone: freshPhone(), division: "Sylhet", district: "Sylhet", upazila: "Sylhet Sadar" });
    await expect(page.getByTestId("delivery-option")).toContainText("Outside Dhaka");
    await expect(page.getByTestId("delivery-option")).toContainText("৳ 130");
    await expect(page.getByTestId("grand-total").first()).toHaveText("৳ 1,420");

    // 3 x 1,150 = 3,450: free inside Dhaka (threshold 3,000)
    await addProduct(page, "cotton-panjabi-off-white", { size: "M", qty: 3 });
    await page.goto("/checkout");
    await page.locator("#f-division").selectOption("Dhaka");
    await page.locator("#f-district").selectOption("Dhaka");
    await expect(page.getByTestId("delivery-option")).toContainText("Free");
    await expect(page.getByTestId("delivery-fee").first()).toHaveText("Free");
  });

  test("an empty cart asks the customer to keep shopping", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByText("Your cart is empty.")).toBeVisible();
    await page.goto("/cart");
    await expect(page.getByText("Your cart is empty.")).toBeVisible();
  });
});

test.describe("bKash and Nagad checkout", () => {
  test("shows the steps with the store's number and the exact amount, and holds the order for verification", async ({ page }) => {
    await addProduct(page, "linen-shirt-sage", { size: "M" });
    await page.goto("/checkout");
    const phone = freshPhone();
    await fillCheckout(page, { phone });
    await page.getByTestId("pay-bkash").check();
    await expect(page.getByText("Send ৳ 930 to 01712345678")).toBeVisible();

    // wrong TrxID is caught before anything is sent
    await page.locator("#f-mfsSender").fill(phone);
    await page.locator("#f-trxId").fill("12");
    await placeOrder(page).click();
    await expect(page.locator("#e-trxId")).toContainText("Enter the TrxID from the SMS");
    await expect(page).toHaveURL(/\/checkout$/);

    const trx = `T${Date.now().toString(36).toUpperCase()}`.slice(0, 11).padEnd(9, "X");
    await page.locator("#f-trxId").fill(trx);
    await placeOrder(page).click();
    await expect(page).toHaveURL(/\/order\//);
    await expect(page.getByTestId("order-success")).toContainText("We are checking your payment");
    await expect(page.getByTestId("order-success")).toContainText(trx);
    const row = await withDb(async (c) => (await c.query(`SELECT "paymentStatus", "paymentMethod", "mfsTrxId" FROM "Order" WHERE "customerPhone" = $1`, [phone])).rows[0]);
    expect(row).toMatchObject({ paymentStatus: "PENDING_VERIFICATION", paymentMethod: "MANUAL_BKASH", mfsTrxId: trx });
  });

  test("the same TrxID cannot be used for a second order", async ({ page }) => {
    const trx = `DUP${Date.now().toString(36).toUpperCase()}`.slice(0, 11).padEnd(9, "Z");
    for (const attempt of [1, 2]) {
      await addProduct(page, "linen-shirt-sage", { size: "L" });
      await page.goto("/checkout");
      const phone = freshPhone();
      await fillCheckout(page, { phone });
      await page.getByTestId("pay-nagad").check();
      await page.locator("#f-mfsSender").fill(phone);
      await page.locator("#f-trxId").fill(trx);
      await placeOrder(page).click();
      if (attempt === 1) await expect(page).toHaveURL(/\/order\//);
      else {
        await expect(page.getByText("That transaction ID has already been used").first()).toBeVisible();
        await expect(page).toHaveURL(/\/checkout$/);
      }
    }
  });
});

test.describe("form validation", () => {
  test("empty submit shows plain messages and moves focus to the first problem", async ({ page }) => {
    await addProduct(page, "linen-shirt-sage", { size: "S" });
    await page.goto("/checkout");
    await placeOrder(page).click();
    await expect(page.getByText("Enter a valid mobile number, like 1712-345678")).toBeVisible();
    await expect(page.getByText("Enter your full name")).toBeVisible();
    await expect(page.getByText("Choose your upazila or thana")).toBeVisible();
    await expect(page.getByText("Enter your house, road and area")).toBeVisible();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByLabel("Mobile number")).toBeFocused();
  });

  test("the phone field accepts pasted +880, 01 and bare formats", async ({ page }) => {
    await addProduct(page, "linen-shirt-sage", { size: "S" });
    await page.goto("/checkout");
    const field = page.getByLabel("Mobile number");
    for (const pasted of ["+8801712345678", "01712345678", "1712345678", "+880 1712-345678"]) {
      await field.fill(pasted);
      await expect(field).toHaveValue("1712-345678");
    }
  });

  test("the district list follows the division, and the upazila list follows the district", async ({ page }) => {
    await addProduct(page, "linen-shirt-sage", { size: "S" });
    await page.goto("/checkout");
    await page.locator("#f-division").selectOption("Sylhet");
    await expect(page.locator("#f-district option")).toHaveText(["Sylhet", "Habiganj", "Moulvibazar", "Sunamganj"]);
    await page.locator("#f-district").selectOption("Habiganj");
    await expect(page.locator("#f-upazila")).toContainText("Habiganj Sadar");
    await expect(page.locator("#f-upazila")).not.toContainText("Mirpur");
  });
});

test.describe("coupons", () => {
  test("a valid code reduces the total and an invalid one explains why", async ({ page }) => {
    await addProduct(page, "cotton-panjabi-off-white", { size: "M", qty: 2 });
    await page.goto("/checkout");
    await fillCheckout(page, { phone: freshPhone() });
    await expect(page.getByTestId("grand-total").first()).toHaveText("৳ 2,380");
    await page.locator("#f-coupon").fill("EID10");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("Coupon EID10 applied")).toBeVisible();
    await expect(page.getByTestId("grand-total").first()).toHaveText("৳ 2,150");
    await page.locator("#f-coupon").fill("NOPE");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("That coupon code is not valid")).toBeVisible();
  });
});

test.describe("tampering and stock", () => {
  test("a cart edited in the browser cannot buy more than is in stock, and cannot set a price", async ({ page }) => {
    await page.goto("/");
    // The cart stores only ids and quantities; there is no price field to edit. Ask for more than is in stock.
    const variantId = await withDb(async (c) => {
      const id = (await c.query(`SELECT v.id FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId" WHERE p.slug = 'linen-shirt-sage' AND v.title = 'XL' AND p."tenantId" = (SELECT id FROM "Tenant" WHERE subdomain = 'rongdhonu')`)).rows[0].id as string;
      await c.query(`UPDATE "ProductVariant" SET "stockQuantity" = 3 WHERE id = $1`, [id]);
      return id;
    });
    await page.evaluate((id) => localStorage.setItem("bt_cart_v1", JSON.stringify([{ variantId: id, quantity: 10, price: 1, total: 1 }])), variantId);
    await page.goto("/checkout");
    await fillCheckout(page, { phone: freshPhone() });
    await placeOrder(page).click();
    await expect(page.locator(".notice:visible", { hasText: /Only \d+ left/ }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/checkout$/);
  });

  test("an unknown item in the cart is dropped on the cart page", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("bt_cart_v1", JSON.stringify([{ variantId: "ghost-variant-0001", quantity: 1 }])));
    await page.goto("/cart");
    await expect(page.getByText("Your cart is empty.")).toBeVisible();
  });

  test("double-clicking Place order creates one order", async ({ page }) => {
    await addProduct(page, "linen-shirt-sage", { size: "M" });
    await page.goto("/checkout");
    const phone = freshPhone();
    await fillCheckout(page, { phone });
    const btn = placeOrder(page);
    await Promise.allSettled([btn.click(), btn.click({ timeout: 2000 })]);
    await expect(page).toHaveURL(/\/order\//);
    const count = await withDb(async (c) => Number((await c.query(`SELECT count(*) FROM "Order" WHERE "customerPhone" = $1`, [phone])).rows[0].count));
    expect(count).toBe(1);
  });
});
