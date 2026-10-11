// Creates (or re-activates) a platform team member: the row that lets a person into the platform admin.
// It does NOT make a password or an authenticator: the person does that themselves on the platform login page, so nobody else ever sees them.
//   node tools/platform-admin.mjs --email you@example.com --name "Your Name" [--role OWNER|SUPPORT_LEAD|SUPPORT|FINANCE] [--target supabase|local]
//   add --yes to write (without it the tool only shows what it would do)
// Afterwards the person opens <platform address>/login/start, enters the same email, types the code they are emailed, chooses a password,
// then sets up the authenticator app when asked. The email must be one they can receive mail at.
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try { process.loadEnvFile(join(root, ".env.local")); } catch { /* use the environment */ }
const pg = createRequire(join(root, "apps/admin/package.json"))("pg");

const args = process.argv.slice(2);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const email = (val("--email") ?? "").trim().toLowerCase();
const name = (val("--name") ?? "").trim();
const role = (val("--role") ?? "OWNER").toUpperCase();
const target = val("--target") ?? "supabase";
const yes = args.includes("--yes");

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("--email must be a valid email address");
if (name.length < 2) throw new Error("--name is required");
if (!["OWNER", "SUPPORT_LEAD", "SUPPORT", "FINANCE"].includes(role)) throw new Error("--role must be OWNER, SUPPORT_LEAD, SUPPORT or FINANCE");
if (!["supabase", "local"].includes(target)) throw new Error("--target must be supabase or local");
const url = target === "supabase" ? process.env.SUPABASE_DB_URL : process.env.DIRECT_URL;
if (!url) throw new Error(`the ${target} owner connection is not set in .env.local`);

const c = new pg.Client({ connectionString: url, ...(target === "supabase" ? { ssl: { rejectUnauthorized: false } } : {}) });
await c.connect();
const existing = (await c.query(`SELECT id, name, role, "isActive", "authUserId" IS NOT NULL AS signed_in_before FROM "PlatformUser" WHERE email = $1`, [email])).rows[0];
console.log(`target: ${target}`);
console.log(existing ? `exists: ${existing.name} (${existing.role}), active=${existing.isActive}, has signed in before=${existing.signed_in_before}` : "does not exist yet");
console.log(`${existing ? "would update" : "would create"}: ${email} as ${role}, name "${name}"`);
if (!yes) { console.log("\nnothing written (add --yes)"); await c.end(); process.exit(0); }
if (existing) await c.query(`UPDATE "PlatformUser" SET name = $2, role = $3, "isActive" = true WHERE email = $1`, [email, name, role]);
else await c.query(`INSERT INTO "PlatformUser" (id, email, name, role, "isActive") VALUES (gen_random_uuid()::text, $1, $2, $3, true)`, [email, name, role]);
const total = (await c.query(`SELECT count(*)::int AS n FROM "PlatformUser" WHERE "isActive"`)).rows[0].n;
console.log(`done. Active platform team members in this database: ${total}`);
console.log(`next: open <platform address>/login/start, enter ${email}, type the emailed code, choose a password, then set up the authenticator.`);
await c.end();
