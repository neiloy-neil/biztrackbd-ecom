import { getBasePrisma, getPlatformPrisma, withTenant, type PrismaClient } from "@biztrackbd/db";
import { installTemplatePages, installCustomPage } from "../builder/versions";
import type { Chrome } from "../builder/chrome";
import { installTemplateChrome, liveChromeForTemplate } from "../builder/chrome-store";
import { BUILT_IN_CHROMES, templateChrome } from "../builder/template-chromes";
import { defaultPageFor, STORE_PAGE_KINDS, validatePage, type PageJson, type PageKind } from "../builder/registry";
import { STORE_THEMES, isThemeId, themeDefaults, validateTheme, type ThemeId, type ThemeSettings } from "../builder/theme";
import { NotFoundError, ValidationError } from "../errors";
import { audit } from "../audit/service";
import { assertCan, type StaffActor } from "../permissions";
import { assertPlatformCan, type PlatformActor } from "./admin";
import { BUSINESS_TEMPLATES, type CustomPageManifest } from "../site/templates/manifests";
import type { SiteMode, BusinessVertical } from "../site/mode";

/**
 * Store templates that platform staff publish without a deploy (docs/46, stage 5).
 *
 * A template is a preset (colours, corners, font) and a layout for each store page, on top of one of the original looks (`baseLook`: the CSS
 * it is drawn with). The six original templates live in code; a published row with the same id replaces one, an archived one hides it.
 * New templates are made in an ordinary "workshop" store with the visual editor and published from there. A store keeps its own copy: a
 * newer version of its template is offered, shown as drafts, and only goes live when the owner publishes it.
 */

export type TemplateStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export const TEMPLATE_CATEGORIES = ["fashion", "electronics", "kids", "streetwear", "beauty", "other"] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
export const TEMPLATE_PAGE_KINDS = STORE_PAGE_KINDS;
export type TemplatePages = Partial<Record<PageKind, PageJson>>;

export interface TemplateInfo {
  id: string;
  name: string;
  blurb: string;
  audience: string;
  baseLook: ThemeId;
  category: TemplateCategory;
  tags: string[];
  moduleLabel: string | null;
  version: number;
  status: TemplateStatus;
  /** One of the six originals that has not been replaced by a published row. Its pages are the built-in layouts. */
  builtIn: boolean;
  settings: ThemeSettings;
  /** Null for an untouched original: the store pages start from the built-in layouts. */
  pages: TemplatePages | null;
  /** The layout and style of the header and footer. Null: the store keeps today's. */
  chrome: Chrome | null;
  /** BizTrack Business additions */
  siteMode?: SiteMode;
  vertical?: BusinessVertical;
  customPages?: CustomPageManifest[];
}

const BUILT_IN_CATEGORY: Record<string, TemplateCategory> = { kapor: "fashion", gadgetstudio: "electronics", "mini-bunny": "kids", axionwear: "streetwear", bindu: "beauty", berber: "fashion" };
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const builtIns = (): TemplateInfo[] =>
  STORE_THEMES.map((t) => ({
    id: t.id, name: t.name, blurb: t.blurb, audience: t.audience, baseLook: t.id, category: BUILT_IN_CATEGORY[t.id] ?? "other", tags: [t.audience], moduleLabel: null,
    version: 1, status: "PUBLISHED" as const, builtIn: true, settings: { ...t.defaults }, pages: null, chrome: BUILT_IN_CHROMES[t.id] ?? null,
  }));

const businessBuiltIns = (): TemplateInfo[] =>
  BUSINESS_TEMPLATES.map((bt) => ({
    id: bt.id,
    name: bt.name,
    blurb: bt.blurb,
    audience: bt.audience,
    baseLook: bt.baseLook,
    category: bt.category,
    tags: bt.tags,
    moduleLabel: bt.vertical,
    version: 1,
    status: "PUBLISHED" as const,
    builtIn: true,
    settings: { ...bt.settings },
    pages: bt.pages,
    chrome: bt.chrome,
    siteMode: bt.siteMode,
    vertical: bt.vertical,
    customPages: bt.customPages,
  }));

