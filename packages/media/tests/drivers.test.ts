import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { MediaError, configuredDriver, ensureBucket, localDriver, removeImage, saveImage, supabaseDriver, type StorageDriver } from "../src";

const T = "tenant_aaaa1111";
const OTHER = "tenant_bbbb2222";
const root = mkdtempSync(join(tmpdir(), "bt-media-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const photo = () => sharp({ create: { width: 800, height: 600, channels: 3, background: "#C9B79C" } }).png().toBuffer();

describe("the local disk driver", () => {
  it("saves a WebP and removes it again, reporting the bytes freed", async () => {
    const d = localDriver(root);
    const img = await saveImage(T, await photo(), d);
    expect(img.url).toMatch(/^\/media\/tenant_aaaa1111\/[0-9a-f-]{36}\.webp$/);
    const file = join(root, T, img.url.split("/").pop()!);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file).subarray(8, 12).toString()).toBe("WEBP");
    expect(await removeImage(T, img.url, d)).toBe(img.bytes);
    expect(existsSync(file)).toBe(false);
  });

  it("will not delete another store's photo, a path that climbs out, or an outside address", async () => {
    const d = localDriver(root);
    const img = await saveImage(T, await photo(), d);
    expect(await removeImage(OTHER, img.url, d)).toBeNull();
    expect(existsSync(join(root, T, img.url.split("/").pop()!))).toBe(true);
    for (const bad of [`/media/${T}/../${OTHER}/x.webp`, "/media/../../etc/passwd", "https://example.com/a.webp", `/media/${T}/a.png`, ""]) expect(await removeImage(T, bad, d), bad).toBeNull();
  });

  it("says nothing was freed when the file is already gone", async () => {
    expect(await removeImage(T, `/media/${T}/${"a".repeat(36)}.webp`, localDriver(root))).toBe(0);
  });
});

describe("the Supabase Storage driver", () => {
  function fake() {
    const objects = new Map<string, Buffer>();
    const calls: string[] = [];
    const f = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      calls.push(`${method} ${url.pathname}`);
      const auth = (init?.headers as Record<string, string> | undefined)?.authorization;
      if (url.pathname.startsWith("/storage/v1/object/public/")) {
        if (method !== "HEAD" && method !== "GET") return new Response("", { status: 405 });
        const o = objects.get(url.pathname.replace("/storage/v1/object/public/", ""));
        return o ? new Response(method === "HEAD" ? null : new Uint8Array(o), { status: 200, headers: { "content-length": String(o.length) } }) : new Response("", { status: 404 });
      }
      if (auth !== "Bearer service-key") return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
      const path = url.pathname.replace("/storage/v1/object/", "");
      if (method === "POST" && url.pathname.startsWith("/storage/v1/object/")) {
        if (objects.has(path)) return new Response("{}", { status: 409 });
        objects.set(path, Buffer.from(init!.body as Uint8Array));
        return new Response("{}", { status: 200 });
      }
      if (method === "DELETE") {
        objects.delete(path);
        return new Response("{}", { status: 200 });
      }
      if (url.pathname === "/storage/v1/bucket") return new Response(JSON.stringify({ message: "The resource already exists" }), { status: 400 });
      return new Response("", { status: 404 });
    }) as typeof fetch;
    return { f, objects, calls };
  }

  it("uploads to the bucket under the store's folder and returns the public address", async () => {
    const { f, objects } = fake();
    const d = supabaseDriver({ url: "https://p.supabase.test/", serviceKey: "service-key", fetch: f });
    const img = await saveImage(T, await photo(), d);
    expect(img.url).toMatch(/^https:\/\/p\.supabase\.test\/storage\/v1\/object\/public\/store-media\/tenant_aaaa1111\/[0-9a-f-]{36}\.webp$/);
    expect([...objects.keys()]).toHaveLength(1);
    expect([...objects.keys()][0]).toMatch(/^store-media\/tenant_aaaa1111\//);
  });

  it("removes a photo and reports its size, but only this store's, only from its own bucket", async () => {
    const { f, objects } = fake();
    const d = supabaseDriver({ url: "https://p.supabase.test", serviceKey: "service-key", fetch: f });
    const img = await saveImage(T, await photo(), d);
    expect(await removeImage(OTHER, img.url, d)).toBeNull();
    expect(await removeImage(T, "https://elsewhere.test/storage/v1/object/public/store-media/tenant_aaaa1111/x.webp", d)).toBeNull();
    expect(await removeImage(T, img.url.replace("tenant_aaaa1111", "tenant_aaaa1111/../tenant_bbbb2222"), d)).toBeNull();
    expect(objects.size).toBe(1);
    expect(await removeImage(T, img.url, d)).toBe(img.bytes);
    expect(objects.size).toBe(0);
  });

  it("turns a refused upload into a plain message, never a leaked response", async () => {
    const d = supabaseDriver({ url: "https://p.supabase.test", serviceKey: "wrong-key", fetch: fake().f });
    const e = await saveImage(T, await photo(), d).then(() => null, (x) => x);
    expect(e).toBeInstanceOf(MediaError);
    expect(e.message).not.toMatch(/forbidden|403|key/i);
  });

  it("treats a bucket that already exists as success", async () => {
    await expect(ensureBucket({ url: "https://p.supabase.test", serviceKey: "service-key", fetch: fake().f }, { public: true })).resolves.toBeUndefined();
  });
});

