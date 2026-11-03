/**
 * The Business-website plans (Starter, Pro, Plus). The live copy is the SitePlan table, which the platform admin edits;
 * these are the defaults it is seeded with and the fallback when the database is not reachable.
 * Keyed by the shared tier names: STARTER = Business Starter, PRO = Business Pro, BUSINESS = Business Plus.
 */

/** null means unlimited. */
export interface PortfolioLimits {
  products: number | null;
  ordersPerMonth: number | null;
  staff: number | null;
  storageGb: number | null;
  landingPages: number | null;
  customPages: number | null;
  downloads: number | null;
  contentItems: number | null;
}

export interface PortfolioFeatures {
  customDomain: boolean;
  sectionBuilder: "home" | "all";
  headerFooterEditing: boolean;
  leadCapture: boolean;
  whatsappAlerts: boolean;
  bookingRequests: boolean;
  teamProfiles: boolean;
  hybridStore: boolean;
  courierBooking: "manual" | "auto";
  /** How many add-on modules the plan allows; "all" for every one. */
  modules: number | "all";
  capi: boolean;
}

export type PortfolioTier = "STARTER" | "PRO" | "BUSINESS";

export interface PortfolioPlanDef {
  tier: PortfolioTier;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  trialDays: number;
  limits: PortfolioLimits;
  features: PortfolioFeatures;
}

export const PORTFOLIO_LIMIT_KEYS = ["products", "ordersPerMonth", "staff", "storageGb", "landingPages", "customPages", "downloads", "contentItems"] as const satisfies readonly (keyof PortfolioLimits)[];

export const PORTFOLIO_PLAN_DEFS: PortfolioPlanDef[] = [
  {
    tier: "STARTER", name: "Business Starter", priceMonthly: 399, priceYearly: 3990, trialDays: 14,
    limits: { products: 10, ordersPerMonth: 0, staff: 1, storageGb: 5, landingPages: 5, customPages: 5, downloads: 5, contentItems: 15 },
    features: { customDomain: true, sectionBuilder: "home", headerFooterEditing: false, leadCapture: true, whatsappAlerts: true, bookingRequests: false, teamProfiles: false, hybridStore: false, courierBooking: "manual", modules: 0, capi: true },
  },
  {
    tier: "PRO", name: "Business Pro", priceMonthly: 799, priceYearly: 7990, trialDays: 14,
    limits: { products: 50, ordersPerMonth: 500, staff: 3, storageGb: 20, landingPages: 20, customPages: 20, downloads: null, contentItems: null },
    features: { customDomain: true, sectionBuilder: "all", headerFooterEditing: true, leadCapture: true, whatsappAlerts: true, bookingRequests: true, teamProfiles: true, hybridStore: true, courierBooking: "auto", modules: 3, capi: true },
  },
  {
    tier: "BUSINESS", name: "Business Plus", priceMonthly: 1499, priceYearly: 14990, trialDays: 14,
    limits: { products: 200, ordersPerMonth: 1000, staff: 10, storageGb: 100, landingPages: 50, customPages: null, downloads: null, contentItems: null },
    features: { customDomain: true, sectionBuilder: "all", headerFooterEditing: true, leadCapture: true, whatsappAlerts: true, bookingRequests: true, teamProfiles: true, hybridStore: true, courierBooking: "auto", modules: "all", capi: true },
  },
];

export const portfolioPlanDef = (tier: string): PortfolioPlanDef => PORTFOLIO_PLAN_DEFS.find((p) => p.tier === tier) ?? PORTFOLIO_PLAN_DEFS[0]!;

/** Business-website (portfolio) stores follow these plans. Online shops and hybrid stores, which sell products, follow the shop plans and their prices. */
export const usesPortfolioPlans = (siteMode: string | null | undefined): boolean => siteMode === "PORTFOLIO";