type Row = { id: string; name: string; blurb: string; audience: string; baseLook: string; category: string; tags: string[]; moduleLabel: string | null; status: string; version: number; settingsJson: unknown; pagesJson: unknown };

/** A saved row as a template, checked again on the way out: a damaged row falls back to the original look rather than breaking a page. */
function fromRow(r: Row): TemplateInfo {
  const baseLook: ThemeId = isThemeId(r.baseLook) ? r.baseLook : "kapor";
  let settings: ThemeSettings;
  try { settings = validateTheme(r.settingsJson); } catch { settings = themeDefaults(baseLook); }
  const pages: TemplatePages = {};
  const raw = (r.pagesJson && typeof r.pagesJson === "object" ? r.pagesJson : {}) as Record<string, unknown>;
  for (const kind of STORE_PAGE_KINDS) {
    if (raw[kind] === undefined) continue;
    try { pages[kind] = validatePage(kind, raw[kind]); } catch { /* that page falls back to the built-in layout */ }
  }
  // The header and footer ride in the same record under a key of their own, so no new column was needed. A replaced original keeps its own when the new one has none.
  let chrome: Chrome | null = BUILT_IN_CHROMES[r.id] ?? null;
  if (raw._chrome !== undefined) { try { chrome = templateChrome(raw._chrome); } catch { /* keep the original's */ } }
  const category = (TEMPLATE_CATEGORIES as readonly string[]).includes(r.category) ? (r.category as TemplateCategory) : "other";
  return { id: r.id, name: r.name, blurb: r.blurb, audience: r.audience, baseLook, category, tags: r.tags, moduleLabel: r.moduleLabel, version: r.version, status: r.status as TemplateStatus, builtIn: false, settings, pages, chrome };
}

