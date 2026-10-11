import { spawn } from "node:child_process";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";
import pg from "pg";

/**
 * Tier 2 backups from docs/19: pg_dump, then gzip, then AES-256-GCM, with a manifest that holds the IV, the auth tag and a
 * SHA-256 of the encrypted file. Restoring checks the hash first (a damaged file is refused before any decryption), then the
 * GCM tag (a changed byte, or the wrong key, is refused), then loads the dump into a scratch database and compares it with
 * the source. This module is pure Node and is NOT exported from the core index, so no app bundle pulls it in:
 *   import { runDrill } from "@biztrackbd/core/backup"
 * Writing to Cloudflare R2 is a `BackupStore` implementation that is not written yet (no credentials or SDK here);
 * `LocalDirStore` is the same contract on a disk.
 */

export interface Manifest {
  format: "pg_dump-plain+gzip+aes-256-gcm";
  file: string;
  ivHex: string;
  authTagHex: string;
  sha256: string;
  bytes: number;
  createdAt: string;
  database: string;
}

export class BackupError extends Error {
  constructor(readonly code: "BAD_KEY" | "CORRUPT" | "TAMPERED" | "TOOL" | "RESTORE", message: string) {
    super(message);
    this.name = "BackupError";
  }
}

export interface BackupStore {
  put(name: string, localPath: string): Promise<void>;
  get(name: string, localPath: string): Promise<void>;
}

export class LocalDirStore implements BackupStore {
  constructor(private readonly dir: string) {}
  async put(name: string, localPath: string) {
    await mkdir(this.dir, { recursive: true });
    await pipeline(createReadStream(localPath), createWriteStream(join(this.dir, name)));
  }
  async get(name: string, localPath: string) {
    await mkdir(dirname(localPath), { recursive: true });
    await pipeline(createReadStream(join(this.dir, name)), createWriteStream(localPath));
  }
}

/**
 * Offsite copies in a PRIVATE Supabase Storage bucket (the service key is the only way in; nothing is public). A plain upload
 * is limited by the project's file size limit (50 MB by default), so a larger dump is refused with a plain message rather than
 * truncated: resumable uploads are not built. Cloudflare R2 would be another implementation of the same interface.
 */
