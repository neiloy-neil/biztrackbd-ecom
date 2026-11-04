import { z } from "zod";
import { Prisma, getPlatformPrisma, withTenant, type PrismaClient, type TenantTx } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { assertCan, type StaffActor } from "../permissions";
import { NotFoundError, ValidationError } from "../errors";
import { normalizeBdPhone } from "../phone";
import { assertNotInDemo } from "../demo/guard";
import { paymentTargets, type PayTo } from "../platform/billing";
import { assertPlatformCan, type PlatformActor } from "../platform/admin";
import { purchaseExpiry, THEME_PRICE_MODELS, type ThemePriceModel } from "../platform/theme-catalogue";
import { MODULES, allowance, isAddonModule } from "./service";
import { notExpired } from "./expiry";

/**
 * Paid add-on modules. A store whose plan does not include a module can still buy it, if the platform admin has made it sellable and priced it:
 * free, one-time or monthly. The store pays by mobile money, the platform checks the TrxID like a plan payment, and on approval the module
 * switches on (for good, or for a month). Everything that decides whether a module is on reads TenantModule, so a purchase writes there.
 */

export const MODULE_PRICE_MODELS = THEME_PRICE_MODELS;
export type ModulePriceModel = ThemePriceModel;

export interface ModuleOffer {
  moduleKey: string;
  label: string;
  priceModel: ModulePriceModel;
  /** Taka. Zero when it is not for sale. */
  price: number;
  sellable: boolean;
}

/** A module can be sold only when the admin made it sellable and gave it a real price. */
export const isForSale = (o: { sellable: boolean; priceModel: string; price: number }): boolean => o.sellable && o.priceModel !== "FREE" && o.price > 0;

type PriceRow = { moduleKey: string; priceModel: string; priceBdt: { toString(): string } | number; sellable: boolean };
const asModel = (v: string): ModulePriceModel => (MODULE_PRICE_MODELS as readonly string[]).includes(v) ? (v as ModulePriceModel) : "FREE";

function toOffer(moduleKey: string, label: string, row: PriceRow | undefined): ModuleOffer {
  if (!row) return { moduleKey, label, priceModel: "FREE", price: 0, sellable: false };
  const priceModel = asModel(row.priceModel);
  return { moduleKey, label, priceModel, price: priceModel === "FREE" ? 0 : Number(row.priceBdt.toString()), sellable: row.sellable };
}

const builtAddons = () => MODULES.filter((m) => m.built && isAddonModule(m.key));

// ---- Store side ---------------------------------------------------------------------------------------------------------

export type ModuleSaleState = "INCLUDED" | "OWNED" | "PENDING" | "FOR_SALE" | "NOT_FOR_SALE";

export interface ModuleSaleItem extends ModuleOffer {
  state: ModuleSaleState;
  /** For a monthly module the store has paid for, when it ends. */
  expiresAt: Date | null;
  /** The store bought it before but the month has run out. */
  expired: boolean;
  lastRejection: string | null;
}

export interface ModuleSaleView { items: ModuleSaleItem[]; payTo: PayTo[] }

/** The same rule the module screens use: the plan's allowance for add-on modules is above zero. */
async function planAllowsModules(tx: TenantTx): Promise<boolean> {
  return (await allowance(tx)) > 0;
}

/** What the store can buy, and the state of each add-on: in its plan, bought, waiting for approval, for sale, or not for sale. */
export async function listModuleSales(tenantId: string, actor: StaffActor, now: Date = new Date()): Promise<ModuleSaleView> {
  assertCan(actor, "billing", "view");
  const data = await withTenant(tenantId, async (tx) => ({
    included: await planAllowsModules(tx),
    prices: await tx.modulePrice.findMany(),
    purchases: await tx.modulePurchase.findMany({ orderBy: { createdAt: "desc" }, select: { moduleKey: true, status: true, rejectionReason: true, expiresAt: true } }),
    rows: await tx.tenantModule.findMany({ where: { source: { in: ["PURCHASE", "GRANT"] } }, select: { moduleKey: true, isEnabled: true, expiresAt: true, source: true } }),
  }));
  const priceOf = new Map(data.prices.map((p) => [p.moduleKey, p]));
  const items = builtAddons().map((m): ModuleSaleItem => {
    const offer = toOffer(m.key, m.label, priceOf.get(m.key));
    const mine = data.purchases.filter((p) => p.moduleKey === m.key);
    const live = data.rows.find((r) => r.moduleKey === m.key && r.isEnabled && (r.expiresAt === null || r.expiresAt > now));
    const everBought = mine.some((p) => p.status === "APPROVED");
    let state: ModuleSaleState;
    if (data.included) state = "INCLUDED";
    else if (live) state = "OWNED";
    else if (mine.some((p) => p.status === "PENDING")) state = "PENDING";
    else state = isForSale(offer) ? "FOR_SALE" : "NOT_FOR_SALE";
    const rejected = mine.find((p) => p.status === "REJECTED");
    return { ...offer, state, expiresAt: state === "OWNED" ? live?.expiresAt ?? null : null, expired: state === "FOR_SALE" && everBought, lastRejection: state === "FOR_SALE" ? rejected?.rejectionReason ?? null : null };
  });
  return { items, payTo: paymentTargets() };
}

