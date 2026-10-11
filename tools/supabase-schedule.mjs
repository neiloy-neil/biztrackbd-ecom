// Installs the scheduled jobs in the Supabase project (pg_cron + pg_net): each job calls one of the apps' /api/cron/* endpoints with
// "Authorization: Bearer <CRON_SECRET>". The secret is kept in Supabase Vault, never in the job text. Safe to run again: it replaces its own jobs.
//   node tools/supabase-schedule.mjs --admin https://admin.example.com --platform https://platform.example.com           (shows the plan)
//   node tools/supabase-schedule.mjs --admin ... --platform ... --yes                                                   (installs)
//   node tools/supabase-schedule.mjs --remove --yes                                                                     (removes the jobs and the secret)
// Reads SUPABASE_DB_URL (owner login) from .env.local and CRON_SECRET (the SAME value the Vercel projects have) from .env.production.local.
// A job only works once the apps are deployed at those addresses; until then each call fails harmlessly and is logged in net._http_response.
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try { process.loadEnvFile(join(root, ".env.local")); } catch { /* use the environment */ }
try { process.loadEnvFile(join(root, ".env.production.local")); } catch { /* generated production secrets, if any */ }
const pg = createRequire(join(root, "apps/admin/package.json"))("pg");

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const yes = flag("--yes"), remove = flag("--remove");
const origin = (u, label) => {
  if (!u) throw new Error(`--${label} <https address> is required`);
  const x = new URL(u);
  if (x.protocol !== "https:") throw new Error(`--${label} must be an https address (the secret travels in the request)`);
  return x.origin;
};

// name, schedule (UTC cron), app, path. Dhaka is UTC+6.
const JOBS = [
  ["biztrack-abandoned", "*/5 * * * *", "admin", "/api/cron/abandoned"],
  ["biztrack-courier-sync", "*/30 * * * *", "admin", "/api/cron/courier-sync"],
  ["biztrack-domains", "*/5 * * * *", "admin", "/api/cron/domains"],
  ["biztrack-loyalty", "0 20 * * *", "admin", "/api/cron/loyalty"], // 02:00 Dhaka
  ["biztrack-billing", "0 21 * * *", "platform", "/api/cron/billing"], // 03:00 Dhaka
];

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = (t, p = []) => c.query(t, p);

if (remove) {
  if (!yes) { console.log("would remove the jobs named biztrack-* and the vault secret (add --yes)"); await c.end(); process.exit(0); }
  const has = (await q(`SELECT to_regclass('cron.job') AS t`)).rows[0].t;
  if (has) for (const [name] of JOBS) await q(`SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = $1`, [name]);
  await q(`DELETE FROM vault.secrets WHERE name = 'biztrack_cron_secret'`);
  await q(`DROP SCHEMA IF EXISTS biztrack_cron CASCADE`);
  console.log("removed the biztrack-* jobs, the helper schema and the vault secret");
  await c.end();
  process.exit(0);
}

const admin = origin(val("--admin"), "admin"), platform = origin(val("--platform"), "platform");
const secret = process.env.CRON_SECRET;
if (!secret || secret.length < 16) throw new Error("CRON_SECRET (16+ characters, the same as in the Vercel projects) must be set in .env.local");
const urlOf = (app, path) => (app === "admin" ? admin : platform) + path;

console.log("plan:");
for (const [name, sched, app, path] of JOBS) console.log(`  ${name.padEnd(22)} ${sched.padEnd(13)} POST ${urlOf(app, path)}`);
console.log("  the secret is stored in Supabase Vault as biztrack_cron_secret");
if (!yes) { console.log("\nnothing changed (add --yes to install)"); await c.end(); process.exit(0); }

await q(`CREATE EXTENSION IF NOT EXISTS pg_net`);
await q(`CREATE EXTENSION IF NOT EXISTS pg_cron`);
// Note: the pg_net schema belongs to Supabase's admin role, so these grants to anon cannot be changed from the postgres login. They are harmless while
// the schema is not in the Data API's exposed schemas (it is not by default): keep "Exposed schemas" at public only, or switch the Data API off.
// The secret in Vault (create or replace).
const existing = (await q(`SELECT id FROM vault.secrets WHERE name = 'biztrack_cron_secret'`)).rows[0];
if (existing) await q(`SELECT vault.update_secret($1::uuid, $2)`, [existing.id, secret]);
else await q(`SELECT vault.create_secret($1, 'biztrack_cron_secret', 'Bearer secret for the BizTrack cron endpoints')`, [secret]);
// One small function does the call, so job text holds only an address. It is not reachable by the API roles.
await q(`CREATE SCHEMA IF NOT EXISTS biztrack_cron`);
await q(`
  CREATE OR REPLACE FUNCTION biztrack_cron.call(target text) RETURNS bigint
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
  DECLARE s text;
  BEGIN
    SELECT decrypted_secret INTO s FROM vault.decrypted_secrets WHERE name = 'biztrack_cron_secret';
    RETURN net.http_post(url := target, headers := jsonb_build_object('Authorization', 'Bearer ' || s, 'Content-Type', 'application/json'), body := '{}'::jsonb, timeout_milliseconds := 55000);
  END $f$`);
await q(`REVOKE ALL ON SCHEMA biztrack_cron FROM PUBLIC, anon, authenticated`);
await q(`REVOKE ALL ON FUNCTION biztrack_cron.call(text) FROM PUBLIC, anon, authenticated`);
for (const [name, sched, app, path] of JOBS) {
  await q(`SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = $1`, [name]);
  await q(`SELECT cron.schedule($1, $2, format('SELECT biztrack_cron.call(%L)', $3::text))`, [name, sched, urlOf(app, path)]);
}
const rows = (await q(`SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'biztrack-%' ORDER BY jobname`)).rows;
console.log("\ninstalled:");
for (const r of rows) console.log(`  ${r.jobname.padEnd(22)} ${r.schedule.padEnd(13)} active=${r.active}`);
await c.end();