export class SupabaseBackupStore implements BackupStore {
  private readonly base: string;
  constructor(private readonly o: { url: string; serviceKey: string; bucket?: string; fetch?: typeof fetch; maxBytes?: number }) {
    this.base = o.url.replace(/\/+$/, "");
  }
  private get bucket() {
    return this.o.bucket ?? "backups";
  }
  private get f() {
    return this.o.fetch ?? fetch;
  }
  private headers(extra: Record<string, string> = {}) {
    return { apikey: this.o.serviceKey, authorization: `Bearer ${this.o.serviceKey}`, ...extra };
  }
  async put(name: string, localPath: string) {
    if (!/^[A-Za-z0-9._/-]+$/.test(name) || name.includes("..")) throw new BackupError("TOOL", "Bad backup name");
    const size = (await stat(localPath)).size;
    if (size > (this.o.maxBytes ?? 45 * 1024 * 1024)) throw new BackupError("TOOL", `This backup is ${(size / 1048576).toFixed(0)} MB, more than a plain upload to Supabase Storage takes. Resumable upload is not built yet.`);
    const res = await this.f(`${this.base}/storage/v1/object/${this.bucket}/${name}`, { method: "POST", headers: this.headers({ "content-type": "application/octet-stream", "x-upsert": "true" }), body: await readFile(localPath), signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new BackupError("TOOL", `The offsite upload failed (${res.status})`);
  }
  async get(name: string, localPath: string) {
    const res = await this.f(`${this.base}/storage/v1/object/${this.bucket}/${name}`, { headers: this.headers(), signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new BackupError("TOOL", `The offsite download failed (${res.status})`);
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, Buffer.from(await res.arrayBuffer()));
  }
  async remove(name: string) {
    await this.f(`${this.base}/storage/v1/object/${this.bucket}/${name}`, { method: "DELETE", headers: this.headers() }).catch(() => undefined);
  }
  /** Creates the private bucket if needed. */
  async ensureBucket() {
    const res = await this.f(`${this.base}/storage/v1/bucket`, { method: "POST", headers: this.headers({ "content-type": "application/json" }), body: JSON.stringify({ id: this.bucket, name: this.bucket, public: false }) });
    if (res.ok || res.status === 409) return;
    if ((await res.text()).toLowerCase().includes("already exists")) return;
    throw new BackupError("TOOL", `Could not create the backup bucket (${res.status})`);
  }
}

function keyOf(hex: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new BackupError("BAD_KEY", "The backup key must be 64 hex characters (32 bytes)");
  return Buffer.from(hex, "hex");
}

async function sha256(path: string): Promise<string> {
  const h = createHash("sha256");
  await pipeline(createReadStream(path), h);
  return h.digest("hex");
}

/** gzip then encrypt `plainPath` into `outPath`. */
export async function encryptFile(plainPath: string, outPath: string, keyHex: string, meta: { database: string; file: string }): Promise<Manifest> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyOf(keyHex), iv);
  await pipeline(createReadStream(plainPath), createGzip({ level: 9 }), cipher, createWriteStream(outPath));
  return {
    format: "pg_dump-plain+gzip+aes-256-gcm", file: meta.file, ivHex: iv.toString("hex"), authTagHex: cipher.getAuthTag().toString("hex"),
    sha256: await sha256(outPath), bytes: (await stat(outPath)).size, createdAt: new Date().toISOString(), database: meta.database,
  };
}

/** Verify, decrypt and decompress. Refuses a damaged file, a changed byte and the wrong key. */
export async function decryptFile(encPath: string, outPath: string, keyHex: string, m: Manifest): Promise<void> {
  const key = keyOf(keyHex);
  if ((await sha256(encPath)) !== m.sha256) throw new BackupError("CORRUPT", "The backup file does not match its recorded checksum");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(m.ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(m.authTagHex, "hex"));
  try {
    await pipeline(createReadStream(encPath), decipher, createGunzip(), createWriteStream(outPath));
  } catch (e) {
    await rm(outPath, { force: true });
    throw new BackupError("TAMPERED", `The backup could not be authenticated (wrong key or changed data): ${(e as Error).message}`);
  }
}

// ---- Postgres tools ------------------------------------------------------------------------------------------------

function parts(url: string) {
  const u = new URL(url);
  return { host: u.hostname, port: u.port || "5432", user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), db: u.pathname.slice(1) };
}

const bin = (name: string) => (process.env.PG_BIN ? join(process.env.PG_BIN, name) : name);

function run(cmd: string, args: string[], password: string, stdoutTo?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin(cmd), args, { env: { ...process.env, PGPASSWORD: password }, stdio: ["ignore", stdoutTo ? "pipe" : "pipe", "pipe"] });
    let err = "", out = "";
    child.stderr.on("data", (d) => (err += d));
    if (stdoutTo) pipeline(child.stdout, createWriteStream(stdoutTo)).catch(reject);
    else child.stdout.on("data", (d) => (out += d));
    child.on("error", (e) => reject(new BackupError("TOOL", `${cmd} could not start: ${e.message}. Is PostgreSQL's bin folder on PATH or in PG_BIN?`)));
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new BackupError("TOOL", `${cmd} failed (${code}): ${err.trim().slice(0, 400)}`))));
  });
}

export async function dumpDatabase(url: string, outSql: string): Promise<void> {
  const c = parts(url);
  // Plain SQL, no owner statements, so it loads under whatever role restores it. Policies, grants and functions are kept.
  await run("pg_dump", ["-h", c.host, "-p", c.port, "-U", c.user, "--no-owner", "--format=plain", c.db], c.password, outSql);
}

