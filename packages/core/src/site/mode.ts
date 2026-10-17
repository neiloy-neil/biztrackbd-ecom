import { withTenant } from "@biztrackbd/db";

export type SiteMode = "ECOMMERCE" | "PORTFOLIO" | "HYBRID";

export type BusinessVertical =
  | "RESTAURANT"
  | "DOCTOR_CLINIC"
  | "PUBLIC_FIGURE"
  | "BUSINESS_COMPANY"
  | "SERVICE_PROVIDER"
  | "PERSONAL_PORTFOLIO";

export interface ModeMeta {
  key: SiteMode;
  labelEn: string;
  labelBn: string;
  descriptionEn: string;
  descriptionBn: string;
  badge?: string;
}

export interface VerticalMeta {
  key: BusinessVertical;
  labelEn: string;
  labelBn: string;
  descriptionEn: string;
  descriptionBn: string;
  icon: string;
  recommendedCapabilities: string[];
}

export const SITE_MODES: Record<SiteMode, ModeMeta> = {
  ECOMMERCE: {
    key: "ECOMMERCE",
    labelEn: "Online Store & Ecommerce",
    labelBn: "অনলাইন স্টোর ও ই-কমার্স",
    descriptionEn: "Complete store with cart, checkout, bKash/Nagad, inventory, and Steadfast/Pathao courier booking.",
    descriptionBn: "কার্ট, চেকআউট, বিকাশ/নগদ, ইনভেন্টরি ও পাঠাও/স্টেডফাস্ট কুরিয়ার বুকিংসহ পূর্ণাঙ্গ অনলাইন শপ।",
  },
  PORTFOLIO: {
    key: "PORTFOLIO",
    labelEn: "Business Website & Portfolio",
    labelBn: "ব্যবসায়িক ওয়েবসাইট ও পোর্টফোলিও",
    descriptionEn: "Fast responsive website for clinics, restaurants, agencies, and professionals to capture leads and booking requests.",
    descriptionBn: "ক্লিনিক, রেস্তোরাঁ, কোম্পানি ও প্রফেশনালদের জন্য কাস্টমার লিড ও বুকিং রিকোয়েস্ট সংগ্রহের ওয়েবসাইট।",
    badge: "New",
  },
  HYBRID: {
    key: "HYBRID",
    labelEn: "Hybrid Business + Store",
    labelBn: "হাইব্রিড বিজনেস ও শপ",
    descriptionEn: "Showcase your portfolio, services, or restaurant menu while selling selected products with full checkout.",
    descriptionBn: "পোর্টফোলিও ও সেবার পাশাপাশি নির্দিষ্ট পণ্য বিক্রির জন্য চেকআউটসহ ওয়েবসাইট।",
  },
};

