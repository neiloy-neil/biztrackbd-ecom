import { assertNotInDemo } from "../demo/guard";
import { Prisma, getBasePrisma, withTenant, type TenantTx } from "@biztrackbd/db";
import { z } from "zod";
import { audit } from "../audit/service";
import { NotFoundError, ValidationError } from "../errors";
import { readUsage, type UsageSummary } from "../limits/plan";
import { assertCan, type StaffActor } from "../permissions";
import { normalizeBdPhone } from "../phone";
import { accessState, type Access } from "./lifecycle";

/** What a store sees of its own subscription (AdmBilling, AdmLimit, AdmReadOnly). Everything here is read with the store's own context. */

export type PlanTierName = "STARTER" | "PRO" | "BUSINESS";

export interface PlanView {
  tier: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  /** Months free when paying yearly, as a whole number. */
  yearlyMonthsFree: number;
  trialDays: number;
  limits: { products: number | null; ordersPerMonth: number | null; staff: number | null; storageGb: number | null; smsCredits: number | null; landingPages: number | null };
  features: Record<string, unknown>;
}

const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function toPlanView(p: { tier: string; name: string; priceMonthlyBdt: Prisma.Decimal | number; priceYearlyBdt: Prisma.Decimal | number; trialDays: number; limits: unknown; features: unknown }): PlanView {
  const l = (p.limits ?? {}) as Record<string, unknown>;
  const monthly = Number(p.priceMonthlyBdt), yearly = Number(p.priceYearlyBdt);
  return {
    tier: p.tier, name: p.name, priceMonthly: monthly, priceYearly: yearly, trialDays: p.trialDays,
    yearlyMonthsFree: monthly > 0 ? Math.max(0, Math.round(12 - yearly / monthly)) : 0,
    limits: { products: numOrNull(l.products), ordersPerMonth: numOrNull(l.ordersPerMonth), staff: numOrNull(l.staff), storageGb: numOrNull(l.storageGb), smsCredits: numOrNull(l.smsCredits), landingPages: numOrNull(l.landingPages) },
    features: (p.features ?? {}) as Record<string, unknown>,
  };
}

const FALLBACK_PUBLIC_PLANS: PlanView[] = [
  {
    tier: "STARTER",
    name: "Starter",
    priceMonthly: 699,
    priceYearly: 6990,
    yearlyMonthsFree: 2,
    trialDays: 14,
    limits: { products: 300, ordersPerMonth: 500, staff: 2, storageGb: 5, smsCredits: 200, landingPages: 3 },
    features: { customDomain: false, courierBooking: "manual", fraud: "basic", sectionBuilder: "settings", modules: 0, paymentGateway: false, capi: true },
  },
  {
    tier: "PRO",
    name: "Pro",
    priceMonthly: 1499,
    priceYearly: 14990,
    yearlyMonthsFree: 2,
    trialDays: 14,
    limits: { products: 2000, ordersPerMonth: 3000, staff: 5, storageGb: 20, smsCredits: 1000, landingPages: 20 },
    features: { customDomain: true, courierBooking: "auto", fraud: "full", sectionBuilder: "home", modules: 3, paymentGateway: false, capi: true },
  },
  {
    tier: "BUSINESS",
    name: "Business",
    priceMonthly: 3499,
    priceYearly: 34990,
    yearlyMonthsFree: 2,
    trialDays: 14,
    limits: { products: null, ordersPerMonth: null, staff: 15, storageGb: 100, smsCredits: 3000, landingPages: null },
    features: { customDomain: true, courierBooking: "auto", fraud: "full", sectionBuilder: "all", modules: "all", paymentGateway: true, capi: true },
  },
];

export const FALLBACK_PORTFOLIO_PLANS: PlanView[] = [
  {
    tier: "STARTER",
    name: "Portfolio Starter",
    priceMonthly: 990,
    priceYearly: 9900,
    yearlyMonthsFree: 2,
    trialDays: 14,
    limits: { products: 10, ordersPerMonth: 50, staff: 2, storageGb: 5, smsCredits: 200, landingPages: 5 },
    features: { customDomain: true, leadCapture: true, downloadsLimit: 5, contentItemsLimit: 15, bookingRequests: false, whatsappAlerts: true, teamProfiles: false, hybridStore: false, mode: "PORTFOLIO" },
  },
  {
    tier: "PRO",
    name: "Portfolio Pro",
    priceMonthly: 1990,
    priceYearly: 19900,
    yearlyMonthsFree: 2,
    trialDays: 14,
    limits: { products: 50, ordersPerMonth: 200, staff: 5, storageGb: 20, smsCredits: 1000, landingPages: 25 },
    features: { customDomain: true, leadCapture: true, downloadsLimit: "unlimited", contentItemsLimit: "unlimited", bookingRequests: true, whatsappAlerts: true, teamProfiles: true, hybridStore: false, mode: "PORTFOLIO" },
  },
  {
    tier: "BUSINESS",
    name: "Portfolio Business",
    priceMonthly: 3990,
    priceYearly: 39900,
    yearlyMonthsFree: 2,
    trialDays: 14,
    limits: { products: 200, ordersPerMonth: 1000, staff: 15, storageGb: 100, smsCredits: 3000, landingPages: null },
    features: { customDomain: true, leadCapture: true, downloadsLimit: "unlimited", contentItemsLimit: "unlimited", bookingRequests: true, whatsappAlerts: true, teamProfiles: true, hybridStore: true, mode: "PORTFOLIO" },
  },
];

