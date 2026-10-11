import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, MediaError, readImage, saveImage } from "../src";

const TENANT = "tenant-abcdefgh";
let root: string;
beforeAll(async () => { root = await mkdtemp(join(tmpdir(), "bt-media-")); });
afterAll(async () => { await rm(root, { recursive: true, force: true }); });

const png = (w = 100, h = 80) => sharp({ create: { width: w, height: h, channels: 3, background: "#C9B79C" } }).png().toBuffer();
const fails = async (p: Promise<unknown>, code: string) => {
  const e = await p.then(() => null, (x) => x);
  expect(e).toBeInstanceOf(MediaError);
  expect((e as MediaError).code).toBe(code);
};

describe("saving photos", () => {
  it("converts to WebP, names it itself, and returns a public path", async () => {
    const r = await saveImage(TENANT, await png(), root);
    expect(r.url).toMatch(new RegExp(`^/media/${TENANT}/[0-9a-f-]{36}\\.webp$`));
    expect(r).toMatchObject({ width: 100, height: 80 });
    const back = await readImage(r.url.replace("/media/", "").split("/"), root);
    expect((await sharp(back!).metadata()).format).toBe("webp");
  });

  it("shrinks big photos to 1600px on the long side and never enlarges small ones", async () => {
    const big = await saveImage(TENANT, await png(4000, 3000), root);
    expect(big.width).toBe(1600);
    expect(big.height).toBe(1200);
    expect((await saveImage(TENANT, await png(300, 200), root)).width).toBe(300);
  });

  it("applies camera rotation and strips location data", async () => {
    const withExif = await sharp({ create: { width: 200, height: 100, channels: 3, background: "#ffffff" } })
      .jpeg()
      .withMetadata({ orientation: 6, exif: { IFD3: { GPSLatitudeRef: "N", GPSLatitude: "23/1 48/1 0/1" } } })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined(); // the test photo really carries location data
    const r = await saveImage(TENANT, withExif, root);
    expect([r.width, r.height]).toEqual([100, 200]); // rotated to upright
    const back = await readImage(r.url.replace("/media/", "").split("/"), root);
    expect((await sharp(back!).metadata()).exif).toBeUndefined();
  });

  it("refuses files that are not photos", async () => {
    await fails(saveImage(TENANT, Buffer.from("hello world"), root), "NOT_AN_IMAGE");
    await fails(saveImage(TENANT, Buffer.alloc(0), root), "NOT_AN_IMAGE");
    await fails(saveImage(TENANT, Buffer.from("<html><script>alert(1)</script></html>"), root), "NOT_AN_IMAGE");
    await fails(saveImage(TENANT, Buffer.from("%PDF-1.4 fake"), root), "NOT_AN_IMAGE");
  });

  it("refuses SVG, which can carry scripts", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script><rect width="10" height="10"/></svg>');
    await fails(saveImage(TENANT, svg, root), "UNSUPPORTED");
  });

  it("refuses oversized uploads and pixel bombs", async () => {
    await fails(saveImage(TENANT, Buffer.alloc(MAX_UPLOAD_BYTES + 1, 1), root), "TOO_LARGE");
    const bomb = await sharp({ create: { width: 9000, height: 9000, channels: 3, background: "#000000" } }).png({ compressionLevel: 9 }).toBuffer();
    await fails(saveImage(TENANT, bomb, root), "NOT_AN_IMAGE"); // beyond the pixel limit the decoder refuses it
  });

  it("will not write outside its folder for a hostile store id", async () => {
    for (const bad of ["../evil", "a/b", "", "short", "x".repeat(80), "..\\..\\win"]) await fails(saveImage(bad, await png(), root), "BAD_PATH");
    expect((await readdir(root)).every((n) => n === TENANT)).toBe(true);
  });
});

describe("reading photos", () => {
  it("only serves <store>/<id>.webp", async () => {
    const bad = [["..", "etc", "passwd"], [TENANT, "..%2f..%2fsecret.webp"], [TENANT, "a.png"], [TENANT], [TENANT, "x", "y.webp"], ["..", "x.webp"], [TENANT, "..\\..\\x.webp"], [TENANT, "short.webp"]];
    for (const segs of bad) await expect(readImage(segs, root), segs.join("/")).rejects.toBeInstanceOf(MediaError);
  });

  it("returns null for a file that does not exist", async () => {
    expect(await readImage([TENANT, "00000000-0000-0000-0000-000000000000.webp"], root)).toBeNull();
  });
});
