// Seeds only the plans (Starter, Pro, Business) into the database named by SEED_URL: no demo store, no fake people.
// For a real database, such as the Supabase project:
//   $env:SEED_URL = <the owner connection string>; pnpm --filter "@biztrackbd/db" exec tsx scripts/seed-plans.ts
import { resolve } from "node:path";
import { createBaseClient } from "../src/client";
import { seedPlans } from "../src/testing";

try {
  process.loadEnvFile(resolve(process.cwd(), "../../.env.local"));
} catch {
  /* rely on the real environment */
}
const url = process.env.SEED_URL;
if (!url) throw new Error("SEED_URL is not set");
const db = createBaseClient(url, 2);
try {
  await seedPlans(db);
  console.log(`plans now in the database: ${(await db.plan.findMany({ select: { tier: true }, orderBy: { tier: "asc" } })).map((p) => p.tier).join(", ")}`);
} finally {
  await db.$disconnect();
}
