import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import sharp, { type Metadata, type OutputInfo } from "sharp";

/**
 * Store photo uploads. Local disk in development; Supabase Storage in production (docs/14), chosen with MEDIA_DRIVER. The
 * browser never chooses a file name or a path, and what is stored is always a fresh WebP made here.
 */

export class MediaError extends Error {
  constructor(message: string, readonly code: "TOO_LARGE" | "NOT_AN_IMAGE" | "UNSUPPORTED" | "TOO_BIG_DIMENSIONS" | "BAD_PATH") {
    super(message);
    this.name = "MediaError";
  }
}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 50_000_000; // 50 megapixels: bigger is a decompression bomb or a mistake
const LONGEST_SIDE = 1600;
// Formats a phone camera or a design tool produces. SVG is refused on purpose: it can carry scripts.
const ALLOWED = new Set(["jpeg", "png", "webp", "avif"]);

/** Where files live. Set MEDIA_DIR in production (a mounted volume). Defaults to .uploads at the repo root. */
export function mediaRoot(env: NodeJS.ProcessEnv = process.env): string {
  return resolve(/*turbopackIgnore: true*/ env.MEDIA_DIR ?? resolve(/*turbopackIgnore: true*/ process.cwd(), "../../.uploads"));
}

export interface SavedImage {
  /** Where pages load it from: /media/<tenantId>/<id>.webp on local disk, or the public Supabase Storage address. */
  url: string;
  bytes: number;
  width: number;
  height: number;
}

const SAFE_ID = /^[A-Za-z0-9_-]{8,64}$/;

// ---- Where the bytes live ---------------------------------------------------------------------------------------------

/**
 * A place to keep finished images. `put` stores the WebP and returns the address pages will use; `remove` deletes by that same
 * address and says how many bytes it freed, so the store's storage meter can go back down.
 */
export interface StorageDriver {
  readonly name: "local" | "supabase";
  put(tenantId: string, id: string, data: Buffer): Promise<string>;
  /** Deletes an image of this store. Returns the bytes freed, or null when the address is not one of this driver's. */
  remove(tenantId: string, url: string): Promise<number | null>;
}

const LOCAL_URL = /^\/media\/([A-Za-z0-9_-]{8,64})\/([A-Za-z0-9_-]{8,64}\.webp)$/;

export function localDriver(root = mediaRoot()): StorageDriver {
  return {
    name: "local",
    async put(tenantId, id, data) {
      const file = resolve(root, tenantId, `${id}.webp`);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, data, { flag: "wx" });
      return `/media/${tenantId}/${id}.webp`;
    },
    async remove(tenantId, url) {
      const m = LOCAL_URL.exec(url);
      // Only this store's own files: an address that names another store's folder is not ours to delete.
      if (!m || m[1] !== tenantId) return null;
      const file = resolve(root, m[1]!, m[2]!);
      if (!file.startsWith(resolve(/*turbopackIgnore: true*/ root) + sep)) return null;
      try {
        const size = (await stat(/*turbopackIgnore: true*/ file)).size;
        await unlink(file);
        return size;
      } catch {
        return 0;
      }
    },
  };
}

export const MEDIA_BUCKET = "store-media";

export interface SupabaseStorageConfig {
  url: string;
  serviceKey: string;
  bucket?: string;
  fetch?: typeof fetch;
}

