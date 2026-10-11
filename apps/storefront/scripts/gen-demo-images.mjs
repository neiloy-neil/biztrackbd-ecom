// Generates simple illustrated demo product images (WebP) for the seeded store. Placeholders, not photography.
// Run from apps/storefront (needs sharp):  node scripts/gen-demo-images.mjs
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const OUT = "public/demo";
mkdirSync(OUT, { recursive: true });

// [slug, background, garment, accent, shape]
const items = [
  ["cotton-panjabi-off-white", "#F1E9DD", "#C9B79C", "#8C5A3C", "kurta"],
  ["eid-special-fatua", "#E9DCCB", "#A98B6A", "#2B2118", "kurta"],
  ["linen-shirt-sage", "#E3EBE1", "#9DB596", "#5F7A58", "shirt"],
  ["printed-kurti-rose", "#F5E4E4", "#D49C9C", "#A65D5D", "kurta"],
  ["slim-chino-navy", "#E4E6EC", "#8A91A6", "#3B4260", "trouser"],
  ["cotton-socks-3-pack", "#EFE9E0", "#B9AE9C", "#8C5A3C", "socks"],
];

const W = 900, H = 1200;
const shapes = {
  kurta: (g, a) => `<path d="M300 260 L380 220 Q450 250 520 220 L600 260 L690 420 L610 460 L590 400 L575 900 L325 900 L310 400 L290 460 L210 420 Z" fill="${g}"/><path d="M450 250 L450 520" stroke="${a}" stroke-width="5"/>${[300, 360, 420, 480].map((y) => `<circle cx="450" cy="${y}" r="7" fill="${a}"/>`).join("")}`,
  shirt: (g, a) => `<path d="M290 250 L380 215 Q450 270 520 215 L610 250 L700 440 L620 480 L595 420 L585 880 L315 880 L305 420 L280 480 L200 440 Z" fill="${g}"/><path d="M380 215 L450 330 L520 215" fill="none" stroke="${a}" stroke-width="6"/><path d="M450 330 L450 880" stroke="${a}" stroke-width="3" opacity=".5"/>`,
  trouser: (g, a) => `<path d="M320 220 L580 220 L600 360 L640 960 L520 960 L450 520 L380 960 L260 960 L300 360 Z" fill="${g}"/><path d="M320 220 L580 220" stroke="${a}" stroke-width="10"/><path d="M450 230 L450 520" stroke="${a}" stroke-width="3" opacity=".5"/>`,
  socks: (g, a) => [0, 1, 2].map((i) => `<g transform="translate(${190 + i * 190} 330)"><path d="M0 0 L120 0 L120 330 Q120 420 230 450 Q250 520 180 540 L40 540 Q-10 540 0 470 Z" fill="${g}"/><rect x="0" y="0" width="120" height="50" fill="${a}"/></g>`).join(""),
};

for (const [slug, bg, garment, accent, shape] of items) {
  for (const [i, tilt] of [[1, 0], [2, 1]]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${tilt ? garment : bg}" opacity="${tilt ? 0.28 : 1}"/><rect width="${W}" height="${H}" fill="${bg}" opacity="${tilt ? 0.8 : 0}"/>
<ellipse cx="450" cy="1000" rx="260" ry="30" fill="#000" opacity=".07"/>
<g transform="${tilt ? "translate(450 600) scale(1.25) translate(-450 -600)" : ""}">${shapes[shape](garment, accent)}</g></svg>`;
    await sharp(Buffer.from(svg)).webp({ quality: 78 }).toFile(`${OUT}/${slug}-${i}.webp`);
  }
}
console.log(`wrote ${items.length * 2} images to ${OUT}`);