/** The plans on the pricing page and the upgrade screen. Prices and limits come from the Plan table, falling back to defaults if DB is unreachable. */
export async function listPublicPlans(): Promise<PlanView[]> {
  try {
    const rows = await getBasePrisma().plan.findMany({ where: { isPublic: true, tier: { not: "ENTERPRISE" } }, orderBy: { sortOrder: "asc" } });
    if (rows && rows.length > 0) return rows.map(toPlanView);
  } catch {
    // fallback to preset plans if database is not yet ready or configured
  }
  return FALLBACK_PUBLIC_PLANS;
}

export async function listPublicPortfolioPlans(): Promise<PlanView[]> {
  return FALLBACK_PORTFOLIO_PLANS;
}

export interface ProofView {
  id: string;
  planTier: string;
  interval: string;
  amount: number;
  provider: string;
  senderNumber: string;
  trxId: string;
  status: string;
  note: string | null;
  rejectionReason: string | null;
  createdAt: Date;
  approvedAt: Date | null;
  appliedTo: Date | null;
}

export interface PayTo {
  provider: "BKASH" | "NAGAD";
  number: string;
  kind: string;
}

/** Where subscription money is sent. Set by the platform, not by stores. */
export function paymentTargets(env: NodeJS.ProcessEnv = process.env): PayTo[] {
  const out: PayTo[] = [];
  if (env.PLATFORM_BKASH_NUMBER) out.push({ provider: "BKASH", number: env.PLATFORM_BKASH_NUMBER, kind: env.PLATFORM_BKASH_KIND ?? "MERCHANT" });
  if (env.PLATFORM_NAGAD_NUMBER) out.push({ provider: "NAGAD", number: env.PLATFORM_NAGAD_NUMBER, kind: env.PLATFORM_NAGAD_KIND ?? "MERCHANT" });
  return out;
}

export interface BillingOverview {
  storeName: string;
  tier: string;
  access: Access;
  subscription: { tier: string; interval: string; amount: number; periodStart: Date; periodEnd: Date } | null;
  plans: PlanView[];
  usage: UsageSummary;
  proofs: ProofView[];
  pending: ProofView | null;
  payTo: PayTo[];
}

const toProof = (p: { id: string; planTier: string; billingPeriod: string; amount: Prisma.Decimal; mfsProvider: string; senderNumber: string; trxId: string; status: string; note: string | null; rejectionReason: string | null; createdAt: Date; approvedAt: Date | null; appliedTo: Date | null }): ProofView => ({
  id: p.id, planTier: p.planTier, interval: p.billingPeriod, amount: Number(p.amount), provider: p.mfsProvider, senderNumber: p.senderNumber, trxId: p.trxId,
  status: p.status, note: p.note, rejectionReason: p.rejectionReason, createdAt: p.createdAt, approvedAt: p.approvedAt, appliedTo: p.appliedTo,
});

/** The state a store is in right now. Used by the admin on every request, so it is one small read. */
export async function getStoreAccess(tenantId: string, now: Date = new Date(), clientTx?: TenantTx): Promise<Access> {
  if (clientTx) {
    const t = await clientTx.tenant.findFirstOrThrow({ select: { status: true, trialEndsAt: true, suspendedReason: true } });
    const sub = await clientTx.subscription.findFirst({ select: { amount: true, currentPeriodEnd: true } });
    return accessState({ status: t.status, trialEndsAt: t.trialEndsAt, suspendedReason: t.suspendedReason, subscription: sub ? { amount: Number(sub.amount), currentPeriodEnd: sub.currentPeriodEnd } : null }, now);
  }
  return withTenant(tenantId, async (tx) => {
    const t = await tx.tenant.findFirstOrThrow({ select: { status: true, trialEndsAt: true, suspendedReason: true } });
    const sub = await tx.subscription.findFirst({ select: { amount: true, currentPeriodEnd: true } });
    return accessState({ status: t.status, trialEndsAt: t.trialEndsAt, suspendedReason: t.suspendedReason, subscription: sub ? { amount: Number(sub.amount), currentPeriodEnd: sub.currentPeriodEnd } : null }, now);
  });
}

