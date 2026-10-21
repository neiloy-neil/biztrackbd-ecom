import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: "../../.env.local" });

// Tests must never touch the real database. .env.local holds the real Supabase URLs, so every database variable is pointed at the
// private test database here, or at nothing (the test then fails to connect instead of writing to production).
const testApp = process.env.TEST_DATABASE_URL ?? "";
const testDirect = process.env.TEST_DIRECT_URL ?? "";
process.env.DATABASE_URL = testApp;
process.env.DIRECT_URL = testDirect;
process.env.PLATFORM_DATABASE_URL = testDirect;

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false, // tests reset a shared database
  },
});