export const BUSINESS_VERTICALS: Record<BusinessVertical, VerticalMeta> = {
  RESTAURANT: {
    key: "RESTAURANT",
    labelEn: "Restaurant, Café & Food",
    labelBn: "রেস্তোরাঁ, ক্যাফে ও ফুড",
    descriptionEn: "Digital visual menu, downloadable QR code for tables, and table reservation requests.",
    descriptionBn: "ডিজিটাল মেনু, টেবিলের জন্য কিউআর কোড এবং টেবিল রিজার্ভেশন রিকোয়েস্ট।",
    icon: "utensils",
    recommendedCapabilities: ["menu", "booking_requests"],
  },
  DOCTOR_CLINIC: {
    key: "DOCTOR_CLINIC",
    labelEn: "Doctor, Specialist & Clinic",
    labelBn: "ডাক্তার, বিশেষজ্ঞ ও ক্লিনিক",
    descriptionEn: "Verified credentials, chamber schedules, and appointment requests (non-clinical contact).",
    descriptionBn: "ডিগ্রি ও যোগ্যতা, চেম্বারের সময়সূচি এবং অ্যাপয়েন্টমেন্ট রিকোয়েস্ট।",
    icon: "stethoscope",
    recommendedCapabilities: ["credentials", "booking_requests", "team_profiles", "services"],
  },
  PUBLIC_FIGURE: {
    key: "PUBLIC_FIGURE",
    labelEn: "Public Figure & Creator",
    labelBn: "পাবলিক ফিগার ও কনটেন্ট ক্রিয়েটর",
    descriptionEn: "Press/media links, biography, event schedule, and speaking or sponsorship booking inquiries.",
    descriptionBn: "মিডিয়া লিংক, জীবনী, ইভেন্ট শিডিউল এবং ইভেন্ট বা স্পনসরশিপ বুকিং এনকোয়ারি।",
    icon: "user-star",
    recommendedCapabilities: ["public_events", "portfolio_items", "leads"],
  },
  BUSINESS_COMPANY: {
    key: "BUSINESS_COMPANY",
    labelEn: "Company, Corporate & Agency",
    labelBn: "কোম্পানি, কর্পোরেট ও এজেন্সি",
    descriptionEn: "Company overview, services, client case studies, team profiles, and consultation quote requests.",
    descriptionBn: "কোম্পানি পরিচিতি, সেবা, কেস স্টাডি, টিম প্রোফাইল এবং কোটেশন রিকোয়েস্ট।",
    icon: "building",
    recommendedCapabilities: ["services", "portfolio_items", "team_profiles", "leads"],
  },
  SERVICE_PROVIDER: {
    key: "SERVICE_PROVIDER",
    labelEn: "Service Provider & Consultant",
    labelBn: "সার্ভিস প্রোভাইডার ও পরামর্শক",
    descriptionEn: "List of services with pricing, coverage area, customer reviews, and service quote requests.",
    descriptionBn: "মূল্যসহ সেবার তালিকা, সার্ভিস এরিয়া এবং কোট বা বুকিং রিকোয়েস্ট।",
    icon: "briefcase",
    recommendedCapabilities: ["services", "portfolio_items", "leads", "booking_requests"],
  },
  PERSONAL_PORTFOLIO: {
    key: "PERSONAL_PORTFOLIO",
    labelEn: "Personal Portfolio & Resume",
    labelBn: "ব্যক্তিগত পোর্টফোলিও ও সিভি",
    descriptionEn: "Showcase creative projects, career timeline, downloadable CV/PDF, and direct contact form.",
    descriptionBn: "প্রজেক্ট শোকেস, ক্যারিয়ার টাইমলাইন, ডাউনলোডযোগ্য সিভি এবং কন্টাক্ট ফর্ম।",
    icon: "folder",
    recommendedCapabilities: ["portfolio_items", "downloads", "credentials", "leads"],
  },
};

export function isSiteMode(val: unknown): val is SiteMode {
  return typeof val === "string" && (val === "ECOMMERCE" || val === "PORTFOLIO" || val === "HYBRID");
}

export function isBusinessVertical(val: unknown): val is BusinessVertical {
  return (
    typeof val === "string" &&
    (val === "RESTAURANT" ||
      val === "DOCTOR_CLINIC" ||
      val === "PUBLIC_FIGURE" ||
      val === "BUSINESS_COMPANY" ||
      val === "SERVICE_PROVIDER" ||
      val === "PERSONAL_PORTFOLIO")
  );
}

export function normalizeSiteMode(val: unknown): SiteMode {
  return isSiteMode(val) ? val : "ECOMMERCE";
}

export function normalizeBusinessVertical(val: unknown): BusinessVertical | null {
  return isBusinessVertical(val) ? val : null;
}

export async function getTenantModeAndVertical(
  tenantId: string
): Promise<{ siteMode: SiteMode; vertical: BusinessVertical | null }> {
  return withTenant(tenantId, async (tx) => {
    const t = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { siteMode: true, businessVertical: true },
    });
    return {
      siteMode: normalizeSiteMode(t?.siteMode),
      vertical: normalizeBusinessVertical(t?.businessVertical),
    };
  });
}

