import { withTenant } from "@biztrackbd/db";
import { normalizeBusinessVertical, normalizeSiteMode, type BusinessVertical, type SiteMode } from "./mode";

export interface TenantCapabilities {
  /** Full website builder, theme styling, sections */
  website_builder: boolean;
  /** Custom domain connection */
  custom_domain: boolean;
  /** Blog articles and posts */
  blog: boolean;
  /** Public contact and quote leads */
  leads: boolean;
  /** Website, visit and lead analytics */
  analytics: boolean;
  /** Services list and pricing cards */
  services: boolean;
  /** Portfolio items, case studies, project gallery */
  portfolio_items: boolean;
  /** Team, doctor, or staff profiles */
  team_profiles: boolean;
  /** Credentials, qualifications, publications, awards */
  credentials: boolean;
  /** Restaurant digital menu */
  menu: boolean;
  /** Request-based appointments or reservations */
  booking_requests: boolean;
  /** Speaking appearances, media events */
  public_events: boolean;
  /** Downloadable CV/brochure/menu assets */
  downloads: boolean;
  /** Products, inventory, cart, checkout, couriers */
  commerce: boolean;
  /** Online payment gateway & manual deposits */
  payments: boolean;
  /** AI copy generation */
  ai_copy: boolean;
  /** AI page draft layout generation */
  ai_page_draft: boolean;
}

export interface ResolveCapabilitiesParams {
  siteMode: string | null | undefined;
  vertical?: string | null;
  planTier?: string | null;
  activeModules?: Record<string, boolean>;
  maintenance?: boolean;
}

export function resolveTenantCapabilities(params: ResolveCapabilitiesParams): TenantCapabilities {
  const mode = normalizeSiteMode(params.siteMode);
  const vertical = normalizeBusinessVertical(params.vertical);
  const modules = params.activeModules ?? {};

  // Ecommerce mode: full commerce, portfolio features optional via modules
  if (mode === "ECOMMERCE") {
    return {
      website_builder: true,
      custom_domain: true,
      blog: true,
      leads: true,
      analytics: true,
      services: Boolean(modules.services),
      portfolio_items: Boolean(modules.portfolio),
      team_profiles: Boolean(modules.team),
      credentials: false,
      menu: false,
      booking_requests: false,
      public_events: false,
      downloads: true,
      commerce: true,
      payments: true,
      ai_copy: true,
      ai_page_draft: true,
    };
  }

  // Portfolio mode: zero commerce, capabilities driven by vertical and modules
  if (mode === "PORTFOLIO") {
    const isRestaurant = vertical === "RESTAURANT";
    const isDoctor = vertical === "DOCTOR_CLINIC";
    const isPublicFigure = vertical === "PUBLIC_FIGURE";
    const isCompany = vertical === "BUSINESS_COMPANY";
    const isService = vertical === "SERVICE_PROVIDER";
    const isPersonal = vertical === "PERSONAL_PORTFOLIO";

    return {
      website_builder: true,
      custom_domain: true,
      blog: true,
      leads: true,
      analytics: true,
      services: isService || isCompany || isDoctor || Boolean(modules.services),
      portfolio_items: isPersonal || isCompany || isService || isPublicFigure || Boolean(modules.portfolio),
      team_profiles: isCompany || isDoctor || isRestaurant || Boolean(modules.team),
      credentials: isDoctor || isPublicFigure || isPersonal || Boolean(modules.credentials),
      menu: isRestaurant || Boolean(modules.menu),
      booking_requests: isRestaurant || isDoctor || isService || Boolean(modules.booking_requests),
      public_events: isPublicFigure || isCompany || Boolean(modules.events),
      downloads: true,
      commerce: false,
      payments: false,
      ai_copy: true,
      ai_page_draft: true,
    };
  }

  // Hybrid mode: Portfolio base + enabled commerce capabilities
  const isCommerceEnabled = Boolean(modules.commerce || params.planTier !== "STARTER");
  const isRestaurant = vertical === "RESTAURANT";
  const isDoctor = vertical === "DOCTOR_CLINIC";
  const isPublicFigure = vertical === "PUBLIC_FIGURE";
  const isCompany = vertical === "BUSINESS_COMPANY";
  const isService = vertical === "SERVICE_PROVIDER";
  const isPersonal = vertical === "PERSONAL_PORTFOLIO";

  return {
    website_builder: true,
    custom_domain: true,
    blog: true,
    leads: true,
    analytics: true,
    services: isService || isCompany || isDoctor || Boolean(modules.services),
    portfolio_items: isPersonal || isCompany || isService || isPublicFigure || Boolean(modules.portfolio),
    team_profiles: isCompany || isDoctor || isRestaurant || Boolean(modules.team),
    credentials: isDoctor || isPublicFigure || isPersonal || Boolean(modules.credentials),
    menu: isRestaurant || Boolean(modules.menu),
    booking_requests: isRestaurant || isDoctor || isService || Boolean(modules.booking_requests),
    public_events: isPublicFigure || isCompany || Boolean(modules.events),
    downloads: true,
    commerce: isCommerceEnabled,
    payments: isCommerceEnabled,
    ai_copy: true,
    ai_page_draft: true,
  };
}

export async function getTenantCapabilities(tenantId: string): Promise<TenantCapabilities> {
  return withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { siteMode: true, businessVertical: true, planTier: true },
    });
    const moduleRows = await tx.tenantModule.findMany({
      where: { tenantId, isEnabled: true },
      select: { moduleKey: true },
    });
    const activeModules = Object.fromEntries(moduleRows.map((m) => [m.moduleKey, true]));

    return resolveTenantCapabilities({
      siteMode: tenant?.siteMode,
      vertical: tenant?.businessVertical,
      planTier: tenant?.planTier,
      activeModules,
    });
  });
}
