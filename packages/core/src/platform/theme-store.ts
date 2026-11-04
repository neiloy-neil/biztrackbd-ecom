import { z } from "zod";
import { Prisma, getPlatformPrisma, withTenant, type PrismaClient, type TenantTx } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { assertCan, type StaffActor } from "../permissions";
import { NotFoundError, ValidationError } from "../errors";
import { normalizeBdPhone } from "../phone";
import { themeDefinition } from "../builder/theme";
import { canUseState, catalogTheme, currentPlanTier, loadCatalogue, purchaseExpiry, themeAccess, themeAccessFor, type ThemeAccessState, type ThemePriceModel } from "./theme-catalogue";
import { assertNotInDemo } from "../demo/guard";
import { paymentTargets, type PayTo } from "./billing";
import { createUddoktaPayCharge, getPlatformUddoktaPayCredentials, uddoktaPayPlanUrls } from "../payments/uddoktapay";
import { assertPlatformCan, type PlatformActor } from "./admin";
import { isPreviewAddress } from "./template-bundle";
import { groupTrxId, loadBundles, newPaymentGroup, purchaseShares, quoteThemePurchase, type BundleItem, type ThemeQuote } from "./theme-pricing";

/**
 * The themes page of the merchant admin: every theme with whether the store can use it now. Free themes are always usable. A premium theme costs
 * PREMIUM_THEME_PRICE once, paid by mobile money and checked by the platform like a plan payment; once approved the store owns it for life.
 */

export type ThemeStoreState = ThemeAccessState;

export interface ThemeStoreItem {
  id: string;
  name: string;
  blurb: string;
  audience: string;
  premium: boolean;
  price: number;
  priceModel: ThemePriceModel;
  accent: string | null;
  background: string | null;
  /** For a monthly theme the store owns, when the month ends. */
  expiresAt: Date | null;
  /** The store bought it before but the month has run out. */
  expired: boolean;
  state: ThemeStoreState;
  active: boolean;
  /** The reason the last payment for this theme was turned down, shown so the owner can try again. */
  lastRejection: string | null;
  /** A picture of the theme uploaded with its package (a zip), or null: the card then falls back to its built-in picture or colours. */
  preview: string | null;
}

export interface ThemeStoreBundle extends BundleItem {
  /** OWNED: every theme is already the store's for good. PENDING: a payment for it is being checked. */
  state: "AVAILABLE" | "PENDING" | "OWNED";
  /** Every theme is running but the bundle is monthly, so paying again extends it. */
  renew: boolean;
  lastRejection: string | null;
}

export interface ThemeStoreView {
  active: string;
  themes: ThemeStoreItem[];
  bundles: ThemeStoreBundle[];
  payTo: PayTo[];
  /** Whether the platform has UddoktaPay set up, so the owner can pay online and unlock the theme at once. */
  online: boolean;
}

const TRX = /^[A-Z0-9]{8,12}$/;

/** Whether the store may use this theme now: it is free, its plan includes it, or it holds a paid purchase that has not run out. */
export async function ownsPremiumTheme(tx: TenantTx, themeId: string): Promise<boolean> {
  const access = await themeAccess(tx, themeId);
  return access ? canUseState(access.state) : false;
}

/** Whether a store may add the premium tools (size chart, shade finder and the rest) to its pages: it can use at least one premium theme. */
export async function hasPremiumTools(tenantId: string): Promise<boolean> {
  return withTenant(tenantId, async (tx) => {
    if ((await tx.tenant.findFirst({ select: { isDemo: true } }))?.isDemo) return true;
    const [catalogue, planTier, purchases] = await Promise.all([loadCatalogue(tx), currentPlanTier(tx), tx.themePurchase.findMany({ select: { themeId: true, status: true, expiresAt: true } })]);
    return catalogue.filter((t) => t.premium).some((t) => {
      const state = themeAccessFor(t, planTier, purchases.filter((p) => p.themeId === t.id)).state;
      return state === "INCLUDED" || state === "OWNED";
    });
  });
}