export async function restoreInto(adminUrl: string, scratchDb: string, sqlPath: string): Promise<void> {
  const c = parts(adminUrl);
  await run("psql", ["-h", c.host, "-p", c.port, "-U", c.user, "-d", c.db, "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS "${scratchDb}"`, "-c", `CREATE DATABASE "${scratchDb}"`], c.password);
  await run("psql", ["-h", c.host, "-p", c.port, "-U", c.user, "-d", scratchDb, "-v", "ON_ERROR_STOP=1", "-q", "-f", sqlPath], c.password).catch((e) => {
    throw new BackupError("RESTORE", `Loading the dump failed: ${(e as Error).message}`);
  });
}

export async function dropDatabase(adminUrl: string, db: string): Promise<void> {
  const c = parts(adminUrl);
  await run("psql", ["-h", c.host, "-p", c.port, "-U", c.user, "-d", c.db, "-c", `DROP DATABASE IF EXISTS "${db}"`], c.password);
}

const withDb = (url: string, db: string) => {
  const u = new URL(url);
  u.pathname = `/${db}`;
  return u.toString();
};

// ---- Backup, then prove it can be restored ---------------------------------------------------------------------------

export interface DrillResult {
  ok: boolean;
  backup: { bytes: number; plainBytes: number; ms: number };
  restore: { ms: number };
  tables: number;
  rows: number;
  mismatches: string[];
  isolationHolds: boolean;
  rlsForcedEverywhere: boolean;
  tamperRefused: boolean;
  wrongKeyRefused: boolean;
  totalMs: number;
}

async function rlsState(url: string): Promise<string[]> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    const t = (await c.query<{ s: string }>(`SELECT cl.relname || ':' || cl.relrowsecurity || ':' || cl.relforcerowsecurity || ':' || (SELECT count(*) FROM pg_policies p WHERE p.tablename = cl.relname AND p.schemaname = 'public') AS s FROM pg_class cl WHERE cl.relkind = 'r' AND cl.relnamespace = 'public'::regnamespace ORDER BY cl.relname`)).rows;
    return t.map((r) => r.s);
  } finally {
    await c.end();
  }
}

async function tableCounts(url: string): Promise<Map<string, number>> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    const tables = (await c.query<{ t: string }>(`SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`)).rows.map((r) => r.t);
    const out = new Map<string, number>();
    for (const t of tables) out.set(t, Number((await c.query(`SELECT count(*)::int AS n FROM "${t}"`)).rows[0].n));
    return out;
  } finally {
    await c.end();
  }
}

/**
 * The drill from docs/19 section 4: take a backup of `sourceUrl`, put it in the store, fetch it back, decrypt it, load it into a
 * scratch database on the same server, and check it against the source. Also proves that a changed byte and a wrong key are refused.
 * `adminUrl` must be a role that can create databases; `appUrl` is the restricted application role (for the isolation check).
 */
