// Starts the four apps against the REAL Supabase project: its Postgres database (as the restricted roles, so row-level security
// applies), its sign-in and its storage. Nothing is local and there is no stand-in sign-in. Reads the root .env.local:
//   SUPABASE_APP_DB_URL        the biztrack_app role      -> DATABASE_URL
//   SUPABASE_PLATFORM_DB_URL   the biztrack_platform role -> PLATFORM_DATABASE_URL
// The apps are started directly (not through turbo, which strips variables it does not know and lets each app fall back to the
// local values in .env.local). Each app prints which database it is using when it first connects: check it says Supabase.
// Usage:  node tools/dev-real.mjs        (stop it with Ctrl+C)
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(resolve(root, ".env.local"));
for (const k of ["SUPABASE_APP_DB_URL", "SUPABASE_PLATFORM_DB_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[k]) throw new Error(`${k} is not set in .env.local`);
}
const host = (u) => new URL(u).host;
const env = {
  ...process.env,
  DATABASE_URL: process.env.SUPABASE_APP_DB_URL,
  PLATFORM_DATABASE_URL: process.env.SUPABASE_PLATFORM_DB_URL,
  DEV_AUTH: "",
  MEDIA_DRIVER: "supabase",
  CRON_SECRET: process.env.CRON_SECRET || "real-run-cron-secret-0123456789",
};
console.log(`database: ${host(env.DATABASE_URL)} (app role), ${host(env.PLATFORM_DATABASE_URL)} (platform role); sign-in: ${host(env.SUPABASE_URL)}; DEV_AUTH off`);
const apps = [["storefront", 3000], ["admin", 3001], ["marketing", 3002], ["platform", 3003]];
const kids = apps.map(([name, port]) => {
  const c = spawn("pnpm", ["exec", "next", "dev", "-p", String(port)], { cwd: resolve(root, "apps", name), env, stdio: ["ignore", "inherit", "inherit"], shell: true });
  c.on("exit", (code) => console.log(`${name} stopped (${code})`));
  return c;
});
const stop = () => { for (const k of kids) k.kill(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
