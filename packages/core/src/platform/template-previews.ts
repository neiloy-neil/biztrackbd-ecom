import { getPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { NotFoundError, ValidationError } from "../errors";
import { assertPlatformCan, type PlatformActor } from "./admin";
import { WORKSHOP_PREFIX } from "./template-studio";

/**
 * Preview pictures for a template's gallery card. A worker (apps/storefront/e2e/template-previews.mjs, run by a GitHub Action) opens a
 * workshop store, takes a desktop and a phone picture, stores them in the public "template-previews" bucket, and reports the two addresses
 * here. Previews belong to the template, not to a version, so saving them does not make a new version.
 */

export const TEMPLATE_PREVIEW_BUCKET = "template-previews";
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const rootDomain = () => process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
export const storeUrl = (subdomain: string) => `${rootDomain().includes("localhost") ? "http" : "https"}://${subdomain}.${rootDomain()}`;

/** Where the pictures of this template must be stored: our own storage bucket, or any https address when no storage is configured (development). */
export function isAllowedPreviewUrl(url: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (typeof url !== "string" || url.length > 500 || !url.startsWith("https://")) return false;
  const base = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/+$/, "");
  return base ? url.startsWith(`${base}/storage/v1/object/public/${TEMPLATE_PREVIEW_BUCKET}/`) : true;
}

export interface PreviewTarget { templateId: string; subdomain: string; url: string }

/**
 * The store to photograph for a template: the workshop it was saved from, or else a workshop made from it. A template that only exists as an
 * uploaded file has neither until staff make a workshop from it (Template studio, "Start from").
 */
export async function previewTargetFor(actor: PlatformActor, templateId: string, db: PrismaClient = getPlatformPrisma()): Promise<PreviewTarget> {
  assertPlatformCan(actor, "plans", "view");
  if (!ID.test(templateId)) throw new ValidationError("Unknown template");
  const row = await db.template.findUnique({ where: { id: templateId }, select: { sourceTenantId: true } });
  const workshop = (where: object) => db.tenant.findFirst({ where: { subdomain: { startsWith: WORKSHOP_PREFIX }, status: "ACTIVE", ...where }, orderBy: { createdAt: "desc" }, select: { subdomain: true } });
  const t = (row?.sourceTenantId ? await workshop({ id: row.sourceTenantId }) : null) ?? (await workshop({ templateId }));
  if (!t) throw new ValidationError("There is no workshop for this template yet. In Template studio, make a workshop that starts from it, then try again.");
  return { templateId, subdomain: t.subdomain, url: storeUrl(t.subdomain) };
}

/** Records the pictures a worker made. Called by the worker's authenticated request, not by a signed-in person. */
export async function setTemplatePreviews(templateId: string, previews: { desktop?: string; mobile?: string }, db: PrismaClient = getPlatformPrisma()): Promise<void> {
  if (!ID.test(templateId)) throw new ValidationError("Unknown template");
  const out: { desktop?: string; mobile?: string } = {};
  for (const k of ["desktop", "mobile"] as const) {
    const v = previews[k];
    if (v === undefined) continue;
    if (!isAllowedPreviewUrl(v)) throw new ValidationError(`The ${k} picture must be in the template-previews storage`);
    out[k] = v;
  }
  if (!out.desktop && !out.mobile) throw new ValidationError("Send at least one picture");
  await db.$transaction(async (tx) => {
    const row = await tx.template.findUnique({ where: { id: templateId } });
    if (!row) throw new NotFoundError("Template");
    const pages = (row.pagesJson && typeof row.pagesJson === "object" ? row.pagesJson : {}) as Record<string, unknown>;
    const meta = (pages._meta && typeof pages._meta === "object" ? pages._meta : {}) as Record<string, unknown>;
    const old = (meta.previews && typeof meta.previews === "object" ? meta.previews : {}) as Record<string, unknown>;
    await tx.template.update({ where: { id: templateId }, data: { pagesJson: { ...pages, _meta: { siteMode: "ECOMMERCE", vertical: null, customPages: [], ...meta, previews: { ...old, ...out } } } as object } });
    await tx.platformAuditLog.create({ data: { actorId: "SYSTEM", action: "template.previews", details: { id: templateId, ...out } } });
  });
}