/** The templates a visitor or a new store can choose: the originals (unless replaced or archived) and every published one. */
export async function listPublishedTemplates(db: PrismaClient = getBasePrisma()): Promise<TemplateInfo[]> {
  const rows = (await db.template.findMany({ where: { status: { not: "DRAFT" } }, orderBy: { publishedAt: "asc" } })) as Row[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: TemplateInfo[] = [];
  const allBuiltIns = [...builtIns(), ...businessBuiltIns()];
  for (const b of allBuiltIns) {
    const r = byId.get(b.id);
    if (!r) out.push(b);
    else if (r.status === "PUBLISHED") out.push(fromRow(r));
  }
  for (const r of rows) if (r.status === "PUBLISHED" && !allBuiltIns.some((t) => t.id === r.id)) out.push(fromRow(r));
  return out;
}

export async function getTemplate(id: string, db?: PrismaClient): Promise<TemplateInfo | null> {
  if (!ID.test(id)) return null;
  return (await listPublishedTemplates(db)).find((t) => t.id === id) ?? null;
}

// ---- Staff side ----------------------------------------------------------------------------------------------------------

export interface StaffTemplateRow extends TemplateInfo {
  /** Stores that were started from, or last updated to, this template. */
  storesUsing: number;
  /** Whether a row exists (false: an untouched original, which only the code defines). */
  saved: boolean;
}

export async function listTemplatesForStaff(actor: PlatformActor, db: PrismaClient = getPlatformPrisma()): Promise<StaffTemplateRow[]> {
  assertPlatformCan(actor, "plans", "view");
  const rows = (await db.template.findMany({ orderBy: [{ createdAt: "asc" }] })) as Row[];
  const used = (await db.tenant.groupBy({ by: ["templateId", "themeId"], _count: { _all: true } })) as unknown as { templateId: string | null; themeId: string; _count: { _all: number } }[];
  const count = (id: string, isOriginal: boolean) => used.filter((u) => u.templateId === id || (isOriginal && u.templateId === null && u.themeId === id)).reduce((n, u) => n + u._count._all, 0);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: StaffTemplateRow[] = [];
  const allBuiltIns = [...builtIns(), ...businessBuiltIns()];
  for (const b of allBuiltIns) {
    const r = byId.get(b.id);
    out.push(r ? { ...fromRow(r), storesUsing: count(b.id, true), saved: true } : { ...b, storesUsing: count(b.id, true), saved: false });
  }
  for (const r of rows) if (!allBuiltIns.some((t) => t.id === r.id)) out.push({ ...fromRow(r), storesUsing: count(r.id, false), saved: true });
  return out;
}

export interface PublishFromStoreInput {
  /** The workshop store the template is taken from. */
  tenantId: string;
  id: string;
  name: string;
  blurb?: string;
  audience?: string;
  category?: string;
  tags?: string[];
  moduleLabel?: string | null;
}

/**
 * Takes a store's live design (colours and style, and the home, product, collection and cart pages) and publishes it as a template. A page the
 * store never published is left to the built-in layout. Publishing an id that exists again makes the next version; stores already using it are
 * not touched, they are offered the new one.
 */
export async function publishTemplateFromStore(actor: PlatformActor, input: PublishFromStoreInput, db: PrismaClient = getPlatformPrisma()): Promise<TemplateInfo> {
  assertPlatformCan(actor, "plans", "edit");
  const id = input.id.trim().toLowerCase();
  if (!ID.test(id) || id.length < 3 || id.length > 40) throw new ValidationError("The template id can use small letters, numbers and dashes, like eid-kapor (3 to 40 characters)", { field: "id" });
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) throw new ValidationError("Give the template a name of 2 to 60 characters", { field: "name" });
  const tenant = await db.tenant.findFirst({ where: { id: input.tenantId }, select: { id: true, themeId: true, demoKind: true } });
  if (!tenant) throw new NotFoundError("Store");
  if (tenant.demoKind) throw new ValidationError("Choose a real store: a demo store is erased after a few hours", { field: "tenantId" });
  const baseLook: ThemeId = isThemeId(tenant.themeId) ? tenant.themeId : "kapor";

  const live = async (pageKey: string) => db.themeVersion.findFirst({ where: { tenantId: tenant.id, themeId: baseLook, pageKey, state: "PUBLISHED" }, orderBy: { version: "desc" } });
  const home = await live("home");
  let settings = themeDefaults(baseLook);
  if (home) { try { settings = validateTheme(home.settings); } catch { /* keep the look's defaults */ } }
  const pages: Record<string, unknown> = {};
  for (const kind of STORE_PAGE_KINDS) {
    const row = kind === "home" ? home : await live(kind);
    pages[kind] = row ? validatePage(kind, row.sectionsJson) : defaultPageFor(kind);
  }
  const chrome = await liveChromeForTemplate(tenant.id, db);
  if (chrome) pages._chrome = chrome;
  const category = (TEMPLATE_CATEGORIES as readonly string[]).includes(input.category ?? "") ? input.category! : "other";
  const tags = (input.tags ?? []).map((t) => t.trim().slice(0, 30)).filter(Boolean).slice(0, 4);
  const data = {
    name, blurb: (input.blurb ?? "").trim().slice(0, 200), audience: (input.audience ?? "").trim().slice(0, 80), baseLook, category, tags,
    moduleLabel: input.moduleLabel?.trim().slice(0, 40) || null, settingsJson: settings as object, pagesJson: pages as object, sourceTenantId: tenant.id,
  };
  const saved = await db.$transaction(async (tx) => {
    const existing = await tx.template.findUnique({ where: { id } });
    const row = existing
      ? await tx.template.update({ where: { id }, data: { ...data, status: "PUBLISHED", version: existing.version + 1, publishedAt: new Date() } })
      // An original template is version 1, so a published replacement starts at 2 and is offered to the stores made from the original.
      : await tx.template.create({ data: { id, ...data, status: "PUBLISHED", version: STORE_THEMES.some((t) => t.id === id) ? 2 : 1, publishedAt: new Date() } });
    await tx.platformAuditLog.create({ data: { actorId: actor.id, action: "template.published", tenantId: tenant.id, details: { id, version: row.version, baseLook }, ipAddress: actor.ip ?? null } });
    return row;
  });
  return fromRow(saved as Row);
}

