// Starts the four apps for QA against the PRIVATE test database on 127.0.0.1:54329 (database biztrack_qa_test), never the real Supabase project.
// Every outbound key from .env.local is blanked here so a test cannot send a real SMS, email, Meta event or storage upload.
// Usage: node tools/qa-stack.mjs   (Ctrl+C stops it). Logs: qa/logs/<app>.log. Sent SMS are written to qa/logs/sms.jsonl.
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logs = resolve(root, "qa/logs");
mkdirSync(logs, { recursive: true });
const DB = "127.0.0.1:54329/biztrack_qa_test";
const blank = ["SMS_NET_BD_API_KEY", "BREVO_API_KEY", "META_APP_SECRET", "META_APP_ID", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_DB_URL", "SUPABASE_APP_DB_URL", "SUPABASE_PLATFORM_DB_URL", "PLATFORM_VERCEL_PROJECT_ID", "PLATFORM_VERCEL_TEAM_ID", "NEXT_PUBLIC_PLATFORM_META_PIXEL_ID", "NEXT_PUBLIC_PLATFORM_GA4_ID", "NEXT_PUBLIC_PLATFORM_GTM_ID"];
const env = {
  ...process.env,
  ...Object.fromEntries(blank.map((k) => [k, ""])),
  DATABASE_URL: `postgresql://biztrack_app:app_password@${DB}`,
  DIRECT_URL: `postgresql://postgres@${DB}`,
  PLATFORM_DATABASE_URL: `postgresql://postgres@${DB}`,
  TEST_DATABASE_URL: `postgresql://biztrack_app:app_password@${DB}`,
  TEST_DIRECT_URL: `postgresql://postgres@${DB}`,
  DEV_AUTH: "1",
  MEDIA_DRIVER: "local",
  SMS_PROVIDER: "",
  DEV_SMS_OUTBOX: resolve(logs, "sms.jsonl"),
  NEXT_PUBLIC_ROOT_DOMAIN: "localhost:3000",
  NEXT_PUBLIC_ADMIN_URL: "http://localhost:3001",
  CRON_SECRET: "qa-cron-secret-0123456789",
  CUSTOMER_AUTH_SECRET: process.env.CUSTOMER_AUTH_SECRET || "qa-customer-auth-secret-0123456789",
};
const only = process.argv[2] ? process.argv[2].split(",") : null;
const kids = [["storefront", 3000], ["admin", 3001], ["marketing", 3002], ["platform", 3003]].filter(([n]) => !only || only.includes(n)).map(([name, port]) => {
  const out = createWriteStream(resolve(logs, `${name}.log`));
  const startApps = (process.argv[3] || "").split(",").filter(Boolean);
  const c = spawn("pnpm", ["exec", "next", startApps.includes(name) ? "start" : "dev", "-p", String(port)], { cwd: resolve(root, "apps", name), env, shell: true });
  c.stdout.pipe(out);
  c.stderr.pipe(out);
  return c;
});
console.log("QA stack starting on the private test database; logs in qa/logs/");
const stop = () => { for (const k of kids) k.kill(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
