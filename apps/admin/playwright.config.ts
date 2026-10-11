import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";

try {
  process.loadEnvFile(resolve(process.cwd(), "../../.env.local"));
} catch {
  /* rely on the real environment */
}

// Two files the development SMS sender writes to, one per app, so a test can read the message a customer would have received.
const STORE_OUTBOX = resolve(process.cwd(), "e2e/.store-sms.jsonl");
const ADMIN_OUTBOX = resolve(process.cwd(), "e2e/.admin-sms.jsonl");
process.env.E2E_STORE_SMS_OUTBOX = STORE_OUTBOX;
process.env.E2E_ADMIN_SMS_OUTBOX = ADMIN_OUTBOX;
const META = "http://localhost:4011";
// Phase 7: DNS answers come from a file the test writes, and Vercel is a local stand-in, so a domain can be connected without owning one.
const DNS_FILE = resolve(process.cwd(), "e2e/.dns.json");
process.env.E2E_DNS_FILE = DNS_FILE;
const DOMAINS_ENV = { DEV_DNS_FILE: DNS_FILE, VERCEL_TOKEN: "e2e-vercel-token", VERCEL_PROJECT_ID: "prj_e2e", VERCEL_API_URL: "http://localhost:4012", PLATFORM_A_RECORD: "203.0.113.10", PLATFORM_CNAME_TARGET: "cname.bt.test", PREVIEW_SECRET: "e2e-preview-secret-0123456789" };

/**
 * End-to-end tests for the merchant admin, at a phone width (390) and a desktop width (1440).
 * They start both apps: the customer storefront (so a real customer can place an order) and the admin.
 * Uses the installed Chrome. Runs against the seeded demo store, in the order the tests are written.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3001", channel: "chrome", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
  ],
  globalSetup: "./e2e/global-setup.ts",
  webServer: [
    { command: "node e2e/fake-courier.mjs", url: "http://localhost:4010/__bookings", reuseExistingServer: true, timeout: 30_000 },
    { command: "node e2e/fake-meta.mjs", url: "http://localhost:4011/__hits", reuseExistingServer: true, timeout: 30_000 },
    { command: "node e2e/fake-vercel.mjs", url: "http://localhost:4012/__state", reuseExistingServer: true, timeout: 30_000 },
    // COURIER_BASE_URL_STEADFAST points booking at the local stand-in; it is ignored by production builds.
    { command: "pnpm exec next dev -p 3001", url: "http://localhost:3001/no-access", reuseExistingServer: true, timeout: 120_000, env: { COURIER_BASE_URL_STEADFAST: "http://localhost:4010", PLATFORM_BKASH_NUMBER: "01800000000", PLATFORM_NAGAD_NUMBER: "01900000000", DEV_SMS_OUTBOX: ADMIN_OUTBOX, META_GRAPH_URL: META, CRON_SECRET: "e2e-cron-secret-0123456789", ...DOMAINS_ENV } },
    // Phase 5: the marketing site and signup wizard, and the super admin. CRON_SECRET lets the test run the daily billing sweep.
    { command: "pnpm --filter @biztrackbd/marketing exec next dev -p 3002", cwd: "../..", url: "http://localhost:3002/pricing", reuseExistingServer: true, timeout: 120_000 },
    { command: "pnpm --filter @biztrackbd/platform exec next dev -p 3003", cwd: "../..", url: "http://localhost:3003/no-access", reuseExistingServer: true, timeout: 120_000, env: { CRON_SECRET: "e2e-cron-secret-0123456789", ...DOMAINS_ENV } },
    { command: "pnpm --filter @biztrackbd/storefront exec next dev -p 3000", cwd: "../..", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000, env: { DEV_SMS_OUTBOX: STORE_OUTBOX, META_GRAPH_URL: META, PREVIEW_SECRET: DOMAINS_ENV.PREVIEW_SECRET } },
  ],
});