export async function getBillingOverview(tenantId: string, actor: StaffActor, now: Date = new Date()): Promise<BillingOverview> {
  assertCan(actor, "billing", "view");
  const plans = await listPublicPlans();
  return withTenant(tenantId, async (tx) => {
    const t = await tx.tenant.findFirst({ select: { name: true, planTier: true, status: true, trialEndsAt: true, suspendedReason: true } });
    if (!t) throw new NotFoundError("Store");
    const sub = await tx.subscription.findFirst();
    const proofs = await tx.paymentProof.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
    const views = proofs.map(toProof);
    return {
      storeName: t.name, tier: t.planTier,
      access: accessState({ status: t.status, trialEndsAt: t.trialEndsAt, suspendedReason: t.suspendedReason, subscription: sub ? { amount: Number(sub.amount), currentPeriodEnd: sub.currentPeriodEnd } : null }, now),
      subscription: sub ? { tier: sub.planTier, interval: sub.interval, amount: Number(sub.amount), periodStart: sub.currentPeriodStart, periodEnd: sub.currentPeriodEnd } : null,
      plans, usage: await readUsage(tx, now), proofs: views, pending: views.find((p) => p.status === "PENDING") ?? null, payTo: paymentTargets(),
    };
  });
}

const TRX = /^[A-Z0-9]{8,12}$/;

export const ProofInput = z.object({
  plan: z.enum(["STARTER", "PRO", "BUSINESS"]),
  interval: z.enum(["MONTHLY", "YEARLY"]),
  provider: z.enum(["BKASH", "NAGAD", "ROCKET", "UPAY"]),
  senderNumber: z.string().trim().min(1, "Enter the number you sent from"),
  trxId: z.string().trim().toUpperCase(),
  note: z.string().trim().max(200).optional(),
});
export type ProofInput = z.input<typeof ProofInput>;

/**
 * The owner has sent the subscription money and says so. The amount is the plan's price, read here, never from the browser.
 * A platform finance person checks the TrxID in the platform's own bKash or Nagad app and approves it (SaPayments).
 * Allowed while the store is read-only or locked: paying is the way out.
 */
export async function submitPaymentProof(tenantId: string, actor: StaffActor, raw: unknown): Promise<ProofView> {
  await assertNotInDemo(tenantId, "Paying for a plan");
  assertCan(actor, "billing", "edit");
  const parsed = ProofInput.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Check the form");
  const input = parsed.data;
  if (!TRX.test(input.trxId)) throw new ValidationError("That transaction ID does not look right. It is 8 to 12 letters and numbers.", { field: "trxId" });
  let sender: string;
  try {
    sender = normalizeBdPhone(input.senderNumber);
  } catch {
    throw new ValidationError("Enter the mobile number you sent the money from, like 01712345678", { field: "senderNumber" });
  }
  const plan = await getBasePrisma().plan.findUnique({ where: { tier: input.plan } });
  if (!plan || !plan.isPublic) throw new ValidationError("Choose a plan");
  const amount = Number(input.interval === "YEARLY" ? plan.priceYearlyBdt : plan.priceMonthlyBdt);

  try {
    return await withTenant(tenantId, async (tx) => {
      if (await tx.paymentProof.findFirst({ where: { status: "PENDING" } })) {
        throw new ValidationError("You already have a payment waiting to be checked. We will confirm it soon.");
      }
      const row = await tx.paymentProof.create({
        data: { tenantId, planTier: input.plan, billingPeriod: input.interval, amount, mfsProvider: input.provider, senderNumber: sender, trxId: input.trxId, note: input.note || null },
      });
      await audit(tx, tenantId, actor, "billing.proof_submitted", { plan: input.plan, interval: input.interval, amount, provider: input.provider, trxId: input.trxId });
      return toProof(row);
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Same message whether the TrxID is ours or another store's: it must not reveal who paid.
      throw new ValidationError("That transaction ID has already been used.", { field: "trxId" });
    }
    throw e;
  }
}

/** The owner changed their mind or made a typo before anyone looked. */
export async function cancelPendingProof(tenantId: string, actor: StaffActor, proofId: string): Promise<void> {
  await assertNotInDemo(tenantId, "Paying for a plan");
  assertCan(actor, "billing", "edit");
  await withTenant(tenantId, async (tx) => {
    const { count } = await tx.paymentProof.deleteMany({ where: { id: proofId, status: "PENDING" } });
    if (count === 0) throw new ValidationError("That payment is not waiting any more");
    await audit(tx, tenantId, actor, "billing.proof_cancelled", { proofId });
  });
}
