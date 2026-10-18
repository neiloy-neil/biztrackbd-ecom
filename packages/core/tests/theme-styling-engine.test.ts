import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  FONT_PAIRS,
  FONT_STACK,
  RADIUS_PX,
  STYLE_CHOICES,
  THEME_PALETTES,
  THEME_RADII,
  contrast,
  themeCss,
  validateTheme,
  type ThemeSettings,
} from "../src/builder/theme";

describe("Global Theme Styling Engine & Brand Design System", () => {
  it("has 10 curated brand palettes with verified WCAG contrast", () => {
    expect(THEME_PALETTES.length).toBe(10);

    for (const palette of THEME_PALETTES) {
      expect(palette.id).toBeTruthy();
      expect(palette.name).toBeTruthy();
      expect(palette.nameBn).toBeTruthy();
      expect(palette.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(palette.background).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(palette.text).toMatch(/^#[0-9A-Fa-f]{6}$/);

      // Contrast requirements: Text >= 4.5:1, Accent >= 3.0:1 on background
      const textContrast = contrast(palette.text, palette.background);
      const accentContrast = contrast(palette.accent, palette.background);

      expect(textContrast).toBeGreaterThanOrEqual(4.5);
      expect(accentContrast).toBeGreaterThanOrEqual(3.0);
    }
  });

  it("validates and applies curated palettes seamlessly", () => {
    for (const palette of THEME_PALETTES) {
      const theme = validateTheme({
        accent: palette.accent,
        background: palette.background,
        text: palette.text,
        radius: palette.recommendedRadius ?? "soft",
        font: palette.recommendedFont ?? "sans",
        paletteId: palette.id,
      });

      expect(theme.accent).toBe(palette.accent.toUpperCase());
      expect(theme.background).toBe(palette.background.toUpperCase());
      expect(theme.text).toBe(palette.text.toUpperCase());
      expect(theme.paletteId).toBe(palette.id);
    }
  });

  it("supports all expanded corner radii (none, sharp, subtle, soft, rounded, round, pill)", () => {
    expect(THEME_RADII).toEqual(["none", "sharp", "subtle", "soft", "rounded", "round", "pill"]);
    expect(RADIUS_PX.none).toBe(0);
    expect(RADIUS_PX.subtle).toBe(6);
    expect(RADIUS_PX.rounded).toBe(16);
    expect(RADIUS_PX.pill).toBe(999);

    for (const r of THEME_RADII) {
      const theme = validateTheme({ ...DEFAULT_THEME, radius: r });
      expect(theme.radius).toBe(r);
      const css = themeCss(theme);
      if (r !== DEFAULT_THEME.radius) {
        expect(css).toContain(`--radius:${RADIUS_PX[r]}px`);
      }
    }
  });

  it("supports expanded font pairs including corporate modern and bold display", () => {
    expect(FONT_PAIRS).toContain("bangla-modern");
    expect(FONT_PAIRS).toContain("bold-display");

    const modernTheme = validateTheme({ ...DEFAULT_THEME, font: "bangla-modern" });
    expect(modernTheme.font).toBe("bangla-modern");
    const modernCss = themeCss(modernTheme);
    expect(modernCss).toContain("--font-notosansbn");

    const boldTheme = validateTheme({ ...DEFAULT_THEME, font: "bold-display" });
    expect(boldTheme.font).toBe("bold-display");
    const boldCss = themeCss(boldTheme);
    expect(boldCss).toContain("--font-baloo");
  });

  it("generates CSS for elevated button style and card border treatments", () => {
    expect(STYLE_CHOICES.button).toContain("elevated");
    expect(STYLE_CHOICES.cardBorder).toEqual(["look", "none", "hairline", "elevated"]);

    const styledTheme = validateTheme({
      ...DEFAULT_THEME,
      button: "elevated",
      cardBorder: "elevated",
    });

    const css = themeCss(styledTheme);
    expect(css).toContain(".btn-primary{background:var(--accent)");
    expect(css).toContain("box-shadow:0 4px 14px");
    expect(css).toContain(".pcard,body[data-store-theme] .bt-card-mode{border:1px solid rgba(0,0,0,0.05)");
  });

  it("strictly refuses low contrast color combinations with descriptive errors", () => {
    // Unreadable white text on white background
    expect(() =>
      validateTheme({
        accent: "#000000",
        background: "#FFFFFF",
        text: "#F0F0F0",
        radius: "soft",
        font: "sans",
      })
    ).toThrowError(/Your text colour is hard to read on that background/);

    // Accent too close to background
    expect(() =>
      validateTheme({
        accent: "#F5F5F5",
        background: "#FFFFFF",
        text: "#000000",
        radius: "soft",
        font: "sans",
      })
    ).toThrowError(/Your main colour is too close to the background/);
  });
});
