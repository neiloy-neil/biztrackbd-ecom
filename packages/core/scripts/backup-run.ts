// One real backup of a database: dump, compress, encrypt (AES-256-GCM), upload to a private Supabase Storage bucket, then keep only the newest N.
// Run by .github/workflows/backup.yml every night; also safe to run by hand.
//   pnpm --filter @biztrackbd/core exec tsx scripts/backup-run.ts
// Environment: BACKUP_SOURCE_URL (the owner connection of the database to back up), BACKUP_ENCRYPTION_KEY_HEX (64 hex characters; keep a
// second copy somewhere else: without it a backup cannot be opened), SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (where to put it),
// BACKUP_BUCKET (default "backups"), BACKUP_KEEP (default 14). pg_dump must be at least the server's major version (PG_BIN if not on PATH).
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SupabaseBackupStore, dumpDatabase, encryptFile } from "../src/backup";

try {
  process.loadEnvFile(resolve(process.cwd(), "../../.env.local"));
} catch {
  /* rely on the real environment */
}
const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};
const source = need("BACKUP_SOURCE_URL"), keyHex = need("BACKUP_ENCRYPTION_KEY_HEX"), url = need("SUPABASE_URL"), serviceKey = need("SUPABASE_SERVICE_ROLE_KEY");
const bucket = process.env.BACKUP_BUCKET ?? "backups";
const keep = Math.max(3, Number(process.env.BACKUP_KEEP ?? 14));

const work = resolve(process.cwd(), ".backup-work");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z"); // 20261011T203000Z
const name = `db-${stamp}.sql.gz.enc`;
const plain = resolve(work, "dump.sql"), enc = resolve(work, name);

const store = new SupabaseBackupStore({ url, serviceKey, bucket });
const t0 = Date.now();
await rm(work, { recursive: true, force: true });
await mkdir(work, { recursive: true });
try {
  await dumpDatabase(source, plain);
  const manifest = await encryptFile(plain, enc, keyHex, { database: new URL(source).pathname.slice(1), file: name });
  await store.ensureBucket();
  await store.put(name, enc);
  const manifestPath = resolve(work, `${name}.json`);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  await store.put(`${name}.json`, manifestPath);
  console.log(`backup ${name}: ${(manifest.bytes / 1024 / 1024).toFixed(2)} MB encrypted, sha256 ${manifest.sha256.slice(0, 12)}…, ${Date.now() - t0} ms`);
} finally {
  await rm(work, { recursive: true, force: true }); // the plain dump never stays on disk
}

// Retention: list the bucket, keep the newest `keep` backups (each is a .enc file with a .json manifest beside it).
const res = await fetch(`${url.replace(/\/+$/, "")}/storage/v1/object/list/${bucket}`, {
  method: "POST",
  headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
  body: JSON.stringify({ prefix: "", limit: 1000, sortBy: { column: "name", order: "asc" } }),
});
if (!res.ok) throw new Error(`could not list the backup bucket (${res.status})`);
const names = ((await res.json()) as { name: string }[]).map((o) => o.name).filter((n) => /^db-\d{8}T\d{6}Z\.sql\.gz\.enc$/.test(n)).sort();
const old = names.slice(0, Math.max(0, names.length - keep));
for (const n of old) {
  await store.remove(n);
  await store.remove(`${n}.json`);
}
console.log(`kept ${names.length - old.length} backups, removed ${old.length} older than the newest ${keep}`);