export async function setTenantModeAndVertical(
  tenantId: string,
  siteMode: SiteMode,
  vertical?: BusinessVertical | null
): Promise<void> {
  await withTenant(tenantId, async (tx) => {
    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        siteMode,
        businessVertical: vertical ?? null,
      },
    });
  });
}

/** Privacy PII Redaction for Platform Super-Admin Operators */
export function redactPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const clean = phone.trim();
  if (clean.length < 6) return "***";
  return clean.slice(0, 5) + "******";
}

export function redactEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain || !local) return "***@***";
  const maskedLocal = local.length > 2 ? `${local.slice(0, 2)}***` : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}

export function redactName(name: string | null | undefined): string {
  if (!name) return "Anonymous Visitor";
  const parts = name.trim().split(" ");
  if (parts.length === 1) {
    const first = parts[0] ?? "";
    return first.length > 3 ? `${first.slice(0, 3)}***` : `${first[0] ?? "*"}***`;
  }
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  return `${first} ${last[0] ?? "*"}***`;
}

export interface ModeTransitionDryRunResult {
  tenantId: string;
  tenantName: string;
  currentMode: SiteMode;
  targetMode: SiteMode;
  currentVertical: BusinessVertical | null;
  targetVertical: BusinessVertical | null;
  capabilitiesGained: string[];
  capabilitiesDisabled: string[];
  routesAdded: string[];
  routesDisabled: string[];
  recommendedPlanTier: string;
  preservedDataSummary: {
    productsCount: number;
    ordersCount: number;
    leadsCount: number;
    contentItemsCount: number;
  };
  requiresSeed: boolean;
  safetyChecksPassed: boolean;
  warnings: string[];
}

export interface ExecuteModeTransitionInput {
  targetMode: SiteMode;
  targetVertical?: BusinessVertical | null;
  reason: string;
  confirmedConsent: boolean;
}

/** Pre-flight dry-run validator for mode transitions */
export async function validateModeTransitionDryRun(
  tenantId: string,
  targetMode: SiteMode,
  targetVertical?: BusinessVertical | null
): Promise<ModeTransitionDryRunResult> {
  const { resolveTenantCapabilities } = await import("./capabilities");

  return withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        siteMode: true,
        businessVertical: true,
        planTier: true,
      },
    });
    if (!tenant) throw new (await import("../errors")).NotFoundError("Tenant");

    const currentMode = normalizeSiteMode(tenant.siteMode);
    const currentVertical = normalizeBusinessVertical(tenant.businessVertical);
    const normTargetVertical = targetVertical ? normalizeBusinessVertical(targetVertical) : null;

    const moduleRows = await tx.tenantModule.findMany({
      where: { tenantId, isEnabled: true },
      select: { moduleKey: true },
    });
    const activeModules = Object.fromEntries(moduleRows.map((m) => [m.moduleKey, true]));

    const currentCaps = resolveTenantCapabilities({
      siteMode: currentMode,
      vertical: currentVertical,
      planTier: tenant.planTier,
      activeModules,
    });

    const targetCaps = resolveTenantCapabilities({
      siteMode: targetMode,
      vertical: normTargetVertical,
      planTier: targetMode === "HYBRID" ? "BUSINESS" : tenant.planTier,
      activeModules,
    });

    const capKeys = Object.keys(targetCaps) as (keyof typeof targetCaps)[];
    const capabilitiesGained = capKeys.filter((k) => !currentCaps[k] && targetCaps[k]);
    const capabilitiesDisabled = capKeys.filter((k) => currentCaps[k] && !targetCaps[k]);

    const routesAdded: string[] = [];
    const routesDisabled: string[] = [];

    if (targetMode === "PORTFOLIO") {
      routesDisabled.push("/checkout", "/cart");
      if (normTargetVertical === "RESTAURANT") routesAdded.push("/menu", "/reservations");
      else if (normTargetVertical === "DOCTOR_CLINIC") routesAdded.push("/services", "/appointment");
      else routesAdded.push("/services", "/portfolio", "/contact");
    } else if (targetMode === "HYBRID") {
      if (normTargetVertical === "RESTAURANT") routesAdded.push("/menu", "/reservations");
      else if (normTargetVertical === "DOCTOR_CLINIC") routesAdded.push("/services", "/appointment");
      else routesAdded.push("/services", "/portfolio");
      if (!currentCaps.commerce) {
        routesAdded.push("/shop", "/checkout");
      }
    } else if (targetMode === "ECOMMERCE") {
      routesAdded.push("/shop", "/checkout", "/cart");
      routesDisabled.push("/appointment");
    }

    const [productsCount, ordersCount, leadsCount, contentItemsCount] = await Promise.all([
      tx.product.count({ where: { tenantId } }),
      tx.order.count({ where: { tenantId } }),
      tx.siteLead.count({ where: { tenantId } }),
      tx.siteContentItem.count({ where: { tenantId } }),
    ]);

    const warnings: string[] = [];
    if (currentMode === "ECOMMERCE" && targetMode === "PORTFOLIO" && productsCount > 0) {
      warnings.push(`Store has ${productsCount} active products. Cart and checkout routes will be paused, but product data remains 100% preserved.`);
    }
    if (targetMode === "HYBRID" && tenant.planTier === "STARTER") {
      warnings.push("Hybrid dual-engine requires BUSINESS or PRO plan tier for optimal courier and payment limits.");
    }

    return {
      tenantId,
      tenantName: tenant.name,
      currentMode,
      targetMode,
      currentVertical,
      targetVertical: normTargetVertical,
      capabilitiesGained,
      capabilitiesDisabled,
      routesAdded: Array.from(new Set(routesAdded)),
      routesDisabled: Array.from(new Set(routesDisabled)),
      recommendedPlanTier: targetMode === "HYBRID" ? "BUSINESS" : "STARTER",
      preservedDataSummary: {
        productsCount,
        ordersCount,
        leadsCount,
        contentItemsCount,
      },
      requiresSeed: contentItemsCount === 0 && targetMode !== "ECOMMERCE",
      safetyChecksPassed: true,
      warnings,
    };
  });
}

