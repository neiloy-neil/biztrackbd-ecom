import { createHmac } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { tenantId, withDb } from "./db";
import { ADMIN, actAs, customerOrders, freshPhone, openOrder, orderIdFromUrl } from "./helpers";

/**
 * Phase 4 acceptance: booking a parcel calls the courier; a statement import marks short-paid parcels; P&L totals equal the
 * sum of its lines. The courier is a local stand-in (e2e/fake-courier.mjs) so nothing real is booked.
 * A real customer orders on the storefront; the owner works it in the admin.
 */
const FAKE = "http://localhost:4010";
const taka = (t: string) => Number(t.replace(/[^\d.-]/g, "").replace(/^-$/, "0")) * (t.includes("−") ? -1 : 1);
let unique = 0;

async function connectSteadfast(page: Page) {
  // Each integration opens in a drawer; ?open= opens it straight away.
  await page.goto("/settings/integrations?mode=LIVE&open=STEADFAST");
  const card = page.getByTestId("drawer-STEADFAST");
  await card.getByLabel("API key").fill("e2e-api-key");
  await card.getByLabel("Secret key").fill("e2e-secret-key");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByText("Saved.")).toBeVisible();
  return card;
}

/** Confirms the order, books it with Steadfast from the order screen, and returns what the owner sees. */
async function confirmAndBook(page: Page, orderNumber: string) {
  await openOrder(page, orderNumber, "new");
  const id = orderIdFromUrl(page.url());
  await page.getByRole("button", { name: "Confirm order" }).filter({ visible: true }).first().click();
  await expect(page.locator(".page-head .pill", { hasText: "To pack" })).toBeVisible();
  const book = page.getByTestId("book-form");
  await expect(book).toBeVisible();
  await book.getByRole("button", { name: "Book courier" }).click();
  await expect(page.locator(".page-head .pill", { hasText: "Shipped" })).toBeVisible();
  const tracking = (await page.getByTestId("tracking").innerText()).trim();
  return { id, tracking, consignment: tracking.replace("TRK", "") };
}

async function webhook(request: APIRequestContext, body: Record<string, unknown>, token?: string) {
  const t = token ?? (await withDb(async (c) => (await c.query(`SELECT "integrationToken" t FROM "TenantIntegration" WHERE provider = 'STEADFAST' AND mode = 'LIVE' AND "tenantId" = $1`, [await tenantId()])).rows[0].t as string));
  return request.post(`${ADMIN}/api/webhooks/courier/${t}`, { data: body });
}

const recon = (page: Page, n: string) => page.getByTestId("recon-row").filter({ hasText: n }).filter({ visible: true });
const delivered = (consignment: string, invoice: string, at = "2026-10-10T10:00:00Z") => ({ notification_type: "delivery_status", consignment_id: Number(consignment), invoice, status: "delivered", updated_at: at });

