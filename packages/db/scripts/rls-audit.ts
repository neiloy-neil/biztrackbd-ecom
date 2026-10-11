// Runs the row-level security sweep against a real database and prints a table-by-table result.
//   DIRECT_URL (owner) and DATABASE_URL (the restricted app role) come from the root .env.local.
//   pnpm --filter @biztrackbd/db exec tsx scripts/rls-audit.ts
import { resolve } from "node:path";
import { auditRls, failures } from "../src/rls-audit";

try {
  process.loadEnvFile(resolve(process.cwd(), "../../.env.local"));
} catch {
  /* rely on the real environment */
}
const direct = process.env.DIRECT_URL, app = process.env.DATABASE_URL;
if (!direct || !app) throw new Error("DIRECT_URL and DATABASE_URL must be set");
if (/prod/i.test(direct)) throw new Error("Refusing to run against a database whose URL contains 'prod' (the sweep rolls back, but do not take the chance)");

const report = await auditRls({ direct, app });
const withData = report.tables.filter((t) => t.rows > 0);
const tried = withData.filter((t) => t.crossTenantInsert !== "none to try");
console.log(`tables with a tenantId: ${report.tables.length} (sealed from the app role: ${report.tables.filter((t) => !t.appCanRead).length})`);
console.log(`tables holding data: ${withData.length}; cross-tenant insert attempted on ${tried.length}`);
console.log(`platform tables readable by the app role: ${report.readablePlatformTables.join(", ")}`);
const bad = failures(report, { platformTablesAllowed: ["Plan", "Announcement", "Tenant"] });
if (bad.length) {
  console.error("FAILURES:\n" + bad.map((b) => " - " + b).join("\n"));
  process.exit(1);
}
console.log("OK: every table is isolated");
