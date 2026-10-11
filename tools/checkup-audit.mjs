// Runs the row-level-security audit (pnpm audit:rls) against the Supabase project, as the restricted app role.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(resolve(root, ".env.local"));
const r = spawnSync("pnpm", ["audit:rls"], { cwd: root, shell: true, stdio: "inherit", env: { ...process.env, DIRECT_URL: process.env.SUPABASE_DB_URL, DATABASE_URL: process.env.SUPABASE_APP_DB_URL } });
process.exit(r.status ?? 1);