/** Hides a template from new stores and the gallery (ARCHIVED), brings it back (PUBLISHED), or sets it aside before it is shown (DRAFT). Stores using it keep working. */
export async function setTemplateStatus(actor: PlatformActor, id: string, status: TemplateStatus, db: PrismaClient = getPlatformPrisma()): Promise<void> {
  assertPlatformCan(actor, "plans", "edit");
  if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) throw new ValidationError("Unknown status");
  const existing = await db.template.findUnique({ where: { id } });
  const original = STORE_THEMES.find((t) => t.id === id);
  if (!existing && !original) throw new NotFoundError("Template");
  await db.$transaction(async (tx) => {
    if (existing) await tx.template.update({ where: { id }, data: { status, ...(status === "PUBLISHED" && !existing.publishedAt ? { publishedAt: new Date() } : {}) } });
    else if (original) {
      // An original template that has no row yet: one is made from its built-in defaults, so it can be hidden (or shown again) like any other.
      await tx.template.create({ data: { id, name: original.name, blurb: original.blurb, audience: original.audience, baseLook: original.id, category: BUILT_IN_CATEGORY[id] ?? "other", tags: [original.audience], settingsJson: original.defaults as object, pagesJson: { ...Object.fromEntries(STORE_PAGE_KINDS.map((k) => [k, defaultPageFor(k)])), ...(BUILT_IN_CHROMES[id] ? { _chrome: BUILT_IN_CHROMES[id] } : {}) } as object, status, version: 1, publishedAt: new Date() } });
    }
    await tx.platformAuditLog.create({ data: { actorId: actor.id, action: "template.status", details: { id, status }, ipAddress: actor.ip ?? null } });
  });
}

// ---- Store side ----------------------------------------------------------------------------------------------------------

/** What a new store gets: the look it is drawn with, the template's settings and pages, and the id and version to remember. */
export interface ResolvedTemplate { info: TemplateInfo; baseLook: ThemeId }

export async function resolveTemplateForSignup(id: string, db?: PrismaClient): Promise<ResolvedTemplate> {
  const info = await getTemplate(id, db);
  if (!info) throw new ValidationError("Choose a storefront template that is available", { field: "theme" });
  return { info, baseLook: info.baseLook };
}

/** Installs a template into a store being created: its pages go live at once. Called inside the signup's own transaction. */
export async function installTemplateForNewStore(tx: Parameters<typeof installTemplatePages>[0], tenantId: string, info: TemplateInfo, createdBy: string): Promise<void> {
  if (info.pages) await installTemplatePages(tx, tenantId, info.baseLook, { settings: info.settings, pages: info.pages }, "publish", createdBy);
  if (info.chrome) await installTemplateChrome(tx, tenantId, info.chrome, "publish", createdBy, info.id, info.version);
  if (info.customPages && info.customPages.length > 0) {
    for (const cp of info.customPages) {
      await installCustomPage(tx, tenantId, info.baseLook, cp, "publish", createdBy, info.settings);
    }
  }
  await tx.tenant.update({
    where: { id: tenantId },
    data: {
      templateId: info.id,
      templateVersion: info.version,
      ...(info.siteMode ? { siteMode: info.siteMode } : {}),
      ...(info.vertical ? { businessVertical: info.vertical } : {}),
    },
  });
}

export interface TemplateUpdate { id: string; name: string; have: number; latest: number }

/** Whether the template this store came from has a newer version than the one it has. Null when it is up to date or there is nothing to offer. */
export async function templateUpdateAvailable(tenantId: string): Promise<TemplateUpdate | null> {
  const t = await withTenant(tenantId, (tx) => tx.tenant.findFirstOrThrow({ select: { templateId: true, templateVersion: true, themeId: true } }));
  // A store made before templates could be published counts as made from the original of its look, at version 1.
  const id = t.templateId ?? t.themeId;
  const info = await getTemplate(id);
  if (!info || !info.pages) return null;
  const have = t.templateVersion ?? 1;
  return info.version > have ? { id: info.id, name: info.name, have, latest: info.version } : null;
}