/** The desktop picture of each uploaded theme (source PACKAGE), from the template it was made from. */
async function packagePreviews(tx: TenantTx, catalogue: { id: string; source: string }[]): Promise<Map<string, string>> {
  const ids = catalogue.filter((t) => t.source === "PACKAGE").map((t) => t.id);
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  for (const r of await tx.template.findMany({ where: { id: { in: ids } }, select: { id: true, pagesJson: true } })) {
    const pv = (((r.pagesJson as Record<string, unknown> | null)?._meta ?? null) as { previews?: { desktop?: unknown; mobile?: unknown } } | null)?.previews;
    const pick = [pv?.desktop, pv?.mobile].find((v): v is string => typeof v === "string" && isPreviewAddress(v));
    if (pick) out.set(r.id, pick);
  }
  return out;
}

export async function listThemeStore(tenantId: string, actor: StaffActor): Promise<ThemeStoreView> {
  assertCan(actor, "design", "view");
  const { tenant, purchases, catalogue, planTier, bundles, previews } = await withTenant(tenantId, async (tx) => {
    const catalogue = await loadCatalogue(tx);
    return {
      tenant: await tx.tenant.findFirstOrThrow({ select: { themeId: true } }),
      purchases: await tx.themePurchase.findMany({ orderBy: { createdAt: "desc" }, select: { themeId: true, status: true, rejectionReason: true, expiresAt: true, bundleId: true } }),
      catalogue,
      planTier: await currentPlanTier(tx),
      bundles: await loadBundles(tx, catalogue),
      previews: await packagePreviews(tx, catalogue),
    };
  });
  const themes = catalogue.map((t): ThemeStoreItem => {
    const mine = purchases.filter((p) => p.themeId === t.id);
    const access = themeAccessFor(t, planTier, mine);
    const rejected = mine.find((p) => p.status === "REJECTED");
    return { id: t.id, name: t.name, blurb: t.blurb, audience: t.audience, premium: t.premium, price: t.price, priceModel: t.priceModel, accent: t.accent, background: t.background, expiresAt: access.expiresAt, expired: access.expired, state: access.state, active: tenant.themeId === t.id, lastRejection: access.state === "LOCKED" ? rejected?.rejectionReason ?? null : null, preview: previews.get(t.id) ?? null };
  });
  const byId = new Map(themes.map((t) => [t.id, t]));
  const bundleItems = bundles.map((b): ThemeStoreBundle => {
    const mine = purchases.filter((p) => p.bundleId === b.id);
    const all = b.themes.every((t) => { const it = byId.get(t.id); return it ? canUseState(it.state) : false; });
    return { ...b, state: mine.some((p) => p.status === "PENDING") ? "PENDING" : all && b.priceModel === "ONE_TIME" ? "OWNED" : "AVAILABLE", renew: all && b.priceModel === "MONTHLY", lastRejection: mine.find((p) => p.status === "REJECTED")?.rejectionReason ?? null };
  });
  return { active: themeDefinition(tenant.themeId).id, themes, bundles: bundleItems, payTo: paymentTargets(), online: Boolean(await getPlatformUddoktaPayCredentials().catch(() => null)) };
}

export const ThemePurchaseInput = z.object({
  themeId: z.string().trim().toLowerCase().default(""),
  bundleId: z.string().trim().toLowerCase().default(""),
  code: z.string().trim().default(""),
  provider: z.enum(["BKASH", "NAGAD", "ROCKET", "UPAY"]),
  senderNumber: z.string().trim().min(1, "Enter the number you sent from"),
  trxId: z.string().trim().toUpperCase(),
});

/** What a theme or bundle costs this store with this code, worked out here. The checkout shows it before the owner pays. */
export interface ThemeQuoteView { kind: "THEME" | "BUNDLE"; label: string; listPrice: number; discount: number; total: number; code: string | null; priceModel: ThemePriceModel }

