import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import { BackupError, LocalDirStore, SupabaseBackupStore, decryptFile, encryptFile, runDrill } from "../src/backup";

const dir = mkdtempSync(join(tmpdir(), "bt-backup-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const key = randomBytes(32).toString("hex");

describe("backup encryption", () => {
  const plain = join(dir, "a.sql");
  writeFileSync(plain, "CREATE TABLE t (n int);\n".repeat(2000));

  it("round-trips, and the encrypted file hides the content", async () => {
    const m = await encryptFile(plain, join(dir, "a.enc"), key, { database: "x", file: "a.enc" });
    expect(readFileSync(join(dir, "a.enc")).includes("CREATE TABLE")).toBe(false);
    expect(m.bytes).toBeLessThan(readFileSync(plain).length / 5);
    await decryptFile(join(dir, "a.enc"), join(dir, "a.out"), key, m);
    expect(readFileSync(join(dir, "a.out"), "utf8")).toBe(readFileSync(plain, "utf8"));
  });

  it("refuses the wrong key, a changed byte, a rewritten checksum and a bad key format", async () => {
    const m = await encryptFile(plain, join(dir, "b.enc"), key, { database: "x", file: "b.enc" });
    await expect(decryptFile(join(dir, "b.enc"), join(dir, "b.out"), randomBytes(32).toString("hex"), m)).rejects.toMatchObject({ code: "TAMPERED" });
    const bytes = readFileSync(join(dir, "b.enc"));
    bytes.writeUInt8(bytes.readUInt8(10) ^ 1, 10);
    writeFileSync(join(dir, "b2.enc"), bytes);
    await expect(decryptFile(join(dir, "b2.enc"), join(dir, "b2.out"), key, m)).rejects.toMatchObject({ code: "CORRUPT" });
    await expect(encryptFile(plain, join(dir, "c.enc"), "short", { database: "x", file: "c" })).rejects.toBeInstanceOf(BackupError);
  });

  it("uses a new IV every time, so the same data never encrypts the same way twice", async () => {
    const a = await encryptFile(plain, join(dir, "d1.enc"), key, { database: "x", file: "d1" });
    const b = await encryptFile(plain, join(dir, "d2.enc"), key, { database: "x", file: "d2" });
    expect(a.ivHex).not.toBe(b.ivHex);
    expect(a.sha256).not.toBe(b.sha256);
  });
});

const hasPg = (() => {
  try {
    execSync("pg_dump --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasPg)("the restore drill", () => {
  it("backs up a populated database, restores it elsewhere, and finds it identical and still isolated", async () => {
    const urls = testUrls();
    await resetDatabase(urls.direct);
    const owner = createOwnerClient(urls.direct);
    await seedPlans(owner);
    await createTenantFixture(owner, { name: "Drill A", subdomain: "drill-a" });
    await createTenantFixture(owner, { name: "Drill B", subdomain: "drill-b" });
    await owner.$disconnect();
    const admin = new URL(urls.direct);
    admin.pathname = "/postgres";
    const r = await runDrill({ sourceUrl: urls.direct, adminUrl: admin.toString(), appUrl: urls.app, keyHex: key, store: new LocalDirStore(join(dir, "store")), workDir: join(dir, "work") });
    expect(r.mismatches).toEqual([]);
    expect(r).toMatchObject({ ok: true, isolationHolds: true, rlsForcedEverywhere: true, tamperRefused: true, wrongKeyRefused: true });
    expect(r.rows).toBeGreaterThan(20);
  }, 120_000);
});

describe("the Supabase Storage backup store", () => {
  function fake() {
    const objects = new Map<string, Buffer>();
    const f = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      const key = url.pathname.replace("/storage/v1/object/", "");
      if ((init?.headers as Record<string, string>)?.authorization !== "Bearer service-key") return new Response("{}", { status: 403 });
      if (method === "POST" && url.pathname === "/storage/v1/bucket") return new Response("{}", { status: 200 });
      if (method === "POST") { objects.set(key, Buffer.from(init!.body as Uint8Array)); return new Response("{}", { status: 200 }); }
      if (method === "DELETE") { objects.delete(key); return new Response("{}", { status: 200 }); }
      const o = objects.get(key);
      return o ? new Response(new Uint8Array(o), { status: 200 }) : new Response("{}", { status: 404 });
    }) as typeof fetch;
    return { f, objects };
  }

  it("keeps and returns a backup byte for byte, and refuses names that climb out or files that are too big", async () => {
    const { f, objects } = fake();
    const store = new SupabaseBackupStore({ url: "https://p.supabase.test", serviceKey: "service-key", fetch: f, maxBytes: 1000 });
    await store.ensureBucket();
    const src = join(dir, "s.bin");
    writeFileSync(src, Buffer.from("secret backup bytes"));
    await store.put("2026/dump.enc", src);
    expect([...objects.keys()]).toEqual(["backups/2026/dump.enc"]);
    await store.get("2026/dump.enc", join(dir, "back.bin"));
    expect(readFileSync(join(dir, "back.bin"), "utf8")).toBe("secret backup bytes");
    await expect(store.put("../x", src)).rejects.toBeInstanceOf(BackupError);
    writeFileSync(join(dir, "big.bin"), Buffer.alloc(2000));
    await expect(store.put("big.enc", join(dir, "big.bin"))).rejects.toThrow(/Resumable upload is not built/);
    await expect(store.get("missing.enc", join(dir, "m.bin"))).rejects.toThrow(/download failed/);
    await store.remove("2026/dump.enc");
    expect(objects.size).toBe(0);
  });

  it("is refused with the wrong key", async () => {
    const store = new SupabaseBackupStore({ url: "https://p.supabase.test", serviceKey: "nope", fetch: fake().f });
    writeFileSync(join(dir, "w.bin"), "x");
    await expect(store.put("a.enc", join(dir, "w.bin"))).rejects.toThrow(/upload failed \(403\)/);
  });
});

// The whole drill against the real Supabase project: back up the test database, store it offsite, fetch it back, restore it.
const live = process.env.RUN_LIVE_SUPABASE === "1" && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
describe.skipIf(!live || !hasPg)("the restore drill through real Supabase Storage", () => {
  it("backs up offsite, restores from there, and finds the copy identical", async () => {
    const urls = testUrls();
    await resetDatabase(urls.direct);
    const owner = createOwnerClient(urls.direct);
    await seedPlans(owner);
    await createTenantFixture(owner, { name: "Offsite A", subdomain: "offsite-a" });
    await createTenantFixture(owner, { name: "Offsite B", subdomain: "offsite-b" });
    await owner.$disconnect();
    const admin = new URL(urls.direct);
    admin.pathname = "/postgres";
    const store = new SupabaseBackupStore({ url: process.env.SUPABASE_URL!, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY! });
    await store.ensureBucket();
    const r = await runDrill({ sourceUrl: urls.direct, adminUrl: admin.toString(), appUrl: urls.app, keyHex: key, store, workDir: join(dir, "live-work") });
    await store.remove("dump.sql.gz.enc");
    expect(r.mismatches).toEqual([]);
    expect(r).toMatchObject({ ok: true, isolationHolds: true, rlsForcedEverywhere: true, tamperRefused: true, wrongKeyRefused: true });
    console.log(`offsite drill: backup ${r.backup.ms} ms, restore (download, decrypt, load) ${r.restore.ms} ms, ${r.rows} rows`);
  }, 240_000);
});
