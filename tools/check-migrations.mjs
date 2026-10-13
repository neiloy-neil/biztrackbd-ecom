// Lists the migrations in the repository that the live database has not applied yet (the same check as .github/workflows/migrations.yml).
//   node tools/check-migrations.mjs        exits 1 when something is pending
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(resolve(root, ".env.local"));
const require = createRequire(resolve(root, "packages/core/package.json"));
const pg = require("pg");
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query("select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null");
await client.end();
const applied = new Set(rows.map((r) => r.migration_name));
const here = readdirSync(resolve(root, "packages/db/prisma/migrations"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const pending = here.filter((n) => !applied.has(n));
console.log(pending.length ? `Not applied to the live database:\n  ${pending.join("\n  ")}\nRun: node tools/checkup-migrate.mjs` : `All ${here.length} migrations are applied.`);
process.exit(pending.length ? 1 : 0);
