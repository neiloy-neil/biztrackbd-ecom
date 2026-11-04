import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPlatformPrisma, type PrismaClient, type TenantTx } from "@biztrackbd/db";
import { ValidationError, NotFoundError } from "../errors";
import { assertPlatformCan, type PlatformActor } from "./admin";
import { catalogTheme, loadCatalogue, mergeCatalogue, type CatalogTheme, type ThemePriceModel } from "./theme-catalogue";

/**
 * Theme discount codes and bundles. Every price is worked out here on the server from the catalogue, the bundle and the code: the browser only
 * says WHAT it wants (a theme or a bundle, and a code) and never HOW MUCH. The amount stored on a ThemePurchase is what was actually charged.
 *
 * A bundle is one payment that unlocks several themes. It is stored as one ThemePurchase row per theme, sharing a groupId, with the one price
 * split across the rows, so access (themeAccessFor) and revenue (which sums the rows) keep working and the money is counted once.
 */

export const DISCOUNT_KINDS = ["PERCENT", "FIXED"] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

/** A purchase is never discounted below this many taka: a payment gateway cannot take nothing, and free themes have their own switch. */
export const MIN_CHARGE_BDT = 1;

const CODE = /^[A-Z0-9_-]{3,32}$/;
export const normalizeDiscountCode = (raw: string): string => raw.trim().toUpperCase();

const cents = (n: number) => Math.round(n * 100);
const taka = (c: number) => c / 100;

export interface DiscountRule { kind: string; value: number; themeIds: string[] }

/** Taka taken off a list price (cents in, cents out). A percent rounds to the nearest paisa; nothing takes the price below MIN_CHARGE_BDT. */
export function discountCents(listCents: number, rule: Pick<DiscountRule, "kind" | "value">): number {
  const raw = rule.kind === "PERCENT" ? Math.round((listCents * rule.value) / 100) : cents(rule.value);
  return Math.max(0, Math.min(raw, listCents - cents(MIN_CHARGE_BDT)));
}

/** Splits `total` cents over rows in proportion to `weights`, so the parts add up to the total exactly (the leftover paisa go to the first rows). */
export function splitCents(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  const parts = weights.map((w) => (sum > 0 ? Math.floor((total * w) / sum) : Math.floor(total / weights.length)));
  let left = total - parts.reduce((a, b) => a + b, 0);
  for (let i = 0; left > 0; i = (i + 1) % parts.length, left--) parts[i]! += 1;
  return parts;
}

export interface ThemeBundleRow { id: string; name: string; blurb: string; themeIds: string[]; priceModel: string; priceBdt: { toString(): string } | number; active: boolean }
export interface DiscountRow { id: string; code: string; kind: string; value: { toString(): string } | number; expiresAt: Date | null; maxUses: number | null; usedCount: number; themeIds: string[]; active: boolean }

type Reader = {
  themeBundle: { findMany(args?: object): Promise<ThemeBundleRow[]>; findUnique(args: object): Promise<ThemeBundleRow | null> };
  themeDiscount: { findUnique(args: object): Promise<DiscountRow | null> };
};

const bundleModel = (b: { priceModel: string }): ThemePriceModel => (b.priceModel === "MONTHLY" ? "MONTHLY" : "ONE_TIME");

export interface BundleItem {
  id: string; name: string; blurb: string; priceModel: ThemePriceModel; price: number;
  themes: { id: string; name: string }[];
  /** What the themes cost one by one, to show the saving. */
  listPrice: number;
}

/** The active bundles a store can see, with the themes still on sale (a bundle theme the admin archived drops out of it). */
export async function loadBundles(db: Pick<Reader, "themeBundle">, catalogue: CatalogTheme[]): Promise<BundleItem[]> {
  const rows = await db.themeBundle.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return rows.map((b) => {
    const themes = b.themeIds.map((id) => catalogTheme(catalogue, id)).filter((t): t is CatalogTheme => Boolean(t?.premium));
    return { id: b.id, name: b.name, blurb: b.blurb, priceModel: bundleModel(b), price: Number(b.priceBdt.toString()), themes: themes.map((t) => ({ id: t.id, name: t.name })), listPrice: themes.reduce((n, t) => n + t.price, 0) };
  }).filter((b) => b.themes.length >= 2);
}

