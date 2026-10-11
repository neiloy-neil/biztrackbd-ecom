import { readFileSync } from "node:fs";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { DEMO, tenantId, withDb } from "./db";
import { ADMIN, STORE, actAs, freshPhone, openOrder, orderIdFromUrl } from "./helpers";

/**
 * Phase 6 acceptance: an abandoned checkout creates a call-list entry and a recovery SMS; Purchase events dedupe between
 * browser and server. Also reviews, from a delivered order to a published review. Meta is a local stand-in (e2e/fake-meta.mjs).
 */
const META = "http://localhost:4011";
const CRON = { Authorization: "Bearer e2e-cron-secret-0123456789" };
const PIXEL = "123456789012345";
const local = (p: string) => p.slice(1);
const tail = (p: string) => p.slice(-6);

interface Sms { to: string; text: string }
const smsOf = (file: string): Sms[] => {
  try {
    return readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Sms);
  } catch {
    return [];
  }
};
const adminSms = () => smsOf(process.env.E2E_ADMIN_SMS_OUTBOX!);
const storeSms = () => smsOf(process.env.E2E_STORE_SMS_OUTBOX!);

async function customer(browser: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ baseURL: STORE, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addCookies([{ name: "bt_lang", value: "en", url: STORE }]);
  return { ctx, page: await ctx.newPage() };
}

async function addToCart(page: Page, slug: string, size: string) {
  await page.goto(`/products/${slug}`);
  await page.getByTestId(`size-${size}`).click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toBeVisible();
}

/** Types a number at checkout and leaves. Waits long enough for the quiet capture to be sent. */
async function leaveCheckout(page: Page, phone: string, name: string) {
  await page.goto("/checkout");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Mobile number").fill(local(phone));
  await page.waitForTimeout(2500);
}

