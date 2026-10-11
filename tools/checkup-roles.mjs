// Gives the two restricted database roles (biztrack_app, biztrack_platform) their own random passwords, writes their connection strings
// into .env.local (SUPABASE_APP_DB_URL, SUPABASE_PLATFORM_DB_URL), and checks each one really logs in as that role and cannot bypass
// row-level security. Never prints a password. Uses the owner login SUPABASE_DB_URL only to set the passwords.
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV = join(root, ".env.local");
process.loadEnvFile(ENV);
const pg = createRequire(join(root, "apps/admin/package.json"))("pg");

const owner = new URL(process.env.SUPABASE_DB_URL);
const ref = decodeURIComponent(owner.username).split(".")[1];
if (!ref) throw new Error("SUPABASE_DB_URL is not a pooler string (no project suffix on the username)");
const pass = () => randomBytes(24).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 32).padEnd(32, "x");
const roles = [["biztrack_app", "SUPABASE_APP_DB_URL", pass()], ["biztrack_platform", "SUPABASE_PLATFORM_DB_URL", pass()]];

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
for (const [role, , pw] of roles) await c.query(`ALTER ROLE ${role} LOGIN PASSWORD '${pw}'`); // alphanumeric only: nothing to escape
await c.end();

let env = readFileSync(ENV, "utf8").replace(/\r\n/g, "\n");
for (const [role, key, pw] of roles) {
  const line = `${key}="postgresql://${role}.${ref}:${pw}@${owner.host}/postgres"`;
  env = new RegExp(`^${key}=.*$`, "m").test(env) ? env.replace(new RegExp(`^${key}=.*$`, "m"), line) : env.trimEnd() + "\n" + line + "\n";
}
writeFileSync(ENV, env);

process.loadEnvFile(ENV); // does not override: read the new values straight from the file
const fresh = Object.fromEntries(env.split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split("=")[0], l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));
for (const [role, key] of roles) {
  const t = new pg.Client({ connectionString: fresh[key], ssl: { rejectUnauthorized: false } });
  await t.connect();
  const r = (await t.query(`SELECT current_user AS who, (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass_rls`)).rows[0];
  await t.end();
  console.log(`${key}: logs in as ${r.who}, bypasses row-level security: ${r.bypass_rls} (expected ${role}, ${role === "biztrack_platform"})`);
}
