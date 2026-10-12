import { configuredDriver, readImage, saveImage, svgToPng } from "@biztrackbd/media";

/**
 * Draws and stores the picture for each sample product a new store starts with (docs/38). The drawing is SVG; it is turned into a
 * raster picture here and the media pipeline makes the final WebP. Returns null when picture storage is not set up, so signup still works.
 */
export function samplePictures(): { rasterize(svg: string): Promise<Buffer>; save(tenantId: string, picture: Buffer): Promise<{ url: string }> } | null {
  let driver;
  try {
    driver = configuredDriver();
  } catch {
    return null;
  }
  return {
    rasterize: svgToPng,
    save: async (tenantId, picture) => ({ url: (await saveImage(tenantId, picture, driver)).url }),
  };
}

/**
 * Copies one of a demo store's pictures into a new store (docs/41). Only pictures from our own storage are fetched: a local /media path in
 * development, or the project's public media bucket in production. Anything else is refused, so this cannot be pointed at other addresses.
 */
export function keepPictureCopier(): ((tenantId: string, url: string) => Promise<string>) | null {
  let driver;
  try {
    driver = configuredDriver();
  } catch {
    return null;
  }
  const bucket = process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/store-media/` : null;
  return async (tenantId, url) => {
    let bytes: Buffer;
    if (url.startsWith("/media/")) {
      const b = await readImage(url.slice("/media/".length).split("/"));
      if (!b) throw new Error("picture not found");
      bytes = b;
    } else if (bucket && url.startsWith(bucket)) {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error("picture not reachable");
      const len = Number(res.headers.get("content-length") ?? 0);
      if (len > 8 * 1024 * 1024) throw new Error("picture too large");
      bytes = Buffer.from(await res.arrayBuffer());
    } else {
      throw new Error("not one of our pictures");
    }
    return (await saveImage(tenantId, bytes, driver)).url;
  };
}
