import { z } from "zod";
import { getPlatformPrisma, type Prisma, type PrismaClient, type TenantTx } from "@biztrackbd/db";
import { ALL_THEMES, PREMIUM_THEME_PRICE, isPremiumTheme } from "../builder/theme";
import { ValidationError, NotFoundError } from "../errors";
import { assertPlatformCan, type PlatformActor } from "./admin";

/**
 * The theme catalogue and the one rule for who may use a theme. The code still defines the built-in themes (their layouts and styles ship with
 * the storefront), but whether a theme is free or premium, what it costs, whether it is one-time or monthly and which plans include it is data in
 * the Theme table, edited by the platform admin. A built-in theme with no row falls back to the code's own definition, so nothing depends on the
 * table having been filled in first.
 */

export const THEME_PRICE_MODELS = ["FREE", "ONE_TIME", "MONTHLY"] as const;
export type ThemePriceModel = (typeof THEME_PRICE_MODELS)[number];
export const THEME_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type ThemeStatus = (typeof THEME_STATUSES)[number];

/** A monthly theme purchase lasts this long. */
export const MONTHLY_THEME_DAYS = 30;

export interface CatalogTheme {
  id: string;
  name: string;
  blurb: string;
  audience: string;
  source: "BUILTIN" | "PACKAGE";
  status: ThemeStatus;
  priceModel: ThemePriceModel;
  /** Taka. Zero for a free theme. */
  price: number;
  /** Plan tiers that get the theme without paying. */
  includedPlans: string[];
  premium: boolean;
}

export interface ThemeRow {
  id: string;
  name: string;
  blurb: string;
  audience: string;
  source: string;
  status: string;
  priceModel: string;
  priceBdt: { toString(): string } | number;
  includedPlans: string[];
}

const asModel = (v: string): ThemePriceModel => (THEME_PRICE_MODELS as readonly string[]).includes(v) ? (v as ThemePriceModel) : "FREE";
const asStatus = (v: string): ThemeStatus => (THEME_STATUSES as readonly string[]).includes(v) ? (v as ThemeStatus) : "PUBLISHED";

/** What the code says about a built-in theme, used until the platform admin saves a row for it. */
function fromCode(t: (typeof ALL_THEMES)[number]): CatalogTheme {
  const premium = isPremiumTheme(t.id);
  return { id: t.id, name: t.name, blurb: t.blurb, audience: t.audience, source: "BUILTIN", status: "PUBLISHED", priceModel: premium ? "ONE_TIME" : "FREE", price: premium ? PREMIUM_THEME_PRICE : 0, includedPlans: [], premium };
}

function fromRow(r: ThemeRow): CatalogTheme {
  const priceModel = asModel(r.priceModel);
  const price = priceModel === "FREE" ? 0 : Number(r.priceBdt.toString());
  return { id: r.id, name: r.name, blurb: r.blurb, audience: r.audience, source: r.source === "PACKAGE" ? "PACKAGE" : "BUILTIN", status: asStatus(r.status), priceModel, price, includedPlans: r.includedPlans, premium: priceModel !== "FREE" };
}

/**
 * Every theme a store can see, in the code's order first: the rows override the code's defaults, a theme with no row keeps them, and a theme
 * the admin has archived or left as a draft is hidden. Uploaded themes (no definition in code) follow after the built-in ones.
 */
export function mergeCatalogue(rows: ThemeRow[]): CatalogTheme[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: CatalogTheme[] = ALL_THEMES.map((t) => { const row = byId.get(t.id); return row ? fromRow(row) : fromCode(t); });
  const known = new Set(ALL_THEMES.map((t) => t.id as string));
  for (const r of rows) if (!known.has(r.id)) out.push(fromRow(r));
  return out.filter((t) => t.status === "PUBLISHED");
}

type ThemeReader = { theme: { findMany(args?: object): Promise<ThemeRow[]> } };

/** The catalogue as a store sees it. Works inside a tenant transaction (the app role can read published rows only). */
export async function loadCatalogue(db: ThemeReader): Promise<CatalogTheme[]> {
  return mergeCatalogue(await db.theme.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }));
}

export function catalogTheme(catalogue: CatalogTheme[], id: string): CatalogTheme | null {
  return catalogue.find((t) => t.id === id) ?? null;
}

// ---- Who may use a theme ------------------------------------------------------------------------------------------------

/** FREE and INCLUDED need no payment. OWNED is a paid, approved purchase that has not run out. PENDING is a payment waiting to be checked. */
export type ThemeAccessState = "FREE" | "INCLUDED" | "OWNED" | "PENDING" | "LOCKED";

export interface ThemeAccess {
  state: ThemeAccessState;
  /** For an OWNED monthly theme, when it ends. Null for lifetime ownership and for every other state. */
  expiresAt: Date | null;
  /** True when the store did buy this theme but the month has run out, so the owner knows to renew rather than buy for the first time. */
  expired: boolean;
}

export interface PurchaseFact { status: string; expiresAt: Date | null }

/** The single entitlement rule. A purchase, a plan that includes the theme, or the theme being free: nothing else grants access. */
export function themeAccessFor(theme: CatalogTheme, planTier: string | null, purchases: PurchaseFact[], now: Date = new Date()): ThemeAccess {
  if (!theme.premium) return { state: "FREE", expiresAt: null, expired: false };
  if (planTier && theme.includedPlans.includes(planTier)) return { state: "INCLUDED", expiresAt: null, expired: false };
  const live = purchases.filter((p) => p.status === "APPROVED" && (p.expiresAt === null || p.expiresAt.getTime() > now.getTime()));
  if (live.length > 0) {
    const forever = live.some((p) => p.expiresAt === null);
    const latest = live.reduce((m, p) => (p.expiresAt && p.expiresAt.getTime() > m ? p.expiresAt.getTime() : m), 0);
    return { state: "OWNED", expiresAt: forever || latest === 0 ? null : new Date(latest), expired: false };
  }
  if (purchases.some((p) => p.status === "PENDING")) return { state: "PENDING", expiresAt: null, expired: false };
  return { state: "LOCKED", expiresAt: null, expired: purchases.some((p) => p.status === "APPROVED") };
}

