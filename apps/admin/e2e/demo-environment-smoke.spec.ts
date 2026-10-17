import { expect, test } from "@playwright/test";
import { actAs, freshPhone } from "./helpers";

const MKT = "http://localhost:3002";
const ADMIN = "http://localhost:3001";
const PLATFORM = "http://localhost:3003";

test.describe("Demo Environment & Business Operations Smoke Suite (DEMO-002)", () => {
  test("1. Marketing Demo Chooser (/demo) displays all 12 templates with capability state labels", async ({ page }) => {
    await page.goto(`${MKT}/demo`);
    await expect(page).toHaveTitle(/Live Product Demos/);

    // Verify Commerce Demos
    for (const id of ["kapor", "gadgetstudio", "mini-bunny", "axionwear", "bindu", "berber"]) {
      const card = page.locator(`article:has(a[data-testid="demo-preview-${id}"])`);
      await expect(card).toBeVisible();
      await expect(card.getByText("Commerce")).toBeVisible();
      await expect(card.getByText("Live Storefront")).toBeVisible();
      await expect(card.getByText("Sample Data")).toBeVisible();
    }

    // Verify all 6 Business Demos
    for (const id of ["dhaka-bistro", "modern-clinic", "apex-corporate", "local-service-pro", "portfolio-focus", "public-profile"]) {
      const card = page.locator(`article:has(a[data-testid="demo-preview-${id}"])`);
      await expect(card).toBeVisible();
      await expect(card.getByText("Business")).toBeVisible();
      await expect(card.getByText("Live Storefront")).toBeVisible();
      await expect(card.getByText("Sample Data")).toBeVisible();
    }

    // Verify Authentic UI Evidence Section exists and tab switching works
    const proofSec = page.locator("section:has-text('Authentic Merchant Workspaces')");
    await expect(proofSec).toBeVisible();

    // Click Clinic Chambers Tab
    await proofSec.getByRole("tab", { name: "Doctor Chambers & Queue" }).click();
    await expect(proofSec.getByText("BMDC A-48291")).toBeVisible();
    await expect(proofSec.getByText("Dhanmondi Chamber")).toBeVisible();

    // Click Meta CAPI Tab
    await proofSec.getByRole("tab", { name: "Meta CAPI & Tracking Health" }).click();
    await expect(proofSec.getByText(/SHA-256/)).toBeVisible();
    await expect(proofSec.getByText("200 OK")).toBeVisible();
  });

  test("2. Business Landing Page (/business) renders vertical blueprints and authentic proof", async ({ page }) => {
    await page.goto(`${MKT}/business`);
    await expect(page).toHaveTitle(/Business, Service & Portfolio Websites/);

    // Check vertical guide links
    await expect(page.locator('a[href="/business/doctor-websites"]')).toBeVisible();
    await expect(page.locator('a[href="/business/restaurant-websites"]')).toBeVisible();
    await expect(page.locator('a[href="/business/company-website"]')).toBeVisible();
    await expect(page.locator('a[href="/business/service-websites"]')).toBeVisible();

    // Check unified pricing tiers
    await expect(page.getByText("৳ 399")).toBeVisible();
    await expect(page.getByText("৳ 799")).toBeVisible();
    await expect(page.getByText("৳ 1,499")).toBeVisible();

    // Check Authentic UI Evidence panel
    const proof = page.locator("section:has-text('Inspect the real merchant operations desk')");
    await expect(proof).toBeVisible();
    await expect(proof.getByText("Live in Merchant Admin")).toBeVisible();
  });

  test("3. Template Preview Customer Site (/demo/[template]) renders responsive preview", async ({ page }) => {
    for (const template of ["modern-clinic", "dhaka-bistro", "apex-corporate"]) {
      const res = await page.goto(`${MKT}/demo/${template}`);
      expect(res?.status()).toBe(200);
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("4. Public Contact & Lead Ingestion API (/api/contact) validates consent and assigns eventId", async ({ page }) => {
    // Negative test: Consent missing -> 400
    const negRes = await page.request.post(`${MKT}/api/contact`, {
      data: {
        name: "Test Visitor",
        phone: freshPhone(),
        email: "visitor@example.test",
        message: "Requesting consultation quote",
        consent: false,
      },
    });
    expect(negRes.status()).toBe(400);

    // Positive test: Consent given -> 200 with eventId & lead ID
    const posRes = await page.request.post(`${MKT}/api/contact`, {
      data: {
        name: "Test Visitor",
        phone: freshPhone(),
        email: "visitor@example.test",
        topic: "business",
        message: "Requesting medical website quote",
        consent: true,
        eventId: "ev_smoke_test_01",
      },
    });
    expect(posRes.status()).toBe(200);
    const body = await posRes.json();
    expect(body.ok).toBe(true);
    expect(body.id).toBeTruthy();
    expect(body.eventId).toBe("ev_smoke_test_01");
  });

  test("5. Merchant Admin Workspaces (/leads, /bookings, /marketing/pixels/health) load operational desks", async ({ page, context }) => {
    await actAs(context, "owner");

    // 1. Leads Workspace
    await page.goto(`${ADMIN}/leads`);
    await expect(page.locator("h1")).toContainText(/Leads/i);
    await expect(page.getByRole("link", { name: /All/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /New/i })).toBeVisible();

    // 2. Bookings Workspace
    await page.goto(`${ADMIN}/bookings`);
    await expect(page.locator("h1")).toContainText(/Appointments|Bookings/i);
    await expect(page.getByRole("link", { name: /All/i })).toBeVisible();

    // 3. Tracking Health Dashboard
    await page.goto(`${ADMIN}/marketing/pixels/health`);
    await expect(page.locator("h1")).toContainText(/Tracking Health/i);
    await expect(page.getByText("Multi-Layer Event Performance")).toBeVisible();
    await expect(page.getByRole("button", { name: /Dispatch Test Ping/i })).toBeVisible();
  });
});
