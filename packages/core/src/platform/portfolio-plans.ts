/**
 * The Business-website plans (Starter, Pro, Plus) in one place. The public pricing page, the upgrade screen and the
 * limit checks all read from here, so what a plan promises is what it enforces.
 * Keyed by the shared tier names: STARTER = Business Starter, PRO = Business Pro, BUSINESS = Business Plus.
 */

/** null means unlimited. */
export interface PortfolioLimits {
  products: number;
  ordersPerMonth: number;
  staff: number;
  storageGb: number;
  landingPages: number;
  customPages: number | null;
  downloads: number | null;
  contentItems: number | null;
}

export interface PortfolioFeatures {
  bookingRequests: boolean;
  teamProfiles: boolean;
  hybridStore: boolean;
}

export interface PortfolioPlanDef {
  tier: "STARTER" | "PRO" | "BUSINESS";
  name: string;
  priceMonthly: number;
  priceYearly: number;
  sectionBuilder: "home" | "all";
  limits: PortfolioLimits;
  features: PortfolioFeatures;
}

export const PORTFOLIO_PLAN_DEFS: PortfolioPlanDef[] = [
  {
    tier: "STARTER", name: "Business Starter", priceMonthly: 399, priceYearly: 3990, sectionBuilder: "home",
    limits: { products: 10, ordersPerMonth: 0, staff: 1, storageGb: 5, landingPages: 5, customPages: 5, downloads: 5, contentItems: 15 },
    features: { bookingRequests: false, teamProfiles: false, hybridStore: false },
  },
  {
    tier: "PRO", name: "Business Pro", priceMonthly: 799, priceYearly: 7990, sectionBuilder: "all",
    limits: { products: 50, ordersPerMonth: 500, staff: 3, storageGb: 20, landingPages: 20, customPages: 20, downloads: null, contentItems: null },
    features: { bookingRequests: true, teamProfiles: true, hybridStore: true },
  },
  {
    tier: "BUSINESS", name: "Business Plus", priceMonthly: 1499, priceYearly: 14990, sectionBuilder: "all",
    limits: { products: 200, ordersPerMonth: 1000, staff: 10, storageGb: 100, landingPages: 50, customPages: null, downloads: null, contentItems: null },
    features: { bookingRequests: true, teamProfiles: true, hybridStore: true },
  },
];

export const portfolioPlanDef = (tier: string): PortfolioPlanDef => PORTFOLIO_PLAN_DEFS.find((p) => p.tier === tier) ?? PORTFOLIO_PLAN_DEFS[0]!;

/** Portfolio and hybrid stores follow the Business-website plans; a plain online shop follows the commerce plans. */
export const usesPortfolioPlans = (siteMode: string | null | undefined): boolean => siteMode === "PORTFOLIO" || siteMode === "HYBRID";
