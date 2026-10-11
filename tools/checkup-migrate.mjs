// Applies pending Prisma migrations to the Supabase project (as the owner login), then prints the migration status. Prints no secrets.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(resolve(root, ".env.local"));
const env = { ...process.env, DIRECT_URL: process.env.SUPABASE_DB_URL };
for (const args of [["migrate", "deploy"], ["migrate", "status"]]) {
  const r = spawnSync("pnpm", ["--filter", "@biztrackbd/db", "exec", "prisma", ...args], { cwd: root, shell: true, stdio: "inherit", env });
  if (r.status) process.exit(r.status);
}