export const canUseState = (s: ThemeAccessState): boolean => s === "FREE" || s === "INCLUDED" || s === "OWNED";

/** The store's plan tier, read inside its own transaction. */
export async function currentPlanTier(tx: TenantTx): Promise<string | null> {
  return (await tx.subscription.findFirst({ select: { planTier: true } }))?.planTier ?? null;
}

/** Whether the store (the transaction's tenant) may use this theme right now. Unknown or hidden themes are not usable. */
export async function themeAccess(tx: TenantTx, themeId: string, now: Date = new Date()): Promise<ThemeAccess | null> {
  const theme = catalogTheme(await loadCatalogue(tx), themeId);
  if (!theme) return null;
  const [planTier, purchases] = await Promise.all([
    currentPlanTier(tx),
    theme.premium ? tx.themePurchase.findMany({ where: { themeId }, select: { status: true, expiresAt: true } }) : Promise.resolve([]),
  ]);
  return themeAccessFor(theme, planTier, purchases, now);
}

/** When a purchase approved at `from` runs out: a monthly theme lasts MONTHLY_THEME_DAYS, extended from the current end when renewed early. Null is for life. */
export function purchaseExpiry(model: ThemePriceModel, from: Date, currentEnd: Date | null = null): Date | null {
  if (model !== "MONTHLY") return null;
  const base = currentEnd && currentEnd.getTime() > from.getTime() ? currentEnd : from;
  return new Date(base.getTime() + MONTHLY_THEME_DAYS * 24 * 60 * 60 * 1000);
}

// ---- Platform admin -------------------------------------------------------------------------------------------------------

export interface PlatformThemeRow extends CatalogTheme {
  /** Whether a row has been saved for it (false: still on the code's defaults). */
  saved: boolean;
}

/** Every theme, including archived and draft ones, for the platform admin. */
export async function listThemeCatalogue(actor: PlatformActor, db: PrismaClient = getPlatformPrisma()): Promise<PlatformThemeRow[]> {
  assertPlatformCan(actor, "plans", "view");
  const rows = await db.theme.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: PlatformThemeRow[] = ALL_THEMES.map((t) => { const row = byId.get(t.id); return row ? { ...fromRow(row), saved: true } : { ...fromCode(t), saved: false }; });
  const known = new Set(ALL_THEMES.map((t) => t.id as string));
  for (const r of rows) if (!known.has(r.id)) out.push({ ...fromRow(r), saved: true });
  return out;
}

/** Writes a row for every built-in theme that has none, from the code's definition. Never overwrites a row the admin has edited. */
export async function syncBuiltinThemes(db: PrismaClient = getPlatformPrisma()): Promise<number> {
  const have = new Set((await db.theme.findMany({ select: { id: true } })).map((r) => r.id));
  let made = 0;
  for (const [i, t] of ALL_THEMES.entries()) {
    if (have.has(t.id)) continue;
    const c = fromCode(t);
    await db.theme.create({ data: { id: t.id, name: t.name, blurb: t.blurb, audience: t.audience, source: "BUILTIN", status: "PUBLISHED", priceModel: c.priceModel, priceBdt: c.price, includedPlans: [], defaults: t.defaults as unknown as Prisma.InputJsonValue, sortOrder: i } });
    made++;
  }
  return made;
}

export const ThemePricingInput = z.object({
  status: z.enum(THEME_STATUSES),
  priceModel: z.enum(THEME_PRICE_MODELS),
  priceBdt: z.coerce.number().min(0, "The price cannot be negative").max(100000, "That price looks too high"),
  includedPlans: z.array(z.enum(["STARTER", "PRO", "BUSINESS", "ENTERPRISE"])).default([]),
}).refine((v) => v.priceModel === "FREE" || v.priceBdt >= 1, { message: "A paid theme needs a price of at least 1 taka", path: ["priceBdt"] });

/** Sets whether a theme is free or paid, its price, its plans and whether it is published. Creates the row from the code's definition on first save. */
export async function updateThemePricing(actor: PlatformActor, themeId: string, raw: unknown, db: PrismaClient = getPlatformPrisma()): Promise<void> {
  assertPlatformCan(actor, "plans", "edit");
  const parsed = ThemePricingInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the form");
  const input = parsed.data;
  const builtin = ALL_THEMES.find((t) => t.id === themeId);
  const existing = await db.theme.findUnique({ where: { id: themeId } });
  if (!existing && !builtin) throw new NotFoundError("Theme");
  const price = input.priceModel === "FREE" ? 0 : input.priceBdt;
  const data = { status: input.status, priceModel: input.priceModel, priceBdt: price, includedPlans: input.includedPlans };
  await db.$transaction(async (tx) => {
    if (existing) await tx.theme.update({ where: { id: themeId }, data });
    else await tx.theme.create({ data: { id: themeId, name: builtin!.name, blurb: builtin!.blurb, audience: builtin!.audience, source: "BUILTIN", defaults: builtin!.defaults as unknown as Prisma.InputJsonValue, ...data } });
    await tx.platformAuditLog.create({ data: { actorId: actor.id, action: "theme.pricing_updated", details: { themeId, ...data }, ipAddress: actor.ip ?? null } });
  });
}