/**
 * Takes the newer version of the store's template as DRAFTS: nothing changes on the live store until the owner looks at it in the editor and
 * publishes. The plan decides how much is taken (a store that can only restyle gets the colours). Returns the pages that were drafted.
 */
export async function applyTemplateUpdate(tenantId: string, actor: StaffActor): Promise<{ pages: string[]; version: number; chrome: boolean }> {
  assertCan(actor, "design", "edit");
  const update = await templateUpdateAvailable(tenantId);
  if (!update) throw new ValidationError("There is no newer version of your template");
  const info = (await getTemplate(update.id))!;
  return withTenant(tenantId, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} FOR UPDATE`;
    const tenant = await tx.tenant.findFirstOrThrow({ select: { themeId: true } });
    const themeId: ThemeId = isThemeId(tenant.themeId) ? tenant.themeId : "kapor";
    const pages = await installTemplatePages(tx, tenantId, themeId, { settings: info.settings, pages: info.pages! }, "draft", actor.userId);
    // The header and footer are offered too, unless the owner has made their own: those are never replaced without asking.
    const chrome = info.chrome ? await installTemplateChrome(tx, tenantId, info.chrome, "draft", actor.userId, info.id, info.version, { onlyIfUntouched: true }) : false;
    await tx.tenant.update({ where: { id: tenantId }, data: { templateVersion: info.version } });
    return { pages, version: info.version, chrome };
  });
}

export interface ApplyTemplateResult { pages: string[]; version: number; /** The header and footer of the template went into the draft. */ chrome: boolean; /** The store's look (the CSS it is drawn with) changed, and that is live at once. */ lookChanged: boolean }

/**
 * Moves a store to another template, from the store's own design screen. The template's colours, style and page layouts go into the DRAFTS, so
 * nothing about the pages changes until the owner looks through them and publishes. The one thing that cannot wait is the look: if the
 * template is drawn with a different look, the store switches to it at once (the screen says so first), and its pages start from that look's
 * own layouts until the drafts are published. Products, categories and content are never touched. `keep` lists pages whose layout stays.
 */
export async function applyTemplateToStore(tenantId: string, actor: StaffActor, templateId: string, keep: readonly PageKind[] = [], takeChrome = true): Promise<ApplyTemplateResult> {
  assertCan(actor, "design", "edit");
  const info = await getTemplate(templateId);
  if (!info) throw new ValidationError("Choose a template that is available", { field: "templateId" });
  const pages: TemplatePages = info.pages ?? Object.fromEntries(STORE_PAGE_KINDS.map((k) => [k, defaultPageFor(k)]));
  const only = STORE_PAGE_KINDS.filter((k) => !keep.includes(k));
  return withTenant(tenantId, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} FOR UPDATE`;
    const tenant = await tx.tenant.findFirstOrThrow({ select: { themeId: true } });
    const lookChanged = tenant.themeId !== info.baseLook;
    if (lookChanged) {
      await tx.themeInstall.updateMany({ where: { isActive: true }, data: { isActive: false } });
      await tx.themeInstall.upsert({ where: { tenantId_themeId: { tenantId, themeId: info.baseLook } }, update: { isActive: true }, create: { tenantId, themeId: info.baseLook, isActive: true, settings: {}, pagesJson: {} } });
      await tx.tenant.update({ where: { id: tenantId }, data: { themeId: info.baseLook } });
    }
    const written = await installTemplatePages(tx, tenantId, info.baseLook, { settings: info.settings, pages }, "draft", actor.userId, only);
    // Asked for: the header and footer of the template go into the draft too, in place of whatever draft there is.
    const chrome = takeChrome && info.chrome ? await installTemplateChrome(tx, tenantId, info.chrome, "draft", actor.userId, info.id, info.version) : false;
    await tx.tenant.update({ where: { id: tenantId }, data: { templateId: info.id, templateVersion: info.version } });
    await audit(tx, tenantId, actor, "design.template_applied", { templateId: info.id, version: info.version, lookChanged, kept: [...keep], chrome });
    return { pages: written, version: info.version, lookChanged, chrome };
  });
}
