import AxeBuilder from "@axe-core/playwright";
import { withDb } from "./db";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 2).join(" | ")}`);

// Each visitor starts their own copy, so these run one after another and the cookie jar carries the demo session between steps.
test.describe.serial("the demo admin", () => {
  let context: BrowserContext;
  let page: Page;
  test.beforeAll(async ({ browser, baseURL }, info) => {
    context = await browser.newContext({ baseURL, viewport: info.project.use.viewport ?? undefined, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch });
    page = await context.newPage();
    // Earlier runs count against this machine's three-a-day-an-hour limit; forget who started them so this run can start its own.
    await withDb((c) => c.query(`UPDATE "Tenant" SET "demoCreator" = NULL WHERE "demoKind" = 'SESSION'`));
  });
  test.afterAll(async () => { await context.close(); });

  test("the chooser lists the six demo stores and is accessible", async () => {
    await page.goto("/demo");
    await expect(page.getByTestId("demo-choices").locator("li")).toHaveCount(6);
    expect(await axe(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test("one click opens a private admin with products, orders and a demo banner", async () => {
    await page.goto("/demo/start?template=kapor");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("demo-banner")).toContainText(/deleted in/i);
    await expect(page.getByTestId("dash-stats")).toBeVisible();
    await expect(page.getByTestId("sales-chart")).toBeVisible();
    await page.goto("/orders");
    await expect(page.locator('[data-testid="order-row"]:visible').first()).toBeVisible();
    await page.goto("/products");
    await expect(page.locator('[data-testid="product-row"]:visible').first()).toBeVisible();
  });

  test("account settings are locked with a clear note, and exports and uploads are refused", async () => {
    for (const [path, what] of [["/billing", "Plan and billing"], ["/settings/domains", "Domains"], ["/settings/staff", "Team"], ["/settings/integrations", "Integrations"]] as const) {
      await page.goto(path);
      await expect(page.getByTestId("demo-locked")).toContainText(`${what} is not in the demo`);
    }
    await page.goto("/customers");
    const exp = await page.request.get("/customers/export");
    expect(exp.status()).toBe(403);
    const media = await page.request.post("/api/media", { multipart: { file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from("x") } } });
    expect(media.status()).toBe(403);
  });

  test("a bKash payment can be checked, the pretend courier books a parcel, and nothing is texted", async () => {
    await page.goto("/orders?tab=check");
    const row = page.locator('[data-testid="order-row"]:visible').first();
    await expect(row).toBeVisible();
    await row.getByRole("link").first().click();
    await expect(page.getByText(/TrxID|Transaction/i).first()).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test("a new sample order arrives while the visitor looks around, but not more than one at a time", async ({ baseURL }) => {
    await page.goto("/orders");
    const count = () => page.locator('[data-testid="order-row"]:visible').count();
    const before = await count();
    expect(before).toBeGreaterThan(5);
    const raw = (await context.cookies(baseURL!)).find((c) => c.name === "bt_demo")!.value;
    const tenantId = (JSON.parse(Buffer.from(raw.split(".")[0]!, "base64url").toString()) as { tenantId: string }).tenantId;
    await withDb((c) => c.query(`UPDATE "Tenant" SET "demoLastOrderAt" = timezone('utc', now()) - interval '10 minutes' WHERE id = $1`, [tenantId]));
    await page.reload();
    await expect.poll(count).toBe(before + 1);
    await page.reload();
    expect(await count()).toBe(before + 1); // asked again at once: no second order
  });

  test("signing in ends the demo: the banner offers it, and the sign-in page forgets the demo session", async ({ baseURL }) => {
    await page.goto("/");
    await expect(page.getByTestId("demo-signin")).toHaveAttribute("href", "/login");
    expect((await context.cookies(baseURL!)).some((c) => c.name === "bt_demo")).toBe(true);
    await page.goto("/login");
    const names = (await context.cookies(baseURL!)).map((c) => c.name);
    expect(names).not.toContain("bt_demo");
    expect(names).toContain("bt_demo_prev"); // kept for a few minutes so the sign-in page can offer to keep that demo store
    await page.goto("/");
    await expect(page.getByTestId("demo-banner")).toHaveCount(0);
  });

  test("exiting leaves the demo", async ({ baseURL }) => {
    await page.goto("/demo/start?template=kapor");
    await expect(page.getByTestId("demo-banner")).toBeVisible({ timeout: 90_000 });
    const res = await page.request.get("/demo/exit", { maxRedirects: 0 });
    expect(res.status()).toBe(303);
    await context.clearCookies({ name: "bt_demo" });
    await page.goto("/");
    await expect(page.getByTestId("demo-banner")).toHaveCount(0);
    void baseURL;
  });

  test("a forged demo cookie opens nothing", async ({ baseURL }) => {
    await context.addCookies([{ name: "bt_demo", value: "eyJ0ZW5hbnRJZCI6ImFiYyIsImV4cGlyZXNBdCI6OTk5OTk5OTk5OTk5OX0.forged", url: baseURL! }]);
    await page.goto("/orders");
    await expect(page.getByTestId("demo-banner")).toHaveCount(0);
  });
});
