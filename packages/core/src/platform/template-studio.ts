import { getPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { ValidationError } from "../errors";
import { assertPlatformCan, type PlatformActor } from "./admin";
import { signupStore } from "./signup";
import { BUNDLE_SITE_MODES, BUNDLE_VERTICALS } from "./template-bundle";

/**
 * Template Studio: where platform staff design a template in the real visual editor.
 *
 * A "workshop" is an ordinary store that only staff use (its address starts with `ws-`, its owner is "Template studio"). Staff open its editor,
 * design the pages, then publish the store's live design as a template with `publishTemplateFromStore`. Nothing new is stored: a workshop is
 * a store, so the editor, drafts, version history and the business-site pages all work exactly as they do for a merchant.
 */

export const WORKSHOP_PREFIX = "ws-";
export const WORKSHOP_OWNER = "Template studio";
const FAR_FUTURE = new Date("2100-01-01T00:00:00Z");

export interface WorkshopStore {
  tenantId: string;
  subdomain: string;
  name: string;
  siteMode: string;
  businessVertical: string | null;
  templateId: string | null;
  createdAt: Date;
}

export interface CreateWorkshopInput {
  name: string;
  /** A short word for the address: the store becomes ws-<slug>. */
  slug: string;
  /** Start from this template (a published one, or one of the originals). Default: the first original look. */
  startFrom?: string;
  siteMode?: string;
  vertical?: string | null;
}

/** A workshop store for designing a template. It never expires and never shows in billing as a trial that runs out. */
export async function createWorkshopStore(actor: PlatformActor, input: CreateWorkshopInput, db: PrismaClient = getPlatformPrisma()): Promise<WorkshopStore> {
  assertPlatformCan(actor, "plans", "edit");
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) throw new ValidationError("Give the workshop a name of 2 to 60 characters", { field: "name" });
  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 2 || slug.length > 30) throw new ValidationError("The workshop word can use small letters, numbers and dashes (2 to 30 characters)", { field: "slug" });
  const siteMode = input.siteMode ?? "ECOMMERCE";
  if (!(BUNDLE_SITE_MODES as readonly string[]).includes(siteMode)) throw new ValidationError("Choose a store or a business site", { field: "siteMode" });
  const vertical = siteMode === "ECOMMERCE" ? null : input.vertical ?? null;
  if (siteMode !== "ECOMMERCE" && !(BUNDLE_VERTICALS as readonly string[]).includes(String(vertical))) throw new ValidationError("A business workshop needs a business type", { field: "vertical" });

  const subdomain = `${WORKSHOP_PREFIX}${slug}`;
  // One owner address per workshop (an email may own only a few stores), made from the staff member's own address.
  const [local, domain] = actor.email.split("@");
  const email = `${local}+${subdomain}@${domain}`;
  const made = await signupStore({
    ownerName: WORKSHOP_OWNER, email, phone: "01700000000", storeName: name, subdomain, plan: "BUSINESS",
    theme: input.startFrom?.trim().toLowerCase() || "kapor", siteMode, businessVertical: vertical, demoData: true, locale: "en-US",
  });
  await db.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id: made.tenantId }, data: { status: "ACTIVE", trialEndsAt: FAR_FUTURE } });
    await tx.platformAuditLog.create({ data: { actorId: actor.id, action: "template.workshop_created", tenantId: made.tenantId, details: { subdomain, siteMode, vertical, startFrom: input.startFrom ?? null }, ipAddress: actor.ip ?? null } });
  });
  const t = await db.tenant.findUniqueOrThrow({ where: { id: made.tenantId } });
  return { tenantId: t.id, subdomain: t.subdomain, name: t.name, siteMode: t.siteMode, businessVertical: t.businessVertical, templateId: t.templateId, createdAt: t.createdAt };
}

export async function listWorkshopStores(actor: PlatformActor, db: PrismaClient = getPlatformPrisma()): Promise<WorkshopStore[]> {
  assertPlatformCan(actor, "plans", "view");
  const rows = await db.tenant.findMany({
    where: { subdomain: { startsWith: WORKSHOP_PREFIX }, ownerName: WORKSHOP_OWNER, OR: [{ demoKind: null }, { demoKind: { not: "SESSION" } }] },
    orderBy: { createdAt: "desc" }, take: 100,
  });
  return rows.map((t) => ({ tenantId: t.id, subdomain: t.subdomain, name: t.name, siteMode: t.siteMode, businessVertical: t.businessVertical, templateId: t.templateId, createdAt: t.createdAt }));
}
