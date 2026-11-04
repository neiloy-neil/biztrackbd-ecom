import { z } from "zod";
import { Prisma, getPlatformPrisma, withTenant, type PrismaClient, type TenantTx } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { assertCan, type StaffActor } from "../permissions";
import { NotFoundError, ValidationError } from "../errors";
import { normalizeBdPhone } from "../phone";
import { ALL_THEMES, PREMIUM_THEME_PRICE, isPremiumTheme, themeDefinition, type ThemeId } from "../builder/theme";
import { assertNotInDemo } from "../demo/guard";
import { paymentTargets, type PayTo } from "./billing";
import { createUddoktaPayCharge, getPlatformUddoktaPayCredentials, uddoktaPayPlanUrls } from "../payments/uddoktapay";
import { assertPlatformCan, type PlatformActor } from "./admin";

/**
 * The themes page of the merchant admin: every theme with whether the store can use it now. Free themes are always usable. A premium theme costs
 * PREMIUM_THEME_PRICE once, paid by mobile money and checked by the platform like a plan payment; once approved the store owns it for life.
 */

export type ThemeStoreState = "FREE" | "OWNED" | "PENDING" | "LOCKED";

export interface ThemeStoreItem {
  id: ThemeId;
  name: string;
  blurb: string;
  audience: string;
  premium: boolean;
  price: number;
  state: ThemeStoreState;
  active: boolean;
  /** The reason the last payment for this theme was turned down, shown so the owner can try again. */
  lastRejection: string | null;
}

export interface ThemeStoreView {
  active: ThemeId;
  themes: ThemeStoreItem[];
  payTo: PayTo[];
  price: number;
  /** Whether the platform has UddoktaPay set up, so the owner can pay online and unlock the theme at once. */
  online: boolean;
}

const TRX = /^[A-Z0-9]{8,12}$/;

export async function ownsPremiumTheme(tx: TenantTx, themeId: string): Promise<boolean> {
  if (!isPremiumTheme(themeId)) return true;
  return (await tx.themePurchase.count({ where: { themeId, status: "APPROVED" } })) > 0;
}

export async function listThemeStore(tenantId: string, actor: StaffActor): Promise<ThemeStoreView> {
  assertCan(actor, "design", "view");
  const { tenant, purchases } = await withTenant(tenantId, async (tx) => ({
    tenant: await tx.tenant.findFirstOrThrow({ select: { themeId: true } }),
    purchases: await tx.themePurchase.findMany({ orderBy: { createdAt: "desc" }, select: { themeId: true, status: true, rejectionReason: true } }),
  }));
  const themes = ALL_THEMES.map((t): ThemeStoreItem => {
    const mine = purchases.filter((p) => p.themeId === t.id);
    const state: ThemeStoreState = !t.premium ? "FREE" : mine.some((p) => p.status === "APPROVED") ? "OWNED" : mine.some((p) => p.status === "PENDING") ? "PENDING" : "LOCKED";
    const rejected = mine.find((p) => p.status === "REJECTED");
    return { id: t.id, name: t.name, blurb: t.blurb, audience: t.audience, premium: Boolean(t.premium), price: t.premium ? PREMIUM_THEME_PRICE : 0, state, active: tenant.themeId === t.id, lastRejection: state === "LOCKED" ? rejected?.rejectionReason ?? null : null };
  });
  return { active: themeDefinition(tenant.themeId).id, themes, payTo: paymentTargets(), price: PREMIUM_THEME_PRICE, online: Boolean(await getPlatformUddoktaPayCredentials().catch(() => null)) };
}

export const ThemePurchaseInput = z.object({
  themeId: z.string().trim().toLowerCase(),
  provider: z.enum(["BKASH", "NAGAD", "ROCKET", "UPAY"]),
  senderNumber: z.string().trim().min(1, "Enter the number you sent from"),
  trxId: z.string().trim().toUpperCase(),
});