async function placeFromCheckout(page: Page) {
  await page.getByLabel("Full name").fill("Tania Akter");
  await page.locator("#f-upazila").selectOption("Mirpur");
  await page.getByLabel("House, road and area").fill("House 14, Road 7, Block C, Section 10");
  await page.locator('[data-testid="place-order"]:visible, [data-testid="place-order-desktop"]:visible').first().click();
  await expect(page).toHaveURL(/\/order\//);
  return (await page.getByTestId("order-success").innerText()).match(/BT-\d+/)![0];
}

const hits = async (request: { get: (u: string) => Promise<{ json: () => Promise<unknown> }> }) => (await (await request.get(`${META}/__hits`)).json()) as { pixel: string; body: { data: { event_name: string; event_id: string; user_data: Record<string, unknown>; custom_data: Record<string, unknown> }[]; test_event_code?: string } }[];

test.describe.serial("growth tools", () => {
  const A = { phone: freshPhone(), name: "Abandon Caller" };
  const B = { phone: freshPhone(), name: "Sms Recovered" };
  let purchaseOrder = "";
  let reviewPhone = "";
  let reviewOrderNumber = "";

  test.beforeAll(async ({ request }) => {
    await request.post(`${META}/__reset`);
    await withDb(async (c) => {
      const t = await tenantId();
      await c.query(`DELETE FROM "AbandonedCheckout" WHERE "tenantId" = $1`, [t]);
      await c.query(`DELETE FROM "Review" WHERE "tenantId" = $1`, [t]);
      await c.query(`DELETE FROM "TrackingEvent" WHERE "tenantId" = $1`, [t]);
      await c.query(`DELETE FROM "TenantIntegration" WHERE "tenantId" = $1 AND provider = 'META_CAPI'`, [t]);
      await c.query(`DELETE FROM "UsageCounter" WHERE "tenantId" = $1 AND metric = 'sms'`, [t]);
      await c.query(`UPDATE "StoreSettings" SET "metaPixelId" = NULL, "reviewsAutoPublish" = false, "abandonedSmsEnabled" = true WHERE "tenantId" = $1`, [t]);
    });
  });
  test.beforeEach(async ({ context }) => actAs(context, "owner"));

  test("the owner installs the Pixel and the server token, and sends a test event", async ({ page, request }) => {
    await page.goto("/marketing/pixels");
    await page.waitForLoadState("networkidle"); // let the page hydrate, or a fast click submits the form the plain way
    await expect(page.getByTestId("pixel-config")).toContainText("Not set up");
    await page.getByTestId("pixel-id").fill("abc");
    await page.getByRole("button", { name: "Save Pixel ID" }).click();
    await expect(page.getByTestId("pixel-error")).toContainText("8 to 20 digits");
    await page.getByTestId("pixel-id").fill(PIXEL);
    await page.getByRole("button", { name: "Save Pixel ID" }).click();
    await expect(page.getByText("Pixel ID saved.")).toBeVisible();
    await expect(page.getByTestId("pixel-config")).toContainText("Installed");

    await page.goto("/settings/integrations?mode=LIVE");
    const card = page.locator(".card").filter({ has: page.locator("strong", { hasText: /^Meta Conversions API$/ }) });
    await card.getByLabel("pixelId").fill(PIXEL);
    await card.getByLabel("accessToken").fill("e2e-meta-token");
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByText("Saved.")).toBeVisible();

    await page.goto("/marketing/pixels");
    await expect(page.getByTestId("capi-config")).toContainText("Connected");
    await page.getByLabel("Test event code").fill("TEST12345");
    await page.getByRole("button", { name: "Send a test event" }).click();
    await expect(page.getByText("Test event sent.")).toBeVisible();
    const h = await hits(request);
    expect(h.at(-1)!.body.test_event_code).toBe("TEST12345");
    expect(h.at(-1)!.pixel).toBe(PIXEL);
  });

  test("a customer who types a number at checkout and leaves shows up on the call list", async ({ browser, page }) => {
    const c = await customer(browser);
    await addToCart(c.page, "cotton-panjabi-off-white", "L");
    await leaveCheckout(c.page, A.phone, A.name);
    await c.ctx.close();
    await page.goto("/abandoned");
    const card = page.getByTestId("abandoned-card").filter({ hasText: tail(A.phone) }).filter({ visible: true });
    await expect(card).toContainText(A.name);
    await expect(card).toContainText("Cotton Panjabi, Off-white (L) × 1");
    await expect(card.getByTestId("cart-value")).toHaveText("৳ 1,150");
    await expect(page.getByTestId("stat-dropped")).not.toHaveText("0");
    await expect(card.getByRole("link", { name: /^Call / })).toHaveAttribute("href", `tel:${A.phone}`);
  });

  test("browser and server events for the same visit are counted once", async ({ page, request }) => {
    await page.goto("/marketing/pixels");
    const row = (name: string) => page.locator(`[data-testid="event-stats"] tr[data-event="${name}"]`);
    await expect(row("ViewContent")).toContainText("counted once");
    await expect(row("AddToCart")).toContainText("counted once");
    await expect(row("InitiateCheckout")).toContainText("counted once");
    const h = await hits(request);
    const names = h.flatMap((x) => x.body.data.map((d) => d.event_name));
    expect(names).toEqual(expect.arrayContaining(["ViewContent", "AddToCart", "InitiateCheckout"]));
    // Same id on both sides: the Pixel in the browser and the server send the same event_id.
    const ids = h.flatMap((x) => x.body.data.map((d) => d.event_id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("the owner logs a call, and the checkout moves to Called with the note kept", async ({ page }) => {
    await page.goto("/abandoned");
    const card = page.getByTestId("abandoned-card").filter({ hasText: tail(A.phone) }).filter({ visible: true });
    await card.getByLabel("Call note").fill("Phone was off, try after Asr");
    await card.getByRole("button", { name: "Log the call" }).click();
    await expect(page.getByText("Call logged.")).toBeVisible();
    await page.goto("/abandoned?tab=called");
    const called = page.getByTestId("abandoned-card").filter({ hasText: tail(A.phone) }).filter({ visible: true });
    await expect(called).toContainText("Last call: No answer");
    await expect(called).toContainText("Phone was off");
    await page.goto("/abandoned?tab=to_call");
    await expect(page.getByTestId("abandoned-card").filter({ hasText: tail(A.phone) })).toHaveCount(0);
  });

  test("after 30 minutes the customer gets one SMS with a link that restores their cart, and ordering recovers the checkout", async ({ browser, page, request }) => {
    const c = await customer(browser);
    await addToCart(c.page, "linen-shirt-sage", "M");
    await leaveCheckout(c.page, B.phone, B.name);
    await c.ctx.close();

    // Not yet 30 minutes: nothing is sent.
    const before = adminSms().filter((m) => m.to === B.phone).length;
    expect((await request.post(`${ADMIN}/api/cron/abandoned`, { headers: CRON })).status()).toBe(200);
    expect(adminSms().filter((m) => m.to === B.phone)).toHaveLength(before);

    await withDb(async (cl) => cl.query(`UPDATE "AbandonedCheckout" SET "lastEventAt" = timezone('utc', now()) - interval '45 minutes' WHERE phone = $1`, [B.phone]));
    const run = await request.post(`${ADMIN}/api/cron/abandoned`, { headers: CRON });
    expect(await run.json()).toMatchObject({ ok: true });
    const sent = adminSms().filter((m) => m.to === B.phone);
    expect(sent).toHaveLength(before + 1);
    const link = sent.at(-1)!.text.match(/https?:\/\/\S+\/checkout\?recover=[a-f0-9]{48}/)?.[0];
    expect(link, "the SMS carries the recovery link").toBeTruthy();
    expect(sent.at(-1)!.text).toContain("৳850");
    // A second sweep, and a third, send nothing more. The customer who was already called is never texted.
    await request.post(`${ADMIN}/api/cron/abandoned`, { headers: CRON });
    expect(adminSms().filter((m) => m.to === B.phone)).toHaveLength(before + 1);
    expect(adminSms().filter((m) => m.to === A.phone)).toHaveLength(0);

    // The customer taps the link on their phone: their cart and number are back.
    const back = await customer(browser);
    await back.page.goto(link!.replace(/^https?:\/\/[^/]+/, ""));
    await expect(back.page.getByTestId("order-summary").first()).toContainText("Linen Shirt, Sage");
    await expect(back.page.getByLabel("Mobile number")).toHaveValue(new RegExp(local(B.phone).slice(0, 4)));
    await expect(back.page.getByLabel("Full name")).toHaveValue(B.name);
    const orderNumber = await placeFromCheckout(back.page);
    reviewOrderNumber = orderNumber;
    reviewPhone = B.phone;
    purchaseOrder = orderNumber;
    await back.ctx.close();

    await page.goto("/abandoned?tab=recovered");
    const done = page.getByTestId("abandoned-card").filter({ hasText: tail(B.phone) }).filter({ visible: true });
    await expect(done).toBeVisible();
    await expect(done.getByRole("link", { name: "Open the order" })).toBeVisible();
    await page.goto("/abandoned");
    await expect(page.getByTestId("abandoned-stats")).toContainText("%");
  });

  test("the Purchase is reported by the server and the browser with one shared id, and only hashed details leave", async ({ page, request }) => {
    await openOrder(page, purchaseOrder, "all");
    const orderId = orderIdFromUrl(page.url());
    await expect.poll(async () => (await hits(request)).flatMap((x) => x.body.data).filter((d) => d.event_name === "Purchase").length, { timeout: 20_000 }).toBeGreaterThan(0);
    const purchases = (await hits(request)).flatMap((x) => x.body.data).filter((d) => d.event_name === "Purchase");
    expect(purchases).toHaveLength(1);
    expect(purchases[0]!.event_id).toBe(`purchase_${orderId}`);
    expect(purchases[0]!.custom_data).toMatchObject({ currency: "BDT", value: 930 });
    expect(JSON.stringify(purchases[0])).not.toContain(local(B.phone));
    expect((purchases[0]!.user_data.ph as string[])[0]).toMatch(/^[a-f0-9]{64}$/);
    await page.goto("/marketing/pixels");
    await expect(page.locator('[data-testid="event-stats"] tr[data-event="Purchase"]')).toContainText("counted once");
  });

  test("the owner turns a called customer into an order from the call list", async ({ page }) => {
    await page.goto("/abandoned?tab=called");
    await page.getByTestId("abandoned-card").filter({ hasText: tail(A.phone) }).filter({ visible: true }).getByTestId("make-order").click();
    await expect(page).toHaveURL(/\/orders\/new\?abandoned=/);
    await expect(page.getByTestId("desk-phone")).toHaveValue(new RegExp(local(A.phone).slice(0, 4)));
    await expect(page.getByTestId("desk-name")).toHaveValue(A.name);
    await expect(page.getByTestId("desk-line")).toContainText("Cotton Panjabi, Off-white (L)");
    await page.getByTestId("desk-upazila").selectOption("Mirpur");
    await page.getByTestId("desk-address").fill("House 9, Road 3, Mirpur 10");
    await page.getByTestId("desk-create").click();
    await expect(page).toHaveURL(/\/orders\/[a-z0-9]+$/);
    await page.goto("/abandoned?tab=recovered");
    await expect(page.getByTestId("abandoned-card").filter({ hasText: tail(A.phone) }).filter({ visible: true })).toBeVisible();
  });

  test("a delivered order lets the customer write a review, which waits for the owner, then goes live with a reply", async ({ browser, page, context }) => {
    // The owner confirms, hands over and delivers the recovered order.
    await openOrder(page, reviewOrderNumber, "all");
    await page.getByRole("button", { name: "Confirm order" }).filter({ visible: true }).first().click();
    await expect(page.locator(".page-head .pill", { hasText: "To pack" })).toBeVisible();
    await page.getByText("Deliver it yourself, or book outside this app").click();
    await page.getByRole("button", { name: "Hand over and mark shipped" }).click();
    await expect(page.locator(".page-head .pill", { hasText: "Shipped" })).toBeVisible();
    await page.getByRole("button", { name: "Mark delivered" }).filter({ visible: true }).first().click();
    await expect(page.locator(".page-head .pill", { hasText: "Delivered" })).toBeVisible();

    // The customer signs in with a texted code and sees what they can review.
    const c = await customer(browser);
    await c.page.goto("/account");
    await c.page.getByTestId("login-phone").fill(local(reviewPhone));
    await c.page.getByTestId("send-code").click();
    await expect(c.page.getByTestId("login-code")).toBeVisible();
    const code = [...storeSms()].reverse().find((m) => m.to === reviewPhone)!.text.match(/^(\d{6}) /)![1]!;
    await c.page.getByTestId("login-code").fill(code);
    await c.page.getByTestId("verify-code").click();
    await expect(c.page.getByTestId("to-review")).toContainText("Linen Shirt, Sage");
    await c.page.getByTestId("review-open").click();
    await c.page.getByTestId("star-4").click();
    await c.page.getByTestId("review-title").fill("Good fit");
    await c.page.getByTestId("review-body").fill("Fits well and the cotton is soft. <b>Delivery</b> was quick.");
    await c.page.getByTestId("review-submit").click();
    await expect(c.page.getByTestId("review-done")).toContainText("will appear after the store has read it");

    // Nothing is public yet.
    await c.page.goto("/products/linen-shirt-sage");
    await expect(c.page.getByTestId("reviews")).not.toContainText("Fits well");

    // The owner reads it, publishes it and replies.
    await page.goto("/reviews");
    const card = page.getByTestId("review-card").filter({ hasText: "Fits well" });
    await expect(card).toContainText("Good fit");
    await expect(card.getByTestId("review-body")).toHaveText("Fits well and the cotton is soft. Delivery was quick."); // markup stripped
    await card.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Review published.")).toBeVisible();
    await page.goto("/reviews?tab=published");
    await page.getByTestId("review-card").filter({ hasText: "Fits well" }).getByText("Reply", { exact: true }).click();
    await page.getByLabel("Reply", { exact: true }).fill("Thank you, Tania!");
    await page.getByRole("button", { name: "Save reply" }).click();
    await expect(page.getByText("Reply saved.")).toBeVisible();

    await c.page.goto("/products/linen-shirt-sage");
    const live = c.page.getByTestId("review").filter({ hasText: "Fits well" });
    await expect(live).toContainText("Good fit");
    await expect(live).toContainText("Verified buyer");
    await expect(live).toContainText("Thank you, Tania!");
    await expect(c.page.getByTestId("reviews-average")).toContainText("4");

    // Hiding it takes it down again.
    await page.goto("/reviews?tab=published");
    await page.getByTestId("review-card").filter({ hasText: "Fits well" }).getByRole("button", { name: "Hide" }).click();
    await expect(page.getByText("Review hidden.")).toBeVisible();
    await c.page.reload();
    await expect(c.page.getByTestId("reviews")).not.toContainText("Fits well");
    await c.ctx.close();
    void context;
    void DEMO;
  });
});
