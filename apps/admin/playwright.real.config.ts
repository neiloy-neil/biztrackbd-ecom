import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";

try {
  process.loadEnvFile(resolve(process.cwd(), "../../.env.local"));
} catch {
  /* rely on the real environment */
}

/**
 * Real sign-in, against the real Supabase project named in .env.local. DEV_AUTH is blanked for the two apps it starts, so they
 * use Supabase Auth exactly as production would. Test accounts are created and removed through Supabase's admin API (they all
 * start with "e2e-real-") and are deleted again in afterAll.
 * Run it on its own, with no other dev servers on 3001 or 3003:   pnpm exec playwright test -c playwright.real.config.ts
 */
export default defineConfig({
  testDir: "./e2e-real",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3001", channel: "chrome", trace: "retain-on-failure", screenshot: "only-on-failure", viewport: { width: 1280, height: 900 } },
  projects: [{ name: "real-auth" }],
  webServer: [
    { command: "pnpm exec next dev -p 3001", url: "http://localhost:3001/login", reuseExistingServer: false, timeout: 180_000, env: { DEV_AUTH: "", CRON_SECRET: "e2e-cron-secret-0123456789", PLATFORM_BKASH_NUMBER: "01800000000", PLATFORM_NAGAD_NUMBER: "01900000000" } },
    { command: "pnpm --filter @biztrackbd/platform exec next dev -p 3003", cwd: "../..", url: "http://localhost:3003/login", reuseExistingServer: false, timeout: 180_000, env: { DEV_AUTH: "", CRON_SECRET: "e2e-cron-secret-0123456789" } },
  ],
});
