import { configuredDriver, saveImage, svgToPng } from "@biztrackbd/media";

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
