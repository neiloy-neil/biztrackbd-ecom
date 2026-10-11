import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";

try {
  process.loadEnvFile(resolve(process.cwd(), "../../.env.local"));
} catch {
  /* rely on the real environment */
}

const OUTBOX = resolve(process.cwd(), "e2e/.sms-outbox.jsonl");
process.env.E2E_SMS_OUTBOX_PATH = OUTBOX;
const STORE = "http://rongdhonu.localhost:3000";

/**
 * End-to-end tests against the seeded demo store, at a phone width (390) and a desktop width (1440).
 * They run against `next dev` so the development SMS sender is active and writes sign-in codes to a file the test reads.
 * Uses the installed Chrome; no browser download.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: STORE, channel: "chrome", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 900 } } },
  ],
  globalSetup: "./e2e/global-setup.ts",
  webServer: {
    command: "pnpm exec next dev -p 3000",
    // Node cannot resolve *.localhost the way Chrome does, so the readiness check uses the platform root host.
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
    env: { DEV_SMS_OUTBOX: OUTBOX },
  },
});
