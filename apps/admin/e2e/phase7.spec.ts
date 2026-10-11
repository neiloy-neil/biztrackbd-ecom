import { writeFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { tenantId, withDb } from "./db";
import { ADMIN, STORE, actAs, freshPhone, samplePhoto } from "./helpers";

/**
 * Phase 7 acceptance: editing in admin updates the preview in real time; a custom domain reaches Connected without support.
 * Also: draft vs published, going back to an older version, picture crop and upload, a landing page that takes a cash on
 * delivery order, and the platform's own view of domains. DNS answers come from a file this test writes, and Vercel is a
 * local stand-in (e2e/fake-vercel.mjs), so no real domain is needed.
 */
const PLAT = "http://localhost:3003";
const VERCEL = "http://localhost:4012";
const CRON = { Authorization: "Bearer e2e-cron-secret-0123456789" };
const dnsFile = () => process.env.E2E_DNS_FILE!;
const setDns = (table: Record<string, { a?: string[]; cname?: string[] }>) => writeFileSync(dnsFile(), JSON.stringify(table));
const run = Date.now().toString(36);
/** Accessibility and sideways scroll on a page a customer sees. */
async function customerQuality(page: Page) {
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "page scrolls sideways").toBeLessThanOrEqual(1);
}

/** A visitor on the live store, in their own browser. */
async function visitor(browser: Browser) {
  const ctx = await browser.newContext({ baseURL: STORE, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addCookies([{ name: "bt_lang", value: "en", url: STORE }]);
  return { ctx, page: await ctx.newPage() };
}

async function cleanDesign() {
  await withDb(async (c) => {
    const t = await tenantId();
    await c.query(`DELETE FROM "ThemeVersion" WHERE "tenantId" = $1`, [t]);
    await c.query(`DELETE FROM "LandingPage" WHERE "tenantId" = $1`, [t]);
    await c.query(`DELETE FROM "Domain" WHERE "tenantId" = $1 AND domain LIKE 'e2e-%'`, [t]);
  });
}

const frameOf = (page: Page) => page.frameLocator('[data-testid="preview-frame"]');
const row = (page: Page, type: string) => page.locator(`[data-testid="section-row"][data-type="${type}"]`);
const saved = (page: Page) => expect(page.getByTestId("design-status")).toHaveAttribute("data-save", "saved", { timeout: 15_000 });

test.describe.serial("store design, landing pages and domains", () => {
  test.beforeAll(async ({ request }) => {
    await cleanDesign();
    setDns({});
    await request.post(`${VERCEL}/__reset`);
  });
  test.afterAll(async () => {
    await cleanDesign();
    setDns({});
  });
  test.beforeEach(async ({ context }) => actAs(context, "owner"));

  test("editing updates the preview at once, without a reload, and the live store does not change until Publish", async ({ page, browser }) => {
    await page.goto("/design");
    const frame = frameOf(page);
    await expect(frame.getByTestId("preview-root")).toBeVisible();
    // A marker on the framed page: if the edit reloaded it, the marker would be gone.
    await frame.locator("body").evaluate(() => { (window as unknown as { __kept: number }).__kept = 1; });

    await row(page, "hero").locator(".pick").click();
    await page.getByLabel("Headline", { exact: true }).fill("Eid collection is here");
    await expect(frame.getByRole("heading", { level: 1 })).toHaveText("Eid collection is here", { timeout: 3000 });
    expect(await frame.locator("body").evaluate(() => (window as unknown as { __kept?: number }).__kept)).toBe(1);
    await saved(page);
    await expect(page.getByTestId("design-status")).toContainText("Not published yet");

    // The live store still shows the old page.
    const v = await visitor(browser);
    await v.page.goto("/");
    await expect(v.page.getByText("Eid collection is here")).toHaveCount(0);
    await v.ctx.close();
  });

  test("colours change the preview live, and unreadable colours are refused with a reason", async ({ page }) => {
    await page.goto("/design");
    const frame = frameOf(page);
    await expect(frame.getByTestId("preview-root")).toBeVisible();
    await page.getByTestId("tab-theme").click();
    await page.getByLabel("Main colour (buttons, links)", { exact: true }).fill("#0B5FFF");
    await expect.poll(() => frame.locator("html").evaluate((el) => getComputedStyle(el).getPropertyValue("--accent").trim().toUpperCase()), { timeout: 3000 }).toBe("#0B5FFF");
    await saved(page);

    // Pale text on the pale page: refused, the picture keeps the last good colours, nothing broken is saved.
    await page.getByLabel("Text colour", { exact: true }).fill("#F5F0E8");
    await expect(page.getByTestId("theme-panel").getByRole("alert")).toContainText("hard to read");
    await expect(page.getByTestId("design-error")).toContainText("hard to read", { timeout: 10_000 });
    await expect.poll(() => frame.locator("html").evaluate((el) => getComputedStyle(el).getPropertyValue("--ink").trim().toUpperCase())).not.toBe("#F5F0E8");
    await page.getByLabel("Text colour", { exact: true }).fill("#2B2118");
    await saved(page);
    await expect(page.getByTestId("design-error")).toHaveCount(0);
  });

  test("sections can be added, moved, hidden and filled in, and the preview follows", async ({ page }) => {
    await page.goto("/design");
    const frame = frameOf(page);
    await expect(frame.getByTestId("preview-root")).toBeVisible();
    // The earlier edits were saved as a draft and are still here after a reload.
    await expect(page.getByTestId("design-status")).toContainText("Not published yet");
    await row(page, "hero").locator(".pick").click();
    await expect(page.getByLabel("Headline", { exact: true })).toHaveValue("Eid collection is here");

    await page.getByTestId("add-type").selectOption("rich-text");
    await page.getByTestId("add-section").click();
    await page.getByLabel("Heading", { exact: true }).fill("Delivery in Dhaka");
    await page.getByLabel("Text", { exact: true }).fill("We deliver inside Dhaka in one to two days.");
    await expect(frame.getByRole("heading", { name: "Delivery in Dhaka" })).toBeVisible({ timeout: 3000 });

    await page.getByRole("button", { name: "Move Text block up" }).click();
    await expect(page.getByTestId("section-row")).toHaveCount(5);
    expect(await page.getByTestId("section-row").evaluateAll((els) => els.map((e) => e.getAttribute("data-type")))).toEqual(["hero", "featured-products", "category-grid", "rich-text", "trust-strip"]);

    // Hide and show.
    await page.getByRole("button", { name: "Hide Categories" }).click();
    await expect(frame.getByRole("heading", { name: "Shop by category" })).toHaveCount(0);
    await page.getByRole("button", { name: "Show Categories" }).click();
    await expect(frame.getByRole("heading", { name: "Shop by category" })).toBeVisible();
    await saved(page);
  });

  test("a picture is cropped, converted and uploaded, then shown in the preview", async ({ page }) => {
    await page.goto("/design");
    const frame = frameOf(page);
    await expect(frame.getByTestId("preview-root")).toBeVisible();
    await page.getByTestId("add-type").selectOption("banner");
    await page.getByTestId("add-section").click();
    await page.getByTestId("image-file").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: await samplePhoto() });
    await expect(page.getByRole("dialog", { name: "Crop your picture" })).toBeVisible();
    await page.getByLabel("Shape").selectOption("16:9");
    await page.getByLabel("Zoom").fill("1.5");
    await page.getByTestId("crop-use").click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });
    const thumb = page.locator('section[aria-label="Edit Picture banner"] img').first();
    await expect(thumb).toHaveAttribute("src", /^\/media\//);
    const src = (await thumb.getAttribute("src"))!;
    // The stored file is a WebP, wide, and the store serves it.
    const res = await page.request.get(`${ADMIN}${src}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/webp");
    await expect(frame.locator(".b-banner.has-img")).toHaveAttribute("style", new RegExp(src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), { timeout: 3000 });
    await saved(page);
  });

  test("Publish puts the draft on the live store, and going back to an older version undoes it", async ({ page, browser }) => {
    await page.goto("/design");
    await expect(frameOf(page).getByTestId("preview-root")).toBeVisible();
    await page.getByTestId("tab-history").click();
    await page.getByLabel("Name for the next version (optional)").fill("Eid launch");
    await page.getByTestId("publish").click();
    await expect(page.getByTestId("design-notice")).toContainText("version 1");

    const v = await visitor(browser);
    await v.page.goto("/");
    await expect(v.page.getByRole("heading", { level: 1 })).toHaveText("Eid collection is here");
    await expect(v.page.getByRole("heading", { name: "Delivery in Dhaka" })).toBeVisible();
    await expect(v.page.locator(".b-banner.has-img")).toHaveCount(1);
    // The live theme writes its variables on <body> (the stylesheet reads them there), so check what the page uses, and that a button really takes the colour.
    expect(await v.page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--accent").trim().toUpperCase())).toBe("#0B5FFF");
    expect(await v.page.evaluate(() => { const b = document.querySelector<HTMLElement>(".btn-primary"); return b ? getComputedStyle(b).backgroundColor : "no primary button on the page"; })).toBe("rgb(11, 95, 255)");
    await customerQuality(v.page);

    // A second edit, published as version 2.
    await page.goto("/design");
    await row(page, "hero").locator(".pick").click();
    await page.getByLabel("Headline", { exact: true }).fill("Eid sale: free delivery");
    await saved(page);
    await page.getByTestId("tab-history").click();
    await page.getByTestId("publish").click();
    await expect(page.getByTestId("design-notice")).toContainText("version 2");
    await v.page.reload();
    await expect(v.page.getByRole("heading", { level: 1 })).toHaveText("Eid sale: free delivery");

    // Back to version 1: copied forward as version 3, nothing lost.
    await page.getByTestId("tab-history").click();
    await expect(page.getByTestId("version-row")).toHaveCount(2);
    await page.getByRole("button", { name: "Go back to version 1" }).click();
    await expect(page.getByTestId("design-notice")).toContainText("Went back to version 1");
    await v.page.reload();
    await expect(v.page.getByRole("heading", { level: 1 })).toHaveText("Eid collection is here");
    await page.getByTestId("tab-history").click();
    await expect(page.getByTestId("version-row")).toHaveCount(3);
    await expect(page.getByTestId("version-row").first()).toContainText("Live");
    await v.ctx.close();
  });

  test("the preview cannot be opened without the editor's signed link", async ({ browser }) => {
    const v = await visitor(browser);
    expect((await v.page.goto("/preview"))?.status()).toBe(404);
    expect((await v.page.goto("/preview?token=forged.token"))?.status()).toBe(404);
    await v.ctx.close();
  });

  test("a landing page: built, published, and a customer orders from it with cash on delivery", async ({ page, browser }) => {
    const slug = `e2e-landing-${run}`;
    await page.goto("/landing");
    await page.getByLabel("Name", { exact: true }).fill("E2E Eid panjabi");
    await page.getByLabel("Product it sells").selectOption({ index: 1 });
    await page.getByLabel("Web address (optional)").fill(slug);
    await page.getByRole("button", { name: "Create and edit" }).click();
    await expect(page).toHaveURL(/\/landing\/[a-z0-9]+$/);
    await expect(frameOf(page).getByTestId("preview-root")).toBeVisible();
    await expect(frameOf(page).getByRole("heading", { level: 1 })).toBeVisible();

    // Not public before it is published.
    const v = await visitor(browser);
    expect((await v.page.goto(`/l/${slug}`))?.status()).toBe(404);

    await row(page, "lp-hero").locator(".pick").click();
    await page.getByLabel("Headline", { exact: true }).fill("The panjabi that stays cool");
    await expect(frameOf(page).getByRole("heading", { level: 1 })).toHaveText("The panjabi that stays cool", { timeout: 3000 });
    await saved(page);
    await page.getByTestId("publish").click();
    await expect(page.getByTestId("design-notice")).toContainText("version 1");

    await v.page.goto(`/l/${slug}`);
    await expect(v.page.getByRole("heading", { level: 1 })).toHaveText("The panjabi that stays cool");
    await customerQuality(v.page);
    const phone = freshPhone();
    const form = v.page.getByTestId("lp-order-form");
    await form.getByLabel("Your name").fill("Tania Akter");
    await form.getByLabel("Mobile number").fill(phone);
    await form.getByLabel("Division").selectOption("Dhaka");
    await form.getByLabel("District").selectOption("Dhaka");
    await form.getByLabel("Full address").fill("House 14, Road 7, Block C, Section 10, Mirpur");
    if (await form.getByLabel("Option").count()) await form.getByLabel("Option").selectOption({ index: 0 });
    await form.getByRole("button", { name: "Place my order" }).click();
    await expect(v.page).toHaveURL(/\/order\//);
    const orderNumber = (await v.page.getByTestId("order-success").innerText()).match(/BT-\d+/)![0];
    await v.ctx.close();

    const o = await withDb(async (c) => (await c.query(`SELECT channel, "paymentMethod", "utmSource" FROM "Order" WHERE "orderNumber" = $1`, [orderNumber])).rows[0] as { channel: string; paymentMethod: string; utmSource: string });
    expect(o).toMatchObject({ channel: "LANDING_PAGE", paymentMethod: "COD", utmSource: `landing:${slug}` });

    // The owner takes it down, and it stops being public.
    await page.getByTestId("toggle-live").click();
    await expect(page.getByText("The page is no longer live.")).toBeVisible();
    const v2 = await visitor(browser);
    expect((await v2.page.goto(`/l/${slug}`))?.status()).toBe(404);
    await v2.ctx.close();
  });

  test("a custom domain goes from added to Connected by itself, with every step explained", async ({ page, request }) => {
    const host = `e2e-${run}.example.com`;
    const forget = () => withDb((c) => c.query(`UPDATE "Domain" SET "lastCheckedAt" = NULL WHERE domain = $1`, [host]));
    await page.goto("/settings/domains");
    await page.getByLabel("Your domain").fill(host);
    await page.getByRole("button", { name: "Add domain" }).click();
    const card = page.locator(`[data-testid="domain-card"][data-domain="${host}"]`);
    await expect(card.getByTestId("domain-status")).toHaveText("Waiting for your DNS record");
    await expect(card.getByTestId("dns-value")).toHaveText("cname.bt.test");
    await expect(card).toContainText("Add a new CNAME record");

    // A wrong record: we name it.
    setDns({ [host]: { a: ["198.51.100.7"] } });
    await forget();
    await card.getByTestId("check-now").click();
    await expect(card.getByTestId("domain-status")).toHaveText("Wrong record");
    await expect(card.getByTestId("domain-note")).toContainText("198.51.100.7");

    // The right record, but the host is still preparing the certificate.
    await request.post(`${VERCEL}/__hold`);
    setDns({ [host]: { cname: ["cname.bt.test."] } });
    await forget();
    await card.getByTestId("check-now").click();
    await expect(card.getByTestId("domain-status")).toHaveText("Record found, finishing setup");
    await expect(card.getByTestId("domain-note")).toContainText("certificate");

    // The certificate is ready: Connected, with no further action from the owner.
    await request.post(`${VERCEL}/__release`);
    await forget();
    await card.getByTestId("check-now").click();
    await expect(card.getByTestId("domain-status")).toHaveText("Connected");
    await expect(card).toHaveAttribute("data-status", "connected");
    const d = await withDb(async (c) => (await c.query(`SELECT verified, "isPrimary", "dnsStatus", "sslStatus" FROM "Domain" WHERE domain = $1`, [host])).rows[0]);
    expect(d).toMatchObject({ verified: true, isPrimary: true, dnsStatus: "verified", sslStatus: "issued" });
    expect(((await (await request.get(`${VERCEL}/__state`)).json()) as { added: string[] }).added).toContain(host);
  });

  test("the page notices the new record by itself and reaches Connected without any button", async ({ page }) => {
    test.setTimeout(150_000);
    const host = `e2e-auto-${run}.example.com`;
    await page.goto("/settings/domains");
    await page.getByLabel("Your domain").fill(host);
    await page.getByRole("button", { name: "Add domain" }).click();
    const card = page.locator(`[data-testid="domain-card"][data-domain="${host}"]`);
    await expect(card.getByTestId("domain-status")).toHaveText("Waiting for your DNS record");
    // The owner creates the record at their registrar and does nothing else.
    setDns({ [host]: { cname: ["cname.bt.test"] } });
    await expect(card.getByTestId("domain-status")).toHaveText("Connected", { timeout: 90_000 });
  });

  test("the scheduled sweep connects a domain, and the platform sees every domain", async ({ page, request, context }) => {
    const host = `e2e-sweep-${run}.example.com`;
    await page.goto("/settings/domains");
    await page.getByLabel("Your domain").fill(host);
    await page.getByRole("button", { name: "Add domain" }).click();
    await expect(page.locator(`[data-domain="${host}"]`).getByTestId("domain-status")).toHaveText("Waiting for your DNS record");
    setDns({ [host]: { cname: ["cname.bt.test"] } });
    await withDb((c) => c.query(`UPDATE "Domain" SET "lastCheckedAt" = NULL WHERE domain = $1`, [host]));

    expect((await request.post(`${ADMIN}/api/cron/domains`)).status()).toBe(401);
    const res = await request.post(`${ADMIN}/api/cron/domains`, { headers: CRON });
    expect(res.status()).toBe(200);
    expect(((await res.json()) as { checked: number }).checked).toBeGreaterThanOrEqual(1);
    const d = await withDb(async (c) => (await c.query(`SELECT verified, "sslStatus" FROM "Domain" WHERE domain = $1`, [host])).rows[0]);
    expect(d).toMatchObject({ verified: true, sslStatus: "issued" });

    // The platform's own screen lists it as connected.
    await context.addCookies([{ name: "dev_platform_user", value: "owner@biztrackbd.example", url: PLAT }]);
    await page.goto(`${PLAT}/domains?tab=connected`);
    await expect(page.locator(`[data-testid="domain-card"][data-domain="${host}"]`)).toBeVisible();
    await page.goto(`${PLAT}/domains?tab=connecting`);
    await expect(page.locator(`[data-testid="domain-card"][data-domain="${host}"]`)).toHaveCount(0);
  });

  test("a domain the owner removes stops being served", async ({ page }) => {
    const host = `e2e-${run}.example.com`;
    await page.goto("/settings/domains");
    await page.getByRole("button", { name: `Remove ${host}` }).click();
    await expect(page.locator(`[data-domain="${host}"]`)).toHaveCount(0);
  });

  test("a support person cannot change the design or the domains", async ({ page, context }) => {
    await actAs(context, "support");
    expect((await page.goto("/design"))?.url()).toContain("/no-access");
    expect((await page.goto("/settings/domains"))?.url()).toContain("/no-access");
  });
});