const quoteView = (q: ThemeQuote): ThemeQuoteView => ({ kind: q.kind, label: q.label, listPrice: q.listPrice, discount: q.discount, total: q.total, code: q.code, priceModel: q.priceModel });

export async function quoteThemeCheckout(tenantId: string, actor: StaffActor, input: { themeId?: string; bundleId?: string; code?: string }): Promise<ThemeQuoteView> {
  assertCan(actor, "billing", "edit");
  return quoteView(await withTenant(tenantId, (tx) => quoteThemePurchase(tx, input)));
}

/**
 * The owner has sent the money and says so. The price is read here (the theme or bundle, less any code), never from the browser. A store can only
 * have one payment waiting per theme. A bundle writes one row per theme, sharing one payment group, and the platform approves them together.
 */
export async function submitThemePurchase(tenantId: string, actor: StaffActor, raw: unknown): Promise<void> {
  await assertNotInDemo(tenantId, "Buying a theme");
  assertCan(actor, "billing", "edit");
  const parsed = ThemePurchaseInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the form");
  const input = parsed.data;
  if (!input.themeId && !input.bundleId) throw new ValidationError("Choose a theme or a bundle.", { field: "themeId" });
  if (!TRX.test(input.trxId)) throw new ValidationError("That transaction ID does not look right. It is 8 to 12 letters and numbers.", { field: "trxId" });
  let sender: string;
  try { sender = normalizeBdPhone(input.senderNumber); } catch { throw new ValidationError("Enter the mobile number you sent the money from, like 01712345678", { field: "senderNumber" }); }
  try {
    await withTenant(tenantId, async (tx) => {
      const quote = await quoteThemePurchase(tx, { themeId: input.themeId, bundleId: input.bundleId, code: input.code });
      if (await tx.themePurchase.findFirst({ where: { themeId: { in: quote.themeIds }, status: "PENDING" } })) throw new ValidationError("You already have a payment for this theme waiting to be checked. We will confirm it soon.");
      // A TrxID used for a plan payment must not be reused here (the two tables each keep their own unique index).
      if (await tx.paymentProof.findFirst({ where: { trxId: input.trxId } })) throw new ValidationError("That transaction ID has already been used.", { field: "trxId" });
      // Counts the use of the code and checks its limits in one statement; the use is given back if anything below fails (same transaction).
      if (quote.code && !(await tx.$queryRaw<{ ok: boolean }[]>`SELECT theme_discount_redeem(${quote.code}) AS ok`)[0]?.ok) throw new ValidationError("That code has been used up or has expired.", { field: "code" });
      const groupId = newPaymentGroup();
      for (const [i, row] of purchaseShares(quote).entries()) {
        await tx.themePurchase.create({ data: { tenantId, themeId: row.themeId, amount: row.amount, mfsProvider: input.provider, senderNumber: sender, trxId: groupTrxId(input.trxId, i), groupId, bundleId: quote.bundleId, leadRow: i === 0, discountCode: quote.code, discountAmount: row.discountAmount } });
      }
      await audit(tx, tenantId, actor, "theme.purchase_submitted", { themeId: input.themeId || null, bundleId: quote.bundleId, themes: quote.themeIds, amount: quote.total, listPrice: quote.listPrice, code: quote.code, provider: input.provider, trxId: input.trxId });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ValidationError("That transaction ID has already been used.", { field: "trxId" });
    throw e;
  }
}

/**
 * Starts an online payment for a premium theme and returns the UddoktaPay page to send the owner to. The amount is the theme's own price. When
 * the gateway reports the payment completed, the platform webhook (or the return page asking it) unlocks the theme: see grantPremiumThemeFromPayment.
 */
export async function startThemeCheckout(
  tenantId: string, actor: StaffActor, themeId: string,
  ctx: { adminOrigin: string; platformOrigin: string; fbp?: string; fbc?: string; ip?: string; ua?: string },
  opts: { bundleId?: string; code?: string } = {},
): Promise<{ paymentUrl: string }> {
  await assertNotInDemo(tenantId, "Buying a theme");
  assertCan(actor, "billing", "edit");
  const id = themeId.trim().toLowerCase();
  const bundleId = (opts.bundleId ?? "").trim().toLowerCase();
  if (!id && !bundleId) throw new ValidationError("Choose a theme or a bundle.", { field: "themeId" });
  // The amount charged is the quote: the theme or bundle price less the code, worked out here and not taken from the browser.
  const quote = await withTenant(tenantId, (tx) => quoteThemePurchase(tx, { themeId: id, bundleId, code: opts.code }));
  const platform = await getPlatformUddoktaPayCredentials();
  if (!platform) throw new ValidationError("Online payment is not available right now. Please pay by bKash or Nagad and send the TrxID.");
  const urls = uddoktaPayPlanUrls(ctx.adminOrigin, ctx.platformOrigin);
  const charge = await createUddoktaPayCharge({
    apiKey: platform.apiKey, baseUrl: platform.baseUrl, fullName: actor.name || "Merchant", email: actor.email || "billing@biztrack.bd", amount: quote.total,
    metadata: { tenantId, ...(bundleId ? { bundleId } : { themeId: id }), ...(quote.code ? { code: quote.code } : {}), type: "theme", ...(ctx.fbp ? { fbp: ctx.fbp.slice(0, 100) } : {}), ...(ctx.fbc ? { fbc: ctx.fbc.slice(0, 500) } : {}), ...(ctx.ip ? { ip: ctx.ip.slice(0, 64) } : {}), ...(ctx.ua ? { ua: ctx.ua.slice(0, 300) } : {}) },
    redirectUrl: `${ctx.adminOrigin.replace(/\/+$/, "")}/api/themes/uddoktapay/callback`,
    webhookUrl: urls.webhook,
    cancelUrl: `${ctx.adminOrigin.replace(/\/+$/, "")}/themes?cancelled=1`,
    returnType: "GET",
  });
  return { paymentUrl: charge.paymentUrl };
}

// ---- Platform side -------------------------------------------------------------------------------------------------------

export interface PendingThemePurchase {
  id: string;
  tenantId: string;
  storeName: string;
  subdomain: string;
  themeId: string;
  themeName: string;
  amount: number;
  provider: string;
  senderNumber: string;
  trxId: string;
  createdAt: Date;
  discountCode: string | null;
}

export async function listPendingThemePurchases(actor: PlatformActor, db: PrismaClient = getPlatformPrisma()): Promise<PendingThemePurchase[]> {
  assertPlatformCan(actor, "payments", "view");
  // A bundle is one payment but several rows: it is listed once, from its lead row, with the whole amount.
  const rows = await db.themePurchase.findMany({ where: { status: "PENDING", leadRow: true }, orderBy: { createdAt: "asc" }, include: { tenant: { select: { name: true, subdomain: true } } } });
  const groups = rows.flatMap((r) => (r.groupId ? [r.groupId] : []));
  const members = groups.length ? await db.themePurchase.findMany({ where: { groupId: { in: groups } }, select: { groupId: true, amount: true } }) : [];
  const bundles = await db.themeBundle.findMany({ select: { id: true, name: true } });
  return rows.map((r) => {
    const group = members.filter((m) => m.groupId === r.groupId);
    const amount = r.groupId ? group.reduce((n, m) => n + Number(m.amount), 0) : Number(r.amount);
    const themeName = r.bundleId ? `${bundles.find((b) => b.id === r.bundleId)?.name ?? r.bundleId} (bundle of ${group.length})` : themeDefinition(r.themeId).name;
    return { id: r.id, tenantId: r.tenantId, storeName: r.tenant.name, subdomain: r.tenant.subdomain, themeId: r.themeId, themeName, amount, provider: r.mfsProvider, senderNumber: r.senderNumber, trxId: r.trxId, createdAt: r.createdAt, discountCode: r.discountCode };
  });
}

/** Locks the row and every other row of the same payment, and returns them. A single-theme purchase is a group of one. */
async function lockGroup(tx: Prisma.TransactionClient, id: string) {
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "ThemePurchase" WHERE id = ${id} FOR UPDATE`;
  if (locked.length === 0) throw new NotFoundError("Payment");
  const row = await tx.themePurchase.findUniqueOrThrow({ where: { id } });
  if (!row.groupId) return { row, group: [row] };
  await tx.$queryRaw`SELECT id FROM "ThemePurchase" WHERE "groupId" = ${row.groupId} FOR UPDATE`;
  return { row, group: await tx.themePurchase.findMany({ where: { groupId: row.groupId }, orderBy: { createdAt: "asc" } }) };
}

/** Approving any row of a payment approves all of them: one payment, one decision. */
export async function approveThemePurchase(actor: PlatformActor, id: string, db: PrismaClient = getPlatformPrisma()): Promise<{ tenantId: string; themeId: string }> {
  assertPlatformCan(actor, "payments", "edit");
  return db.$transaction(async (tx) => {
    const { row, group } = await lockGroup(tx, id);
    if (row.status !== "PENDING") throw new ValidationError(row.status === "APPROVED" ? "This payment was already approved." : "This payment was already rejected.");
    const now = new Date();
    const bundle = row.bundleId ? await tx.themeBundle.findUnique({ where: { id: row.bundleId }, select: { priceModel: true } }) : null;
    for (const r of group.filter((g) => g.status === "PENDING")) {
      const themeRow = await tx.theme.findUnique({ where: { id: r.themeId }, select: { priceModel: true } });
      const model: ThemePriceModel = (bundle ? bundle.priceModel : themeRow?.priceModel) === "MONTHLY" ? "MONTHLY" : "ONE_TIME";
      const current = await tx.themePurchase.findFirst({ where: { tenantId: r.tenantId, themeId: r.themeId, status: "APPROVED", expiresAt: { not: null } }, orderBy: { expiresAt: "desc" }, select: { expiresAt: true } });
      await tx.themePurchase.update({ where: { id: r.id }, data: { status: "APPROVED", approvedBy: actor.id, approvedAt: now, expiresAt: purchaseExpiry(model, now, current?.expiresAt ?? null) } });
    }
    await tx.platformAuditLog.create({ data: { actorId: actor.id, action: "theme.purchase_approved", tenantId: row.tenantId, details: { id, themeId: row.themeId, bundleId: row.bundleId, themes: group.map((g) => g.themeId), trxId: row.trxId, amount: group.reduce((n, g) => n + Number(g.amount), 0), code: row.discountCode }, ipAddress: actor.ip ?? null } });
    return { tenantId: row.tenantId, themeId: row.themeId };
  });
}

export async function rejectThemePurchase(actor: PlatformActor, id: string, reason: string, db: PrismaClient = getPlatformPrisma()): Promise<void> {
  assertPlatformCan(actor, "payments", "edit");
  const why = reason.trim().slice(0, 200);
  if (why.length < 3) throw new ValidationError("Tell the store why, for example: TrxID not found in our bKash");
  await db.$transaction(async (tx) => {
    const { row, group } = await lockGroup(tx, id);
    if (row.status !== "PENDING") throw new ValidationError("This payment was already decided.");
    // The TrxID stays on file, so a rejected number cannot be submitted again for another store.
    await tx.themePurchase.updateMany({ where: { id: { in: group.filter((g) => g.status === "PENDING").map((g) => g.id) } }, data: { status: "REJECTED", rejectionReason: why, approvedBy: actor.id, approvedAt: new Date() } });
    // A rejected payment gives its use of the discount code back.
    if (row.discountCode) await tx.themeDiscount.updateMany({ where: { code: row.discountCode, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
    await tx.platformAuditLog.create({ data: { actorId: actor.id, action: "theme.purchase_rejected", tenantId: row.tenantId, details: { id, themeId: row.themeId, bundleId: row.bundleId, trxId: row.trxId, reason: why }, ipAddress: actor.ip ?? null } });
  });
}