export interface ThemeQuote {
  kind: "THEME" | "BUNDLE";
  /** What the store is buying: a theme id or a bundle id. */
  ref: string;
  label: string;
  bundleId: string | null;
  /** The themes that get a purchase row (a bundle theme the store already owns for life is left out). */
  themeIds: string[];
  /** The weights used to split a bundle price over its rows: each theme's own list price. */
  weights: number[];
  priceModel: ThemePriceModel;
  listPrice: number;
  discount: number;
  /** What the store pays. Always at least MIN_CHARGE_BDT. */
  total: number;
  code: string | null;
  codeId: string | null;
}

export interface QuoteInput { themeId?: string | null; bundleId?: string | null; code?: string | null }

function codeProblem(row: DiscountRow | null, themeIds: string[], now: Date): string | null {
  if (!row || !row.active) return "That code is not valid.";
  if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) return "That code has expired.";
  if (row.maxUses !== null && row.usedCount >= row.maxUses) return "That code has been used up.";
  if (row.themeIds.length > 0 && !themeIds.every((id) => row.themeIds.includes(id))) return themeIds.length > 1 ? "That code does not cover every theme in this bundle." : "That code does not work for this theme.";
  return null;
}

/**
 * What it costs this store to buy a theme or a bundle with this code, right now. Throws a message a person can read when the theme or bundle is
 * not for sale, the store already has it, or the code is unusable. `ownedForever` is the set of theme ids the store holds a lifetime purchase of.
 */
export function priceThemePurchase(args: {
  catalogue: CatalogTheme[]; bundles: ThemeBundleRow[];
  input: QuoteInput; code: DiscountRow | null; ownedForever: Set<string>; usable: Set<string>; included?: Set<string>; now?: Date; ignoreCodeLimits?: boolean;
}): ThemeQuote {
  const { catalogue, input, ownedForever, usable } = args;
  const now = args.now ?? new Date();
  let kind: ThemeQuote["kind"], ref: string, label: string, bundleId: string | null = null, themeIds: string[], priceModel: ThemePriceModel, list: number;
  let coverage: string[];
  if (input.bundleId) {
    const b = args.bundles.find((x) => x.id === input.bundleId && x.active);
    if (!b) throw new ValidationError("That bundle is not available.", { field: "bundleId" });
    const themes = b.themeIds.map((id) => catalogTheme(catalogue, id)).filter((t): t is CatalogTheme => Boolean(t?.premium));
    if (themes.length < 2) throw new ValidationError("That bundle is not available.", { field: "bundleId" });
    coverage = themes.map((t) => t.id);
    if (themes.every((t) => usable.has(t.id) && (ownedForever.has(t.id) || bundleModel(b) === "ONE_TIME"))) throw new ValidationError("You already have every theme in this bundle.");
    kind = "BUNDLE"; ref = b.id; label = b.name; bundleId = b.id; priceModel = bundleModel(b); list = Number(b.priceBdt.toString());
    themeIds = themes.filter((t) => !ownedForever.has(t.id)).map((t) => t.id);
  } else {
    const t = catalogTheme(catalogue, String(input.themeId ?? "").trim().toLowerCase());
    if (!t) throw new ValidationError("That theme is not available.", { field: "themeId" });
    if (!t.premium) throw new ValidationError("That theme is free. Just apply it.", { field: "themeId" });
    kind = "THEME"; ref = t.id; label = t.name; themeIds = [t.id]; coverage = [t.id]; priceModel = t.priceModel; list = t.price;
  }
  const weights = themeIds.map((id) => catalogTheme(catalogue, id)?.price ?? 1);
  let discount = 0, code: string | null = null, codeId: string | null = null;
  if (args.code) {
    const fits = args.code.themeIds.length === 0 || coverage.every((id) => args.code!.themeIds.includes(id));
    if (!args.ignoreCodeLimits) {
      const problem = codeProblem(args.code, coverage, now);
      if (problem) throw new ValidationError(problem, { field: "code" });
    }
    // With ignoreCodeLimits (a payment already made) a code that has since expired or run out still counts, but one that never fit what was bought does not.
    if (fits) {
      discount = taka(discountCents(cents(list), { kind: args.code.kind, value: Number(args.code.value.toString()) }));
      code = args.code.code; codeId = args.code.id;
    }
  }
  return { kind, ref, label, bundleId, themeIds, weights, priceModel, listPrice: list, discount, total: taka(cents(list) - cents(discount)), code, codeId };
}

