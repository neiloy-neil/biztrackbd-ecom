import type { TenantTx } from "@biztrackbd/db";
import { PORTFOLIO_PLAN_DEFS, portfolioPlanDef, usesPortfolioPlans } from "./portfolio-plans";

/** One plan as the limit and feature checks read it, whichever table it came from. */
export interface PlanData {
  tier: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  trialDays: number;
  isPublic: boolean;
  limits: Record<string, unknown>;
  features: Record<string, unknown>;
}

type PlanReader = Pick<TenantTx, "plan" | "sitePlan">;
type Row = { tier: string; name: string; priceMonthlyBdt: unknown; priceYearlyBdt: unknown; trialDays: number; isPublic: boolean; limits: unknown; features: unknown };

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export const planFromRow = (r: Row): PlanData => ({
  tier: r.tier, name: r.name, priceMonthly: Number(r.priceMonthlyBdt), priceYearly: Number(r.priceYearlyBdt), trialDays: r.trialDays, isPublic: r.isPublic,
  limits: obj(r.limits), features: obj(r.features),
});

/** The built-in Business-website plan, used when its row is missing or the database cannot be reached. */
export function portfolioFallback(tier: string): PlanData {
  const d = portfolioPlanDef(tier);
  return { tier: d.tier, name: d.name, priceMonthly: d.priceMonthly, priceYearly: d.priceYearly, trialDays: d.trialDays, isPublic: true, limits: { ...d.limits }, features: { ...d.features } };
}

export const PORTFOLIO_FALLBACKS: PlanData[] = PORTFOLIO_PLAN_DEFS.map((d) => portfolioFallback(d.tier));

/**
 * The plan a store is on. Business-website (portfolio) stores follow the Business-website plans (SitePlan); online shops and hybrid stores follow Plan.
 * An online shop whose plan row is missing gets an empty plan (no caps), as before.
 */
export async function planFor(tx: PlanReader, tier: string, siteMode: string | null | undefined): Promise<PlanData> {
  if (usesPortfolioPlans(siteMode)) {
    const row = await tx.sitePlan.findUnique({ where: { tier: tier as never } });
    return row ? planFromRow(row) : portfolioFallback(tier);
  }
  const row = await tx.plan.findUnique({ where: { tier: tier as never } });
  return row ? planFromRow(row) : { tier, name: tier, priceMonthly: 0, priceYearly: 0, trialDays: 14, isPublic: false, limits: {}, features: {} };
}

/** The plan features of the store this transaction belongs to. */
export async function tenantPlanFeatures(tx: TenantTx): Promise<{ tier: string; siteMode: string; features: Record<string, unknown> }> {
  const t = await tx.tenant.findFirstOrThrow({ select: { planTier: true, siteMode: true } });
  const plan = await planFor(tx, t.planTier, t.siteMode);
  return { tier: t.planTier, siteMode: t.siteMode, features: plan.features };
}
