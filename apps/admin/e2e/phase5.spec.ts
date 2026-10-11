import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { withDb } from "./db";
import { ADMIN } from "./helpers";

/**
 * Phase 5 acceptance: a stranger signs up, submits a bKash proof, the platform approves it, and their store goes from trial to Pro.
 * Also: the unpaid lifecycle (grace, read-only, locked) and the way back, platform suspension, and the brand-review flag.
 * Four apps run together: the marketing site (3002), the store admin (3001), the storefront (3000) and the super admin (3003).
 */
const MKT = "http://localhost:3002";
const PLAT = "http://localhost:3003";
const CRON = { Authorization: "Bearer e2e-cron-secret-0123456789" };
const stamp = Date.now().toString(36);
const storeUrl = (sub: string) => `http://${sub}.localhost:3000`;
let n = 0;
const unique = (p: string) => `${p}${stamp}${++n}`;
const trx = () => `E5${Date.now().toString(36).toUpperCase()}${++n}`.slice(0, 11).padEnd(9, "Q");

async function actOnAdmin(context: BrowserContext, sub: string) {
  await context.addCookies([{ name: "dev_tenant", value: sub, url: ADMIN }]);
}
async function actOnPlatform(context: BrowserContext, who: "owner" | "finance" | "lead" | "support") {
  await context.addCookies([{ name: "dev_platform_user", value: `${who}@biztrackbd.example`, url: PLAT }]);
}

/** Fills the wizard from the first step to the last and presses Create. Returns the address and owner it used. */
async function signUp(page: Page, o: { storeName: string; sub?: string; plan?: "STARTER" | "PRO" | "BUSINESS" }) {
  const sub = o.sub ?? unique("e2e");
  const email = `${sub}@example.test`;
  await page.goto(`${MKT}/start`);
  await expect(page.getByTestId("wizard")).toBeVisible();
  await page.getByTestId("f-ownerName").fill("Nusrat Jahan");
  await page.getByTestId("f-email").fill(email);
  await page.getByTestId("f-phone").fill(`01${3 + (n % 7)}${String(Date.now() % 100_000_000).padStart(8, "0")}`);
  await page.getByTestId("next").click();
  await page.getByTestId("f-storeName").fill(o.storeName);
  await page.getByTestId("next").click();
  await page.getByTestId("f-subdomain").fill(sub);
  await expect(page.getByTestId("address-status")).toContainText("is available");
  await page.getByTestId("next").click();
  if (o.plan) await page.getByTestId(`pick-${o.plan}`).click();
  await page.getByTestId("next").click();
  await expect(page.getByTestId("step-create")).toContainText(o.storeName);
  await page.getByTestId("create").click();
  await expect(page.getByTestId("done")).toBeVisible({ timeout: 30_000 });
  return { sub, email };
}

/** Sets how long ago the store's paid time (or trial) ran out, then runs the daily sweep. */
async function lapse(request: Parameters<Parameters<typeof test>[2]>[0]["request"], sub: string, days: number) {
  await withDb(async (c) => {
    const d = `timezone('utc', now()) - interval '${days} days'`;
    await c.query(`UPDATE "Tenant" SET "trialEndsAt" = ${d} WHERE subdomain = $1`, [sub]);
    await c.query(`UPDATE "Subscription" SET "currentPeriodEnd" = ${d} WHERE "tenantId" = (SELECT id FROM "Tenant" WHERE subdomain = $1)`, [sub]);
  });
  const r = await request.post(`${PLAT}/api/cron/billing`, { headers: CRON });
  expect(r.status()).toBe(200);
}

async function pay(page: Page, plan: "STARTER" | "PRO" | "BUSINESS", amountText: string) {
  await page.goto(`${ADMIN}/billing`);
  await page.getByTestId(`plan-${plan}`).click();
  await expect(page.getByTestId("pay-instructions")).toContainText(amountText);
  await expect(page.getByTestId("pay-instructions")).toContainText("01800000000");
  await page.getByLabel("The number you sent from").fill("01712345678");
  // Enter submits the form: a click can land under the phone's bottom tab bar while the page is still settling.
  await page.getByLabel("Transaction ID (TrxID)").fill(trx());
  await page.getByLabel("Transaction ID (TrxID)").press("Enter");
  await expect(page.getByTestId("proof-sent")).toBeVisible();
  await expect(page.getByTestId("pending-proof")).toBeVisible();
}

