import { readFileSync } from "node:fs";
import { expect, type APIRequestContext, type Page, type PlaywrightWorkerArgs } from "@playwright/test";

let n = 0;
/** A fresh valid mobile number per call, so tests never trip the 3-orders-per-phone-per-day limit. */
export function freshPhone(): string {
  const tail = String((Date.now() + ++n * 7919 + Math.floor(Math.random() * 1000)) % 100_000_000).padStart(8, "0");
  return `01${3 + (n % 7)}${tail}`.slice(0, 11);
}

/** HTTP client for the demo store. Node cannot resolve *.localhost, so it connects to 127.0.0.1 and sends the store's Host header. */
export async function storeApi(playwright: PlaywrightWorkerArgs["playwright"]): Promise<APIRequestContext> {
  return playwright.request.newContext({ baseURL: "http://127.0.0.1:3000", extraHTTPHeaders: { Host: "rongdhonu.localhost:3000" } });
}

export const localDigits = (phone: string) => phone.slice(1);

/** Last code the development SMS sender wrote for this number. */
export function lastSmsCode(phone: string): string {
  const lines = readFileSync(process.env.E2E_SMS_OUTBOX_PATH!, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as { to: string; text: string });
  const m = [...lines].reverse().find((l) => l.to === phone)?.text.match(/^(\d{6}) /);
  if (!m) throw new Error(`No sign-in code was sent to ${phone}`);
  return m[1]!;
}

export async function setEnglish(page: Page) {
  await page.context().addCookies([{ name: "bt_lang", value: "en", url: "http://rongdhonu.localhost:3000" }]);
}

export async function noHorizontalScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth, "page is wider than the screen").toBeLessThanOrEqual(innerWidth + 1);
}

/** Opens a product, optionally picks a size, adds it to the cart. */
export async function addProduct(page: Page, slug: string, opts: { size?: string; qty?: number } = {}) {
  await page.goto(`/products/${slug}`);
  if (opts.size) await page.getByTestId(`size-${opts.size}`).click();
  for (let i = 1; i < (opts.qty ?? 1); i++) await page.getByRole("button", { name: "+", exact: true }).click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByRole("status")).toContainText("Added to your cart");
}

export interface CheckoutData {
  phone: string;
  name?: string;
  division?: string;
  district?: string;
  upazila?: string;
  address?: string;
}

export async function fillCheckout(page: Page, d: CheckoutData) {
  await page.getByLabel("Mobile number").fill(localDigits(d.phone));
  await page.getByLabel("Full name").fill(d.name ?? "Tania Akter");
  if (d.division) await page.locator("#f-division").selectOption(d.division);
  if (d.district) await page.locator("#f-district").selectOption(d.district);
  await page.locator("#f-upazila").selectOption(d.upazila ?? "Mirpur");
  await page.getByLabel("House, road and area").fill(d.address ?? "House 14, Road 7, Block C, Section 10");
}