const TRX = /^[A-Z0-9]{8,12}$/;
export const ModulePurchaseInput = z.object({
  moduleKey: z.string().trim().toLowerCase(),
  provider: z.enum(["BKASH", "NAGAD", "ROCKET", "UPAY"]),
  senderNumber: z.string().trim().min(1, "Enter the number you sent from"),
  trxId: z.string().trim().toUpperCase(),
});

/** The owner has sent the money and says so. The price is read here, never from the browser. One payment can wait per module. */
export async function submitModulePurchase(tenantId: string, actor: StaffActor, raw: unknown): Promise<void> {
  await assertNotInDemo(tenantId, "Buying a module");
  assertCan(actor, "billing", "edit");
  const parsed = ModulePurchaseInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the form");
  const input = parsed.data;
  const def = builtAddons().find((m) => m.key === input.moduleKey);
  if (!def) throw new ValidationError("That module cannot be bought.", { field: "moduleKey" });
  if (!TRX.test(input.trxId)) throw new ValidationError("That transaction ID does not look right. It is 8 to 12 letters and numbers.", { field: "trxId" });
  let sender: string;
  try { sender = normalizeBdPhone(input.senderNumber); } catch { throw new ValidationError("Enter the mobile number you sent the money from, like 01712345678", { field: "senderNumber" }); }
  try {
    await withTenant(tenantId, async (tx) => {
      if (await planAllowsModules(tx)) throw new ValidationError("Your plan already includes this module.");
      const p = await tx.modulePrice.findUnique({ where: { moduleKey: input.moduleKey } });
      const offer = toOffer(def.key, def.label, p ?? undefined);
      if (!isForSale(offer)) throw new ValidationError("This module is not for sale right now.", { field: "moduleKey" });
      const live = await tx.tenantModule.findFirst({ where: { moduleKey: input.moduleKey, isEnabled: true, ...notExpired() }, select: { expiresAt: true } });
      // A one-time or granted module is already theirs; only a monthly one can be paid for again before it ends.
      if (live && !(offer.priceModel === "MONTHLY" && live.expiresAt)) throw new ValidationError("You already have this module.");
      if (await tx.modulePurchase.findFirst({ where: { moduleKey: input.moduleKey, status: "PENDING" } })) throw new ValidationError("You already have a payment for this module waiting to be checked. We will confirm it soon.");
      if (await tx.paymentProof.findFirst({ where: { trxId: input.trxId } }) || await tx.themePurchase.findFirst({ where: { trxId: input.trxId } })) throw new ValidationError("That transaction ID has already been used.", { field: "trxId" });
      await tx.modulePurchase.create({ data: { tenantId, moduleKey: input.moduleKey, amount: offer.price, mfsProvider: input.provider, senderNumber: sender, trxId: input.trxId } });
      await audit(tx, tenantId, actor, "module.purchase_submitted", { moduleKey: input.moduleKey, amount: offer.price, provider: input.provider, trxId: input.trxId });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ValidationError("That transaction ID has already been used.", { field: "trxId" });
    throw e;
  }
}

// ---- Platform side -------------------------------------------------------------------------------------------------------

export interface PendingModulePurchase {
  id: string;
  tenantId: string;
  storeName: string;
  subdomain: string;
  moduleKey: string;
  moduleLabel: string;
  amount: number;
  provider: string;
  senderNumber: string;
  trxId: string;
  createdAt: Date;
}

const labelOf = (key: string) => MODULES.find((m) => m.key === key)?.label ?? key;

export async function listPendingModulePurchases(actor: PlatformActor, db: PrismaClient = getPlatformPrisma()): Promise<PendingModulePurchase[]> {
  assertPlatformCan(actor, "payments", "view");
  const rows = await db.modulePurchase.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { tenant: { select: { name: true, subdomain: true } } } });
  return rows.map((r) => ({ id: r.id, tenantId: r.tenantId, storeName: r.tenant.name, subdomain: r.tenant.subdomain, moduleKey: r.moduleKey, moduleLabel: labelOf(r.moduleKey), amount: Number(r.amount), provider: r.mfsProvider, senderNumber: r.senderNumber, trxId: r.trxId, createdAt: r.createdAt }));
}

