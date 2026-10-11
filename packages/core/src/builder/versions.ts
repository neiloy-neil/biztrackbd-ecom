import { withTenant, type TenantTx } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { DomainError, NotFoundError, PlanFeatureError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { STORE_PAGE_KINDS, defaultPageFor, validatePage, type PageJson, type PageKind } from "./registry";
import { themeDefaults, validateTheme, validateThemeId, type ThemeId, type ThemeSettings } from "./theme";

/**
 * Drafts and published versions of a page (ThemeVersion). Editing only ever touches the draft; the live store changes when
 * someone presses Publish, which writes the next numbered PUBLISHED row. Going back copies an older row forward as a new
 * version, so history is never rewritten. The draft is version 0 (one per page); published versions count from 1.
 */

export const HOME_KEY = "home";
export const landingKey = (id: string) => `landing:${id}`;
export const MAX_KEPT_VERSIONS = 30;

/**
 * Two people editing the same page: the second save would silently replace the first. Every draft carries the time it was last
 * saved (its stamp); a save that was made from an older stamp is refused with the newest one, so the editor can offer a choice.
 */
export class DraftConflictError extends DomainError {
  constructor(readonly stamp: string | null) {
    super("DRAFT_CONFLICT", "Someone else changed this page while you were editing it.", 409, { stamp });
  }
}

export interface PageState {
  /** The draft's last-saved stamp, to send back with the next save. Null when there is no draft yet. */
  stamp: string | null;
  pageKey: string;
  kind: PageKind;
  page: PageJson;
  theme: ThemeSettings;
  themeId: ThemeId;
  /** Whether this is a saved draft (true) or a copy of what is live / the starting point (false). */
  isDraft: boolean;
  publishedVersion: number | null;
  /** True when the draft differs from what is live. */
  unpublished: boolean;
}

/** The pages every store has one of: home, product, collection and cart (docs/39). Landing pages are made one by one. */
const isStorePage = (pageKey: string): boolean => (STORE_PAGE_KINDS as readonly string[]).includes(pageKey);

const kindOf = (pageKey: string): PageKind => {
  if (isStorePage(pageKey)) return pageKey as PageKind;
  if (/^landing:[A-Za-z0-9]{8,40}$/.test(pageKey)) return "landing";
  throw new ValidationError("Unknown page");
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const asPage = (kind: PageKind, v: unknown): PageJson => validatePage(kind, v);
const asTheme = (v: unknown, themeId: ThemeId): ThemeSettings => {
  try {
    return validateTheme(v);
  } catch {
    return themeDefaults(themeId);
  }
};

/** What the plan allows in the builder: "settings" (colours and style only), "home" (home sections too), "all". */
export type SectionBuilderTier = "settings" | "home" | "all";
async function builderTier(tx: TenantTx): Promise<SectionBuilderTier> {
  const t = await tx.tenant.findFirstOrThrow({ select: { planTier: true } });
  const plan = await tx.plan.findUnique({ where: { tier: t.planTier } });
  const v = (plan?.features as Record<string, unknown> | null)?.sectionBuilder;
  return v === "all" || v === "home" ? v : "settings";
}

export async function getBuilderAccess(tenantId: string): Promise<{ tier: SectionBuilderTier; sectionsEditable: boolean; /** Product, collection and cart pages can be rearranged too. */ allPagesEditable: boolean }> {
  const tier = await withTenant(tenantId, builderTier);
  return { tier, sectionsEditable: tier !== "settings", allPagesEditable: tier === "all" };
}

async function activeThemeId(tx: TenantTx): Promise<ThemeId> {
  const tenant = await tx.tenant.findFirstOrThrow({ select: { themeId: true } });
  try { return validateThemeId(tenant.themeId); } catch { return "kapor"; }
}

export async function getActiveThemeId(tenantId: string): Promise<ThemeId> {
  return withTenant(tenantId, activeThemeId);
}

async function latestPublished(tx: TenantTx, themeId: ThemeId, pageKey: string) {
  return tx.themeVersion.findFirst({ where: { themeId, pageKey, state: "PUBLISHED" }, orderBy: { version: "desc" } });
}
const draftRow = (tx: TenantTx, themeId: ThemeId, pageKey: string) => tx.themeVersion.findFirst({ where: { themeId, pageKey, state: "DRAFT", version: 0 } });

async function assertPageExists(tx: TenantTx, pageKey: string) {
  if (isStorePage(pageKey)) return;
  const id = pageKey.slice("landing:".length);
  if (!(await tx.landingPage.findFirst({ where: { id }, select: { id: true } }))) throw new NotFoundError("Landing page");
}

/** The theme is one setting for the whole store; it rides on the home page's rows. */
async function storeTheme(tx: TenantTx, themeId: ThemeId, draftFirst: boolean): Promise<ThemeSettings> {
  if (draftFirst) {
    const d = await draftRow(tx, themeId, HOME_KEY);
    if (d) return asTheme(d.settings, themeId);
  }
  const p = await latestPublished(tx, themeId, HOME_KEY);
  return p ? asTheme(p.settings, themeId) : themeDefaults(themeId);
}

/** What the editor opens with: the draft if there is one, else what is live, else the starting layout. */
export async function loadForEdit(tenantId: string, actor: StaffActor, pageKey: string): Promise<PageState> {
  assertCan(actor, "design", "view");
  const kind = kindOf(pageKey);
  return withTenant(tenantId, async (tx) => {
    await assertPageExists(tx, pageKey);
    const themeId = await activeThemeId(tx);
    const [draft, live] = await Promise.all([draftRow(tx, themeId, pageKey), latestPublished(tx, themeId, pageKey)]);
    const start = defaultPageFor(kind);
    const page = draft ? asPage(kind, draft.sectionsJson) : live ? asPage(kind, live.sectionsJson) : start;
    const theme = await storeTheme(tx, themeId, true);
    const liveTheme = await storeTheme(tx, themeId, false);
    const liveJson = live ? asPage(kind, live.sectionsJson) : null;
    return {
      stamp: draft?.updatedAt.toISOString() ?? null,
      pageKey, kind, page, theme, themeId,
      isDraft: !!draft,
      publishedVersion: live?.version ?? null,
      unpublished: !!draft && (!liveJson || !same(draft.sectionsJson, liveJson) || !same(theme, liveTheme)),
    };
  });
}

/** Saves the draft. The page is checked on the way in, so a draft is always publishable. */
export async function saveDraft(tenantId: string, actor: StaffActor, pageKey: string, rawPage: unknown, rawTheme?: unknown, expected?: { stamp: string | null }): Promise<{ stamp: string }> {
  assertCan(actor, "design", "edit");
  const kind = kindOf(pageKey);
  const page = validatePage(kind, rawPage);
  const theme = rawTheme === undefined ? undefined : validateTheme(rawTheme);
  return withTenant(tenantId, async (tx) => {
    // Serialise saves of one page, so two arriving together cannot both pass the stamp check.
    await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} FOR UPDATE`;
    await assertPageExists(tx, pageKey);
    const themeId = await activeThemeId(tx);
    // The plan decides how much can be rearranged: "settings" restyles only, "home" edits the home page, "all" edits every page. Below its
    // level, a page's sections must stay as they are (what is live, or the starting layout).
    if (isStorePage(pageKey)) {
      const tier = await builderTier(tx);
      const locked = pageKey === HOME_KEY ? tier === "settings" : tier !== "all";
      if (locked) {
        const live = await latestPublished(tx, themeId, pageKey);
        const baseline = live ? asPage(kind, live.sectionsJson) : defaultPageFor(kind);
        if (!same(baseline, page)) throw new PlanFeatureError("sectionBuilder");
      }
    }
    // The theme rides on the home row. A landing draft leaves it alone.
    const settings = pageKey === HOME_KEY ? (theme ?? (await storeTheme(tx, themeId, true))) : (await storeTheme(tx, themeId, true));
    const existing = await draftRow(tx, themeId, pageKey);
    if (expected !== undefined && (existing?.updatedAt.toISOString() ?? null) !== expected.stamp) throw new DraftConflictError(existing?.updatedAt.toISOString() ?? null);
    // A theme change made from a landing editor is not possible, but the home draft must follow when only the theme changed.
    if (pageKey !== HOME_KEY && theme) throw new ValidationError("Change the theme from the store design page");
    const saved = existing
      ? await tx.themeVersion.update({ where: { id: existing.id }, data: { sectionsJson: page as object, settings: settings as object, createdBy: actor.userId } })
      : await tx.themeVersion.create({ data: { tenantId, themeId, pageKey, state: "DRAFT", version: 0, settings: settings as object, sectionsJson: page as object, createdBy: actor.userId } });
    return { stamp: saved.updatedAt.toISOString() };
  });
}

/** Saves only the theme (colours, corners, font) into the home draft, keeping the sections as they are. */
export async function saveThemeDraft(tenantId: string, actor: StaffActor, rawTheme: unknown): Promise<void> {
  assertCan(actor, "design", "edit");
  const theme = validateTheme(rawTheme);
  await withTenant(tenantId, async (tx) => {
    const themeId = await activeThemeId(tx);
    const d = await draftRow(tx, themeId, HOME_KEY);
    if (d) await tx.themeVersion.update({ where: { id: d.id }, data: { settings: theme as object, createdBy: actor.userId } });
    else {
      const live = await latestPublished(tx, themeId, HOME_KEY);
      const page = live ? asPage("home", live.sectionsJson) : defaultPageFor("home");
      await tx.themeVersion.create({ data: { tenantId, themeId, pageKey: HOME_KEY, state: "DRAFT", version: 0, settings: theme as object, sectionsJson: page as object, createdBy: actor.userId } });
    }
  });
}

export async function discardDraft(tenantId: string, actor: StaffActor, pageKey: string): Promise<void> {
  assertCan(actor, "design", "edit");
  kindOf(pageKey);
  await withTenant(tenantId, async (tx) => {
    const themeId = await activeThemeId(tx);
    await tx.themeVersion.deleteMany({ where: { themeId, pageKey, state: "DRAFT" } });
  });
}

async function writePublished(tx: TenantTx, tenantId: string, themeId: ThemeId, actor: StaffActor, pageKey: string, page: PageJson, theme: ThemeSettings, label: string | null) {
  const last = await latestPublished(tx, themeId, pageKey);
  const version = (last?.version ?? 0) + 1;
  await tx.themeVersion.create({ data: { tenantId, themeId, pageKey, state: "PUBLISHED", version, settings: theme as object, sectionsJson: page as object, label, createdBy: actor.userId } });
  // The theme is store-wide: publishing the home page makes the theme live. A landing page uses the store's current theme.
  if (!isStorePage(pageKey)) {
    const id = pageKey.slice("landing:".length);
    await tx.landingPage.update({ where: { id }, data: { sectionsJson: page as object, isPublished: true } });
  }
  // Keep the history bounded; the oldest published rows go first.
  const old = await tx.themeVersion.findMany({ where: { themeId, pageKey, state: "PUBLISHED" }, orderBy: { version: "desc" }, skip: MAX_KEPT_VERSIONS, select: { id: true } });
  if (old.length) await tx.themeVersion.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  return version;
}

/** Makes the draft live. Returns the new version number. */
export async function publish(tenantId: string, actor: StaffActor, pageKey: string, label?: string): Promise<number> {
  assertCan(actor, "design", "edit");
  const kind = kindOf(pageKey);
  return withTenant(tenantId, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} FOR UPDATE`;
    await assertPageExists(tx, pageKey);
    const themeId = await activeThemeId(tx);
    const draft = await draftRow(tx, themeId, pageKey);
    if (!draft) throw new ValidationError("There is nothing to publish. Make a change first.");
    const page = asPage(kind, draft.sectionsJson);
    const theme = pageKey === HOME_KEY ? asTheme(draft.settings, themeId) : await storeTheme(tx, themeId, false);
    const version = await writePublished(tx, tenantId, themeId, actor, pageKey, page, theme, label?.trim().slice(0, 60) || null);
    await tx.themeVersion.deleteMany({ where: { id: draft.id } });
    await audit(tx, tenantId, actor, "design.published", { pageKey, version });
    return version;
  });
}

export interface VersionRow {
  version: number;
  label: string | null;
  createdAt: Date;
  createdBy: string | null;
  isLive: boolean;
}

export async function listVersions(tenantId: string, actor: StaffActor, pageKey: string): Promise<VersionRow[]> {
  assertCan(actor, "design", "view");
  kindOf(pageKey);
  return withTenant(tenantId, async (tx) => {
    const themeId = await activeThemeId(tx);
    const rows = await tx.themeVersion.findMany({ where: { themeId, pageKey, state: "PUBLISHED" }, orderBy: { version: "desc" }, take: MAX_KEPT_VERSIONS });
    return rows.map((r, i) => ({ version: r.version, label: r.label, createdAt: r.createdAt, createdBy: r.createdBy, isLive: i === 0 }));
  });
}

/** Goes back: an older version is copied forward as the newest one. Nothing is deleted, and it can be undone the same way. */
export async function rollback(tenantId: string, actor: StaffActor, pageKey: string, version: number): Promise<number> {
  assertCan(actor, "design", "edit");
  const kind = kindOf(pageKey);
  return withTenant(tenantId, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} FOR UPDATE`;
    const themeId = await activeThemeId(tx);
    const src = await tx.themeVersion.findFirst({ where: { themeId, pageKey, state: "PUBLISHED", version } });
    if (!src) throw new NotFoundError("Version");
    const next = await writePublished(tx, tenantId, themeId, actor, pageKey, asPage(kind, src.sectionsJson), pageKey === HOME_KEY ? asTheme(src.settings, themeId) : await storeTheme(tx, themeId, false), `Back to version ${version}`);
    await audit(tx, tenantId, actor, "design.rolled_back", { pageKey, from: version, to: next });
    return next;
  });
}

/** What the live storefront shows. Null when the store never published (the built-in layout is used then). */
export async function getLive(tenantId: string, pageKey: string): Promise<{ page: PageJson; theme: ThemeSettings; themeId: ThemeId; version: number } | null> {
  const kind = kindOf(pageKey);
  return withTenant(tenantId, async (tx) => {
    const themeId = await activeThemeId(tx);
    const row = await latestPublished(tx, themeId, pageKey);
    if (!row) return null;
    return { page: asPage(kind, row.sectionsJson), theme: await storeTheme(tx, themeId, false), themeId, version: row.version };
  });
}

/** The live theme alone, for pages without a builder layout. */
export async function getLiveTheme(tenantId: string): Promise<ThemeSettings> {
  return withTenant(tenantId, async (tx) => {
    const themeId = await activeThemeId(tx);
    return storeTheme(tx, themeId, false);
  });
}

/** The draft (or live) for the preview iframe. */
export async function getPreview(tenantId: string, pageKey: string): Promise<{ page: PageJson; theme: ThemeSettings; themeId: ThemeId }> {
  const kind = kindOf(pageKey);
  return withTenant(tenantId, async (tx) => {
    const themeId = await activeThemeId(tx);
    const draft = await draftRow(tx, themeId, pageKey);
    const live = draft ? null : await latestPublished(tx, themeId, pageKey);
    const raw = draft?.sectionsJson ?? live?.sectionsJson;
    return { page: raw ? asPage(kind, raw) : defaultPageFor(kind), theme: await storeTheme(tx, themeId, true), themeId };
  });
}

/** Switches the active visual template. Each template keeps its own drafts and publish history. */
export async function activateTheme(tenantId: string, actor: StaffActor, rawThemeId: unknown): Promise<ThemeId> {
  assertCan(actor, "design", "edit");
  const themeId = validateThemeId(rawThemeId);
  await withTenant(tenantId, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} FOR UPDATE`;
    await tx.themeInstall.updateMany({ where: { isActive: true }, data: { isActive: false } });
    await tx.themeInstall.upsert({
      where: { tenantId_themeId: { tenantId, themeId } },
      update: { isActive: true },
      create: { tenantId, themeId, isActive: true, settings: {}, pagesJson: {} },
    });
    await tx.tenant.update({ where: { id: tenantId }, data: { themeId } });
    await audit(tx, tenantId, actor, "design.theme_activated", { themeId });
  });
  return themeId;
}