/** The store-side quote: reads the catalogue, bundles, the code and what the store already holds inside its own transaction. */
export async function quoteThemePurchase(tx: TenantTx, input: QuoteInput, now: Date = new Date()): Promise<ThemeQuote> {
  const rawCode = input.code ? normalizeDiscountCode(input.code) : "";
  if (rawCode && !CODE.test(rawCode)) throw new ValidationError("That code is not valid.", { field: "code" });
  const db = tx as unknown as Reader;
  const [catalogue, bundles, purchases, plan] = await Promise.all([
    loadCatalogue(tx),
    db.themeBundle.findMany({ where: { active: true } }),
    tx.themePurchase.findMany({ select: { themeId: true, status: true, expiresAt: true } }),
    tx.subscription.findFirst({ select: { planTier: true } }),
  ]);
  const ownedForever = new Set<string>();
  const usable = new Set<string>();
  const included = new Set<string>();
  for (const t of catalogue.filter((x) => x.premium)) {
    const mine = purchases.filter((p) => p.themeId === t.id && p.status === "APPROVED");
    if (mine.some((p) => p.expiresAt === null)) ownedForever.add(t.id);
    if (mine.some((p) => p.expiresAt === null || p.expiresAt.getTime() > now.getTime())) usable.add(t.id);
    if (plan?.planTier && t.includedPlans.includes(plan.planTier)) { usable.add(t.id); ownedForever.add(t.id); included.add(t.id); }
  }
  const codeRow = rawCode ? await db.themeDiscount.findUnique({ where: { code: rawCode } }) : null;
  if (rawCode && !codeRow) throw new ValidationError("That code is not valid.", { field: "code" });
  const quote = priceThemePurchase({ catalogue, bundles, input, code: codeRow, ownedForever, usable, now });
  // A single theme the store already has cannot be bought again (a monthly theme can be renewed while it is running).
  if (quote.kind === "THEME") {
    const id = quote.themeIds[0]!;
    if (included.has(id)) throw new ValidationError("Your plan already includes this theme.");
    if (usable.has(id) && !(quote.priceModel === "MONTHLY")) throw new ValidationError("You already own this theme.");
  }
  return quote;
}

/** The rows one payment writes: each theme's share of the price, and of the discount. Their amounts add up to quote.total exactly. */
export function purchaseShares(quote: ThemeQuote): { themeId: string; amount: number; discountAmount: number }[] {
  const total = splitCents(cents(quote.total), quote.weights);
  const off = splitCents(cents(quote.discount), quote.weights);
  return quote.themeIds.map((themeId, i) => ({ themeId, amount: taka(total[i]!), discountAmount: taka(off[i]!) }));
}

/** Names of the trx ids of a payment's rows: the first row keeps the real TrxID, the others get a suffix so the unique index still holds. */
export const groupTrxId = (trxId: string, index: number): string => (index === 0 ? trxId : `${trxId}:${index}`);

export function newPaymentGroup(): string { return randomUUID(); }

// ---- Platform admin: codes -----------------------------------------------------------------------------------------------

export interface DiscountView {
  id: string; code: string; kind: DiscountKind; value: number; expiresAt: Date | null; maxUses: number | null; usedCount: number; themeIds: string[]; active: boolean; note: string | null;
  /** Taka taken off by purchases that were not rejected, and what those purchases paid. */
  discountGiven: number; revenue: number;
  expired: boolean; usedUp: boolean;
}

