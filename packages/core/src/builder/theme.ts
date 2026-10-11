import { ValidationError } from "../errors";

/**
 * Theme settings: a few choices that restyle the whole store (docs/06). They become CSS variables on the storefront.
 * Nothing the owner types is ever placed in the page as code: colours are checked as hex, the rest are picked from lists.
 * Text must stay readable: a combination below WCAG AA contrast is refused with a plain message.
 */

export interface ThemeSettings {
  accent: string;
  background: string;
  text: string;
  radius: "sharp" | "soft" | "round";
  font: "sans" | "serif";
}

export const DEFAULT_THEME: ThemeSettings = { accent: "#8C5A3C", background: "#FBF8F3", text: "#2B2118", radius: "soft", font: "sans" };

export const THEME_IDS = ["kapor", "gadgetstudio", "mini-bunny", "axionwear", "bindu"] as const;
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
] as const;

export const isThemeId = (value: unknown): value is ThemeId => typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);

export function validateThemeId(value: unknown): ThemeId {
  if (!isThemeId(value)) throw new ValidationError("Choose a storefront template that is available", { field: "theme" });
  return value;
}

export const themeDefinition = (id: unknown): ThemeDefinition => STORE_THEMES.find((theme) => theme.id === id) ?? STORE_THEMES[0]!;
export const themeDefaults = (id: unknown): ThemeSettings => ({ ...themeDefinition(id).defaults });

export const RADIUS_PX: Record<ThemeSettings["radius"], number> = { sharp: 2, soft: 10, round: 18 };
export const FONT_STACK: Record<ThemeSettings["font"], string> = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Bengali", "Noto Sans", sans-serif',
  serif: 'Georgia, "Noto Serif Bengali", "Times New Roman", serif',
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
    const v = String(o[k] ?? DEFAULT_THEME[k]);
    if (!(allowed as readonly string[]).includes(v)) throw new ValidationError(`${label} is not one of the choices`, { field: k });
    return v as T;
  };
  const out: ThemeSettings = {
    accent: color("accent", "Main colour"),
    background: color("background", "Background"),
    text: color("text", "Text colour"),
    radius: pick("radius", "Corners", ["sharp", "soft", "round"] as const),
    font: pick("font", "Font", ["sans", "serif"] as const),
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
  if (s.font !== d.font) v.push(`--font:${FONT_STACK[s.font]}`);
  return v.length ? `${selector}{${v.join(";")}}` : "";
}
