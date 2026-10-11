import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import sharp from "sharp";

export const ADMIN = "http://localhost:3001";
export const STORE = "http://rongdhonu.localhost:3000";

export const USERS = {
  owner: "owner@rongdhonu.example",
  manager: "manager@rongdhonu.example",
  packer: "packer@rongdhonu.example",
  support: "support@rongdhonu.example",
} as const;

let n = 0;
/** A fresh valid mobile number per call so the 3-orders-per-phone-per-day limit is never hit. */
export function freshPhone(): string {
  const tail = String((Date.now() + ++n * 7919 + Math.floor(Math.random() * 1000)) % 100_000_000).padStart(8, "0");
  return `01${3 + (n % 7)}${tail}`.slice(0, 11);
}

/** Acts as a team member (the development sign-in picks the account by cookie). */
export async function actAs(context: BrowserContext, who: keyof typeof USERS) {
  await context.addCookies([{ name: "dev_user", value: USERS[who], url: ADMIN }]);
}

/** A real customer places an order on the storefront, in their own browser session. Returns the order number. */
export async function customerOrders(
  browser: Browser,
  o: { slug: string; size: string; pay: "COD" | "bkash" | "nagad"; coupon?: string; qty?: number; phone?: string },
): Promise<{ orderNumber: string; phone: string; trx?: string }> {
  const ctx = await browser.newContext({ baseURL: STORE, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addCookies([{ name: "bt_lang", value: "en", url: STORE }]);
  const page = await ctx.newPage();
  const phone = o.phone ?? freshPhone();
  await page.goto(`/products/${o.slug}`);
  await page.getByTestId(`size-${o.size}`).click();
  for (let i = 1; i < (o.qty ?? 1); i++) await page.getByRole("button", { name: "+", exact: true }).click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toBeVisible();
  await page.goto("/checkout");
  await page.getByLabel("Mobile number").fill(phone.slice(1));
  await page.getByLabel("Full name").fill("Tania Akter");
  await page.locator("#f-upazila").selectOption("Mirpur");
  await page.getByLabel("House, road and area").fill("House 14, Road 7, Block C, Section 10");
  let trx: string | undefined;
  if (o.pay === "bkash" || o.pay === "nagad") {
    await page.getByTestId(`pay-${o.pay}`).check();
    trx = `E${Date.now().toString(36).toUpperCase()}${n}`.slice(0, 11).padEnd(9, "Q");
    await page.locator("#f-mfsSender").fill(phone);
    await page.locator("#f-trxId").fill(trx);
  }
  if (o.coupon) {
    await page.locator("#f-coupon").fill(o.coupon);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText(`Coupon ${o.coupon} applied`)).toBeVisible();
  }
  await page.locator('[data-testid="place-order"]:visible, [data-testid="place-order-desktop"]:visible').first().click();
  await expect(page).toHaveURL(/\/order\//);
  const orderNumber = (await page.getByTestId("order-success").innerText()).match(/BT-\d+/)![0];
  await ctx.close();
  return { orderNumber, phone, trx };
}

/** Opens an order from the orders list by its number. */
export async function openOrder(page: Page, orderNumber: string, tab = "") {
  await page.goto(`/orders${tab ? `?tab=${tab}` : ""}`);
  await page.locator(`a:has-text("${orderNumber}"):visible`).first().click();
  await expect(page.getByTestId("order-title")).toHaveText(orderNumber);
}

/** A real photo-sized PNG so the upload goes through the same processing as a phone camera picture. */
export async function samplePhoto(): Promise<Buffer> {
  return sharp({ create: { width: 1200, height: 1600, channels: 3, background: "#C9B79C" } }).png().toBuffer();
}

export const orderIdFromUrl = (url: string) => url.match(/\/orders\/([a-z0-9]+)/)![1]!;
