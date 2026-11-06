import { assertNotInDemo } from "../demo/guard";
import { Prisma, withTenant } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { NotFoundError, ValidationError } from "../errors";
import { BD_GEO } from "../geo/bd-geo";
import { assertCan, type StaffActor } from "../permissions";
import { normalizeBdPhone } from "../phone";
import { ADVANCE_DEFAULT_WINDOW_HOURS, ADVANCE_MAX_WINDOW_HOURS, ADVANCE_MODES, ADVANCE_PAY_VIA, advanceRuleFrom, type AdvanceMode, type AdvancePayVia, type AdvanceRule } from "../orders/advance";

export interface StoreSettingsView {
  storeName: string;
  storeNameBn: string | null;
  tagline: string | null;
  description: string | null;
  contactPhone: string | null;
  whatsappNumber: string | null;
  email: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  addressLine: string | null;
  pickupAddress: string | null;
  logoUrl: string | null;
  announcement: string | null;
  announcementBn: string | null;
  ordersPaused: boolean;
  orderPrefix: string;
  codEnabled: boolean;
  codFee: number;
  codMaxAmount: number | null;
  /** Advance payment before a cash-on-delivery order is accepted (see orders/advance.ts). */
  advanceMode: string;
  advanceValue: number;
  advanceMinOrder: number;
  advancePayVia: string;
  advanceWindowHours: number;
  bkashEnabled: boolean;
  bkashNumber: string | null;
  bkashKind: string;
  bkashInstruction: string | null;
  nagadEnabled: boolean;
  nagadNumber: string | null;
  nagadKind: string;
  nagadInstruction: string | null;
  paymentNote: string | null;
  invoiceFooter: string | null;
  invoiceOptions: { showLogo: boolean; showSku: boolean; showQr: boolean; showPricesOnSlip: boolean; paper: InvoicePaper };
}

export type InvoicePaper = "a4" | "a5" | "thermal";
export const INVOICE_PAPERS: InvoicePaper[] = ["a4", "a5", "thermal"];
const INVOICE_DEFAULTS = { showLogo: true, showSku: true, showQr: false, showPricesOnSlip: false, paper: "a4" as InvoicePaper };

export async function getStoreSettings(tenantId: string, actor: StaffActor): Promise<StoreSettingsView> {
  assertCan(actor, "design", "view");
  return loadSettings(tenantId);
}

/** The same details, for printing invoices and slips. Needs only order access: a packer prints documents but does not edit the store. */
export async function getPrintSettings(tenantId: string, actor: StaffActor): Promise<StoreSettingsView> {
  assertCan(actor, "orders", "view");
  return loadSettings(tenantId);
}

async function loadSettings(tenantId: string): Promise<StoreSettingsView> {
  return withTenant(tenantId, async (tx) => {
    const t = await tx.tenant.findFirstOrThrow({ select: { name: true, orderPrefix: true } });
    const s = await tx.storeSettings.findFirst();
    const opts = { ...INVOICE_DEFAULTS, ...((s?.invoiceOptions && typeof s.invoiceOptions === "object" ? s.invoiceOptions : {}) as object) };
    return {
      storeName: s?.storeName ?? t.name, storeNameBn: s?.storeNameBn ?? null, tagline: s?.tagline ?? null, description: s?.description ?? null,
      contactPhone: s?.contactPhone ?? null, whatsappNumber: s?.whatsappNumber ?? null, email: s?.email ?? null, facebookUrl: s?.facebookUrl ?? null,
      instagramUrl: s?.instagramUrl ?? null, addressLine: s?.addressLine ?? null, pickupAddress: s?.pickupAddress ?? null, logoUrl: s?.logoUrl ?? null,
      announcement: s?.announcement ?? null, announcementBn: s?.announcementBn ?? null, ordersPaused: s?.ordersPaused ?? false, orderPrefix: t.orderPrefix,
      codEnabled: s?.codEnabled ?? true, codFee: s ? Number(s.codFee) : 0, codMaxAmount: s?.codMaxAmount != null ? Number(s.codMaxAmount) : null,
      advanceMode: advanceRuleFrom(s).mode, advanceValue: advanceRuleFrom(s).value, advanceMinOrder: advanceRuleFrom(s).minOrder, advancePayVia: advanceRuleFrom(s).payVia, advanceWindowHours: advanceRuleFrom(s).windowHours,
      bkashEnabled: s?.bkashEnabled ?? true, bkashNumber: s?.bkashNumber ?? null, bkashKind: s?.bkashKind ?? "PERSONAL", bkashInstruction: s?.bkashInstruction ?? null,
      nagadEnabled: s?.nagadEnabled ?? true, nagadNumber: s?.nagadNumber ?? null, nagadKind: s?.nagadKind ?? "PERSONAL", nagadInstruction: s?.nagadInstruction ?? null,
      paymentNote: s?.paymentNote ?? null, invoiceFooter: s?.invoiceFooter ?? null, invoiceOptions: opts as StoreSettingsView["invoiceOptions"],
    };
  });
}

