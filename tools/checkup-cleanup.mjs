// Removes everything the checkup created in the Supabase project: stores whose address starts "e2e-checkup-", their Supabase sign-in
// accounts, and the test platform account. Prints what it will remove first; deletes only with --yes. Touches nothing else.
//   node tools/checkup-cleanup.mjs          (list only)
//   node tools/checkup-cleanup.mjs --yes    (delete)
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(join(root, ".env.local"));
const pg = createRequire(join(root, "apps/admin/package.json"))("pg");
const yes = process.argv.includes("--yes");
const sb = (path, init = {}) => fetch(`${process.env.SUPABASE_URL}${path}`, { ...init, headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json" } });

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (t, p = []) => (await c.query(t, p)).rows;

const tenants = await q(`SELECT id, subdomain FROM "Tenant" WHERE subdomain LIKE 'e2e-checkup-%' ORDER BY "createdAt"`);
const ids = tenants.map((t) => t.id);
const users = await q(`SELECT email FROM "TenantUser" WHERE "tenantId" = ANY($1)`, [ids]);
const platform = await q(`SELECT email FROM "PlatformUser" WHERE email LIKE 'e2e-checkup-%'`);
const all = [];
for (let page = 1; ; page++) {
  const j = await (await sb(`/auth/v1/admin/users?page=${page}&per_page=200`)).json();
  all.push(...(j.users ?? []));
  if ((j.users ?? []).length < 200) break;
}
const accounts = all.filter((u) => (u.email ?? "").startsWith("e2e-checkup-"));
const counts = {};
for (const t of ["Order", "Customer", "Product", "PaymentProof", "Subscription"]) counts[t] = Number((await q(`SELECT count(*)::int AS n FROM "${t}" WHERE "tenantId" = ANY($1)`, [ids]))[0].n);
const other = Number((await q(`SELECT count(*)::int AS n FROM "Tenant" WHERE subdomain NOT LIKE 'e2e-checkup-%'`))[0].n);

console.log(`stores to remove (${tenants.length}):`, tenants.map((t) => t.subdomain).join(", ") || "none");
console.log("rows owned by them:", JSON.stringify(counts));
console.log(`store staff rows: ${users.length}; platform test accounts: ${platform.length}; Supabase sign-in accounts: ${accounts.length}`);
console.log(`stores NOT touched (everything else): ${other}`);
if (!yes) { console.log("\nnothing deleted (run again with --yes)"); await c.end(); process.exit(0); }

// Tenant-owned rows go first, table by table in dependency order (a table that still has dependants is retried on the next pass).
// Append-only triggers on some tables (audit log, loyalty ledger) are switched off for the transaction only. One transaction: a failure changes nothing.
await c.query("BEGIN");
try {
  const tables = (await q(`SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema WHERE c.table_schema = 'public' AND c.column_name = 'tenantId' AND t.table_type = 'BASE TABLE' AND c.table_name <> 'Tenant'`)).map((r) => r.table_name);
  for (const t of tables) await c.query(`ALTER TABLE "${t}" DISABLE TRIGGER USER`);
  let pending = [...tables];
  for (let pass = 1; pass <= 12 && pending.length; pass++) {
    const next = [];
    for (const t of pending) {
      await c.query("SAVEPOINT s");
      try { await c.query(`DELETE FROM "${t}" WHERE "tenantId" = ANY($1)`, [ids]); await c.query("RELEASE SAVEPOINT s"); }
      catch (e) { await c.query("ROLLBACK TO SAVEPOINT s"); next.push(t); if (pass === 12) console.error(`  ${t}: ${e.message}`); }
    }
    pending = next;
  }
  if (pending.length) throw new Error(`could not clear: ${pending.join(", ")}`);
  await c.query(`DELETE FROM "PlatformUser" WHERE email LIKE 'e2e-checkup-%'`);
  const r = await c.query(`DELETE FROM "Tenant" WHERE id = ANY($1)`, [ids]);
  for (const t of tables) await c.query(`ALTER TABLE "${t}" ENABLE TRIGGER USER`);
  await c.query("COMMIT");
  console.log(`deleted ${r.rowCount} stores, their rows in ${tables.length} tables, and ${platform.length} platform accounts`);
} catch (e) {
  await c.query("ROLLBACK");
  console.error("database delete failed and was rolled back:", e.message);
  await c.end();
  process.exit(1);
}
let removed = 0;
for (const u of accounts) { const r = await sb(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" }); if (r.ok) removed++; }
console.log(`deleted ${removed} of ${accounts.length} Supabase sign-in accounts`);
const left = await q(`SELECT count(*)::int AS n FROM "Tenant" WHERE subdomain LIKE 'e2e-checkup-%'`);
console.log(`stores left with the checkup prefix: ${left[0].n}; other stores still present: ${(await q(`SELECT count(*)::int AS n FROM "Tenant"`))[0].n}`);
await c.end();