describe("choosing the driver", () => {
  it("is local unless MEDIA_DRIVER=supabase, and asking for Supabase without keys is an error", () => {
    expect(configuredDriver({ MEDIA_DIR: root } as NodeJS.ProcessEnv).name).toBe("local");
    expect(configuredDriver({ MEDIA_DRIVER: "supabase", SUPABASE_URL: "https://p.supabase.test", SUPABASE_SERVICE_ROLE_KEY: "k" } as NodeJS.ProcessEnv).name).toBe("supabase");
    expect(() => configuredDriver({ MEDIA_DRIVER: "supabase" } as NodeJS.ProcessEnv)).toThrow(/SUPABASE_URL/);
  });
});

// The same drivers against the real Supabase project named in .env.local. Opt in with RUN_LIVE_SUPABASE=1.
const live = process.env.RUN_LIVE_SUPABASE === "1" && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
describe.skipIf(!live)("Supabase Storage, for real", () => {
  it("creates the bucket, stores a photo anyone can load, and deletes it", async () => {
    const cfg = { url: process.env.SUPABASE_URL!, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!, bucket: "store-media" };
    await ensureBucket(cfg, { public: true, fileSizeLimit: 4 * 1024 * 1024, mimeTypes: ["image/webp"] });
    const d: StorageDriver = supabaseDriver(cfg);
    const tenant = `live_${Date.now().toString(36)}_test`;
    const img = await saveImage(tenant, await photo(), d);
    const res = await fetch(img.url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/webp");
    expect((await res.arrayBuffer()).byteLength).toBe(img.bytes);
    expect(await removeImage(tenant, img.url, d)).toBe(img.bytes);
    // The object is gone at once, but Supabase's CDN keeps serving a cached copy for a little while (we ask for a year's caching
    // because every photo has its own address). Wait for it to let go, so we know how long that is.
    const started = Date.now();
    let status = 200;
    while (status === 200 && Date.now() - started < 120_000) {
      await new Promise((r) => setTimeout(r, 5000));
      status = (await fetch(`${img.url}?t=${Date.now()}`)).status;
    }
    console.log(`deleted photo stopped being served after about ${Math.round((Date.now() - started) / 1000)} seconds`);
    expect([400, 404]).toContain(status); // Supabase answers 400 "Object not found" for a deleted public photo
  }, 180_000);
});