const blank = (v: string | null | undefined) => {
  const t = v?.trim();
  return t ? t : null;
};
const phoneOrNull = (v: string | null | undefined, label: string): string | null => {
  const t = blank(v);
  if (!t) return null;
  try {
    return normalizeBdPhone(t);
  } catch {
    throw new ValidationError(`Enter a valid mobile number for ${label}`, { field: label });
  }
};
const httpsOrNull = (v: string | null | undefined, label: string): string | null => {
  const t = blank(v);
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("scheme");
    return u.toString();
  } catch {
    throw new ValidationError(`Enter a valid web address for ${label}`, { field: label });
  }
};

export interface StoreDetailsInput {
  storeName: string;
  storeNameBn?: string | null;
  tagline?: string | null;
  description?: string | null;
  contactPhone?: string | null;
  whatsappNumber?: string | null;
  email?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  addressLine?: string | null;
  pickupAddress?: string | null;
  logoUrl?: string | null;
  announcement?: string | null;
  announcementBn?: string | null;
  orderPrefix?: string;
  invoiceFooter?: string | null;
  invoiceOptions?: Partial<StoreSettingsView["invoiceOptions"]>;
}

async function upsertSettings(tx: Parameters<Parameters<typeof withTenant>[1]>[0], tenantId: string, data: Prisma.StoreSettingsUncheckedUpdateInput) {
  const existing = await tx.storeSettings.findFirst();
  if (existing) return tx.storeSettings.update({ where: { id: existing.id }, data });
  const t = await tx.tenant.findFirstOrThrow({ select: { name: true } });
  const { storeName, ...rest } = data;
  return tx.storeSettings.create({ data: { ...(rest as Prisma.StoreSettingsUncheckedCreateInput), tenantId, storeName: typeof storeName === "string" ? storeName : t.name } });
}