/** Supabase Storage, through its REST API with the server's service key. The bucket is public: customers load photos straight from it. */
export function supabaseDriver(cfg: SupabaseStorageConfig): StorageDriver {
  const base = cfg.url.replace(/\/+$/, "");
  const bucket = cfg.bucket ?? MEDIA_BUCKET;
  const doFetch = cfg.fetch ?? fetch;
  const headers = { apikey: cfg.serviceKey, authorization: `Bearer ${cfg.serviceKey}` };
  const publicPrefix = `${base}/storage/v1/object/public/${bucket}/`;
  return {
    name: "supabase",
    async put(tenantId, id, data) {
      const path = `${tenantId}/${id}.webp`;
      const res = await doFetch(`${base}/storage/v1/object/${bucket}/${path}`, {
        method: "POST",
        headers: { ...headers, "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable", "x-upsert": "false" },
        body: new Uint8Array(data),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new MediaError("We could not save the photo. Please try again.", "UNSUPPORTED");
      return `${publicPrefix}${path}`;
    },
    async remove(tenantId, url) {
      if (!url.startsWith(publicPrefix)) return null;
      const path = url.slice(publicPrefix.length);
      // A store's folder is its id; anything else is somebody else's.
      const m = /^([A-Za-z0-9_-]{8,64})\/[A-Za-z0-9_-]{8,64}\.webp$/.exec(path);
      if (!m || m[1] !== tenantId) return null;
      const head = await doFetch(`${publicPrefix}${path}`, { method: "HEAD", signal: AbortSignal.timeout(15_000) }).catch(() => null);
      const size = head?.ok ? Number(head.headers.get("content-length") ?? 0) : 0;
      await doFetch(`${base}/storage/v1/object/${bucket}/${path}`, { method: "DELETE", headers, signal: AbortSignal.timeout(15_000) }).catch(() => undefined);
      return size;
    },
  };
}

/**
 * Local disk by default (development and tests). MEDIA_DRIVER=supabase switches to Supabase Storage, which needs SUPABASE_URL
 * and SUPABASE_SERVICE_ROLE_KEY. Asking for Supabase without those is an error, not a quiet fall back to a disk that a
 * serverless host throws away.
 */
export function configuredDriver(env: NodeJS.ProcessEnv = process.env): StorageDriver {
  if (env.MEDIA_DRIVER !== "supabase") return localDriver(mediaRoot(env));
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("MEDIA_DRIVER=supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return supabaseDriver({ url, serviceKey, bucket: env.MEDIA_BUCKET || MEDIA_BUCKET });
}

/** Creates a bucket if it is not there yet. Safe to run again. */
export async function ensureBucket(cfg: SupabaseStorageConfig, opts: { public: boolean; fileSizeLimit?: number; mimeTypes?: string[] }): Promise<void> {
  const base = cfg.url.replace(/\/+$/, "");
  const doFetch = cfg.fetch ?? fetch;
  const id = cfg.bucket ?? MEDIA_BUCKET;
  const res = await doFetch(`${base}/storage/v1/bucket`, {
    method: "POST",
    headers: { apikey: cfg.serviceKey, authorization: `Bearer ${cfg.serviceKey}`, "content-type": "application/json" },
    body: JSON.stringify({ id, name: id, public: opts.public, ...(opts.fileSizeLimit ? { file_size_limit: opts.fileSizeLimit } : {}), ...(opts.mimeTypes ? { allowed_mime_types: opts.mimeTypes } : {}) }),
  });
  if (res.ok || res.status === 409) return;
  if ((await res.text()).toLowerCase().includes("already exists")) return;
  throw new Error(`could not create the bucket ${id} (${res.status})`);
}

export const ensureMediaBucket = (cfg: SupabaseStorageConfig) => ensureBucket(cfg, { public: true, fileSizeLimit: 4 * 1024 * 1024, mimeTypes: ["image/webp"] });

export async function saveImage(tenantId: string, input: Buffer, where: string | StorageDriver = configuredDriver()): Promise<SavedImage> {
  const driver = typeof where === "string" ? localDriver(where) : where;
  if (!SAFE_ID.test(tenantId)) throw new MediaError("Invalid store", "BAD_PATH");
  if (input.length === 0) throw new MediaError("That file is empty.", "NOT_AN_IMAGE");
  if (input.length > MAX_UPLOAD_BYTES) throw new MediaError("That photo is too large. Use one under 8 MB.", "TOO_LARGE");

  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" }).metadata();
  } catch {
    throw new MediaError("That file is not a photo we can read. Use a JPG, PNG or WebP image.", "NOT_AN_IMAGE");
  }
  if (!meta.format || !ALLOWED.has(meta.format)) throw new MediaError("Use a JPG, PNG or WebP image.", "UNSUPPORTED");
  if (!meta.width || !meta.height || meta.width * meta.height > MAX_PIXELS) throw new MediaError("That photo is too large in pixels.", "TOO_BIG_DIMENSIONS");

  // rotate() applies the camera's orientation; sharp drops all metadata (EXIF, GPS location) unless asked to keep it.
  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(input, { limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize({ width: LONGEST_SIDE, height: LONGEST_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new MediaError("That file is not a photo we can read. Use a JPG, PNG or WebP image.", "NOT_AN_IMAGE");
  }

  const url = await driver.put(tenantId, randomUUID(), out.data);
  return { url, bytes: out.data.length, width: out.info.width, height: out.info.height };
}

/** Deletes one of this store's images and returns the bytes freed (null: not an address this driver manages). */
export async function removeImage(tenantId: string, url: string, driver: StorageDriver = configuredDriver()): Promise<number | null> {
  if (!SAFE_ID.test(tenantId)) return null;
  return driver.remove(tenantId, url);
}

const PART = /^[A-Za-z0-9_-]{8,64}$/;
const FILE = /^[A-Za-z0-9_-]{8,64}\.webp$/;

/** Reads a stored image for the /media route. Only <tenantId>/<id>.webp shapes resolve; anything else is a BAD_PATH. */
export async function readImage(segments: string[], root = mediaRoot()): Promise<Buffer | null> {
  if (segments.length !== 2 || !PART.test(segments[0]!) || !FILE.test(segments[1]!)) throw new MediaError("Not found", "BAD_PATH");
  const file = resolve(root, segments[0]!, segments[1]!);
  if (!file.startsWith(resolve(/*turbopackIgnore: true*/ root) + sep)) throw new MediaError("Not found", "BAD_PATH");
  try {
    if (!(await stat(/*turbopackIgnore: true*/ file)).isFile()) return null;
    return await readFile(/*turbopackIgnore: true*/ file);
  } catch {
    return null;
  }
}
