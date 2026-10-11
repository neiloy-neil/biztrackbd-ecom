import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { DEMO, tenantId, withDb } from "./db";
import { STORE, actAs, customerOrders, freshPhone, openOrder } from "./helpers";

/**
 * Phase 9: loyalty points, VIP levels and referrals (docs/26), from the owner switching the program on, to a customer earning
 * points when a parcel is delivered, spending them at checkout, and a friend's order paying the referrer.
 */
const local = (p: string) => p.slice(1);
interface Sms { to: string; text: string }
const outbox = (file: string): Sms[] => {
  try {
    return readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Sms);
  } catch {
    return [];
  }
};
const storeSms = () => outbox(process.env.E2E_STORE_SMS_OUTBOX!);
/** Messages sent from the admin app (a delivery is marked there), as opposed to sign-in codes sent by the storefront. */
const adminSms = () => outbox(process.env.E2E_ADMIN_SMS_OUTBOX!);

/** `ip` makes the visitor arrive from another connection (the store reads x-forwarded-for); without it every visitor shares localhost. */
async function visitor(browser: Browser, cookies: { name: string; value: string }[] = [], ip?: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ baseURL: STORE, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, extraHTTPHeaders: ip ? { "x-forwarded-for": ip } : undefined });
  await ctx.addCookies([{ name: "bt_lang", value: "en", url: STORE }, ...cookies.map((c) => ({ ...c, url: STORE }))]);
  return { ctx, page: await ctx.newPage() };
}

async function signIn(page: Page, phone: string) {
  await page.goto("/account");
  await page.getByTestId("login-phone").fill(local(phone));
  await page.getByTestId("send-code").click();
  await expect(page.getByTestId("login-code")).toBeVisible();
  const code = [...storeSms()].reverse().find((m) => m.to === phone)!.text.match(/^(\d{6}) /)![1]!;
  await page.getByTestId("login-code").fill(code);
  await page.getByTestId("verify-code").click();
}

