// Regenerates every app icon from design/brand/symbol-tile.svg (the "Growth b" tile, design/brand/BRAND.md).
// Usage: node tools/brand-icons.mjs
// Writes: admin and platform icon.svg, the admin PWA icons (192, 512, maskable), apple icons for admin and marketing, and favicon.ico for admin and marketing.
// The storefront icon is left alone: a merchant's store carries the merchant's mark, not ours.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sharp = createRequire(resolve(root, "packages/media/package.json"))("sharp");

const tile = readFileSync(resolve(root, "design/brand/symbol-tile.svg"), "utf8");
const TILE_RECT = '<rect width="1440" height="1440" rx="330" fill="#0B4D3B"/>';
if (!tile.includes(TILE_RECT)) throw new Error("symbol-tile.svg changed shape: update TILE_RECT in tools/brand-icons.mjs");
const symbol = tile.slice(tile.indexOf(TILE_RECT) + TILE_RECT.length, tile.lastIndexOf("</svg>"));

/** The symbol on a full-bleed deep green square, scaled into the middle. Maskable icons keep the mark inside the central 80%; Apple rounds the corners itself. */
const fullBleed = (scale) => {
  const pad = (1440 * (1 - scale)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 1440"><rect width="1440" height="1440" fill="#0B4D3B"/><g transform="translate(${pad} ${pad}) scale(${scale})">${symbol}</g></svg>`;
};
const png = (svg, size) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
const out = (path, data) => {
  const file = resolve(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log("wrote", path, `${data.length} bytes`);
};

/** An .ico that holds PNG images (supported by every current browser). */
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i;
    head.writeUInt8(size === 256 ? 0 : size, at); head.writeUInt8(size === 256 ? 0 : size, at + 1);
    head.writeUInt16LE(1, at + 4); head.writeUInt16LE(32, at + 6);
    head.writeUInt32LE(data.length, at + 8); head.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...images.map((i) => i.data)]);
}

const favicon = ico(await Promise.all([32, 48].map(async (size) => ({ size, data: await png(tile, size) }))));

for (const app of ["admin", "platform"]) out(`apps/${app}/src/app/icon.svg`, tile);
out("apps/admin/public/icons/icon-192.png", await png(tile, 192));
out("apps/admin/public/icons/icon-512.png", await png(tile, 512));
out("apps/admin/public/icons/icon-maskable-512.png", await png(fullBleed(0.72), 512));
out("apps/admin/src/app/apple-icon.png", await png(fullBleed(0.86), 180));
out("apps/marketing/public/apple-touch-icon.png", await png(fullBleed(0.86), 180));
out("apps/admin/public/favicon.ico", favicon);
out("apps/marketing/public/favicon.ico", favicon);
