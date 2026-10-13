import { withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { NotFoundError, PlanFeatureError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { defaultChrome, validateChrome, type Chrome } from "./chrome";
import { templateChrome } from "./template-chromes";
import { DraftConflictError, MAX_KEPT_VERSIONS } from "./versions";

/**
 * Saving, publishing and going back for a store's header and footer (docs/47 part C). It uses the same version table as the pages, with its own
 * key, so drafts, publish, history, rollback and the "someone else changed this" check all work the same way. The record does not belong to
 * one template look: switching looks keeps it.
 */

const KEY = "chrome";
/** A header and footer that came from a template is marked with this in its label, until the owner changes it. */
export const TEMPLATE_MARK = "template:";
const THEME = "chrome";

type Tx = Parameters<Parameters<typeof withTenant>[1]>[0];

/** Header and footer editing is part of the Pro plan and above (the "sectionBuilder" feature at "home" or "all"). */
async function allowedByPlan(tx: Tx): Promise<boolean> {
  const t = await tx.tenant.findFirstOrThrow({ select: { planTier: true } });
  const plan = await tx.plan.findUnique({ where: { tier: t.planTier } });
  const v = (plan?.features as Record<string, unknown> | null)?.sectionBuilder;
  return v === "home" || v === "all";
}

const draftRow = (tx: Tx) => tx.themeVersion.findFirst({ where: { themeId: THEME, pageKey: KEY, state: "DRAFT", version: 0 } });
const latestPublished = (tx: Tx) => tx.themeVersion.findFirst({ where: { themeId: THEME, pageKey: KEY, state: "PUBLISHED" }, orderBy: { version: "desc" } });
/** A saved record that no longer validates (a link to a category that was renamed is still valid; a rule that changed is not) falls back to today's look. */
const asChrome = (v: unknown): Chrome => {
  try { return validateChrome(v); } catch { return defaultChrome(); }
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export interface ChromeState {
  chrome: Chrome;
  /** The draft's last-saved stamp, to send back with the next save. Null when there is no draft yet. */
  stamp: string | null;
  isDraft: boolean;
  publishedVersion: number | null;
  unpublished: boolean;
  /** The plan allows editing it. */
  editable: boolean;
}

export async function loadChromeForEdit(tenantId: string, actor: StaffActor): Promise<ChromeState> {
  assertCan(actor, "design", "view");
  return withTenant(tenantId, async (tx) => {
    const [draft, live, editable] = await Promise.all([draftRow(tx), latestPublished(tx), allowedByPlan(tx)]);
    const liveChrome = live ? asChrome(live.sectionsJson) : null;
    const chrome = draft ? asChrome(draft.sectionsJson) : liveChrome ?? defaultChrome();
    return {
      chrome, stamp: draft?.updatedAt.toISOString() ?? null, isDraft: Boolean(draft), publishedVersion: live?.version ?? null,
      unpublished: Boolean(draft) && (!liveChrome || !same(chrome, liveChrome)), editable,
    };
  });
}

export async function saveChromeDraft(tenantId: string, actor: StaffActor, raw: unknown, expected?: { stamp: string | null }): Promise<{ stamp: string }> {
  assertCan(actor, "design", "edit");
  const chrome = validateChrome(raw);
  return withTenant(tenantId, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} FOR UPDATE`;
    if (!(await allowedByPlan(tx))) throw new PlanFeatureError("sectionBuilder");
    const existing = await draftRow(tx);
    if (expected !== undefined && (existing?.updatedAt.toISOString() ?? null) !== expected.stamp) throw new DraftConflictError(existing?.updatedAt.toISOString() ?? null);
    // A draft that came from a template keeps its mark only while it is untouched.
    const label = existing && same(asChrome(existing.sectionsJson), chrome) ? existing.label : null;
    const saved = existing
      ? await tx.themeVersion.update({ where: { id: existing.id }, data: { sectionsJson: chrome as object, label, createdBy: actor.userId } })
      : await tx.themeVersion.create({ data: { tenantId, themeId: THEME, pageKey: KEY, state: "DRAFT", version: 0, settings: {}, sectionsJson: chrome as object, createdBy: actor.userId } });
    return { stamp: saved.updatedAt.toISOString() };
  });
}

async function writePublished(tx: Tx, tenantId: string, actor: StaffActor, chrome: Chrome, label: string | null): Promise<number> {
  const last = await latestPublished(tx);
  const version = (last?.version ?? 0) + 1;
  await tx.themeVersion.create({ data: { tenantId, themeId: THEME, pageKey: KEY, state: "PUBLISHED", version, settings: {}, sectionsJson: chrome as object, label, createdBy: actor.userId } });
  const old = await tx.themeVersion.findMany({ where: { themeId: THEME, pageKey: KEY, state: "PUBLISHED" }, orderBy: { version: "desc" }, skip: MAX_KEPT_VERSIONS, select: { id: true } });
  if (old.length) await tx.themeVersion.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  return version;
}

export async function publishChrome(tenantId: string, actor: StaffActor, label?: string): Promise<number> {
  assertCan(actor, "design", "edit");
  return withTenant(tenantId, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} FOR UPDATE`;
    if (!(await allowedByPlan(tx))) throw new PlanFeatureError("sectionBuilder");
    const draft = await draftRow(tx);
    if (!draft) throw new ValidationError("There is nothing to publish. Make a change first.");
    const version = await writePublished(tx, tenantId, actor, validateChrome(draft.sectionsJson), label?.trim().slice(0, 60) || (draft.label?.startsWith(TEMPLATE_MARK) ? draft.label : null));
    await tx.themeVersion.deleteMany({ where: { id: draft.id } });
    await audit(tx, tenantId, actor, "design.published", { pageKey: KEY, version });
    return version;
  });
}

export async function discardChromeDraft(tenantId: string, actor: StaffActor): Promise<void> {
  assertCan(actor, "design", "edit");
  await withTenant(tenantId, (tx) => tx.themeVersion.deleteMany({ where: { themeId: THEME, pageKey: KEY, state: "DRAFT" } }));
}

export interface ChromeVersionRow { version: number; label: string | null; createdAt: Date; isLive: boolean }

export async function listChromeVersions(tenantId: string, actor: StaffActor): Promise<ChromeVersionRow[]> {
  assertCan(actor, "design", "view");
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.themeVersion.findMany({ where: { themeId: THEME, pageKey: KEY, state: "PUBLISHED" }, orderBy: { version: "desc" }, take: MAX_KEPT_VERSIONS });
    return rows.map((r, i) => ({ version: r.version, label: r.label, createdAt: r.createdAt, isLive: i === 0 }));
  });
}

