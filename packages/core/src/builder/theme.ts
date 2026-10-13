import { ValidationError } from "../errors";

/**
 * Theme settings: a few choices that restyle the whole store (docs/06). They become CSS variables on the storefront.
 * Nothing the owner types is ever placed in the page as code: colours are checked as hex, the rest are picked from lists.
 * Text must stay readable: a combination below WCAG AA contrast is refused with a plain message.
 */

/** Font pairs (a heading font and a body font). Every one reads Bangla: Hind Siliguri or Noto Serif Bengali carries the Bangla letters. */
export const FONT_PAIRS = ["sans", "serif", "editorial", "friendly", "bangla", "bangla-serif"] as const;
export type FontPair = (typeof FONT_PAIRS)[number];

/**
 * The style choices beyond colours (docs/47 part B). Each is a short tested list, and "look" (the first choice) means "leave it as the
 * template's own look has it": nothing is written for it, so a store that never touches these renders exactly as before.
 */
export const STYLE_CHOICES = {
  button: ["look", "filled", "outline", "soft"],
  buttonShape: ["look", "square", "rounded", "pill"],
  buttonSize: ["look", "small", "medium", "large"],
  cardRatio: ["look", "square", "portrait", "tall"],
  cardHover: ["look", "none", "lift"],
  cardsDesktop: ["look", "3", "4"],
  cardsMobile: ["look", "2", "3"],
  spacing: ["look", "tight", "airy"],
  width: ["look", "narrow", "wide"],
} as const;
export type StyleKey = keyof typeof STYLE_CHOICES;
export type StyleChoice<K extends StyleKey> = (typeof STYLE_CHOICES)[K][number];

export interface ThemeSettings {
  accent: string;
  background: string;
  text: string;
  radius: "sharp" | "soft" | "round";
  font: FontPair;
  button?: StyleChoice<"button">;
  buttonShape?: StyleChoice<"buttonShape">;
  buttonSize?: StyleChoice<"buttonSize">;
  cardRatio?: StyleChoice<"cardRatio">;
  cardHover?: StyleChoice<"cardHover">;
  cardsDesktop?: StyleChoice<"cardsDesktop">;
  cardsMobile?: StyleChoice<"cardsMobile">;
  spacing?: StyleChoice<"spacing">;
  width?: StyleChoice<"width">;
}

/** What the editor shows for each style choice: its heading and the words for each option. */
export const STYLE_FIELDS: { group: string; key: StyleKey; label: string; options: Record<string, string> }[] = [
  { group: "Buttons", key: "button", label: "Button style", options: { look: "As the template has it", filled: "Filled", outline: "Outline", soft: "Soft" } },
  { group: "Buttons", key: "buttonShape", label: "Button corners", options: { look: "As the template has it", square: "Square", rounded: "Rounded", pill: "Pill" } },
  { group: "Buttons", key: "buttonSize", label: "Button size", options: { look: "As the template has it", small: "Small", medium: "Medium", large: "Large" } },
  { group: "Product cards", key: "cardRatio", label: "Picture shape", options: { look: "As the template has it", square: "Square", portrait: "Portrait 4:5", tall: "Tall 3:4" } },
  { group: "Product cards", key: "cardHover", label: "When someone points at a product", options: { look: "As the template has it", none: "Nothing moves", lift: "Lifts a little" } },
  { group: "Product cards", key: "cardsDesktop", label: "Products per row on a computer", options: { look: "As the template has it", "3": "3", "4": "4" } },
  { group: "Product cards", key: "cardsMobile", label: "Products per row on a phone", options: { look: "As the template has it", "2": "2", "3": "3" } },
  { group: "Spacing and width", key: "spacing", label: "Space between sections", options: { look: "As the template has it", tight: "Tight", airy: "Airy" } },
  { group: "Spacing and width", key: "width", label: "Page width", options: { look: "As the template has it", narrow: "Narrow", wide: "Wide" } },
];