async function approveFirst(page: Page, sub: string) {
  await page.goto(`${PLAT}/payments`);
  const card = page.getByTestId("payment-card").filter({ hasText: sub });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: /Approve and switch the plan on/ }).click();
  await expect(page.getByText("Approved. The plan is live.")).toBeVisible();
}

async function waitForStore(page: Page, sub: string, status: number) {
  await expect.poll(async () => (await page.goto(storeUrl(sub)))?.status(), { timeout: 40_000, intervals: [1000, 2000] }).toBe(status);
}

test.describe.serial("signup, billing and the super admin", () => {
  let sub = "";
  let email = "";
  const storeName = `E2E Threads ${stamp}`;

  test("a stranger opens a store from the marketing site, step by step, with live checks", async ({ page }) => {
    await page.goto(MKT);
    await page.getByTestId("hero-cta").click();
    await expect(page).toHaveURL(/\/start/);
    // Each step refuses what it cannot accept, in plain words.
    await page.getByTestId("next").click();
    await expect(page.getByTestId("step-problem")).toContainText("Enter your name");
    await page.getByTestId("f-ownerName").fill("Nusrat Jahan");
    await page.getByTestId("f-email").fill("not-an-email");
    await page.getByTestId("next").click();
    await expect(page.getByTestId("step-problem")).toContainText("valid email");
    await page.getByTestId("f-email").fill(`probe${stamp}@example.test`);
    await page.getByTestId("f-phone").fill("12345");
    await page.getByTestId("next").click();
    await expect(page.getByTestId("step-problem")).toContainText("valid mobile number");
    await page.getByTestId("f-phone").fill("01712345678");
    await page.getByTestId("next").click();
    await page.getByTestId("f-storeName").fill(storeName);
    await page.getByTestId("next").click();
    // The address is suggested from the name. A taken one and a reserved one are refused as you type.
    await expect(page.getByTestId("f-subdomain")).toHaveValue(/^e2e-threads-/);
    await page.getByTestId("f-subdomain").fill("rongdhonu");
    await expect(page.getByTestId("address-status")).toContainText("already taken");
    await page.getByTestId("next").click();
    await expect(page.getByTestId("step-problem")).toContainText("already taken");
    await page.getByTestId("f-subdomain").fill("admin");
    await expect(page.getByTestId("address-status")).toContainText("kept for BizTrackBD");
    // Back keeps what was typed.
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByTestId("f-storeName")).toHaveValue(storeName);
  });

  test("it creates the store and shows where it lives", async ({ page }) => {
    const r = await signUp(page, { storeName, plan: "STARTER" });
    sub = r.sub;
    email = r.email;
    await expect(page.getByTestId("store-url")).toContainText(`${sub}.localhost:3000`);
    await expect(page.getByTestId("open-store")).toHaveAttribute("href", storeUrl(sub));
    await expect(page.getByTestId("done")).toContainText("free trial runs until");
  });

  test("the new store is already live with sample products", async ({ page }) => {
    const res = await page.goto(storeUrl(sub));
    expect(res?.status()).toBe(200);
    // A new store opens in Bangla, so the sample shows its Bangla title; either language proves the template's samples are there.
    await expect(page.getByText(/Cotton Panjabi, Off-white|সুতির পাঞ্জাবি, অফ-হোয়াইট/).first()).toBeVisible();
  });

  test("the owner sees a 14-day trial and no warning", async ({ context, page }) => {
    await actOnAdmin(context, sub);
    await page.goto(`${ADMIN}/billing`);
    await expect(page.getByTestId("plan-status-text")).toContainText("Free trial, 14 days left");
    await expect(page.getByTestId("access-state")).toHaveText("Free trial");
    await expect(page.getByTestId("billing-banner")).toHaveCount(0);
    await expect(page.getByTestId("plan-status")).toContainText("Starter plan");
    // The sample products are there to look at.
    await page.goto(`${ADMIN}/products`);
    await expect(page.getByText("Linen Shirt, Sage").filter({ visible: true }).first()).toBeVisible();
  });

  test("the owner sends a bKash payment for Pro: the TrxID must look right, and the price is the plan's", async ({ context, page }) => {
    await actOnAdmin(context, sub);
    await page.goto(`${ADMIN}/billing`);
    await page.getByTestId("plan-PRO").click();
    await page.getByLabel("The number you sent from").fill("01712345678");
    await page.getByLabel("Transaction ID (TrxID)").fill("abc-1234");
    await page.getByRole("button", { name: /Check my payment/ }).click();
    await expect(page.getByTestId("pay-error")).toContainText("does not look right");
    await pay(page, "PRO", "৳ 1,499");
    await expect(page.getByTestId("proofs-table")).toContainText("Waiting to be checked");
  });

  test("finance checks the payment and approves it; the store goes from trial to Pro", async ({ context, page }) => {
    await actOnPlatform(context, "finance");
    await page.goto(`${PLAT}/payments`);
    const card = page.getByTestId("payment-card").filter({ hasText: sub });
    await expect(card).toContainText("Pro · 1 month");
    await expect(card.getByTestId("amount")).toHaveText("৳ 1,499");
    await expect(card.getByTestId("trx")).toHaveText(/^E5/);
    await card.getByRole("button", { name: /Approve and switch the plan on/ }).click();
    await expect(page.getByText("Approved. The plan is live.")).toBeVisible();
    await expect(page.getByTestId("payment-card").filter({ hasText: sub })).toHaveCount(0);

    await page.goto(`${PLAT}/tenants?q=${sub}`);
    const row = page.getByTestId("tenant-row").filter({ hasText: storeName });
    await expect(row).toContainText("Pro");
    await expect(row).toContainText("Active");
    await page.goto(`${PLAT}/`);
    await expect(page.getByTestId("mrr")).not.toHaveText("৳ 0");
    await expect(page.getByTestId("paying")).not.toHaveText("0");
  });

  test("the owner now sees an active Pro plan with the payment approved", async ({ context, page }) => {
    await actOnAdmin(context, sub);
    await page.goto(`${ADMIN}/billing`);
    await expect(page.getByTestId("plan-status")).toContainText("Pro plan");
    await expect(page.getByTestId("access-state")).toHaveText("Active");
    await expect(page.getByTestId("plan-status-text")).toContainText("Active until");
    await expect(page.getByTestId("proofs-table")).toContainText("Approved");
    await expect(page.getByTestId("proofs-table")).toContainText("Paid until");
  });

  test("support staff can look at stores but cannot approve payments or edit plans", async ({ context, page }) => {
    await actOnPlatform(context, "support");
    await page.goto(`${PLAT}/payments`);
    await expect(page).toHaveURL(/\/no-access/);
    await page.goto(`${PLAT}/plans`);
    await expect(page).toHaveURL(/\/no-access/);
    await page.goto(`${PLAT}/tenants?q=${sub}`);
    await page.getByTestId("tenant-row").filter({ hasText: storeName }).getByRole("link").first().click();
    await expect(page.getByTestId("tenant-title")).toHaveText(storeName);
    await expect(page.getByRole("button", { name: "Suspend store" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Change plan" })).toHaveCount(0);
    await expect(page.getByTestId("usage-card")).toContainText("Products");
  });

  test("when the plan runs out: grace, then read-only and offline, then locked, and paying brings it all back", async ({ context, page, request }) => {
    await actOnAdmin(context, sub);
    // Day 2 overdue: everything still works, a banner asks for payment.
    await lapse(request, sub, 1.5);
    await page.goto(`${ADMIN}/`);
    await expect(page.getByTestId("billing-banner")).toContainText("plan has run out");
    await page.goto(`${ADMIN}/settings/store`);
    await expect(page.locator("main form button[type=submit]").first()).toBeEnabled();
    expect((await page.goto(storeUrl(sub)))?.status()).toBe(200);

    // Day 5: the storefront goes offline and every admin form is switched off, except paying.
    await lapse(request, sub, 5);
    await page.goto(`${ADMIN}/`);
    await expect(page.getByTestId("billing-banner")).toContainText("read-only");
    await page.goto(`${ADMIN}/settings/store`);
    await expect(page.getByTestId("read-only-guard")).toBeVisible();
    await expect(page.locator("main form button[type=submit]").first()).toBeDisabled();
    await page.goto(`${ADMIN}/orders`); // looking still works
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
    await waitForStore(page, sub, 503);

    // Day 20: locked. Only the billing screen opens.
    await lapse(request, sub, 20);
    await page.goto(`${ADMIN}/orders`);
    await expect(page).toHaveURL(/\/locked/);
    await expect(page.getByTestId("locked")).toContainText("locked");
    await page.getByRole("link", { name: "See plans and pay" }).click();
    await expect(page).toHaveURL(/\/billing/);
    await expect(page.getByTestId("access-state")).toHaveText("Locked");

    // Paying works from here, and one approval brings the store back.
    await pay(page, "PRO", "৳ 1,499");
    await actOnPlatform(context, "finance");
    await approveFirst(page, sub);
    await page.goto(`${ADMIN}/orders`);
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
    await page.goto(`${ADMIN}/billing`);
    await expect(page.getByTestId("access-state")).toHaveText("Active");
    await waitForStore(page, sub, 200);
  });

  test("the platform can switch a store off, with a reason the owner sees, and back on", async ({ context, page }) => {
    await actOnPlatform(context, "lead");
    await page.goto(`${PLAT}/tenants?q=${sub}`);
    await page.getByTestId("tenant-row").filter({ hasText: storeName }).getByRole("link").first().click();
    await page.getByLabel("Reason").fill("Customers report fake products");
    await page.getByRole("button", { name: "Suspend store" }).click();
    await expect(page.getByText("Store switched off.")).toBeVisible();
    await expect(page.getByTestId("suspended-note")).toContainText("fake products");

    await actOnAdmin(context, sub);
    await page.goto(`${ADMIN}/orders`);
    await expect(page.getByTestId("locked")).toContainText("switched off");
    await page.goto(`${PLAT}/tenants?q=${sub}`);
    await page.getByTestId("tenant-row").filter({ hasText: storeName }).getByRole("link").first().click();
    await page.getByRole("button", { name: "Switch back on" }).click();
    await expect(page.getByText("Store switched back on.")).toBeVisible();
    await page.goto(`${ADMIN}/orders`);
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  });

  test("a store named after a well-known brand is flagged for a person to look at", async ({ context, page }) => {
    const flagged = await signUp(page, { storeName: `Daraz Mirpur Outlet ${stamp}` });
    await expect(page.getByTestId("done")).toContainText("a person will check it");
    await actOnPlatform(context, "lead");
    await page.goto(`${PLAT}/tenants?filter=flagged`);
    const row = page.getByTestId("tenant-row").filter({ hasText: flagged.sub });
    await expect(row).toContainText("Flagged");
    await row.getByRole("link").first().click();
    await page.getByLabel("Review note").fill("Has permission, letter seen");
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByText("Flagged store approved.")).toBeVisible();
    await page.goto(`${PLAT}/tenants?filter=flagged`);
    await expect(page.getByTestId("tenant-row").filter({ hasText: flagged.sub })).toHaveCount(0);
  });

  test("the daily sweep refuses anyone without the secret", async ({ request }) => {
    expect((await request.post(`${PLAT}/api/cron/billing`)).status()).toBe(401);
    expect((await request.post(`${PLAT}/api/cron/billing`, { headers: { Authorization: "Bearer wrong-wrong-wrong-wrong" } })).status()).toBe(401);
  });

  test("the plans page edits a price, and the new price shows on the marketing site", async ({ context, page }) => {
    await actOnPlatform(context, "owner");
    await page.goto(`${PLAT}/plans`);
    const form = page.getByTestId("plan-STARTER");
    await form.getByLabel("Monthly price (৳)").fill("749");
    await form.getByRole("button", { name: "Save Starter" }).click();
    await expect(page.getByText("STARTER saved.")).toBeVisible();
    await page.goto(`${MKT}/pricing`);
    await expect(page.getByTestId("plan-STARTER")).toContainText("৳ 749");
    await page.goto(`${PLAT}/plans`);
    await page.getByTestId("plan-STARTER").getByLabel("Monthly price (৳)").fill("699");
    await page.getByTestId("plan-STARTER").getByRole("button", { name: "Save Starter" }).click();
    await expect(page.getByText("STARTER saved.")).toBeVisible();
    await page.goto(`${PLAT}/audit?action=PLAN_EDITED`);
    await expect(page.getByTestId("audit-table")).toContainText("PLAN_EDITED");
  });
});

test.describe("pricing and templates pages", () => {
  test("pricing shows every public plan from the Plan table", async ({ page }) => {
    await page.goto(`${MKT}/pricing`);
    for (const [tier, price] of [["STARTER", "৳ 699"], ["PRO", "৳ 1,499"], ["BUSINESS", "৳ 3,499"]]) await expect(page.getByTestId(`plan-${tier}`)).toContainText(price!);
    await expect(page.getByTestId("plan-PRO")).toContainText("Book Steadfast, Pathao and RedX");
    await expect(page.getByTestId("plan-STARTER")).not.toContainText("Your own domain");
    await page.getByTestId("plan-PRO").getByRole("link", { name: /Start free with Pro/ }).click();
    await expect(page).toHaveURL(/plan=PRO/);
  });

  test("templates shows every storefront template as ready", async ({ page }) => {
    await page.goto(`${MKT}/templates`);
    for (const id of ["kapor", "gadgetstudio", "mini-bunny", "axionwear", "bindu", "berber"]) {
      await expect(page.getByTestId(`theme-${id}`)).toContainText("Ready");
      await expect(page.getByTestId(`theme-${id}`).getByRole("link", { name: "Use this template" })).toHaveCount(1);
    }
  });
});

const SCREENS: { name: string; url: string; as?: "owner" }[] = [
  { name: "marketing home", url: `${MKT}/` },
  { name: "pricing", url: `${MKT}/pricing` },
  { name: "templates", url: `${MKT}/templates` },
  { name: "signup", url: `${MKT}/start` },
  { name: "signup done", url: `${MKT}/start/done?store=example-shop&name=Example&ends=2026-12-01T00:00:00Z` },
  { name: "super admin overview", url: `${PLAT}/`, as: "owner" },
  { name: "super admin stores", url: `${PLAT}/tenants`, as: "owner" },
  { name: "super admin payments", url: `${PLAT}/payments`, as: "owner" },
  { name: "super admin plans", url: `${PLAT}/plans`, as: "owner" },
  { name: "super admin audit", url: `${PLAT}/audit`, as: "owner" },
  { name: "admin billing", url: `${ADMIN}/billing` },
];

test.describe("every Phase 5 screen", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: "dev_user", value: "owner@rongdhonu.example", url: ADMIN }, { name: "dev_platform_user", value: "owner@biztrackbd.example", url: PLAT }]);
  });
  for (const s of SCREENS) {
    test(`${s.name} is accessible, fits the screen and has big enough tap targets`, async ({ page }, info) => {
      const res = await page.goto(s.url);
      expect(res?.status()).toBe(200);
      await expect(page.locator("main, [role=main]").first()).toBeVisible();
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "page scrolls sideways").toBeLessThanOrEqual(1);
      if (info.project.name.startsWith("mobile")) {
        const small = await page.evaluate(() => {
          const bad: string[] = [];
          for (const el of document.querySelectorAll<HTMLElement>("a[href], button, input:not([type=hidden]), select, textarea, summary")) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === "hidden") continue;
            if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) continue;
            if (r.height < 40 && !el.closest(".tabs, nav.pager, p, li, .chips, .foot-links, .hp")) bad.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)}" ${Math.round(r.height)}px`);
          }
          return bad.slice(0, 6);
        });
        expect(small, "tap targets under 40px").toEqual([]);
      }
    });
  }
});