test.describe.serial("couriers, returns and money", () => {
  let a = { orderNumber: "", id: "", tracking: "", consignment: "", total: 0 };
  let b = { orderNumber: "", id: "", tracking: "", consignment: "", total: 0 };

  test.beforeAll(async ({ request }) => {
    await request.post(`${FAKE}/__reset`);
    await withDb(async (c) => {
      const t = await tenantId();
      await c.query(`DELETE FROM "TenantIntegration" WHERE "tenantId" = $1 AND provider = 'STEADFAST'`, [t]);
      await c.query(`UPDATE "StoreSettings" SET "courierFeeInsideDhaka" = 70, "courierFeeOutsideDhaka" = 130, "courierCodFeePercent" = 1, "defaultCourier" = NULL WHERE "tenantId" = $1`, [t]);
    });
  });
  test.beforeEach(async ({ context }) => actAs(context, "owner"));

  test("the owner adds the Steadfast keys, tests them, and gets the address to paste into Steadfast", async ({ page }) => {
    const card = await connectSteadfast(page);
    await card.getByRole("button", { name: "Test connection" }).click();
    await expect(card.getByText("Connected. The keys work.")).toBeVisible();
    const url = await card.getByLabel("STEADFAST status address").inputValue();
    expect(url).toMatch(/\/api\/webhooks\/courier\/[a-f0-9]{48}$/);
    // The keys themselves are never sent back to the browser.
    await expect(page.locator("body")).not.toContainText("e2e-secret-key");
    expect(await page.locator("input[name=secretKey]").first().inputValue()).toBe("");
  });

  test("a wrong key is refused by the courier and the owner is told", async ({ page }) => {
    await page.goto("/settings/integrations?mode=LIVE&open=STEADFAST");
    const card = page.getByTestId("drawer-STEADFAST");
    await card.getByLabel("API key").fill("wrong-key");
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByText("Saved.")).toBeVisible();
    await card.getByRole("button", { name: "Test connection" }).click();
    await expect(card.getByTestId("courier-tools-STEADFAST").getByRole("alert")).toContainText("did not accept the keys");
    await connectSteadfast(page);
  });

  test("booking a cash on delivery parcel calls the courier, with the cash to collect", async ({ browser, page, request }) => {
    const o = await customerOrders(browser, { slug: "cotton-panjabi-off-white", size: "L", pay: "COD" });
    const booked = await confirmAndBook(page, o.orderNumber);
    a = { orderNumber: o.orderNumber, ...booked, total: 0 };
    await expect(page.getByTestId("courier-status")).toHaveText("Booked, waiting for pickup");
    await expect(page.getByTestId("courier-card")).toContainText("Steadfast");
    await expect(page.getByTestId("timeline")).toContainText("Booked with Steadfast");
    const total = taka(await page.getByTestId("order-total").innerText());
    a.total = total;
    const bookings = (await (await request.get(`${FAKE}/__bookings`)).json()) as { id: number; invoice: string; cod_amount: number; recipient_phone: string }[];
    const mine = bookings.find((x) => String(x.id) === a.consignment)!;
    expect(mine.invoice).toBe(a.orderNumber);
    expect(mine.cod_amount).toBe(total);
    expect(mine.recipient_phone).toMatch(/^01\d{9}$/);
    // Booked once: the book form is gone, and a second click cannot happen.
    await expect(page.getByTestId("book-form")).toHaveCount(0);
  });

  test("the courier says delivered: the order closes, and sending the same message again changes nothing", async ({ page, request }) => {
    const first = await webhook(request, delivered(a.consignment, a.orderNumber));
    expect(first.status()).toBe(200);
    expect(await first.json()).toMatchObject({ ok: true, result: "APPLIED" });
    const again = await webhook(request, delivered(a.consignment, a.orderNumber));
    expect(await again.json()).toMatchObject({ duplicate: true });
    await page.goto(`/orders/${a.id}`);
    await expect(page.locator(".page-head .pill", { hasText: "Delivered" })).toBeVisible();
    await expect(page.locator(".page-head .pill", { hasText: "Paid" })).toBeVisible(); // the courier collected the cash
    await expect(page.getByTestId("timeline")).toContainText("Steadfast");
    await expect(page.getByTestId("start-return")).toBeVisible();
  });

  test("a bad or unknown callback is refused without changing anything", async ({ request }) => {
    expect((await webhook(request, delivered("1", "x"), "0".repeat(48))).status()).toBe(404);
    const unknown = await webhook(request, delivered("99999999", "BT-NOPE", new Date().toISOString()));
    expect(unknown.status()).toBe(200);
    expect(await unknown.json()).toMatchObject({ result: "UNKNOWN_ORDER" });
  });

  test("the status check finds a delivery the courier never sent a message for", async ({ browser, page, request }) => {
    const o = await customerOrders(browser, { slug: "linen-shirt-sage", size: "M", pay: "COD" });
    b = { orderNumber: o.orderNumber, ...(await confirmAndBook(page, o.orderNumber)), total: 0 };
    b.total = taka(await page.getByTestId("order-total").innerText());
    await request.post(`${FAKE}/__set`, { data: { id: b.consignment, status: "delivered" } });
    await page.getByRole("button", { name: "Check status now" }).click();
    await expect(page.locator(".page-head .pill", { hasText: "Delivered" })).toBeVisible();
  });

  test("COD payouts: couriers owe cash for delivered parcels", async ({ page }) => {
    await page.goto("/finance/cod?filter=unpaid");
    await expect(page.getByTestId("owed-total")).not.toHaveText("৳ 0");
    await expect(recon(page, a.orderNumber)).toContainText("Not paid yet");
    await expect(recon(page, b.orderNumber)).toContainText("Not paid yet");
  });

  test("a statement import matches the right payout and flags the short one", async ({ page }) => {
    const net = (t: number) => (t - 70 - t * 0.01).toFixed(2);
    const csv = [
      "Consignment ID,Invoice,COD Amount,Delivery Charge,COD Charge,Payable,Status",
      `${a.consignment},${a.orderNumber},${a.total},70,${(a.total * 0.01).toFixed(2)},${net(a.total)},Delivered`,
      `${b.consignment},${b.orderNumber},${b.total},70,${(b.total * 0.01).toFixed(2)},${(Number(net(b.total)) - 30).toFixed(2)},Delivered`,
      `55555,BT-NOT-MINE,500,70,5,425,Delivered`,
    ].join("\n");
    await page.goto("/finance/cod");
    const form = page.getByTestId("import-form");
    await form.getByLabel("Payout invoice number").fill(`E2E-${Date.now()}-${++unique}`);
    await form.locator("input[type=file]").setInputFiles({ name: "steadfast-payout.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await form.getByRole("button", { name: "Import and match" }).click();
    const result = page.getByTestId("import-result");
    await expect(result).toContainText("2 parcels, 1 matched, 1 paid short");
    await expect(result).toContainText("1 rows did not match");
    await expect(page.getByTestId("mismatch")).not.toHaveText("0");

    const short = recon(page, b.orderNumber);
    await expect(short).toContainText("Paid short");
    await expect(short).toContainText("short");
    await expect(recon(page, a.orderNumber)).toHaveCount(0); // matched ones leave "needs checking"
    await page.goto("/finance/cod?filter=matched");
    await expect(recon(page, a.orderNumber)).toContainText("Matched");

    // The owner accepts the short payment.
    await page.goto("/finance/cod");
    await recon(page, b.orderNumber).getByText("Resolve").click();
    await page.getByRole("button", { name: "Mark matched. I accept this" }).click();
    await expect(page.getByText("Marked as matched.")).toBeVisible();
    await expect(recon(page, b.orderNumber)).toHaveCount(0);
    await expect(page.getByTestId("payouts-table")).toContainText("Steadfast");
  });

  test("a parcel that is already settled is not counted again by a later statement", async ({ page }) => {
    const csv = ["Consignment ID,COD Amount,Payable", `${a.consignment},${a.total},${a.total}`].join("\n");
    await page.goto("/finance/cod");
    const form = page.getByTestId("import-form");
    await form.getByLabel("Payout invoice number").fill(`E2E-DUP-${Date.now()}`);
    await form.locator("input[type=file]").setInputFiles({ name: "p.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await form.getByRole("button", { name: "Import and match" }).click();
    await expect(page.getByTestId("cod-error")).toContainText("None of the parcels");
  });

  test("profit and loss: the totals equal the sum of the lines", async ({ page }) => {
    await page.goto("/finance/profit?range=month");
    const sales = taka(await page.getByTestId("profit-sales").innerText());
    const costs = taka(await page.getByTestId("profit-costs").innerText());
    const net = taka(await page.getByTestId("profit-net").innerText());
    expect(sales).toBeGreaterThanOrEqual(a.total + b.total);
    expect(Math.round((sales - costs) * 100)).toBe(Math.round(net * 100));
    const lines = await page.locator('[data-testid="profit-lines"] tr[data-line] td.num').allInnerTexts();
    const sum = lines.reduce((n, t) => n + taka(t), 0);
    expect(Math.round(sum * 100)).toBe(Math.round(costs * 100));

    // Adding a cost lowers profit by exactly that much.
    const form = page.getByTestId("expense-form");
    await form.getByLabel("Amount (৳)").fill("500");
    await form.getByLabel("What for").selectOption("ADS");
    await form.getByRole("button", { name: "Add cost" }).click();
    await expect(page.getByText("Expense added.")).toBeVisible();
    const net2 = taka(await page.getByTestId("profit-net").innerText());
    expect(Math.round((net - net2) * 100)).toBe(50000);
    await expect(page.getByTestId("expenses-table")).toContainText("Ads");
    await page.getByRole("button", { name: "Delete Ads expense" }).first().click();
    await expect(page.getByText("Expense deleted.")).toBeVisible();
    expect(taka(await page.getByTestId("profit-net").innerText())).toBe(net);
  });

  test("a return runs from a delivered order to a refund", async ({ page }) => {
    await page.goto(`/orders/${a.id}`);
    await page.getByTestId("start-return").click();
    await expect(page.getByTestId("new-return-form")).toBeVisible();
    await page.locator('input[name^="qty_"]').first().fill("1");
    await page.getByRole("button", { name: "Open return" }).click();
    await expect(page).toHaveURL(/\/returns\?tab=requested/);
    const card = page.getByTestId("return-card").filter({ hasText: a.orderNumber });
    await expect(card).toContainText("Waiting for you");
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Return approved.")).toBeVisible();
    await page.goto("/returns?tab=approved");
    await page.getByTestId("return-card").filter({ hasText: a.orderNumber }).getByRole("button", { name: "Parcel received" }).click();
    await expect(page.getByText("Parcel received.")).toBeVisible();
    await page.goto("/returns?tab=coming_back");
    const refund = page.getByTestId("return-card").filter({ hasText: a.orderNumber });
    await expect(refund).toContainText("Parcel received");
    await refund.getByLabel("Your TrxID").fill("RF9A8B7C6D");
    await refund.getByRole("button", { name: "I sent the money. Mark refunded" }).click();
    await expect(page.getByText("Refund recorded.")).toBeVisible();
    await page.goto("/returns?tab=done");
    await expect(page.getByTestId("return-card").filter({ hasText: a.orderNumber })).toContainText("Refunded");
    await page.goto(`/orders/${a.id}`);
    await expect(page.getByTestId("timeline")).toContainText("refunded");
    // The refund is a cost on the profit screen.
    await page.goto("/finance/profit?range=month");
    await expect(page.locator('tr[data-line="refunds"]')).not.toContainText("৳ 0");
  });

  test("a risky number's cash order is held until the owner has called, and cannot be booked meanwhile", async ({ browser, page }) => {
    // Other stores have already had three parcels refused by this number.
    const phone = freshPhone();
    const salt = process.env.PHONE_TRUST_SALT || process.env.CUSTOMER_AUTH_SECRET!;
    const hash = createHmac("sha256", salt).update(`phone:${phone}`).digest("hex");
    await withDb(async (c) => {
      for (let i = 0; i < 3; i++) {
        await c.query(`SELECT phone_trust_record($1, $2, $3, 'REFUSED', now() - interval '5 days')`, [hash, `${"e".repeat(63)}${i}`, `${"f".repeat(63)}${i}`]);
      }
    });
    const o = await customerOrders(browser, { slug: "cotton-panjabi-off-white", size: "XL", pay: "COD", phone });
    await page.goto("/fraud");
    const row = page.getByTestId("flagged-row").filter({ hasText: o.orderNumber });
    await expect(row).toContainText("High risk");
    await expect(row).toContainText("Low delivery success");
    await row.getByRole("link", { name: o.orderNumber }).click();
    await expect(page.getByTestId("risk-card")).toContainText("3 came back");
    await expect(page.getByTestId("release-hold")).toBeVisible();
    await page.getByRole("button", { name: "Confirm order" }).filter({ visible: true }).first().click();
    await expect(page.getByTestId("book-form").getByRole("button", { name: "Book courier" })).toBeDisabled();
    await page.getByTestId("release-hold").getByRole("button", { name: /Release the hold/ }).click();
    await expect(page.getByTestId("release-hold")).toHaveCount(0);
    await page.getByTestId("book-form").getByRole("button", { name: "Book courier" }).click();
    await expect(page.locator(".page-head .pill", { hasText: "Shipped" })).toBeVisible();
  });

  test("a number can be checked before taking its order, and blocked or unblocked", async ({ page }) => {
    await page.goto("/fraud?tab=check");
    await page.getByLabel("Customer's mobile number").fill("01799990001");
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByTestId("lookup-result")).toContainText("First-time buyer");
    await page.getByLabel("Customer's mobile number").fill("12345");
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByRole("alert")).toContainText("valid Bangladeshi");

    await page.goto("/fraud?tab=blocked");
    const form = page.getByTestId("block-form");
    await form.getByLabel("Mobile number").fill("01799990002");
    await form.getByLabel("Reason").fill("Refused three parcels");
    await form.getByRole("button", { name: "Block number" }).click();
    await expect(page.getByText("Number blocked.")).toBeVisible();
    const row = page.getByTestId("blocked-table").locator("tr", { hasText: "01799-990002" });
    await expect(row).toContainText("Refused three parcels");
    await row.getByRole("button", { name: "Unblock" }).click();
    await expect(page.getByText("Number unblocked.")).toBeVisible();
    await expect(page.getByTestId("blocked-table")).toHaveCount(0);
  });

  test("a parcel that came back is recorded as refused, and the buyer's record shows it", async ({ browser, page }) => {
    const o = await customerOrders(browser, { slug: "cotton-socks-3-pack", size: "Free size", pay: "COD" });
    await openOrder(page, o.orderNumber, "new");
    const id = orderIdFromUrl(page.url());
    await page.getByRole("button", { name: "Confirm order" }).filter({ visible: true }).first().click();
    await page.getByText("Deliver it yourself, or book outside this app").click();
    await page.getByRole("button", { name: "Hand over and mark shipped" }).click();
    await expect(page.locator(".page-head .pill", { hasText: "Shipped" })).toBeVisible();
    await page.getByText("The parcel came back").click();
    await page.getByLabel("The customer refused it at the door").check();
    await page.getByRole("button", { name: /Mark returned/ }).click();
    await expect(page.locator(".page-head .pill", { hasText: "Returned" })).toBeVisible();
    await expect(page.getByTestId("timeline")).toContainText("refused at the door");
    await page.goto(`/orders/${id}`);
    await expect(page.getByTestId("risk-network")).toContainText("1 came back (1 refused");
  });
});