export const FONT_LABELS: Record<FontPair, string> = {
  sans: "Clean (sans-serif)",
  serif: "Classic (serif)",
  editorial: "Editorial: Playfair headings, clean text",
  friendly: "Friendly: Poppins",
  bangla: "Bangla first: Hind Siliguri",
  "bangla-serif": "Bangla serif: Noto Serif Bengali headings",
};

export const DEFAULT_THEME: ThemeSettings = { accent: "#8C5A3C", background: "#FBF8F3", text: "#2B2118", radius: "soft", font: "sans" };

export const THEME_IDS = ["kapor", "gadgetstudio", "mini-bunny", "axionwear", "bindu", "berber"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  blurb: string;
  audience: string;
  defaults: ThemeSettings;
}

/** The installed storefront templates. Domain features remain separate modules. */
export const STORE_THEMES: readonly ThemeDefinition[] = [
  { id: "kapor", name: "Kapor", blurb: "Warm, editorial and made for fashion.", audience: "Clothing and lifestyle", defaults: DEFAULT_THEME },
  { id: "gadgetstudio", name: "Gadget Studio", blurb: "Crisp product cards and a technical blue palette.", audience: "Electronics and accessories", defaults: { accent: "#155EEF", background: "#F6F8FC", text: "#101828", radius: "soft", font: "sans" } },
  { id: "mini-bunny", name: "Mini Bunny", blurb: "Playful, soft and friendly for growing families.", audience: "Kids, toys and gifts", defaults: { accent: "#C24173", background: "#FFF8F3", text: "#3D2932", radius: "round", font: "sans" } },
  { id: "axionwear", name: "Axion Wear", blurb: "A dark, high-contrast streetwear storefront.", audience: "Sportswear and streetwear", defaults: { accent: "#D7FF3F", background: "#0B0D0F", text: "#F5F7F8", radius: "sharp", font: "sans" } },
  { id: "bindu", name: "Bindu", blurb: "Polished, calm and premium with jewel-toned accents.", audience: "Beauty and lifestyle", defaults: { accent: "#8A2855", background: "#FFF9F7", text: "#321E28", radius: "round", font: "serif" } },
  { id: "berber", name: "Berber", blurb: "Dark, editorial and tailored: serif headings, navy and gold, and a made-to-measure section.", audience: "Formalwear and tailoring", defaults: { accent: "#C9A24B", background: "#0D121E", text: "#F1EDE4", radius: "sharp", font: "serif" } },
] as const;

export const isThemeId = (value: unknown): value is ThemeId => typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);

export function validateThemeId(value: unknown): ThemeId {
  if (!isThemeId(value)) throw new ValidationError("Choose a storefront template that is available", { field: "theme" });
  return value;
}

export const themeDefinition = (id: unknown): ThemeDefinition => STORE_THEMES.find((theme) => theme.id === id) ?? STORE_THEMES[0]!;
export const themeDefaults = (id: unknown): ThemeSettings => ({ ...themeDefinition(id).defaults });