/** Store details shown on the storefront, invoices and emails (AdmStoreDetails). */
export async function saveStoreDetails(tenantId: string, actor: StaffActor, i: StoreDetailsInput): Promise<void> {
  assertCan(actor, "design", "edit");
  const name = i.storeName.trim();
  if (name.length < 2 || name.length > 80) throw new ValidationError("Enter your store name", { field: "storeName" });
  const email = blank(i.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError("Enter a valid email", { field: "email" });
  const prefix = i.orderPrefix?.trim().toUpperCase();
  if (prefix !== undefined && !/^[A-Z0-9]{1,6}-?$/.test(prefix)) throw new ValidationError("The order prefix can be up to 6 letters or numbers, like BT-", { field: "orderPrefix" });
  const logo = blank(i.logoUrl);
  if (logo && !/^(\/media\/[A-Za-z0-9/_.-]+|https:\/\/[^\s"'<>]+)$/.test(logo)) throw new ValidationError("That logo address is not allowed", { field: "logoUrl" });

  await withTenant(tenantId, async (tx) => {
    const current = await tx.storeSettings.findFirst();
    const opts = { ...INVOICE_DEFAULTS, ...((current?.invoiceOptions && typeof current.invoiceOptions === "object" ? current.invoiceOptions : {}) as object), ...(i.invoiceOptions ?? {}) };
    await upsertSettings(tx, tenantId, {
      storeName: name, storeNameBn: blank(i.storeNameBn), tagline: blank(i.tagline)?.slice(0, 120), description: blank(i.description)?.slice(0, 300),
      contactPhone: phoneOrNull(i.contactPhone, "customer phone"), whatsappNumber: phoneOrNull(i.whatsappNumber, "WhatsApp number"), email,
      facebookUrl: httpsOrNull(i.facebookUrl, "Facebook page"), instagramUrl: httpsOrNull(i.instagramUrl, "Instagram"),
      addressLine: blank(i.addressLine)?.slice(0, 200), pickupAddress: blank(i.pickupAddress)?.slice(0, 250), logoUrl: logo,
      announcement: blank(i.announcement)?.slice(0, 200), announcementBn: blank(i.announcementBn)?.slice(0, 200),
      ...(i.invoiceFooter !== undefined ? { invoiceFooter: blank(i.invoiceFooter)?.slice(0, 200) } : {}), invoiceOptions: opts,
    });
    if (prefix !== undefined) await tx.tenant.update({ where: { id: tenantId }, data: { orderPrefix: prefix } });
    await audit(tx, tenantId, actor, "settings.store_details_changed", { fields: Object.keys(i) });
  });
}

export interface InvoiceSettingsInput {
  footer?: string | null;
  showLogo?: boolean;
  showSku?: boolean;
  showPricesOnSlip?: boolean;
  paper?: string;
}

/** How invoices and packing slips look (AdmInvoice): the logo, SKU codes, prices on the slip, a footer note and the usual paper size. */
export async function saveInvoiceSettings(tenantId: string, actor: StaffActor, i: InvoiceSettingsInput): Promise<void> {
  assertCan(actor, "design", "edit");
  if (i.paper !== undefined && !INVOICE_PAPERS.includes(i.paper as InvoicePaper)) throw new ValidationError("Choose A4, A5 or thermal paper", { field: "paper" });
  const footer = i.footer === undefined ? undefined : blank(i.footer)?.slice(0, 200) ?? null;
  await withTenant(tenantId, async (tx) => {
    const current = await tx.storeSettings.findFirst();
    const opts: Record<string, unknown> = { ...INVOICE_DEFAULTS, ...((current?.invoiceOptions && typeof current.invoiceOptions === "object" ? current.invoiceOptions : {}) as object) };
    if (i.showLogo !== undefined) opts.showLogo = i.showLogo;
    if (i.showSku !== undefined) opts.showSku = i.showSku;
    if (i.showPricesOnSlip !== undefined) opts.showPricesOnSlip = i.showPricesOnSlip;
    if (i.paper !== undefined) opts.paper = i.paper;
    await upsertSettings(tx, tenantId, { ...(footer !== undefined ? { invoiceFooter: footer } : {}), invoiceOptions: opts as Prisma.InputJsonValue });
    await audit(tx, tenantId, actor, "settings.invoice_changed", { fields: Object.keys(i) });
  });
}

/** Pause or reopen the store. While paused, customers see a notice and cannot place orders. */
export async function setOrdersPaused(tenantId: string, actor: StaffActor, paused: boolean): Promise<void> {
  await assertNotInDemo(tenantId, "Pausing the store");
  assertCan(actor, "design", "edit");
  await withTenant(tenantId, async (tx) => {
    await upsertSettings(tx, tenantId, { ordersPaused: paused });
    await audit(tx, tenantId, actor, paused ? "settings.store_paused" : "settings.store_reopened", {});
  });
}

export interface PaymentSettingsInput {
  codEnabled: boolean;
  codFee: number;
  codMaxAmount: number | null;
  bkashEnabled: boolean;
  bkashNumber?: string | null;
  bkashKind?: "PERSONAL" | "AGENT" | "MERCHANT";
  bkashInstruction?: string | null;
  nagadEnabled: boolean;
  nagadNumber?: string | null;
  nagadKind?: "PERSONAL" | "AGENT" | "MERCHANT";
  nagadInstruction?: string | null;
  paymentNote?: string | null;
  /** Left out, the store's current advance rule is kept. */
  advance?: { mode: string; value: number; minOrder: number; payVia: string; windowHours: number };
}

/** Checks the advance rule from the settings form and returns it in clean form. Throws a plain-words error naming the field. */
function validateAdvance(a: { mode: string; value: number; minOrder: number; payVia: string; windowHours: number }, ctx: { codEnabled: boolean; hasMfs: boolean }): AdvanceRule {
  if (!ADVANCE_MODES.includes(a.mode as AdvanceMode)) throw new ValidationError("Choose how the advance is worked out", { field: "advanceMode" });
  const mode = a.mode as AdvanceMode;
  if (!ADVANCE_PAY_VIA.includes(a.payVia as AdvancePayVia)) throw new ValidationError("Choose how customers pay the advance", { field: "advancePayVia" });
  const payVia = a.payVia as AdvancePayVia;
  if (mode === "OFF") return { mode, value: 0, minOrder: 0, payVia, windowHours: ADVANCE_DEFAULT_WINDOW_HOURS };
  if (!ctx.codEnabled) throw new ValidationError("The advance is for cash on delivery orders. Turn cash on delivery on, or set the advance to off.", { field: "advanceMode" });
  if (mode === "FIXED" && !(Number.isFinite(a.value) && a.value >= 1 && a.value <= 1_000_000)) throw new ValidationError("Enter an advance of at least ৳1", { field: "advanceValue" });
  if (mode === "PERCENT" && !(Number.isFinite(a.value) && a.value >= 1 && a.value <= 100)) throw new ValidationError("Enter a percentage between 1 and 100", { field: "advanceValue" });
  if (!Number.isFinite(a.minOrder) || a.minOrder < 0 || a.minOrder > 10_000_000) throw new ValidationError("Enter a minimum order total of ৳0 or more", { field: "advanceMinOrder" });
  const hours = Math.round(a.windowHours);
  if (!Number.isFinite(hours) || hours < 1 || hours > ADVANCE_MAX_WINDOW_HOURS) throw new ValidationError(`Give customers between 1 and ${ADVANCE_MAX_WINDOW_HOURS} hours to pay`, { field: "advanceWindowHours" });
  if (payVia === "MANUAL" && !ctx.hasMfs) throw new ValidationError("Turn on bKash or Nagad (with your number) so customers have a way to send the advance, or let them pay online", { field: "advancePayVia" });
  return { mode, value: mode === "FULL" ? 0 : a.value, minOrder: a.minOrder, payVia, windowHours: hours };
}

/** Payments (AdmPayments). Owner only: these numbers are where customers send their money. */
export async function savePaymentSettings(tenantId: string, actor: StaffActor, i: PaymentSettingsInput): Promise<void> {
  assertCan(actor, "billing", "edit");
  if (!Number.isFinite(i.codFee) || i.codFee < 0 || i.codFee > 10_000) throw new ValidationError("The cash on delivery fee must be between ৳0 and ৳10,000", { field: "codFee" });
  if (i.codMaxAmount != null && (!Number.isFinite(i.codMaxAmount) || i.codMaxAmount < 100)) throw new ValidationError("Enter a cash on delivery limit of at least ৳100, or leave it empty", { field: "codMaxAmount" });
  const bkash = phoneOrNull(i.bkashNumber, "bKash number");
  const nagad = phoneOrNull(i.nagadNumber, "Nagad number");
  if (i.bkashEnabled && !bkash) throw new ValidationError("Enter your bKash number to turn bKash on", { field: "bkashNumber" });
  if (i.nagadEnabled && !nagad) throw new ValidationError("Enter your Nagad number to turn Nagad on", { field: "nagadNumber" });
  if (!i.codEnabled && !(i.bkashEnabled && bkash) && !(i.nagadEnabled && nagad)) throw new ValidationError("Keep at least one way for customers to pay");
  const adv = i.advance ? validateAdvance(i.advance, { codEnabled: i.codEnabled, hasMfs: Boolean((i.bkashEnabled && bkash) || (i.nagadEnabled && nagad)) }) : null;
  await withTenant(tenantId, async (tx) => {
    await upsertSettings(tx, tenantId, {
      codEnabled: i.codEnabled, codFee: i.codFee, codMaxAmount: i.codMaxAmount, bkashEnabled: i.bkashEnabled, bkashNumber: bkash, bkashKind: i.bkashKind ?? "PERSONAL",
      bkashInstruction: blank(i.bkashInstruction)?.slice(0, 300), nagadEnabled: i.nagadEnabled, nagadNumber: nagad, nagadKind: i.nagadKind ?? "PERSONAL",
      nagadInstruction: blank(i.nagadInstruction)?.slice(0, 300), paymentNote: blank(i.paymentNote)?.slice(0, 200),
      ...(adv ? { advanceMode: adv.mode, advanceValue: adv.value, advanceMinOrder: adv.minOrder, advancePayVia: adv.payVia, advanceWindowHours: adv.windowHours } : {}),
    });
    // The numbers are recorded because changing where customers send money is exactly what an account takeover would do.
    await audit(tx, tenantId, actor, "settings.payments_changed", { codEnabled: i.codEnabled, codFee: i.codFee, bkashNumber: bkash, nagadNumber: nagad, ...(adv ? { advance: adv } : {}) });
  });
}

// ---- Delivery charges (AdmShipping)

export async function listZones(tenantId: string, actor: StaffActor) {
  assertCan(actor, "orders", "view");
  return withTenant(tenantId, async (tx) => {
    const zones = await tx.shippingZone.findMany({ orderBy: { createdAt: "asc" } });
    return zones.map((z) => ({
      id: z.id, name: z.name, districts: z.districts, rate: Number(z.rate), freeOverAmount: z.freeOverAmount != null ? Number(z.freeOverAmount) : null, etaMinDays: z.etaMinDays, etaMaxDays: z.etaMaxDays,
    }));
  });
}

const DISTRICTS = new Set(BD_GEO.flatMap((d) => d.districts.map((x) => x.name)));
export const ALL_OTHER_DISTRICTS = "*";

export interface ZoneInput {
  name: string;
  /** District names, or ["*"] for "all other districts". */
  districts: string[];
  rate: number;
  freeOverAmount: number | null;
  etaMinDays: number;
  etaMaxDays: number;
}

export async function saveZone(tenantId: string, actor: StaffActor, i: ZoneInput, zoneId?: string): Promise<{ id: string }> {
  assertCan(actor, "orders", "edit");
  const name = i.name.trim();
  if (name.length < 2 || name.length > 60) throw new ValidationError("Name the zone, for example Inside Dhaka city");
  const districts = [...new Set(i.districts.map((d) => d.trim()).filter(Boolean))];
  if (districts.length === 0) throw new ValidationError("Choose at least one district, or all other districts");
  if (districts.includes(ALL_OTHER_DISTRICTS) && districts.length > 1) throw new ValidationError('"All other districts" cannot be combined with named districts');
  for (const d of districts) if (d !== ALL_OTHER_DISTRICTS && !DISTRICTS.has(d)) throw new ValidationError(`${d} is not a district in Bangladesh`);
  if (!Number.isFinite(i.rate) || i.rate < 0 || i.rate > 5000) throw new ValidationError("Enter a delivery charge between ৳0 and ৳5,000", { field: "rate" });
  if (i.freeOverAmount != null && (!Number.isFinite(i.freeOverAmount) || i.freeOverAmount < 1)) throw new ValidationError("Enter the order value for free delivery, or leave it empty", { field: "freeOverAmount" });
  if (!Number.isInteger(i.etaMinDays) || !Number.isInteger(i.etaMaxDays) || i.etaMinDays < 0 || i.etaMaxDays < i.etaMinDays || i.etaMaxDays > 30) throw new ValidationError("Delivery time: the longest cannot be shorter than the shortest", { field: "eta" });

  return withTenant(tenantId, async (tx) => {
    // A district can be in one zone only, or the checkout would not know which charge to apply.
    const others = await tx.shippingZone.findMany({ where: zoneId ? { id: { not: zoneId } } : {} });
    for (const o of others) {
      const clash = districts.find((d) => o.districts.includes(d));
      if (clash) throw new ValidationError(clash === ALL_OTHER_DISTRICTS ? `"${o.name}" already covers all other districts` : `${clash} is already in "${o.name}"`, { field: "districts" });
    }
    const data = { name, districts, rate: i.rate, freeOverAmount: i.freeOverAmount, etaMinDays: i.etaMinDays, etaMaxDays: i.etaMaxDays };
    if (zoneId) {
      const { count } = await tx.shippingZone.updateMany({ where: { id: zoneId }, data });
      if (count === 0) throw new NotFoundError("Delivery zone");
      await audit(tx, tenantId, actor, "shipping.zone_updated", { name, rate: i.rate });
      return { id: zoneId };
    }
    const z = await tx.shippingZone.create({ data: { tenantId, ...data } });
    await audit(tx, tenantId, actor, "shipping.zone_created", { name, rate: i.rate });
    return { id: z.id };
  });
}

export async function deleteZone(tenantId: string, actor: StaffActor, zoneId: string): Promise<void> {
  assertCan(actor, "orders", "edit");
  await withTenant(tenantId, async (tx) => {
    const z = await tx.shippingZone.findFirst({ where: { id: zoneId } });
    if (!z) throw new NotFoundError("Delivery zone");
    await tx.shippingZone.delete({ where: { id: zoneId } });
    await audit(tx, tenantId, actor, "shipping.zone_deleted", { name: z.name });
  });
}

export interface BannerSettingsView {
  announcement: string | null;
  announcementBn: string | null;
  flashSaleActive: boolean;
  flashSaleEndsAt: Date | null;
  flashSaleCoupon: string | null;
}

export async function getBannerSettings(tenantId: string, actor: StaffActor): Promise<BannerSettingsView> {
  assertCan(actor, "marketing", "view");
  return withTenant(tenantId, async (tx) => {
    const s = await tx.storeSettings.findFirst();
    return {
      announcement: s?.announcement ?? null,
      announcementBn: s?.announcementBn ?? null,
      flashSaleActive: s?.flashSaleActive ?? false,
      flashSaleEndsAt: s?.flashSaleEndsAt ?? null,
      flashSaleCoupon: s?.flashSaleCoupon ?? null,
    };
  });
}

export async function saveBannerSettings(
  tenantId: string,
  actor: StaffActor,
  input: {
    announcement?: string | null;
    announcementBn?: string | null;
    flashSaleActive?: boolean;
    flashSaleEndsAt?: Date | null;
    flashSaleCoupon?: string | null;
  },
): Promise<void> {
  assertCan(actor, "marketing", "edit");
  await withTenant(tenantId, async (tx) => {
    const data = {
      announcement: input.announcement?.trim().slice(0, 300) || null,
      announcementBn: input.announcementBn?.trim().slice(0, 300) || null,
      flashSaleActive: Boolean(input.flashSaleActive),
      flashSaleEndsAt: input.flashSaleEndsAt ?? null,
      flashSaleCoupon: input.flashSaleCoupon?.trim().slice(0, 40) || null,
    };
    await upsertSettings(tx, tenantId, data);
    await audit(tx, tenantId, actor, "store.banner_updated", data);
  });
}