export async function listThemeDiscounts(actor: PlatformActor, db: PrismaClient = getPlatformPrisma(), now: Date = new Date()): Promise<DiscountView[]> {
  assertPlatformCan(actor, "plans", "view");
  const [rows, sums] = await Promise.all([
    db.themeDiscount.findMany({ orderBy: { createdAt: "desc" } }),
    db.themePurchase.groupBy({ by: ["discountCode"], where: { discountCode: { not: null }, status: { not: "REJECTED" } }, _sum: { discountAmount: true, amount: true } }),
  ]);
  const by = new Map(sums.map((s) => [s.discountCode, s._sum]));
  return rows.map((r) => ({
    id: r.id, code: r.code, kind: r.kind === "FIXED" ? "FIXED" : "PERCENT", value: Number(r.value), expiresAt: r.expiresAt, maxUses: r.maxUses, usedCount: r.usedCount, themeIds: r.themeIds, active: r.active, note: r.note,
    discountGiven: Number(by.get(r.code)?.discountAmount ?? 0), revenue: Number(by.get(r.code)?.amount ?? 0),
    expired: Boolean(r.expiresAt && r.expiresAt.getTime() <= now.getTime()), usedUp: r.maxUses !== null && r.usedCount >= r.maxUses,
  }));
}

const optionalDate = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.date().nullable());
const optionalInt = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().int("Max uses must be a whole number").min(1, "Max uses must be at least 1").max(1_000_000).nullable());

export const ThemeDiscountInput = z.object({
  code: z.string().transform(normalizeDiscountCode).pipe(z.string().regex(CODE, "A code is 3 to 32 letters, numbers, dashes or underscores")),
  kind: z.enum(DISCOUNT_KINDS),
  value: z.coerce.number().positive("The discount must be more than zero").max(100000),
  expiresAt: optionalDate,
  maxUses: optionalInt,
  themeIds: z.array(z.string().trim().toLowerCase()).default([]),
  note: z.string().trim().max(200).optional().transform((v) => v || null),
}).refine((v) => v.kind !== "PERCENT" || v.value <= 99, { message: "A percent discount is 1 to 99", path: ["value"] });

/** Makes a code, or changes an existing one by id (its use count is kept). */
export async function saveThemeDiscount(actor: PlatformActor, raw: unknown, id: string | null = null, db: PrismaClient = getPlatformPrisma()): Promise<void> {
  assertPlatformCan(actor, "plans", "edit");
  const parsed = ThemeDiscountInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the form");
  const d = parsed.data;
  const catalogue = mergeCatalogue(await db.theme.findMany());
  for (const t of d.themeIds) if (!catalogue.some((c) => c.id === t && c.premium)) throw new ValidationError(`"${t}" is not a premium theme`, { field: "themeIds" });
  const data = { code: d.code, kind: d.kind, value: d.value, expiresAt: d.expiresAt, maxUses: d.maxUses, themeIds: d.themeIds, note: d.note };
  try {
    await db.$transaction(async (tx) => {
      if (id) {
        if (!(await tx.themeDiscount.findUnique({ where: { id } }))) throw new NotFoundError("Discount code");
        await tx.themeDiscount.update({ where: { id }, data });
      } else await tx.themeDiscount.create({ data });
      await tx.platformAuditLog.create({ data: { actorId: actor.id, action: id ? "theme.discount_updated" : "theme.discount_created", details: { code: d.code, kind: d.kind, value: d.value, maxUses: d.maxUses, themeIds: d.themeIds }, ipAddress: actor.ip ?? null } });
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new ValidationError("That code already exists.", { field: "code" });
    throw e;
  }
}

/** Switches a code on or off. A code that has been used is never deleted (the revenue page and the audit trail refer to it), only switched off. */
export async function setThemeDiscountActive(actor: PlatformActor, id: string, active: boolean, db: PrismaClient = getPlatformPrisma()): Promise<void> {
  assertPlatformCan(actor, "plans", "edit");
  const row = await db.themeDiscount.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Discount code");
  await db.$transaction([
    db.themeDiscount.update({ where: { id }, data: { active } }),
    db.platformAuditLog.create({ data: { actorId: actor.id, action: active ? "theme.discount_enabled" : "theme.discount_disabled", details: { code: row.code }, ipAddress: actor.ip ?? null } }),
  ]);
}

// ---- Platform admin: bundles -----------------------------------------------------------------------------------------------

export interface BundleView { id: string; name: string; blurb: string; themeIds: string[]; priceModel: ThemePriceModel; price: number; active: boolean; listPrice: number; sold: number }

export async function listThemeBundles(actor: PlatformActor, db: PrismaClient = getPlatformPrisma()): Promise<BundleView[]> {
  assertPlatformCan(actor, "plans", "view");
  const [rows, themes, sold] = await Promise.all([
    db.themeBundle.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.theme.findMany(),
    db.themePurchase.groupBy({ by: ["bundleId"], where: { bundleId: { not: null }, status: { not: "REJECTED" }, leadRow: true }, _count: { _all: true } }),
  ]);
  const catalogue = mergeCatalogue(themes);
  const soldBy = new Map(sold.map((s) => [s.bundleId, s._count._all]));
  return rows.map((b) => ({
    id: b.id, name: b.name, blurb: b.blurb, themeIds: b.themeIds, priceModel: bundleModel(b), price: Number(b.priceBdt), active: b.active,
    listPrice: b.themeIds.reduce((n, id) => n + (catalogTheme(catalogue, id)?.price ?? 0), 0), sold: soldBy.get(b.id) ?? 0,
  }));
}

export const ThemeBundleInput = z.object({
  id: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,39}$/, "The bundle id is 2 to 40 lower-case letters, numbers or dashes"),
  name: z.string().trim().min(2, "Give the bundle a name").max(60),
  blurb: z.string().trim().max(200).default(""),
  themeIds: z.array(z.string().trim().toLowerCase()).min(2, "A bundle needs at least two themes").max(20),
  priceModel: z.enum(["ONE_TIME", "MONTHLY"]),
  priceBdt: z.coerce.number().min(1, "The bundle price must be at least 1 taka").max(100000, "That price looks too high"),
  active: z.boolean().default(true),
});