export const RADIUS_PX: Record<ThemeSettings["radius"], number> = { sharp: 2, soft: 10, round: 18 };
/** The text font of each pair. The `--font-*` names are the storefront's self-hosted fonts (next/font), with system fonts behind them. */
export const FONT_STACK: Record<FontPair, string> = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Bengali", "Noto Sans", sans-serif',
  serif: 'Georgia, "Noto Serif Bengali", "Times New Roman", serif',
  editorial: 'var(--font-hind), var(--font-jakarta), system-ui, -apple-system, "Segoe UI", sans-serif',
  friendly: 'var(--font-poppins), var(--font-hind), system-ui, -apple-system, "Segoe UI", sans-serif',
  bangla: 'var(--font-hind), var(--font-jakarta), system-ui, -apple-system, "Segoe UI", sans-serif',
  "bangla-serif": 'var(--font-hind), var(--font-jakarta), system-ui, -apple-system, "Segoe UI", sans-serif',
};
/** The heading font of a pair, when it differs from the text font. */
export const FONT_HEAD_STACK: Partial<Record<FontPair, string>> = {
  editorial: 'var(--font-playfair), Georgia, "Noto Serif Bengali", "Times New Roman", serif',
  "bangla-serif": 'var(--font-notoserifbn), Georgia, "Times New Roman", serif',
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** White or near-black, whichever reads better on this colour (button text on the accent). */
export const inkOn = (bg: string): string => (contrast(bg, "#FFFFFF") >= contrast(bg, "#1A1410") ? "#FFFFFF" : "#1A1410");

/** A darker shade for hover and pressed states. */
export function darken(hex: string, amount = 0.14): string {
  const n = [1, 3, 5].map((i) => Math.max(0, Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount))));
  return `#${n.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function validateTheme(raw: unknown): ThemeSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const color = (k: keyof ThemeSettings, label: string): string => {
    const v = String(o[k] ?? DEFAULT_THEME[k]);
    if (!HEX.test(v)) throw new ValidationError(`${label} must be a colour like #8C5A3C`, { field: k });
    return v.toUpperCase();
  };
  const pick = <T extends string>(k: keyof ThemeSettings, label: string, allowed: readonly T[]): T => {
    const v = String(o[k] ?? DEFAULT_THEME[k] ?? "look");
    if (!(allowed as readonly string[]).includes(v)) throw new ValidationError(`${label} is not one of the choices`, { field: k });
    return v as T;
  };
  const out: ThemeSettings = {
    accent: color("accent", "Main colour"),
    background: color("background", "Background"),
    text: color("text", "Text colour"),
    radius: pick("radius", "Corners", ["sharp", "soft", "round"] as const),
    font: pick("font", "Font", FONT_PAIRS),
    button: pick("button", "Button style", STYLE_CHOICES.button),
    buttonShape: pick("buttonShape", "Button corners", STYLE_CHOICES.buttonShape),
    buttonSize: pick("buttonSize", "Button size", STYLE_CHOICES.buttonSize),
    cardRatio: pick("cardRatio", "Picture shape", STYLE_CHOICES.cardRatio),
    cardHover: pick("cardHover", "Product hover", STYLE_CHOICES.cardHover),
    cardsDesktop: pick("cardsDesktop", "Products per row", STYLE_CHOICES.cardsDesktop),
    cardsMobile: pick("cardsMobile", "Products per row on a phone", STYLE_CHOICES.cardsMobile),
    spacing: pick("spacing", "Spacing", STYLE_CHOICES.spacing),
    width: pick("width", "Page width", STYLE_CHOICES.width),
  };
  if (contrast(out.text, out.background) < 4.5) throw new ValidationError("Your text colour is hard to read on that background. Pick colours that are further apart.", { field: "text" });
  // The accent is used as text on the page too (links, prices), so it must read on the background as well.
  if (contrast(out.accent, out.background) < 3) throw new ValidationError("Your main colour is too close to the background. Customers would struggle to see buttons and links.", { field: "accent" });
  return out;
}

/** The CSS the storefront injects. Only validated values reach it. */
export function themeCss(t: ThemeSettings, selector = ":root"): string {
  const s = validateTheme(t);
  const d = DEFAULT_THEME;
  const v: string[] = [];
  // Only what differs from the built-in look is written, so an untouched theme renders exactly as before.
  if (s.accent !== d.accent) v.push(`--accent:${s.accent}`, `--accent-strong:${darken(s.accent, 0.25)}`, `--accent-ink:${inkOn(s.accent)}`);
  if (s.background !== d.background) v.push(`--bg:${s.background}`);
  if (s.text !== d.text) v.push(`--ink:${s.text}`);
  if (s.radius !== d.radius) v.push(`--radius:${RADIUS_PX[s.radius]}px`);
  const out: string[] = v.length ? [`${selector}{${v.join(";")}}`] : [];
  // The font pair is written with the weight of a template's own look, so a pair chosen here wins over the font a template sets for itself.
  if (s.font !== d.font) out.push(`${P}{--font:${FONT_STACK[s.font]};--font-head:${FONT_HEAD_STACK[s.font] ?? FONT_STACK[s.font]}}`);
  out.push(...styleRules(s));
  return out.join("");
}

