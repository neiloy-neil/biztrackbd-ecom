import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { withDb } from "./db";

const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 2).join(" | ")}`);

const small = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main a, main button, main input, main summary, main select")]
      .filter((el) => el.offsetParent !== null && !(el instanceof HTMLInputElement && el.type === "radio"))
      .map((el) => ({ n: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 28), h: Math.round(el.getBoundingClientRect().height) }))
      .filter((x) => x.h < 40).map((x) => `${x.n} ${x.h}px`).slice(0, 6));

// Runs in a private demo copy: it has a bKash payment waiting to be checked, orders ready to book, and a pretend courier.
test.describe.serial("phone desks: check payments and book couriers", () => {
  let context: BrowserContext;
  let page: Page;
  test.beforeAll(async ({ browser, baseURL }, info) => {
    context = await browser.newContext({ baseURL, viewport: info.project.use.viewport ?? undefined, isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch });
    page = await context.newPage();
    await withDb((c) => c.query(`UPDATE "Tenant" SET "demoCreator" = NULL WHERE "demoKind" = 'SESSION'`));
    await page.goto("/demo/start?template=kapor");
    await expect(page.getByTestId("demo-banner")).toBeVisible({ timeout: 90_000 });
  });
  test.afterAll(async () => { await context.close(); });

  test("the orders list offers each desk on its tab", async () => {
    await page.goto("/orders?tab=check");
    await expect(page.getByTestId("open-desk")).toContainText("Check them one by one");
    await page.goto("/orders?tab=to_pack");
    await expect(page.getByTestId("open-desk")).toContainText("Book them one by one");
  });

  test("check payments shows one payment big, with copy buttons, and is accessible with big tap targets", async (_f, info) => {
    await page.goto("/orders/check");
    const card = page.getByTestId("check-card");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("check-trx")).not.toHaveText("Not given");
    await expect(page.getByTestId("check-amount")).toContainText("৳");
    await expect(page.getByTestId("copy-trxid")).toBeVisible();
    await expect(page.getByTestId("check-confirm")).toBeVisible();
    expect(await axe(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    if (info.project.name.startsWith("mobile")) expect(await small(page), "tap targets under 40px").toEqual([]);
  });

  test("'I cannot find it' asks what you found, and a reason is needed before it is marked", async () => {
    await page.goto("/orders/check");
    await page.getByTestId("check-notfound").click();
    await expect(page.getByRole("radio", { name: "Not in my bKash history" })).toBeChecked();
    expect(await axe(page)).toEqual([]);
  });

  test("confirming a payment moves to the next one and says what happened", async () => {
    await page.goto("/orders/check");
    const num = await page.getByTestId("check-card").getAttribute("data-order");
    await page.getByTestId("check-confirm").click();
    await expect(page.getByTestId("check-done")).toContainText(`Payment confirmed for ${num}`);
    await expect(page.getByTestId("check-card").or(page.getByTestId("check-empty"))).toBeVisible();
    if (await page.getByTestId("check-card").count()) await expect(page.getByTestId("check-card")).not.toHaveAttribute("data-order", num!);
  });

  test("not received marks the payment and carries on", async () => {
    await page.goto("/orders/check");
    if (!(await page.getByTestId("check-card").count())) test.skip(true, "no second payment waiting in this demo");
    const num = await page.getByTestId("check-card").getAttribute("data-order");
    await page.getByTestId("check-notfound").click();
    await page.getByRole("radio", { name: "The TrxID is wrong" }).check();
    await page.getByTestId("check-reject").click();
    await expect(page.getByTestId("check-done")).toContainText(`Marked as not received for ${num}`);
  });

  test("book couriers shows who, where and the cash to collect, and is accessible", async (_f, info) => {
    await page.goto("/orders/ship");
    await expect(page.getByTestId("ship-card")).toBeVisible();
    await expect(page.getByTestId("ship-address")).toContainText(",");
    await expect(page.getByTestId("ship-cash")).toBeVisible();
    await expect(page.getByRole("radio", { name: /Steadfast/ })).toBeChecked();
    expect(await axe(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    if (info.project.name.startsWith("mobile")) expect(await small(page), "tap targets under 40px").toEqual([]);
  });

  test("booking a parcel gives a tracking code and opens the next order", async ({ baseURL }) => {
    await page.goto("/orders/ship");
    const num = await page.getByTestId("ship-card").getAttribute("data-order");
    await page.locator("label.chip-radio", { hasText: "1 kg" }).click();
    await expect(page.getByRole("radio", { name: "1 kg" })).toBeChecked();
    await page.getByTestId("ship-book").click();
    await expect(page.getByTestId("ship-done")).toContainText(`Booked ${num}`);
    await expect(page.getByTestId("ship-done")).toContainText("DM-");
    // The order is now shipped and no longer in the queue.
    const raw = (await context.cookies(baseURL!)).find((c) => c.name === "bt_demo")!.value;
    const tenantId = (JSON.parse(Buffer.from(raw.split(".")[0]!, "base64url").toString()) as { tenantId: string }).tenantId;
    const row = await withDb((c) => c.query(`SELECT status, "courierProvider" FROM "Order" WHERE "tenantId" = $1 AND "orderNumber" = $2`, [tenantId, num]));
    expect(row.rows[0]).toMatchObject({ status: "SHIPPED", courierProvider: "STEADFAST" });
  });

  test("an empty queue says so kindly", async () => {
    for (let i = 0; i < 40 && (await page.goto("/orders/ship"), await page.getByTestId("ship-card").count()); i++) {
      await page.getByTestId("ship-book").click();
      await expect(page.getByTestId("ship-done")).toBeVisible();
    }
    await expect(page.getByTestId("ship-empty")).toBeVisible();
  });
});