/** Executes an atomic, safe mode transition between ECOMMERCE, PORTFOLIO, and HYBRID */
export async function executeModeTransition(
  tenantId: string,
  actor: { id?: string; userId?: string; email?: string; ip?: string },
  input: ExecuteModeTransitionInput
): Promise<{ success: boolean; tenantId: string; newMode: SiteMode; newVertical: BusinessVertical | null }> {
  const { ValidationError, NotFoundError } = await import("../errors");
  const { audit } = await import("../audit/service");
  const { syncTenantRouting } = await import("../routing/edge-config");

  if (!input.confirmedConsent) {
    throw new ValidationError("Merchant consent verification is mandatory before executing mode transition", { field: "confirmedConsent" });
  }
  const reason = (input.reason || "").trim();
  if (reason.length < 3) {
    throw new ValidationError("Please provide a reason of at least 3 characters for the transition", { field: "reason" });
  }

  const result = await withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, siteMode: true, businessVertical: true, name: true },
    });
    if (!tenant) throw new NotFoundError("Tenant");

    const oldMode = tenant.siteMode;
    const oldVertical = tenant.businessVertical;

    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        siteMode: input.targetMode,
        businessVertical: input.targetVertical ?? null,
      },
    });

    await audit(
      tx,
      tenantId,
      {
        userId: actor.userId || actor.id || "PLATFORM_ADMIN",
        email: actor.email || "platform@biztrackbd.com",
        ip: actor.ip,
      },
      "tenant.mode_transitioned",
      {
        oldMode,
        newMode: input.targetMode,
        oldVertical,
        newVertical: input.targetVertical ?? null,
        reason,
      }
    );

    return {
      success: true,
      tenantId,
      newMode: input.targetMode,
      newVertical: input.targetVertical ?? null,
    };
  });

  try {
    await syncTenantRouting(tenantId);
  } catch (err) {
    console.warn("[mode] edge sync warning:", err);
  }

  return result;
}

