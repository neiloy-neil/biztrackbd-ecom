// One-off: draws the app icons (a brand-coloured rounded square with a B) as PNG. Run: node scripts-icons.mjs
import sharp from "sharp";
for (const size of [192, 512]) {
  const r = Math.round(size * 0.22);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#5B4FE8"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${Math.round(size * 0.58)}" fill="#fff">B</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`public/icons/icon-${size}.png`);
}
// maskable: full-bleed background so launchers can crop it into any shape
const m = 512;
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${m}" height="${m}"><rect width="${m}" height="${m}" fill="#5B4FE8"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${Math.round(m * 0.42)}" fill="#fff">B</text></svg>`)).png().toFile("public/icons/icon-maskable-512.png");
console.log("icons written");
