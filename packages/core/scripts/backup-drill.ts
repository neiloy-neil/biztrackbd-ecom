// The restore drill (docs/19 section 4), run for real: back the database up, bring it back into a scratch database, compare.
//   pnpm --filter @biztrackbd/core exec tsx scripts/backup-drill.ts
// Needs DIRECT_URL (owner), DATABASE_URL (restricted app role) in the root .env.local, PostgreSQL's pg_dump and psql on PATH
// (or PG_BIN), and BACKUP_ENCRYPTION_KEY_HEX (64 hex characters; a throwaway key is made for the drill when it is not set).
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { LocalDirStore, runDrill } from "../src/backup";

try {
  process.loadEnvFile(resolve(process.cwd(), "../../.env.local"));
} catch {
  /* rely on the real environment */
}
const source = process.env.DIRECT_URL, app = process.env.DATABASE_URL;
if (!source || !app) throw new Error("DIRECT_URL and DATABASE_URL must be set");
if (/prod/i.test(source) && !process.env.ALLOW_PROD_DRILL) throw new Error("Refusing to restore next to a database whose URL contains 'prod' unless ALLOW_PROD_DRILL is set");
const admin = new URL(source);
admin.pathname = "/postgres";

const store = new LocalDirStore(resolve(process.cwd(), ".drill-store"));
const r = await runDrill({
  sourceUrl: source, adminUrl: admin.toString(), appUrl: app, store, workDir: resolve(process.cwd(), ".drill-work"),
  keyHex: process.env.BACKUP_ENCRYPTION_KEY_HEX ?? randomBytes(32).toString("hex"),
});
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;
console.log(`backup:   ${mb(r.backup.plainBytes)} of SQL, ${mb(r.backup.bytes)} encrypted, ${r.backup.ms} ms`);
console.log(`restore:  ${r.restore.ms} ms (fetch, decrypt, load into a scratch database)`);
console.log(`compared: ${r.tables} tables, ${r.rows} rows; mismatches: ${r.mismatches.length}`);
for (const m of r.mismatches) console.log("  - " + m);
console.log(`restored copy: stores still isolated: ${r.isolationHolds}; row-level security and policies identical to the source: ${r.rlsForcedEverywhere}`);
console.log(`damaged or changed backup refused: ${r.tamperRefused}; wrong key refused: ${r.wrongKeyRefused}`);
console.log(r.ok ? `DRILL PASSED in ${r.totalMs} ms` : "DRILL FAILED");
process.exit(r.ok ? 0 : 1);