// The rules for the style choices. They start with `body[data-store-theme]` so they win over a template's own look (themes.css), and each one
// is written only when the merchant picked something other than "as the template has it".
const P = "body[data-store-theme]";
export function styleRules(s: ThemeSettings): string[] {
  const r: string[] = [];
  const btn: Record<string, string> = {
    filled: `${P} .btn-primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}`,
    outline: `${P} .btn-primary{background:transparent;color:var(--accent);border-color:var(--accent)}${P} .btn-primary:hover{background:var(--accent);color:var(--accent-ink)}`,
    soft: `${P} .btn-primary{background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent);border-color:transparent}${P} .btn-primary:hover{background:color-mix(in srgb,var(--accent) 24%,transparent)}`,
  };
  if (s.button && btn[s.button]) r.push(btn[s.button]!);
  const shape: Record<string, string> = { square: "0", rounded: "8px", pill: "999px" };
  if (s.buttonShape && shape[s.buttonShape]) r.push(`${P} .btn,${P} .btn-round{border-radius:${shape[s.buttonShape]}}`);
  const size: Record<string, string> = {
    small: "min-height:42px;padding:0 20px;font-size:14px", medium: "min-height:52px;padding:0 28px;font-size:15px", large: "min-height:60px;padding:0 36px;font-size:16.5px",
  };
  if (s.buttonSize && size[s.buttonSize]) r.push(`${P} .btn,${P} .btn-round{${size[s.buttonSize]}}`);
  const ratio: Record<string, string> = { square: "1 / 1", portrait: "4 / 5", tall: "3 / 4" };
  if (s.cardRatio && ratio[s.cardRatio]) r.push(`${P} .pcard .pimg{aspect-ratio:${ratio[s.cardRatio]}}`);
  if (s.cardHover === "none") r.push(`${P} .pcard,${P} .pcard:hover{transition:none;transform:none;box-shadow:none}`);
  if (s.cardHover === "lift") r.push(`${P} .pcard{transition:transform .2s ease,box-shadow .2s ease}${P} .pcard:hover{transform:translateY(-4px);box-shadow:0 14px 30px rgba(0,0,0,.14)}`);
  if (s.cardsDesktop === "3") r.push(`@media(min-width:700px){${P} .grid,${P} .grid-4{grid-template-columns:repeat(3,minmax(0,1fr))}}`);
  if (s.cardsDesktop === "4") r.push(`@media(min-width:1000px){${P} .grid,${P} .grid-4{grid-template-columns:repeat(4,minmax(0,1fr))}}`);
  if (s.cardsMobile === "3") r.push(`@media(max-width:699px){${P} .grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}}`);
  if (s.cardsMobile === "2") r.push(`@media(max-width:699px){${P} .grid{grid-template-columns:repeat(2,minmax(0,1fr))}}`);
  if (s.spacing === "tight") r.push(`${P} .section,${P} .lp-block{padding-top:24px}@media(min-width:900px){${P} .section,${P} .lp-block{padding-top:40px}}`);
  if (s.spacing === "airy") r.push(`${P} .section,${P} .lp-block{padding-top:56px}@media(min-width:900px){${P} .section,${P} .lp-block{padding-top:96px}}`);
  if (s.width === "narrow") r.push(`${P} .wrap:not(.lp-narrow){max-width:1040px}`);
  if (s.width === "wide") r.push(`${P} .wrap:not(.lp-narrow){max-width:1400px}`);
  return r;
}
