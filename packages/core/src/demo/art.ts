/**
 * Brand-neutral product illustrations for the template demo stores (docs/38). Plain geometric SVG drawn here, no stock photos and
 * no licences. They are turned into WebP by the media pipeline before they are stored, so the SVG itself is never served.
 */

export type ArtKind =
  | "kurta" | "shirt" | "pants" | "dress" | "scarf" | "bag"
  | "earbuds" | "powerbank" | "watch" | "cable" | "speaker" | "phonestand"
  | "teddy" | "blocks" | "toycar" | "onesie" | "puzzle" | "bottle"
  | "blazer" | "waistcoat" | "tie"
  | "tee" | "hoodie" | "joggers" | "cap" | "sneaker" | "shorts"
  | "serum" | "jar" | "lipstick" | "tube" | "perfume" | "palette";

export interface Palette { bg: string; main: string; accent: string; ink: string }

type Draw = (p: Palette) => string;
const r = (x: number, y: number, w: number, h: number, fill: string, rx = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
const c = (cx: number, cy: number, rad: number, fill: string) => `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${fill}"/>`;
const p = (d: string, fill: string, extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`;
const l = (d: string, stroke: string, w = 6) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

// Every drawing fits a 400 x 500 box and is centred in it.
const SHAPES: Record<ArtKind, Draw> = {
  kurta: (k) => p("M130 90 L170 70 Q200 95 230 70 L270 90 L330 150 L300 190 L270 160 L275 400 L125 400 L130 160 L100 190 L70 150 Z", k.main) + l("M200 95 L200 215", k.accent, 5) + c(200, 135, 5, k.accent) + c(200, 175, 5, k.accent) + c(200, 215, 5, k.accent),
  shirt: (k) => p("M140 85 L180 75 L200 105 L220 75 L260 85 L330 140 L300 190 L275 165 L278 405 L122 405 L125 165 L100 190 L70 140 Z", k.main) + p("M180 75 L200 105 L220 75 L200 140 Z", k.accent) + l("M200 140 L200 400", k.accent, 3),
  pants: (k) => r(120, 70, 160, 40, k.accent, 6) + p("M120 110 L280 110 L300 420 L215 420 L200 190 L185 420 L100 420 Z", k.main) + l("M200 110 L200 190", k.accent, 4),
  dress: (k) => p("M165 70 L235 70 L240 150 L300 420 L100 420 L160 150 Z", k.main) + r(160, 140, 80, 14, k.accent, 4) + l("M165 70 Q200 110 235 70", k.accent, 5),
  scarf: (k) => p("M90 120 Q200 60 310 120 L310 190 Q200 130 90 190 Z", k.main) + p("M250 170 L310 190 L330 400 L270 410 Z", k.accent) + p("M150 150 L90 190 L70 390 L130 400 Z", k.accent),
  bag: (k) => l("M150 180 Q150 90 200 90 Q250 90 250 180", k.accent, 12) + r(100, 170, 200, 220, k.main, 22) + r(100, 230, 200, 18, k.accent) + c(200, 290, 12, k.accent),
  earbuds: (k) => r(110, 110, 180, 270, k.main, 60) + r(110, 250, 180, 6, k.accent) + c(165, 180, 30, k.accent) + c(235, 180, 30, k.accent) + c(165, 180, 12, k.ink) + c(235, 180, 12, k.ink),
  powerbank: (k) => r(120, 80, 160, 330, k.main, 28) + r(145, 120, 110, 16, k.accent, 8) + r(145, 150, 110, 16, k.accent, 8) + r(145, 180, 70, 16, k.accent, 8) + c(200, 360, 14, k.ink),
  watch: (k) => r(165, 40, 70, 90, k.accent, 12) + r(165, 370, 70, 90, k.accent, 12) + r(120, 130, 160, 240, k.main, 44) + r(138, 150, 124, 200, k.ink, 30) + l("M200 200 L200 250 L235 270", k.accent, 8),
  cable: (k) => l("M90 380 C90 200 310 360 310 160", k.main, 16) + r(60, 370, 60, 60, k.accent, 8) + r(285, 100, 50, 70, k.accent, 8) + r(296, 76, 10, 24, k.ink) + r(314, 76, 10, 24, k.ink),
  speaker: (k) => r(110, 140, 180, 250, k.main, 30) + c(200, 260, 58, k.ink) + c(200, 260, 26, k.accent) + c(200, 190, 10, k.accent),
  phonestand: (k) => p("M110 410 L170 410 L290 120 L240 100 Z", k.main) + r(100, 395, 200, 24, k.accent, 10) + r(215, 110, 100, 190, k.ink, 14).replace("<rect", `<rect transform="rotate(14 265 205)"`),
  teddy: (k) => c(130, 120, 42, k.main) + c(270, 120, 42, k.main) + c(200, 175, 82, k.main) + c(200, 330, 100, k.main) + c(200, 195, 34, k.accent) + c(172, 160, 9, k.ink) + c(228, 160, 9, k.ink) + c(200, 190, 9, k.ink) + c(200, 340, 46, k.accent),
  blocks: (k) => r(100, 290, 100, 100, k.main, 8) + r(200, 290, 100, 100, k.accent, 8) + r(150, 190, 100, 100, k.ink, 8) + c(200, 240, 26, k.bg),
  toycar: (k) => r(70, 270, 260, 80, k.main, 24) + p("M120 270 L160 190 L260 190 L300 270 Z", k.main) + p("M135 262 L168 202 L200 202 L200 262 Z", k.bg) + p("M212 262 L212 202 L254 202 L284 262 Z", k.bg) + c(130, 355, 36, k.ink) + c(270, 355, 36, k.ink) + c(130, 355, 14, k.accent) + c(270, 355, 14, k.accent),
  onesie: (k) => p("M140 80 L175 70 Q200 100 225 70 L260 80 L320 130 L290 170 L265 150 L270 300 L300 410 L100 410 L130 300 L135 150 L110 170 L80 130 Z", k.main) + c(200, 220, 30, k.accent) + l("M130 410 L200 330 L270 410", k.accent, 5),
  puzzle: (k) => r(100, 120, 100, 100, k.main, 6) + r(200, 120, 100, 100, k.accent, 6) + r(100, 220, 100, 100, k.accent, 6) + r(200, 220, 100, 100, k.main, 6) + c(200, 170, 18, k.accent) + c(250, 220, 18, k.main) + c(150, 220, 18, k.accent) + c(200, 270, 18, k.main),
  bottle: (k) => r(170, 50, 60, 50, k.accent, 8) + r(150, 100, 100, 330, k.main, 34) + r(150, 220, 100, 110, k.accent, 0) + c(200, 275, 24, k.bg),
  blazer: (k) => p("M130 85 L270 85 L292 420 L108 420 Z", k.main) + p("M130 85 L92 102 L66 330 L108 342 L136 150 Z", k.main) + p("M270 85 L308 102 L334 330 L292 342 L264 150 Z", k.main) + p("M176 85 L224 85 L200 235 Z", "#F3F1EA") + p("M176 85 L200 235 L158 205 L148 100 Z", k.accent) + p("M224 85 L200 235 L242 205 L252 100 Z", k.accent) + c(200, 300, 6, k.ink) + c(200, 350, 6, k.ink) + l("M226 285 L268 285", k.accent, 4),
  waistcoat: (k) => p("M140 80 L186 80 L200 135 L214 80 L260 80 L276 140 L266 405 L134 405 L124 140 Z", k.main) + p("M186 80 L200 135 L214 80 Z", "#F3F1EA") + c(200, 175, 6, k.ink) + c(200, 220, 6, k.ink) + c(200, 265, 6, k.ink) + c(200, 310, 6, k.ink) + l("M150 300 L180 300 M220 300 L250 300", k.accent, 4),
  tie: (k) => r(182, 70, 36, 46, k.main, 8) + p("M176 114 L224 114 L246 345 L200 395 L154 345 Z", k.main) + l("M168 200 L232 180 M162 250 L238 230 M158 300 L242 280", k.accent, 6),
  tee: (k) => p("M140 85 L180 70 Q200 100 220 70 L260 85 L340 150 L305 200 L275 170 L278 410 L122 410 L125 170 L95 200 L60 150 Z", k.main) + p("M180 70 Q200 100 220 70", k.accent, `stroke="${k.accent}" stroke-width="10"`) + r(160, 210, 80, 8, k.accent, 4) + r(175, 232, 50, 8, k.accent, 4),
  hoodie: (k) => p("M135 90 Q200 40 265 90 L335 160 L300 215 L275 185 L280 410 L120 410 L125 185 L100 215 L65 160 Z", k.main) + p("M150 95 Q200 150 250 95 Q200 60 150 95 Z", k.ink) + r(145, 300, 110, 70, k.accent, 14) + l("M185 140 L185 215 M215 140 L215 215", k.accent, 5),
  joggers: (k) => r(120, 70, 160, 46, k.accent, 8) + p("M120 116 L280 116 L292 400 L218 400 L200 210 L182 400 L108 400 Z", k.main) + r(100, 380, 90, 30, k.accent, 8) + r(210, 380, 90, 30, k.accent, 8) + l("M170 116 L170 150 M230 116 L230 150", k.ink, 5),
  cap: (k) => p("M90 290 Q90 130 200 130 Q310 130 310 290 Z", k.main) + p("M80 290 L340 290 Q350 320 300 330 L120 330 Q70 320 80 290 Z", k.accent) + c(200, 140, 12, k.ink) + l("M200 140 L200 285", k.accent, 3),
  sneaker: (k) => p("M70 300 L70 240 Q130 250 170 200 L200 215 Q240 225 270 250 Q330 270 340 320 L340 350 L70 350 Z", k.main) + r(60, 345, 290, 36, k.accent, 14) + l("M175 215 L200 255 M205 222 L230 260 M235 232 L258 268", k.ink, 6) + p("M70 300 L70 345 L150 345 L150 300 Z", k.ink),
  shorts: (k) => r(120, 100, 160, 42, k.accent, 8) + p("M120 142 L280 142 L305 340 L212 340 L200 240 L188 340 L95 340 Z", k.main) + l("M180 142 L180 175 M220 142 L220 175", k.ink, 5),
  serum: (k) => r(180, 50, 40, 40, k.ink, 6) + p("M185 90 L215 90 L215 130 L185 130 Z", k.accent) + r(145, 130, 110, 280, k.main, 26) + r(160, 230, 80, 90, k.bg, 8) + l("M170 262 L230 262 M170 285 L215 285", k.ink, 4),
  jar: (k) => r(115, 150, 170, 60, k.accent, 14) + r(125, 210, 150, 160, k.main, 30) + r(150, 265, 100, 50, k.bg, 8),
  lipstick: (k) => p("M175 90 L225 90 L225 220 L175 220 Z", k.main) + p("M175 90 Q200 40 225 90 Z", k.main) + r(160, 220, 80, 40, k.accent, 6) + r(150, 260, 100, 150, k.ink, 10) + l("M175 300 L225 300", k.accent, 4),
  tube: (k) => p("M150 90 L250 90 L240 360 L160 360 Z", k.main) + r(160, 360, 80, 50, k.accent, 8) + r(165, 160, 70, 90, k.bg, 8) + l("M150 90 L250 90", k.accent, 10),
  perfume: (k) => r(170, 60, 60, 60, k.ink, 8) + r(185, 120, 30, 30, k.accent) + r(115, 150, 170, 250, k.main, 36) + r(145, 220, 110, 90, k.bg, 8) + c(200, 265, 20, k.accent),
  palette: (k) => r(90, 130, 220, 250, k.ink, 24) + c(150, 200, 34, k.main) + c(250, 200, 34, k.accent) + c(150, 300, 34, k.accent) + c(250, 300, 34, k.main),
};

export const ART_KINDS = Object.keys(SHAPES) as ArtKind[];

/** A 800 x 1000 product picture: soft background, a ground shadow, the drawing. */
export function productSvg(kind: ArtKind, palette: Palette): string {
  const art = SHAPES[kind](palette);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">`
    + `<rect width="800" height="1000" fill="${palette.bg}"/>`
    + `<circle cx="400" cy="440" r="330" fill="${palette.accent}" fill-opacity="0.12"/>`
    + `<ellipse cx="400" cy="860" rx="220" ry="26" fill="#000" fill-opacity="0.10"/>`
    + `<g transform="translate(0 130) scale(2)">${art}</g></svg>`;
}

/** A 1600 x 700 wide picture for a hero or a banner: a calm composition in the template's colours. */
export function bannerSvg(palette: Palette, kinds: ArtKind[]): string {
  const items = kinds.slice(0, 3).map((k, i) => `<g transform="translate(${1000 + i * 190 - (kinds.length > 2 ? 60 : 0)} ${90 + (i % 2) * 40}) scale(0.62)">${SHAPES[k](palette)}</g>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="700" viewBox="0 0 1600 700">`
    + `<rect width="1600" height="700" fill="${palette.bg}"/>`
    + `<circle cx="1180" cy="330" r="420" fill="${palette.accent}" fill-opacity="0.14"/>`
    + `<circle cx="250" cy="620" r="260" fill="${palette.main}" fill-opacity="0.10"/>`
    + `${items}</svg>`;
}