export async function runDrill(o: { sourceUrl: string; adminUrl: string; appUrl: string; keyHex: string; store: BackupStore; workDir: string; scratchDb?: string }): Promise<DrillResult> {
  const started = Date.now();
  const scratch = o.scratchDb ?? `drill_${Date.now().toString(36)}`;
  await mkdir(o.workDir, { recursive: true });
  const plain = join(o.workDir, "dump.sql"), enc = join(o.workDir, "dump.sql.gz.enc"), fetched = join(o.workDir, "fetched.enc"), restored = join(o.workDir, "restored.sql");
  const source = parts(o.sourceUrl).db;

  try {
    const t0 = Date.now();
    await dumpDatabase(o.sourceUrl, plain);
    const manifest = await encryptFile(plain, enc, o.keyHex, { database: source, file: "dump.sql.gz.enc" });
    await o.store.put(manifest.file, enc);
    await writeFile(join(o.workDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    const backupMs = Date.now() - t0;
    const plainBytes = (await stat(plain)).size;

    // Recovery starts from the store and the manifest only.
    const t1 = Date.now();
    await o.store.get(manifest.file, fetched);
    await decryptFile(fetched, restored, o.keyHex, JSON.parse(await readFile(join(o.workDir, "manifest.json"), "utf8")) as Manifest);
    await restoreInto(o.adminUrl, scratch, restored);
    const restoreMs = Date.now() - t1;

    const scratchAdmin = withDb(o.adminUrl, scratch);
    const [a, b] = await Promise.all([tableCounts(o.sourceUrl), tableCounts(scratchAdmin)]);
    const mismatches: string[] = [];
    for (const [t, n] of a) if (b.get(t) !== n) mismatches.push(`${t}: source ${n}, restored ${b.get(t) ?? "missing"}`);
    for (const t of b.keys()) if (!a.has(t)) mismatches.push(`${t}: only in the restored copy`);

    // The restored database must still protect stores from each other.
    const admin = new pg.Client({ connectionString: scratchAdmin });
    await admin.connect();
        const tenants = (await admin.query<{ id: string }>(`SELECT id FROM "Tenant" ORDER BY id LIMIT 2`)).rows.map((r) => r.id);
    await admin.end();
    // The protections must come back exactly as they were: same tables with row-level security on and forced, same policies.
    const [rlsA, rlsB] = await Promise.all([rlsState(o.sourceUrl), rlsState(scratchAdmin)]);
    const rlsSame = rlsA.length === rlsB.length && rlsA.every((x, i) => x === rlsB[i]);
    let isolation = true;
    if (tenants.length === 2) {
      const app = new pg.Client({ connectionString: withDb(o.appUrl, scratch) });
      await app.connect();
      try {
        await app.query("BEGIN");
        await app.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenants[0]]);
        const foreign = Number((await app.query(`SELECT count(*)::int AS n FROM "Order" WHERE "tenantId" <> $1`, [tenants[0]])).rows[0].n);
        isolation = foreign === 0;
        await app.query("ROLLBACK");
        await app.query("BEGIN");
        const nothing = Number((await app.query(`SELECT count(*)::int AS n FROM "Order"`)).rows[0].n);
        isolation = isolation && nothing === 0;
        await app.query("ROLLBACK");
      } finally {
        await app.end();
      }
    }

    // A changed byte, a damaged file, and the wrong key must all be refused.
    const refused = async (fn: () => Promise<void>) => fn().then(() => false, (e) => e instanceof BackupError);
    const bytes = await readFile(enc);
    const flipped = Buffer.from(bytes);
    const at = Math.floor(flipped.length / 2);
    flipped.writeUInt8(flipped.readUInt8(at) ^ 0xff, at);
    const badPath = join(o.workDir, "tampered.enc");
    await writeFile(badPath, flipped);
    const tamperRefused = await refused(() => decryptFile(badPath, join(o.workDir, "tampered.sql"), o.keyHex, manifest));
    // Same size, the checksum rewritten to match: only the GCM tag can catch this one.
    const sneaky = { ...manifest, sha256: await sha256(badPath) };
    const tamperTagRefused = await refused(() => decryptFile(badPath, join(o.workDir, "tampered2.sql"), o.keyHex, sneaky));
    const wrongKeyRefused = await refused(() => decryptFile(enc, join(o.workDir, "wrongkey.sql"), randomBytes(32).toString("hex"), manifest));

    return {
      ok: mismatches.length === 0 && isolation && rlsSame && tamperRefused && tamperTagRefused && wrongKeyRefused,
      backup: { bytes: manifest.bytes, plainBytes, ms: backupMs }, restore: { ms: restoreMs },
      tables: a.size, rows: [...a.values()].reduce((x, y) => x + y, 0), mismatches, isolationHolds: isolation, rlsForcedEverywhere: rlsSame,
      tamperRefused: tamperRefused && tamperTagRefused, wrongKeyRefused, totalMs: Date.now() - started,
    };
  } finally {
    await dropDatabase(o.adminUrl, scratch).catch(() => undefined);
    for (const f of [plain, enc, fetched, restored]) await rm(f, { force: true });
  }
}
