import { ensureBucket, supabaseDriver, type StorageDriver } from "@biztrackbd/media";

/** Public bucket for pictures used in blog guides and covers. Kept apart from the stores' photos (store-media). */
export const BLOG_BUCKET = "blog-media";
/** The media pipeline files pictures under a folder that passes its 8 to 64 character id rule. */
export const BLOG_FOLDER = "platform-blog";

let ready: Promise<void> | null = null;

/**
 * Storage for blog pictures: Supabase Storage with the project's service key. Throws a plain message when it is not configured, so the
 * editor can say so instead of failing quietly. The bucket is created on first use (safe to repeat) and only takes WebP up to 4 MB;
 * the media pipeline always converts uploads to WebP, strips camera data such as GPS, and caps the longest side at 1600 pixels.
 */
export async function blogDriver(env: NodeJS.ProcessEnv = process.env): Promise<StorageDriver> {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Image storage is not set up. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to this app's settings.");
  const cfg = { url, serviceKey, bucket: BLOG_BUCKET };
  ready ??= ensureBucket(cfg, { public: true, fileSizeLimit: 4 * 1024 * 1024, mimeTypes: ["image/webp"] }).catch((e) => {
    ready = null;
    throw e;
  });
  await ready;
  return supabaseDriver(cfg);
}