/** The owner has sent the money and says so. The price is read here, never from the browser. A store can only have one payment waiting per theme. */
export async function submitThemePurchase(tenantId: string, actor: StaffActor, raw: unknown): Promise<void> {
  await assertNotInDemo(tenantId, "Buying a theme");
  assertCan(actor, "billing", "edit");
  const parsed = ThemePurchaseInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the form");
  const input = parsed.data;
  if (!isPremiumTheme(input.themeId)) throw new ValidationError("That theme is free. Just apply it.", { field: "themeId" });
  if (!TRX.test(input.trxId)) throw new ValidationError("That transaction ID does not look right. It is 8 to 12 letters and numbers.", { field: "trxId" });
  let sender: string;
  try { sender = normalizeBdPhone(input.senderNumber); } catch { throw new ValidationError("Enter the mobile number you sent the money from, like 01712345678", { field: "senderNumber" }); }
  try {
    await withTenant(tenantId, async (tx) => {
      if (await ownsPremiumTheme(tx, input.themeId)) throw new ValidationError("You already own this theme.");
      if (await tx.themePurchase.findFirst({ where: { themeId: input.themeId, status: "PENDING" } })) throw new ValidationError("You already have a payment for this theme waiting to be checked. We will confirm it soon.");
      // A TrxID used for a plan payment must not be reused here (the two tables each keep their own unique index).
      if (await tx.paymentProof.findFirst({ where: { trxId: input.trxId } })) throw new ValidationError("That transaction ID has already been used.", { field: "trxId" });
      await tx.themePurchase.create({ data: { tenantId, themeId: input.themeId, amount: PREMIUM_THEME_PRICE, mfsProvider: input.provider, senderNumber: sender, trxId: input.trxId } });
      await audit(tx, tenantId, actor, "theme.purchase_submitted", { themeId: input.themeId, amount: PREMIUM_THEME_PRICE, provider: input.provider, trxId: input.trxId });
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
): Promise<{ paymentUrl: string }> {
  await assertNotInDemo(tenantId, "Buying a theme");
  assertCan(actor, "billing", "edit");
  const id = themeId.trim().toLowerCase();
  if (!isPremiumTheme(id)) throw new ValidationError("That theme is free. Just apply it.", { field: "themeId" });
  if (await withTenant(tenantId, (tx) => ownsPremiumTheme(tx, id))) throw new ValidationError("You already own this theme.");
  const platform = await getPlatformUddoktaPayCredentials();
  if (!platform) throw new ValidationError("Online payment is not available right now. Please pay by bKash or Nagad and send the TrxID.");
  const urls = uddoktaPayPlanUrls(ctx.adminOrigin, ctx.platformOrigin);
  const charge = await createUddoktaPayCharge({
    apiKey: platform.apiKey, baseUrl: platform.baseUrl, fullName: actor.name || "Merchant", email: actor.email || "billing@biztrack.bd", amount: PREMIUM_THEME_PRICE,
    metadata: { tenantId, themeId: id, type: "theme", ...(ctx.fbp ? { fbp: ctx.fbp.slice(0, 100) } : {}), ...(ctx.fbc ? { fbc: ctx.fbc.slice(0, 500) } : {}), ...(ctx.ip ? { ip: ctx.ip.slice(0, 64) } : {}), ...(ctx.ua ? { ua: ctx.ua.slice(0, 300) } : {}) },
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
}

export async function listPendingThemePurchases(actor: PlatformActor, db: PrismaClient = getPlatformPrisma()): Promise<PendingThemePurchase[]> {
  assertPlatformCan(actor, "payments", "view");
  const rows = await db.themePurchase.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { tenant: { select: { name: true, subdomain: true } } } });
  return rows.map((r) => ({ id: r.id, tenantId: r.tenantId, storeName: r.tenant.name, subdomain: r.tenant.subdomain, themeId: r.themeId, themeName: themeDefinition(r.themeId).name, amount: Number(r.amount), provider: r.mfsProvider, senderNumber: r.senderNumber, trxId: r.trxId, createdAt: r.createdAt }));
}

export async function approveThemePurchase(actor: PlatformActor, id: string, db: PrismaClient = getPlatformPrisma()): Promise<{ tenantId: string; themeId: string }> {
  assertPlatformCan(actor, "payments", "edit");
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "ThemePurchase" WHERE id = ${id} FOR UPDATE`;
    if (locked.length === 0) throw new NotFoundError("Payment");
    const row = await tx.themePurchase.findUniqueOrThrow({ where: { id } });
    if (row.status !== "PENDING") throw new ValidationError(row.status === "APPROVED" ? "This payment was already approved." : "This payment was already rejected.");
    await tx.themePurchase.update({ where: { id }, data: { status: "APPROVED", approvedBy: actor.id, approvedAt: new Date() } });
    await tx.platformAuditLog.create({ data: { actorId: actor.id, action: "theme.purchase_approved", tenantId: row.tenantId, details: { id, themeId: row.themeId, trxId: row.trxId, amount: Number(row.amount) }, ipAddress: actor.ip ?? null } });
    return { tenantId: row.tenantId, themeId: row.themeId };
  });
}

export async function rejectThemePurchase(actor: PlatformActor, id: string, reason: string, db: PrismaClient = getPlatformPrisma()): Promise<void> {
  assertPlatformCan(actor, "payments", "edit");
  const why = reason.trim().slice(0, 200);
  if (why.length < 3) throw new ValidationError("Tell the store why, for example: TrxID not found in our bKash");
  await db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "ThemePurchase" WHERE id = ${id} FOR UPDATE`;
    if (locked.length === 0) throw new NotFoundError("Payment");
    const row = await tx.themePurchase.findUniqueOrThrow({ where: { id } });
    if (row.status !== "PENDING") throw new ValidationError("This payment was already decided.");
    // The TrxID stays on file, so a rejected number cannot be submitted again for another store.
    await tx.themePurchase.update({ where: { id }, data: { status: "REJECTED", rejectionReason: why, approvedBy: actor.id, approvedAt: new Date() } });
    await tx.platformAuditLog.create({ data: { actorId: actor.id, action: "theme.purchase_rejected", tenantId: row.tenantId, details: { id, themeId: row.themeId, trxId: row.trxId, reason: why }, ipAddress: actor.ip ?? null } });
  });
}
