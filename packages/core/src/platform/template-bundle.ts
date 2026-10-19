import { z } from "zod";
import { validatePage, STORE_PAGE_KINDS, type PageJson, type PageKind } from "../builder/registry";
import { isThemeId, validateTheme, type ThemeId, type ThemeSettings } from "../builder/theme";
import { templateChrome } from "../builder/template-chromes";
import type { Chrome } from "../builder/chrome";
import { ValidationError } from "../errors";
import type { CustomPageManifest } from "../site/templates/manifests";
import type { SiteMode, BusinessVertical } from "../site/mode";

/**
 * The template file platform staff upload (and download from an existing template). One JSON document carries everything a template is:
 * its look and colours, a layout for each page, the header and footer, the pages of a business site, and preview pictures. Nothing in it is
 * trusted: every part goes through the same validators the visual editor uses, so a file cannot put script or a bad link on a store.
 */

export const TEMPLATE_BUNDLE_FORMAT = "biztrack-template";
export const TEMPLATE_BUNDLE_VERSION = 1;
export const MAX_TEMPLATE_BUNDLE_BYTES = 1_000_000;

export const BUNDLE_CATEGORIES = ["fashion", "electronics", "kids", "streetwear", "beauty", "other"] as const;
export const BUNDLE_SITE_MODES = ["ECOMMERCE", "PORTFOLIO", "HYBRID"] as const;
export const BUNDLE_VERTICALS = ["RESTAURANT", "DOCTOR_CLINIC", "PUBLIC_FIGURE", "BUSINESS_COMPANY", "SERVICE_PROVIDER", "PERSONAL_PORTFOLIO"] as const;

const TEMPLATE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const httpsUrl = z.string().url().max(500).refine((u) => u.startsWith("https://"), "Preview pictures must be https:// links");

const Header = z.object({
  format: z.literal(TEMPLATE_BUNDLE_FORMAT),
  formatVersion: z.literal(TEMPLATE_BUNDLE_VERSION),
  id: z.string().min(3).max(40).regex(TEMPLATE_ID, "The id can use small letters, numbers and dashes, like eid-kapor"),
  name: z.string().trim().min(2).max(60),
  blurb: z.string().trim().max(200).default(""),
  audience: z.string().trim().max(80).default(""),
  category: z.enum(BUNDLE_CATEGORIES).default("other"),
  tags: z.array(z.string().trim().min(1).max(30)).max(4).default([]),
  moduleLabel: z.string().trim().max(40).nullable().default(null),
  baseLook: z.string(),
  siteMode: z.enum(BUNDLE_SITE_MODES).default("ECOMMERCE"),
  vertical: z.enum(BUNDLE_VERTICALS).optional(),
  previews: z.object({ desktop: httpsUrl.optional(), mobile: httpsUrl.optional() }).default({}),
  settings: z.unknown(),
  pages: z.record(z.unknown()).default({}),
  chrome: z.unknown().optional(),
  customPages: z.array(z.unknown()).max(12).default([]),
});

export interface TemplateBundle {
  id: string;
  name: string;
  blurb: string;
  audience: string;
  category: (typeof BUNDLE_CATEGORIES)[number];
  tags: string[];
  moduleLabel: string | null;
  baseLook: ThemeId;
  siteMode: SiteMode;
  vertical?: BusinessVertical;
  previews: { desktop?: string; mobile?: string };
  settings: ThemeSettings;
  pages: Partial<Record<PageKind, PageJson>>;
  chrome: Chrome | null;
  customPages: CustomPageManifest[];
}

const where = (label: string, fn: () => unknown): unknown => {
  try { return fn(); } catch (e) { throw new ValidationError(`${label}: ${e instanceof Error ? e.message : "not valid"}`); }
};

/** Reads and checks an uploaded template file. Throws a ValidationError that says which part is wrong. */
export function parseTemplateBundle(text: string): TemplateBundle {
  if (text.length > MAX_TEMPLATE_BUNDLE_BYTES) throw new ValidationError("The template file is too large (1 MB at most)");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new ValidationError("That file is not valid JSON"); }
  const head = Header.safeParse(raw);
  if (!head.success) {
    const i = head.error.issues[0]!;
    throw new ValidationError(`Template file: ${i.path.join(".") || "file"} ${i.message}`);
  }
  const b = head.data;
  if (!isThemeId(b.baseLook)) throw new ValidationError("baseLook: choose one of the original looks (kapor, gadgetstudio, mini-bunny, axionwear, bindu, berber)");
  if (b.siteMode === "ECOMMERCE" && b.vertical) throw new ValidationError("vertical: a store template has no business vertical");
  if (b.siteMode !== "ECOMMERCE" && !b.vertical) throw new ValidationError("vertical: a business template needs one (for example RESTAURANT)");

  const settings = where("settings", () => validateTheme(b.settings)) as ThemeSettings;
  const pages: TemplateBundle["pages"] = {};
  for (const [key, value] of Object.entries(b.pages)) {
    if (!(STORE_PAGE_KINDS as readonly string[]).includes(key)) throw new ValidationError(`pages.${key}: only ${STORE_PAGE_KINDS.join(", ")} can be set`);
    pages[key as PageKind] = where(`pages.${key}`, () => validatePage(key as PageKind, value)) as PageJson;
  }
  if (!pages.home) throw new ValidationError("pages.home: a template needs a home page");
  const chrome = b.chrome === undefined || b.chrome === null ? null : (where("chrome", () => templateChrome(b.chrome)) as Chrome);

  const slugs = new Set<string>();
  const customPages = b.customPages.map((c, i): CustomPageManifest => {
    const o = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
    const slug = String(o.slug ?? "");
    if (!TEMPLATE_ID.test(slug) || slugs.has(slug)) throw new ValidationError(`customPages.${i}.slug: use small letters, numbers and dashes, each page once`);
    slugs.add(slug);
    const str = (k: string, max: number) => String(o[k] ?? "").trim().slice(0, max);
    const title = str("title", 80);
    if (!title) throw new ValidationError(`customPages.${i}.title: give the page a title`);
    return {
      slug, title, titleBn: str("titleBn", 80), description: str("description", 200), descriptionBn: str("descriptionBn", 200),
      layout: where(`customPages.${i}.layout`, () => validatePage("custom", o.layout)) as PageJson,
    };
  });

  return {
    id: b.id, name: b.name, blurb: b.blurb, audience: b.audience, category: b.category, tags: b.tags, moduleLabel: b.moduleLabel,
    baseLook: b.baseLook, siteMode: b.siteMode, vertical: b.vertical, previews: b.previews, settings, pages, chrome, customPages,
  };
}

/** The file form of a template, ready to download, edit and upload again. */
export function exportTemplateBundle(t: Omit<TemplateBundle, "chrome" | "customPages"> & { chrome?: Chrome | null; customPages?: CustomPageManifest[] }): string {
  return JSON.stringify({
    format: TEMPLATE_BUNDLE_FORMAT, formatVersion: TEMPLATE_BUNDLE_VERSION,
    id: t.id, name: t.name, blurb: t.blurb, audience: t.audience, category: t.category, tags: t.tags, moduleLabel: t.moduleLabel,
    baseLook: t.baseLook, siteMode: t.siteMode, ...(t.vertical ? { vertical: t.vertical } : {}), previews: t.previews,
    settings: t.settings, pages: t.pages, ...(t.chrome ? { chrome: t.chrome } : {}), customPages: t.customPages ?? [],
  }, null, 2);
}