export async function saveThemeBundle(actor: PlatformActor, raw: unknown, db: PrismaClient = getPlatformPrisma()): Promise<void> {
  assertPlatformCan(actor, "plans", "edit");
  const parsed = ThemeBundleInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the form");
  const b = parsed.data;
  const ids = [...new Set(b.themeIds)];
  if (ids.length < 2) throw new ValidationError("A bundle needs at least two different themes", { field: "themeIds" });
  const catalogue = mergeCatalogue(await db.theme.findMany());
  for (const t of ids) if (!catalogue.some((c) => c.id === t && c.premium)) throw new ValidationError(`"${t}" is not a premium theme on sale`, { field: "themeIds" });
  const data = { name: b.name, blurb: b.blurb, themeIds: ids, priceModel: b.priceModel, priceBdt: b.priceBdt, active: b.active };
  const existing = await db.themeBundle.findUnique({ where: { id: b.id } });
  await db.$transaction(async (tx) => {
    if (existing) await tx.themeBundle.update({ where: { id: b.id }, data });
    else await tx.themeBundle.create({ data: { id: b.id, ...data } });
    await tx.platformAuditLog.create({ data: { actorId: actor.id, action: existing ? "theme.bundle_updated" : "theme.bundle_created", details: { id: b.id, ...data }, ipAddress: actor.ip ?? null } });
  });
}

/** Hides a bundle from stores. Bundles are never deleted: purchases refer to them. */
export async function setThemeBundleActive(actor: PlatformActor, id: string, active: boolean, db: PrismaClient = getPlatformPrisma()): Promise<void> {
  assertPlatformCan(actor, "plans", "edit");
  if (!(await db.themeBundle.findUnique({ where: { id } }))) throw new NotFoundError("Bundle");
  await db.$transaction([
    db.themeBundle.update({ where: { id }, data: { active } }),
    db.platformAuditLog.create({ data: { actorId: actor.id, action: active ? "theme.bundle_enabled" : "theme.bundle_disabled", details: { id }, ipAddress: actor.ip ?? null } }),
  ]);
}