/** Puts a product in the cart and fills the checkout, leaving the order unplaced. */
async function fillCheckout(page: Page, o: { phone: string; name: string; address: string; slug?: string; size?: string }) {
  await page.goto(`/products/${o.slug ?? "cotton-panjabi-off-white"}`);
  await page.getByTestId(`size-${o.size ?? "L"}`).click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toBeVisible();
  await page.goto("/checkout");
  await page.getByLabel("Mobile number").fill(local(o.phone));
  await page.getByLabel("Full name").fill(o.name);
  await page.locator("#f-upazila").selectOption("Mirpur");
  await page.getByLabel("House, road and area").fill(o.address);
}
async function place(page: Page): Promise<string> {
  await page.locator('[data-testid="place-order"]:visible, [data-testid="place-order-desktop"]:visible').first().click();
  await expect(page).toHaveURL(/\/order\//);
  return (await page.getByTestId("order-success").innerText()).match(/BT-\d+/)![0];
}

async function deliverInAdmin(page: Page, orderNumber: string) {
  await openOrder(page, orderNumber, "all");
  await page.getByRole("button", { name: "Confirm order" }).filter({ visible: true }).first().click();
  await expect(page.locator(".page-head .pill", { hasText: "To pack" })).toBeVisible();
  await page.getByText("Deliver it yourself, or book outside this app").click();
  await page.getByRole("button", { name: "Hand over and mark shipped" }).click();
  await expect(page.locator(".page-head .pill", { hasText: "Shipped" })).toBeVisible();
  await page.getByRole("button", { name: "Mark delivered" }).filter({ visible: true }).first().click();
  await expect(page.locator(".page-head .pill", { hasText: "Delivered" })).toBeVisible();
}

test.describe.serial("loyalty, VIP levels and referrals", () => {
  const member = freshPhone();
  const friend = freshPhone();
  let memberOrder = "";
  let referralLink = "";

  test.beforeAll(async () => {
    await withDb(async (c) => {
      const t = await tenantId();
      // Sign-in codes are limited to 10 per address per hour (docs/12); repeated test runs would otherwise hit that limit.
      await c.query(`DELETE FROM "CustomerOtp" WHERE "tenantId" = $1`, [t]);
      await c.query(`DELETE FROM "Page" WHERE "tenantId" = $1 AND slug LIKE 'e2e-%'`, [t]);
      await c.query(`DELETE FROM "BlogPost" WHERE "tenantId" = $1 AND slug LIKE 'e2e-%'`, [t]);
      await c.query(`DELETE FROM "CustomerReferral" WHERE "tenantId" = $1`, [t]);
      await c.query(`DELETE FROM "LoyaltyTransaction" WHERE "tenantId" = $1`, [t]).catch(() => undefined); // the app role cannot, the owner can
      await c.query(`DELETE FROM "CustomerLoyaltyAccount" WHERE "tenantId" = $1`, [t]);
      await c.query(`UPDATE "StoreSettings" SET "loyaltyEnabled" = false, "referralEnabled" = false, "loyaltySpendPerPoint" = 100, "loyaltyPointsPerBlock" = 10, "loyaltyBdtPerBlock" = 10, "loyaltyMaxCartPercent" = 30, "refereeDiscountBdt" = 50, "refereeMinCartBdt" = 500, "referrerRewardPoints" = 100 WHERE "tenantId" = $1`, [t]);
    });
  });
  test.afterAll(async () => {
    await withDb(async (c) => {
      const t = await tenantId();
      await c.query(`UPDATE "StoreSettings" SET "loyaltyEnabled" = false, "referralEnabled" = false WHERE "tenantId" = $1`, [t]);
      await c.query(`DELETE FROM "Page" WHERE "tenantId" = $1 AND slug LIKE 'e2e-%'`, [t]);
      await c.query(`DELETE FROM "BlogPost" WHERE "tenantId" = $1 AND slug LIKE 'e2e-%'`, [t]);
    });
  });
  test.beforeEach(async ({ context }) => actAs(context, "owner"));

  test("only people who may run marketing can see or change the program", async ({ page, context }) => {
    await actAs(context, "packer");
    await page.goto("/marketing/loyalty");
    await expect(page).toHaveURL(/\/no-access/);
  });

  test("the owner switches the program on, and a wrong value is refused with a reason", async ({ page }) => {
    await page.goto("/marketing/loyalty");
    await expect(page.getByTestId("loyalty-settings")).toBeVisible();
    await page.getByLabel("Reward points and VIP levels are on").check();
    await page.getByLabel("Refer a friend is on").check();
    await page.getByLabel("Points can pay at most (% of the cart)").fill("150");
    await page.getByRole("button", { name: "Save settings" }).click();
    // The browser's own limit stops 150, so the form was not sent.
    await expect(page.getByTestId("loyalty-error")).toHaveCount(0);
    await page.getByLabel("Points can pay at most (% of the cart)").fill("30");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();
    await expect(page.getByLabel("Reward points and VIP levels are on")).toBeChecked();
  });

  test("a delivered order earns points that unlock only on delivery, shown in the header and on the account page", async ({ browser, page }) => {
    const o = await customerOrders(browser, { slug: "cotton-panjabi-off-white", size: "L", pay: "COD", phone: member });
    memberOrder = o.orderNumber;
    const pending = await withDb(async (c) => (await c.query(`SELECT a."pendingPoints" AS p, a."availablePoints" AS a FROM "CustomerLoyaltyAccount" a JOIN "Customer" c ON c.id = a."customerId" WHERE c.phone = $1 AND c."tenantId" = a."tenantId"`, [member])).rows[0] as { p: number; a: number });
    expect(pending.p).toBeGreaterThan(0);
    expect(pending.a).toBe(0);

    await deliverInAdmin(page, memberOrder);
    const v = await visitor(browser);
    await signIn(v.page, member);
    await expect(v.page.getByTestId("rewards")).toBeVisible();
    await expect(v.page.getByTestId("points-balance")).toContainText(String(pending.p));
    await expect(v.page.getByTestId("tier-badge")).toContainText("Bronze");
    await expect(v.page.getByTestId("tier-progress")).toContainText("Silver");
    await expect(v.page.getByTestId("ledger")).toContainText("Earned");
    await expect(v.page.getByTestId("points-pill")).toContainText(String(pending.p));
    const axe = await new AxeBuilder({ page: v.page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(axe.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(" ")).slice(0, 2).join(" | ")}`)).toEqual([]);
    expect(await v.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    referralLink = await v.page.getByTestId("referral-link").inputValue();
    expect(referralLink).toMatch(/\/ref\/REF-[A-Z]+-[A-Z2-9]{3}$/);
    await v.ctx.close();
  });

  test("a signed-in customer spends points at checkout; a guest is asked to sign in", async ({ browser, request }) => {
    // Give the member enough to see a clear discount.
    await withDb(async (c) => {
      await c.query(`UPDATE "CustomerLoyaltyAccount" SET "availablePoints" = "availablePoints" + 200, "lifetimePoints" = "lifetimePoints" + 200 WHERE "customerId" = (SELECT id FROM "Customer" WHERE phone = $1 AND "tenantId" = $2)`, [member, await tenantId()]);
    });
    void request;
    const guest = await visitor(browser);
    await fillCheckout(guest.page, { phone: member, name: "Member Name", address: "House 21, Road 3, Mirpur 10" });
    await expect(guest.page.getByTestId("points-box")).toContainText("Sign in");
    await guest.ctx.close();

    const v = await visitor(browser);
    await signIn(v.page, member);
    await fillCheckout(v.page, { phone: member, name: "Member Name", address: "House 21, Road 3, Mirpur 10" });
    // On a phone the order summary is folded away until it is opened.
    const fold = v.page.locator("summary.summary-toggle");
    if (await fold.isVisible()) await fold.click();
    const grand = v.page.getByTestId("grand-total").filter({ visible: true }).first();
    await expect(grand).not.toHaveText(/^৳\s?0$/, { timeout: 10_000 });
    const before = await grand.innerText();
    await v.page.getByTestId("use-points").check();
    await expect(v.page.getByTestId("points-line").filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(grand).not.toHaveText(before);
    const after = await grand.innerText();
    const n = (s: string) => Number(s.replace(/[^\d.]/g, ""));
    expect(n(after)).toBeLessThan(n(before));
    const orderNumber = await place(v.page);
    await expect(v.page.getByText("Member discounts")).toBeVisible();
    const row = await withDb(async (c) => (await c.query(`SELECT "loyaltyPointsUsed" AS used, "loyaltyDiscountBdt"::float AS disc, "totalAmount"::float AS total FROM "Order" WHERE "orderNumber" = $1`, [orderNumber])).rows[0] as { used: number; disc: number; total: number });
    expect(row.used).toBeGreaterThan(0);
    expect(row.disc).toBe((row.used / 10) * 10);
    expect(n(after)).toBe(row.total);
    await v.ctx.close();
  });

  test("a friend on the referrer's own connection is refused with a reason", async ({ browser }) => {
    const code = referralLink.split("/ref/")[1]!;
    const f = await visitor(browser, [{ name: "bt_ref", value: code }]); // same connection as the member's order
    await fillCheckout(f.page, { phone: freshPhone(), name: "Same Connection", address: "Flat 3A, Lane 4, Uttara" });
    await f.page.locator('[data-testid="place-order"]:visible, [data-testid="place-order-desktop"]:visible').first().click();
    await expect(f.page.getByRole("alert").filter({ hasText: "same connection" }).first()).toBeVisible({ timeout: 15_000 });
    await expect(f.page).toHaveURL(/\/checkout/);
    await f.ctx.close();
  });

  test("a friend arrives by the referral link, sees the offer, and gets it at checkout", async ({ browser, page }) => {
    const code = referralLink.split("/ref/")[1]!;
    const f = await visitor(browser, [], "203.0.113.77"); // another connection than the member's
    await f.page.goto(`/ref/${code}`);
    await expect(f.page.getByTestId("referral-banner")).toContainText("off your first order");
    await fillCheckout(f.page, { phone: friend, name: "Friend Name", address: "Flat 5B, Lane 9, Gulshan 2" });
    if (await f.page.locator("summary.summary-toggle").isVisible()) await f.page.locator("summary.summary-toggle").click();
    await expect(f.page.getByTestId("referral-line").filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 });
    const friendOrder = await place(f.page);
    const ref = await withDb(async (c) => (await c.query(`SELECT r."isDelivered" AS d, o."referralDiscountBdt"::float AS disc FROM "CustomerReferral" r JOIN "Order" o ON o.id = r."firstOrderId" WHERE r."refereePhone" = $1`, [friend])).rows[0] as { d: boolean; disc: number });
    expect(ref).toEqual({ d: false, disc: 50 });
    await f.ctx.close();

    // The referrer's points arrive only when the friend's parcel is delivered, and they are told.
    const balanceBefore = await withDb(async (c) => Number((await c.query(`SELECT "availablePoints" AS p FROM "CustomerLoyaltyAccount" WHERE "referralCode" = $1`, [code])).rows[0].p));
    await deliverInAdmin(page, friendOrder);
    const after = await withDb(async (c) => Number((await c.query(`SELECT "availablePoints" AS p FROM "CustomerLoyaltyAccount" WHERE "referralCode" = $1`, [code])).rows[0].p));
    expect(after).toBe(balanceBefore + 100);
    expect(adminSms().some((m) => m.to === member && /100/.test(m.text))).toBe(true);
  });

  test("the friend cannot use the same offer again, and a returning customer is refused", async ({ browser }) => {
    const code = referralLink.split("/ref/")[1]!;
    const f = await visitor(browser, [{ name: "bt_ref", value: code }]);
    await fillCheckout(f.page, { phone: friend, name: "Friend Name", address: "Flat 8C, Lane 2, Banani" });
    await expect(f.page.getByTestId("referral-box")).toContainText("first order only", { timeout: 10_000 });
    await f.ctx.close();
  });

  test("the owner sees the program's numbers and top customers, and can correct a balance with a reason", async ({ page }) => {
    await page.goto("/marketing/loyalty");
    await expect(page.getByTestId("loyalty-stats")).toContainText("Members");
    await expect(page.getByTestId("leader-row").filter({ hasText: member.slice(-6) })).toBeVisible();
    await expect(page.getByTestId("loyalty-stats")).toContainText("1 delivered and rewarded");
    await page.getByLabel("Customer's mobile").fill(member);
    await page.getByLabel("Points (use a minus to remove)").fill("-99999");
    await page.getByLabel("Reason").fill("Too many");
    await page.getByRole("button", { name: "Change points" }).click();
    await expect(page.getByTestId("loyalty-error")).toContainText("has only");
    await page.getByLabel("Customer's mobile").fill(member);
    await page.getByLabel("Points (use a minus to remove)").fill("25");
    await page.getByLabel("Reason").fill("Thank you for the referral");
    await page.getByRole("button", { name: "Change points" }).click();
    await expect(page.getByText("Points changed.")).toBeVisible();
    const logged = await withDb(async (c) => Number((await c.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE action = 'loyalty.points_adjusted' AND "tenantId" = $1`, [await tenantId()])).rows[0].n));
    expect(logged).toBeGreaterThanOrEqual(1);
  });

  test("the owner writes a page: hidden until published, then in the footer, with unsafe markup removed", async ({ browser, page }) => {
    await page.goto("/content?tab=pages&edit=new");
    await page.getByLabel("Title").fill("E2E Delivery policy");
    await page.getByLabel("Web address (optional)").fill("e2e-delivery-policy");
    await page.getByLabel("Text").fill("We deliver in 1 to 2 days inside Dhaka.\n\n<script>window.__pwned = 1</script><b>Free</b> over 3000.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    const v = await visitor(browser);
    expect((await v.page.goto("/p/e2e-delivery-policy"))?.status()).toBe(404);

    await page.getByLabel("Visible to customers").check();
    await page.getByRole("button", { name: "Save" }).click();
    // The first "Saved." notice is still on screen, so wait for the list to say Published.
    await expect(page.getByTestId("content-row").locator(".pill")).toHaveText("Published");

    await v.page.goto("/p/e2e-delivery-policy");
    await expect(v.page.getByTestId("store-page")).toContainText("We deliver in 1 to 2 days inside Dhaka.");
    expect(await v.page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    await expect(v.page.locator(".prose script")).toHaveCount(0);
    await expect(v.page.locator(".prose b")).toHaveText("Free");
    await expect(v.page.locator("footer").getByRole("link", { name: "E2E Delivery policy" })).toBeVisible();
    const axe = await new AxeBuilder({ page: v.page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(axe.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(" ")).slice(0, 2).join(" | ")}`)).toEqual([]);

    // Taking it down removes it from the footer and the address.
    await page.getByLabel("Visible to customers").uncheck();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("content-row").locator(".pill")).toHaveText("Draft");
    expect((await v.page.goto("/p/e2e-delivery-policy"))?.status()).toBe(404);
    await v.ctx.close();
  });

  test("the owner writes a blog post, readers find it in the blog, and a duplicate address is refused", async ({ browser, page }) => {
    await page.goto("/content?tab=posts&edit=new");
    await page.getByLabel("Title").fill("E2E Eid styling guide");
    await page.getByLabel("Web address (optional)").fill("e2e-eid-guide");
    await page.getByLabel("Short summary").fill("How to dress for Eid");
    await page.getByLabel("Written by").fill("Nusrat");
    await page.getByLabel("Tags (separated by commas)").fill("Eid, Style");
    await page.getByLabel("Text").fill("Pick a panjabi.\n\nThen the shoes.");
    await page.getByLabel("Visible to customers").check();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.goto("/content?tab=posts&edit=new");
    await page.getByLabel("Title").fill("E2E Another");
    await page.getByLabel("Web address (optional)").fill("e2e-eid-guide");
    await page.getByLabel("Text").fill("x");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("content-error")).toContainText("already have one");

    const v = await visitor(browser);
    await v.page.goto("/blog");
    await expect(v.page.getByTestId("post-card").filter({ hasText: "E2E Eid styling guide" })).toContainText("How to dress for Eid");
    await v.page.getByTestId("post-card").filter({ hasText: "E2E Eid styling guide" }).click();
    await expect(v.page.getByTestId("blog-post")).toContainText("By Nusrat");
    await expect(v.page.getByTestId("blog-post")).toContainText("Then the shoes.");
    expect(await v.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await v.page.goto("/sitemap.xml");
    expect(await v.page.content()).toContain("/blog/e2e-eid-guide");
    await v.ctx.close();
  });

  test("staff who handle orders but not store design cannot open pages and blog", async ({ page, context }) => {
    await actAs(context, "packer");
    await page.goto("/content");
    await expect(page).toHaveURL(/\/no-access/);
  });

  test("with the program off, the store looks as it did before", async ({ browser, page }) => {
    await page.goto("/marketing/loyalty");
    await page.getByLabel("Reward points and VIP levels are on").uncheck();
    await page.getByLabel("Refer a friend is on").uncheck();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();
    const v = await visitor(browser);
    await signIn(v.page, member);
    await expect(v.page.getByTestId("rewards")).toHaveCount(0);
    await expect(v.page.getByTestId("points-pill")).toHaveCount(0);
    await fillCheckout(v.page, { phone: member, name: "Member Name", address: "House 33, Road 3, Mirpur 10" });
    await expect(v.page.getByTestId("points-box")).toHaveCount(0);
    await expect(v.page.getByTestId("referral-box")).toHaveCount(0);
    await v.ctx.close();
  });
});

void DEMO;