/** Goes back: an older version is copied forward as the newest. Nothing is deleted, and it can be undone the same way. */
export async function rollbackChrome(tenantId: string, actor: StaffActor, version: number): Promise<number> {
  assertCan(actor, "design", "edit");
  return withTenant(tenantId, async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} FOR UPDATE`;
    if (!(await allowedByPlan(tx))) throw new PlanFeatureError("sectionBuilder");
    const src = await tx.themeVersion.findFirst({ where: { themeId: THEME, pageKey: KEY, state: "PUBLISHED", version } });
    if (!src) throw new NotFoundError("Version");
    const next = await writePublished(tx, tenantId, actor, validateChrome(src.sectionsJson), `Back to version ${version}`);
    await audit(tx, tenantId, actor, "design.rolled_back", { pageKey: KEY, from: version, to: next });
    return next;
  });
}

/** What the live storefront shows. Null when the store never published one: today's header and footer are used then. */
export async function getLiveChrome(tenantId: string): Promise<Chrome | null> {
  return withTenant(tenantId, async (tx) => {
    const live = await latestPublished(tx);
    return live ? asChrome(live.sectionsJson) : null;
  });
}

/** What the editor's preview shows: the draft if there is one, else what is live, else today's. */
export async function getPreviewChrome(tenantId: string): Promise<Chrome | null> {
  return withTenant(tenantId, async (tx) => {
    const draft = await draftRow(tx);
    if (draft) return asChrome(draft.sectionsJson);
    const live = await latestPublished(tx);
    return live ? asChrome(live.sectionsJson) : null;
  });
}

/**
 * Gives a store a template's header and footer. Into a new store it goes live at once; for a store that already has its own it goes into the
 * DRAFT, for the owner to look at and publish. Returns whether anything was written: the plan must allow editing it, and an update does not
 * replace a header and footer the owner has changed (`onlyIfUntouched`) or a draft they are working on.
 */
export async function installTemplateChrome(
  tx: Tx, tenantId: string, chrome: Chrome, mode: "publish" | "draft", createdBy: string, templateId: string, templateVersion: number,
  opts: { onlyIfUntouched?: boolean } = {},
): Promise<boolean> {
  const label = `${TEMPLATE_MARK}${templateId}:v${templateVersion}`;
  const actor = { userId: createdBy } as StaffActor;
  if (mode === "publish") {
    await writePublished(tx, tenantId, actor, chrome, label);
    return true;
  }
  if (!(await allowedByPlan(tx))) return false;
  const [live, existing] = await Promise.all([latestPublished(tx), draftRow(tx)]);
  if (opts.onlyIfUntouched) {
    if (live && !live.label?.startsWith(TEMPLATE_MARK)) return false;
    if (existing && !existing.label?.startsWith(TEMPLATE_MARK)) return false;
  }
  if (existing) await tx.themeVersion.update({ where: { id: existing.id }, data: { sectionsJson: chrome as object, label, createdBy } });
  else await tx.themeVersion.create({ data: { tenantId, themeId: THEME, pageKey: KEY, state: "DRAFT", version: 0, settings: {}, sectionsJson: chrome as object, label, createdBy } });
  return true;
}

/** The store's live header and footer as a template's (words and links removed), or null when it never published one. Used when a template is published from a store. */
export async function liveChromeForTemplate(tenantId: string, db: { themeVersion: Tx["themeVersion"] }): Promise<Chrome | null> {
  const row = await db.themeVersion.findFirst({ where: { tenantId, themeId: THEME, pageKey: KEY, state: "PUBLISHED" }, orderBy: { version: "desc" } });
  if (!row) return null;
  try { return templateChrome(row.sectionsJson); } catch { return null; }
}