/** Approves a payment and switches the module on: for good, or until a month after now (or after its current end when renewed early). */
export async function approveModulePurchase(actor: PlatformActor, id: string, db: PrismaClient = getPlatformPrisma()): Promise<{ tenantId: string; moduleKey: string; expiresAt: Date | null }> {
  assertPlatformCan(actor, "payments", "edit");
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "ModulePurchase" WHERE id = ${id} FOR UPDATE`;
    if (locked.length === 0) throw new NotFoundError("Payment");
    const row = await tx.modulePurchase.findUniqueOrThrow({ where: { id } });
    if (row.status !== "PENDING") throw new ValidationError(row.status === "APPROVED" ? "This payment was already approved." : "This payment was already rejected.");
    const now = new Date();
    const price = await tx.modulePrice.findUnique({ where: { moduleKey: row.moduleKey } });
    const model = asModel(price?.priceModel ?? "ONE_TIME");
    const current = await tx.tenantModule.findUnique({ where: { tenantId_moduleKey: { tenantId: row.tenantId, moduleKey: row.moduleKey } } });
    const expiresAt = purchaseExpiry(model, now, current?.expiresAt ?? null);
    await tx.modulePurchase.update({ where: { id }, data: { status: "APPROVED", approvedBy: actor.id, approvedAt: now, expiresAt } });
    await tx.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId: row.tenantId, moduleKey: row.moduleKey } },
      create: { tenantId: row.tenantId, moduleKey: row.moduleKey, isEnabled: true, expiresAt, source: "PURCHASE" },
      update: { isEnabled: true, expiresAt, source: "PURCHASE" },
    });
    await tx.platformAuditLog.create({ data: { actorId: actor.id, action: "module.purchase_approved", tenantId: row.tenantId, details: { id, moduleKey: row.moduleKey, trxId: row.trxId, amount: Number(row.amount), expiresAt }, ipAddress: actor.ip ?? null } });
    return { tenantId: row.tenantId, moduleKey: row.moduleKey, expiresAt };
  });
}

export async function rejectModulePurchase(actor: PlatformActor, id: string, reason: string, db: PrismaClient = getPlatformPrisma()): Promise<void> {
  assertPlatformCan(actor, "payments", "edit");
  const why = reason.trim().slice(0, 200);
  if (why.length < 3) throw new ValidationError("Tell the store why, for example: TrxID not found in our bKash");
  await db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "ModulePurchase" WHERE id = ${id} FOR UPDATE`;
    if (locked.length === 0) throw new NotFoundError("Payment");
    const row = await tx.modulePurchase.findUniqueOrThrow({ where: { id } });
    if (row.status !== "PENDING") throw new ValidationError("This payment was already decided.");
    await tx.modulePurchase.update({ where: { id }, data: { status: "REJECTED", rejectionReason: why, approvedBy: actor.id, approvedAt: new Date() } });
    await tx.platformAuditLog.create({ data: { actorId: actor.id, action: "module.purchase_rejected", tenantId: row.tenantId, details: { id, moduleKey: row.moduleKey, trxId: row.trxId, reason: why }, ipAddress: actor.ip ?? null } });
  });
}

// ---- Platform pricing ----------------------------------------------------------------------------------------------------

export interface ModulePricingRow extends ModuleOffer { saved: boolean }

/** Every add-on module with its price, for the platform admin. */
export async function listModulePricing(actor: PlatformActor, db: PrismaClient = getPlatformPrisma()): Promise<ModulePricingRow[]> {
  assertPlatformCan(actor, "plans", "view");
  const rows = await db.modulePrice.findMany();
  const byKey = new Map(rows.map((r) => [r.moduleKey, r]));
  return builtAddons().map((m) => ({ ...toOffer(m.key, m.label, byKey.get(m.key)), saved: byKey.has(m.key) }));
}

export const ModulePricingInput = z.object({
  priceModel: z.enum(MODULE_PRICE_MODELS),
  priceBdt: z.coerce.number().min(0, "The price cannot be negative").max(100000, "That price looks too high"),
  sellable: z.coerce.boolean().default(false),
}).refine((v) => !v.sellable || (v.priceModel !== "FREE" && v.priceBdt >= 1), { message: "A module for sale needs a one-time or monthly price of at least 1 taka", path: ["priceBdt"] });

/** Sets whether stores below the plan can buy a module, and for how much. */
export async function updateModulePricing(actor: PlatformActor, moduleKey: string, raw: unknown, db: PrismaClient = getPlatformPrisma()): Promise<void> {
  assertPlatformCan(actor, "plans", "edit");
  const parsed = ModulePricingInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the form");
  if (!builtAddons().some((m) => m.key === moduleKey)) throw new NotFoundError("Module");
  const input = parsed.data;
  const data = { priceModel: input.priceModel, priceBdt: input.priceModel === "FREE" ? 0 : input.priceBdt, sellable: input.sellable };
  await db.$transaction(async (tx) => {
    await tx.modulePrice.upsert({ where: { moduleKey }, create: { moduleKey, ...data }, update: data });
    await tx.platformAuditLog.create({ data: { actorId: actor.id, action: "module.pricing_updated", details: { moduleKey, ...data }, ipAddress: actor.ip ?? null } });
  });
}
